'use client';

import { CourseQuiz } from './CourseQuiz';
import type { AuthoredQuiz } from '@/shared/contracts/player-course';
import type { RevisionIdentity } from '@/shared/contracts/api';

import { CourseQuizPlayer } from './CourseQuizPlayer';

export interface QuizLessonProps {

  weakTopics?: string[];

  courseQuiz?: AuthoredQuiz;

  onPass: (score: number) => void;

  onFail: () => void;

  sessionId?: string;
  courseId?: string;
  preview?: boolean;
  aiIdentity?: RevisionIdentity;
}

export function QuizLesson({
  weakTopics,
  courseQuiz,
  onPass,
  onFail,
  sessionId,
  courseId,
  preview = false,
  aiIdentity,
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
            {...aiIdentity}
            courseId={courseId}
            weakTopics={weakTopics}
            sessionId={sessionId}
            onPass={onPass}
            onFail={onFail}
            preview={preview}
          />
        </div>
      </div>
    </div>
  );
}
