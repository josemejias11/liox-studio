'use client';

import type { CourseGenerationSummary } from '@moto-ai/contracts/course-generation';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Sparkles, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { CreateWithAiDialog, type GenerationSourceRevision } from './CreateWithAiDialog';
import { GenerationStatusPanel } from './GenerationStatusPanel';
import { RevisionPanel } from './RevisionPanel';

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
}: CourseLibraryProps) {
  const router = useRouter();
  const [selectedCourse, setSelectedCourse] = useState<CourseLibraryItem | null>(null);
  const [generations, setGenerations] = useState(initialGenerations);
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
                </div>
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
