import type { LessonImageDraft } from '@/lib/contracts/lesson-studio';
import { lessonInputClass } from './FieldError';

interface AssetFieldProps {
  label: string;
  value?: LessonImageDraft;
  accept: string;
  disabled: boolean;
  onUpload: (file: File) => void;
}

export function AssetField({ label, value, accept, disabled, onUpload }: AssetFieldProps) {
  return (
    <label className="block text-xs font-medium">
      {label}
      <span className="studio-glass-control mt-1 block rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
        {value?.originalFilename ?? (value ? 'Uploaded asset' : 'No asset selected')}
        <input accept={accept} className={`${lessonInputClass} mt-2 text-xs`} disabled={disabled} onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onUpload(file);
          event.currentTarget.value = '';
        }} type="file" />
      </span>
    </label>
  );
}
