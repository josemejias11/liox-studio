'use client';

import { useEffect, useRef, useState } from 'react';
import type { ImageReference } from '@/lib/contracts/course-studio';

interface CourseMediaFieldProps {
  courseId: string;
  disabled?: boolean;
  id: string;
  label: string;
  onChange: (value: ImageReference | undefined) => void;
  onUploadStateChange?: (fieldId: string, uploading: boolean) => void;
  value: ImageReference | undefined;
}

const buttonClass = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-input bg-background px-3 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Uploads an image to the authenticated Studio endpoint without persisting it. */
export function CourseMediaField({
  courseId,
  disabled = false,
  id,
  label,
  onChange,
  onUploadStateChange,
  value,
}: CourseMediaFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const uploadActiveRef = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filename = value?.asset.originalFilename;

  function setUploadActive(next: boolean) {
    uploadActiveRef.current = next;
    setUploading(next);
    onUploadStateChange?.(id, next);
  }

  useEffect(() => () => {
    if (uploadActiveRef.current) onUploadStateChange?.(id, false);
  }, [id, onUploadStateChange]);

  async function upload(file: File) {
    setUploadActive(true);
    setError(null);
    try {
      const data = new FormData();
      data.set('courseId', courseId);
      data.set('file', file);
      const response = await fetch('/api/course-studio/assets', { method: 'POST', body: data });
      const result = await response.json() as {
        asset?: { deliveryUrl?: string; filename?: string };
        error?: string;
      };
      if (!response.ok || !result.asset?.deliveryUrl) {
        throw new Error(result.error || 'Image upload failed.');
      }
      onChange({ asset: { url: result.asset.deliveryUrl, originalFilename: result.asset.filename } });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Image upload failed.');
    } finally {
      setUploadActive(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const locked = disabled || uploading;
  return (
    <section aria-labelledby={`${id}-label`} className="rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-medium" id={`${id}-label`}>{label}</h4>
          {filename && <p className="mt-1 truncate text-xs text-muted-foreground">{filename}</p>}
        </div>
        {value && <div aria-label={`${label} preview`} className="h-16 w-24 rounded-md border border-border bg-cover bg-center" role="img" style={{ backgroundImage: `url(${value.asset.url})` }} />}
      </div>
      <input
        accept="image/*"
        aria-label={`Choose ${label}`}
        className="sr-only"
        disabled={locked}
        id={`${id}-file`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
        ref={inputRef}
        type="file"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button className={buttonClass} disabled={locked} onClick={() => inputRef.current?.click()} type="button">
          {uploading ? 'Uploading image…' : value ? 'Replace image' : 'Upload image'}
        </button>
        {value && <button className={buttonClass} disabled={locked} onClick={() => { setError(null); onChange(undefined); }} type="button">Remove image</button>}
      </div>
      {uploading && <p aria-live="polite" className="mt-2 text-xs text-muted-foreground">Image upload in progress.</p>}
      {error && <p className="mt-2 text-xs text-destructive" role="alert">{error}</p>}
    </section>
  );
}
