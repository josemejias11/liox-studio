'use client';

import type { CourseGenerationSummary } from '@moto-ai/contracts/course-generation';
import Link from 'next/link';
import { LoaderCircle, RefreshCw, Sparkles } from 'lucide-react';
import { useEffect } from 'react';

interface GenerationStatusPanelProps {
  generations: CourseGenerationSummary[];
  onRefresh: (generations: CourseGenerationSummary[]) => void;
  onRetry: (generation: CourseGenerationSummary) => void;
}

export function GenerationStatusPanel({
  generations,
  onRefresh,
  onRetry,
}: GenerationStatusPanelProps) {
  const hasActive = generations.some(
    (generation) => generation.status === 'queued' || generation.status === 'running',
  );
  useEffect(() => {
    if (!hasActive) return;
    const interval = window.setInterval(async () => {
      const response = await fetch('/api/course-studio/generations', { cache: 'no-store' });
      if (!response.ok) return;
      const result = (await response.json()) as { generations?: CourseGenerationSummary[] };
      if (result.generations) onRefresh(result.generations);
    }, 3000);
    return () => window.clearInterval(interval);
  }, [hasActive, onRefresh]);

  if (generations.length === 0) return null;
  return (
    <section
      className="studio-glass mb-8 rounded-2xl p-5"
      aria-labelledby="generation-status-heading"
    >
      <h2 className="flex items-center gap-2 text-lg font-semibold" id="generation-status-heading">
        <Sparkles className="text-primary h-4 w-4" />
        AI draft requests
      </h2>
      <div className="mt-4 space-y-2">
        {generations.map((generation) => (
          <article
            className="studio-glass-panel border-border rounded-xl border p-4"
            key={generation.id}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{generation.brief}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {generation.requestedSourceIds.length} frozen source
                  {generation.requestedSourceIds.length === 1 ? '' : 's'} · {generation.status}
                </p>
              </div>
              {(generation.status === 'queued' || generation.status === 'running') && (
                <LoaderCircle
                  className="text-primary h-4 w-4 animate-spin"
                  aria-label="Generation in progress"
                />
              )}
              {generation.status === 'failed' && (
                <button
                  className="border-border hover:border-primary inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold"
                  onClick={() => onRetry(generation)}
                  type="button"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Create fresh request
                </button>
              )}
              {generation.status === 'succeeded' && generation.createdCourseId && (
                <Link
                  className="bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-xs font-semibold"
                  href={`/studio/${generation.createdCourseId}`}
                >
                  Review and edit
                </Link>
              )}
            </div>
            {generation.error && (
              <p className="text-destructive mt-2 text-xs">{generation.error}</p>
            )}
            {generation.status === 'succeeded' && (
              <p className="text-muted-foreground mt-2 text-xs">
                Created as editable authoring material. An author must review and freeze a later
                revision explicitly.
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
