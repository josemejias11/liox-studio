import type { CourseLessonType, CourseGraph } from '@moto-ai/database';
import { toPlainText } from '@/lib/contracts/player-course';
import { createCourseStudioKey, isJsonObject, jsonObject, mergeKnownFields, stringField, booleanField } from '@/lib/contracts/course-studio';

export type StudioLesson = CourseGraph['chapters'][number]['lessons'][number];

export interface LessonImageDraft {
  url: string;
  originalFilename?: string;
}

export interface TextDraft {
  text: string;
  original?: unknown;
  touched: boolean;
}

export interface CoveredFeatureDraft {
  clientKey: string;
  persistedKey?: string;
  label: string;
  summary: string;
  original?: Record<string, unknown>;
}

export interface HotspotDraft {
  clientKey: string;
  persistedKey?: string;
  label: string;
  topic: string;
  body: TextDraft;
  x: string;
  y: string;
  required: boolean;
  photos: LessonImageDraft[];
  videoFile?: LessonImageDraft;
  videoAspectRatio: string;
  original?: Record<string, unknown>;
}

export interface QuizAnswerDraft {
  clientKey: string;
  persistedKey?: string;
  text: string;
  original?: Record<string, unknown>;
}

export interface QuizQuestionDraft {
  clientKey: string;
  persistedKey?: string;
  questionText: string;
  questionType: string;
  image?: LessonImageDraft;
  answers: QuizAnswerDraft[];
  original?: Record<string, unknown>;
}

export interface ColorVariantDraft {
  clientKey: string;
  label: string;
  colorHex: string;
  image?: LessonImageDraft;
  original?: Record<string, unknown>;
}

export interface DragChipDraft {
  clientKey: string;
  id: string;
  text: string;
  original?: Record<string, unknown>;
}

export interface DropZoneDraft {
  clientKey: string;
  id: string;
  label: string;
  correctChipId: string;
  xPositionPct: string;
  yPositionPct: string;
  original?: Record<string, unknown>;
}

export interface ScrollChapterDraft {
  clientKey: string;
  heading: string;
  body: TextDraft;
  image?: LessonImageDraft;
  targetScale: string;
  targetRotation: string;
  targetX: string;
  targetY: string;
  original?: Record<string, unknown>;
}

export interface LessonDraft {
  lessonType: CourseLessonType;
  headline: string;
  body: TextDraft;
  originalPayload: Record<string, unknown>;
  media?: LessonImageDraft;
  textOverlay: { x: string; y: string; width: string };
  coveredFeatures: CoveredFeatureDraft[];
  hotspots: HotspotDraft[];
  stageBackground?: LessonImageDraft;
  enableCompletionAnimation: boolean;
  completionTransition: 'spin' | 'rise' | 'fade';
  videoFile?: LessonImageDraft;
  videoAspectRatio: string;
  quizTitle: string;
  quizInstructions: string;
  quizQuestions: QuizQuestionDraft[];
  passingScore: string;
  allowRetry: boolean;
  showCorrectAnswers: boolean;
  colorVariants: ColorVariantDraft[];
  splitReverseLayout: boolean;
  chips: DragChipDraft[];
  dropZones: DropZoneDraft[];
  scrollChapters: ScrollChapterDraft[];
}

export interface LessonValidation {
  valid: boolean;
  errors: Record<string, string>;
}

function asObject(value: unknown): Record<string, unknown> {
  return isJsonObject(value) ? value : {};
}

function draftImage(value: unknown): LessonImageDraft | undefined {
  const asset = asObject(asObject(value).asset);
  return typeof asset.url === 'string' && asset.url.length > 0
    ? { url: asset.url, ...(typeof asset.originalFilename === 'string' ? { originalFilename: asset.originalFilename } : {}) }
    : undefined;
}

export function imagePayload(value: LessonImageDraft | undefined): Record<string, unknown> | undefined {
  return value ? { asset: { url: value.url, ...(value.originalFilename ? { originalFilename: value.originalFilename } : {}) } } : undefined;
}

function textDraft(value: unknown): TextDraft {
  return { text: toPlainText(value), original: value, touched: false };
}

function rowKey(prefix: string, value: Record<string, unknown>): { clientKey: string; persistedKey?: string } {
  return {
    clientKey: createCourseStudioKey(prefix),
    persistedKey: typeof value._key === 'string' && value._key.length > 0
      ? value._key
      : createCourseStudioKey(`${prefix}-persisted`),
  };
}

function numberText(value: unknown, fallback = ''): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : fallback;
}

export function createLessonDraft(lesson: StudioLesson): LessonDraft {
  const payload = asObject(lesson.payload);
  const rawFeatures = Array.isArray(payload.coveredFeatures) ? payload.coveredFeatures : [];
  const rawHotspots = Array.isArray(payload.hotspots) ? payload.hotspots : [];
  const rawQuestions = Array.isArray(payload.questions) ? payload.questions : [];
  const rawVariants = Array.isArray(payload.colorVariants) ? payload.colorVariants : [];
  const rawChips = Array.isArray(payload.chips) ? payload.chips : [];
  const rawZones = Array.isArray(payload.dropZones) ? payload.dropZones : [];
  const rawScrollChapters = Array.isArray(payload.scrollChapters) ? payload.scrollChapters : [];

  return {
    lessonType: lesson.lessonType as CourseLessonType,
    headline: lesson.headline,
    body: textDraft(lesson.body),
    originalPayload: payload,
    media: draftImage(payload.media),
    textOverlay: {
      x: numberText(asObject(payload.textOverlay).x, '6'),
      y: numberText(asObject(payload.textOverlay).y, '15'),
      width: stringField(asObject(payload.textOverlay).width),
    },
    coveredFeatures: rawFeatures.map((value) => {
      const item = asObject(value);
      return { ...rowKey('feature', item), label: stringField(item.label), summary: stringField(item.summary), original: item };
    }),
    hotspots: rawHotspots.map((value) => {
      const item = asObject(value);
      return {
        ...rowKey('hotspot', item),
        label: stringField(item.label),
        topic: stringField(item.topic),
        body: textDraft(item.body),
        x: numberText(item.x, '50'),
        y: numberText(item.y, '50'),
        required: booleanField(item.required),
        photos: Array.isArray(item.photos) ? item.photos.flatMap((photo) => draftImage(photo) ? [draftImage(photo)!] : []) : [],
        videoFile: draftImage(item.videoFile),
        videoAspectRatio: stringField(item.videoAspectRatio),
        original: item,
      };
    }),
    stageBackground: draftImage(payload.stageBackground),
    enableCompletionAnimation: booleanField(payload.enableCompletionAnimation),
    completionTransition: payload.completionTransition === 'rise' || payload.completionTransition === 'fade' ? payload.completionTransition : 'spin',
    videoFile: draftImage(payload.videoFile),
    videoAspectRatio: stringField(payload.videoAspectRatio) || '16:9',
    quizTitle: stringField(payload.title),
    quizInstructions: stringField(payload.instructions),
    quizQuestions: rawQuestions.map((value) => {
      const item = asObject(value);
      const answers = Array.isArray(item.answers) ? item.answers : [];
      return {
        ...rowKey('question', item),
        questionText: stringField(item.questionText),
        questionType: stringField(item.questionType) || 'single',
        image: draftImage(item.image),
        answers: answers.map((answer) => {
          const answerItem = asObject(answer);
          return { ...rowKey('answer', answerItem), text: stringField(answerItem.text), original: answerItem };
        }),
        original: item,
      };
    }),
    passingScore: numberText(payload.passingScore, '80'),
    allowRetry: booleanField(payload.allowRetry),
    showCorrectAnswers: booleanField(payload.showCorrectAnswers),
    colorVariants: rawVariants.map((value) => {
      const item = asObject(value);
      return { ...rowKey('variant', item), label: stringField(item.label), colorHex: stringField(item.colorHex), image: draftImage(item.image), original: item };
    }),
    splitReverseLayout: booleanField(payload.splitReverseLayout),
    chips: rawChips.map((value) => {
      const item = asObject(value);
      return { clientKey: createCourseStudioKey('chip'), id: stringField(item.id) || createCourseStudioKey('chip-id'), text: stringField(item.text), original: item };
    }),
    dropZones: rawZones.map((value) => {
      const item = asObject(value);
      return {
        clientKey: createCourseStudioKey('drop-zone'),
        id: stringField(item.id) || createCourseStudioKey('zone-id'),
        label: stringField(item.label),
        correctChipId: stringField(item.correctChipId),
        xPositionPct: numberText(item.xPositionPct, '50'),
        yPositionPct: numberText(item.yPositionPct, '50'),
        original: item,
      };
    }),
    scrollChapters: rawScrollChapters.map((value) => {
      const item = asObject(value);
      return {
        clientKey: createCourseStudioKey('scroll-chapter'),
        heading: stringField(item.heading),
        body: textDraft(item.body),
        image: draftImage(item.image),
        targetScale: numberText(item.targetScale),
        targetRotation: numberText(item.targetRotation),
        targetX: numberText(item.targetX),
        targetY: numberText(item.targetY),
        original: item,
      };
    }),
  };
}

export function numericValue(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function validateLessonDraft(draft: LessonDraft): LessonValidation {
  const errors: Record<string, string> = {};
  if (!draft.headline.trim()) errors.headline = 'Headline is required.';
  draft.coveredFeatures.forEach((feature, index) => {
    if (!feature.label.trim()) errors[`coveredFeatures.${index}.label`] = 'Feature label is required.';
  });
  draft.hotspots.forEach((hotspot, index) => {
    if (!hotspot.label.trim()) errors[`hotspots.${index}.label`] = 'Hotspot label is required.';
    if (numericValue(hotspot.x) === undefined) errors[`hotspots.${index}.x`] = 'Enter a valid horizontal position.';
    if (numericValue(hotspot.y) === undefined) errors[`hotspots.${index}.y`] = 'Enter a valid vertical position.';
  });
  draft.quizQuestions.forEach((question, index) => {
    if (!question.questionText.trim()) errors[`quizQuestions.${index}.questionText`] = 'Question text is required.';
    question.answers.forEach((answer, answerIndex) => {
      if (!answer.text.trim()) errors[`quizQuestions.${index}.answers.${answerIndex}.text`] = 'Answer text is required.';
    });
  });
  draft.colorVariants.forEach((variant, index) => {
    if (!variant.label.trim()) errors[`colorVariants.${index}.label`] = 'Variant label is required.';
  });
  draft.chips.forEach((chip, index) => {
    if (!chip.id.trim()) errors[`chips.${index}.id`] = 'Chip ID is required.';
    if (!chip.text.trim()) errors[`chips.${index}.text`] = 'Chip text is required.';
  });
  draft.dropZones.forEach((zone, index) => {
    if (!zone.label.trim()) errors[`dropZones.${index}.label`] = 'Drop-zone label is required.';
    if (numericValue(zone.xPositionPct) === undefined) errors[`dropZones.${index}.xPositionPct`] = 'Enter a valid horizontal position.';
    if (numericValue(zone.yPositionPct) === undefined) errors[`dropZones.${index}.yPositionPct`] = 'Enter a valid vertical position.';
  });
  draft.scrollChapters.forEach((chapter, index) => {
    if (!chapter.heading.trim()) errors[`scrollChapters.${index}.heading`] = 'Chapter heading is required.';
  });
  return { valid: Object.keys(errors).length === 0, errors };
}

export function mergeImage(original: unknown, image: LessonImageDraft | undefined): unknown {
  return imagePayload(image) ?? (original === undefined ? undefined : original);
}

export function mergeRow(original: unknown, known: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  return mergeKnownFields(jsonObject(original), known, keys);
}
