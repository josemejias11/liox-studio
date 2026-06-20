import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence, useScroll, useReducedMotion } from 'framer-motion';
import { PortableText } from '@portabletext/react';
import { supMark } from '@/lib/portable-text-components';
import { CheckCircle2 } from 'lucide-react';
import type { SanityLesson } from '@/lib/contracts/sanity';
import Image from 'next/image';

interface ScrollStoryLessonProps {
  lesson: SanityLesson;
  isCompleted: boolean;
  onComplete: () => void;
}

const BASE_TOP_PX = 16;
const STACK_STEP_PX = 12;

export default function ScrollStoryLesson({ lesson, isCompleted, onComplete }: ScrollStoryLessonProps) {
  const { headline, scrollChapters = [], media } = lesson;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const chaptersCount = Math.max(1, scrollChapters.length);
  const lastIndex = chaptersCount - 1;

  const { scrollYProgress } = useScroll({ container: scrollContainerRef });

  const [activeChapter, setActiveChapter] = useState(0);
  const [showCompletionOverlay, setShowCompletionOverlay] = useState(false);

  const hasChapterImages = scrollChapters.some(c => c.image?.asset?.url);

  useEffect(() => {
    const unsub = scrollYProgress.on('change', (v) => {
      if (v > 0.85 && !isCompleted) onComplete();
      setActiveChapter(Math.min(chaptersCount - 1, Math.floor(v * chaptersCount)));
    });
    return () => unsub();
  }, [scrollYProgress, isCompleted, onComplete, chaptersCount]);

  useEffect(() => {
    if (!isCompleted) return;
    setShowCompletionOverlay(true);
    const t = setTimeout(() => setShowCompletionOverlay(false), 1500);
    return () => clearTimeout(t);
  }, [isCompleted]);

  return (
    <div ref={scrollContainerRef} className="relative w-full h-full overflow-y-scroll bg-[#0f0f11] text-white">

      {/* Sticky navigation layer — zero document height, content overflows visibly */}
      <div className="sticky top-0 h-0 z-50 overflow-visible pointer-events-none">

        {/* Gold progress bar */}
        <motion.div
          className="absolute top-0 left-0 right-0 h-1 bg-[#f5d061] origin-left"
          style={{ scaleX: scrollYProgress }}
        />

        {/* Chapter progress dots */}
        {scrollChapters.length > 1 && (
          <div
            className="absolute right-4 flex flex-col gap-3 pointer-events-auto"
            style={{ top: '50vh', transform: 'translateY(-50%)' }}
          >
            {scrollChapters.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  const blocks = scrollContainerRef.current?.querySelectorAll('.chapter-block');
                  if (blocks?.[i]) {
                    (blocks[i] as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                aria-label={`Scroll to chapter ${i + 1}`}
                className={`w-3 h-3 rounded-full border-2 border-[#f5d061] transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#f5d061] focus:ring-offset-2 focus:ring-offset-[#0f0f11] hover:scale-125 ${
                  i === activeChapter
                    ? 'bg-[#f5d061] scale-110 shadow-[0_0_10px_rgba(245,208,97,0.8)]'
                    : 'bg-transparent cursor-pointer'
                }`}
              />
            ))}
          </div>
        )}

        {/* Completion overlay */}
        <AnimatePresence>
          {showCompletionOverlay && (
            <motion.div
              className="absolute inset-x-0 top-0 flex flex-col items-center justify-center bg-[#0f0f11]/80 backdrop-blur-sm"
              style={{ height: '100vh' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.3 }}
            >
              <CheckCircle2 className="w-16 h-16 text-[#f5d061] mb-2" />
              <span className="text-white font-serif font-semibold text-2xl">Complete</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Hero fallback image — only shown when no chapter has its own image */}
      {!hasChapterImages && media?.asset?.url && (
        <div className="px-4 md:px-8 pt-8">
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden mb-8">
            <Image
              src={media.asset.url}
              alt={headline || 'Story Hero'}
              fill
              className="object-contain"
            />
          </div>
        </div>
      )}

      {/* Stacking cards */}
      <div className="px-4 md:px-8 pb-8">
        {scrollChapters.map((chapter, i) => (
          <div
            key={i}
            data-index={i}
            className="chapter-block sticky rounded-3xl bg-[#1a1a1e] border border-white/10 shadow-[0_-20px_40px_-20px_rgba(0,0,0,0.8)] p-8 md:p-12"
            style={{
              top: `${BASE_TOP_PX + i * STACK_STEP_PX}px`,
              zIndex: i + 1,
              marginBottom: i < lastIndex ? '50vh' : 0,
            }}
          >
            {/* Per-card image */}
            {chapter.image?.asset?.url && (
              <div className="relative w-full aspect-video rounded-2xl overflow-hidden mb-6">
                <Image
                  src={chapter.image.asset.url}
                  alt={chapter.heading}
                  fill
                  className="object-cover"
                />
              </div>
            )}

            {/* Heading */}
            <h3 className="text-4xl md:text-5xl font-serif mb-6 text-white leading-tight tracking-tight">
              {chapter.heading}
            </h3>

            {/* Body */}
            {chapter.body && (
              <div className="prose prose-invert prose-lg max-w-none text-white/70 leading-relaxed font-light">
                {typeof chapter.body === 'string' ? (
                  <p>{chapter.body}</p>
                ) : (
                  <PortableText
                    value={chapter.body as import('sanity').PortableTextBlock[]}
                    components={{ marks: supMark }}
                  />
                )}
              </div>
            )}
          </div>
        ))}
      </div>

    </div>
  );
}
