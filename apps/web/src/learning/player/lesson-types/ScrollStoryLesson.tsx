import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence, useScroll, useReducedMotion } from 'framer-motion';
import { PortableText } from '@portabletext/react';
import { supMark } from '@/shared/portable-text-components';
import { CheckCircle2 } from 'lucide-react';
import type { CourseLesson } from '@/shared/contracts/player-course';
import Image from 'next/image';
import {
  InlineDiscoveryCueMark,
  InlineDiscoveryCueProvider,
  type InlineDiscoveryCueResolver,
} from './InlineDiscoveryCue';
import { CompletionBurst } from '../CompletionBurst';

interface ScrollStoryLessonProps {
  lesson: CourseLesson;
  isCompleted: boolean;
  onComplete: () => void;
  visitedLabels: Set<string>;
  onVisit: (label: string) => void;
}

const BASE_TOP_PX = 16;
const STACK_STEP_PX = 12;
const SCROLL_STORY_PORTABLE_TEXT_COMPONENTS = {
  marks: { layerLink: InlineDiscoveryCueMark, ...supMark },
};

export default function ScrollStoryLesson({
  lesson,
  isCompleted,
  onComplete,
  visitedLabels,
  onVisit,
}: ScrollStoryLessonProps) {
  const { headline, scrollChapters = [], media } = lesson;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const chaptersCount = Math.max(1, scrollChapters.length);
  const lastIndex = chaptersCount - 1;

  const { scrollYProgress } = useScroll({ container: scrollContainerRef });

  const [activeChapter, setActiveChapter] = useState(0);
  const [showCompletionOverlay, setShowCompletionOverlay] = useState(false);

  const hasChapterImages = scrollChapters.some(c => c.image?.asset?.url);
  const resolveLinkedLayer: InlineDiscoveryCueResolver = (linkedLayer) => {
    const feature = lesson.coveredFeatures?.find((item) => item.label === linkedLayer);
    if (!feature) return undefined;

    return {
      label: feature.label,
      summary: feature.summary,
      visited: visitedLabels.has(feature.label),
      onActivate: () => onVisit(feature.label),
    };
  };

  useEffect(() => {
    const unsub = scrollYProgress.on('change', (v) => {
      if (v > 0.85 && !isCompleted) onComplete();
      setActiveChapter(Math.min(chaptersCount - 1, Math.floor(v * chaptersCount)));
    });
    return () => unsub();
  }, [scrollYProgress, isCompleted, onComplete, chaptersCount]);

  useEffect(() => {
    if (!isCompleted) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowCompletionOverlay(true);
    const t = setTimeout(() => setShowCompletionOverlay(false), 1500);
    return () => clearTimeout(t);
  }, [isCompleted]);

  return (
    <div ref={scrollContainerRef} className="font-product relative h-full w-full overflow-y-scroll bg-[#f0ede9] text-[#18191d]">
      <div className="sticky top-0 h-0 z-50 overflow-visible pointer-events-none">
        <motion.div
          className="absolute top-0 left-0 right-0 h-1 bg-[#685bc7] origin-left"
          style={{ scaleX: scrollYProgress }}
        />
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
                className={`h-3 w-3 rounded-full border-2 border-[#685bc7] transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#685bc7] focus:ring-offset-2 focus:ring-offset-[#f0ede9] hover:scale-125 ${
                  i === activeChapter
                    ? 'scale-110 bg-[#685bc7] shadow-[0_0_10px_rgba(104,91,199,0.45)]'
                    : 'bg-transparent cursor-pointer'
                }`}
              />
            ))}
          </div>
        )}
        <AnimatePresence>
          {showCompletionOverlay && (
            <motion.div
              className="absolute inset-x-0 top-0 flex flex-col items-center justify-center bg-[#18191d]/85 backdrop-blur-sm"
              style={{ height: '100vh' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.3 }}
            >
              <CompletionBurst active={!shouldReduceMotion} />
              <div className="relative z-50 flex flex-col items-center">
                <CheckCircle2 className="mb-2 h-16 w-16 text-[#b48a3a]" />
                <span className="font-product text-2xl font-semibold text-white">Complete</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
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
      <div className="px-4 pb-8 md:px-8">
        <div className="mx-auto max-w-6xl px-2 pt-8 md:px-6 md:pt-12">
          <p className="mb-3 text-xs font-semibold tracking-[0.24em] text-[#685bc7] uppercase">Story mode</p>
          <h2 className="max-w-3xl text-4xl leading-[0.95] tracking-[-0.04em] text-[#18191d] md:text-6xl">
            {headline}
          </h2>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-[#595b66] md:text-base">
            Follow the sequence, connect the moments, and keep the product story in context.
          </p>
        </div>
        {scrollChapters.map((chapter, i) => (
          <div
            key={i}
            data-index={i}
            className="chapter-block sticky mx-auto max-w-6xl rounded-[2rem] border border-[#18191d]/10 bg-[#fcfbf8] p-8 shadow-[0_-20px_50px_-28px_rgba(24,25,29,0.35)] md:p-12"
            style={{
              top: `${BASE_TOP_PX + i * STACK_STEP_PX}px`,
              zIndex: i + 1,
              marginBottom: i < lastIndex ? '50vh' : 0,
            }}
          >
            {chapter.image?.asset?.url && (
              <div className="relative w-full aspect-video rounded-2xl overflow-hidden mb-6">
                <Image
                  src={chapter.image.asset.url}
                  alt={chapter.heading}
                  fill
                  className="object-cover grayscale-[0.1]"
                />
              </div>
            )}
            <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-[#b48a3a] uppercase">Moment {String(i + 1).padStart(2, '0')}</p>
            <h3 className="font-product mb-6 text-4xl leading-[0.98] tracking-[-0.035em] text-[#18191d] md:text-5xl">
              {chapter.heading}
            </h3>
            {chapter.body && (
              <div className="font-product prose prose-lg max-w-none font-light leading-relaxed text-[#595b66]">
                {typeof chapter.body === 'string' ? (
                  <p>{chapter.body}</p>
                ) : (
                  <InlineDiscoveryCueProvider resolveLinkedLayer={resolveLinkedLayer}>
                    <PortableText
                      value={chapter.body as import('@portabletext/types').PortableTextBlock[]}
                      components={SCROLL_STORY_PORTABLE_TEXT_COMPONENTS}
                    />
                  </InlineDiscoveryCueProvider>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

    </div>
  );
}
