import type { ReactNode } from 'react';

interface RepeatableFieldProps<T> {
  legend: string;
  addLabel: string;
  items: T[];
  disabled: boolean;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  renderItem: (item: T, index: number) => ReactNode;
}

export function RepeatableField<T>({ legend, addLabel, items, disabled, onAdd, onRemove, onMove, renderItem }: RepeatableFieldProps<T>) {
  return (
    <fieldset className="space-y-3 rounded-xl border border-border p-3">
      <legend className="px-1 text-sm font-semibold">{legend}</legend>
      {items.length === 0 && <p className="text-xs text-muted-foreground">Nothing has been added yet.</p>}
      {items.map((item, index) => (
        <div className="rounded-lg border border-border/70 p-3" key={index}>
          <div className="mb-3 flex items-center justify-end gap-1">
            <button aria-label={`Move ${legend} item ${index + 1} up`} className="rounded px-2 py-1 text-xs hover:bg-muted disabled:opacity-40" disabled={disabled || index === 0} onClick={() => onMove(index, -1)} type="button">↑</button>
            <button aria-label={`Move ${legend} item ${index + 1} down`} className="rounded px-2 py-1 text-xs hover:bg-muted disabled:opacity-40" disabled={disabled || index === items.length - 1} onClick={() => onMove(index, 1)} type="button">↓</button>
            <button className="rounded px-2 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-40" disabled={disabled} onClick={() => onRemove(index)} type="button">Remove</button>
          </div>
          {renderItem(item, index)}
        </div>
      ))}
      <button className="min-h-11 w-full rounded-lg border border-dashed border-border px-3 py-2 text-xs font-medium hover:border-primary hover:text-primary disabled:opacity-50" disabled={disabled} onClick={onAdd} type="button">+ {addLabel}</button>
    </fieldset>
  );
}

