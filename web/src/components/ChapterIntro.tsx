"use client";

import { useEffect, useRef, useState } from "react";
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
  chapterNumber: _chapterNumber,
  totalChapters: _totalChapters,
  onContinue,
}: ChapterIntroProps) {
  const [barWidth, setBarWidth] = useState(0);
  const pausedRef = useRef(false);
  const elapsedRef = useRef(0);
  const lastTsRef = useRef<number | null>(null);
  const onContinueRef = useRef(onContinue);
  useEffect(() => { onContinueRef.current = onContinue; }, [onContinue]);

  // Pauseable progress bar: 8-second auto-advance, paused on hover/focus
  useEffect(() => {
    const DURATION = 8000;
    let raf: number;
    function tick(ts: number) {
      if (lastTsRef.current !== null && !pausedRef.current) {
        elapsedRef.current += ts - lastTsRef.current;
      }
      lastTsRef.current = ts;
      const pct = Math.min((elapsedRef.current / DURATION) * 100, 100);
      setBarWidth(pct);
      if (pct < 100) {
        raf = requestAnimationFrame(tick);
      } else {
        onContinueRef.current();
      }
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-primary text-primary-foreground overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
      onFocus={() => { pausedRef.current = true; }}
      onBlur={() => { pausedRef.current = false; }}
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
        className="cc-spin absolute w-85 h-85 rounded-full border border-accent/6"
        aria-hidden="true"
      />
      <div
        className="cc-spin-rev absolute w-55 h-55 rounded-full border border-accent/10"
        aria-hidden="true"
      />

      {/* Content stack */}
      <motion.div
        className="relative z-10 flex flex-col items-center text-center gap-5 px-8 max-w-75 w-full"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Course eyebrow */}
        <motion.p
          variants={itemVariants}
          className="text-[10px] font-bold uppercase tracking-[0.26em] text-primary-foreground/40"
        >
          Course
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
          className="block h-0.5 w-10 rounded-full bg-accent"
          aria-hidden="true"
        />

        {/* Begin button */}
        <motion.button
          variants={itemVariants}
          onClick={onContinue}
          whileHover={{
            scale: 1.03,
            boxShadow: "0px 8px 32px rgba(104, 91, 199, 0.4)",
            transition: { type: "spring", stiffness: 400, damping: 25 }
          }}
          whileTap={{
            scale: 0.96,
            boxShadow: "0px 4px 16px rgba(104, 91, 199, 0.2)",
            transition: { type: "spring", stiffness: 400, damping: 25 }
          }}
          className="group flex items-center gap-2 mt-1 px-6 py-3 rounded-full
            bg-accent text-accent-foreground font-semibold text-[13px]
            shadow-[0_0_24px_rgba(104,91,199,0.25)]
            focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Begin
          <ChevronRight className="h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-x-0.5" />
        </motion.button>
      </motion.div>

      {/* Pauseable progress bar — pauses while the card is hovered or focused */}
      <div
        className="absolute bottom-0 left-0 h-0.5 bg-accent/60 transition-none"
        style={{ width: `${barWidth}%` }}
        aria-hidden="true"
      />
    </motion.div>
  );
}
