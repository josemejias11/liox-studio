import { z } from 'zod';

import { CourseAssessmentInputSchema, type CourseAssessmentInput } from './course-assessment';
import { COURSE_LESSON_TYPES, type CourseGraph, type CourseGraphQuiz } from './course-studio';
import { CourseImageReferenceSchema } from './course-assets';
import { CourseTemplateChecklistSchema } from './course-template';

export const CourseReadinessIssueCodeSchema = z.enum([
  'template_placeholder',
  'required_media',
  'unsupported_lesson',
  'invalid_assessment',
  'invalid_drag_drop',
  'invalid_learning_cue',
]);
export type CourseReadinessIssueCode = z.infer<typeof CourseReadinessIssueCodeSchema>;

export const CourseReadinessIssueSchema = z.object({
  code: CourseReadinessIssueCodeSchema,
  entityId: z.string().min(1).max(100).optional(),
  field: z.string().min(1).max(120).optional(),
  message: z.string().min(1).max(2000),
});
export type CourseReadinessIssue = z.infer<typeof CourseReadinessIssueSchema>;

export class CourseNotReadyError extends Error {
  readonly issues: CourseReadinessIssue[];

  constructor(issues: CourseReadinessIssue[]) {
    super('COURSE_NOT_READY');
    this.name = 'CourseNotReadyError';
    this.issues = issues;
  }
}

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function path(...parts: string[]): string {
  return parts.join(' -> ');
}

function issue(
  code: CourseReadinessIssueCode,
  message: string,
  entityId?: string,
  field?: string,
): CourseReadinessIssue {
  return { code, message, ...(entityId ? { entityId } : {}), ...(field ? { field } : {}) };
}

function assetIsValid(value: unknown): boolean {
  return CourseImageReferenceSchema.safeParse(value).success;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as JsonObject)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

function fieldValue(value: unknown, field: string): unknown {
  return field.split('.').reduce<unknown>((current, key) => {
    if (Array.isArray(current)) return /^\d+$/.test(key) ? current[Number(key)] : undefined;
    return object(current)[key];
  }, value);
}

function cueTargets(lesson: CourseGraph['chapters'][number]['lessons'][number]): Set<string> {
  const payload = object(lesson.payload);
  const labels = (value: unknown) =>
    Array.isArray(value)
      ? value.flatMap((item) => {
          const label = object(item).label;
          return typeof label === 'string' && label.trim() ? [label.trim()] : [];
        })
      : [];
  switch (lesson.lessonType) {
    case 'content':
    case 'interaction':
      return new Set([...labels(payload.hotspots), ...labels(payload.coveredFeatures)]);
    case 'stage':
    case 'canvas':
      return new Set(labels(payload.hotspots));
    case 'splitScreen':
    case 'scrollStory':
      return new Set(labels(payload.coveredFeatures));
    default:
      return new Set();
  }
}

function layerLinks(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((block) => {
    const markDefs = object(block).markDefs;
    if (!Array.isArray(markDefs)) return [];
    return markDefs.flatMap((definition) => {
      const cue = object(definition);
      return cue._type === 'layerLink' && typeof cue.linkedLayer === 'string'
        ? [cue.linkedLayer]
        : [];
    });
  });
}

function assessmentInputFromQuiz(quiz: CourseGraphQuiz): CourseAssessmentInput {
  const payload = object(quiz.payload);
  return {
    title: quiz.title ?? '',
    ...(quiz.instructions === null ? {} : { instructions: quiz.instructions }),
    questions: Array.isArray(payload.questions) ? payload.questions : [],
    passingScore: payload.passingScore,
    allowRetry: payload.allowRetry,
    showCorrectAnswers: payload.showCorrectAnswers,
  } as CourseAssessmentInput;
}

export { assessmentInputFromQuiz };

function validateAssessment(
  quiz: CourseGraphQuiz | null,
  location: string,
  issues: CourseReadinessIssue[],
): void {
  if (!quiz) return;
  const parsed = CourseAssessmentInputSchema.safeParse(assessmentInputFromQuiz(quiz));
  if (parsed.success) return;
  for (const validationIssue of parsed.error.issues) {
    const question = validationIssue.path.findIndex((part) => part === 'questions');
    const questionIndex = question === -1 ? undefined : validationIssue.path[question + 1];
    const suffix = typeof questionIndex === 'number' ? ` -> Question ${questionIndex + 1}` : '';
    issues.push(
      issue(
        'invalid_assessment',
        `${location}${suffix} -> ${validationIssue.message}`,
        quiz.id,
        validationIssue.path.join('.'),
      ),
    );
  }
}

function resolveEntity(course: CourseGraph, entityId: string): unknown {
  if (course.id === entityId) return course;
  for (const chapter of course.chapters) {
    if (chapter.id === entityId) return chapter;
    if (chapter.quickCheck?.id === entityId) return chapter.quickCheck;
    const lesson = chapter.lessons.find((item) => item.id === entityId);
    if (lesson) return lesson;
  }
  return course.finalQuiz?.id === entityId ? course.finalQuiz : undefined;
}

function validateTemplateChecklist(course: CourseGraph, issues: CourseReadinessIssue[]): void {
  if (!course.templateChecklist) return;
  const parsed = CourseTemplateChecklistSchema.safeParse(course.templateChecklist);
  if (!parsed.success) {
    issues.push(
      issue('template_placeholder', 'Course template requirements are invalid.', course.id),
    );
    return;
  }
  for (const requirement of parsed.data.requirements) {
    const entity = resolveEntity(course, requirement.entityId);
    if (!entity) {
      issues.push(
        issue(
          'template_placeholder',
          `${requirement.label} references an unknown template item.`,
          requirement.entityId,
          requirement.field,
        ),
      );
      continue;
    }
    const value = fieldValue(entity, requirement.field);
    const failed =
      requirement.rule === 'changed'
        ? stableJson(value) === requirement.initialFingerprint
        : requirement.rule === 'media'
          ? !assetIsValid(value)
          : requirement.rule === 'minimum'
            ? !Array.isArray(value) || value.length < requirement.minimum
            : !CourseAssessmentInputSchema.safeParse(
                assessmentInputFromQuiz(entity as CourseGraphQuiz),
              ).success;
    if (failed) {
      issues.push(
        issue(
          requirement.rule === 'assessment' ? 'invalid_assessment' : 'template_placeholder',
          `${requirement.label} must be completed before delivery.`,
          requirement.entityId,
          requirement.field,
        ),
      );
    }
  }
}

export function validateCourseReadiness(course: CourseGraph): CourseReadinessIssue[] {
  const issues: CourseReadinessIssue[] = [];
  for (const chapter of course.chapters) {
    const chapterPath = `Chapter ${chapter.position + 1}`;
    validateAssessment(chapter.quickCheck, path(chapterPath, 'Knowledge check'), issues);
    for (const lesson of chapter.lessons) {
      const location = path(chapterPath, lesson.headline || `Lesson ${lesson.position + 1}`);
      const payload = object(lesson.payload);
      if (
        !COURSE_LESSON_TYPES.includes(lesson.lessonType as (typeof COURSE_LESSON_TYPES)[number])
      ) {
        issues.push(
          issue(
            'unsupported_lesson',
            `${location} -> This lesson type is not supported.`,
            lesson.id,
          ),
        );
      } else if (lesson.lessonType === 'quiz') {
        issues.push(
          issue(
            'unsupported_lesson',
            `${location} -> Inline Quiz lessons are not supported.`,
            lesson.id,
          ),
        );
      }
      if (
        ['canvas', 'dragDrop', 'scrollStory'].includes(lesson.lessonType) &&
        !assetIsValid(payload.media)
      ) {
        issues.push(
          issue(
            'required_media',
            `${location} -> Product image is required.`,
            lesson.id,
            'payload.media',
          ),
        );
      }
      if (lesson.lessonType === 'stage') {
        if (!assetIsValid(payload.media))
          issues.push(
            issue(
              'required_media',
              `${location} -> Product image is required.`,
              lesson.id,
              'payload.media',
            ),
          );
        if (!assetIsValid(payload.stageBackground))
          issues.push(
            issue(
              'required_media',
              `${location} -> Stage background is required.`,
              lesson.id,
              'payload.stageBackground',
            ),
          );
      }
      if (lesson.lessonType === 'video' && !assetIsValid(payload.videoFile)) {
        issues.push(
          issue(
            'required_media',
            `${location} -> Video file is required.`,
            lesson.id,
            'payload.videoFile',
          ),
        );
      }
      if (lesson.lessonType === 'colorSwitcher') {
        const variants = Array.isArray(payload.colorVariants) ? payload.colorVariants : [];
        if (
          !variants.some((variant) => {
            const data = object(variant);
            return typeof data.label === 'string' && data.label.trim() && assetIsValid(data.image);
          })
        ) {
          issues.push(
            issue(
              'required_media',
              `${location} -> At least one complete color variant is required.`,
              lesson.id,
              'payload.colorVariants',
            ),
          );
        }
      }
      if (lesson.lessonType === 'dragDrop') {
        const chips = Array.isArray(payload.chips) ? payload.chips : [];
        const chipIds = new Set(
          chips
            .map((chip) => object(chip).id)
            .filter((id): id is string => typeof id === 'string' && id.length > 0),
        );
        const zones = Array.isArray(payload.dropZones) ? payload.dropZones : [];
        for (const [index, zone] of zones.entries()) {
          const data = object(zone);
          if (typeof data.correctChipId !== 'string' || !chipIds.has(data.correctChipId)) {
            issues.push(
              issue(
                'invalid_drag_drop',
                `${location} -> Drop zone ${index + 1} must reference an available chip.`,
                lesson.id,
                `payload.dropZones.${index}.correctChipId`,
              ),
            );
          }
        }
      }
      for (const [index, hotspot] of (Array.isArray(payload.hotspots)
        ? payload.hotspots
        : []
      ).entries()) {
        const data = object(hotspot);
        if (!Number.isFinite(data.x) || !Number.isFinite(data.y)) {
          issues.push(
            issue(
              'invalid_learning_cue',
              `${location} -> Hotspot ${index + 1} must have valid coordinates.`,
              lesson.id,
              `payload.hotspots.${index}`,
            ),
          );
        }
      }
      const targets = cueTargets(lesson);
      const cueValues = [
        lesson.body,
        ...(Array.isArray(payload.hotspots) ? payload.hotspots : []).map(
          (hotspot) => object(hotspot).body,
        ),
        ...(Array.isArray(payload.scrollChapters) ? payload.scrollChapters : []).map(
          (item) => object(item).body,
        ),
      ];
      for (const target of cueValues.flatMap(layerLinks)) {
        if (!targets.has(target)) {
          issues.push(
            issue(
              'invalid_learning_cue',
              `${location} -> Learning cue “${target}” no longer points to a hotspot or covered feature.`,
              lesson.id,
            ),
          );
        }
      }
    }
  }
  validateAssessment(course.finalQuiz, 'Final assessment', issues);
  validateTemplateChecklist(course, issues);
  return issues;
}
