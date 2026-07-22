'use client';

import { CourseQuiz } from '@/components/course-ai/CourseQuiz';
import type { LessonSection, SanityHotspot } from '@/lib/contracts/sanity';
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
  hotspots: SanityHotspot[];
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
        <div className="bg-background absolute inset-0 flex items-center justify-center overflow-y-auto p-6">
          <CourseQuiz
            weakTopics={weakTopics}
            onPass={goNext}
            onFail={goNext}
            sessionId={persistSession ? sessionId : undefined}
            courseId={courseId}
          />
        </div>
      );
      break;

    case 'colorSwitcher':
      lessonContent = <ColorSwitcherLessonDynamic lesson={lesson} />;
      break;

    case 'splitScreen':
      lessonContent = <SplitScreenLessonDynamic lesson={lesson} />;
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
