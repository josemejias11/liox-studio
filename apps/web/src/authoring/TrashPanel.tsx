'use client';

import { ChevronDown, ChevronRight, RotateCcw, Trash2 } from 'lucide-react';
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
    <section
      className="studio-glass border-border border-x-0 border-t border-b-0"
      aria-label="Trash"
    >
      <div className="flex items-center gap-2 p-3">
        <button
          aria-expanded={expanded}
          className="studio-glass-control hover:border-primary hover:text-primary flex min-w-0 flex-1 items-center gap-2 rounded-md border px-2 py-2 text-left text-sm font-semibold"
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0" />
          )}
          <span>Trash</span>
          <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium">
            {items.length}
          </span>
        </button>
        {items.length > 0 && expanded && (
          <button
            className="studio-glass-control text-destructive hover:bg-destructive/10 rounded-md border px-2 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
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
            <p className="studio-glass-control border-border text-muted-foreground rounded-lg border border-dashed px-3 py-4 text-center text-xs">
              No screens in Trash.
            </p>
          ) : (
            items.map((item) => (
              <article
                className="studio-glass-panel border-border rounded-lg border p-3"
                key={item.id}
              >
                <p className="truncate text-sm font-medium">{item.headline}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {item.lessonType} · {item.chapterTitle} · Original position {item.position + 1}
                </p>
                <time
                  className="text-muted-foreground mt-1 block text-[11px]"
                  dateTime={item.deletedAt}
                  suppressHydrationWarning
                >
                  Deleted {new Date(item.deletedAt).toLocaleString()}
                </time>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    className="studio-glass-control border-border hover:border-primary hover:text-primary inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={disabled}
                    onClick={() => void onRestore(item.id)}
                    type="button"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restore
                  </button>
                  <button
                    aria-label={`Permanently delete ${item.headline}`}
                    className="studio-glass-control text-destructive hover:bg-destructive/10 inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={disabled}
                    onClick={() => void permanentlyDelete(item.id)}
                    type="button"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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
