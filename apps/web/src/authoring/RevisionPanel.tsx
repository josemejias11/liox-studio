'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Clipboard, Download, Snowflake } from 'lucide-react';
import { fetchJson } from '@/shared/fetch-json';

interface StudioRevision {
  id: string;
  version: number;
  status: string;
  notes: string | null;
  createdAt: string;
  hasReview: boolean;
}

interface StudioFeedback {
  id: string;
  revisionVersion: number;
  lessonId: string | null;
  authorName: string;
  message: string;
  status: string;
  createdAt: string;
}

type ScormExportJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

interface RevisionPanelProps {
  courseId: string;
  disabled: boolean;
  initialRevisions: StudioRevision[];
  initialFeedback: StudioFeedback[];
  autoLoad?: boolean;
}

export function RevisionPanel(props: RevisionPanelProps) {
  return <RevisionPanelContent key={props.courseId} {...props} />;
}

function RevisionPanelContent({
  courseId,
  disabled,
  initialRevisions,
  initialFeedback,
  autoLoad = false,
}: RevisionPanelProps) {
  const [revisions, setRevisions] = useState<StudioRevision[]>(initialRevisions);
  const [feedback, setFeedback] = useState<StudioFeedback[]>(initialFeedback);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const latestLoadId = useRef(0);
  const courseGeneration = useRef(0);

  const isCurrentCourse = useCallback(
    (generation: number) => generation === courseGeneration.current,
    [],
  );

  useLayoutEffect(
    () => () => {
      courseGeneration.current += 1;
    },
    [],
  );

  const load = useCallback(
    async ({ reset = false, signal }: { reset?: boolean; signal?: AbortSignal } = {}) => {
      const generation = courseGeneration.current;
      const loadId = latestLoadId.current + 1;
      latestLoadId.current = loadId;
      if (reset) {
        setRevisions([]);
        setFeedback([]);
        setReviewUrl(null);
        setExportUrl(null);
        setMessage(null);
      }
      setLoading(true);
      setLoadError(null);
      try {
        const [revisionResponse, feedbackResponse] = await Promise.all([
          fetch(`/api/course-studio/courses/${encodeURIComponent(courseId)}/revisions`, { signal }),
          fetch(`/api/course-studio/courses/${encodeURIComponent(courseId)}/feedback`, { signal }),
        ]);
        const [revisionResult, feedbackResult] = await Promise.all([
          revisionResponse.json() as Promise<{ revisions?: StudioRevision[]; error?: string }>,
          feedbackResponse.json() as Promise<{ feedback?: StudioFeedback[]; error?: string }>,
        ]);
        if (!revisionResponse.ok || !feedbackResponse.ok) {
          throw new Error(
            revisionResult.error || feedbackResult.error || 'Review history could not be loaded.',
          );
        }
        if (signal?.aborted || loadId !== latestLoadId.current || !isCurrentCourse(generation))
          return;
        setRevisions(revisionResult.revisions ?? []);
        setFeedback(feedbackResult.feedback ?? []);
      } catch (error) {
        if (signal?.aborted || loadId !== latestLoadId.current || !isCurrentCourse(generation))
          return;
        setLoadError(
          error instanceof Error ? error.message : 'Review history could not be loaded.',
        );
      } finally {
        if (loadId === latestLoadId.current && isCurrentCourse(generation)) setLoading(false);
      }
    },
    [courseId, isCurrentCourse],
  );

  useEffect(() => {
    if (!autoLoad) return;
    const controller = new AbortController();
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load({ reset: true, signal: controller.signal });
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [autoLoad, load]);

  async function resolveFeedback(feedbackId: string) {
    const generation = courseGeneration.current;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/course-studio/courses/${encodeURIComponent(courseId)}/feedback`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ feedbackId }),
        },
      );
      if (!isCurrentCourse(generation)) return;
      if (!response.ok) throw new Error('Feedback could not be resolved.');
      await load();
      if (!isCurrentCourse(generation)) return;
      setMessage('Feedback marked resolved.');
    } catch (error) {
      if (!isCurrentCourse(generation)) return;
      setMessage(error instanceof Error ? error.message : 'Feedback could not be resolved.');
    } finally {
      if (isCurrentCourse(generation)) setBusy(false);
    }
  }

  async function freeze() {
    const notes = window.prompt('Master revision notes (optional)', '') ?? undefined;
    const generation = courseGeneration.current;
    setBusy(true);
    setMessage('Freezing master revision…');
    try {
      await fetchJson<{ error?: string }>(
        `/api/course-studio/courses/${encodeURIComponent(courseId)}/revisions`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ notes }),
        },
        'Revision could not be created.',
      );
      if (!isCurrentCourse(generation)) return;
      await load();
      if (!isCurrentCourse(generation)) return;
      setMessage('Master revision frozen. Future authoring changes will not change it.');
    } catch (error) {
      if (!isCurrentCourse(generation)) return;
      setMessage(error instanceof Error ? error.message : 'Revision could not be created.');
    } finally {
      if (isCurrentCourse(generation)) setBusy(false);
    }
  }

  async function createLink(revisionId: string) {
    const generation = courseGeneration.current;
    setBusy(true);
    setReviewUrl(null);
    try {
      const result = await fetchJson<{ reviewUrl?: string; error?: string }>(
        `/api/course-studio/revisions/${encodeURIComponent(revisionId)}/review`,
        { method: 'POST' },
        'Review link could not be created.',
      );
      if (!isCurrentCourse(generation)) return;
      if (!result.reviewUrl) throw new Error(result.error || 'Review link could not be created.');
      setReviewUrl(result.reviewUrl);
      setMessage('A new review link was created. Copy it now.');
      await load();
      if (!isCurrentCourse(generation)) return;
    } catch (error) {
      if (!isCurrentCourse(generation)) return;
      setMessage(error instanceof Error ? error.message : 'Review link could not be created.');
    } finally {
      if (isCurrentCourse(generation)) setBusy(false);
    }
  }

  async function exportScorm(revisionId: string) {
    const generation = courseGeneration.current;
    setBusy(true);
    setExportUrl(null);
    setMessage('Building SCORM package…');
    try {
      const { jobId } = await fetchJson<{ jobId: string }>(
        `/api/course-studio/revisions/${encodeURIComponent(revisionId)}/scorm-export`,
        { method: 'POST' },
        'SCORM export could not be started.',
      );
      if (!isCurrentCourse(generation)) return;

      let status: ScormExportJobStatus = 'queued';
      let result: { exportId?: string } | null = null;
      // ~150 iterations at the 2s poll interval below is a ~5 minute cap — a generous
      // safety margin over the ~30s a real export has actually taken in testing. Without
      // a cap, a stuck job-worker (down, misconfigured SCORM_PLAYER_BUNDLE_PATH, etc.)
      // would leave this panel's busy state locked forever with no way out but a reload.
      const MAX_POLL_ITERATIONS = 150;
      let iterations = 0;
      let timedOut = false;
      while (status === 'queued' || status === 'running') {
        if (iterations >= MAX_POLL_ITERATIONS) {
          timedOut = true;
          break;
        }
        iterations += 1;
        await new Promise((resolve) => setTimeout(resolve, 2000));
        if (!isCurrentCourse(generation)) return;
        const job = await fetchJson<{
          status: ScormExportJobStatus;
          result: { exportId?: string } | null;
          errorMessage: string | null;
        }>(`/api/jobs/${encodeURIComponent(jobId)}`, { method: 'GET' }, 'SCORM export status could not be read.');
        if (!isCurrentCourse(generation)) return;
        status = job.status;
        result = job.result;
        if (status === 'failed') throw new Error(job.errorMessage || 'SCORM export failed.');
      }

      if (timedOut) {
        setMessage('Still building — this is taking longer than expected. Check back in a few minutes.');
        return;
      }

      if (!result?.exportId) throw new Error('SCORM export finished without a result.');
      setExportUrl(`/api/course-studio/exports/${encodeURIComponent(result.exportId)}/download`);
      setMessage('SCORM package ready. Download it now.');
    } catch (error) {
      if (!isCurrentCourse(generation)) return;
      setMessage(error instanceof Error ? error.message : 'SCORM export could not be started.');
    } finally {
      if (isCurrentCourse(generation)) setBusy(false);
    }
  }

  return (
    <section className="studio-glass border-border border-x-0 border-t border-b-0 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Master review</h2>
          <p className="text-muted-foreground text-[11px]">
            Freeze the current authoring graph as a master revision before creating a review link.
          </p>
        </div>
        <button
          className="bg-foreground text-background inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50"
          disabled={disabled || busy}
          onClick={freeze}
          type="button"
        >
          <Snowflake className="h-3.5 w-3.5" />
          Freeze master
        </button>
      </div>
      {loading && (
        <p className="text-muted-foreground mt-3 text-xs" role="status">
          Loading review history…
        </p>
      )}
      {loadError && (
        <div
          className="border-destructive/30 bg-destructive/5 text-destructive mt-3 flex items-center justify-between gap-3 rounded-lg border p-2 text-xs"
          role="alert"
        >
          <span>{loadError}</span>
          <button
            className="studio-glass-control text-destructive shrink-0 rounded-md border px-2 py-1 font-semibold hover:underline disabled:opacity-50"
            disabled={busy || loading}
            onClick={() => void load()}
            type="button"
          >
            Retry
          </button>
        </div>
      )}
      {message && <p className="text-muted-foreground mt-3 text-xs">{message}</p>}
      {reviewUrl && (
        <button
          className="studio-glass-control border-primary text-primary mt-3 flex w-full items-center gap-2 rounded-lg border p-2 text-left text-xs"
          onClick={() => navigator.clipboard.writeText(reviewUrl)}
          type="button"
        >
          <Clipboard className="h-4 w-4 shrink-0" />
          <span className="truncate">Copy review link</span>
        </button>
      )}
      {exportUrl && (
        <a
          className="studio-glass-control border-primary text-primary mt-3 flex w-full items-center gap-2 rounded-lg border p-2 text-left text-xs"
          href={exportUrl}
          download
        >
          <Download className="h-4 w-4 shrink-0" />
          <span className="truncate">Download SCORM package</span>
        </a>
      )}
      <div className="mt-3 max-h-36 space-y-2 overflow-y-auto">
        {revisions.map((revision) => (
          <div
            className="studio-glass-panel border-border flex items-center gap-2 rounded-lg border p-2 text-xs"
            key={revision.id}
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Master revision {revision.version}</p>
              <p className="text-muted-foreground truncate">
                {revision.notes || new Date(revision.createdAt).toLocaleString()}
              </p>
            </div>
            <button
              className="studio-glass-control border-border hover:border-primary hover:text-primary rounded-md border px-2 py-1"
              disabled={busy}
              onClick={() => createLink(revision.id)}
              type="button"
            >
              {revision.hasReview ? 'Replace review link' : 'Create review link'}
            </button>
            <button
              className="studio-glass-control border-border hover:border-primary hover:text-primary rounded-md border px-2 py-1"
              disabled={busy}
              onClick={() => exportScorm(revision.id)}
              type="button"
            >
              Export SCORM package
            </button>
          </div>
        ))}
        {revisions.length === 0 && (
          <p className="text-muted-foreground text-xs">No frozen master revisions yet.</p>
        )}
      </div>
      {feedback.length > 0 && (
        <div className="border-border mt-4 border-t pt-3">
          <p className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-[0.12em] uppercase">
            Feedback
          </p>
          <div className="max-h-44 space-y-2 overflow-y-auto">
            {feedback.map((item) => (
              <article
                className={`rounded-lg border p-2 text-xs ${item.status === 'RESOLVED' ? 'studio-glass-panel border-border opacity-60' : 'studio-glass-selected border-primary/30'}`}
                key={item.id}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">
                    {item.authorName} · v{item.revisionVersion}
                  </p>
                  {item.status !== 'RESOLVED' && (
                    <button
                      className="studio-glass-control text-primary rounded-md border px-2 py-1 hover:underline"
                      disabled={busy}
                      onClick={() => resolveFeedback(item.id)}
                      type="button"
                    >
                      Resolve
                    </button>
                  )}
                </div>
                <p className="text-muted-foreground mt-1">{item.message}</p>
                {item.lessonId && (
                  <p className="text-muted-foreground mt-1 truncate font-mono text-[10px]">
                    Screen: {item.lessonId}
                  </p>
                )}
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
