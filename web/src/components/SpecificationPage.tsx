"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { optimizeSanityImage } from "@/lib/image-optimization";
import { motion } from "framer-motion";
import type { SanitySpecification } from "@/lib/contracts/sanity";

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

  const containerVariants = { 
    hidden: { opacity: 0 }, 
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } } 
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 400, damping: 30 } }
  };

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-background">
      {/* ── Scrollable content area ── */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/* Hero image — full-bleed within the content area */}
        {heroUrl && (
          <motion.div 
            initial={{ opacity: 0, scale: 1.05 }} 
            animate={{ opacity: 1, scale: 1 }} 
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="w-full aspect-4/3 overflow-hidden shrink-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={optimizeSanityImage(heroUrl, 1200)}
              alt={spec.title}
              className="w-full h-full object-cover"
            />
          </motion.div>
        )}

        <motion.div 
          className="max-w-3xl mx-auto w-full px-6 md:px-8 pb-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="pt-6 pb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent mb-2">
              Specifications
            </p>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground leading-tight">
              {spec.title}
            </h1>
            {spec.subtitle && (
              <p className="text-base text-muted-foreground mt-2 leading-relaxed max-w-2xl">
                {spec.subtitle}
              </p>
            )}
          </motion.div>

          {/* Spec groups */}
          <div className="flex flex-col gap-8 mt-4">
            {(spec.specGroups ?? []).map((group, groupIndex) => (
              <motion.section variants={itemVariants} key={groupIndex} aria-label={group.groupName}>
                {/* Group header */}
                <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-4 pb-2 border-b border-border/40">
                  {group.groupName}
                </h2>

                {/* Spec rows */}
                <dl className="flex flex-col">
                  {(group.specs ?? []).map((item, specIndex) => (
                    <div
                      key={specIndex}
                      className={
                        item.highlight
                          ? "bg-accent/10 border border-accent/20 rounded-xl px-4 py-3.5 -mx-4 my-1 shadow-sm flex items-start justify-between gap-4"
                          : "flex items-start justify-between gap-4 py-3.5 border-b border-border/10 last:border-0"
                      }
                    >
                      <dt className="text-sm text-foreground/70 font-medium leading-snug shrink-0 w-[45%]">
                        {item.label}
                      </dt>
                      <dd
                        className={
                          item.highlight 
                            ? "text-sm font-bold text-accent text-right leading-snug" 
                            : "text-sm font-semibold text-foreground text-right leading-snug"
                        }
                      >
                        {item.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </motion.section>
            ))}

            {/* Footnotes */}
            {spec.footnotes && spec.footnotes.length > 0 && (
              <motion.footer variants={itemVariants} className="pt-4 border-t border-border/20 mt-2">
                {spec.footnotes.map((note, i) => (
                  <p
                    key={i}
                    className="text-xs italic text-muted-foreground/60 leading-relaxed mt-2"
                  >
                    {note}
                  </p>
                ))}
              </motion.footer>
            )}

            {/* Bottom scroll padding so last content clears the nav bar */}
            <div className="h-24" aria-hidden="true" />
          </div>
        </motion.div>
      </div>

      {/* ── Navigation bar ── */}
      <motion.nav 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, type: "spring", damping: 25 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center p-1.5 bg-background/70 backdrop-blur-xl border border-border/20 shadow-2xl rounded-full"
      >
        {showPrev && (
          <motion.button 
            whileHover={{ scale: 1.05 }} 
            whileTap={{ scale: 0.95 }} 
            onClick={onPrev} 
            className="h-10 w-10 rounded-full flex items-center justify-center text-foreground hover:bg-foreground/10 transition-colors"
            aria-label="Previous section"
          >
            <ChevronLeft className="h-5 w-5" />
          </motion.button>
        )}
        <motion.button 
          whileHover={{ scale: 1.05 }} 
          whileTap={{ scale: 0.95 }} 
          onClick={onNext} 
          className="h-10 w-10 rounded-full flex items-center justify-center text-foreground hover:bg-foreground/10 transition-colors"
          aria-label="Next section"
        >
          <ChevronRight className="h-5 w-5" />
        </motion.button>
      </motion.nav>
    </div>
  );
}
