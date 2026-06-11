'use client';

import { CourseQuiz } from '@/components/course-ai/CourseQuiz';
import type { SanityQuizDoc } from '@/lib/contracts/sanity';

export interface QuizLessonProps {
  context?: string;
  sanityQuiz?: SanityQuizDoc;
  onPass: (score: number) => void;
  onFail: () => void;
  sessionId?: string;
  courseId?: string;
}

export function QuizLesson({ onPass, courseId }: QuizLessonProps) {
  return (
    <div className="bg-background absolute inset-0 flex flex-col overflow-y-auto p-6 md:p-12">
      <div className="mx-auto w-full max-w-2xl space-y-12 pb-24 text-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Knowledge Check
          </h1>
          <p className="mt-2 text-muted-foreground text-lg">
            Test your knowledge with a custom-generated adaptive quiz based on your analytics.
          </p>
        </div>
        <div className="flex justify-center">
          <CourseQuiz courseId={courseId} onPass={onPass} />
        </div>
      </div>
    </div>
  );
}
