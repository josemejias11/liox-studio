'use client';

import type { CourseAssessmentInput } from '@moto-ai/contracts';
import type { CourseGraph, LessonInput } from '@moto-ai/contracts/course-studio';
import { useState, type ReactNode } from 'react';
import { AssessmentInspector } from './AssessmentInspector';
import type { CourseSettingsInput } from '@/shared/contracts/course-settings';
import { CourseInspector, type CourseInspectorSaveState } from './inspectors/CourseInspector';
import { LessonInspector } from './inspectors/LessonInspector';
import type { StudioSelection } from './studio-types';

interface Props {
  course: CourseGraph;
  selection: StudioSelection;
  disabled: boolean;
  courseSettingsFormId?: string;
  onDirtyChange?: (dirty: boolean) => void;
  onSaveStateChange?: (state: CourseInspectorSaveState) => void;
  onSaveCourse: (input: CourseSettingsInput) => Promise<void>;
  onSaveChapter: (chapterId: string, input: Record<string, unknown>) => Promise<void>;
  onSaveLesson: (lessonId: string, input: LessonInput) => Promise<void>;
  onSaveChapterQuickCheck: (chapterId: string, input: CourseAssessmentInput) => Promise<void>;
  onRemoveChapterQuickCheck: (chapterId: string) => Promise<void>;
  onSaveFinalAssessment: (input: CourseAssessmentInput) => Promise<void>;
  onRemoveFinalAssessment: () => Promise<void>;
  sourcePanel?: ReactNode;
}

const inputClass =
  'studio-glass-control mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm';

export function StudioInspector({
  course,
  selection,
  disabled,
  courseSettingsFormId,
  onDirtyChange,
  onSaveStateChange,
  onSaveCourse,
  onSaveChapter,
  onSaveLesson,
  onSaveChapterQuickCheck,
  onRemoveChapterQuickCheck,
  onSaveFinalAssessment,
  onRemoveFinalAssessment,
  sourcePanel,
}: Props) {
  const chapter =
    selection.kind === 'chapter'
      ? course.chapters.find((item) => item.id === selection.id)
      : undefined;
  const lesson =
    selection.kind === 'lesson'
      ? course.chapters.flatMap((item) => item.lessons).find((item) => item.id === selection.id)
      : undefined;
  const quickCheck =
    selection.kind === 'quickCheck'
      ? course.chapters.find((item) => item.id === selection.id)
      : undefined;
  const [form, setForm] = useState<Record<string, string>>((): Record<string, string> => {
    if (chapter) {
      return {
        title: chapter.title,
        estimatedDuration: chapter.estimatedDuration?.toString() ?? '',
      };
    }
    if (lesson) {
      return {
        headline: lesson.headline,
      };
    }
    return {};
  });
  const [error, setError] = useState<string | null>(null);

  function field(name: string, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit() {
    setError(null);
    try {
      if (chapter) {
        await onSaveChapter(chapter.id, {
          title: form.title,
          estimatedDuration:
            form.estimatedDuration === '' ? null : Number.parseInt(form.estimatedDuration, 10),
        });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The change could not be saved.');
    }
  }

  if (selection.kind === 'course' || selection.kind === 'cover') {
    return (
      <CourseInspector
        course={course}
        disabled={disabled}
        formId={courseSettingsFormId}
        onDirtyChange={onDirtyChange}
        onSave={onSaveCourse}
        onSaveStateChange={onSaveStateChange}
        sourcePanel={sourcePanel}
      />
    );
  }

  if (lesson) {
    return (
      <LessonInspector
        course={course}
        disabled={disabled}
        lesson={lesson}
        onDirtyChange={onDirtyChange}
        onSaveLesson={onSaveLesson}
      />
    );
  }

  if (quickCheck) {
    return (
      <AssessmentInspector
        courseId={course.id}
        disabled={disabled}
        fallbackTitle="Chapter knowledge check"
        key={`quick-check:${quickCheck.id}:${quickCheck.quickCheck?.id ?? 'new'}`}
        onDirtyChange={onDirtyChange}
        onRemove={() => onRemoveChapterQuickCheck(quickCheck.id)}
        onSave={(input) => onSaveChapterQuickCheck(quickCheck.id, input)}
        quiz={quickCheck.quickCheck}
      />
    );
  }

  if (selection.kind === 'finalQuiz') {
    return (
      <AssessmentInspector
        courseId={course.id}
        disabled={disabled}
        fallbackTitle="Final assessment"
        key={`final-assessment:${course.finalQuiz?.id ?? 'new'}`}
        onDirtyChange={onDirtyChange}
        onRemove={onRemoveFinalAssessment}
        onSave={onSaveFinalAssessment}
        quiz={course.finalQuiz}
      />
    );
  }

  if (!chapter && !lesson) {
    return (
      <aside className="studio-glass-panel border-border text-muted-foreground border-l p-5 text-sm">
        Select an item to edit it.
      </aside>
    );
  }

  return (
    <aside className="studio-glass-panel border-border h-full min-h-0 overflow-y-auto overscroll-contain border-l p-5">
      <p className="text-primary text-[11px] font-semibold tracking-[0.16em] uppercase">
        Chapter settings
      </p>
      <div className="studio-glass-control border-border mt-5 space-y-4 rounded-xl border p-3">
        {chapter && (
          <>
            <label className="block text-xs font-medium">
              Chapter title
              <input
                className={inputClass}
                name="chapter-title"
                onChange={(event) => field('title', event.target.value)}
                value={form.title ?? ''}
              />
            </label>
            <label className="block text-xs font-medium">
              Estimated minutes
              <input
                className={inputClass}
                min="0"
                name="chapter-duration"
                onChange={(event) => field('estimatedDuration', event.target.value)}
                type="number"
                value={form.estimatedDuration ?? ''}
              />
            </label>
          </>
        )}
        {error && (
          <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-xs">{error}</p>
        )}
        <button
          className="bg-primary text-primary-foreground w-full rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
          disabled={disabled}
          onClick={submit}
          type="button"
        >
          {disabled ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </aside>
  );
}
