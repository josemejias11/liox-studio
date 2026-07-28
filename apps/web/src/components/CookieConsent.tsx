'use client';

import { useEffect, useState } from 'react';
import { X, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { getConsent, setConsent } from '@/lib/consent';

export function CookieConsent() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const isCourseStudio = pathname === '/studio' || pathname.startsWith('/studio/');

  useEffect(() => {
    if (isCourseStudio) return;

    // Check if the user has already made a choice
    if (getConsent() === 'unset') {
      // Delay showing it slightly for a smoother entry
      const timer = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [isCourseStudio]);

  function handleAccept() {
    setConsent('accepted');
    setShow(false);
  }

  function handleDecline() {
    // Declining clears any persisted session id and keeps all future
    // session/progress state in memory only (see lib/consent.ts).
    setConsent('declined');
    setShow(false);
  }

  if (isCourseStudio) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed right-4 bottom-4 left-4 z-9999 md:right-auto md:bottom-8 md:left-8 md:max-w-sm"
        >
          <div className="bg-card border-border flex flex-col gap-4 rounded-2xl border p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="bg-accent/20 mt-0.5 shrink-0 rounded-full p-2">
                <ShieldCheck className="text-accent h-5 w-5" />
              </div>
              <div>
                <h3 className="text-foreground mb-1 text-sm font-semibold">Your Privacy</h3>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  We use an anonymous local identifier to securely save your interactive lesson
                  progress across sessions. No personal data is stored.
                </p>
              </div>
              <button
                onClick={handleDecline}
                className="text-muted-foreground hover:text-foreground -mt-2 -mr-2 rounded-lg p-1 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex w-full gap-2 pt-2">
              <button
                onClick={handleDecline}
                className="bg-background border-border text-muted-foreground hover:text-foreground hover:bg-accent/10 flex-1 rounded-lg border py-2 text-xs font-medium transition-colors"
              >
                Decline
              </button>
              <button
                onClick={handleAccept}
                className="bg-accent text-accent-foreground shadow-accent/20 flex-1 rounded-lg py-2 text-xs font-semibold shadow-md transition-all hover:brightness-110 active:scale-95"
              >
                Accept
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
