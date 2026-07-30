'use client';

import { useRef, useState } from 'react';
import type { LessonImageDraft } from '@/lib/contracts/lesson-studio';

interface AssetCollectionFieldProps {
  courseId: string;
  accept: string;
  value: LessonImageDraft[];
  onChange: (value: LessonImageDraft[]) => void;
  disabled?: boolean;
  label?: string;
  maxItems?: number;
}

const MAX_ASSET_BYTES = 50 * 1024 * 1024;
const buttonClass = 'studio-glass-control inline-flex min-h-11 items-center justify-center rounded-lg border border-input px-3 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function accepts(file: File, accept: string) {
  return accept.split(',').map((entry) => entry.trim()).some((entry) => {
    if (entry.endsWith('/*')) return file.type.startsWith(entry.slice(0, -1));
    return entry === file.type;
  });
}

/** Uploads one or more existing nested asset references; it never creates a new media payload type. */
export function AssetCollectionField({ courseId, accept, value, onChange, disabled = false, label = 'Assets', maxItems }: AssetCollectionFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canAdd = !maxItems || value.length < maxItems;

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files).slice(0, maxItems ? Math.max(maxItems - value.length, 0) : undefined);
    const invalid = selected.find((file) => file.size > MAX_ASSET_BYTES || !accepts(file, accept));
    if (invalid) {
      setError(invalid.size > MAX_ASSET_BYTES ? 'Assets must be 50 MB or smaller.' : `“${invalid.name}” does not match the accepted media type.`);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const assets = await Promise.all(selected.map(async (file) => {
        const data = new FormData();
        data.set('courseId', courseId);
        data.set('file', file);
        const response = await fetch('/api/course-studio/assets', { method: 'POST', body: data });
        const result = await response.json() as { asset?: { deliveryUrl?: string; filename?: string }; error?: string };
        if (!response.ok || !result.asset?.deliveryUrl) throw new Error(result.error || 'Asset upload failed.');
        return { url: result.asset.deliveryUrl, originalFilename: result.asset.filename };
      }));
      onChange([...value, ...assets]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Asset upload failed.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return <section className="studio-glass-control rounded-lg border border-border p-3" aria-label={label}>
    <div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold">{label}</p><span className="text-[11px] text-muted-foreground">{value.length}{maxItems ? ` / ${maxItems}` : ''}</span></div>
    {value.length > 0 && <ul className="mt-2 space-y-1">{value.map((asset, index) => <li className="flex min-h-11 items-center justify-between gap-2 rounded-md bg-muted/50 px-2 text-xs" key={`${asset.url}-${index}`}><span className="min-w-0 truncate">{asset.originalFilename ?? 'Uploaded asset'}</span><button className="rounded px-2 py-1 text-destructive hover:bg-destructive/10" disabled={disabled || uploading} onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))} type="button">Remove</button></li>)}</ul>}
    <input accept={accept} className="sr-only" disabled={disabled || uploading || !canAdd} multiple={!maxItems || maxItems > 1} onChange={(event) => void upload(event.target.files)} ref={inputRef} type="file" />
    <button className={`${buttonClass} mt-3`} disabled={disabled || uploading || !canAdd} onClick={() => inputRef.current?.click()} type="button">{uploading ? 'Uploading…' : `Add ${label.toLowerCase()}`}</button>
    {uploading && <p aria-live="polite" className="mt-2 text-xs text-muted-foreground">Upload in progress.</p>}
    {error && <p className="mt-2 text-xs text-destructive" role="alert">{error}</p>}
  </section>;
}
