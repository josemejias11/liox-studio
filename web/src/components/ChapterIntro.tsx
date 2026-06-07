"use client";

import { useEffect } from "react";
import { motion, type Variants } from "framer-motion";
import { ChevronRight } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface ChapterIntroProps {
  chapterTitle: string;
  chapterNumber: number;
  totalChapters: number;
  onContinue: () => void;
}

// ── Animation variants ─────────────────────────────────────────────────────

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.35, ease: "easeOut" as const, staggerChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: [0.34, 1.15, 0.64, 1] },
  },
};

// ── Component ──────────────────────────────────────────────────────────────

export function ChapterIntro({
  chapterTitle,
  chapterNumber,
  totalChapters,
  onContinue,
}: ChapterIntroProps) {
  // Auto-advance after 4 seconds — users can also tap "Begin" immediately.
  useEffect(() => {
    const timer = setTimeout(onContinue, 4000);
    return () => clearTimeout(timer);
  }, [onContinue]);

  return (
    <motion.div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-primary text-primary-foreground overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      {/* Ambient radial glow — Moto Indigo on the black surface */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(104,91,199,0.12) 0%, transparent 70%)",
        }}
      />

      {/* Decorative ring — reduced-motion collapses this via globals.css */}
      <div
        className="cc-spin absolute w-[340px] h-[340px] rounded-full border border-accent/[0.06]"
        aria-hidden="true"
      />
      <div
        className="cc-spin-rev absolute w-[220px] h-[220px] rounded-full border border-accent/[0.1]"
        aria-hidden="true"
      />

      {/* Content stack */}
      <motion.div
        className="relative z-10 flex flex-col items-center text-center gap-5 px-8 max-w-[300px] w-full"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Chapter counter eyebrow */}
        <motion.p
          variants={itemVariants}
          className="text-[10px] font-bold uppercase tracking-[0.26em] text-primary-foreground/40"
        >
          Chapter {chapterNumber}&thinsp;of&thinsp;{totalChapters}
        </motion.p>

        {/* Chapter title */}
        <motion.h2
          variants={itemVariants}
          className="text-[26px] font-bold leading-tight text-primary-foreground"
        >
          {chapterTitle}
        </motion.h2>

        {/* Accent rule */}
        <motion.span
          variants={itemVariants}
          className="block h-[2px] w-10 rounded-full bg-accent"
          aria-hidden="true"
        />

        {/* Begin button */}
        <motion.button
          variants={itemVariants}
          onClick={onContinue}
          className="flex items-center gap-2 mt-1 px-6 py-3 rounded-full
            bg-accent text-accent-foreground font-semibold text-[13px]
            shadow-[0_0_32px_rgba(104,91,199,0.3)]
            hover:shadow-[0_0_44px_rgba(104,91,199,0.5)]
            hover:scale-105 active:scale-95
            transition-all duration-200
            focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Begin
          <ChevronRight className="h-4 w-4" />
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
