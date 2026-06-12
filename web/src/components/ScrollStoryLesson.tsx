import React, { useRef, useEffect, useState } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { PortableText } from '@portabletext/react';
import { SanityLesson } from '@/lib/contracts/sanity';
import Image from 'next/image';

interface ScrollStoryLessonProps {
  lesson: SanityLesson;
  isCompleted: boolean;
  onComplete: () => void;
}

export default function ScrollStoryLesson({ lesson, isCompleted, onComplete }: ScrollStoryLessonProps) {
  const { headline, scrollChapters = [], media } = lesson;
  
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const chaptersCount = Math.max(1, scrollChapters.length);
  const containerHeight = `${chaptersCount * 100}vh`;

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  useEffect(() => {
    const unsub = scrollYProgress.on("change", (v) => {
      if (v > 0.85 && !isCompleted) {
        onComplete();
      }
    });
    return () => unsub();
  }, [scrollYProgress, isCompleted, onComplete]);

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
  const [activeChapter, setActiveChapter] = useState(0);

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

    const blocks = document.querySelectorAll('.chapter-block');
    blocks.forEach(b => observer.observe(b));

    return () => observer.disconnect();
  }, [shouldReduceMotion, scrollChapters.length]);

  return (
    <div ref={containerRef} style={{ height: containerHeight }} className="relative w-full bg-background">
      
      {/* Sticky Hero Image Background */}
      <div className="sticky top-0 h-screen w-full overflow-hidden flex items-center justify-center -z-10">
        {media?.asset?.url && (
          shouldReduceMotion ? (
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
              <Image fill 
                src={media.asset.url} 
                alt={headline || 'Story Hero'} 
                className="object-contain"
              />
            </motion.div>
          ) : (
            <motion.div 
              style={{ scale, rotate, x, y }}
              className="relative w-full h-[80vh] flex items-center justify-center will-change-transform"
            >
              <Image fill 
                src={media.asset.url} 
                alt={headline || 'Story Hero'} 
                className="object-contain"
              />
            </motion.div>
          )
        )}
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

  return (
    <motion.article 
      style={shouldReduceMotion ? {} : { opacity, y: translateY }}
      initial={shouldReduceMotion ? { opacity: 0.3 } : false}
      animate={shouldReduceMotion ? { opacity: isActive ? 1 : 0.3, y: 0 } : undefined}
      transition={{ duration: 0.3 }}
      className="backdrop-blur-xl bg-background/80 md:bg-background/90 p-8 rounded-2xl shadow-xl max-w-lg w-full text-foreground border border-border/50"
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
