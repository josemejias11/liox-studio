import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), ' +
  'textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Traps keyboard focus inside `containerRef` while `active` is true.
 * Restores focus to the previously focused element when deactivated.
 */
export function useFocusTrap(containerRef: { current: HTMLElement | null }, active: boolean) {
  const prevFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    const el = containerRef.current;
    if (!el) return;

    // Remember what was focused before the trap opens
    prevFocusRef.current = document.activeElement as HTMLElement | null;

    // Move focus into the trapped region immediately
    const first = el.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus({ preventScroll: true });

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      if (!containerRef.current) return;

      const focusables = Array.from(containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }

      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus({ preventScroll: true });
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus({ preventScroll: true });
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Return focus to wherever the user was before
      prevFocusRef.current?.focus({ preventScroll: true });
    };
  }, [active, containerRef]);
}
