'use client';

import React, { useEffect, useRef } from 'react';
import {
  X,
  FileText,
  MousePointer2,
  Layers,
  PlayCircle,
  HelpCircle,
  ShieldAlert,
  CircleCheck,
} from 'lucide-react';
import { useFocusTrap } from '@/shared/useFocusTrap';
import { ThemeToggle } from '@/shared/theme';
import type { LessonSection } from '@/shared/contracts/player-course';
import { getNavItems, type CourseFlow } from '@/learning/course-flow';

const LESSON_TYPE_META: Record<string, { icon: React.ElementType; color: string; label: string }> =
  {
    content: { icon: FileText, color: 'text-foreground/35', label: 'Content' },
    interaction: { icon: MousePointer2, color: 'text-foreground/35', label: 'Interaction' },
    stage: { icon: Layers, color: 'text-accent', label: 'Stage' },
    video: { icon: PlayCircle, color: 'text-muted-foreground', label: 'Video' },
    quiz: { icon: HelpCircle, color: 'text-muted-foreground', label: 'Quiz' },
  };

const SECTION_TYPE_META: Record<
  'specification' | 'quiz' | 'disclaimer',
  { icon: React.ElementType; color: string; label: string }
> = {
  specification: { icon: FileText, color: 'text-accent/70', label: 'Specifications' },
  quiz: { icon: CircleCheck, color: 'text-muted-foreground', label: 'Knowledge Check' },
  disclaimer: { icon: ShieldAlert, color: 'text-muted-foreground', label: 'Disclaimer' },
};

function lessonCompletion(
  lesson: LessonSection,
  visited: Record<string, Set<string>>,
): 'auto' | 'full' | 'partial' | 'none' {
  const hs = lesson.hotspots ?? [];
  if (hs.length === 0) return 'auto';
  const visitedCount = visited[lesson._key]?.size ?? 0;
  if (visitedCount === 0) return 'none';
  if (visitedCount >= hs.length) return 'full';
  return 'partial';
}

interface SectionRowProps {
  indexGlyph: string | number;

  glyphSrText?: string;
  icon: React.ElementType;
  iconColor: string;
  title: string;
  isCurrent: boolean;
  onClick: () => void;
  completion?: 'auto' | 'full' | 'partial' | 'none';
}

function SectionRow({
  indexGlyph,
  glyphSrText,
  icon: Icon,
  iconColor,
  title,
  isCurrent,
  onClick,
  completion = 'auto',
}: SectionRowProps) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-all duration-150 active:scale-[0.97] ${
        isCurrent ? 'bg-accent/14 ring-accent/35 ring-1 ring-inset' : 'hover:bg-background/[0.045]'
      } `}
    >
      <span
        aria-hidden={glyphSrText ? true : undefined}
        className={`w-4 shrink-0 text-right text-xs font-bold tabular-nums ${isCurrent ? 'text-accent' : 'text-foreground/25'}`}
      >
        {indexGlyph}
      </span>
      {glyphSrText && <span className="sr-only">{glyphSrText}</span>}

      <Icon className={`h-3.5 w-3.5 shrink-0 ${iconColor}`} />

      <span
        className={`flex-1 truncate text-sm leading-tight font-medium ${isCurrent ? 'text-foreground' : 'text-foreground/50'}`}
      >
        {title}
      </span>

      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          completion === 'full'
            ? 'bg-accent'
            : completion === 'partial'
              ? 'bg-muted'
              : completion === 'auto'
                ? 'bg-background/18'
                : 'border-border border'
        }`}
      />
    </button>
  );
}

interface NavMapProps {
  flow: CourseFlow;
  currentSectionIndex: number;
  visited: Record<string, Set<string>>;
  onNavigate: (flowIndex: number) => void;
  onClose: () => void;
}

export function NavMap({
  flow,
  currentSectionIndex,
  visited,
  onNavigate,
  onClose,
}: NavMapProps) {
  const panelRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useFocusTrap(panelRef as { current: HTMLElement | null }, true);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const { structure } = flow;
  const {
    lessonSections,
    chapters: chapterGroups,
  } = structure;
  const navItems = getNavItems(flow);
  const lessonIndices = new Map(
    navItems
      .filter((item) => item.kind === 'lesson')
      .map((item) => [item.key, item.index] as const),
  );
  const nonLessonItems = navItems.filter((item) => item.kind !== 'lesson');

  const hasNonLessonSections = nonLessonItems.length > 0;

  const exploredCount = lessonSections.filter((ls) => {
    const st = lessonCompletion(ls, visited);
    return st === 'auto' || st === 'full';
  }).length;


  return (
    <div className="absolute inset-0 z-[60] flex">
      <nav
        ref={panelRef as React.RefObject<HTMLElement>}
        aria-label="Course navigation"
        className="nav-map-in bg-background/96 border-border/[0.07] relative flex h-full w-[260px] flex-col border-r shadow-2xl backdrop-blur-2xl"
      >
        <div className="border-border/[0.07] flex shrink-0 items-center justify-between border-b px-4 pt-3.5 pb-3">
          <p className="text-foreground/35 text-[11px] font-bold tracking-[0.2em] uppercase">
            Course Map
          </p>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={onClose}
              aria-label="Close navigation map"
              className="text-foreground/25 hover:text-foreground/80 hover:bg-background/10 flex h-5 w-5 items-center justify-center rounded-full transition-all"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>

        <div
          className="flex flex-1 flex-col gap-0 overflow-y-auto px-2 py-2"
          style={{ scrollbarWidth: 'none' }}
        >
          {chapterGroups.map((group) => (
            <div key={group.chapterIndex}>
              <div className="px-3 pt-3 pb-1">
                <p className="text-foreground/30 truncate text-[9px] font-bold tracking-[0.18em] uppercase">
                  {group.chapterTitle}
                </p>
              </div>

              {group.lessons.map(({ section, absoluteIndex }, posInChapter) => {
                const meta = LESSON_TYPE_META[section.lessonType] ?? LESSON_TYPE_META.content;
                const flowIndex = lessonIndices.get(section._key) ?? absoluteIndex;

                return (
                  <SectionRow
                    key={section._key}
                    indexGlyph={posInChapter + 1}
                    icon={meta.icon}
                    iconColor={meta.color}
                    title={section.headline}
                    isCurrent={flowIndex === currentSectionIndex}
                    onClick={() => onNavigate(flowIndex)}
                    completion={lessonCompletion(section, visited)}
                  />
                );
              })}
            </div>
          ))}

          {hasNonLessonSections && (
            <div className="border-border/20 mx-3 my-2 border-t" aria-hidden="true" />
          )}

          {nonLessonItems.map((item, index) => {
            const meta = SECTION_TYPE_META[item.kind];
            const indexGlyph = item.kind === 'disclaimer' ? '!' : index + 1;
            const glyphSrText =
              item.kind === 'disclaimer'
                  ? 'Attention required'
                  : undefined;

            return (
              <SectionRow
                key={`${item.kind}-${item.key}`}
                indexGlyph={indexGlyph}
                glyphSrText={glyphSrText}
                icon={meta.icon}
                iconColor={meta.color}
                title={item.title}
                isCurrent={item.index === currentSectionIndex}
                onClick={() => onNavigate(item.index)}
              />
            );
          })}
        </div>

        <div className="border-border/[0.07] shrink-0 border-t px-4 py-2.5">
          <p className="text-foreground/30 text-xs">
            <span className="text-foreground/55 font-semibold">{exploredCount}</span> of{' '}
            {lessonSections.length} lessons explored
          </p>
        </div>
      </nav>

      <div
        className="bg-background/35 flex-1 cursor-pointer backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
    </div>
  );
}
