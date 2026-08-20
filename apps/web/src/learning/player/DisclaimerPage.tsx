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

const CATEGORY_LABELS: Record<DisclaimerCategory, string> = {
  legal: 'Legal',
  safety: 'Safety',
  regulatory: 'Regulatory',
  warranty: 'Warranty',
  general: 'Notice',
};

export function DisclaimerPage({ disclaimer, onCanProceedChange }: DisclaimerPageProps) {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const requiresAck = disclaimer.acknowledgementRequired === true;
  const acknowledgementLabel =
    disclaimer.acknowledgementLabel || 'I acknowledge and understand this notice.';
  const categoryLabel = disclaimer.category
    ? CATEGORY_LABELS[disclaimer.category]
    : CATEGORY_LABELS.general;
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const scrollEl = scrollRef.current;

    if (!sentinel || !scrollEl || !requiresAck) {
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

  const canProceed = !requiresAck || (hasScrolledToBottom && hasAcknowledged);

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
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-3xl px-6 pt-8 md:px-8 md:pt-12">
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
          <motion.div variants={itemVariants}>
            <p className="text-muted-foreground text-base leading-relaxed">{disclaimer.body}</p>
          </motion.div>
          {disclaimer.disclaimers && disclaimer.disclaimers.length > 0 && (
            <motion.div variants={itemVariants} className="mt-6">
              <ol className="list-outside list-decimal space-y-3 pl-6">
                {disclaimer.disclaimers.map((item, i) => (
                  <li key={i} className="text-muted-foreground leading-relaxed">
                    {item}
                  </li>
                ))}
              </ol>
            </motion.div>
          )}
          <div ref={sentinelRef} aria-hidden="true" className="mt-2 h-px w-full" />
          {requiresAck && (
            <motion.label
              variants={itemVariants}
              className="border-border bg-card text-foreground mt-6 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium"
            >
              <input
                checked={hasAcknowledged}
                onChange={(event) => setHasAcknowledged(event.target.checked)}
                type="checkbox"
              />
              {acknowledgementLabel}
            </motion.label>
          )}
          <div className="h-28" aria-hidden="true" />
        </div>
      </div>
    </motion.div>
  );
}
