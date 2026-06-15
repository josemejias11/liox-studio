'use client';

import { CourseQuiz } from '@/components/course-ai/CourseQuiz';
import type { LessonSection, SanityHotspot } from '@/lib/contracts/sanity';
import {
  ContentLessonDynamic,
  ProductStageDynamic,
  VideoLessonDynamic,
  ColorSwitcherLessonDynamic,
  SplitScreenLessonDynamic,
  DragDropLessonDynamic,
  ScrollStoryLessonDynamic,
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
  switch (lesson.lessonType) {
    case 'stage':
      return (
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

    case 'video':
      return (
        <VideoLessonDynamic
          headline={lesson.headline}
          videoFileUrl={lesson.videoFile?.asset?.url}
          videoAspectRatio={lesson.videoAspectRatio}
          onNext={goNext}
        />
      );

    case 'quiz':
      return (
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

    case 'colorSwitcher':
      return <ColorSwitcherLessonDynamic lesson={lesson} />;

    case 'splitScreen':
      return <SplitScreenLessonDynamic lesson={lesson} />;

    case 'dragDrop':
      return (
        <DragDropLessonDynamic
          lesson={lesson}
          isCompleted={isSpecialComplete}
          onComplete={() => markVisited('completed')}
        />
      );

    case 'scrollStory':
      return (
        <ScrollStoryLessonDynamic
          lesson={lesson}
          isCompleted={isSpecialComplete}
          onComplete={() => baseMarkVisited(lessonKey, 'completed', 1)}
        />
      );

    default:
      return (
        <ContentLessonDynamic
          lesson={lesson}
          hotspots={hotspots}
          visitedLabels={visited}
          onVisit={markVisited}
          courseId={courseId}
        />
      );
  }
}
