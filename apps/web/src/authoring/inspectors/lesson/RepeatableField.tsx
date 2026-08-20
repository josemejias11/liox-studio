import type { ReactNode } from 'react';

type ClientKeyed = { clientKey: string };

interface RepeatableFieldActions<T extends ClientKeyed> {
  append: (item?: T) => void;
  move: (clientKey: string, direction: -1 | 1) => void;
  remove: (clientKey: string) => void;
  replace: (clientKey: string, update: (item: T) => T) => void;
}

interface RepeatableFieldProps<T extends ClientKeyed> {
  legend: string;
  addLabel: string;
  items: T[];
  disabled: boolean;
  createItem: () => T;
  onChange: (items: T[]) => void;
  renderBeforeItems?: (actions: RepeatableFieldActions<T>) => ReactNode;
  renderItem: (item: T, index: number, actions: RepeatableFieldActions<T>) => ReactNode;
}

export function RepeatableField<T extends ClientKeyed>({
  legend,
  addLabel,
  items,
  disabled,
  createItem,
  onChange,
  renderBeforeItems,
  renderItem,
}: RepeatableFieldProps<T>) {
  const actions: RepeatableFieldActions<T> = {
    append: (item) => onChange([...items, item ?? createItem()]),
    move: (clientKey, direction) => {
      const index = items.findIndex((item) => item.clientKey === clientKey);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= items.length) return;
      const next = [...items];
      [next[index], next[target]] = [next[target], next[index]];
      onChange(next);
    },
    remove: (clientKey) => onChange(items.filter((item) => item.clientKey !== clientKey)),
    replace: (clientKey, update) =>
      onChange(
        items.map((item) =>
          item.clientKey === clientKey ? { ...update(item), clientKey: item.clientKey } : item,
        ),
      ),
  };

  return (
    <fieldset className="studio-glass-control border-border space-y-3 rounded-xl border p-3">
      <legend className="px-1 text-sm font-semibold">{legend}</legend>
      {renderBeforeItems?.(actions)}
      {items.length === 0 && (
        <p className="text-muted-foreground text-xs">Nothing has been added yet.</p>
      )}
      {items.map((item, index) => (
        <div
          className="studio-glass-panel border-border/70 rounded-lg border p-3"
          key={item.clientKey}
        >
          <div className="mb-3 flex items-center justify-end gap-1">
            <button
              aria-label={`Move ${legend} item ${index + 1} up`}
              className="studio-glass-control hover:bg-muted rounded border px-2 py-1 text-xs disabled:opacity-40"
              disabled={disabled || index === 0}
              onClick={() => actions.move(item.clientKey, -1)}
              type="button"
            >
              ↑
            </button>
            <button
              aria-label={`Move ${legend} item ${index + 1} down`}
              className="studio-glass-control hover:bg-muted rounded border px-2 py-1 text-xs disabled:opacity-40"
              disabled={disabled || index === items.length - 1}
              onClick={() => actions.move(item.clientKey, 1)}
              type="button"
            >
              ↓
            </button>
            <button
              className="studio-glass-control text-destructive hover:bg-destructive/10 rounded border px-2 py-1 text-xs disabled:opacity-40"
              disabled={disabled}
              onClick={() => actions.remove(item.clientKey)}
              type="button"
            >
              Remove
            </button>
          </div>
          {renderItem(item, index, actions)}
        </div>
      ))}
      <button
        className="studio-glass-control border-border hover:border-primary hover:text-primary min-h-11 w-full rounded-lg border border-dashed px-3 py-2 text-xs font-medium disabled:opacity-50"
        disabled={disabled}
        onClick={() => actions.append()}
        type="button"
      >
        + {addLabel}
      </button>
    </fieldset>
  );
}
