'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Eye, Lightbulb, X } from 'lucide-react';
import { DiscoveryLearnContent } from '@/components/discovery/DiscoveryLearnContent';
import type { RichText, CoursePhoto } from '@/shared/contracts/player-course';
import { useFocusTrap } from '@/shared/useFocusTrap';
import type { InlineDiscoveryCueResolver } from './InlineDiscoveryCue';

type LearningStep = 'notice' | 'insight' | 'demonstrate';

export interface FeatureLearningLoopProps {
  label: string;
  body?: RichText;
  photos?: CoursePhoto[];
  videoFile?: { asset?: { url?: string } };
  videoAspectRatio?: string;
  onAskTutor: () => void;
  onClose: () => void;
  returnFocusRef: React.RefObject<HTMLButtonElement | null>;
  resolveLinkedLayer?: InlineDiscoveryCueResolver;
}

export function FeatureLearningLoop(props: FeatureLearningLoopProps) {
  return <FeatureLearningLoopCard key={props.label} {...props} />;
}

const STEP_LABELS: Record<LearningStep, string> = {
  notice: 'Notice',
  insight: 'Insight',
  demonstrate: 'Demonstrate',
};

const LEARNING_STEPS: LearningStep[] = ['notice', 'insight', 'demonstrate'];

function FeatureLearningLoopCard({
  label,
  body,
  photos = [],
  videoFile,
  videoAspectRatio,
  onAskTutor,
  onClose,
  returnFocusRef,
  resolveLinkedLayer,
}: FeatureLearningLoopProps) {
  const [step, setStep] = useState<LearningStep>('notice');
  const cardRef = useRef<HTMLElement>(null);
  const primaryActionRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();

  useFocusTrap(cardRef, true);

  useEffect(() => {
    primaryActionRef.current?.focus({ preventScroll: true });
  }, [label, step]);

  const closeAndRestoreFocus = useCallback(() => {
    onClose();
    returnFocusRef.current?.focus({ preventScroll: true });
  }, [onClose, returnFocusRef]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;

      event.preventDefault();
      closeAndRestoreFocus();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closeAndRestoreFocus]);

  return (
    <section
      ref={cardRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      className="absolute right-10 bottom-28 z-30 flex max-h-[calc(100%-10rem)] w-[30rem] flex-col overflow-hidden rounded-[1.5rem] border border-white/15 bg-[#111225]/95 text-white shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-2xl"
    >
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 px-6 pt-5 pb-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.2em] text-[#bcb4ff] uppercase">
            Product lens
          </p>
          <h2 id={headingId} className="mt-1 truncate text-xl leading-tight font-semibold">
            {label}
          </h2>
        </div>
        <button
          type="button"
          onClick={closeAndRestoreFocus}
          aria-label="Close product lens"
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-white/70 transition-colors duration-200 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-[#bcb4ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111225] motion-reduce:transition-none"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      <div
        className="flex shrink-0 gap-2 border-b border-white/10 px-6 py-3"
        aria-label="Learning progress"
      >
        {LEARNING_STEPS.map((item, index) => {
          const isCurrent = item === step;
          const isComplete = index < LEARNING_STEPS.indexOf(step);

          return (
            <div
              key={item}
              className={`flex items-center gap-2 text-xs font-semibold tracking-wide ${
                isCurrent ? 'text-white' : isComplete ? 'text-[#bcb4ff]' : 'text-white/40'
              }`}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                  isCurrent
                    ? 'bg-[#685bc7] text-white'
                    : isComplete
                      ? 'bg-[#bcb4ff]/20 text-[#d8d3ff]'
                      : 'bg-white/10 text-white/60'
                }`}
              >
                {index + 1}
              </span>
              {STEP_LABELS[item]}
            </div>
          );
        })}
      </div>

      <div className="overflow-y-auto px-6 py-5">
        <div
          className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200 motion-reduce:animate-none"
          key={step}
        >
          {step === 'notice' && (
            <div className="flex flex-col gap-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#685bc7]/25 text-[#d8d3ff]">
                <Eye className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-lg leading-relaxed font-medium">
                  Take a moment to examine {label}.
                </p>
                <p className="mt-2 text-base leading-relaxed text-white/70">
                  What do you notice about how it helps the product work for the person using it?
                </p>
              </div>
              <button
                ref={primaryActionRef}
                type="button"
                onClick={() => setStep('insight')}
                className="min-h-11 rounded-xl bg-[#8c7df0] px-5 text-sm font-semibold text-[#111225] transition-colors duration-200 hover:bg-[#aaa0f5] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#111225] motion-reduce:transition-none"
              >
                Reveal insight
              </button>
            </div>
          )}

          {step === 'insight' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 text-[#d8d3ff]">
                <Lightbulb className="h-5 w-5" aria-hidden="true" />
                <p className="text-sm font-semibold tracking-wide uppercase">The insight</p>
              </div>
              <DiscoveryLearnContent
                body={body}
                photos={photos}
                videoFile={videoFile}
                videoAspectRatio={videoAspectRatio}
                resolveLinkedLayer={resolveLinkedLayer}
              />
              <button
                ref={primaryActionRef}
                type="button"
                onClick={() => setStep('demonstrate')}
                className="min-h-11 rounded-xl bg-[#8c7df0] px-5 text-sm font-semibold text-[#111225] transition-colors duration-200 hover:bg-[#aaa0f5] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#111225] motion-reduce:transition-none"
              >
                Continue
              </button>
            </div>
          )}

          {step === 'demonstrate' && (
            <div className="flex flex-col gap-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#685bc7]/25 text-[#d8d3ff]">
                <Lightbulb className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-lg leading-relaxed font-medium">
                  How would you point out this benefit to someone seeing the product for the first
                  time?
                </p>
              </div>
              <div className="grid gap-3">
                <button
                  ref={primaryActionRef}
                  type="button"
                  onClick={onAskTutor}
                  className="min-h-11 rounded-xl bg-[#8c7df0] px-5 text-sm font-semibold text-[#111225] transition-colors duration-200 hover:bg-[#aaa0f5] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#111225] motion-reduce:transition-none"
                >
                  Ask the AI tutor
                </button>
                <button
                  type="button"
                  onClick={closeAndRestoreFocus}
                  className="min-h-11 rounded-xl border border-white/20 px-5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#111225] motion-reduce:transition-none"
                >
                  Keep exploring
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
