'use client';

import type { CourseTemplateSummary } from '@/authoring/templates/catalog';
import { BookOpen, LoaderCircle, Sparkles } from 'lucide-react';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface CourseCreationPanelProps {
  createBlankCourse: (formData: FormData) => Promise<void>;
  templates: CourseTemplateSummary[];
}

type SubmissionKind = 'blank' | 'comprehensive' | null;

export function CourseCreationPanel({ createBlankCourse, templates }: CourseCreationPanelProps) {
  const router = useRouter();
  const isSubmitting = useRef(false);
  const [submission, setSubmission] = useState<SubmissionKind>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const comprehensiveTemplate = templates.find(
    (template) => template.key === 'comprehensive-course',
  );

  async function submitBlankCourse(formData: FormData) {
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    setSubmission('blank');
    setTemplateError(null);
    try {
      await createBlankCourse(formData);
    } finally {
      isSubmitting.current = false;
      setSubmission(null);
    }
  }

  async function submitComprehensiveCourse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!comprehensiveTemplate || isSubmitting.current) return;
    isSubmitting.current = true;
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
        return;
      }
      router.push(`/studio/${result.course.id}`);
    } catch {
      setTemplateError('We could not create that comprehensive course. Please try again.');
    } finally {
      isSubmitting.current = false;
      setSubmission(null);
    }
  }

  const disabled = submission !== null;

  return (
    <section
      className="studio-glass mb-8 rounded-2xl p-6"
      aria-labelledby="course-creation-heading"
    >
      <div className="mb-5">
        <h2 className="text-lg font-semibold" id="course-creation-heading">
          Start a course
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Begin with an open canvas or a complete learning structure you can tailor before review.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <form
          action={submitBlankCourse}
          className="studio-glass-panel border-border rounded-xl border p-5"
          aria-busy={submission === 'blank'}
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
          <label className="mt-5 block text-sm font-medium" htmlFor="blank-course-title">
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
            {submission === 'blank' && (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            Create blank course
          </button>
        </form>

        <form
          className="studio-glass-panel border-border rounded-xl border p-5"
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
            </div>
          </div>
          <label className="mt-5 block text-sm font-medium" htmlFor="comprehensive-course-title">
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
        </form>
      </div>
    </section>
  );
}
