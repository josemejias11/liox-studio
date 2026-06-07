"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

// ── Types aligned with GROQ SPEC_FIELDS output ─────────────────────────────

interface SanitySpecItem {
  label: string;
  value: string;
  highlight?: boolean;
}

interface SanitySpecGroup {
  groupName: string;
  specs: SanitySpecItem[];
}

export interface SanitySpecification {
  _key?: string;
  sectionType: "specification";
  title: string;
  subtitle?: string;
  heroImage?: { asset?: { url?: string } };
  specGroups: SanitySpecGroup[];
  footnotes?: string[];
}

interface SpecificationPageProps {
  spec: SanitySpecification;
  onNext: () => void;
  onPrev: () => void;
  showPrev: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────

export function SpecificationPage({
  spec,
  onNext,
  onPrev,
  showPrev,
}: SpecificationPageProps) {
  const heroUrl = spec.heroImage?.asset?.url;

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-background">
      {/* ── Scrollable content area ── */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/* Hero image — full-bleed within the content area */}
        {heroUrl && (
          <div className="w-full aspect-[4/3] overflow-hidden shrink-0">
            <img
              src={heroUrl}
              alt={spec.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-accent mb-1">
            Specifications
          </p>
          <h1 className="text-[22px] font-bold leading-tight text-foreground">
            {spec.title}
          </h1>
          {spec.subtitle && (
            <p className="mt-1 text-sm text-muted-foreground leading-snug">
              {spec.subtitle}
            </p>
          )}
        </div>

        {/* Spec groups */}
        <div className="px-5 pb-4 flex flex-col gap-5">
          {spec.specGroups.map((group, groupIndex) => (
            <section key={groupIndex} aria-label={group.groupName}>
              {/* Group header */}
              <h2 className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2 pb-2 border-b border-border/30">
                {group.groupName}
              </h2>

              {/* Spec rows */}
              <dl className="flex flex-col gap-px">
                {group.specs.map((item, specIndex) => (
                  <div
                    key={specIndex}
                    className={[
                      "flex items-start justify-between gap-4 py-2.5 px-3 rounded-lg",
                      item.highlight
                        ? "bg-accent/8 ring-1 ring-accent/15"
                        : "even:bg-foreground/[0.025]",
                    ].join(" ")}
                  >
                    <dt className="text-[12px] text-muted-foreground leading-snug shrink-0 max-w-[45%]">
                      {item.label}
                    </dt>
                    <dd
                      className={[
                        "text-[12px] font-semibold text-right leading-snug",
                        item.highlight ? "text-accent" : "text-foreground",
                      ].join(" ")}
                    >
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}

          {/* Footnotes */}
          {spec.footnotes && spec.footnotes.length > 0 && (
            <footer className="pt-2 border-t border-border/20">
              {spec.footnotes.map((note, i) => (
                <p
                  key={i}
                  className="text-[10px] italic text-muted-foreground/70 leading-relaxed"
                >
                  {note}
                </p>
              ))}
            </footer>
          )}

          {/* Bottom scroll padding so last content clears the nav bar */}
          <div className="h-16" aria-hidden="true" />
        </div>
      </div>

      {/* ── Bottom vignette ── */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background to-transparent pointer-events-none z-10" />

      {/* ── Navigation bar ── */}
      <nav
        aria-label="Section navigation"
        className="absolute bottom-0 left-0 right-0 h-14 z-20 flex items-center justify-end px-6 gap-1 bg-gradient-to-t from-background via-background/80 to-transparent"
      >
        {showPrev && (
          <button
            onClick={onPrev}
            className="h-10 w-10 rounded-full flex items-center justify-center text-foreground/60 hover:text-foreground hover:bg-foreground/10 transition-all"
            aria-label="Previous section"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        <button
          onClick={onNext}
          className="h-10 w-10 rounded-full flex items-center justify-center text-foreground/60 hover:text-foreground hover:bg-foreground/10 transition-all"
          aria-label="Next section"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </nav>
    </div>
  );
}
