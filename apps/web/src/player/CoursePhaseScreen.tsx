'use client';

import dynamic from 'next/dynamic';
import { CourseCover } from '@/components/CourseCover';
import { CourseComplete } from '@/components/CourseComplete';
import type { CourseStructure } from '@/lib/course-structure';
import type { LessonSection, CourseContent } from '@/lib/contracts/player-course';
import type { CoursePhase } from './hooks/useCourseNavigation';
import type { LessonRuntime } from './hooks/useLessonRuntime';
import { ChapterIntro } from './ChapterIntro';
import { LessonRenderer } from './LessonRenderer';

const CourseQuizDynamic = dynamic(() =>
  import('@/components/course-ai/CourseQuiz').then((m) => ({ default: m.CourseQuiz })),
);
const QuizLessonDynamic = dynamic(() =>
  import('./lesson-types/QuizLesson').then((m) => ({ default: m.QuizLesson })),
);
const SpecificationPage = dynamic(() =>
  import('@/components/SpecificationPage').then((m) => ({ default: m.SpecificationPage })),
);
const DisclaimerPage = dynamic(() =>
  import('@/components/DisclaimerPage').then((m) => ({ default: m.DisclaimerPage })),
);

export interface CoursePhaseScreenProps {
  phase: CoursePhase;
  course: CourseContent;
  structure: CourseStructure;
  lessonRuntime: LessonRuntime;
  weakTopics: string[];
  sessionId: string;
  persistSession: boolean;
  showChapterIntro: boolean;
  totalHotspotsVisited: number;
  totalHotspots: number;
  goNext: () => void;
  goPrev: () => void;
  finishQuiz: () => void;
  finishChapterQuiz: (chapterIndex: number) => void;
  dismissChapterIntro: () => void;
  onDisclaimerCanProceedChange: (canProceed: boolean) => void;
}

export function getCoursePhaseSlideKey(args: {
  phase: CoursePhase;
  currentLesson?: LessonSection;
  showChapterIntro: boolean;
}): string {
  const { phase, currentLesson, showChapterIntro } = args;

  switch (phase.phase) {
    case 'cover':
      return 'cover';
    case 'specifications':
      return `spec-${phase.specIndex}`;
    case 'quiz':
      return 'quiz';
    case 'chapter-quiz':
      return `chapter-quiz-${phase.chapterIndex}`;
    case 'disclaimer':
      return 'disclaimer';
    case 'complete':
      return 'complete';
    case 'chapter':
      if (showChapterIntro) return `intro-${phase.chapterIndex}`;
      return currentLesson ? `lesson-${currentLesson._key}` : 'empty';
  }
}

export function CoursePhaseScreen({
  phase,
  course,
  structure,
  lessonRuntime,
  weakTopics,
  sessionId,
  persistSession,
  showChapterIntro,
  totalHotspotsVisited,
  totalHotspots,
  goNext,
  goPrev,
  finishQuiz,
  finishChapterQuiz,
  dismissChapterIntro,
  onDisclaimerCanProceedChange,
}: CoursePhaseScreenProps) {
  const { currentLesson } = lessonRuntime;
  switch (phase.phase) {
    case 'cover': {
      const coverImage =
        course.coverImage?.asset?.url ||
        course.thumbnail?.asset?.url ||
        structure.lessonSections[0]?.media?.asset?.url;

      return (
        <CourseCover
          title={course.title}
          coverHeadline={course.coverHeadline}
          coverImage={coverImage}
          buttonText={course.coverButtonText}
          buttonColor={course.coverButtonColor}
          learningObjectives={course.learningObjectives}
          onStart={goNext}
        />
      );
    }

    case 'specifications': {
      const spec = structure.specSections[phase.specIndex];
      return spec ? <SpecificationPage spec={spec} /> : null;
    }

    case 'quiz':
      return (
        <div className="absolute inset-0 flex items-center justify-center overflow-y-auto bg-[#111225] p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(104,91,199,0.42),transparent_42%)]" />
          <div className="relative w-full max-w-2xl rounded-[2rem] border border-white/12 bg-white/96 p-4 shadow-[0_32px_90px_rgba(0,0,0,0.42)] md:p-8">
            <p className="mb-5 text-center text-xs font-semibold tracking-[0.22em] text-[#685bc7] uppercase">
              Final knowledge check
            </p>
            <CourseQuizDynamic
              weakTopics={weakTopics}
              onPass={finishQuiz}
              onFail={finishQuiz}
              sessionId={persistSession ? sessionId : undefined}
              courseId={course._id}
            />
          </div>
        </div>
      );

    case 'chapter-quiz': {
      const chapterGroup = structure.chapters.find(
        (chapter) => chapter.chapterIndex === phase.chapterIndex,
      );

      return (
        <div className="absolute inset-0 flex items-center justify-center overflow-y-auto bg-[#111225] p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(104,91,199,0.42),transparent_42%)]" />
          <QuizLessonDynamic
            courseQuiz={chapterGroup?.quickCheck}
            weakTopics={weakTopics}
            onPass={() => finishChapterQuiz(phase.chapterIndex)}
            onFail={() => finishChapterQuiz(phase.chapterIndex)}
            sessionId={persistSession ? sessionId : undefined}
            courseId={course._id}
          />
        </div>
      );
    }

    case 'disclaimer':
      return structure.disclaimerSection ? (
        <DisclaimerPage
          disclaimer={structure.disclaimerSection}
          onNext={goNext}
          onCanProceedChange={onDisclaimerCanProceedChange}
        />
      ) : null;

    case 'complete':
      return (
        <CourseComplete
          moduleTitle={course.title}
          totalLessons={structure.lessonSections.length}
          totalHotspotsVisited={totalHotspotsVisited}
          totalHotspots={totalHotspots}
        />
      );

    case 'chapter': {
      if (!currentLesson) return null;

      if (showChapterIntro) {
        const chapter = structure.chapters.find((item) => item.chapterIndex === phase.chapterIndex);

        return (
          <ChapterIntro
            chapterTitle={chapter?.chapterTitle ?? ''}
            onContinue={dismissChapterIntro}
          />
        );
      }

      return (
        <LessonRenderer
          lesson={currentLesson}
          lessonKey={lessonRuntime.lessonKey}
          hotspots={lessonRuntime.hotspots}
          visited={lessonRuntime.visitedLabels}
          isSpecialComplete={lessonRuntime.isSpecialComplete}
          goNext={goNext}
          goPrev={goPrev}
          markVisited={lessonRuntime.markVisited}
          baseMarkVisited={lessonRuntime.baseMarkVisited}
          weakTopics={weakTopics}
          sessionId={sessionId}
          persistSession={persistSession}
          courseId={course._id}
        />
      );
    }
  }
}
