'use client';

import { useRef } from 'react';

export interface StringListItem {
  clientKey: string;
  value: string;
}

interface StringListFieldProps {
  addLabel: string;
  disabled?: boolean;
  emptyMessage: string;
  errors?: Record<string, string | undefined>;
  itemLabel: string;
  items: StringListItem[];
  legend: string;
  onChange: (items: StringListItem[]) => void;
}

const controlClass = 'studio-glass-control inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-input px-2 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const inputClass = 'studio-glass-control w-full rounded-lg border border-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

function move<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}


export function StringListField({
  addLabel,
  disabled = false,
  emptyMessage,
  errors = {},
  itemLabel,
  items,
  legend,
  onChange,
}: StringListFieldProps) {
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const addRef = useRef<HTMLButtonElement | null>(null);
  const liveRef = useRef<HTMLParagraphElement | null>(null);

  function announce(message: string) {
    if (liveRef.current) liveRef.current.textContent = '';
    requestAnimationFrame(() => {
      if (liveRef.current) liveRef.current.textContent = message;
    });
  }

  function focusItem(clientKey: string) {
    requestAnimationFrame(() => inputRefs.current[clientKey]?.focus());
  }

  function add() {
    const item: StringListItem = { clientKey: crypto.randomUUID(), value: '' };
    onChange([...items, item]);
    focusItem(item.clientKey);
    announce(`${itemLabel} ${items.length + 1} added.`);
  }

  function remove(index: number) {
    const next = items.filter((_, itemIndex) => itemIndex !== index);
    onChange(next);
    const target = next[index] ?? next[index - 1];
    requestAnimationFrame(() => {
      if (target) inputRefs.current[target.clientKey]?.focus();
      else addRef.current?.focus();
    });
    announce(`${itemLabel} ${index + 1} removed.`);
  }

  function reorder(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= items.length) return;
    const item = items[index];
    onChange(move(items, index, destination));
    focusItem(item.clientKey);
    announce(`${itemLabel} moved to position ${destination + 1}.`);
  }

  return (
    <fieldset className="studio-glass-control space-y-3 rounded-xl border border-border p-3">
      <legend className="px-1 text-sm font-semibold">{legend}</legend>
      <p aria-live="polite" className="sr-only" ref={liveRef} />
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ol className="space-y-3">
          {items.map((item, index) => {
            const error = errors[item.clientKey];
            const errorId = `${item.clientKey}-error`;
            return (
              <li className="studio-glass-panel rounded-lg border border-border p-3" key={item.clientKey}>
                <div className="flex items-start gap-2">
                  <span aria-hidden="true" className="mt-2.5 w-5 text-right text-xs font-semibold text-muted-foreground">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <label className="sr-only" htmlFor={`${item.clientKey}-input`}>{`${itemLabel} ${index + 1}`}</label>
                    <input
                      aria-describedby={error ? errorId : undefined}
                      aria-invalid={Boolean(error)}
                      className={inputClass}
                      disabled={disabled}
                      id={`${item.clientKey}-input`}
                      onChange={(event) => onChange(items.map((current) => current.clientKey === item.clientKey ? { ...current, value: event.target.value } : current))}
                      ref={(element) => { inputRefs.current[item.clientKey] = element; }}
                      value={item.value}
                    />
                    {error && <p className="mt-1 text-xs text-destructive" id={errorId}>{error}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button aria-label={`Move ${itemLabel.toLowerCase()} ${index + 1} up`} className={controlClass} disabled={disabled || index === 0} onClick={() => reorder(index, -1)} type="button">↑</button>
                    <button aria-label={`Move ${itemLabel.toLowerCase()} ${index + 1} down`} className={controlClass} disabled={disabled || index === items.length - 1} onClick={() => reorder(index, 1)} type="button">↓</button>
                    <button aria-label={`Remove ${itemLabel.toLowerCase()} ${index + 1}`} className={controlClass} disabled={disabled} onClick={() => remove(index)} type="button">Remove</button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <button className={controlClass} disabled={disabled} onClick={add} ref={addRef} type="button">{addLabel}</button>
    </fieldset>
  );
}
