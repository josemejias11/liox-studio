'use client';

import type { CourseGenerationSummary } from '@moto-ai/contracts/course-generation';
import type { JobAcceptedResponse } from '@moto-ai/contracts/jobs';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Copy, Sparkles, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { fetchJson } from '@/shared/fetch-json';
import { CourseDuplicationStatusPanel } from './CourseDuplicationStatusPanel';
import { CreateWithAiDialog, type GenerationSourceRevision } from './CreateWithAiDialog';
import { GenerationStatusPanel } from './GenerationStatusPanel';
import { RevisionPanel } from './RevisionPanel';
import type { CourseDuplicationJobSummary } from './server/studio-loaders';

export interface CourseLibraryItem {
  id: string;
  title: string;
  description: string | null;
  cover: unknown;
  generatedBy: {
    id: string;
    sourceRevisionId: string;
    sourceRevisionVersion: number;
    modelIdentifier: string | null;
    createdAt: string;
  } | null;
}

interface CourseLibraryProps {
  courses: CourseLibraryItem[];
  generations: CourseGenerationSummary[];
  sourceRevisions: GenerationSourceRevision[];
  duplicationJobs: CourseDuplicationJobSummary[];
}

function courseLibraryImageUrl(cover: unknown): string | undefined {
  if (!cover || typeof cover !== 'object' || Array.isArray(cover)) return undefined;
  const source = cover as { thumbnail?: unknown; coverImage?: unknown };

  for (const candidate of [source.thumbnail, source.coverImage]) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const asset = (candidate as { asset?: unknown }).asset;
    if (!asset || typeof asset !== 'object' || Array.isArray(asset)) continue;
    const url = (asset as { url?: unknown }).url;
    if (typeof url === 'string' && url.trim()) return url;
  }

  return undefined;
}

export function CourseLibrary({
  courses,
  generations: initialGenerations,
  sourceRevisions,
  duplicationJobs: initialDuplicationJobs,
}: CourseLibraryProps) {
  const router = useRouter();
  const [selectedCourse, setSelectedCourse] = useState<CourseLibraryItem | null>(null);
  const [generations, setGenerations] = useState(initialGenerations);
  const [duplicationJobs, setDuplicationJobs] = useState(initialDuplicationJobs);
  const [duplicatingCourseIds, setDuplicatingCourseIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [duplicationError, setDuplicationError] = useState<{
    courseId: string;
    message: string;
  } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [retryFrom, setRetryFrom] = useState<CourseGenerationSummary | undefined>();
  const firstImageIndex = courses.findIndex((course) => courseLibraryImageUrl(course.cover));
  const reviewCourse = selectedCourse
    ? (courses.find((course) => course.id === selectedCourse.id) ?? null)
    : null;
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

  async function duplicateCourse(course: CourseLibraryItem) {
    const title = window.prompt('New course title', `${course.title} copy`);
    if (!title || !title.trim()) return;
    const requestId = crypto.randomUUID();
    setDuplicationError(null);
    setDuplicatingCourseIds((current) => new Set(current).add(course.id));
    try {
      const job = await fetchJson<JobAcceptedResponse>(
        `/api/course-studio/courses/${encodeURIComponent(course.id)}/duplicate`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ requestId, title: title.trim() }),
        },
        'Course could not be duplicated.',
      );
      const now = new Date().toISOString();
      setDuplicationJobs((current) => [
        {
          id: job.jobId,
          status: 'queued',
          progress: null,
          result: null,
          errorMessage: null,
          sourceCourseId: course.id,
          requestedTitle: title.trim(),
          createdAt: now,
          updatedAt: now,
        },
        ...current,
      ]);
    } catch (caught) {
      setDuplicationError({
        courseId: course.id,
        message: caught instanceof Error ? caught.message : 'Course could not be duplicated.',
      });
    } finally {
      setDuplicatingCourseIds((current) => {
        const next = new Set(current);
        next.delete(course.id);
        return next;
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          AI drafts use only the source files captured by a frozen revision.
        </p>
        <button
          className="border-primary text-primary hover:bg-primary/5 inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50"
          disabled={sourceRevisions.length === 0}
          onClick={() => {
            setRetryFrom(undefined);
            setDialogOpen(true);
          }}
          type="button"
        >
          <Sparkles className="h-4 w-4" />
          Create with AI
        </button>
      </div>
      {sourceRevisions.length === 0 && (
        <p className="border-border text-muted-foreground mb-6 rounded-lg border p-3 text-sm">
          Freeze a course revision with at least one indexed source before generating a grounded
          draft.
        </p>
      )}
      <GenerationStatusPanel
        generations={generations}
        onRefresh={refreshGenerations}
        onRetry={(generation) => {
          setRetryFrom(generation);
          setDialogOpen(true);
        }}
      />
      <CourseDuplicationStatusPanel jobs={duplicationJobs} onUpdate={setDuplicationJobs} />
      <div className="grid gap-3 sm:grid-cols-2">
        {courses.map((course, index) => {
          const imageUrl = courseLibraryImageUrl(course.cover);
          const isSelected = selectedCourse?.id === course.id;

          return (
            <article
              className={`studio-glass-panel overflow-hidden rounded-xl border transition-colors ${
                isSelected ? 'studio-glass-selected' : 'hover:border-primary'
              }`}
              key={course.id}
            >
              <div className="bg-muted relative aspect-[16/9] w-full overflow-hidden">
                {imageUrl ? (
                  <Image
                    alt={course.title}
                    className="object-cover"
                    fill
                    priority={index === firstImageIndex}
                    sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
                    src={imageUrl}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <BookOpen className="text-muted-foreground/30 h-10 w-10" />
                  </div>
                )}
              </div>
              <div className="p-5">
                <h3 className="font-semibold">{course.title}</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  {course.description || 'No description yet.'}
                </p>
                {course.generatedBy && (
                  <div className="border-primary/20 bg-primary/5 text-muted-foreground mt-3 rounded-lg border p-2 text-xs">
                    <p className="text-foreground font-semibold">
                      AI-assisted draft · source revision {course.generatedBy.sourceRevisionVersion}
                    </p>
                    <p className="mt-1">
                      Generation {course.generatedBy.id} · author review required
                    </p>
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    className="border-border hover:border-primary hover:text-primary inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium"
                    href={`/studio/${course.id}`}
                  >
                    Open authoring
                  </Link>
                  <button
                    aria-controls="course-review-panel"
                    aria-pressed={isSelected}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium"
                    onClick={() => setSelectedCourse(course)}
                    type="button"
                  >
                    Review master
                  </button>
                  <button
                    className="border-border hover:border-primary hover:text-primary inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
                    disabled={duplicatingCourseIds.has(course.id)}
                    onClick={() => duplicateCourse(course)}
                    type="button"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Duplicate course
                  </button>
                </div>
                {duplicationError?.courseId === course.id && (
                  <p className="text-destructive mt-2 text-xs">{duplicationError.message}</p>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {reviewCourse && (
        <section
          aria-labelledby="course-review-heading"
          className="studio-glass-panel overflow-hidden rounded-xl border"
          id="course-review-panel"
        >
          <div className="border-border flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold" id="course-review-heading">
                Prepare {reviewCourse.title} for master review
              </h3>
              <p className="text-muted-foreground mt-1 text-sm">
                Freeze an immutable master revision, then create a review link. Future authoring
                changes stay separate.
              </p>
            </div>
            <button
              className="studio-glass-control border-border hover:border-primary hover:text-primary inline-flex w-fit items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium"
              onClick={() => setSelectedCourse(null)}
              type="button"
            >
              <X className="h-4 w-4" />
              Clear selection
            </button>
          </div>
          <RevisionPanel
            autoLoad
            courseId={reviewCourse.id}
            disabled={false}
            initialFeedback={[]}
            initialRevisions={[]}
          />
        </section>
      )}
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
    </div>
  );
}
