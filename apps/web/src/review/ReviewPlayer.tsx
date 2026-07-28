'use client';

import { useState } from 'react';
import type { NormalizedCourseContent } from '@/lib/course-content';
import { AuthoringPreview } from '@/course-studio/AuthoringPreview';
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
    <main className="min-h-screen bg-muted/40 px-6 py-8 text-foreground">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-6 flex items-end justify-between gap-6">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Motorola course review</p><h1 className="mt-2 text-3xl font-semibold">{title}</h1><p className="mt-1 text-sm text-muted-foreground">Immutable review version {version}</p></div>
          <p className="max-w-md text-right text-sm text-muted-foreground">Explore the course exactly as a learner will see it, then attach feedback to the relevant screen.</p>
        </header>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 rounded-2xl border border-border bg-zinc-950 p-3 shadow-xl"><AuthoringPreview content={content} selectedLessonId={selectedLessonId} /></div>
          <ReviewFeedbackPanel lessons={lessons} onSelectLesson={setSelectedLessonId} selectedLessonId={selectedLessonId} token={token} />
        </div>
      </div>
    </main>
  );
}
