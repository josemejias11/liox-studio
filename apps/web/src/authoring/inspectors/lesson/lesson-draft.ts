import type { CourseLessonType, CourseGraph } from '@moto-ai/contracts/course-studio';
import { toPlainText } from '@/shared/contracts/player-course';
import {
  booleanField,
  createCourseStudioKey,
  createStableCourseStudioKey,
  isJsonObject,
  jsonObject,
  mergeKnownFields,
  stringField,
} from '@/shared/contracts/course-studio';

export type StudioLesson = CourseGraph['chapters'][number]['lessons'][number];

export interface LessonImageDraft {
  url: string;
  originalFilename?: string;

  original?: Record<string, unknown>;
}

export interface TextDraft {
  text: string;
  original?: unknown;

  serialized?: unknown;
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
  const original = asObject(value);
  const asset = asObject(original.asset);
  return typeof asset.url === 'string' && asset.url.length > 0
    ? {
        url: asset.url,
        ...(typeof asset.originalFilename === 'string'
          ? { originalFilename: asset.originalFilename }
          : {}),
        original,
      }
    : undefined;
}

export function imagePayload(
  value: LessonImageDraft | undefined,
): Record<string, unknown> | undefined {
  if (!value) return undefined;
  const original = asObject(value.original);
  const originalAsset = asObject(original.asset);
  const asset: Record<string, unknown> = { ...originalAsset, url: value.url };
  if (value.originalFilename !== undefined) asset.originalFilename = value.originalFilename;
  return { ...original, asset };
}

function textDraft(value: unknown): TextDraft {
  return { text: toPlainText(value), original: value, touched: false };
}

function rowKey(
  prefix: string,
  value: Record<string, unknown>,
  index: number,
): { clientKey: string; persistedKey?: string } {
  const persistedKey =
    typeof value._key === 'string' && value._key.length > 0 ? value._key : undefined;
  return {
    clientKey: createStableCourseStudioKey(prefix, persistedKey ?? index),
    persistedKey,
  };
}

function numberText(value: unknown, fallback = ''): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : fallback;
}

export function createCoveredFeatureDraft(): CoveredFeatureDraft {
  return {
    clientKey: createCourseStudioKey('feature'),
    persistedKey: createCourseStudioKey('feature-persisted'),
    label: '',
    summary: '',
  };
}

export function createHotspotDraft(x = '50', y = '50'): HotspotDraft {
  return {
    clientKey: createCourseStudioKey('hotspot'),
    persistedKey: createCourseStudioKey('hotspot-persisted'),
    label: '',
    topic: '',
    body: { text: '', touched: true, serialized: [] },
    x,
    y,
    required: false,
    photos: [],
    videoAspectRatio: '',
  };
}

export function createQuizAnswerDraft(): QuizAnswerDraft {
  return {
    clientKey: createCourseStudioKey('answer'),
    persistedKey: createCourseStudioKey('answer-persisted'),
    text: '',
  };
}

export function createQuizQuestionDraft(): QuizQuestionDraft {
  return {
    clientKey: createCourseStudioKey('question'),
    persistedKey: createCourseStudioKey('question-persisted'),
    questionText: '',
    questionType: 'single',
    answers: [],
  };
}

export function createColorVariantDraft(): ColorVariantDraft {
  return { clientKey: createCourseStudioKey('variant'), label: '', colorHex: '' };
}

export function createDragChipDraft(): DragChipDraft {
  return {
    clientKey: createCourseStudioKey('chip'),
    id: createCourseStudioKey('chip-id'),
    text: '',
  };
}

export function createDropZoneDraft(): DropZoneDraft {
  return {
    clientKey: createCourseStudioKey('zone'),
    id: createCourseStudioKey('zone-id'),
    label: '',
    correctChipId: '',
    xPositionPct: '50',
    yPositionPct: '50',
  };
}

export function createScrollChapterDraft(): ScrollChapterDraft {
  return {
    clientKey: createCourseStudioKey('scroll-chapter'),
    heading: '',
    body: { text: '', touched: true, serialized: [] },
    targetScale: '',
    targetRotation: '',
    targetX: '',
    targetY: '',
  };
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
    coveredFeatures: rawFeatures.map((value, index) => {
      const item = asObject(value);
      return {
        ...rowKey('feature', item, index),
        label: stringField(item.label),
        summary: stringField(item.summary),
        original: item,
      };
    }),
    hotspots: rawHotspots.map((value, index) => {
      const item = asObject(value);
      return {
        ...rowKey('hotspot', item, index),
        label: stringField(item.label),
        topic: stringField(item.topic),
        body: textDraft(item.body),
        x: numberText(item.x, '50'),
        y: numberText(item.y, '50'),
        required: booleanField(item.required),
        photos: Array.isArray(item.photos)
          ? item.photos.flatMap((photo) => (draftImage(photo) ? [draftImage(photo)!] : []))
          : [],
        videoFile: draftImage(item.videoFile),
        videoAspectRatio: stringField(item.videoAspectRatio),
        original: item,
      };
    }),
    stageBackground: draftImage(payload.stageBackground),
    enableCompletionAnimation: booleanField(payload.enableCompletionAnimation),
    completionTransition:
      payload.completionTransition === 'rise' || payload.completionTransition === 'fade'
        ? payload.completionTransition
        : 'spin',
    videoFile: draftImage(payload.videoFile),
    videoAspectRatio: stringField(payload.videoAspectRatio) || '16:9',
    quizTitle: stringField(payload.title),
    quizInstructions: stringField(payload.instructions),
    quizQuestions: rawQuestions.map((value, index) => {
      const item = asObject(value);
      const answers = Array.isArray(item.answers) ? item.answers : [];
      return {
        ...rowKey('question', item, index),
        questionText: stringField(item.questionText),
        questionType: stringField(item.questionType) || 'single',
        image: draftImage(item.image),
        answers: answers.map((answer, answerIndex) => {
          const answerItem = asObject(answer);
          return {
            ...rowKey(`answer-${index}`, answerItem, answerIndex),
            text: stringField(answerItem.text),
            original: answerItem,
          };
        }),
        original: item,
      };
    }),
    passingScore: numberText(payload.passingScore, '80'),
    allowRetry: booleanField(payload.allowRetry),
    showCorrectAnswers: booleanField(payload.showCorrectAnswers),
    colorVariants: rawVariants.map((value, index) => {
      const item = asObject(value);
      return {
        ...rowKey('variant', item, index),
        label: stringField(item.label),
        colorHex: stringField(item.colorHex),
        image: draftImage(item.image),
        original: item,
      };
    }),
    splitReverseLayout: booleanField(payload.splitReverseLayout),
    chips: rawChips.map((value, index) => {
      const item = asObject(value);
      return {
        clientKey: createStableCourseStudioKey('chip', index),
        id: stringField(item.id) || createStableCourseStudioKey('chip-id', index),
        text: stringField(item.text),
        original: item,
      };
    }),
    dropZones: rawZones.map((value, index) => {
      const item = asObject(value);
      return {
        clientKey: createStableCourseStudioKey('drop-zone', index),
        id: stringField(item.id) || createStableCourseStudioKey('zone-id', index),
        label: stringField(item.label),
        correctChipId: stringField(item.correctChipId),
        xPositionPct: numberText(item.xPositionPct, '50'),
        yPositionPct: numberText(item.yPositionPct, '50'),
        original: item,
      };
    }),
    scrollChapters: rawScrollChapters.map((value, index) => {
      const item = asObject(value);
      return {
        clientKey: createStableCourseStudioKey('scroll-chapter', index),
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
    if (!feature.label.trim())
      errors[`coveredFeatures.${index}.label`] = 'Feature label is required.';
  });
  draft.hotspots.forEach((hotspot, index) => {
    if (!hotspot.label.trim()) errors[`hotspots.${index}.label`] = 'Hotspot label is required.';
    if (numericValue(hotspot.x) === undefined)
      errors[`hotspots.${index}.x`] = 'Enter a valid horizontal position.';
    if (numericValue(hotspot.y) === undefined)
      errors[`hotspots.${index}.y`] = 'Enter a valid vertical position.';
  });
  const cueTargets = new Set(lessonCueTargets(draft));
  const validateCues = (value: TextDraft, path: string) => {
    for (const target of layerLinkTargets(value.touched ? value.serialized : value.original)) {
      if (!cueTargets.has(target))
        errors[`${path}.layerLink`] =
          `The learning cue “${target}” no longer points to a hotspot or covered feature.`;
    }
  };
  validateCues(draft.body, 'body');
  draft.hotspots.forEach((hotspot, index) => validateCues(hotspot.body, `hotspots.${index}.body`));
  draft.scrollChapters.forEach((chapter, index) =>
    validateCues(chapter.body, `scrollChapters.${index}.body`),
  );
  draft.quizQuestions.forEach((question, index) => {
    if (!question.questionText.trim())
      errors[`quizQuestions.${index}.questionText`] = 'Question text is required.';
    question.answers.forEach((answer, answerIndex) => {
      if (!answer.text.trim())
        errors[`quizQuestions.${index}.answers.${answerIndex}.text`] = 'Answer text is required.';
    });
  });
  draft.colorVariants.forEach((variant, index) => {
    if (!variant.label.trim())
      errors[`colorVariants.${index}.label`] = 'Variant label is required.';
  });
  draft.chips.forEach((chip, index) => {
    if (!chip.id.trim()) errors[`chips.${index}.id`] = 'Chip ID is required.';
    if (!chip.text.trim()) errors[`chips.${index}.text`] = 'Chip text is required.';
  });
  draft.dropZones.forEach((zone, index) => {
    if (!zone.label.trim()) errors[`dropZones.${index}.label`] = 'Drop-zone label is required.';
    if (numericValue(zone.xPositionPct) === undefined)
      errors[`dropZones.${index}.xPositionPct`] = 'Enter a valid horizontal position.';
    if (numericValue(zone.yPositionPct) === undefined)
      errors[`dropZones.${index}.yPositionPct`] = 'Enter a valid vertical position.';
  });
  draft.scrollChapters.forEach((chapter, index) => {
    if (!chapter.heading.trim())
      errors[`scrollChapters.${index}.heading`] = 'Chapter heading is required.';
  });
  return { valid: Object.keys(errors).length === 0, errors };
}

export function lessonCueTargets(draft: LessonDraft): string[] {
  const hotspots = draft.hotspots.map((hotspot) => hotspot.label.trim()).filter(Boolean);
  const coveredFeatures = draft.coveredFeatures
    .map((feature) => feature.label.trim())
    .filter(Boolean);
  switch (draft.lessonType) {
    case 'content':
    case 'interaction':
      return [...new Set([...hotspots, ...coveredFeatures])];
    case 'stage':
    case 'canvas':
      return [...new Set(hotspots)];
    case 'splitScreen':
    case 'scrollStory':
      return [...new Set(coveredFeatures)];
    default:
      return [];
  }
}

export function layerLinkTargets(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((block) => {
    const markDefs = asObject(block).markDefs;
    if (!Array.isArray(markDefs)) return [];
    return markDefs.flatMap((definition) => {
      const cue = asObject(definition);
      return cue._type === 'layerLink' && typeof cue.linkedLayer === 'string'
        ? [cue.linkedLayer]
        : [];
    });
  });
}

export function mergeImage(original: unknown, image: LessonImageDraft | undefined): unknown {
  return imagePayload(image) ?? (original === undefined ? undefined : original);
}

export function mergeRow(
  original: unknown,
  known: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> {
  return mergeKnownFields(jsonObject(original), known, keys);
}
