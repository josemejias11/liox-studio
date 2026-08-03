'use client';

import type { CourseGenerationSummary } from '@moto-ai/contracts/course-generation';
import { Sparkles, X } from 'lucide-react';
import { useState } from 'react';

export interface GenerationSourceRevision {
  id: string;
  courseTitle: string;
  version: number;
  sourceCount: number;
}

interface CreateWithAiDialogProps {
  open: boolean;
  revisions: GenerationSourceRevision[];
  retryFrom?: Pick<CourseGenerationSummary, 'brief' | 'sourceRevisionId'>;
  onClose: () => void;
  onCreated: (generation: CourseGenerationSummary) => void;
}

export function CreateWithAiDialog({
  open,
  revisions,
  retryFrom,
  onClose,
  onCreated,
}: CreateWithAiDialogProps) {
  const [brief, setBrief] = useState(retryFrom?.brief ?? '');
  const [sourceRevisionId, setSourceRevisionId] = useState(
    retryFrom?.sourceRevisionId ?? revisions[0]?.id ?? '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/course-studio/generations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brief, sourceRevisionId }),
      });
      const result = (await response.json()) as {
        generation?: CourseGenerationSummary;
        error?: string;
      };
      if (!response.ok || !result.generation) {
        throw new Error(result.error || 'The generation request could not be queued.');
      }
      onCreated(result.generation);
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'The generation request could not be queued.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4" role="presentation">
      <section
        aria-labelledby="create-with-ai-title"
        aria-modal="true"
        className="studio-glass border-border w-full max-w-2xl rounded-2xl border p-6 shadow-2xl"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold" id="create-with-ai-title">
              Create an editable draft with AI
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              The selected frozen revision is the complete allowed source set. Nothing is frozen or
              delivered automatically.
            </p>
          </div>
          <button
            aria-label="Close"
            className="hover:bg-muted rounded-lg p-2"
            disabled={busy}
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium">
            Frozen source revision
            <select
              className="border-input bg-background mt-1 w-full rounded-lg border px-3 py-2"
              disabled={busy}
              onChange={(event) => setSourceRevisionId(event.target.value)}
              required
              value={sourceRevisionId}
            >
              {revisions.map((revision) => (
                <option key={revision.id} value={revision.id}>
                  {revision.courseTitle} · version {revision.version} · {revision.sourceCount}{' '}
                  source{revision.sourceCount === 1 ? '' : 's'}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Author brief
            <textarea
              className="border-input bg-background mt-1 min-h-36 w-full rounded-lg border px-3 py-2"
              disabled={busy}
              maxLength={4000}
              onChange={(event) => setBrief(event.target.value)}
              placeholder="Audience, learning goals, tone, and the experience you want to create…"
              required
              value={brief}
            />
          </label>
          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              className="border-border rounded-lg border px-4 py-2 text-sm font-medium"
              disabled={busy}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
              disabled={busy || revisions.length === 0}
              type="submit"
            >
              <Sparkles className="h-4 w-4" />
              {busy ? 'Queueing…' : 'Generate draft'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
