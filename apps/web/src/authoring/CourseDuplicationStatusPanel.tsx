'use client';

import { CourseDuplicateResultSchema } from '@moto-ai/contracts/jobs';
import type { JobStatusResponse } from '@moto-ai/contracts/jobs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Copy, LoaderCircle, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CourseDuplicationJobSummary } from './server/studio-loaders';

interface CourseDuplicationStatusPanelProps {
  jobs: CourseDuplicationJobSummary[];
  onUpdate: (jobs: CourseDuplicationJobSummary[]) => void;
}

export function CourseDuplicationStatusPanel({
  jobs,
  onUpdate,
}: CourseDuplicationStatusPanelProps) {
  const router = useRouter();
  const jobsRef = useRef(jobs);
  const hasActive = jobs.some((job) => job.status === 'queued' || job.status === 'running');
  const [clearingIds, setClearingIds] = useState<ReadonlySet<string>>(() => new Set());
  const [clearError, setClearError] = useState<{ jobId: string; message: string } | null>(null);

  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  useEffect(() => {
    if (!hasActive) return;
    const interval = window.setInterval(async () => {
      const active = jobsRef.current.filter(
        (job) => job.status === 'queued' || job.status === 'running',
      );
      if (active.length === 0) return;

      const updates = await Promise.all(
        active.map(async (job) => {
          const response = await fetch(`/api/jobs/${encodeURIComponent(job.id)}`, {
            cache: 'no-store',
          });
          if (!response.ok) return null;
          return (await response.json()) as JobStatusResponse;
        }),
      );

      const next = jobsRef.current.map((job) => {
        const update = updates.find((candidate) => candidate?.id === job.id);
        if (!update) return job;
        return {
          ...job,
          status: update.status,
          progress: update.progress,
          result: update.result,
          errorMessage: update.errorMessage,
          updatedAt: update.updatedAt,
        };
      });
      onUpdate(next);

      const succeeded = updates.find((update) => update?.status === 'succeeded');
      if (!succeeded) return;
      const parsed = CourseDuplicateResultSchema.safeParse(succeeded.result);
      if (!parsed.success) return;
      router.refresh();
      router.push(`/studio/${parsed.data.courseId}`);
    }, 2000);
    return () => window.clearInterval(interval);
  }, [hasActive, onUpdate, router]);

  async function clearJob(jobId: string) {
    setClearError(null);
    setClearingIds((current) => new Set(current).add(jobId));
    try {
      const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(result?.error || 'Request could not be cleared.');
      }
      onUpdate(jobsRef.current.filter((job) => job.id !== jobId));
    } catch (caught) {
      setClearError({
        jobId,
        message: caught instanceof Error ? caught.message : 'Request could not be cleared.',
      });
    } finally {
      setClearingIds((current) => {
        const next = new Set(current);
        next.delete(jobId);
        return next;
      });
    }
  }

  if (jobs.length === 0) return null;
  return (
    <section
      className="studio-glass mb-8 rounded-2xl p-5"
      aria-labelledby="duplication-status-heading"
    >
      <h2 className="flex items-center gap-2 text-lg font-semibold" id="duplication-status-heading">
        <Copy className="text-primary h-4 w-4" />
        Course duplication requests
      </h2>
      <div className="mt-4 space-y-2">
        {jobs.map((job) => {
          const succeededResult =
            job.status === 'succeeded'
              ? CourseDuplicateResultSchema.safeParse(job.result)
              : undefined;
          const isTerminal = job.status === 'succeeded' || job.status === 'failed';
          return (
            <article
              className="studio-glass-panel border-border rounded-xl border p-4"
              key={job.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{job.requestedTitle}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {job.progress ? `${job.progress} · ` : ''}
                    {job.status}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {(job.status === 'queued' || job.status === 'running') && (
                    <LoaderCircle
                      className="text-primary h-4 w-4 animate-spin"
                      aria-label="Duplication in progress"
                    />
                  )}
                  {succeededResult?.success && (
                    <Link
                      className="bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-xs font-semibold"
                      href={`/studio/${succeededResult.data.courseId}`}
                    >
                      Open course
                    </Link>
                  )}
                  {isTerminal && (
                    <button
                      aria-label="Clear request"
                      className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex items-center rounded-lg p-1.5 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={clearingIds.has(job.id)}
                      onClick={() => void clearJob(job.id)}
                      type="button"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {job.status === 'failed' && job.errorMessage && (
                <p className="text-destructive mt-2 text-xs">{job.errorMessage}</p>
              )}
              {clearError?.jobId === job.id && (
                <p className="text-destructive mt-2 text-xs">{clearError.message}</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
