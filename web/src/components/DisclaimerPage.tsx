"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { PortableText } from "@portabletext/react";

// ── Types aligned with GROQ DISCLAIMER_FIELDS output ──────────────────────

type DisclaimerCategory = "legal" | "safety" | "regulatory" | "warranty" | "general";

export interface SanityDisclaimer {
  _key?: string;
  sectionType: "disclaimer";
  title: string;
  category?: DisclaimerCategory;
  body: Parameters<typeof PortableText>[0]["value"];
  acknowledgementRequired?: boolean;
  acknowledgementLabel?: string;
}

interface DisclaimerPageProps {
  disclaimer: SanityDisclaimer;
  onNext: () => void;
  onPrev: () => void;
  showPrev: boolean;
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

export function DisclaimerPage({
  disclaimer,
  onNext,
  onPrev,
  showPrev,
}: DisclaimerPageProps) {
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

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-background">
      {/* ── Category eyebrow + title header ── */}
      <header className="shrink-0 px-5 pt-5 pb-4 border-b border-border/20">
        <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[0.2em] bg-foreground/8 text-foreground/50 mb-2">
          {categoryLabel}
        </span>
        <h1 className="text-[18px] font-bold leading-snug text-foreground">
          {disclaimer.title}
        </h1>
        {requiresAck && !hasScrolledToBottom && (
          <p className="mt-1.5 text-[10px] text-muted-foreground/70">
            Scroll to the bottom to acknowledge.
          </p>
        )}
      </header>

      {/* ── Scrollable body ── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain px-5 py-4"
      >
        {/* PortableText body */}
        <div className="prose prose-sm max-w-none text-foreground/80 leading-relaxed [&_p]:mb-3 [&_strong]:text-foreground [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:mb-1 [&_h2]:text-[14px] [&_h2]:font-bold [&_h2]:text-foreground [&_h2]:mt-4 [&_h2]:mb-2">
          <PortableText value={disclaimer.body} />
        </div>

        {/* Scroll sentinel — IntersectionObserver target */}
        <div ref={sentinelRef} aria-hidden="true" className="h-px w-full mt-2" />

        {/* Bottom padding so content clears the nav */}
        <div className="h-20" aria-hidden="true" />
      </div>

      {/* ── Bottom vignette ── */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent pointer-events-none z-10" />

      {/* ── Navigation / acknowledgement bar ── */}
      <nav
        aria-label="Section navigation"
        className="absolute bottom-0 left-0 right-0 h-16 z-20 flex items-center justify-between px-5 gap-3 bg-gradient-to-t from-background via-background/90 to-transparent"
      >
        {/* Prev button */}
        {showPrev ? (
          <button
            onClick={onPrev}
            className="h-10 w-10 rounded-full flex items-center justify-center text-foreground/60 hover:text-foreground hover:bg-foreground/10 transition-all"
            aria-label="Previous section"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        ) : (
          <div className="w-10" aria-hidden="true" />
        )}

        {/* Acknowledge / Continue button */}
        {requiresAck ? (
          <button
            onClick={onNext}
            disabled={!canProceed}
            aria-disabled={!canProceed}
            className={[
              "flex items-center gap-2 px-5 py-2.5 rounded-full text-[12px] font-semibold transition-all duration-300",
              canProceed
                ? "bg-accent text-accent-foreground shadow-[0_0_20px_rgba(104,91,199,0.25)] hover:shadow-[0_0_28px_rgba(104,91,199,0.4)] active:scale-95"
                : "bg-foreground/10 text-foreground/30 cursor-not-allowed",
            ].join(" ")}
          >
            {canProceed && <CheckCircle2 className="h-4 w-4 shrink-0" />}
            {ackLabel}
          </button>
        ) : (
          <button
            onClick={onNext}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-full text-[12px] font-semibold bg-foreground/8 text-foreground hover:bg-foreground/15 active:scale-95 transition-all duration-150"
            aria-label="Continue to next section"
          >
            Continue
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        {/* Right spacer — balances the layout when there is no prev button */}
        {!showPrev && <div className="w-10" aria-hidden="true" />}
      </nav>
    </div>
  );
}
