"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { LessonFrame } from "./LessonFrame";
import { CourseCover } from "./CourseCover";
import { CourseComplete } from "./CourseComplete";
import { ChapterIntro } from "./ChapterIntro";
import { NavMap } from "./NavMap";
import { CompletionBurst } from "./CompletionBurst";
import { ContentLesson } from "./ContentLesson";
import { LessonLayer } from "./LessonLayer";
import { useLessonProgress } from "@/hooks/useLessonProgress";
import { useCourseNavigation } from "@/hooks/useCourseNavigation";
import {
  deriveCourseStructure,
  getChapterLessons,
} from "@/lib/course-structure";
import type { CourseSection, SanityCourse } from "@/lib/contracts/sanity";

const ProductStage = dynamic(() => import("./ProductStage").then((m) => ({ default: m.ProductStage })));
const QuizLesson = dynamic(() => import("./QuizLesson").then((m) => ({ default: m.QuizLesson })));
const VideoLesson = dynamic(() => import("./VideoLesson").then((m) => ({ default: m.VideoLesson })));
const SpecificationPage = dynamic(() => import("./SpecificationPage").then((m) => ({ default: m.SpecificationPage })));
const DisclaimerPage = dynamic(() => import("./DisclaimerPage").then((m) => ({ default: m.DisclaimerPage })));

// ── Framer Motion slide variants ─────────────────────────────────────────────

const slideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? "50%" : "-50%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction < 0 ? "50%" : "-50%", opacity: 0 }),
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function MotoViewer({
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
  // One source of truth for section grouping/indexing (shared with NavMap)
  const structure = useMemo(() => deriveCourseStructure(sections), [sections]);
  const nav = useCourseNavigation(structure);
  const { phase, navDirection, showChapterIntro, showBurst } = nav;

  const [showNavMap, setShowNavMap] = useState(false);

  // Layer panel state — lastLayerId lets LayerFrame animate out gracefully
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [lastLayerId, setLastLayerId] = useState<string | null>(null);

  // ── Session ───────────────────────────────────────────────────────────────
  // Initialize as "" so SSR and the first client render agree (no hydration
  // mismatch); the real UUID is read/created from localStorage on the client.
  const [sessionId, setSessionId] = useState<string>("");
  useEffect(() => {
    let sid = localStorage.getItem("mototutor_session");
    if (!sid) {
      sid = crypto.randomUUID();
      localStorage.setItem("mototutor_session", sid);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSessionId(sid);
  }, []);
  const { visited, markVisited: baseMarkVisited } = useLessonProgress(sessionId);

  // ── Current lesson (chapter phase only) ───────────────────────────────────
  const currentLesson =
    phase.phase === "chapter"
      ? getChapterLessons(structure, phase.chapterIndex)[phase.lessonIndex]
      : undefined;
  const lessonKey = currentLesson?._key ?? "";
  const hotspots = useMemo(() => currentLesson?.hotspots ?? [], [currentLesson]);
  const visitedOnLesson = visited[lessonKey]?.size ?? 0;
  const nextLocked =
    hotspots.length > 0 && hotspots.some((h) => !visited[lessonKey]?.has(h.label));

  const markVisited = (label: string) =>
    baseMarkVisited(lessonKey, label, hotspots.length);

  function openLayerById(id: string) {
    const hotspot = hotspots.find((h) => h._key === id);
    baseMarkVisited(lessonKey, hotspot?.label ?? "", hotspots.length);
    setLastLayerId(id);
    setActiveLayerId(id);
  }

  // ── Navigation wrappers (close transient overlays before moving) ──────────
  const goNext = () => nav.goNext(nextLocked);
  const goPrev = nav.goPrev;

  function navigateToSection(i: number) {
    setShowNavMap(false);
    setActiveLayerId(null);
    nav.navigateToSection(i);
  }

  function restart() {
    setActiveLayerId(null);
    nav.restart();
  }

  // ── Completion stats ──────────────────────────────────────────────────────
  const totalHotspotsVisited = Object.values(visited).reduce((sum, s) => sum + s.size, 0);
  const totalHotspots = structure.lessonSections.reduce(
    (sum, s) => sum + (s.hotspots?.length ?? 0),
    0
  );

  // ── Context for lesson-type AI quizzes ────────────────────────────────────
  const buildQuizContext = () =>
    [
      `Product: ${course.title}`,
      `Features: ${structure.lessonSections
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

  // ── Phase switch — slide key + screen content ─────────────────────────────
  function renderPhase(): { slideKey: string; screen: React.ReactNode } {
    switch (phase.phase) {
      case "cover": {
        const coverImage =
          course.coverImage?.asset?.url ||
          course.thumbnail?.asset?.url ||
          structure.lessonSections[0]?.media?.asset?.url;
        return {
          slideKey: "cover",
          screen: (
            <CourseCover
              title={course.title}
              coverHeadline={course.coverHeadline}
              coverImage={coverImage}
              buttonText={course.coverButtonText}
              buttonColor={course.coverButtonColor}
              learningObjectives={course.learningObjectives}
              onStart={goNext}
            />
          ),
        };
      }

      case "specifications": {
        const spec = structure.specSections[phase.specIndex];
        return {
          slideKey: `spec-${phase.specIndex}`,
          screen: spec ? (
            <SpecificationPage spec={spec} onNext={goNext} onPrev={goPrev} showPrev={true} />
          ) : null,
        };
      }

      case "quiz":
        return {
          slideKey: "quiz",
          screen: structure.quizSection ? (
            <QuizLesson
              sanityQuiz={structure.quizSection}
              onPass={nav.finishQuiz}
              onFail={nav.finishQuiz}
              passingScore={structure.quizSection.passingScore}
              sessionId={sessionId}
              courseId={course._id}
            />
          ) : null,
        };

      case "disclaimer":
        return {
          slideKey: "disclaimer",
          screen: structure.disclaimerSection ? (
            <DisclaimerPage
              disclaimer={structure.disclaimerSection}
              onNext={goNext}
              onPrev={goPrev}
              showPrev={true}
            />
          ) : null,
        };

      case "complete":
        return {
          slideKey: "complete",
          screen: (
            <CourseComplete
              moduleTitle={course.title}
              totalLessons={structure.lessonSections.length}
              totalHotspotsVisited={totalHotspotsVisited}
              totalHotspots={totalHotspots}
              onRestart={restart}
            />
          ),
        };

      case "chapter": {
        if (!currentLesson) return { slideKey: "empty", screen: null };

        if (showChapterIntro) {
          const chapter = structure.chapters.find(
            (c) => c.chapterIndex === phase.chapterIndex
          );
          return {
            slideKey: `intro-${phase.chapterIndex}`,
            screen: (
              <ChapterIntro
                chapterTitle={chapter?.chapterTitle ?? ""}
                chapterNumber={phase.chapterIndex + 1}
                totalChapters={structure.chapters.length}
                onContinue={nav.dismissChapterIntro}
              />
            ),
          };
        }

        switch (currentLesson.lessonType) {
          case "stage":
            return {
              slideKey: `stage-${currentLesson._key}`,
              screen: (
                <ProductStage
                  headline={currentLesson.headline}
                  productImage={currentLesson.media?.asset?.url}
                  stageBackground={currentLesson.stageBackground?.asset?.url}
                  enableCompletionAnimation={currentLesson.enableCompletionAnimation}
                  completionTransition={currentLesson.completionTransition}
                  hotspots={hotspots}
                  visited={visited[lessonKey] ?? new Set()}
                  onVisit={markVisited}
                  onNext={goNext}
                  onPrev={goPrev}
                  course_title={course.title}
                  course_description={course.description}
                  onOpenLayer={openLayerById}
                />
              ),
            };
          case "video":
            return {
              slideKey: `video-${currentLesson._key}`,
              screen: (
                <VideoLesson
                  headline={currentLesson.headline}
                  videoFileUrl={currentLesson.videoFile?.asset?.url}
                  videoAspectRatio={currentLesson.videoAspectRatio}
                  onNext={goNext}
                />
              ),
            };
          case "quiz":
            return {
              slideKey: `quiz-lesson-${currentLesson._key}`,
              screen: (
                <QuizLesson
                  context={buildQuizContext()}
                  onPass={goNext} // lesson-type quiz advances on pass and fail (no gate)
                  onFail={goNext}
                  passingScore={80}
                  sessionId={sessionId}
                  courseId={course._id}
                />
              ),
            };
          default:
            return {
              slideKey: `lesson-${currentLesson._key}`,
              screen: (
                <ContentLesson
                  lesson={currentLesson}
                  hotspots={hotspots}
                  visitedLabels={visited[lessonKey] ?? new Set()}
                  onVisit={markVisited}
                  onOpenLayer={openLayerById}
                  courseTitle={course.title}
                  courseDescription={course.description}
                />
              ),
            };
        }
      }
    }
  }

  const { slideKey, screen } = renderPhase();

  // ── LessonFrame props vary by phase ───────────────────────────────────────
  const isContentLesson =
    phase.phase === "chapter" &&
    !showChapterIntro &&
    currentLesson !== undefined &&
    !["stage", "video", "quiz"].includes(currentLesson.lessonType);

  const frameProps =
    phase.phase === "cover"
      ? { moduleTitle: course.title }
      : isContentLesson
      ? {
          // totalSections + 1 keeps LessonFrame from disabling "Next" at the
          // very last section (the navigation reducer handles that boundary).
          currentLesson: nav.currentSectionIndex >= 0 ? nav.currentSectionIndex + 1 : 1,
          totalLessons: structure.totalSections + 1,
          onPrev: goPrev,
          onNext: goNext,
          nextDisabled: nextLocked,
          onToggleNavMap: () => setShowNavMap((v) => !v),
          moduleTitle: course.title,
          completionHint: nextLocked
            ? `Tap all ${hotspots.length} features to continue (${visitedOnLesson} / ${hotspots.length})`
            : undefined,
        }
      : { onToggleNavMap: () => setShowNavMap((v) => !v), moduleTitle: course.title };

  // Active layer content for the shared LessonLayer panel
  const layerTargetId = activeLayerId ?? lastLayerId;
  const activeLayerContent = layerTargetId
    ? hotspots.find((h) => h._key === layerTargetId)?.layerContent
    : undefined;

  // ── Render — one persistent AnimatePresence across all phases ─────────────
  return (
    <LessonFrame {...frameProps}>
      <AnimatePresence mode="wait" custom={navDirection}>
        <motion.div
          key={slideKey}
          custom={navDirection}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="absolute inset-0"
        >
          {screen}
        </motion.div>
      </AnimatePresence>

      {showNavMap && (
        <NavMap
          structure={structure}
          currentSectionIndex={nav.currentSectionIndex}
          visited={visited}
          onNavigate={navigateToSection}
          onClose={() => setShowNavMap(false)}
        />
      )}

      <LessonLayer
        open={activeLayerId !== null}
        onClose={() => setActiveLayerId(null)}
        parentLessonTitle={currentLesson?.headline ?? ""}
        layerContent={activeLayerContent}
      />

      <CompletionBurst active={showBurst} />
    </LessonFrame>
  );
}
