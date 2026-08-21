import { RefreshCw, Brain } from 'lucide-react';

export function CourseFinalAssessmentCard({
  title = 'Course assessment',
  instructions,
  questionCount,
  score,
  passed,
  correctAnswers,
  total,
  passingScore,
  onStart,
  onContinue,
  onRetry,
}: {
  title?: string;
  instructions?: string;
  questionCount?: number;
  score?: number;
  passed?: boolean;
  correctAnswers?: number;
  total?: number;
  passingScore?: number;
  onStart?: () => void;
  onContinue?: () => void;
  onRetry?: () => void;
}) {
  const isResult = score !== undefined && passed !== undefined;

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[#111225] p-10">
      <div className="relative flex h-[600px] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-white/96 shadow-xl">
        <header className="flex items-center border-b border-[#18191d]/10 px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#685bc7] text-white shadow-md">
            <Brain aria-hidden="true" className="h-5 w-5" />
          </div>
          <div className="ml-4">
            <h2 className="text-lg font-semibold text-[#27272c]">Course assessment</h2>
            <p className="text-xs text-[#595b66]">Complete course recap</p>
          </div>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          {isResult ? (
            <>
              <div
                className={`mb-6 flex h-24 w-24 items-center justify-center rounded-full shadow-lg ${passed ? 'bg-[#685bc7] text-white' : 'bg-[#e8e7eb] text-[#27272c]'}`}
              >
                <span className="text-3xl font-bold">{score}%</span>
              </div>
              <h3 className="mb-2 text-2xl font-bold text-[#27272c]">
                {passed ? 'Assessment complete' : 'Keep practicing'}
              </h3>
              <p className="text-[#595b66]">
                You got {correctAnswers} out of {total} questions correct.
              </p>
              {!passed && (
                <p className="mt-1 text-sm text-[#595b66]">Passing score: {passingScore}%</p>
              )}
              <div className="mt-8 flex flex-col items-center gap-3">
                {passed ? (
                  <button
                    type="button"
                    onClick={onContinue}
                    className="rounded-full border-2 border-[#685bc7] px-8 py-3 text-sm font-medium text-[#685bc7] transition-colors hover:bg-[#685bc7]/8"
                  >
                    Continue
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={onRetry}
                      className="inline-flex items-center gap-2 rounded-full border-2 border-[#685bc7] px-8 py-3 text-sm font-medium text-[#685bc7] transition-colors hover:bg-[#685bc7]/8"
                    >
                      <RefreshCw aria-hidden="true" className="h-4 w-4" /> Try again
                    </button>
                    <button
                      type="button"
                      onClick={onContinue}
                      className="text-sm font-medium text-[#595b66] underline underline-offset-4 hover:text-[#27272c]"
                    >
                      Continue without passing
                    </button>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-[#685bc7]/12">
                <Brain aria-hidden="true" className="h-12 w-12 text-[#685bc7]" />
              </div>
              <h3 className="mb-2 text-2xl font-bold text-[#27272c]">{title}</h3>
              <p className="max-w-md text-[#595b66]">{instructions}</p>
              {questionCount !== undefined && (
                <p className="mt-3 text-sm font-medium text-[#595b66]">{questionCount} questions</p>
              )}
              <button
                type="button"
                onClick={onStart}
                className="mt-8 rounded-full bg-[#685bc7] px-8 py-3.5 text-sm font-medium text-white transition-colors hover:bg-[#5b4eb8]"
              >
                Start assessment
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
