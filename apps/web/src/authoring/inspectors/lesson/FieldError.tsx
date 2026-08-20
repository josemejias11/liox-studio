export const lessonInputClass =
  'studio-glass-control mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';
export const lessonTextareaClass = `${lessonInputClass} min-h-20 resize-y`;

export function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-destructive mt-1 text-xs">{message}</p> : null;
}

export function fieldError(errors: Record<string, string>, path: string) {
  return errors[path];
}
