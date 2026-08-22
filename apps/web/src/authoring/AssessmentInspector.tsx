'use client';

import type { CourseAssessmentInput } from '@moto-ai/contracts';
import type { CourseGraphQuiz } from '@moto-ai/contracts/course-studio';
import { useEffect, useMemo, useState } from 'react';
import {
  assessmentDraft,
  assessmentFingerprint,
  assessmentInput,
  validateAssessmentDraft,
  type AssessmentDraft,
} from './assessment-draft';
import { AssessmentQuestionsField } from './AssessmentQuestionsField';
import {
  FieldError,
  fieldError,
  lessonInputClass,
  lessonTextareaClass,
} from './inspectors/lesson/FieldError';

interface Props {
  courseId: string;
  disabled: boolean;
  fallbackTitle: string;
  quiz: CourseGraphQuiz | null;
  onDirtyChange?: (dirty: boolean) => void;
  onRemove: () => Promise<void>;
  onSave: (input: CourseAssessmentInput) => Promise<void>;
}

export function AssessmentInspector({
  courseId,
  disabled,
  fallbackTitle,
  quiz,
  onDirtyChange,
  onRemove,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<AssessmentDraft>(() => assessmentDraft(quiz, fallbackTitle));
  const [baseline, setBaseline] = useState(() =>
    assessmentFingerprint(assessmentDraft(quiz, fallbackTitle)),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dirty = assessmentFingerprint(draft) !== baseline;
  const validation = useMemo(() => validateAssessmentDraft(draft), [draft]);
  const locked = disabled || saving;

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  useEffect(
    () => () => {
      onDirtyChange?.(false);
    },
    [onDirtyChange],
  );

  function update(change: (current: AssessmentDraft) => AssessmentDraft): void {
    setDraft(change);
    setError(null);
    setSaved(false);
  }

  async function submit(): Promise<void> {
    const parsed = validateAssessmentDraft(draft);
    if (!parsed.valid) {
      setError('Correct the highlighted fields before saving.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(assessmentInput(draft));
      setBaseline(assessmentFingerprint(draft));
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The assessment could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(): Promise<void> {
    if (!window.confirm('Remove this assessment? This cannot be undone.')) return;
    setSaving(true);
    setError(null);
    try {
      await onRemove();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The assessment could not be removed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="studio-glass-panel flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <header className="studio-glass border-border sticky top-0 z-10 border-x-0 border-t-0 border-b px-5 py-4">
        <p className="text-primary text-[11px] font-semibold tracking-[0.16em] uppercase">
          Assessment
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          Create a single-answer knowledge check with guided feedback.
        </p>
      </header>
      <div className="space-y-4 px-5 py-5">
        <fieldset className="studio-glass-control border-border space-y-3 rounded-xl border p-3">
          <legend className="px-1 text-sm font-semibold">Assessment settings</legend>
          <label className="block text-xs font-medium">
            Title
            <input
              className={lessonInputClass}
              disabled={locked}
              onChange={(event) => update((current) => ({ ...current, title: event.target.value }))}
              value={draft.title}
            />
          </label>
          <FieldError message={fieldError(validation.errors, 'title')} />
          <label className="block text-xs font-medium">
            Instructions
            <textarea
              className={lessonTextareaClass}
              disabled={locked}
              onChange={(event) =>
                update((current) => ({ ...current, instructions: event.target.value }))
              }
              value={draft.instructions}
            />
          </label>
          <FieldError message={fieldError(validation.errors, 'instructions')} />
          <label className="block text-xs font-medium">
            Passing score (%)
            <input
              className={lessonInputClass}
              disabled={locked}
              max="100"
              min="0"
              onChange={(event) =>
                update((current) => ({ ...current, passingScore: event.target.value }))
              }
              type="number"
              value={draft.passingScore}
            />
          </label>
          <FieldError message={fieldError(validation.errors, 'passingScore')} />
          <label className="flex items-center gap-2 text-xs font-medium">
            <input
              checked={draft.allowRetry}
              disabled={locked}
              onChange={(event) =>
                update((current) => ({ ...current, allowRetry: event.target.checked }))
              }
              type="checkbox"
            />
            Allow retry
          </label>
          <label className="flex items-center gap-2 text-xs font-medium">
            <input
              checked={draft.showCorrectAnswers}
              disabled={locked}
              onChange={(event) =>
                update((current) => ({ ...current, showCorrectAnswers: event.target.checked }))
              }
              type="checkbox"
            />
            Reveal correct answers after grading
          </label>
        </fieldset>
        <AssessmentQuestionsField
          courseId={courseId}
          disabled={locked}
          errors={validation.errors}
          items={draft.questions}
          onChange={(change) =>
            update((current) => ({ ...current, questions: change(current.questions) }))
          }
        />
        {error ? (
          <p
            className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-xs"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        {saved ? (
          <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700">
            Assessment saved.
          </p>
        ) : null}
        <div className="flex gap-2">
          <button
            className="bg-primary text-primary-foreground min-h-11 flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
            disabled={locked || !dirty || !validation.valid}
            type="submit"
          >
            {saving ? 'Saving…' : 'Save assessment'}
          </button>
          {quiz ? (
            <button
              className="border-destructive text-destructive min-h-11 rounded-lg border px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
              disabled={locked}
              onClick={() => void remove()}
              type="button"
            >
              Remove assessment
            </button>
          ) : null}
        </div>
      </div>
    </form>
  );
}
