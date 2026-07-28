'use client';

import { CourseQuiz } from '@/components/course-ai/CourseQuiz';
import type { LessonSection, CourseHotspot } from '@/lib/contracts/player-course';
import { RefresherFeaturePanel } from './RefresherFeaturePanel';
import {
  ContentLessonDynamic,
  ProductStageDynamic,
  VideoLessonDynamic,
  ColorSwitcherLessonDynamic,
  SplitScreenLessonDynamic,
  DragDropLessonDynamic,
  ScrollStoryLessonDynamic,
  CanvasInspectionLessonDynamic,
  getLessonCompletionMode,
  LessonCompletionMode,
} from './lesson-types/registry';

export interface LessonRendererProps {
  lesson: LessonSection;
  lessonKey: string;
  hotspots: CourseHotspot[];
  visited: Set<string>;
  isSpecialComplete: boolean;
  goNext: () => void;
  goPrev: () => void;
  markVisited: (label: string) => void;
  baseMarkVisited: (key: string, label: string, total: number) => void;
  weakTopics: string[];
  sessionId: string;
  persistSession: boolean;
  courseId: string;
  preview: boolean;
}

export function LessonRenderer({
  lesson,
  lessonKey,
  hotspots,
  visited,
  isSpecialComplete,
  goNext,
  goPrev,
  markVisited,
  baseMarkVisited,
  weakTopics,
  sessionId,
  persistSession,
  courseId,
  preview,
}: LessonRendererProps) {
  const completionMode = getLessonCompletionMode(lesson);
  const handleManualCompletion =
    completionMode === LessonCompletionMode.MANUAL
      ? () => baseMarkVisited(lessonKey, 'completed', 1)
      : undefined;

  let lessonContent: React.ReactNode;

  switch (lesson.lessonType) {
    case 'stage':
      lessonContent = (
        <ProductStageDynamic
          headline={lesson.headline}
          body={lesson.body}
          productImage={lesson.media?.asset?.url}
          stageBackground={lesson.stageBackground?.asset?.url}
          enableCompletionAnimation={lesson.enableCompletionAnimation}
          completionTransition={lesson.completionTransition}
          hotspots={hotspots}
          visited={visited}
          onVisit={markVisited}
          onNext={goNext}
          onPrev={goPrev}
          courseId={courseId}
          preview={preview}
        />
      );
      break;

    case 'video':
      lessonContent = (
        <VideoLessonDynamic
          headline={lesson.headline}
          videoFileUrl={lesson.videoFile?.asset?.url}
          videoAspectRatio={lesson.videoAspectRatio}
          onComplete={handleManualCompletion}
        />
      );
      break;

    case 'quiz':
      lessonContent = (
        <div className="absolute inset-0 flex items-center justify-center overflow-y-auto bg-[#111225] p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(104,91,199,0.42),transparent_42%)]" />
          <div className="relative w-full max-w-2xl rounded-[2rem] border border-white/12 bg-white/96 p-4 shadow-[0_32px_90px_rgba(0,0,0,0.42)] md:p-8">
            <p className="mb-5 text-center text-xs font-semibold tracking-[0.22em] text-[#685bc7] uppercase">
              Practice challenge
            </p>
            <CourseQuiz
              weakTopics={weakTopics}
              onPass={goNext}
              onFail={goNext}
              sessionId={persistSession ? sessionId : undefined}
              courseId={courseId}
              preview={preview}
            />
          </div>
        </div>
      );
      break;

    case 'colorSwitcher':
      lessonContent = <ColorSwitcherLessonDynamic lesson={lesson} />;
      break;

    case 'splitScreen':
      lessonContent = (
        <SplitScreenLessonDynamic lesson={lesson} visitedLabels={visited} onVisit={markVisited} />
      );
      break;

    case 'dragDrop':
      lessonContent = (
        <DragDropLessonDynamic
          lesson={lesson}
          isCompleted={isSpecialComplete}
          onComplete={handleManualCompletion ?? (() => markVisited('completed'))}
        />
      );
      break;

    case 'scrollStory':
      lessonContent = (
        <ScrollStoryLessonDynamic
          lesson={lesson}
          isCompleted={isSpecialComplete}
          onComplete={handleManualCompletion ?? (() => baseMarkVisited(lessonKey, 'completed', 1))}
          visitedLabels={visited}
          onVisit={markVisited}
        />
      );
      break;

    case 'canvas':
      lessonContent = (
        <CanvasInspectionLessonDynamic
          lesson={lesson}
          visitedLabels={visited}
          onVisit={markVisited}
          courseId={courseId}
          preview={preview}
        />
      );
      break;

    default:
      lessonContent = (
        <ContentLessonDynamic
          lesson={lesson}
          hotspots={hotspots}
          visitedLabels={visited}
          onVisit={markVisited}
          courseId={courseId}
          preview={preview}
        />
      );
  }

  return (
    <>
      {lessonContent}
      <RefresherFeaturePanel lesson={lesson} visitedLabels={visited} onVisit={markVisited} />
    </>
  );
}
