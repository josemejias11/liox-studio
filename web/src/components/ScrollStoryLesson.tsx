import React, { useRef, useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { PortableText } from '@portabletext/react';
import { CheckCircle2 } from 'lucide-react';
import { SanityLesson } from '@/lib/contracts/sanity';
import Image from 'next/image';

interface ScrollStoryLessonProps {
  lesson: SanityLesson;
  isCompleted: boolean;
  onComplete: () => void;
}

export default function ScrollStoryLesson({ lesson, isCompleted, onComplete }: ScrollStoryLessonProps) {
  const { headline, scrollChapters = [], media } = lesson;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const chaptersCount = Math.max(1, scrollChapters.length);
  const containerHeight = `${chaptersCount * 100}vh`;

  const { scrollYProgress } = useScroll({
    container: scrollContainerRef,
  });

  const [activeChapter, setActiveChapter] = useState(0);
  const [showCompletionOverlay, setShowCompletionOverlay] = useState(false);

  useEffect(() => {
    const unsub = scrollYProgress.on("change", (v) => {
      if (v > 0.85 && !isCompleted) onComplete();
      if (!shouldReduceMotion) {
        setActiveChapter(Math.min(chaptersCount - 1, Math.floor(v * chaptersCount)));
      }
    });
    return () => unsub();
  }, [scrollYProgress, isCompleted, onComplete, chaptersCount, shouldReduceMotion]);

  useEffect(() => {
    if (!isCompleted) return;
    setShowCompletionOverlay(true);
    const t = setTimeout(() => setShowCompletionOverlay(false), 1500);
    return () => clearTimeout(t);
  }, [isCompleted]);

  const progressPoints = scrollChapters.map((_, i) => i / Math.max(1, chaptersCount - 1));
  const safeProgressPoints = progressPoints.length > 1 ? progressPoints : [0, 1];

  const scales = scrollChapters.map(c => c.targetScale ?? 1);
  const safeScales = scales.length > 1 ? scales : [scales[0] ?? 1, scales[0] ?? 1];

  const rotates = scrollChapters.map(c => c.targetRotation ?? 0);
  const safeRotates = rotates.length > 1 ? rotates : [rotates[0] ?? 0, rotates[0] ?? 0];

  const xs = scrollChapters.map(c => c.targetX ?? 0);
  const safeXs = xs.length > 1 ? xs : [xs[0] ?? 0, xs[0] ?? 0];

  const ys = scrollChapters.map(c => c.targetY ?? 0);
  const safeYs = ys.length > 1 ? ys : [ys[0] ?? 0, ys[0] ?? 0];

  const scale = useTransform(scrollYProgress, safeProgressPoints, safeScales);
  const rotate = useTransform(scrollYProgress, safeProgressPoints, safeRotates);
  const x = useTransform(scrollYProgress, safeProgressPoints, safeXs);
  const y = useTransform(scrollYProgress, safeProgressPoints, safeYs);

  // Reduced motion: track active chapter via intersection observer
  useEffect(() => {
    if (!shouldReduceMotion) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute('data-index'));
            setActiveChapter(index);
          }
        });
      },
      { threshold: 0.5 }
    );

    const blocks = scrollContainerRef.current?.querySelectorAll('.chapter-block') ?? [];
    blocks.forEach(b => observer.observe(b));

    return () => observer.disconnect();
  }, [shouldReduceMotion, scrollChapters.length]);

  // Walk backwards from activeChapter to find nearest chapter with an image; fall back to hero
  const activeImageUrl = useMemo(() => {
    for (let i = activeChapter; i >= 0; i--) {
      const url = scrollChapters[i]?.image?.asset?.url;
      if (url) return url;
    }
    return media?.asset?.url;
  }, [activeChapter, scrollChapters, media]);

  const imgDuration = shouldReduceMotion ? 0 : 0.4;

  const crossfadeImage = activeImageUrl ? (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeImageUrl}
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: imgDuration }}
      >
        <Image fill src={activeImageUrl} alt={headline || 'Story Hero'} className="object-contain" />
      </motion.div>
    </AnimatePresence>
  ) : null;

  return (
    <div ref={scrollContainerRef} className="relative w-full h-full overflow-y-scroll">
    <div style={{ height: containerHeight }} className="relative w-full bg-background">

      {/* Sticky Hero Image Background */}
      <div className="sticky top-0 h-full w-full overflow-hidden flex items-center justify-center -z-10">
        {shouldReduceMotion ? (
          <motion.div
            className="relative w-full h-[80vh] flex items-center justify-center"
            initial={false}
            animate={{
              scale: safeScales[activeChapter],
              rotate: safeRotates[activeChapter],
              x: safeXs[activeChapter],
              y: safeYs[activeChapter],
            }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            {crossfadeImage}
          </motion.div>
        ) : (
          <motion.div
            style={{ scale, rotate, x, y }}
            className="relative w-full h-[80vh] flex items-center justify-center will-change-transform"
          >
            {crossfadeImage}
          </motion.div>
        )}

        {/* Sleek Continuous Progress Bar */}
        <motion.div 
          className="absolute top-0 left-0 right-0 h-1 bg-accent z-30 origin-left"
          style={{ scaleX: scrollYProgress }}
        />

        {/* Chapter progress dots (Interactive) */}
        {scrollChapters.length > 1 && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-3">
            {scrollChapters.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  const blocks = scrollContainerRef.current?.querySelectorAll('.chapter-block');
                  if (blocks?.[i]) {
                    (blocks[i] as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }}
                aria-label={`Scroll to chapter ${i + 1}`}
                className={`w-3 h-3 rounded-full border-2 border-accent transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background hover:scale-125 ${
                  i === activeChapter ? 'bg-accent scale-110 shadow-[0_0_10px_rgba(var(--accent),0.8)]' : 'bg-transparent cursor-pointer'
                }`}
              />
            ))}
          </div>
        )}

        {/* Completion overlay */}
        <AnimatePresence>
          {showCompletionOverlay && (
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <CheckCircle2 className="w-16 h-16 text-accent mb-2" />
              <span className="text-foreground font-semibold text-lg">Complete</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Chapters Foreground */}
      <div className="relative z-10 w-full flex flex-col md:items-end pointer-events-none">
        {scrollChapters.map((chapter, i) => (
          <div
            key={i}
            data-index={i}
            className="chapter-block min-h-screen flex items-center justify-center md:justify-end md:pr-[10%] w-full md:w-1/2 p-6 pointer-events-auto"
          >
            <ChapterBlock
              chapter={chapter}
              index={i}
              chaptersCount={chaptersCount}
              scrollYProgress={scrollYProgress}
              shouldReduceMotion={shouldReduceMotion}
              isActive={activeChapter === i}
            />
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}

import type { RichText } from '@/lib/contracts/sanity';

function ChapterBlock({ chapter, index, chaptersCount, scrollYProgress, shouldReduceMotion, isActive }: { chapter: { heading: string, body?: RichText, [key: string]: unknown }, index: number, chaptersCount: number, scrollYProgress: import('framer-motion').MotionValue<number>, shouldReduceMotion: boolean | null, isActive?: boolean }) {
  const chap = chapter;
  const start = Math.max(0, (index - 0.5) / chaptersCount);
  const center = index / Math.max(1, chaptersCount - 1);
  const end = Math.min(1, (index + 0.5) / chaptersCount);

  const pStart = index === 0 ? 0 : start;
  const pEnd = index === chaptersCount - 1 ? 1 : end;

  const safePoints = [pStart, center, pEnd];

  const opacity = useTransform(scrollYProgress, safePoints, [0.3, 1, 0]);
  const translateY = useTransform(scrollYProgress, safePoints, [40, 0, -40]);
  const scale = useTransform(scrollYProgress, safePoints, [0.9, 1, 0.9]);

  return (
    <motion.article
      style={shouldReduceMotion ? {} : { opacity, y: translateY, scale }}
      initial={shouldReduceMotion ? { opacity: 0.3, scale: 0.95 } : false}
      animate={shouldReduceMotion ? { opacity: isActive ? 1 : 0.3, scale: isActive ? 1 : 0.95, y: 0 } : undefined}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`backdrop-blur-xl bg-background/80 md:bg-background/90 p-8 rounded-2xl max-w-lg w-full text-foreground border transition-all duration-500 ${
        isActive ? 'border-accent/50 shadow-[0_0_30px_rgba(var(--accent),0.15)]' : 'border-border/50 shadow-xl'
      }`}
      aria-labelledby={`chapter-heading-${index}`}
    >
      <h3 id={`chapter-heading-${index}`} className="text-2xl font-bold mb-4">{chap.heading}</h3>
      {chap.body && (
        <div className="prose prose-invert max-w-none text-muted-foreground">
          {typeof chap.body === 'string' ? <p>{chap.body}</p> : <PortableText value={chap.body as import('sanity').PortableTextBlock[]} />}
        </div>
      )}
    </motion.article>
  );
}
