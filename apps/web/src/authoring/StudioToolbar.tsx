'use client';

import Link from 'next/link';
import { Expand, Minimize2 } from 'lucide-react';

export function StudioToolbar({
  title,
  status,
  focusPreview,
  onNavigateToLibrary,
  onToggleFocus,
  undoLabel,
  onUndo,
  undoDisabled = false,
}: {
  title: string;
  status: string | null;
  focusPreview: boolean;
  onNavigateToLibrary?: () => boolean;
  onToggleFocus: () => void;
  undoLabel?: string;
  onUndo?: () => void;
  undoDisabled?: boolean;
}) {
  return (
    <header className="studio-glass border-b-primary/25 flex min-h-16 flex-wrap items-center gap-3 border-x-0 border-t-0 px-3 py-2 shadow-[0_12px_36px_rgb(104_91_199_/_10%)] sm:h-16 sm:flex-nowrap sm:gap-4 sm:px-5">
      <Link
        className="text-primary text-sm font-medium hover:underline"
        href="/studio"
        onClick={(event) => {
          if (onNavigateToLibrary && !onNavigateToLibrary()) event.preventDefault();
        }}
      >
        ← Courses
      </Link>
      <div className="bg-border h-6 w-px" />
      <div className="order-3 min-w-0 basis-full sm:order-none sm:flex-1 sm:basis-auto">
        <h1 className="truncate text-sm font-semibold">{title}</h1>
        <div className="flex items-center gap-2">
          <p aria-live="polite" className="text-muted-foreground text-xs">
            {status || 'All changes are stored in PostgreSQL'}
          </p>
          {onUndo && (
            <button
              className="studio-glass-control hover:border-primary hover:text-primary rounded-md border px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
              disabled={undoDisabled}
              onClick={onUndo}
              type="button"
            >
              {undoLabel || 'Undo'}
            </button>
          )}
        </div>
      </div>
      <button
        className="studio-glass-control hover:border-primary hover:text-primary inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
        onClick={onToggleFocus}
        type="button"
      >
        {focusPreview ? <Minimize2 className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
        {focusPreview ? 'Return to editor' : 'Focus preview'}
      </button>
    </header>
  );
}
