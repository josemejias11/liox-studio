'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, type Variants } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

interface ChapterIntroProps {
  chapterTitle: string;
  onContinue: () => void;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.35, ease: 'easeOut' as const, staggerChildren: 0.1 },
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

export function ChapterIntro({ chapterTitle, onContinue }: ChapterIntroProps) {
  const [barWidth, setBarWidth] = useState(0);
  const pausedRef = useRef(false);
  const elapsedRef = useRef(0);
  const lastTsRef = useRef<number | null>(null);
  const onContinueRef = useRef(onContinue);
  useEffect(() => {
    onContinueRef.current = onContinue;
  }, [onContinue]);
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
      className="bg-primary text-primary-foreground absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      onMouseEnter={() => {
        pausedRef.current = true;
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
      }}
      onFocus={() => {
        pausedRef.current = true;
      }}
      onBlur={() => {
        pausedRef.current = false;
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(104,91,199,0.12) 0%, transparent 70%)',
        }}
      />
      <div
        className="cc-spin border-accent/6 absolute h-85 w-85 rounded-full border"
        aria-hidden="true"
      />
      <div
        className="cc-spin-rev border-accent/10 absolute h-55 w-55 rounded-full border"
        aria-hidden="true"
      />
      <motion.div
        className="relative z-10 flex w-full max-w-75 flex-col items-center gap-5 px-8 text-center"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.p
          variants={itemVariants}
          className="text-primary-foreground/40 text-[10px] font-bold tracking-[0.26em] uppercase"
        >
          Course
        </motion.p>
        <motion.h2
          variants={itemVariants}
          className="text-primary-foreground text-[26px] leading-tight font-bold"
        >
          {chapterTitle}
        </motion.h2>
        <motion.span
          variants={itemVariants}
          className="bg-accent block h-0.5 w-10 rounded-full"
          aria-hidden="true"
        />
        <motion.button
          variants={itemVariants}
          onClick={onContinue}
          whileHover={{
            scale: 1.03,
            boxShadow: '0px 8px 32px rgba(104, 91, 199, 0.4)',
            transition: { type: 'spring', stiffness: 400, damping: 25 },
          }}
          whileTap={{
            scale: 0.96,
            boxShadow: '0px 4px 16px rgba(104, 91, 199, 0.2)',
            transition: { type: 'spring', stiffness: 400, damping: 25 },
          }}
          className="group bg-accent text-accent-foreground mt-1 flex items-center gap-2 rounded-full px-6 py-3 text-[13px] font-semibold shadow-[0_0_24px_rgba(104,91,199,0.25)] focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Begin
          <ChevronRight className="h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-x-0.5" />
        </motion.button>
      </motion.div>
      <div
        className="bg-accent/60 absolute bottom-0 left-0 h-0.5 transition-none"
        style={{ width: `${barWidth}%` }}
        aria-hidden="true"
      />
    </motion.div>
  );
}
