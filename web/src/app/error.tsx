'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global Error:', error);
  }, [error]);

  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="bg-card border-border flex w-full max-w-md flex-col items-center gap-6 rounded-3xl border p-8 shadow-2xl">
        <div className="bg-destructive/10 text-destructive mb-2 flex h-16 w-16 items-center justify-center rounded-full">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h2 className="text-foreground text-2xl font-bold">Something went wrong!</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <button
          onClick={() => reset()}
          className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 flex items-center gap-2 rounded-full px-6 py-3 font-semibold transition-colors active:scale-95"
        >
          <RefreshCcw className="h-4 w-4" />
          Try Again
        </button>
      </div>
    </div>
  );
}
