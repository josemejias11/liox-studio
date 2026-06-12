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
import { useFocusTrap } from '@/lib/useFocusTrap';
import { ThemeToggle } from './ThemeToggle';
import type { LessonSection } from '@/lib/contracts/sanity';
import type { CourseStructure } from '@/lib/course-structure';

// ── Icon/color metadata per sectionType / lessonType ─────────────────────────

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

// ── Completion state for a lesson section ─────────────────────────────────────

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

// ── Section row — shared by lesson / spec / quiz / disclaimer entries ─────────

interface SectionRowProps {
  /** Index glyph in the left gutter: a 1-based number, "✓", or "!". */
  indexGlyph: string | number;
  /**
   * Screen-reader replacement for a symbolic glyph ("✓" / "!"). When set, the
   * glyph is aria-hidden and this text is rendered visually hidden instead, so
   * assistive tech never reads raw symbols. Numeric indices stay readable.
   */
  glyphSrText?: string;
  icon: React.ElementType;
  iconColor: string;
  title: string;
  isCurrent: boolean;
  onClick: () => void;
  /** Lesson completion state; non-lesson sections use the default "auto" dot. */
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
      {/* Index glyph */}
      <span
        aria-hidden={glyphSrText ? true : undefined}
        className={`w-4 shrink-0 text-right text-xs font-bold tabular-nums ${isCurrent ? 'text-accent' : 'text-foreground/25'}`}
      >
        {indexGlyph}
      </span>
      {glyphSrText && <span className="sr-only">{glyphSrText}</span>}

      {/* Section type icon */}
      <Icon className={`h-3.5 w-3.5 shrink-0 ${iconColor}`} />

      {/* Title */}
      <span
        className={`flex-1 truncate text-sm leading-tight font-medium ${isCurrent ? 'text-foreground' : 'text-foreground/50'}`}
      >
        {title}
      </span>

      {/* Completion dot */}
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

// ── Props ─────────────────────────────────────────────────────────────────────

interface NavMapProps {
  /** Derived course structure — same instance MotoViewer navigates with. */
  structure: CourseStructure;
  /** Absolute index in the flat sections array; -1 for cover, sections.length for complete */
  currentSectionIndex: number;
  visited: Record<string, Set<string>>;
  onNavigate: (absoluteSectionIndex: number) => void;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NavMap({
  structure,
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

  // ── Section groups / offsets — single source of truth (course-structure) ──
  const {
    lessonSections,
    specSections,
    quizSection,
    disclaimerSection,
    chapters: chapterGroups,
    specOffset,
    quizOffset,
    disclaimerOffset,
  } = structure;

  const hasNonLessonSections = specSections.length > 0 || true || disclaimerSection != null;

  // Explored count (lessons only, for footer)
  const exploredCount = lessonSections.filter((ls) => {
    const st = lessonCompletion(ls, visited);
    return st === 'auto' || st === 'full';
  }).length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="absolute inset-0 z-[60] flex">
      {/* Side panel */}
      <nav
        ref={panelRef as React.RefObject<HTMLElement>}
        aria-label="Course navigation"
        className="nav-map-in bg-background/96 border-border/[0.07] relative flex h-full w-[260px] flex-col border-r shadow-2xl backdrop-blur-2xl"
      >
        {/* Header */}
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

        {/* Scrollable section list */}
        <div
          className="flex flex-1 flex-col gap-0 overflow-y-auto px-2 py-2"
          style={{ scrollbarWidth: 'none' }}
        >
          {/* ── Chapter groups ── */}
          {chapterGroups.map((group) => (
            <div key={group.chapterIndex}>
              {/* Chapter label — non-interactive header row */}
              <div className="px-3 pt-3 pb-1">
                <p className="text-foreground/30 truncate text-[9px] font-bold tracking-[0.18em] uppercase">
                  {group.chapterTitle}
                </p>
              </div>

              {/* Lessons in this chapter */}
              {group.lessons.map(({ section, absoluteIndex }, posInChapter) => {
                const meta = LESSON_TYPE_META[section.lessonType] ?? LESSON_TYPE_META.content;

                return (
                  <SectionRow
                    key={section._key}
                    indexGlyph={posInChapter + 1}
                    icon={meta.icon}
                    iconColor={meta.color}
                    title={section.headline}
                    isCurrent={absoluteIndex === currentSectionIndex}
                    onClick={() => onNavigate(absoluteIndex)}
                    completion={lessonCompletion(section, visited)}
                  />
                );
              })}
            </div>
          ))}

          {/* ── Divider before non-lesson sections ── */}
          {hasNonLessonSections && (
            <div className="border-border/20 mx-3 my-2 border-t" aria-hidden="true" />
          )}

          {/* ── Specification sections — empty dot (no hotspot tracking) ── */}
          {specSections.map((spec, k) => (
            <SectionRow
              key={spec._key ?? `spec-${k}`}
              indexGlyph={k + 1}
              icon={SECTION_TYPE_META.specification.icon}
              iconColor={SECTION_TYPE_META.specification.color}
              title={spec.title}
              isCurrent={specOffset + k === currentSectionIndex}
              onClick={() => onNavigate(specOffset + k)}
            />
          ))}

          {/* ── Quiz section ── */}
          <SectionRow
            indexGlyph="✓"
            glyphSrText="Quiz section"
            icon={SECTION_TYPE_META.quiz.icon}
            iconColor={SECTION_TYPE_META.quiz.color}
            title={quizSection?.title ?? 'Knowledge Check'}
            isCurrent={quizOffset === currentSectionIndex}
            onClick={() => onNavigate(quizOffset)}
          />

          {/* ── Disclaimer section ── */}
          {disclaimerSection && (
            <SectionRow
              indexGlyph="!"
              glyphSrText="Attention required"
              icon={SECTION_TYPE_META.disclaimer.icon}
              iconColor={SECTION_TYPE_META.disclaimer.color}
              title={disclaimerSection.title ?? 'Disclaimer'}
              isCurrent={disclaimerOffset === currentSectionIndex}
              onClick={() => onNavigate(disclaimerOffset)}
            />
          )}
        </div>

        {/* Footer */}
        <div className="border-border/[0.07] shrink-0 border-t px-4 py-2.5">
          <p className="text-foreground/30 text-xs">
            <span className="text-foreground/55 font-semibold">{exploredCount}</span> of{' '}
            {lessonSections.length} lessons explored
          </p>
        </div>
      </nav>

      {/* Backdrop — click to close */}
      <div
        className="bg-background/35 flex-1 cursor-pointer backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
    </div>
  );
}
