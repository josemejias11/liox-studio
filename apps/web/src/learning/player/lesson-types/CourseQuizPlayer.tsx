'use client';

import { useEffect, useReducer, useRef, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';

import { CheckCircle2, XCircle, Loader2, ChevronRight, Trophy, RefreshCw } from 'lucide-react';

import {
  QuestionResultSchema,
  SubmitQuizResponseSchema,
  type ClientQuiz,
} from '@lb-studio/contracts/quiz';
import { createQuizSessionState, quizSessionReducer } from '@/learning/quiz-session';
import type { AuthoredQuiz } from '@/shared/contracts/player-course';
import { CourseFinalAssessmentCard } from './CourseFinalAssessmentCard';

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function toClientQuiz(courseQuiz: AuthoredQuiz): ClientQuiz {
  return {
    quizId: courseQuiz._key,
    source: 'course',
    title: courseQuiz.title ?? '',
    ...(courseQuiz.instructions !== undefined ? { instructions: courseQuiz.instructions } : {}),
    questions: courseQuiz.questions.map((q) => ({
      question: q.questionText,
      options: q.answers.map((a) => a.text),
      ...(q.image?.asset?.url !== undefined ? { image_url: q.image.asset.url } : {}),
    })),
  };
}

export interface CourseQuizPlayerProps {
  courseQuiz: AuthoredQuiz;
  onPass: (score: number) => void;
  onFail?: () => void;
  onScored?: (result: { score: number; total: number; passed: boolean }) => void;

  sessionId?: string;
  courseId?: string;
  preview?: boolean;
  presentation?: 'checkpoint' | 'course-final';
}

export function CourseQuizPlayer({
  courseQuiz,
  onPass,
  onFail,
  onScored,

  sessionId,
  courseId,
  preview = false,
  presentation = 'checkpoint',
}: CourseQuizPlayerProps) {
  const [quiz] = useState<ClientQuiz>(() => toClientQuiz(courseQuiz));
  const [session, dispatch] = useReducer(quizSessionReducer, undefined, createQuizSessionState);
  const [grading, setGrading] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [started, setStarted] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const isCourseFinal = presentation === 'course-final';

  useEffect(() => {
    const pendingTimers = timers.current;
    return () => pendingTimers.forEach(clearTimeout);
  }, []);

  async function handleSelect(optionIndex: number) {
    if (session.selectedIndex !== null || grading) return;
    dispatch({ type: 'answer.selected', selectedIndex: optionIndex });

    if (preview) {
      const question = courseQuiz.questions[session.currentQuestionIndex];
      const correctIndex = question?.answers.findIndex((answer) => answer.isCorrect) ?? -1;

      if (correctIndex < 0) {
        dispatch({
          type: 'answer.failed',
          message: 'This question needs a correct answer before it can be previewed.',
        });
        return;
      }

      const correct = optionIndex === correctIndex;
      dispatch({
        type: 'answer.revealed',
        selectedIndex: optionIndex,
        result: {
          correct,
          correctIndex,
          explanation: correct
            ? 'Correct answer.'
            : 'Incorrect. The highlighted option is the correct answer.',
        },
      });

      if (!correct) {
        setIsShaking(true);
        timers.current.push(setTimeout(() => setIsShaking(false), 400));
      }
      return;
    }

    setGrading(true);

    try {
      const res = await fetch('/api/quiz/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'question',
          source: quiz.source,
          quizId: quiz.quizId,
          questionIndex: session.currentQuestionIndex,
          selectedIndex: optionIndex,
        }),
      });
      if (!res.ok) throw new Error(`Grade request failed (${res.status})`);
      const parsed = QuestionResultSchema.safeParse(await res.json());
      if (!parsed.success) throw new Error('Grade response failed validation');

      dispatch({
        type: 'answer.revealed',
        selectedIndex: optionIndex,
        result: parsed.data,
      });

      if (!parsed.data.correct) {
        setIsShaking(true);
        timers.current.push(setTimeout(() => setIsShaking(false), 400));
      }
    } catch {
      dispatch({
        type: 'answer.failed',
        message: "Couldn't check your answer — tap an option to try again.",
      });
    } finally {
      setGrading(false);
    }
  }

  async function submitQuiz(answers: number[]) {
    dispatch({ type: 'submission.started' });

    try {
      const res = await fetch('/api/quiz/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          source: quiz.source,
          quizId: quiz.quizId,
          answers,
          ...(courseId ? { courseId } : {}),
          ...(sessionId ? { sessionId } : {}),
        }),
      });
      if (!res.ok) throw new Error(`Submit request failed (${res.status})`);
      const parsed = SubmitQuizResponseSchema.safeParse(await res.json());
      if (!parsed.success) throw new Error('Submit response failed validation');

      dispatch({ type: 'submission.succeeded', summary: parsed.data });
      const pct = parsed.data.total > 0 ? parsed.data.score / parsed.data.total : 0;
      const pctScore = Math.round(pct * 100);
      if (isCourseFinal) return;

      if (parsed.data.passed) {
        onPass(pctScore);
      } else if (onFail) {
        onFail();
      } else {
        onPass(pctScore);
      }
    } catch {
      dispatch({ type: 'submission.failed', message: "Couldn't score your quiz." });
    }
  }

  function handleNext() {
    const isLastQuestion = session.currentQuestionIndex + 1 >= quiz.questions.length;

    if (isLastQuestion && preview && !isCourseFinal) {
      const correctAnswers = session.results.filter((result) => result?.correct).length;
      const previewScore = Math.round((correctAnswers / quiz.questions.length) * 100);
      onPass(previewScore);
      return;
    }

    if (isLastQuestion && preview && isCourseFinal) {
      const pass = courseQuiz.passingScore ?? 80;
      const results = session.results.filter(
        (result): result is NonNullable<typeof result> => result !== undefined,
      );
      const score = results.filter((result) => result.correct).length;
      dispatch({
        type: 'submission.succeeded',
        summary: {
          score,
          total: quiz.questions.length,
          passed: Math.round((score / quiz.questions.length) * 100) >= pass,
          passingScore: pass,
          results,
        },
      });
      return;
    }

    dispatch({ type: 'question.advanced', totalQuestions: quiz.questions.length });
    if (isLastQuestion) {
      void submitQuiz(session.answers);
    }
  }

  const total = quiz.questions.length;

  if (isCourseFinal && session.phase === 'complete' && session.summary) {
    const score = Math.round((session.summary.score / session.summary.total) * 100);
    return (
      <CourseFinalAssessmentCard
        score={score}
        passed={session.summary.passed}
        correctAnswers={session.summary.score}
        total={session.summary.total}
        passingScore={session.summary.passingScore}
        onContinue={() => {
          if (session.summary) {
            onScored?.({
              score: session.summary.score,
              total: session.summary.total,
              passed: session.summary.passed,
            });
          }
          if (session.summary?.passed) onPass(score);
          else onFail?.();
        }}
        onRetry={() => dispatch({ type: 'session.reset' })}
      />
    );
  }

  if (!started && quiz.instructions) {
    if (isCourseFinal) {
      return (
        <CourseFinalAssessmentCard
          title={quiz.title}
          instructions={quiz.instructions}
          questionCount={total}
          onStart={() => setStarted(true)}
        />
      );
    }
    return (
      <div className="quiz-enter absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-[#111225] px-8 text-center text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_62%_54%_at_50%_35%,rgba(104,91,199,0.55),transparent_70%)]" />
        <div className="relative flex max-w-lg flex-col items-center">
          <p className="mb-6 text-xs font-semibold tracking-[0.24em] text-[#c4beff] uppercase">
            Practice challenge
          </p>
          <Trophy className="mb-5 h-12 w-12 text-[#c4beff]" />
          <h2 className="mb-4 text-2xl leading-tight font-black md:text-3xl">{quiz.title}</h2>
          <p className="mx-auto mb-8 max-w-sm text-base leading-relaxed font-medium text-white/70">
            {quiz.instructions}
          </p>
          <button
            onClick={() => setStarted(true)}
            className="rounded-full bg-white px-8 py-3.5 text-lg font-black text-[#242051] shadow-2xl transition-transform hover:scale-105 hover:bg-white/92 active:scale-95"
          >
            Start Quiz
          </button>
        </div>
      </div>
    );
  }

  if (session.phase === 'submitting' && !session.summary) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#111225] text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(104,91,199,0.46),transparent_58%)]" />
        {session.error ? (
          <>
            <p className="relative text-sm text-white/70">{session.error}</p>
            <button
              onClick={() => {
                dispatch({ type: 'retry.requested' });
                void submitQuiz(session.answers);
              }}
              className="relative flex items-center gap-2 rounded-full border border-white/15 bg-white px-6 py-2.5 text-sm font-bold text-[#242051] shadow-2xl transition-transform duration-150 hover:bg-white/90 active:scale-95"
            >
              <RefreshCw className="h-4 w-4" /> Try Again
            </button>
          </>
        ) : (
          <>
            <Loader2 className="relative h-7 w-7 animate-spin text-[#c4beff]" />
            <p className="relative text-sm font-medium text-white/62">Scoring your answers…</p>
          </>
        )}
      </div>
    );
  }

  const q = quiz.questions[session.currentQuestionIndex];
  const result = session.results[session.currentQuestionIndex];
  const revealed = session.selectedIndex !== null && result !== undefined;

  return (
    <div
      className={`absolute inset-0 flex flex-col ${
        isCourseFinal
          ? 'items-center justify-center bg-[#111225] p-10'
          : 'bg-[#111225] text-white select-none'
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_65%_55%_at_50%_18%,rgba(104,91,199,0.48),transparent_72%)]" />

      <div
        className={
          isCourseFinal
            ? 'relative flex h-[600px] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-white/96 text-[#27272c] shadow-xl'
            : 'contents'
        }
      >
        <div
          className={`relative shrink-0 px-6 pt-5 pb-2 md:px-10 md:pt-7 ${isCourseFinal ? 'border-b border-[#18191d]/10 px-8 py-5' : ''}`}
        >
          <div className="mb-3 flex w-full items-center gap-1.5">
            {Array.from({ length: total }).map((_, i) => {
              let bgColor = isCourseFinal ? 'bg-[#18191d]/10' : 'bg-white/14';
              const r = session.results[i];
              if (r && i !== session.currentQuestionIndex) {
                bgColor = r.correct ? 'bg-accent' : 'bg-destructive/80';
              } else if (i === session.currentQuestionIndex) {
                bgColor = isCourseFinal ? 'bg-accent animate-pulse' : 'bg-accent/50 animate-pulse';
              }
              return (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${bgColor} transition-colors duration-300`}
                />
              );
            })}
          </div>
          <div className="flex items-center justify-between">
            <p
              className={`text-xs font-bold tracking-widest uppercase ${isCourseFinal ? 'text-[#685bc7]' : 'text-[#c4beff]'}`}
            >
              Course assessment
            </p>
            <p
              className={`text-xs font-bold tabular-nums ${isCourseFinal ? 'text-[#27272c]/70' : 'text-white/72'}`}
            >
              {session.currentQuestionIndex + 1}{' '}
              <span className={isCourseFinal ? 'text-[#27272c]/35' : 'text-white/38'}>
                / {total}
              </span>
            </p>
          </div>
        </div>
        <div
          key={session.currentQuestionIndex}
          className={`relative mx-auto flex min-h-0 w-full flex-1 flex-col gap-4 overflow-y-auto px-6 pb-24 md:px-10 ${isCourseFinal ? 'max-w-none px-8 py-7' : 'max-w-5xl'}`}
        >
          <p
            className={`quiz-enter shrink-0 pt-3 text-xl leading-tight font-bold md:text-3xl ${isCourseFinal ? 'text-[#27272c]' : 'text-white'}`}
          >
            {q.question}
          </p>

          {q.image_url && (
            <div className="quiz-enter border-border/10 mx-auto w-full max-w-lg shrink-0 overflow-hidden rounded-xl border shadow-lg">
              <Image
                src={q.image_url}
                alt="Question reference"
                width={800}
                height={450}
                sizes="(min-width: 560px) 512px, 100vw"
                className="h-auto max-h-[30vh] w-full object-cover"
              />
            </div>
          )}

          <motion.div
            className="grid flex-1 grid-cols-1 content-start gap-3 md:grid-cols-2"
            role="radiogroup"
            aria-label="Answer options"
            animate={isShaking ? { x: [-6, 6, -6, 6, 0] } : { x: 0 }}
            transition={{ duration: 0.4 }}
          >
            {q.options.map((option, i) => {
              const isSelected = session.selectedIndex === i;
              const isCorrect = result !== undefined && i === result.correctIndex;
              const showGreen = revealed && isCorrect;
              const showRed = revealed && isSelected && !isCorrect;
              const dimmed = revealed && !isCorrect && !isSelected;

              const baseClass =
                'relative flex items-start gap-3 p-4 rounded-2xl border text-left shadow-sm ' +
                'transition-all duration-150 disabled:cursor-default ';

              const stateClass = !revealed
                ? isSelected
                  ? 'border-[#a9a0ff] bg-[#ddd9ff]'
                  : 'border-white/16 bg-white/94 hover:-translate-y-0.5 hover:border-[#b8b0ff] hover:bg-white'
                : showGreen
                  ? 'border-[#7770d8] bg-[#e8e5ff] quiz-option-correct'
                  : showRed
                    ? 'border-[#b8b4c4] bg-[#e8e7eb] quiz-option-wrong'
                    : dimmed
                      ? 'border-white/8 bg-white/80 opacity-45'
                      : 'border-white/16 bg-white/94';

              return (
                <button
                  key={`${i}-${option}`}
                  onClick={() => void handleSelect(i)}
                  disabled={session.selectedIndex !== null || grading}
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={`${OPTION_LABELS[i] ?? i + 1}: ${option}${
                    revealed && isCorrect
                      ? ' — correct'
                      : revealed && isSelected && !isCorrect
                        ? ' — incorrect'
                        : ''
                  }`}
                  className={`${baseClass} ${stateClass} quiz-enter`}
                  style={{ animationDelay: `${60 + i * 45}ms` }}
                >
                  <span
                    className={`mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                      showGreen
                        ? 'border-[#685bc7] text-[#685bc7]'
                        : showRed
                          ? 'border-[#85838c] text-[#77757d]'
                          : 'border-[#18191d]/18 text-[#18191d]/46'
                    }`}
                  >
                    {OPTION_LABELS[i] ?? i + 1}
                  </span>

                  <span
                    className={`mt-px text-base leading-snug font-semibold ${
                      showGreen ? 'text-[#242051]' : showRed ? 'text-[#5d5a62]' : 'text-[#27272c]'
                    }`}
                  >
                    {option}
                  </span>

                  {grading && isSelected && (
                    <span className="absolute top-3 right-3">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#685bc7]" />
                    </span>
                  )}

                  {revealed && isSelected && (
                    <span className="absolute top-3 right-3">
                      {isCorrect ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#685bc7]" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-[#77757d]" />
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </motion.div>

          {session.error && (
            <p role="alert" className="shrink-0 text-sm font-medium text-[#ffb5b5]">
              {session.error}
            </p>
          )}

          {revealed && result && (
            <>
              <div className="quiz-enter mt-2 shrink-0 rounded-2xl border border-white/14 bg-white/95 px-5 py-4 text-[#27272c] shadow-lg">
                {(() => {
                  const isCorrect = result.correct;
                  return (
                    <div
                      className={`mb-2 flex items-center gap-1.5 ${isCorrect ? 'text-[#685bc7]' : 'text-[#a04747]'}`}
                    >
                      {isCorrect ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <XCircle className="h-5 w-5" />
                      )}
                      <p className="text-sm font-black tracking-widest uppercase">
                        {isCorrect ? 'Correct!' : 'Incorrect'}
                      </p>
                    </div>
                  );
                })()}
                <p className="text-base leading-relaxed font-medium text-[#45434b]">
                  {result.explanation}
                </p>
              </div>

              <motion.button
                autoFocus
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleNext}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-base font-black text-[#242051] shadow-[0_0_24px_rgba(0,0,0,0.22)] focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {session.currentQuestionIndex + 1 >= total ? 'Finish Quiz' : 'Next Question'}
                <ChevronRight className="h-5 w-5" />
              </motion.button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
