'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { CourseDisclaimer } from '@/shared/contracts/player-course';

type DisclaimerCategory = NonNullable<CourseDisclaimer['category']>;

interface DisclaimerPageProps {
  disclaimer: CourseDisclaimer;
  onNext: () => void;
  onCanProceedChange?: (canProceed: boolean) => void;
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

export function DisclaimerPage({ disclaimer, onCanProceedChange }: DisclaimerPageProps) {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const requiresAck = disclaimer.acknowledgementRequired === true;
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

  useEffect(() => {
    onCanProceedChange?.(canProceed);
  }, [canProceed, onCanProceedChange]);

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

          {/* Bottom padding so content clears LessonFrame's nav bar */}
          <div className="h-28" aria-hidden="true" />
        </div>
      </div>
    </motion.div>
  );
}
