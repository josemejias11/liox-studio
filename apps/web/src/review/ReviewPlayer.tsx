'use client';

import { useState } from 'react';
import type { NormalizedCourseContent } from '@/learning/course-content';
import { PlayerViewport } from '@/learning/PlayerViewport';
import { ReviewFeedbackPanel } from './ReviewFeedbackPanel';

export function ReviewPlayer({
  token,
  title,
  version,
  content,
  lessons,
}: {
  token: string;
  title: string;
  version: number;
  content: NormalizedCourseContent;
  lessons: Array<{ id: string; label: string }>;
}) {
  const [selectedLessonId, setSelectedLessonId] = useState<string | undefined>();

  return (
    <main className="bg-muted/40 text-foreground min-h-screen px-6 py-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-6 flex items-end justify-between gap-6">
          <div>
            <p className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">
              Motorola course review
            </p>
            <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
            <p className="text-muted-foreground mt-1 text-sm">Immutable review version {version}</p>
          </div>
          <p className="text-muted-foreground max-w-md text-right text-sm">
            Explore the course exactly as a learner will see it, then attach feedback to the
            relevant screen.
          </p>
        </header>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="border-border min-w-0 rounded-2xl border bg-zinc-950 p-3 shadow-xl">
            <PlayerViewport
              aiIdentity={{ reviewToken: token }}
              content={content}
              selectedLessonId={selectedLessonId}
            />
          </div>
          <ReviewFeedbackPanel
            lessons={lessons}
            onSelectLesson={setSelectedLessonId}
            selectedLessonId={selectedLessonId}
            token={token}
          />
        </div>
      </div>
    </main>
  );
}
