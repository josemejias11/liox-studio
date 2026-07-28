'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { getCoveredFeatureLabels } from '@/lib/refresher';
import type { LessonSection } from '@/lib/contracts/course';

interface RefresherFeaturePanelProps {
  lesson: LessonSection;
  visitedLabels: Set<string>;
  onVisit: (label: string) => void;
}

export function RefresherFeaturePanel({
  lesson,
  visitedLabels,
  onVisit,
}: RefresherFeaturePanelProps) {
  const isContentLesson = lesson.lessonType === 'content';
  const [isOpen, setIsOpen] = useState(false);
  const [activeFeature, setActiveFeature] = useState<string | null>(null);
  const features = lesson.coveredFeatures ?? [];
  const labels = getCoveredFeatureLabels(lesson);

  if (labels.length === 0) return null;

  const revealedCount = labels.filter((label) => visitedLabels.has(label)).length;
  const active =
    features.find((feature) => feature.label === activeFeature) ??
    features.find((feature) => !visitedLabels.has(feature.label)) ??
    features[0];
  const answerRevealed = active ? visitedLabels.has(active.label) : false;
  const nextUnrevealedFeature = active
    ? features.find(
        (feature) => feature.label !== active.label && !visitedLabels.has(feature.label),
      )
    : undefined;
  const isComplete = revealedCount === labels.length;
  const progressPercent = Math.round((revealedCount / labels.length) * 100);
  const isRecallOpen = isContentLesson || isOpen;

  function revealAnswer(label: string) {
    setActiveFeature(label);
    onVisit(label);
  }

  return (
    <aside
      className={`absolute z-40 ${
        isContentLesson
          ? 'top-[14%] right-[4.5%] w-[min(31rem,35vw)]'
          : 'top-5 left-5 w-[min(22rem,calc(100%-2.5rem))]'
      }`}
    >
      <div
        className={`rounded-2xl border shadow-xl backdrop-blur-xl ${
          isContentLesson
            ? 'rounded-[2rem] border-white/15 bg-[linear-gradient(155deg,rgba(41,37,78,0.98),rgba(16,15,31,0.98))] p-7 text-white shadow-[0_28px_70px_rgba(22,18,56,0.38)]'
            : 'bg-card/95 border-border/60 p-3'
        }`}
      >
        <p
          className={`text-primary text-[10px] font-bold tracking-[0.18em] uppercase ${
            isContentLesson ? 'text-[#c9c2ff]' : ''
          }`}
        >
          Quick recall
        </p>
        <div className="mt-1 flex items-start justify-between gap-3">
          <div>
            {isContentLesson && (
              <p className="mt-5 text-[11px] font-bold tracking-[0.18em] text-[#c9c2ff] uppercase">
                Pause and recall
              </p>
            )}
            <h2
              className={`text-foreground text-sm font-semibold ${
                isContentLesson ? 'mt-3 text-xl text-white' : ''
              }`}
            >
              {lesson.deviceName ?? 'Key features'}
            </h2>
            <p
              className={`text-muted-foreground mt-0.5 text-xs ${
                isContentLesson ? 'text-white/65' : ''
              }`}
              aria-live="polite"
            >
              {revealedCount} / {labels.length} answers revealed
            </p>
          </div>
          {isContentLesson && (
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full p-1"
              aria-label={`${revealedCount} of ${labels.length} answers revealed`}
              style={{
                background: `conic-gradient(#c9c2ff ${progressPercent}%, rgba(255,255,255,0.14) 0)`,
              }}
            >
              <span className="flex h-full w-full items-center justify-center rounded-full bg-[#1c1a34] text-[11px] font-bold text-white">
                {revealedCount}/{labels.length}
              </span>
            </div>
          )}
          <button
            type="button"
            aria-expanded={isRecallOpen}
            className={`hover:bg-accent rounded-lg p-2 transition-colors ${
              isContentLesson ? 'hidden' : ''
            }`}
            onClick={() => setIsOpen((open) => !open)}
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            <span className="sr-only">{isOpen ? 'Hide' : 'Open'} Quick Recall</span>
          </button>
        </div>

        {isRecallOpen && active && (
          <div
            className={`mt-3 border-t pt-3 ${isContentLesson ? 'mt-7 border-white/12 pt-7' : ''}`}
          >
            <div className={isContentLesson ? 'space-y-7' : 'space-y-3'}>
              <div>
                <p
                  className={`text-muted-foreground text-xs ${
                    isContentLesson ? 'text-sm leading-relaxed text-white/70' : ''
                  }`}
                >
                  Think about the feature before revealing the answer.
                </p>
                <h3
                  className={`text-foreground mt-2 text-sm font-semibold ${
                    isContentLesson ? 'mt-4 text-3xl leading-tight text-white' : ''
                  }`}
                >
                  {active.label}
                </h3>
              </div>

              {answerRevealed ? (
                <div
                  className={`bg-muted/70 rounded-xl p-3 ${
                    isContentLesson ? 'bg-white/10 p-5' : ''
                  }`}
                >
                  <p
                    className={`text-muted-foreground text-xs leading-relaxed ${
                      isContentLesson ? 'text-sm leading-relaxed text-white/80' : ''
                    }`}
                  >
                    {active.summary}
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => revealAnswer(active.label)}
                  className={`bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    isContentLesson
                      ? 'w-full rounded-xl bg-[#7768dc] px-5 py-4 text-base shadow-[0_12px_28px_rgba(119,104,220,0.32)] hover:bg-[#887ae9]'
                      : ''
                  }`}
                >
                  Reveal answer
                </button>
              )}

              {answerRevealed && nextUnrevealedFeature && (
                <button
                  type="button"
                  onClick={() => setActiveFeature(nextUnrevealedFeature.label)}
                  className={`text-primary hover:bg-accent rounded-lg px-2 py-1.5 text-sm font-semibold transition-colors ${
                    isContentLesson ? 'bg-white/8 px-4 py-3 text-white hover:bg-white/14' : ''
                  }`}
                >
                  Next feature
                </button>
              )}

              {isComplete && (
                <div
                  className={`border-primary/15 bg-primary/5 rounded-xl border p-3 ${
                    isContentLesson ? 'border-white/15 bg-white/8 p-5' : ''
                  }`}
                >
                  <div
                    className={`text-primary flex items-center gap-2 text-sm font-semibold ${
                      isContentLesson ? 'text-white' : ''
                    }`}
                  >
                    <span className="bg-primary text-primary-foreground flex h-5 w-5 items-center justify-center rounded-full">
                      <Check className="h-3 w-3" />
                    </span>
                    Quick Recall complete
                  </div>
                  <p
                    className={`text-muted-foreground mt-1 text-xs leading-relaxed ${
                      isContentLesson ? 'text-sm text-white/70' : ''
                    }`}
                  >
                    You have revealed every key feature for this lesson.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
