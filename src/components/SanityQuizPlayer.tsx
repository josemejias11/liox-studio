'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';

import {
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  Trophy,
  RefreshCw,
} from 'lucide-react';

import {
  QuestionResultSchema,
  SubmitQuizResponseSchema,
  type ClientQuiz,
  type QuestionResult,
  type SubmitQuizResponse,
} from '@/lib/contracts/quiz';
import type { SanityQuizDoc } from '@/lib/contracts/sanity';
import { sanityImageLoader } from '@/lib/sanity-image-loader';

// ── Sanity quiz player ────────────────────────────────────────────────────────

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];



// Transform the client-safe Sanity projection into the shared wire shape.
// (No correctness data exists here — grading happens in /api/quiz/grade.)
function toClientQuiz(sanityQuiz: SanityQuizDoc): ClientQuiz {
  return {
    quizId: sanityQuiz._key, // GROQ maps the quiz document _id onto _key
    source: 'sanity',
    title: sanityQuiz.title ?? '',
    ...(sanityQuiz.instructions !== undefined ? { instructions: sanityQuiz.instructions } : {}),
    questions: sanityQuiz.questions.map((q) => ({
      question: q.questionText,
      options: q.answers.map((a) => a.text),
      ...(q.image?.asset?.url !== undefined ? { image_url: q.image.asset.url } : {}),
    })),
  };
}

export interface SanityQuizPlayerProps {
  sanityQuiz: SanityQuizDoc;
  onPass: (score: number) => void;

  sessionId?: string;
  courseId?: string;
}

export function SanityQuizPlayer({
  sanityQuiz,
  onPass,

  sessionId,
  courseId,
}: SanityQuizPlayerProps) {
  const [quiz] = useState<ClientQuiz>(() => toClientQuiz(sanityQuiz));
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [grading, setGrading] = useState(false);
  const [gradeErr, setGradeErr] = useState<string | null>(null);
  /** Server-graded per-question feedback, filled as the learner answers. */
  const [results, setResults] = useState<(QuestionResult | undefined)[]>([]);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [done, setDone] = useState(false);
  /** Server-graded final result — the only source of score/passed. */
  const [summary, setSummary] = useState<SubmitQuizResponse | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [started, setStarted] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);


  // Clear any pending shake timers on unmount
  useEffect(() => {
    const pendingTimers = timers.current;
    return () => pendingTimers.forEach(clearTimeout);
  }, []);

  // ── Answer selection — graded server-side per question ────────────────────
  async function handleSelect(optionIndex: number) {
    if (selected !== null || grading) return;
    setSelected(optionIndex);
    setGrading(true);
    setGradeErr(null);

    try {
      const res = await fetch('/api/quiz/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'question',
          source: quiz.source,
          quizId: quiz.quizId,
          questionIndex: currentQ,
          selectedIndex: optionIndex,
        }),
      });
      if (!res.ok) throw new Error(`Grade request failed (${res.status})`);
      const parsed = QuestionResultSchema.safeParse(await res.json());
      if (!parsed.success) throw new Error('Grade response failed validation');

      setResults((prev) => {
        const next = [...prev];
        next[currentQ] = parsed.data;
        return next;
      });
      setUserAnswers((prev) => [...prev, optionIndex]);

      if (!parsed.data.correct) {
        setIsShaking(true);
        timers.current.push(setTimeout(() => setIsShaking(false), 400));
      }
    } catch {
      // Re-enable selection so the learner can try the same question again.
      setSelected(null);
      setGradeErr("Couldn't check your answer — tap an option to try again.");
    } finally {
      setGrading(false);
    }
  }

  // ── Final submission — server computes score / passed and records it ──────
  async function submitQuiz(answers: number[]) {
    setDone(true);
    setSubmitErr(null);

    try {
      const res = await fetch('/api/quiz/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          source: quiz.source,
          quizId: quiz.quizId,
          answers,
          // Identity is only attached when consent allows persistence.
          ...(sessionId && courseId ? { sessionId, courseId } : {}),
        }),
      });
      if (!res.ok) throw new Error(`Submit request failed (${res.status})`);
      const parsed = SubmitQuizResponseSchema.safeParse(await res.json());
      if (!parsed.success) throw new Error('Submit response failed validation');

      setSummary(parsed.data);
      const pct = parsed.data.total > 0 ? parsed.data.score / parsed.data.total : 0;
      const pctScore = Math.round(pct * 100);
      onPass(pctScore);
    } catch {
      setSubmitErr("Couldn't score your quiz.");
    }
  }

  function handleNext() {
    const next = currentQ + 1;
    if (next >= quiz.questions.length) {
      void submitQuiz(userAnswers);
    } else {
      setCurrentQ(next);
      setSelected(null);
      setGradeErr(null);
    }
  }


  const total = quiz.questions.length;

  // ── Intro screen ──────────────────────────────────────────────────────────
  if (!started && quiz.instructions) {
    return (
      <div className="bg-background quiz-enter absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_35%,rgba(104,91,199,0.07),transparent)]" />
        <Trophy className="text-accent mb-5 h-12 w-12 opacity-80" />
        <h2 className="text-foreground mb-4 text-2xl leading-tight font-black md:text-3xl">
          {quiz.title}
        </h2>
        <p className="text-foreground/70 mx-auto mb-8 max-w-sm text-base leading-relaxed font-medium">
          {quiz.instructions}
        </p>
        <button
          onClick={() => setStarted(true)}
          className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-8 py-3.5 text-lg font-black shadow-2xl transition-transform hover:scale-105 active:scale-95"
        >
          Start Quiz
        </button>
      </div>
    );
  }

  // ── Scoring state — waiting for (or retrying) the server grade ────────────
  if (done && !summary) {
    return (
      <div className="bg-background absolute inset-0 flex flex-col items-center justify-center gap-4">
        {submitErr ? (
          <>
            <p className="text-muted-foreground/80 text-sm">{submitErr}</p>
            <button
              onClick={() => void submitQuiz(userAnswers)}
              className="bg-background text-foreground border-border/20 hover:bg-background/90 flex items-center gap-2 rounded-full border px-6 py-2.5 text-sm font-bold shadow-2xl transition-transform duration-150 active:scale-95"
            >
              <RefreshCw className="h-4 w-4" /> Try Again
            </button>
          </>
        ) : (
          <>
            <Loader2 className="text-accent h-7 w-7 animate-spin" />
            <p className="text-foreground/40 text-sm font-medium">Scoring your answers…</p>
          </>
        )}
      </div>
    );
  }



  // ── Question view ─────────────────────────────────────────────────────────
  const q = quiz.questions[currentQ];
  const result = results[currentQ];
  const revealed = selected !== null && result !== undefined;

  return (
    <div className="bg-background absolute inset-0 flex flex-col select-none">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_35%,rgba(104,91,199,0.07),transparent)]" />

      {/* Header — progress bar + counter */}
      <div className="shrink-0 px-6 pt-5 pb-2">
        <div className="mb-3 flex w-full items-center gap-1.5">
          {Array.from({ length: total }).map((_, i) => {
            let bgColor = 'bg-border/20'; // Unanswered
            const r = results[i];
            if (r && i !== currentQ) {
              bgColor = r.correct ? 'bg-accent' : 'bg-destructive/80';
            } else if (i === currentQ) {
              bgColor = 'bg-accent/50 animate-pulse';
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
          <p className="text-foreground/70 text-xs font-bold tracking-widest uppercase">
            Knowledge Check
          </p>
          <p className="text-foreground/70 text-xs font-bold tabular-nums">
            {currentQ + 1} <span className="text-foreground/40">/ {total}</span>
          </p>
        </div>
      </div>

      {/* Body — keyed by question index so entry animations replay per question */}
      <div key={currentQ} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-24">
        {/* Question text */}
        <p className="quiz-enter text-foreground shrink-0 pt-2 text-xl leading-tight font-bold md:text-2xl">
          {q.question}
        </p>

        {/* Optional Image */}
        {q.image_url && (
          <div className="quiz-enter border-border/10 mx-auto w-full max-w-lg shrink-0 overflow-hidden rounded-xl border shadow-lg">
            <Image
              loader={sanityImageLoader}
              src={q.image_url}
              alt="Question reference"
              width={800}
              height={450}
              sizes="(min-width: 560px) 512px, 100vw"
              className="h-auto max-h-[30vh] w-full object-cover"
            />
          </div>
        )}

        {/* Answer options */}
        <motion.div
          className="grid flex-1 grid-cols-1 content-start gap-3 md:grid-cols-2"
          role="radiogroup"
          aria-label="Answer options"
          animate={isShaking ? { x: [-6, 6, -6, 6, 0] } : { x: 0 }}
          transition={{ duration: 0.4 }}
        >
          {q.options.map((option, i) => {
            const isSelected = selected === i;
            const isCorrect = result !== undefined && i === result.correctIndex;
            const showGreen = revealed && isCorrect;
            const showRed = revealed && isSelected && !isCorrect;
            const dimmed = revealed && !isCorrect && !isSelected;

            const baseClass =
              'relative flex items-start gap-2.5 p-3 rounded-xl border text-left ' +
              'transition-colors duration-150 disabled:cursor-default ';

            const stateClass = !revealed
              ? isSelected
                ? 'border-accent/50 bg-accent/12'
                : 'border-border/10 bg-background/5 hover:border-accent/25 hover:bg-accent/8'
              : showGreen
                ? 'border-accent/65 bg-accent/12 quiz-option-correct'
                : showRed
                  ? 'border-border/65 bg-muted/12 quiz-option-wrong'
                  : dimmed
                    ? 'border-border/5 bg-background/3 opacity-40'
                    : 'border-border/10 bg-background/5';

            return (
              <button
                key={`${i}-${option}`}
                onClick={() => void handleSelect(i)}
                disabled={selected !== null || grading}
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
                {/* Letter badge */}
                <span
                  className={`mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                    showGreen
                      ? 'border-accent text-accent'
                      : showRed
                        ? 'border-border text-muted-foreground'
                        : 'border-border/20 text-foreground/35'
                  }`}
                >
                  {OPTION_LABELS[i] ?? i + 1}
                </span>

                {/* Option text */}
                <span
                  className={`mt-px text-base leading-snug font-semibold ${
                    showGreen
                      ? 'text-foreground'
                      : showRed
                        ? 'text-muted-foreground'
                        : 'text-foreground/75'
                  }`}
                >
                  {option}
                </span>

                {/* Pending grade spinner on the picked option */}
                {grading && isSelected && (
                  <span className="absolute top-2 right-2">
                    <Loader2 className="text-accent h-3.5 w-3.5 animate-spin" />
                  </span>
                )}

                {/* Result icon (after answer is revealed) */}
                {revealed && isSelected && (
                  <span className="absolute top-2 right-2">
                    {isCorrect ? (
                      <CheckCircle2 className="text-accent h-3.5 w-3.5" />
                    ) : (
                      <XCircle className="text-muted-foreground h-3.5 w-3.5" />
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </motion.div>

        {/* Grading error — selection re-enabled so the learner can retry */}
        {gradeErr && (
          <p role="alert" className="text-destructive/80 shrink-0 text-sm font-medium">
            {gradeErr}
          </p>
        )}

        {/* Explanation — appears after the server grades the answer */}
        {revealed && result && (
          <>
            <div className="quiz-enter bg-background/5 border-border/8 mt-2 shrink-0 rounded-2xl border px-5 py-4">
              {(() => {
                const isCorrect = result.correct;
                return (
                  <div
                    className={`mb-2 flex items-center gap-1.5 ${isCorrect ? 'text-accent' : 'text-destructive'}`}
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
              <p className="text-foreground/80 text-base leading-relaxed font-medium">
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
                className="bg-foreground text-background mt-4 flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-base font-black shadow-[0_0_24px_rgba(0,0,0,0.15)] focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {currentQ + 1 >= total ? 'Finish Quiz' : 'Next Question'}
                <ChevronRight className="h-5 w-5" />
              </motion.button>
          </>
        )}
      </div>
    </div>
  );
}
