'use client';

import type { AuthoredQuiz } from '@/shared/contracts/player-course';

import { CourseQuizPlayer } from './CourseQuizPlayer';

export interface QuizLessonProps {
  courseQuiz?: AuthoredQuiz;

  onPass: (score: number) => void;

  onFail: () => void;

  sessionId?: string;
  courseId?: string;
  preview?: boolean;
  presentation?: 'checkpoint' | 'course-final';
}

export function QuizLesson({
  courseQuiz,
  onPass,
  onFail,
  sessionId,
  courseId,
  preview = false,
  presentation = 'checkpoint',
}: QuizLessonProps) {
  if (courseQuiz) {
    return (
      <CourseQuizPlayer
        courseQuiz={courseQuiz}
        onPass={onPass}
        onFail={onFail}
        sessionId={sessionId}
        courseId={courseId}
        preview={preview}
        presentation={presentation}
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
            This course does not include an authored knowledge check for this section.
          </p>
        </div>
        <div className="flex justify-center">
          <button
            className="bg-primary text-primary-foreground rounded-lg px-4 py-2"
            onClick={onFail}
            type="button"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
