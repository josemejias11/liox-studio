import type { LessonInput } from '@moto-ai/contracts/course-studio';
import {
  imagePayload,
  mergeRow,
  numericValue,
  type LessonDraft,
} from '@/authoring/inspectors/lesson/lesson-draft';

function editedText(value: {
  text: string;
  original?: unknown;
  serialized?: unknown;
  touched: boolean;
}): unknown {
  return value.touched ? (value.serialized ?? value.text) : value.original;
}

function optionalNumber(value: string): number | undefined {
  return numericValue(value);
}

function serializeHotspots(draft: LessonDraft) {
  return draft.hotspots.length > 0
    ? draft.hotspots.map((hotspot) =>
        mergeRow(
          hotspot.original,
          {
            _key: hotspot.persistedKey,
            label: hotspot.label,
            topic: hotspot.topic,
            body: editedText(hotspot.body),
            x: optionalNumber(hotspot.x),
            y: optionalNumber(hotspot.y),
            required: hotspot.required || undefined,
            photos:
              hotspot.photos.length > 0
                ? hotspot.photos.map((photo) => imagePayload(photo))
                : undefined,
            videoFile: imagePayload(hotspot.videoFile),
            videoAspectRatio: hotspot.videoAspectRatio || undefined,
          },
          [
            '_key',
            'label',
            'topic',
            'body',
            'x',
            'y',
            'required',
            'photos',
            'videoFile',
            'videoAspectRatio',
          ],
        ),
      )
    : undefined;
}

function serializeCoveredFeatures(draft: LessonDraft) {
  return draft.coveredFeatures.length > 0
    ? draft.coveredFeatures.map((feature) =>
        mergeRow(
          feature.original,
          {
            _key: feature.persistedKey,
            label: feature.label,
            summary: feature.summary || undefined,
          },
          ['_key', 'label', 'summary'],
        ),
      )
    : undefined;
}

export function serializeLessonDraft(draft: LessonDraft): LessonInput {
  const original = { ...draft.originalPayload };
  const payload: Record<string, unknown> = { ...original };
  const set = (key: string, value: unknown) => {
    if (value === undefined) delete payload[key];
    else payload[key] = value;
  };

  const shared = draft.lessonType === 'content' || draft.lessonType === 'interaction';
  if (shared || draft.lessonType === 'canvas') {
    set('media', imagePayload(draft.media));
    set('hotspots', serializeHotspots(draft));
  }
  if (shared) {
    set('textOverlay', {
      x: optionalNumber(draft.textOverlay.x),
      y: optionalNumber(draft.textOverlay.y),
      width: draft.textOverlay.width || undefined,
    });
    set('coveredFeatures', serializeCoveredFeatures(draft));
  }
  if (draft.lessonType === 'stage') {
    set('media', imagePayload(draft.media));
    set('stageBackground', imagePayload(draft.stageBackground));
    set('enableCompletionAnimation', draft.enableCompletionAnimation || undefined);
    set('completionTransition', draft.completionTransition);
    set('hotspots', serializeHotspots(draft));
  }
  if (draft.lessonType === 'video') {
    set('videoFile', imagePayload(draft.videoFile));
    set('videoAspectRatio', draft.videoAspectRatio || undefined);
  }
  if (draft.lessonType === 'quiz') {
    set('title', draft.quizTitle || undefined);
    set('instructions', draft.quizInstructions || undefined);
    set(
      'questions',
      draft.quizQuestions.length > 0
        ? draft.quizQuestions.map((question) =>
            mergeRow(
              question.original,
              {
                _key: question.persistedKey,
                questionText: question.questionText,
                questionType: question.questionType,
                image: imagePayload(question.image),
                answers: question.answers.map((answer) =>
                  mergeRow(answer.original, { _key: answer.persistedKey, text: answer.text }, [
                    '_key',
                    'text',
                  ]),
                ),
              },
              ['_key', 'questionText', 'questionType', 'image', 'answers'],
            ),
          )
        : undefined,
    );
    set('passingScore', optionalNumber(draft.passingScore));
    set('allowRetry', draft.allowRetry || undefined);
    set('showCorrectAnswers', draft.showCorrectAnswers || undefined);
  }
  if (draft.lessonType === 'colorSwitcher') {
    set(
      'colorVariants',
      draft.colorVariants.length > 0
        ? draft.colorVariants.map((variant) =>
            mergeRow(
              variant.original,
              {
                label: variant.label,
                colorHex: variant.colorHex || undefined,
                image: imagePayload(variant.image),
              },
              ['label', 'colorHex', 'image'],
            ),
          )
        : undefined,
    );
  }
  if (draft.lessonType === 'splitScreen') {
    set('media', imagePayload(draft.media));
    set('splitReverseLayout', draft.splitReverseLayout || undefined);
    set('coveredFeatures', serializeCoveredFeatures(draft));
  }
  if (draft.lessonType === 'dragDrop') {
    set('media', imagePayload(draft.media));
    set(
      'chips',
      draft.chips.length > 0
        ? draft.chips.map((chip) =>
            mergeRow(chip.original, { id: chip.id, text: chip.text }, ['id', 'text']),
          )
        : undefined,
    );
    set(
      'dropZones',
      draft.dropZones.length > 0
        ? draft.dropZones.map((zone) =>
            mergeRow(
              zone.original,
              {
                id: zone.id,
                label: zone.label,
                correctChipId: zone.correctChipId || undefined,
                xPositionPct: optionalNumber(zone.xPositionPct),
                yPositionPct: optionalNumber(zone.yPositionPct),
              },
              ['id', 'label', 'correctChipId', 'xPositionPct', 'yPositionPct'],
            ),
          )
        : undefined,
    );
  }
  if (draft.lessonType === 'scrollStory') {
    set('media', imagePayload(draft.media));
    set(
      'scrollChapters',
      draft.scrollChapters.length > 0
        ? draft.scrollChapters.map((chapter) =>
            mergeRow(
              chapter.original,
              {
                heading: chapter.heading,
                body: editedText(chapter.body),
                image: imagePayload(chapter.image),
                targetScale: optionalNumber(chapter.targetScale),
                targetRotation: optionalNumber(chapter.targetRotation),
                targetX: optionalNumber(chapter.targetX),
                targetY: optionalNumber(chapter.targetY),
              },
              ['heading', 'body', 'image', 'targetScale', 'targetRotation', 'targetX', 'targetY'],
            ),
          )
        : undefined,
    );
  }

  return {
    headline: draft.headline,
    body: editedText(draft.body) as LessonInput['body'],
    payload: payload as LessonInput['payload'],
  };
}
