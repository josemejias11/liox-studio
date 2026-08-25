'use client';

import type { CourseGenerationSummary } from '@moto-ai/contracts/course-generation';
import type { CourseTemplateSummary } from '@/authoring/templates/catalog';
import type { CreateCourseActionState } from '@/app/studio/actions';
import { BookOpen, ChevronDown, ChevronRight, LoaderCircle, Sparkles } from 'lucide-react';
import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreateWithAiDialog, type GenerationSourceRevision } from './CreateWithAiDialog';
import { GenerationStatusPanel } from './GenerationStatusPanel';

interface CourseCreationPanelProps {
  createBlankCourse: (
    previousState: CreateCourseActionState,
    formData: FormData,
  ) => Promise<CreateCourseActionState>;
  templates: CourseTemplateSummary[];
  defaultOpen: boolean;
  generations: CourseGenerationSummary[];
  sourceRevisions: GenerationSourceRevision[];
}

type SubmissionKind = 'blank' | 'comprehensive' | null;

export function CourseCreationPanel({
  createBlankCourse,
  templates,
  defaultOpen,
  generations: initialGenerations,
  sourceRevisions,
}: CourseCreationPanelProps) {
  const router = useRouter();
  const isSubmitting = useRef(false);
  const submissionRef = useRef<SubmissionKind>(null);
  const blankWasPending = useRef(false);
  const blankFailureVersionAtSubmit = useRef(0);
  const [open, setOpen] = useState(defaultOpen);
  const [submission, setSubmission] = useState<SubmissionKind>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [generations, setGenerations] = useState(initialGenerations);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [retryFrom, setRetryFrom] = useState<CourseGenerationSummary | undefined>();
  const [blankState, submitBlankCourse, blankPending] = useActionState(createBlankCourse, {
    error: null,
    failureVersion: 0,
  });
  const comprehensiveTemplate = templates.find(
    (template) => template.key === 'comprehensive-course',
  );
  const refreshGenerations = useCallback(
    (next: CourseGenerationSummary[]) => {
      setGenerations((current) => {
        const completed = next.some(
          (generation) =>
            generation.status === 'succeeded' &&
            !current.some((old) => old.id === generation.id && old.status === 'succeeded'),
        );
        if (completed) router.refresh();
        return next;
      });
    },
    [router],
  );

  function releaseSubmission(kind: Exclude<SubmissionKind, null>) {
    if (submissionRef.current !== kind) return;
    submissionRef.current = null;
    isSubmitting.current = false;
    setSubmission(null);
  }

  useEffect(() => {
    if (blankPending) {
      blankWasPending.current = true;
      return;
    }
    if (
      blankWasPending.current &&
      blankState.error &&
      blankState.failureVersion > blankFailureVersionAtSubmit.current
    ) {
      blankWasPending.current = false;
      releaseSubmission('blank');
    }
  }, [blankPending, blankState.error, blankState.failureVersion, submission]);

  function guardBlankSubmission(event: React.FormEvent<HTMLFormElement>) {
    if (isSubmitting.current) {
      event.preventDefault();
      return;
    }
    isSubmitting.current = true;
    submissionRef.current = 'blank';
    blankFailureVersionAtSubmit.current = blankState.failureVersion;
    setSubmission('blank');
    setTemplateError(null);
  }

  async function submitComprehensiveCourse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!comprehensiveTemplate || isSubmitting.current) return;
    isSubmitting.current = true;
    submissionRef.current = 'comprehensive';
    setSubmission('comprehensive');
    setTemplateError(null);

    const title = new FormData(event.currentTarget).get('title');
    try {
      const response = await fetch(
        `/api/course-studio/templates/${encodeURIComponent(comprehensiveTemplate.key)}/courses`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title }),
        },
      );
      const result = (await response.json().catch(() => null)) as {
        course?: { id?: unknown };
      } | null;
      if (!response.ok || typeof result?.course?.id !== 'string') {
        setTemplateError('We could not create that comprehensive course. Please try again.');
        releaseSubmission('comprehensive');
        return;
      }
      router.push(`/studio/${result.course.id}`);
    } catch {
      setTemplateError('We could not create that comprehensive course. Please try again.');
      releaseSubmission('comprehensive');
    }
  }

  const disabled = submission !== null || blankPending;
  const collapsible = !defaultOpen;

  return (
    <>
      <section
        className="studio-glass mb-8 rounded-2xl p-6"
        aria-labelledby="course-creation-heading"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold" id="course-creation-heading">
              Create a course
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Begin with an open canvas, a complete learning structure or a AI denerated draft.
            </p>
          </div>
          {collapsible && (
            <button
              aria-expanded={open}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium"
              onClick={() => setOpen((current) => !current)}
              type="button"
            >
              {open ? (
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              )}
              New course
            </button>
          )}
        </div>
        {(!collapsible || open) && (
          <div className="grid gap-4 lg:grid-cols-3">
            <form
              action={submitBlankCourse}
              className="studio-glass-panel border-border flex h-full flex-col rounded-xl border p-5"
              aria-busy={submission === 'blank'}
              onSubmit={guardBlankSubmission}
            >
              <div className="flex items-start gap-3">
                <BookOpen className="text-primary mt-0.5 h-5 w-5" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold">Blank course</h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Build a focused learning experience from your own outline and interactions.
                  </p>
                </div>
              </div>
              <div className="mt-auto pt-5">
                <label className="block text-sm font-medium" htmlFor="blank-course-title">
                  Course title
                </label>
                <input
                  className="border-input bg-background mt-2 w-full rounded-lg border px-3 py-2"
                  disabled={disabled}
                  id="blank-course-title"
                  name="title"
                  placeholder="Course title"
                  required
                />
                <button
                  className="bg-primary text-primary-foreground mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={disabled}
                  type="submit"
                >
                  {(submission === 'blank' || blankPending) && (
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                  )}
                  Create blank course
                </button>
                {blankState.error && submission !== 'blank' && (
                  <p aria-live="polite" className="text-destructive mt-3 text-sm" role="status">
                    {blankState.error}
                  </p>
                )}
              </div>
            </form>

            <form
              className="studio-glass-panel border-border flex h-full flex-col rounded-xl border p-5"
              onSubmit={submitComprehensiveCourse}
              aria-busy={submission === 'comprehensive'}
            >
              <div className="flex items-start gap-3">
                <Sparkles className="text-primary mt-0.5 h-5 w-5" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold">
                    {comprehensiveTemplate?.title ?? 'Comprehensive course'}
                  </h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {comprehensiveTemplate?.description ??
                      'A complete learning structure is not available right now.'}
                  </p>
                  <p className="text-muted-foreground mt-2 text-sm">
                    Includes chapter knowledge checks and a final assessment.
                  </p>
                </div>
              </div>
              <div className="mt-auto pt-5">
                <label className="block text-sm font-medium" htmlFor="comprehensive-course-title">
                  Course title
                </label>
                <input
                  className="border-input bg-background mt-2 w-full rounded-lg border px-3 py-2"
                  disabled={disabled || !comprehensiveTemplate}
                  id="comprehensive-course-title"
                  name="title"
                  placeholder="Course title"
                  required
                />
                <button
                  className="bg-primary text-primary-foreground mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={disabled || !comprehensiveTemplate}
                  type="submit"
                >
                  {submission === 'comprehensive' && (
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                  )}
                  Create comprehensive course
                </button>
                {templateError && (
                  <p aria-live="polite" className="text-destructive mt-3 text-sm" role="status">
                    {templateError}
                  </p>
                )}
              </div>
            </form>

            <div className="studio-glass-panel border-border flex h-full flex-col rounded-xl border p-5">
              <div className="flex items-start gap-3">
                <Sparkles className="text-primary mt-0.5 h-5 w-5" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold">Create with AI</h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    AI drafts use only the source files captured by a frozen revision.
                  </p>
                </div>
              </div>
              <div className="mt-auto pt-5">
                {sourceRevisions.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Freeze a course revision with at least one indexed source before generating a
                    grounded draft.
                  </p>
                ) : (
                  <button
                    className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 font-medium"
                    onClick={() => {
                      setRetryFrom(undefined);
                      setDialogOpen(true);
                    }}
                    type="button"
                  >
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    Create with AI
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
      <GenerationStatusPanel
        generations={generations}
        onRefresh={refreshGenerations}
        onRetry={(generation) => {
          setRetryFrom(generation);
          setDialogOpen(true);
        }}
      />
      {dialogOpen && (
        <CreateWithAiDialog
          key={retryFrom?.id ?? 'fresh'}
          open
          revisions={sourceRevisions}
          retryFrom={retryFrom}
          onClose={() => setDialogOpen(false)}
          onCreated={(generation) => setGenerations((current) => [generation, ...current])}
        />
      )}
    </>
  );
}
