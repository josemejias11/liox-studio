'use client';

import Link from 'next/link';
import { Expand, Minimize2 } from 'lucide-react';

export function StudioToolbar({
  title,
  status,
  focusPreview,
  onToggleFocus,
  undoLabel,
  onUndo,
  undoDisabled = false,
}: {
  title: string;
  status: string | null;
  focusPreview: boolean;
  onToggleFocus: () => void;
  undoLabel?: string;
  onUndo?: () => void;
  undoDisabled?: boolean;
}) {
  return (
    <header className="flex min-h-16 flex-wrap items-center gap-3 border-b border-border bg-card px-3 py-2 sm:h-16 sm:flex-nowrap sm:gap-4 sm:px-5">
      <Link className="text-sm font-medium text-primary hover:underline" href="/studio">← Courses</Link>
      <div className="h-6 w-px bg-border" />
      <div className="order-3 min-w-0 basis-full sm:order-none sm:basis-auto sm:flex-1">
        <h1 className="truncate text-sm font-semibold">{title}</h1>
        <div className="flex items-center gap-2">
          <p aria-live="polite" className="text-xs text-muted-foreground">{status || 'All changes are stored in PostgreSQL'}</p>
          {onUndo && (
            <button
              className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
              disabled={undoDisabled}
              onClick={onUndo}
              type="button"
            >
              {undoLabel || 'Undo'}
            </button>
          )}
        </div>
      </div>
      <button className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted" onClick={onToggleFocus} type="button">
        {focusPreview ? <Minimize2 className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
        {focusPreview ? 'Return to editor' : 'Focus preview'}
      </button>
    </header>
  );
}
