'use client';

import { CourseQuiz } from '@/components/course-ai/CourseQuiz';
import type { SanityQuizDoc } from '@/lib/contracts/sanity';

import { SanityQuizPlayer } from '@/components/SanityQuizPlayer';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface QuizLessonProps {
  /** Topics the learner has not explored yet — steers AI quiz generation when sanityQuiz is absent. */
  weakTopics?: string[];
  /** When provided, renders the Sanity-authored questions instead of an AI quiz. */
  sanityQuiz?: SanityQuizDoc;
  /** Called with the server-graded score 0–100 (percentage) on pass. */
  onPass: (score: number) => void;
  /** Called when the learner fails and retry is not allowed (or chooses to move on). */
  onFail: () => void;
  /**
   * Session identity for recording the attempt server-side. Omit when storage
   * consent was declined — the quiz still grades, but nothing is persisted.
   */
  sessionId?: string;
  courseId?: string;
}

// ── Lesson entry point ────────────────────────────────────────────────────────
// CMS-authored quizzes render the Sanity player; otherwise an adaptive AI quiz
// is generated from the uploaded course materials via /api/quiz. Both sources
// are graded exclusively server-side by /api/quiz/grade.

export function QuizLesson({
  weakTopics,
  sanityQuiz,
  onPass,
  onFail,
  sessionId,
  courseId,
}: QuizLessonProps) {
  if (sanityQuiz) {
    return (
      <SanityQuizPlayer
        sanityQuiz={sanityQuiz}
        onPass={onPass}
        onFail={onFail}
        sessionId={sessionId}
        courseId={courseId}
      />
    );
  }

  return (
    <div className="bg-background absolute inset-0 flex flex-col overflow-y-auto p-6 md:p-12">
      <div className="mx-auto w-full max-w-2xl space-y-12 pb-24 text-center">
        <div>
          <h1 className="text-foreground text-3xl font-bold tracking-tight md:text-4xl">
            Knowledge Check
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Test your knowledge with a quiz generated from this course.
          </p>
        </div>
        <div className="flex justify-center">
          <CourseQuiz
            courseId={courseId}
            weakTopics={weakTopics}
            sessionId={sessionId}
            onPass={onPass}
            onFail={onFail}
          />
        </div>
      </div>
    </div>
  );
}
