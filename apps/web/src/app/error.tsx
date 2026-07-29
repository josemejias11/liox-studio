'use client';

import { useEffect } from 'react';

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
        <h2 className="text-foreground text-2xl font-bold">Something went wrong!</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <button
          onClick={() => reset()}
          className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 rounded-full px-6 py-3 font-semibold transition-colors active:scale-95"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
