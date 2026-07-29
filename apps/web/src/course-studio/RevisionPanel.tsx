'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Clipboard, Snowflake } from 'lucide-react';

export interface StudioRevision {
  id: string;
  version: number;
  status: string;
  notes: string | null;
  createdAt: string;
  hasReview: boolean;
}

export interface StudioFeedback {
  id: string;
  revisionVersion: number;
  lessonId: string | null;
  authorName: string;
  message: string;
  status: string;
  createdAt: string;
}

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
  const latestLoadId = useRef(0);
  const courseGeneration = useRef(0);

  const isCurrentCourse = useCallback(
    (generation: number) => generation === courseGeneration.current,
    [],
  );

  useLayoutEffect(() => () => {
    courseGeneration.current += 1;
  }, []);

  const load = useCallback(async ({ reset = false, signal }: { reset?: boolean; signal?: AbortSignal } = {}) => {
    const generation = courseGeneration.current;
    const loadId = latestLoadId.current + 1;
    latestLoadId.current = loadId;
    if (reset) {
      setRevisions([]);
      setFeedback([]);
      setReviewUrl(null);
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
        throw new Error(revisionResult.error || feedbackResult.error || 'Review history could not be loaded.');
      }
      if (signal?.aborted || loadId !== latestLoadId.current || !isCurrentCourse(generation)) return;
      setRevisions(revisionResult.revisions ?? []);
      setFeedback(feedbackResult.feedback ?? []);
    } catch (error) {
      if (signal?.aborted || loadId !== latestLoadId.current || !isCurrentCourse(generation)) return;
      setLoadError(error instanceof Error ? error.message : 'Review history could not be loaded.');
    } finally {
      if (loadId === latestLoadId.current && isCurrentCourse(generation)) setLoading(false);
    }
  }, [courseId, isCurrentCourse]);

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
      const response = await fetch(`/api/course-studio/courses/${encodeURIComponent(courseId)}/feedback`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ feedbackId }),
      });
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
    const notes = window.prompt('Revision notes (optional)', '') ?? undefined;
    const generation = courseGeneration.current;
    setBusy(true);
    setMessage('Freezing immutable revision…');
    try {
      const response = await fetch(`/api/course-studio/courses/${encodeURIComponent(courseId)}/revisions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      const result = await response.json() as { error?: string };
      if (!isCurrentCourse(generation)) return;
      if (!response.ok) throw new Error(result.error || 'Revision could not be created.');
      await load();
      if (!isCurrentCourse(generation)) return;
      setMessage('Revision frozen. Future edits will not change it.');
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
      const response = await fetch(`/api/course-studio/revisions/${encodeURIComponent(revisionId)}/review`, { method: 'POST' });
      const result = await response.json() as { reviewUrl?: string; error?: string };
      if (!isCurrentCourse(generation)) return;
      if (!response.ok || !result.reviewUrl) throw new Error(result.error || 'Review link could not be created.');
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

  return (
    <section className="studio-glass border-x-0 border-b-0 border-t border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <div><h2 className="text-sm font-semibold">Client review</h2><p className="text-[11px] text-muted-foreground">Freeze the current course before sharing.</p></div>
        <button className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-xs font-semibold text-background disabled:opacity-50" disabled={disabled || busy} onClick={freeze} type="button"><Snowflake className="h-3.5 w-3.5" />Freeze</button>
      </div>
      {loading && <p className="mt-3 text-xs text-muted-foreground" role="status">Loading review history…</p>}
      {loadError && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive" role="alert">
          <span>{loadError}</span>
          <button className="studio-glass-control shrink-0 rounded-md border px-2 py-1 font-semibold text-destructive hover:underline disabled:opacity-50" disabled={busy || loading} onClick={() => void load()} type="button">Retry</button>
        </div>
      )}
      {message && <p className="mt-3 text-xs text-muted-foreground">{message}</p>}
      {reviewUrl && (
        <button className="studio-glass-control mt-3 flex w-full items-center gap-2 rounded-lg border border-primary p-2 text-left text-xs text-primary" onClick={() => navigator.clipboard.writeText(reviewUrl)} type="button"><Clipboard className="h-4 w-4 shrink-0" /><span className="truncate">Copy review link</span></button>
      )}
      <div className="mt-3 max-h-36 space-y-2 overflow-y-auto">
        {revisions.map((revision) => (
          <div className="studio-glass-panel flex items-center gap-2 rounded-lg border border-border p-2 text-xs" key={revision.id}>
            <div className="min-w-0 flex-1"><p className="font-semibold">Version {revision.version}</p><p className="truncate text-muted-foreground">{revision.notes || new Date(revision.createdAt).toLocaleString()}</p></div>
            <button className="studio-glass-control rounded-md border border-border px-2 py-1 hover:border-primary hover:text-primary" disabled={busy} onClick={() => createLink(revision.id)} type="button">{revision.hasReview ? 'Replace link' : 'Share'}</button>
          </div>
        ))}
        {revisions.length === 0 && <p className="text-xs text-muted-foreground">No frozen revisions yet.</p>}
      </div>
      {feedback.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Feedback</p>
          <div className="max-h-44 space-y-2 overflow-y-auto">
            {feedback.map((item) => (
              <article className={`rounded-lg border p-2 text-xs ${item.status === 'RESOLVED' ? 'studio-glass-panel border-border opacity-60' : 'studio-glass-selected border-primary/30'}`} key={item.id}>
                <div className="flex items-center justify-between gap-2"><p className="font-semibold">{item.authorName} · v{item.revisionVersion}</p>{item.status !== 'RESOLVED' && <button className="studio-glass-control rounded-md border px-2 py-1 text-primary hover:underline" disabled={busy} onClick={() => resolveFeedback(item.id)} type="button">Resolve</button>}</div>
                <p className="mt-1 text-muted-foreground">{item.message}</p>
                {item.lessonId && <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">Screen: {item.lessonId}</p>}
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
