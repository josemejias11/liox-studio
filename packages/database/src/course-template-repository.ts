import { Prisma } from '@prisma/client';
import type {
  CourseTemplateChecklist,
  CourseTemplateDefinition,
  TemplateRequirement,
} from '@moto-ai/contracts';
import type { CourseGraph } from '@moto-ai/contracts/course-studio';
import { prisma } from './index';
import { getAuthoringCourse } from './course-repository';

function newId(prefix: string): string {
  return `${prefix}.${crypto.randomUUID()}`;
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'untitled-course'
  );
}

function jsonValue(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null || value === undefined ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

function assessmentData(input: NonNullable<CourseTemplateDefinition['finalQuiz']>) {
  return {
    title: input.title,
    instructions: input.instructions ?? null,
    payload: {
      questions: input.questions as unknown as Prisma.InputJsonArray,
      passingScore: input.passingScore,
      allowRetry: input.allowRetry,
      showCorrectAnswers: input.showCorrectAnswers,
    } satisfies Prisma.InputJsonObject,
  };
}

function concreteRequirement(
  requirement: TemplateRequirement,
  entityIds: Map<string, string>,
): TemplateRequirement {
  const entityId = entityIds.get(requirement.entityId);
  if (!entityId) {
    throw new Error(`TEMPLATE_REQUIREMENT_ENTITY_NOT_FOUND:${requirement.entityId}`);
  }
  return { ...requirement, entityId };
}

const TEMPLATE_CREATION_RETRY_LIMIT = 3;

function nextAvailableSlug(baseSlug: string, slugs: Iterable<string>): string {
  const occupied = new Set(slugs);
  if (!occupied.has(baseSlug)) return baseSlug;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${baseSlug}-${suffix}`;
    if (!occupied.has(candidate)) return candidate;
  }
}

function isRetryableTemplateCreationError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2034' || error.code === 'P2002')
  );
}

export async function createCourseFromTemplate(
  definition: CourseTemplateDefinition,
  title: string,
): Promise<CourseGraph> {
  const baseSlug = slugify(title);
  let createdCourseId: string | null = null;
  for (let attempt = 1; attempt <= TEMPLATE_CREATION_RETRY_LIMIT; attempt += 1) {
    const courseId = newId('course');
    const chapterIds = new Map(
      definition.chapters.map((chapter) => [chapter.key, newId('chapter')]),
    );
    const lessonIds = new Map(
      definition.chapters.flatMap((chapter) =>
        chapter.lessons.map((lesson) => [lesson.key, newId('lesson')] as const),
      ),
    );
    const quizIds = new Map<string, string>();
    for (const chapter of definition.chapters) {
      if (chapter.quickCheck) {
        if (!chapter.quickCheckKey) throw new Error(`TEMPLATE_QUIZ_KEY_NOT_FOUND:${chapter.key}`);
        quizIds.set(chapter.quickCheckKey, newId('quiz'));
      }
    }
    if (definition.finalQuiz) {
      if (!definition.finalQuizKey) throw new Error('TEMPLATE_QUIZ_KEY_NOT_FOUND:final-assessment');
      quizIds.set(definition.finalQuizKey, newId('quiz'));
    }
    const entityIds = new Map<string, string>([
      ['course', courseId],
      ...chapterIds,
      ...lessonIds,
      ...quizIds,
    ]);
    const templateChecklist: CourseTemplateChecklist = {
      templateKey: definition.key,
      templateVersion: definition.version,
      requirements: (definition.requirements ?? []).map((requirement) =>
        concreteRequirement(requirement, entityIds),
      ),
    };

    try {
      await prisma.$transaction(
        async (tx) => {
          const slugs = await tx.course.findMany({
            where: { slug: { startsWith: baseSlug } },
            select: { slug: true },
          });
          await tx.course.create({
            data: {
              id: courseId,
              title,
              slug: nextAvailableSlug(
                baseSlug,
                slugs.map((course) => course.slug),
              ),
              description: definition.description ?? null,
              learningObjectives: jsonValue(definition.learningObjectives ?? []),
              cover: jsonValue(definition.cover),
              specifications: jsonValue(definition.specifications ?? []),
              disclaimer: jsonValue(definition.disclaimer),
              createdFromTemplateKey: definition.key,
              createdFromTemplateVersion: definition.version,
              templateChecklist: templateChecklist as unknown as Prisma.InputJsonValue,
            },
          });

          for (const [chapterPosition, chapter] of definition.chapters.entries()) {
            const chapterId = chapterIds.get(chapter.key);
            if (!chapterId) throw new Error(`TEMPLATE_CHAPTER_ID_NOT_FOUND:${chapter.key}`);
            await tx.courseChapter.create({
              data: {
                id: chapterId,
                courseId,
                title: chapter.title,
                position: chapterPosition,
                estimatedDuration: chapter.estimatedDuration ?? null,
                lessons: {
                  create: chapter.lessons.map((lesson, lessonPosition) => {
                    const lessonId = lessonIds.get(lesson.key);
                    if (!lessonId) throw new Error(`TEMPLATE_LESSON_ID_NOT_FOUND:${lesson.key}`);
                    return {
                      id: lessonId,
                      position: lessonPosition,
                      lessonType: lesson.lessonType,
                      headline: lesson.headline,
                      body: jsonValue(lesson.body),
                      payload: (lesson.payload ?? {}) as Prisma.InputJsonValue,
                    };
                  }),
                },
              },
            });
            if (!chapter.quickCheck) continue;
            const quizId = chapter.quickCheckKey ? quizIds.get(chapter.quickCheckKey) : undefined;
            if (!quizId) throw new Error(`TEMPLATE_QUIZ_ID_NOT_FOUND:${chapter.quickCheckKey}`);
            await tx.courseQuiz.create({
              data: { id: quizId, courseId, ...assessmentData(chapter.quickCheck) },
            });
            await tx.courseChapter.update({
              where: { id: chapterId },
              data: { quickCheckId: quizId },
            });
          }

          if (definition.finalQuiz) {
            const quizId = definition.finalQuizKey
              ? quizIds.get(definition.finalQuizKey)
              : undefined;
            if (!quizId) throw new Error('TEMPLATE_QUIZ_ID_NOT_FOUND:final-assessment');
            await tx.courseQuiz.create({
              data: { id: quizId, courseId, ...assessmentData(definition.finalQuiz) },
            });
            await tx.course.update({ where: { id: courseId }, data: { finalQuizId: quizId } });
          }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      createdCourseId = courseId;
      break;
    } catch (error) {
      if (!isRetryableTemplateCreationError(error) || attempt === TEMPLATE_CREATION_RETRY_LIMIT) {
        throw error;
      }
    }
  }

  if (!createdCourseId) throw new Error('TEMPLATE_CREATION_RETRY_EXHAUSTED');
  const course = await getAuthoringCourse(createdCourseId);
  if (!course) throw new Error('Created template course could not be loaded.');
  return course;
}
