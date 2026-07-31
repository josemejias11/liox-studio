'use client';

import type { CourseSourceFile } from '@moto-ai/contracts/course-studio';
import { FileText, LoaderCircle, RefreshCw, Trash2, Upload, XCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface SourcePanelProps {
  courseId: string;
  initialSources: CourseSourceFile[];
}

const supportedExtensions = '.pdf,.pptx,.docx,.xlsx';

function sourceUrl(courseId: string, suffix = ''): string {
  return `/api/course-studio/courses/${encodeURIComponent(courseId)}/sources${suffix}`;
}

function sizeLabel(byteSize: number): string {
  if (byteSize < 1024 * 1024) return `${Math.max(1, Math.round(byteSize / 1024))} KB`;
  return `${(byteSize / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(source: CourseSourceFile): string {
  if (source.indexStatus === 'indexed') {
    return `${source.chunksStored ?? 0} indexed chunk${source.chunksStored === 1 ? '' : 's'}`;
  }
  if (source.indexStatus === 'pending') return 'Indexing queued';
  if (source.indexStatus === 'deleting') return 'Cleanup needs completion';
  return 'Indexing failed';
}

async function responseJson(
  response: Response,
): Promise<{ error?: string; sources?: CourseSourceFile[] }> {
  return response.json() as Promise<{ error?: string; sources?: CourseSourceFile[] }>;
}

export function SourcePanel({ courseId, initialSources }: SourcePanelProps) {
  const [sources, setSources] = useState(initialSources);
  const [uploading, setUploading] = useState(false);
  const [busySourceId, setBusySourceId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasPendingSources = sources.some((source) => source.indexStatus === 'pending');

  const refresh = useCallback(async (): Promise<void> => {
    const response = await fetch(sourceUrl(courseId), { cache: 'no-store' });
    const result = await responseJson(response);
    if (!response.ok || !result.sources) {
      throw new Error(result.error || 'Source status could not be refreshed.');
    }
    setSources(result.sources);
  }, [courseId]);

  useEffect(() => {
    if (!hasPendingSources) return;
    const interval = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, 3_000);
    return () => window.clearInterval(interval);
  }, [hasPendingSources, refresh]);

  async function upload(file: File): Promise<void> {
    if (file.size > 50 * 1024 * 1024) {
      setMessage('Source files must be 50 MB or smaller.');
      return;
    }
    setUploading(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.set('file', file);
      const response = await fetch(sourceUrl(courseId), { method: 'POST', body: form });
      const result = await responseJson(response);
      if (!response.ok) throw new Error(result.error || 'The source could not be uploaded.');
      await refresh();
      setMessage(`${file.name} uploaded. Indexing has been queued.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The source could not be uploaded.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function retryIndex(source: CourseSourceFile): Promise<void> {
    setBusySourceId(source.id);
    setMessage(null);
    try {
      const response = await fetch(sourceUrl(courseId, `/${encodeURIComponent(source.id)}/retry`), {
        method: 'POST',
      });
      const result = await responseJson(response);
      if (!response.ok) throw new Error(result.error || 'The source retry could not be queued.');
      await refresh();
      setMessage(`Retry queued for ${source.filename}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The source retry could not be queued.');
    } finally {
      setBusySourceId(null);
    }
  }

  async function remove(source: CourseSourceFile): Promise<void> {
    const retryingCleanup = source.indexStatus === 'deleting';
    if (
      !window.confirm(
        retryingCleanup
          ? `Retry stored-data cleanup for ${source.filename}?`
          : `Remove ${source.filename}? This removes the source from this course and its stored index.`,
      )
    ) {
      return;
    }
    setBusySourceId(source.id);
    setMessage(null);
    try {
      const response = await fetch(sourceUrl(courseId, `/${encodeURIComponent(source.id)}`), {
        method: 'DELETE',
      });
      const result = await responseJson(response);
      if (!response.ok) throw new Error(result.error || 'The source could not be removed.');
      await refresh();
      setMessage(`${source.filename} was removed.`);
    } catch (error) {
      await refresh().catch(() => undefined);
      setMessage(
        error instanceof Error ? error.message : 'The source could not be removed. Retry cleanup.',
      );
    } finally {
      setBusySourceId(null);
    }
  }

  return (
    <section aria-labelledby="source-panel-heading" className="space-y-4">
      <div>
        <p className="text-primary text-[11px] font-semibold tracking-[0.16em] uppercase">
          Source materials
        </p>
        <h2 className="mt-1 text-base font-semibold" id="source-panel-heading">
          Grounded authoring sources
        </h2>
        <p className="text-muted-foreground mt-1 text-xs">
          Upload PDF, PowerPoint, Word, or Excel materials. Freeze only after every owned source is
          indexed.
        </p>
      </div>

      <div className="studio-glass-control border-border rounded-xl border p-3">
        <label className="bg-primary text-primary-foreground inline-flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50">
          {uploading ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {uploading ? 'Uploading…' : 'Upload source'}
          <input
            accept={supportedExtensions}
            className="sr-only"
            disabled={uploading || busySourceId !== null}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
            ref={inputRef}
            type="file"
          />
        </label>
        <p className="text-muted-foreground mt-2 text-[11px]">
          PDF, PPTX, DOCX, or XLSX · 50 MB maximum
        </p>
      </div>

      {message && (
        <p className="bg-muted rounded-lg px-3 py-2 text-xs" role="status">
          {message}
        </p>
      )}

      {sources.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-lg border border-dashed p-3 text-xs">
          No source materials yet. Add at least one indexed source before freezing a grounded
          revision.
        </p>
      ) : (
        <ul className="space-y-2" aria-label="Source materials">
          {sources.map((source) => {
            const busy = busySourceId === source.id;
            const owned = source.ownership === 'owned';
            return (
              <li
                className="studio-glass-control border-border rounded-xl border p-3"
                key={source.id}
              >
                <div className="flex items-start gap-2">
                  <FileText className="text-primary mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{source.filename}</p>
                    <p className="text-muted-foreground mt-1 text-[11px]">
                      {sizeLabel(source.byteSize)} · {statusLabel(source)}
                    </p>
                    {source.ownership === 'inherited' && (
                      <p className="text-muted-foreground mt-1 text-[11px]">
                        Inherited from the frozen source revision; R2 bytes are shared, not copied.
                      </p>
                    )}
                    {source.indexError && (
                      <p className="text-destructive mt-1 text-[11px]">{source.indexError}</p>
                    )}
                    {owned && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {source.indexStatus === 'failed' && (
                          <button
                            className="border-border hover:border-primary inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold disabled:opacity-50"
                            disabled={busy || uploading}
                            onClick={() => void retryIndex(source)}
                            type="button"
                          >
                            {busy ? (
                              <LoaderCircle className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3" />
                            )}
                            Retry indexing
                          </button>
                        )}
                        <button
                          className="text-destructive hover:bg-destructive/10 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold disabled:opacity-50"
                          disabled={busy || uploading}
                          onClick={() => void remove(source)}
                          type="button"
                        >
                          {busy ? (
                            <LoaderCircle className="h-3 w-3 animate-spin" />
                          ) : source.indexStatus === 'deleting' ? (
                            <RefreshCw className="h-3 w-3" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                          {source.indexStatus === 'deleting' ? 'Retry cleanup' : 'Remove'}
                        </button>
                      </div>
                    )}
                  </div>
                  {source.indexStatus === 'failed' && (
                    <XCircle
                      className="text-destructive h-4 w-4 shrink-0"
                      aria-label="Indexing failed"
                    />
                  )}
                  {source.indexStatus === 'pending' && (
                    <LoaderCircle
                      className="text-primary h-4 w-4 shrink-0 animate-spin"
                      aria-label="Indexing"
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
