'use client';

import { CourseQuiz } from '@/components/course-ai/CourseQuiz';
import type { AuthoredQuiz } from '@/lib/contracts/player-course';

import { CourseQuizPlayer } from '@/components/CourseQuizPlayer';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface QuizLessonProps {
  /** Topics the learner has not explored yet — steers AI quiz generation when courseQuiz is absent. */
  weakTopics?: string[];
  /** When provided, renders the authored questions instead of an AI quiz. */
  courseQuiz?: AuthoredQuiz;
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
// Authored quizzes render directly; otherwise an adaptive AI quiz
// is generated from the uploaded course materials via /api/quiz. Both sources
// are graded exclusively server-side by /api/quiz/grade.

export function QuizLesson({
  weakTopics,
  courseQuiz,
  onPass,
  onFail,
  sessionId,
  courseId,
}: QuizLessonProps) {
  if (courseQuiz) {
    return (
      <CourseQuizPlayer
        courseQuiz={courseQuiz}
        onPass={onPass}
        onFail={onFail}
        sessionId={sessionId}
        courseId={courseId}
      />
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col overflow-y-auto bg-[#111225] p-6 text-white md:p-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(104,91,199,0.42),transparent_40%)]" />
      <div className="relative mx-auto w-full max-w-2xl space-y-12 pb-24 text-center">
        <div>
          <p className="text-xs font-semibold tracking-[0.22em] text-[#c4beff] uppercase">
            Practice challenge
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Knowledge Check</h1>
          <p className="mt-2 text-lg text-white/65">
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
