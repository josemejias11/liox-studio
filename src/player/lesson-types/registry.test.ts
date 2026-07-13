import { describe, expect, test } from 'vitest';
import { lessonSchema, type LessonSection } from '@/lib/contracts/sanity';
import { getLessonCompletionMode, lessonTypeRegistry, LessonCompletionMode } from './registry';

const makeLesson = (lessonType: LessonSection['lessonType']): LessonSection =>
  ({
    ...lessonSchema.parse({
      sectionType: 'lesson',
      _key: `${lessonType}-lesson`,
      headline: `${lessonType} lesson`,
      lessonType,
    }),
    chapterIndex: 0,
    chapterTitle: 'Chapter 1',
  });

describe('lessonTypeRegistry', () => {
  test('covers rendered lesson types with completion metadata', () => {
    expect(lessonTypeRegistry.content).toMatchObject({
      completionMode: LessonCompletionMode.HOTSPOT,
      requiresManualCompletion: false,
    });
    expect(lessonTypeRegistry.interaction).toMatchObject({
      completionMode: LessonCompletionMode.HOTSPOT,
      requiresManualCompletion: false,
    });
    expect(lessonTypeRegistry.stage).toMatchObject({
      completionMode: LessonCompletionMode.HOTSPOT,
      requiresManualCompletion: false,
    });
    expect(lessonTypeRegistry.video).toMatchObject({
      completionMode: LessonCompletionMode.MANUAL,
      requiresManualCompletion: true,
    });
    expect(lessonTypeRegistry.quiz).toMatchObject({
      completionMode: LessonCompletionMode.NONE,
      requiresManualCompletion: false,
    });
    expect(lessonTypeRegistry.colorSwitcher).toMatchObject({
      completionMode: LessonCompletionMode.NONE,
      requiresManualCompletion: false,
    });
    expect(lessonTypeRegistry.splitScreen).toMatchObject({
      completionMode: LessonCompletionMode.NONE,
      requiresManualCompletion: false,
    });
    expect(lessonTypeRegistry.dragDrop).toMatchObject({
      completionMode: LessonCompletionMode.MANUAL,
      requiresManualCompletion: true,
    });
    expect(lessonTypeRegistry.scrollStory).toMatchObject({
      completionMode: LessonCompletionMode.MANUAL,
      requiresManualCompletion: true,
    });
    expect(lessonTypeRegistry.canvas).toMatchObject({
      completionMode: LessonCompletionMode.HOTSPOT,
      requiresManualCompletion: false,
    });
  });

  test('returns completion mode for each lesson type', () => {
    expect(getLessonCompletionMode(makeLesson('content'))).toBe(LessonCompletionMode.HOTSPOT);
    expect(getLessonCompletionMode(makeLesson('interaction'))).toBe(LessonCompletionMode.HOTSPOT);
    expect(getLessonCompletionMode(makeLesson('stage'))).toBe(LessonCompletionMode.HOTSPOT);
    expect(getLessonCompletionMode(makeLesson('video'))).toBe(LessonCompletionMode.MANUAL);
    expect(getLessonCompletionMode(makeLesson('quiz'))).toBe(LessonCompletionMode.NONE);
    expect(getLessonCompletionMode(makeLesson('colorSwitcher'))).toBe(LessonCompletionMode.NONE);
    expect(getLessonCompletionMode(makeLesson('splitScreen'))).toBe(LessonCompletionMode.NONE);
    expect(getLessonCompletionMode(makeLesson('dragDrop'))).toBe(LessonCompletionMode.MANUAL);
    expect(getLessonCompletionMode(makeLesson('scrollStory'))).toBe(LessonCompletionMode.MANUAL);
    expect(getLessonCompletionMode(makeLesson('canvas'))).toBe(LessonCompletionMode.HOTSPOT);
  });
});
