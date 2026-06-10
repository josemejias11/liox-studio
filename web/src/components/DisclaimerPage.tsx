"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, CheckCircle2 } from "lucide-react";
import { PortableText } from "@portabletext/react";
import { motion } from "framer-motion";
import type { SanityDisclaimer } from "@/lib/contracts/sanity";

type DisclaimerCategory = NonNullable<SanityDisclaimer["category"]>;

interface DisclaimerPageProps {
  disclaimer: SanityDisclaimer;
  onNext: () => void;
}

// ── Category display labels ────────────────────────────────────────────────

const CATEGORY_LABELS: Record<DisclaimerCategory, string> = {
  legal: "Legal",
  safety: "Safety",
  regulatory: "Regulatory",
  warranty: "Warranty",
  general: "Notice",
};

// ── Component ──────────────────────────────────────────────────────────────

export function DisclaimerPage({ disclaimer, onNext }: DisclaimerPageProps) {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const requiresAck = disclaimer.acknowledgementRequired === true;
  const ackLabel = disclaimer.acknowledgementLabel ?? "I Acknowledge";
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
      { root: scrollEl, threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [requiresAck]);

  const canProceed = !requiresAck || hasScrolledToBottom;

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 400, damping: 30 } },
  };

  return (
    <motion.div 
      initial="hidden" 
      animate="visible" 
      variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } }}
      className="absolute inset-0 flex flex-col overflow-hidden bg-background"
    >
      {/* ── Scrollable body ── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain"
      >
        <div className="max-w-3xl mx-auto w-full px-6 md:px-8 pt-8 md:pt-12">
          {/* ── Category eyebrow + title header ── */}
          <motion.header variants={itemVariants} className="shrink-0 pb-6 md:pb-8">
            <span className="inline-flex text-xs font-semibold uppercase tracking-[0.2em] text-accent bg-accent/10 px-3 py-1 rounded-full mb-3">
              {categoryLabel}
            </span>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground leading-tight">
              {disclaimer.title}
            </h1>
            {requiresAck && !hasScrolledToBottom && (
              <p className="text-xs font-medium text-muted-foreground/80 mt-2">
                Scroll to the bottom to acknowledge.
              </p>
            )}
          </motion.header>

          {/* PortableText body */}
          <motion.div variants={itemVariants} className="prose prose-sm md:prose-base dark:prose-invert prose-p:text-muted-foreground prose-headings:text-foreground prose-a:text-accent prose-strong:text-foreground max-w-none leading-relaxed">
            <PortableText value={disclaimer.body} />
          </motion.div>

          {/* Scroll sentinel — IntersectionObserver target */}
          <div ref={sentinelRef} aria-hidden="true" className="h-px w-full mt-2" />

          {/* Bottom padding so content clears the nav */}
          <div className="h-28" aria-hidden="true" />
        </div>
      </div>

      {/* ── Floating Glassmorphic Nav & Action Pill ── */}
      <motion.nav 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, type: "spring", damping: 25 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 p-1.5 bg-background/70 backdrop-blur-xl border border-border/20 shadow-2xl rounded-full"
      >

        {/* Acknowledge / Continue Button */}
        {requiresAck ? (
          <motion.button
            whileHover={canProceed ? { scale: 1.02 } : {}}
            whileTap={canProceed ? { scale: 0.98 } : {}}
            onClick={onNext}
            disabled={!canProceed}
            className={`flex items-center justify-center gap-2 px-6 h-10 rounded-full text-sm font-semibold transition-colors duration-300 ${
              canProceed
                ? "bg-accent text-accent-foreground shadow-[0_0_24px_rgba(104,91,199,0.3)]"
                : "bg-foreground/10 text-foreground/40 cursor-not-allowed"
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
            className="flex items-center justify-center gap-2 px-6 h-10 rounded-full text-sm font-semibold bg-foreground/10 text-foreground hover:bg-foreground/15 transition-colors"
          >
            End Course <ChevronRight className="h-4 w-4 shrink-0" />
          </motion.button>
        )}
      </motion.nav>
    </motion.div>
  );
}
