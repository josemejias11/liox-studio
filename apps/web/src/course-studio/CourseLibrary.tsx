'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { RevisionPanel } from './RevisionPanel';

export interface CourseLibraryItem {
  id: string;
  title: string;
  description: string | null;
  cover: unknown;
}

interface CourseLibraryProps {
  courses: CourseLibraryItem[];
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

export function CourseLibrary({ courses }: CourseLibraryProps) {
  const [selectedCourse, setSelectedCourse] = useState<CourseLibraryItem | null>(null);
  const firstImageIndex = courses.findIndex((course) => courseLibraryImageUrl(course.cover));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {courses.map((course, index) => {
          const imageUrl = courseLibraryImageUrl(course.cover);
          const isSelected = selectedCourse?.id === course.id;

          return (
            <article
              className={`bg-card border-border overflow-hidden rounded-xl border transition-colors ${
                isSelected ? 'border-primary ring-primary/25 ring-2' : 'hover:border-primary'
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
                    <span className="text-muted-foreground text-sm">No thumbnail</span>
                  </div>
                )}
              </div>
              <div className="p-5">
                <h3 className="font-semibold">{course.title}</h3>
                <p className="text-muted-foreground mt-1 text-sm">{course.description || 'Draft course'}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    className="inline-flex items-center rounded-lg border border-border px-3 py-2 text-sm font-medium hover:border-primary hover:text-primary"
                    href={`/studio/${course.id}`}
                  >
                    Open editor
                  </Link>
                  <button
                    aria-controls="course-review-panel"
                    aria-pressed={isSelected}
                    className="inline-flex items-center rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    onClick={() => setSelectedCourse(course)}
                    type="button"
                  >
                    Prepare for review
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {selectedCourse && (
        <section
          aria-labelledby="course-review-heading"
          className="bg-card border-border overflow-hidden rounded-xl border"
          id="course-review-panel"
        >
          <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold" id="course-review-heading">
                Prepare {selectedCourse.title} for review
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Freeze and share a revision without changing the course itself.
              </p>
            </div>
            <button
              className="inline-flex w-fit items-center rounded-lg border border-border px-3 py-2 text-sm font-medium hover:border-primary hover:text-primary"
              onClick={() => setSelectedCourse(null)}
              type="button"
            >
              Clear selection
            </button>
          </div>
          <RevisionPanel
            autoLoad
            courseId={selectedCourse.id}
            disabled={false}
            initialFeedback={[]}
            initialRevisions={[]}
          />
        </section>
      )}
    </div>
  );
}
