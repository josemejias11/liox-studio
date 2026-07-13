'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { getCoveredFeatureLabels } from '@/lib/refresher';
import type { LessonSection } from '@/lib/contracts/sanity';

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
  const [isOpen, setIsOpen] = useState(false);
  const [activeFeature, setActiveFeature] = useState<string | null>(null);
  const features = lesson.coveredFeatures ?? [];
  const labels = getCoveredFeatureLabels(lesson);

  if (labels.length === 0) return null;

  const reviewedCount = labels.filter((label) => visitedLabels.has(label)).length;
  const active = features.find((feature) => feature.label === activeFeature);

  function openFeature(label: string) {
    setActiveFeature(label);
    onVisit(label);
  }

  return (
    <aside className="absolute top-5 left-5 z-40 w-[min(22rem,calc(100%-2.5rem))]">
      <div className="bg-card/95 border-border/60 rounded-2xl border p-3 shadow-xl backdrop-blur-xl">
        <p className="text-primary text-[10px] font-bold tracking-[0.18em] uppercase">Refresher</p>
        <div className="mt-1 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-foreground text-sm font-semibold">
              {lesson.deviceName ?? 'Device refresher'}
            </h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {reviewedCount} / {labels.length} features reviewed
            </p>
          </div>
          <button
            type="button"
            aria-expanded={isOpen}
            className="hover:bg-accent rounded-lg p-2 transition-colors"
            onClick={() => setIsOpen((open) => !open)}
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            <span className="sr-only">{isOpen ? 'Hide' : 'Review'} covered features</span>
          </button>
        </div>

        {isOpen && (
          <div className="mt-3 border-t pt-3">
            <p className="text-muted-foreground mb-2 text-xs">Open every feature to continue.</p>
            <div className="space-y-1">
              {features.map((feature) => {
                const reviewed = visitedLabels.has(feature.label);
                return (
                  <button
                    key={feature._key}
                    type="button"
                    onClick={() => openFeature(feature.label)}
                    className="hover:bg-accent flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors"
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                        reviewed ? 'bg-primary border-primary text-primary-foreground' : 'border-border'
                      }`}
                    >
                      {reviewed && <Check className="h-3 w-3" />}
                    </span>
                    <span className="text-foreground font-medium">{feature.label}</span>
                  </button>
                );
              })}
            </div>

            {active && (
              <div className="bg-muted/70 mt-3 rounded-xl p-3">
                <p className="text-foreground text-sm font-semibold">{active.label}</p>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{active.summary}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
