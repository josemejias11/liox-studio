'use client';

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';

interface PersistentPanelSizeOptions {
  key: string;
  defaultValue: number;
  minimum: number;
  maximum: number;
  restoreWhen?: boolean;
}

function clamp(value: number, minimum: number, maximum: number): number {
  const safeMaximum = Math.max(minimum, maximum);
  return Math.min(safeMaximum, Math.max(minimum, value));
}

function readStoredSize(key: string, defaultValue: number, minimum: number, maximum: number): number {
  if (typeof window === 'undefined') return clamp(defaultValue, minimum, maximum);

  try {
    const storedValue = window.localStorage.getItem(key);
    if (storedValue !== null) {
      const parsedValue: unknown = JSON.parse(storedValue);
      if (typeof parsedValue === 'number' && Number.isFinite(parsedValue)) {
        return clamp(parsedValue, minimum, maximum);
      }
    }
  } catch {
    // Local storage may be unavailable or contain malformed legacy values.
  }

  return clamp(defaultValue, minimum, maximum);
}

export function usePersistentPanelSize({
  key,
  defaultValue,
  minimum,
  maximum,
  restoreWhen = true,
}: PersistentPanelSizeOptions): [number, Dispatch<SetStateAction<number>>] {
  const [size, setSize] = useState(() => clamp(defaultValue, minimum, maximum));
  const [restoredKey, setRestoredKey] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !restoreWhen || restoredKey === key) return;

    const animationFrame = window.requestAnimationFrame(() => {
      setSize(readStoredSize(key, defaultValue, minimum, maximum));
      setRestoredKey(key);
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [defaultValue, key, maximum, minimum, restoreWhen, restoredKey]);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      setSize((current) => clamp(current, minimum, maximum));
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [maximum, minimum]);

  const clampedSize = clamp(size, minimum, maximum);

  useEffect(() => {
    if (typeof window === 'undefined' || restoredKey !== key) return;

    try {
      window.localStorage.setItem(key, JSON.stringify(clampedSize));
    } catch {
      // Persistence is a convenience; resizing must still work when storage fails.
    }
  }, [clampedSize, key, restoredKey]);

  const setPersistentSize = useCallback<Dispatch<SetStateAction<number>>>((nextSize) => {
    setSize((current) => {
      const resolvedSize = typeof nextSize === 'function' ? nextSize(current) : nextSize;
      return clamp(resolvedSize, minimum, maximum);
    });
  }, [maximum, minimum]);

  return [clampedSize, setPersistentSize];
}
