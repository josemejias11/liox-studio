'use client';

import { useState } from 'react';
import type { StudioTrashItem } from './studio-types';

export interface TrashPanelProps {
  disabled: boolean;
  items: StudioTrashItem[];
  onRestore: (trashId: string) => Promise<void>;
  onPermanentDelete: (trashId: string) => Promise<void>;
  onEmpty: () => Promise<void>;
}

export function TrashPanel({
  disabled,
  items,
  onRestore,
  onPermanentDelete,
  onEmpty,
}: TrashPanelProps) {
  const [expanded, setExpanded] = useState(false);

  async function permanentlyDelete(trashId: string) {
    if (!window.confirm('Permanently delete this screen? This cannot be undone.')) return;
    await onPermanentDelete(trashId);
  }

  async function emptyTrash() {
    if (!window.confirm('Permanently delete every screen in Trash? This cannot be undone.')) return;
    await onEmpty();
  }

  return (
    <section className="border-t border-border bg-card" aria-label="Trash">
      <div className="flex items-center gap-2 p-3">
        <button
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-semibold hover:bg-muted"
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          <span>Trash</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{items.length}</span>
        </button>
        {items.length > 0 && expanded && (
          <button
            className="rounded-md px-2 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disabled}
            onClick={() => void emptyTrash()}
            type="button"
          >
            Empty Trash
          </button>
        )}
      </div>
      {expanded && (
        <div className="max-h-64 space-y-2 overflow-y-auto px-3 pb-3">
          {items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">No screens in Trash.</p>
          ) : (
            items.map((item) => (
              <article className="rounded-lg border border-border p-3" key={item.id}>
                <p className="truncate text-sm font-medium">{item.headline}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.lessonType} · {item.chapterTitle} · Original position {item.position + 1}
                </p>
                <time className="mt-1 block text-[11px] text-muted-foreground" dateTime={item.deletedAt} suppressHydrationWarning>
                  Deleted {new Date(item.deletedAt).toLocaleString()}
                </time>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs font-medium hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={disabled}
                    onClick={() => void onRestore(item.id)}
                    type="button"
                  >
                    Restore
                  </button>
                  <button
                    aria-label={`Permanently delete ${item.headline}`}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={disabled}
                    onClick={() => void permanentlyDelete(item.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      )}
    </section>
  );
}
