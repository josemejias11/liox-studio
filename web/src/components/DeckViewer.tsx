"use client";

import React, { useEffect, useRef, useState } from "react";
import { PlayCircle, MousePointer2, Layers, Plus } from "lucide-react";
import { LessonFrame } from "./LessonFrame";
import { Hotspot } from "./Hotspot";
import { DiscoveryPanel } from "./DiscoveryPanel";
import { ProductStage } from "./ProductStage";
import { QuizLesson } from "./QuizLesson";
import type { SanityQuizDoc } from "./QuizLesson";
import { CourseComplete } from "./CourseComplete";
import { NavMap } from "./NavMap";
import { FullWidthCarousel } from "./FullWidthCarousel";
import { VideoLesson } from "./VideoLesson";
import { useLessonProgress } from "@/hooks/useLessonProgress";
import { LayerFrame } from "./LayerFrame";
import { PortableText } from "@portabletext/react";
import { motion, AnimatePresence } from "framer-motion";
import { CourseCover } from "./CourseCover";
import { SpecificationPage } from "./SpecificationPage";
import type { SanitySpecification } from "./SpecificationPage";
import { DisclaimerPage } from "./DisclaimerPage";
import type { SanityDisclaimer } from "./DisclaimerPage";
import { CompletionBurst } from "./CompletionBurst";

import { ChapterIntro } from "./ChapterIntro";

// ── Domain types ──────────────────────────────────────────────────────────────

export interface SanityLayerContent {
  _key: string;
  headline: string;
  body?: any;
  layerType: "content" | "interaction" | "video" | "quiz";
  media?: { asset?: { url?: string } };
  photos?: { asset?: { url?: string } }[];
  hotspots?: SanityHotspot[];
  textOverlay?: { x?: number; y?: number; width?: string };
  videoFile?: { asset?: { url?: string } };
  videoAspectRatio?: string;
}

export interface SanityHotspot {
  _key: string;
  label: string;
  topic: string;
  x: number;
  y: number;
  contentMode?: "tooltip" | "layer";
  layerContent?: SanityLayerContent;
  body?: any;
  photos?: { asset?: { url?: string } }[];
}

export interface SanityLesson {
  _key: string;
  headline: string;
  body?: any;
  lessonType: "content" | "interaction" | "stage" | "video" | "quiz";
  media?: { asset?: { url?: string } };
  textOverlay?: { x?: number; y?: number; width?: string };
  stageBackground?: { asset?: { url?: string } };
  completionTransition?: "spin" | "rise" | "fade";
  hotspots?: SanityHotspot[];
  textHotspots?: { _key: string; triggerWord: string; linkedLayer: string }[];
  videoFile?: { asset?: { url?: string } };
  videoAspectRatio?: string;
  floatingGraphics?: { image?: { asset?: { url?: string } }; x?: number; y?: number; width?: string }[];
}

/** A lesson enriched with chapter metadata — this is what the sections array contains */
export type LessonSection = SanityLesson & {
  sectionType: "lesson";
  chapterTitle: string;
  chapterIndex: number;
};

/** Flat discriminated union of every section type in the course */
export type CourseSection =
  | LessonSection
  | SanitySpecification
  | SanityQuizDoc
  | SanityDisclaimer;

/** Phase-based state machine for course progression */
export type CoursePhase =
  | { phase: "cover" }
  | { phase: "chapter"; chapterIndex: number; lessonIndex: number }
  | { phase: "specifications"; specIndex: number }
  | { phase: "quiz"; quizData: SanityQuizDoc }
  | { phase: "disclaimer" }
  | { phase: "complete" };

interface SanityCourse {
  _id: string;
  title: string;
  description?: string;
  thumbnail?: { asset?: { url?: string } };
  coverImage?: { asset?: { url?: string } };
  coverHeadline?: string;
  coverButtonText?: string;
  coverButtonColor?: string;
  learningObjectives?: string[];
}

// ── Framer Motion slide variants ─────────────────────────────────────────────

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "50%" : "-50%",
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? "50%" : "-50%",
    opacity: 0,
  }),
};

// ── Width helper ──────────────────────────────────────────────────────────────

const getSemanticWidthClass = (width?: string) => {
  switch (width) {
    case "small": return "max-w-sm";
    case "medium": return "max-w-md";
    case "large": return "max-w-lg";
    case "full": return "max-w-full";
    default: return width || "max-w-xl";
  }
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function DeckViewer({
  course,
  sections,
  course_title: _course_title,
  course_description: _course_description,
}: {
  course: SanityCourse;
  sections: CourseSection[];
  course_title: string;
  course_description?: string;
}) {
  // ── Derived section arrays (stable within a single course player mount) ────
  const lessonSections = sections.filter(
    (s): s is LessonSection => s.sectionType === "lesson"
  );
  const specSections = sections.filter(
    (s): s is SanitySpecification => s.sectionType === "specification"
  );
  const quizSection = sections.find(
    (s): s is SanityQuizDoc => s.sectionType === "quiz"
  );
  const disclaimerSection = sections.find(
    (s): s is SanityDisclaimer => s.sectionType === "disclaimer"
  );

  // Unique chapters in order (derived from lesson sections)
  const chapters = (() => {
    const seen = new Set<number>();
    const result: Array<{ chapterIndex: number; chapterTitle: string }> = [];
    for (const ls of lessonSections) {
      if (!seen.has(ls.chapterIndex)) {
        seen.add(ls.chapterIndex);
        result.push({ chapterIndex: ls.chapterIndex, chapterTitle: ls.chapterTitle });
      }
    }
    return result;
  })();

  // ── Course phase state machine ─────────────────────────────────────────────
  const [coursePhase, setCoursePhase] = useState<CoursePhase>({ phase: "cover" });
  const [navDirection, setNavDirection] = useState(1);
  const [showNavMap, setShowNavMap] = useState(false);
  const [showBurst, setShowBurst] = useState(false);
  const [showChapterIntro, setShowChapterIntro] = useState(false);

  // ── Layer / hotspot state ─────────────────────────────────────────────────
  const [activeLayer, setActiveLayer] = useState<{
    topic: string;
    title: string;
    body?: any;
    x?: number;
    y?: number;
    photos?: { asset?: { url?: string; originalFilename?: string } }[];
  } | null>(null);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [lastLayerId, setLastLayerId] = useState<string | null>(null);

  // ── Session ───────────────────────────────────────────────────────────────
  const [sessionId] = useState<string>(() => {
    const existing = localStorage.getItem("decktutor_session");
    if (existing) return existing;
    const sid = crypto.randomUUID();
    localStorage.setItem("decktutor_session", sid);
    return sid;
  });
  const { visited, markVisited: baseMarkVisited } = useLessonProgress(sessionId);

  // Opens a layer and snapshots its ID so LayerFrame can animate out gracefully
  function openLayer(id: string) {
    setLastLayerId(id);
    setActiveLayerId(id);
  }

  // ── Current lesson (only relevant in chapter phase) ───────────────────────
  const currentLesson: LessonSection | undefined = (() => {
    if (coursePhase.phase !== "chapter") return undefined;
    const { chapterIndex, lessonIndex } = coursePhase;
    const chapterLessons = lessonSections.filter((ls) => ls.chapterIndex === chapterIndex);
    return chapterLessons[lessonIndex];
  })();

  const lessonKey = currentLesson?._key ?? "";

  const safeString = (val: any): string =>
    typeof val === "string"
      ? val
      : Array.isArray(val)
      ? val
          .map((b: any) => b.children?.map((c: any) => c.text).join(""))
          .join("")
      : String(val || "");

  const safeHeadline = currentLesson ? safeString(currentLesson.headline) : "";

  const hotspots = (currentLesson?.hotspots ?? []).map((h: any) => ({
    ...h,
    label: safeString(h.label),
    layerContent: h.layerContent
      ? { ...h.layerContent, headline: safeString(h.layerContent.headline) }
      : undefined,
  }));

  const visitedOnLesson = visited[lessonKey]?.size ?? 0;
  const missingHotspots = hotspots.filter(
    (h: { label: string }) => !(visited[lessonKey]?.has(h.label))
  );
  const nextLocked = hotspots.length > 0 && missingHotspots.length > 0;

  const imageUrl = currentLesson?.media?.asset?.url;

  // ── Stats for completion screen ───────────────────────────────────────────
  const totalHotspotsVisited = Object.values(visited).reduce((sum, s) => sum + s.size, 0);
  const totalHotspots = lessonSections.reduce((sum, s) => sum + (s.hotspots?.length ?? 0), 0);

  function markVisited(label: string) {
    baseMarkVisited(lessonKey, label, hotspots.length);
  }

  // ── PortableText components ───────────────────────────────────────────────
  const portableTextComponents = {
    marks: {
      layerLink: ({ children, value }: any) => (
        <button
          onClick={() => {
            const hotspot = hotspots.find(
              (h: any) => h.label === value?.linkedLayer && h.contentMode === "layer"
            );
            if (hotspot) {
              baseMarkVisited(lessonKey, hotspot.label, hotspots.length);
              openLayer(hotspot._key);
            }
          }}
          className="text-accent font-medium underline underline-offset-4 decoration-accent/40 hover:decoration-accent transition-colors mx-1"
        >
          {children}
        </button>
      ),
    },
  };

  // ── Absolute section index (for progress bar and NavMap active highlight) ─
  function getCurrentSectionIndex(): number {
    switch (coursePhase.phase) {
      case "cover": return -1;
      case "chapter": {
        const { chapterIndex, lessonIndex } = coursePhase;
        const lessonsBeforeThisChapter = lessonSections.filter(
          (ls) => ls.chapterIndex < chapterIndex
        ).length;
        return lessonsBeforeThisChapter + lessonIndex;
      }
      case "specifications":
        return lessonSections.length + coursePhase.specIndex;
      case "quiz":
        return lessonSections.length + specSections.length;
      case "disclaimer":
        return lessonSections.length + specSections.length + (quizSection ? 1 : 0);
      case "complete":
        return sections.length;
    }
  }

  // ── Completion burst helper ───────────────────────────────────────────────
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function triggerComplete() {
    setCoursePhase({ phase: "complete" });
    setShowBurst(true);
    if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
    burstTimerRef.current = setTimeout(() => setShowBurst(false), 1200);
  }

  useEffect(() => () => {
    if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
  }, []);

  // ── Navigation: goNext ────────────────────────────────────────────────────
  function goNext() {
    if (coursePhase.phase === "cover") {
      setNavDirection(1);
      if (lessonSections.length > 0) {
        setCoursePhase({ phase: "chapter", chapterIndex: 0, lessonIndex: 0 });
      } else if (specSections.length > 0) {
        setCoursePhase({ phase: "specifications", specIndex: 0 });
      } else if (quizSection) {
        setCoursePhase({ phase: "quiz", quizData: quizSection });
      } else if (disclaimerSection) {
        setCoursePhase({ phase: "disclaimer" });
      } else {
        triggerComplete();
      }
      return;
    }

    if (coursePhase.phase === "chapter") {
      if (nextLocked) return;
      const { chapterIndex, lessonIndex } = coursePhase;
      const chapterLessons = lessonSections.filter((ls) => ls.chapterIndex === chapterIndex);
      setNavDirection(1);

      if (lessonIndex < chapterLessons.length - 1) {
        // Next lesson in same chapter
        setCoursePhase({ phase: "chapter", chapterIndex, lessonIndex: lessonIndex + 1 });
        return;
      }

      // Last lesson of this chapter — find next chapter
      const nextChapterIndex = chapterIndex + 1;
      const nextChapterLessons = lessonSections.filter((ls) => ls.chapterIndex === nextChapterIndex);

      if (nextChapterLessons.length > 0) {
        // Cross chapter boundary — show chapter intro overlay, then start next chapter
        setCoursePhase({ phase: "chapter", chapterIndex: nextChapterIndex, lessonIndex: 0 });
        setShowChapterIntro(true);
        return;
      }

      // No more chapters — advance to specifications, quiz, disclaimer, or complete
      if (specSections.length > 0) {
        setCoursePhase({ phase: "specifications", specIndex: 0 });
      } else if (quizSection) {
        setCoursePhase({ phase: "quiz", quizData: quizSection });
      } else if (disclaimerSection) {
        setCoursePhase({ phase: "disclaimer" });
      } else {
        triggerComplete();
      }
      return;
    }

    if (coursePhase.phase === "specifications") {
      setNavDirection(1);
      const { specIndex } = coursePhase;
      if (specIndex < specSections.length - 1) {
        setCoursePhase({ phase: "specifications", specIndex: specIndex + 1 });
      } else if (quizSection) {
        setCoursePhase({ phase: "quiz", quizData: quizSection });
      } else if (disclaimerSection) {
        setCoursePhase({ phase: "disclaimer" });
      } else {
        triggerComplete();
      }
      return;
    }

    // "quiz" phase — navigation is driven by onPass/onFail from QuizLesson, not by goNext
    // "disclaimer" phase
    if (coursePhase.phase === "disclaimer") {
      setNavDirection(1);
      triggerComplete();
      return;
    }

    // "complete" — stay
  }

  // ── Navigation: goPrev ────────────────────────────────────────────────────
  function goPrev() {
    if (coursePhase.phase === "chapter") {
      const { chapterIndex, lessonIndex } = coursePhase;
      setNavDirection(-1);

      if (lessonIndex > 0) {
        setCoursePhase({ phase: "chapter", chapterIndex, lessonIndex: lessonIndex - 1 });
        return;
      }

      if (chapterIndex > 0) {
        const prevChapterIndex = chapterIndex - 1;
        const prevChapterLessons = lessonSections.filter(
          (ls) => ls.chapterIndex === prevChapterIndex
        );
        setCoursePhase({
          phase: "chapter",
          chapterIndex: prevChapterIndex,
          lessonIndex: Math.max(0, prevChapterLessons.length - 1),
        });
        return;
      }

      // First lesson of first chapter — go to cover
      setCoursePhase({ phase: "cover" });
      return;
    }

    if (coursePhase.phase === "specifications") {
      setNavDirection(-1);
      const { specIndex } = coursePhase;
      if (specIndex > 0) {
        setCoursePhase({ phase: "specifications", specIndex: specIndex - 1 });
        return;
      }
      // First spec — go to last lesson of last chapter (or cover)
      const lastChapter = chapters[chapters.length - 1];
      if (lastChapter) {
        const lastChapterLessons = lessonSections.filter(
          (ls) => ls.chapterIndex === lastChapter.chapterIndex
        );
        setCoursePhase({
          phase: "chapter",
          chapterIndex: lastChapter.chapterIndex,
          lessonIndex: Math.max(0, lastChapterLessons.length - 1),
        });
      } else {
        setCoursePhase({ phase: "cover" });
      }
      return;
    }

    if (coursePhase.phase === "quiz") {
      setNavDirection(-1);
      if (specSections.length > 0) {
        setCoursePhase({ phase: "specifications", specIndex: specSections.length - 1 });
      } else {
        const lastChapter = chapters[chapters.length - 1];
        if (lastChapter) {
          const lastChapterLessons = lessonSections.filter(
            (ls) => ls.chapterIndex === lastChapter.chapterIndex
          );
          setCoursePhase({
            phase: "chapter",
            chapterIndex: lastChapter.chapterIndex,
            lessonIndex: Math.max(0, lastChapterLessons.length - 1),
          });
        } else {
          setCoursePhase({ phase: "cover" });
        }
      }
      return;
    }

    if (coursePhase.phase === "disclaimer") {
      setNavDirection(-1);
      if (quizSection) {
        setCoursePhase({ phase: "quiz", quizData: quizSection });
      } else if (specSections.length > 0) {
        setCoursePhase({ phase: "specifications", specIndex: specSections.length - 1 });
      } else {
        const lastChapter = chapters[chapters.length - 1];
        if (lastChapter) {
          const lastChapterLessons = lessonSections.filter(
            (ls) => ls.chapterIndex === lastChapter.chapterIndex
          );
          setCoursePhase({
            phase: "chapter",
            chapterIndex: lastChapter.chapterIndex,
            lessonIndex: Math.max(0, lastChapterLessons.length - 1),
          });
        } else {
          setCoursePhase({ phase: "cover" });
        }
      }
      return;
    }

    if (coursePhase.phase === "complete") {
      setNavDirection(-1);
      if (disclaimerSection) {
        setCoursePhase({ phase: "disclaimer" });
      } else if (quizSection) {
        setCoursePhase({ phase: "quiz", quizData: quizSection });
      } else if (specSections.length > 0) {
        setCoursePhase({ phase: "specifications", specIndex: specSections.length - 1 });
      } else {
        const lastChapter = chapters[chapters.length - 1];
        if (lastChapter) {
          const lastChapterLessons = lessonSections.filter(
            (ls) => ls.chapterIndex === lastChapter.chapterIndex
          );
          setCoursePhase({
            phase: "chapter",
            chapterIndex: lastChapter.chapterIndex,
            lessonIndex: Math.max(0, lastChapterLessons.length - 1),
          });
        } else {
          setCoursePhase({ phase: "cover" });
        }
      }
      return;
    }
  }

  // ── Quiz pass/fail handlers ───────────────────────────────────────────────
  function handleQuizPass(_score: number) {
    setNavDirection(1);
    if (disclaimerSection) {
      setCoursePhase({ phase: "disclaimer" });
    } else {
      triggerComplete();
    }
  }

  function handleQuizFail() {
    // onFail is called only when allowRetry is false;
    // treat as advancing past the quiz gate (learner must continue)
    setNavDirection(1);
    if (disclaimerSection) {
      setCoursePhase({ phase: "disclaimer" });
    } else {
      triggerComplete();
    }
  }

  // ── Navigate to an arbitrary section (from NavMap) ────────────────────────
  function navigateToSection(i: number) {
    const section = sections[i];
    if (!section) return;

    const currentIdx = getCurrentSectionIndex();
    setNavDirection(i > currentIdx ? 1 : -1);
    setShowNavMap(false);
    setActiveLayer(null);
    setActiveLayerId(null);
    setShowChapterIntro(false);

    if (section.sectionType === "lesson") {
      const ls = section as LessonSection;
      const chapterLessons = lessonSections.filter((l) => l.chapterIndex === ls.chapterIndex);
      const lessonIdx = chapterLessons.indexOf(ls);
      setCoursePhase({
        phase: "chapter",
        chapterIndex: ls.chapterIndex,
        lessonIndex: lessonIdx >= 0 ? lessonIdx : 0,
      });
    } else if (section.sectionType === "specification") {
      const specIdx = i - lessonSections.length;
      setCoursePhase({ phase: "specifications", specIndex: specIdx >= 0 ? specIdx : 0 });
    } else if (section.sectionType === "quiz") {
      setCoursePhase({ phase: "quiz", quizData: section as SanityQuizDoc });
    } else if (section.sectionType === "disclaimer") {
      setCoursePhase({ phase: "disclaimer" });
    }
  }

  // ── NavMap element ────────────────────────────────────────────────────────
  const toggleNavMap = () => setShowNavMap((v) => !v);

  const currentSectionIndex = getCurrentSectionIndex();

  const navMapEl = showNavMap ? (
    <NavMap
      sections={sections}
      currentSectionIndex={currentSectionIndex}
      visited={visited}
      onNavigate={navigateToSection}
      onClose={() => setShowNavMap(false)}
    />
  ) : null;

  // ── Shared LayerFrame (hotspot layer panel) ────────────────────────────────
  const targetId = activeLayerId ?? lastLayerId;
  const activeHotspot = targetId ? hotspots.find((h: any) => h._key === targetId) : null;
  const layerContent = activeHotspot?.layerContent;

  const renderLayerFrame = () => (
    <LayerFrame
      open={activeLayerId !== null}
      onClose={() => setActiveLayerId(null)}
      parentLessonTitle={safeHeadline}
      layerTitle={layerContent?.headline ?? ""}
    >
      {layerContent && (
        <>
          {(layerContent.media?.asset?.url || (layerContent.photos && layerContent.photos.length > 0)) ? (
            <div className="relative mb-6">
              {layerContent.media?.asset?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={layerContent.media.asset.url}
                  alt={layerContent.headline}
                  className="w-full rounded-2xl object-cover max-h-[60vh] shadow-2xl ring-1 ring-white/10"
                />
              ) : layerContent.photos ? (
                <FullWidthCarousel photos={layerContent.photos} className="!mb-0" />
              ) : null}

              {layerContent.textOverlay && layerContent.body && (
                <div
                  className="absolute z-10"
                  style={{
                    left: `${layerContent.textOverlay.x ?? 6}%`,
                    top: `${layerContent.textOverlay.y ?? 15}%`,
                  }}
                >
                  <div
                    className={`pointer-events-auto bg-card/60 backdrop-blur-2xl p-5 md:p-6 rounded-2xl border border-white/10 shadow-xl ${getSemanticWidthClass(layerContent.textOverlay.width)}`}
                  >
                    <div className="text-sm md:text-base leading-relaxed text-foreground prose prose-sm prose-invert max-w-none">
                      {typeof layerContent.body === "string" ? (
                        layerContent.body
                      ) : (
                        <PortableText value={layerContent.body} />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {(!layerContent.textOverlay ||
            (!layerContent.media?.asset?.url &&
              !(layerContent.photos && layerContent.photos.length > 0))) &&
            layerContent.body && (
              <div className="text-base leading-relaxed text-foreground prose prose-invert max-w-none">
                {typeof layerContent.body === "string" ? (
                  layerContent.body
                ) : (
                  <PortableText value={layerContent.body} />
                )}
              </div>
            )}

          {layerContent.layerType === "video" && layerContent.videoFile?.asset?.url && (
            <div
              className="mt-6 bg-black rounded-2xl overflow-hidden border border-white/10 relative shadow-2xl flex items-center justify-center"
              style={{
                aspectRatio:
                  layerContent.videoAspectRatio === "1:1"
                    ? "1 / 1"
                    : layerContent.videoAspectRatio === "4:5"
                    ? "4 / 5"
                    : layerContent.videoAspectRatio === "9:16"
                    ? "9 / 16"
                    : "16 / 9",
              }}
            >
              <video
                src={layerContent.videoFile.asset.url}
                controls
                className="absolute inset-0 w-full h-full object-contain"
              />
            </div>
          )}

          {layerContent.layerType === "interaction" &&
            layerContent.hotspots &&
            layerContent.hotspots.length > 0 && (
              <div className="mt-8">
                <h3 className="text-sm uppercase tracking-widest text-accent/80 font-bold mb-4">
                  Interactive Features
                </h3>
                <div className="space-y-4">
                  {layerContent.hotspots.map((h: any, idx: number) => (
                    <div key={idx} className="bg-white/5 rounded-2xl p-5 border border-white/10">
                      <h4 className="font-semibold text-foreground text-lg mb-2">{h.label}</h4>
                      <div className="text-foreground/70 text-sm leading-relaxed prose prose-invert">
                        {typeof h.body === "string" ? (
                          h.body
                        ) : (
                          <PortableText value={h.body} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </>
      )}
    </LayerFrame>
  );

  // ── Lesson text overlay positioning ───────────────────────────────────────
  const lessonTextOverlayX = currentLesson?.textOverlay?.x ?? 6;
  const lessonTextOverlayY = currentLesson?.textOverlay?.y ?? 15;
  const lessonTextOverlayWidth = getSemanticWidthClass(currentLesson?.textOverlay?.width);

  // ── Progress values for LessonFrame (used in chapter phase) ───────────────
  // Use sections.length + 1 as totalLessons to prevent LessonFrame from
  // disabling the "Next" button at the very last section (goNext handles that).
  const absoluteSectionIndex = currentSectionIndex;
  const progressCurrent = absoluteSectionIndex >= 0 ? absoluteSectionIndex + 1 : 1;
  const progressTotal = sections.length + 1;

  // ── Build quiz context for lesson-type AI quizzes ─────────────────────────
  const buildQuizContext = () =>
    [
      `Product: ${course.title}`,
      `Features: ${lessonSections
        .flatMap((s) => s.hotspots ?? [])
        .map((h) => h.topic || h.label)
        .filter(Boolean)
        .join(", ")}`,
      `Explored by learner: ${
        Object.values(visited)
          .flatMap((labels) => Array.from(labels))
          .join(", ") || "none yet"
      }`,
    ].join("\n");

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER — branch on coursePhase.phase
  // ══════════════════════════════════════════════════════════════════════════

  // ── Cover ─────────────────────────────────────────────────────────────────
  if (coursePhase.phase === "cover") {
    const finalImageUrl =
      course.coverImage?.asset?.url ||
      course.thumbnail?.asset?.url ||
      lessonSections[0]?.media?.asset?.url;

    return (
      <LessonFrame moduleTitle={course.title}>
        <AnimatePresence mode="wait" custom={navDirection}>
          <motion.div
            key="cover"
            custom={navDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="absolute inset-0"
          >
            <CourseCover
              title={course.title}
              coverHeadline={course.coverHeadline}
              coverImage={finalImageUrl}
              buttonText={course.coverButtonText}
              buttonColor={course.coverButtonColor}
              onStart={() => {
                setNavDirection(1);
                goNext();
              }}
            />
          </motion.div>
        </AnimatePresence>
        {navMapEl}
      </LessonFrame>
    );
  }

  // ── Specifications ────────────────────────────────────────────────────────
  if (coursePhase.phase === "specifications") {
    const spec = specSections[coursePhase.specIndex];
    if (!spec) return null;

    return (
      <LessonFrame onToggleNavMap={toggleNavMap} moduleTitle={course.title}>
        <AnimatePresence mode="wait" custom={navDirection}>
          <motion.div
            key={`spec-${coursePhase.specIndex}`}
            custom={navDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="absolute inset-0"
          >
            <SpecificationPage
              spec={spec}
              onNext={goNext}
              onPrev={goPrev}
              showPrev={true}
            />
          </motion.div>
        </AnimatePresence>
        {navMapEl}
      </LessonFrame>
    );
  }

  // ── Quiz ──────────────────────────────────────────────────────────────────
  if (coursePhase.phase === "quiz") {
    return (
      <LessonFrame onToggleNavMap={toggleNavMap} moduleTitle={course.title}>
        <AnimatePresence mode="wait" custom={navDirection}>
          <motion.div
            key="quiz"
            custom={navDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="absolute inset-0"
          >
            <QuizLesson
              sanityQuiz={coursePhase.quizData}
              onPass={handleQuizPass}
              onFail={handleQuizFail}
              passingScore={coursePhase.quizData.passingScore}
              sessionId={sessionId}
              courseId={course._id}
            />
          </motion.div>
        </AnimatePresence>
        {navMapEl}
        <CompletionBurst active={showBurst} />
      </LessonFrame>
    );
  }

  // ── Disclaimer ────────────────────────────────────────────────────────────
  if (coursePhase.phase === "disclaimer") {
    if (!disclaimerSection) return null;

    return (
      <LessonFrame onToggleNavMap={toggleNavMap} moduleTitle={course.title}>
        <AnimatePresence mode="wait" custom={navDirection}>
          <motion.div
            key="disclaimer"
            custom={navDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="absolute inset-0"
          >
            <DisclaimerPage
              disclaimer={disclaimerSection}
              onNext={goNext}
              onPrev={goPrev}
              showPrev={true}
            />
          </motion.div>
        </AnimatePresence>
        {navMapEl}
      </LessonFrame>
    );
  }

  // ── Complete ──────────────────────────────────────────────────────────────
  if (coursePhase.phase === "complete") {
    return (
      <LessonFrame onToggleNavMap={toggleNavMap} moduleTitle={course.title}>
        <AnimatePresence mode="wait" custom={navDirection}>
          <motion.div
            key="complete"
            custom={navDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="absolute inset-0"
          >
            <CourseComplete
              moduleTitle={course.title}
              totalLessons={lessonSections.length}
              totalHotspotsVisited={totalHotspotsVisited}
              totalHotspots={totalHotspots}
              onRestart={() => {
                setNavDirection(1);
                setActiveLayer(null);
                setActiveLayerId(null);
                setShowChapterIntro(false);
                setCoursePhase({ phase: "cover" });
              }}
            />
          </motion.div>
        </AnimatePresence>
        {navMapEl}
        <CompletionBurst active={showBurst} />
      </LessonFrame>
    );
  }

  // ── Chapter phase — lesson rendering ─────────────────────────────────────
  // All lesson types (stage, video, in-lesson quiz, content) live here.

  if (!currentLesson) return null;

  // ── Chapter intro overlay (cross-chapter boundary) ───────────────────────
  if (showChapterIntro) {
    const chapterEntry = chapters.find((c) => c.chapterIndex === coursePhase.chapterIndex);
    return (
      <LessonFrame onToggleNavMap={toggleNavMap} moduleTitle={course.title}>
        <ChapterIntro
          chapterTitle={chapterEntry?.chapterTitle ?? ""}
          chapterNumber={(coursePhase.chapterIndex) + 1}
          totalChapters={chapters.length}
          onContinue={() => setShowChapterIntro(false)}
        />
        {navMapEl}
      </LessonFrame>
    );
  }

  // ── Stage lesson ──────────────────────────────────────────────────────────
  if (currentLesson.lessonType === "stage") {
    return (
      <LessonFrame onToggleNavMap={toggleNavMap} moduleTitle={course.title}>
        <AnimatePresence mode="wait" custom={navDirection}>
          <motion.div
            key={`stage-${currentLesson._key}`}
            custom={navDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="absolute inset-0"
          >
            <ProductStage
              headline={safeHeadline}
              productImage={currentLesson.media?.asset?.url}
              stageBackground={currentLesson.stageBackground?.asset?.url}
              enableCompletionAnimation={(currentLesson as any).enableCompletionAnimation}
              completionTransition={currentLesson.completionTransition}
              hotspots={hotspots}
              visited={visited[lessonKey] ?? new Set()}
              onVisit={markVisited}
              onNext={goNext}
              onOpenLayer={(id: string) => {
                baseMarkVisited(lessonKey, hotspots.find((h: any) => h._key === id)?.label || "", hotspots.length);
                openLayer(id);
              }}
            />
          </motion.div>
        </AnimatePresence>
        {navMapEl}
        {renderLayerFrame()}
      </LessonFrame>
    );
  }

  // ── Video lesson ──────────────────────────────────────────────────────────
  if (currentLesson.lessonType === "video") {
    return (
      <LessonFrame onToggleNavMap={toggleNavMap} moduleTitle={course.title}>
        <AnimatePresence mode="wait" custom={navDirection}>
          <motion.div
            key={`video-${currentLesson._key}`}
            custom={navDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="absolute inset-0"
          >
            <VideoLesson
              headline={safeHeadline}
              videoFileUrl={currentLesson.videoFile?.asset?.url}
              videoAspectRatio={currentLesson.videoAspectRatio}
              onNext={goNext}
            />
          </motion.div>
        </AnimatePresence>
        {navMapEl}
      </LessonFrame>
    );
  }

  // ── In-lesson AI quiz ─────────────────────────────────────────────────────
  if (currentLesson.lessonType === "quiz") {
    return (
      <LessonFrame onToggleNavMap={toggleNavMap} moduleTitle={course.title}>
        <AnimatePresence mode="wait" custom={navDirection}>
          <motion.div
            key={`quiz-lesson-${currentLesson._key}`}
            custom={navDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="absolute inset-0"
          >
            <QuizLesson
              context={buildQuizContext()}
              onPass={goNext}   // lesson-type quiz always advances on pass
              onFail={goNext}   // lesson-type quiz also advances on fail (no gate)
              passingScore={80}
              sessionId={sessionId}
              courseId={course._id}
            />
          </motion.div>
        </AnimatePresence>
        {navMapEl}
      </LessonFrame>
    );
  }

  // ── Regular content lesson ────────────────────────────────────────────────
  return (
    <LessonFrame
      currentLesson={progressCurrent}
      totalLessons={progressTotal}
      onPrev={goPrev}
      onNext={goNext}
      nextDisabled={nextLocked}
      onToggleNavMap={toggleNavMap}
      moduleTitle={course.title}
      completionHint={
        nextLocked
          ? `Tap all ${hotspots.length} features to continue (${visitedOnLesson} / ${hotspots.length})`
          : undefined
      }
    >
      <AnimatePresence mode="wait" custom={navDirection}>
        <motion.div
          key={`lesson-${currentLesson._key}`}
          custom={navDirection}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="absolute inset-0"
        >
          {/* Background image or solid color */}
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={safeHeadline}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-background" />
          )}

          {/* Text content */}
          {(!imageUrl || currentLesson.body) && (
            <div
              className={`absolute pointer-events-none z-10 flex flex-col ${
                imageUrl
                  ? "left-[6%] right-[6%] bottom-[12%] md:left-[var(--desktop-x)] md:right-auto md:top-[var(--desktop-y)] md:bottom-auto"
                  : ""
              }`}
              style={
                imageUrl
                  ? ({
                      "--desktop-x": `max(6%, ${lessonTextOverlayX}%)`,
                      "--desktop-y": `${lessonTextOverlayY}%`,
                    } as React.CSSProperties)
                  : { inset: 0, padding: "6%", justifyContent: "center" }
              }
            >
              <div
                className={`pointer-events-auto w-full ${imageUrl ? lessonTextOverlayWidth : "max-w-xl flex flex-col gap-4"} ${
                  imageUrl
                    ? "bg-card/60 backdrop-blur-2xl p-6 md:p-8 rounded-[2rem] border border-white/10 shadow-2xl"
                    : ""
                }`}
              >
                <h2 className="text-foreground text-2xl font-semibold leading-tight">
                  {currentLesson.headline}
                </h2>
                {currentLesson.body && (
                  <div className="prose dark:prose-invert max-w-none text-muted-foreground mt-4 text-base font-light leading-relaxed whitespace-pre-wrap">
                    {typeof currentLesson.body === "string" ? (
                      currentLesson.body
                    ) : (
                      <PortableText
                        value={currentLesson.body}
                        components={portableTextComponents}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Floating graphics */}
          {currentLesson.floatingGraphics?.map(
            (fg, i) =>
              fg.image?.asset?.url && (
                <div
                  key={i}
                  className={`absolute pointer-events-none z-10 ${getSemanticWidthClass(fg.width)}`}
                  style={{ left: `${fg.x ?? 0}%`, top: `${fg.y ?? 0}%` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={fg.image.asset.url}
                    alt="Floating Graphic"
                    className="w-full h-auto drop-shadow-2xl"
                  />
                </div>
              )
          )}

          {/* Hotspots */}
          {hotspots.map(
            (h: any, i: number) => {
              let Icon = null;
              if (h.contentMode === "layer" && h.layerContent) {
                if (h.layerContent.layerType === "video") Icon = PlayCircle;
                else if (h.layerContent.layerType === "interaction") Icon = MousePointer2;
                else Icon = Layers;
              }

              return (
                <Hotspot
                  key={i}
                  x={h.x}
                  y={h.y}
                  label={h.label}
                  visited={visited[lessonKey]?.has(h.label) ?? false}
                  icon={
                    Icon ? (
                      <Icon className="w-5 h-5 text-white" />
                    ) : h.contentMode === "layer" ? (
                      <Plus className="w-5 h-5 text-white" />
                    ) : undefined
                  }
                  onVisit={() => markVisited(h.label)}
                  onOpen={() => {
                    if (h.contentMode === "layer" && h.layerContent) {
                      baseMarkVisited(lessonKey, h.label, hotspots.length);
                      openLayer(h._key);
                      return;
                    }
                    setActiveLayer({
                      topic: h.topic,
                      title: h.label,
                      body: h.body,
                      x: h.x,
                      y: h.y,
                      photos: h.photos,
                    });
                  }}
                />
              );
            }
          )}

          <DiscoveryPanel
            open={activeLayer !== null}
            onClose={() => setActiveLayer(null)}
            label={activeLayer?.title ?? ""}
            topic={activeLayer?.topic}
            body={activeLayer?.body}
            x={activeLayer?.x}
            y={activeLayer?.y}
            photos={activeLayer?.photos}
            mode="popover"
          />

          {renderLayerFrame()}
        </motion.div>
      </AnimatePresence>

      {navMapEl}
    </LessonFrame>
  );
}
