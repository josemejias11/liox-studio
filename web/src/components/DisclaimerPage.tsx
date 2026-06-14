'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronRight, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import type { SanityDisclaimer } from '@/lib/contracts/sanity';

type DisclaimerCategory = NonNullable<SanityDisclaimer['category']>;

interface DisclaimerPageProps {
  disclaimer: SanityDisclaimer;
  onNext: () => void;
}

// ── Category display labels ────────────────────────────────────────────────

const CATEGORY_LABELS: Record<DisclaimerCategory, string> = {
  legal: 'Legal',
  safety: 'Safety',
  regulatory: 'Regulatory',
  warranty: 'Warranty',
  general: 'Notice',
};

// ── Component ──────────────────────────────────────────────────────────────

export function DisclaimerPage({ disclaimer, onNext }: DisclaimerPageProps) {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const requiresAck = disclaimer.acknowledgementRequired === true;
  const ackLabel = disclaimer.acknowledgementLabel ?? 'I Acknowledge';
  const categoryLabel = disclaimer.category
    ? CATEGORY_LABELS[disclaimer.category]
    : CATEGORY_LABELS.general;

  // ── Scroll-to-bottom detection via IntersectionObserver ──
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const scrollEl = scrollRef.current;

    if (!sentinel || !scrollEl || !requiresAck) {
      // If acknowledgement not required, no observer needed.
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasScrolledToBottom(true);
          observer.disconnect();
        }
      },
      { root: scrollEl, threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [requiresAck]);

  const canProceed = !requiresAck || hasScrolledToBottom;

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring' as const, stiffness: 400, damping: 30 },
    },
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
      }}
      className="bg-background absolute inset-0 flex flex-col overflow-hidden"
    >
      {/* ── Scrollable body ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-3xl px-6 pt-8 md:px-8 md:pt-12">
          {/* ── Category eyebrow + title header ── */}
          <motion.header variants={itemVariants} className="shrink-0 pb-6 md:pb-8">
            <span className="text-accent bg-accent/10 mb-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-[0.2em] uppercase">
              {categoryLabel}
            </span>
            <h1 className="text-foreground text-3xl leading-tight font-bold tracking-tight md:text-4xl">
              {disclaimer.title}
            </h1>
            {requiresAck && !hasScrolledToBottom && (
              <p className="text-muted-foreground mt-2 text-sm font-medium">
                Scroll to the bottom to acknowledge.
              </p>
            )}
          </motion.header>

          {/* Intro body paragraph */}
          <motion.div variants={itemVariants}>
            <p className="text-muted-foreground text-base leading-relaxed">{disclaimer.body}</p>
          </motion.div>

          {/* Numbered disclaimers list */}
          {disclaimer.disclaimers && disclaimer.disclaimers.length > 0 && (
            <motion.div variants={itemVariants} className="mt-6">
              <ol className="list-decimal list-outside space-y-3 pl-6">
                {disclaimer.disclaimers.map((item, i) => (
                  <li key={i} className="text-muted-foreground leading-relaxed">
                    {item}
                  </li>
                ))}
              </ol>
            </motion.div>
          )}

          {/* Scroll sentinel — IntersectionObserver target */}
          <div ref={sentinelRef} aria-hidden="true" className="mt-2 h-px w-full" />

          {/* Bottom padding so content clears the nav */}
          <div className="h-28" aria-hidden="true" />
        </div>
      </div>

      {/* ── Floating Glassmorphic Nav & Action Pill ── */}
      <motion.nav
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, type: 'spring', damping: 25 }}
        className="bg-background/70 border-border/20 absolute right-4 bottom-4 z-20 flex items-center gap-2 rounded-full border p-1.5 shadow-2xl backdrop-blur-xl md:right-8 md:bottom-8"
      >
        {/* Acknowledge / Continue Button */}
        {requiresAck ? (
          <motion.button
            whileHover={canProceed ? { scale: 1.02 } : {}}
            whileTap={canProceed ? { scale: 0.98 } : {}}
            onClick={onNext}
            disabled={!canProceed}
            className={`flex h-10 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold transition-colors duration-300 ${
              canProceed
                ? 'bg-accent text-accent-foreground shadow-[0_0_24px_rgba(104,91,199,0.3)]'
                : 'bg-foreground/20 text-foreground/60 cursor-not-allowed'
            }`}
          >
            {canProceed && <CheckCircle2 className="h-4 w-4 shrink-0" />}
            {ackLabel}
          </motion.button>
        ) : (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onNext}
            className="bg-foreground text-background hover:bg-foreground/90 flex h-10 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold shadow-xl transition-transform duration-150 active:scale-95"
          >
            End Course <ChevronRight className="h-4 w-4 shrink-0" />
          </motion.button>
        )}
      </motion.nav>
    </motion.div>
  );
}
