"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  Trophy,
  Star,
  ThumbsUp,
  RefreshCw,
} from "lucide-react";

// ── Sanity quiz document shape (aligned with GROQ QUIZ_FIELDS output) ────────

export interface SanityQuizDoc {
  _key: string;
  sectionType: "quiz";
  title: string;
  instructions?: string;
  questions: Array<{
    _key: string;
    questionText: string;
    questionType: "multiple-choice" | "true-false";
    image?: { asset: { url: string } };
    answers: Array<{ _key: string; text: string; isCorrect: boolean; feedback?: string }>;
    explanation?: string;
  }>;
  passingScore: number;  // percentage, e.g. 80
  allowRetry: boolean;
  showCorrectAnswers: boolean;
}

// ── AI quiz format (internal to renderer) ────────────────────────────────────

interface AIQuestion {
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  image_url?: string;
}

interface QuizData {
  title: string;
  instructions?: string;
  questions: AIQuestion[];
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface QuizLessonProps {
  /** Lesson context string — used for AI quiz generation when sanityQuiz is absent */
  context?: string;
  /** When provided, renders the Sanity-authored questions instead of calling /api/quiz */
  sanityQuiz?: SanityQuizDoc;
  /** Called with score 0–100 (percentage) when learner meets the passing threshold */
  onPass: (score: number) => void;
  /** Called when learner fails and retry is not allowed */
  onFail: () => void;
  /** Passing threshold percentage; defaults to 80 */
  passingScore?: number;
  sessionId?: string;
  courseId?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const OPTION_LABELS = ["A", "B", "C", "D"];

const SCORE_TIERS = [
  { min: 1.0,  icon: Trophy,    color: "text-muted-foreground", label: "Perfect Score!",   message: "You're a certified product expert.",           emoji: "🏆" },
  { min: 0.8,  icon: Star,      color: "text-accent",           label: "Excellent!",        message: "Almost flawless — great retention.",           emoji: "⭐" },
  { min: 0.6,  icon: ThumbsUp,  color: "text-accent",           label: "Good Work!",        message: "Solid grasp of the key features.",             emoji: "👍" },
  { min: 0,    icon: RefreshCw, color: "text-muted-foreground", label: "Keep Exploring!",   message: "Revisit the features and give it another go.", emoji: "🔁" },
];

// ── Transform Sanity questions into the AI renderer format ────────────────────

function toQuizData(sanityQuiz: SanityQuizDoc): QuizData {
  return {
    title: sanityQuiz.title,
    instructions: sanityQuiz.instructions,
    questions: sanityQuiz.questions.map((q) => {
      const correctAnswer = q.answers.find((a) => a.isCorrect);
      return {
        question: q.questionText,
        options: q.answers.map((a) => a.text),
        correct_answer: correctAnswer?.text ?? "",
        explanation: q.explanation ?? correctAnswer?.feedback ?? "",
        image_url: q.image?.asset?.url,
      };
    }),
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function QuizLesson({
  context,
  sanityQuiz,
  onPass,
  onFail,
  passingScore = 80,
  sessionId,
  courseId,
}: QuizLessonProps) {
  // Sanity mode: populate quiz immediately; AI mode: populate after fetch
  const [quiz, setQuiz] = useState<QuizData | null>(() =>
    sanityQuiz ? toQuizData(sanityQuiz) : null
  );
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [started, setStarted] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Retry is controlled by Sanity config; AI quiz always allows retry
  const allowRetry = sanityQuiz ? sanityQuiz.allowRetry : true;

  // ── Persist result when quiz completes ────────────────────────────────────
  useEffect(() => {
    if (!done || !sessionId || !courseId) return;
    const total = quiz?.questions.length ?? 0;
    const pctScore = total > 0 ? (score / total) * 100 : 0;
    
    const mappedAnswers = quiz?.questions.map((q, i) => ({
      question: q.question,
      selected: userAnswers[i] ?? "",
      correct: q.correct_answer,
    })) ?? [];

    fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "quiz",
        sessionId,
        courseId,
        score,
        total,
        passed: pctScore >= passingScore,
        answers: mappedAnswers,
      }),
    }).catch(() => {});
    
    // Confetti on Pass
    if (!isReviewing && pctScore >= passingScore) {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  // ── Fetch AI quiz once on mount (Sanity mode skips this) ──────────────────
  useEffect(() => {
    if (sanityQuiz) return;
    if (!context) return;

    fetch("/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context, num_questions: 5 }),
    })
      .then((r) => r.json())
      .then((data: QuizData) => setQuiz(data))
      .catch(() => setLoadErr("Couldn't generate quiz. Please try again."));

    return () => timers.current.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Answer selection ──────────────────────────────────────────────────────
  function handleSelect(option: string) {
    if (selected || isReviewing) return;
    const isCorrect = option === quiz!.questions[currentQ].correct_answer;
    if (isCorrect) setScore((s) => s + 1);
    setSelected(option);
    setUserAnswers((prev) => [...prev, option]);

    // Brief pause so selection state registers visually, then reveal feedback
    const t1 = setTimeout(() => {
      setRevealed(true);
      if (!isCorrect) {
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 400);
      }
    }, 90);
    timers.current = [t1];
  }

  function handleNext() {
    const next = currentQ + 1;
    if (next >= quiz!.questions.length) {
      setDone(true);
    } else {
      setCurrentQ(next);
      setSelected(null);
      setRevealed(false);
    }
  }

  function handleRetry() {
    timers.current.forEach(clearTimeout);
    setCurrentQ(0);
    setSelected(null);
    setRevealed(false);
    setScore(0);
    setDone(false);
    setUserAnswers([]);
    setIsReviewing(false);
    setStarted(false);
  }

  const total = quiz?.questions.length ?? 5;

  // ── Loading state (AI mode only) ─────────────────────────────────────────
  if (!quiz && !loadErr) {
    return (
      <div className="absolute inset-0 bg-background flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-7 w-7 text-accent animate-spin" />
        <p className="text-foreground/40 text-sm font-medium">Generating knowledge check…</p>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (loadErr) {
    return (
      <div className="absolute inset-0 bg-background flex items-center justify-center">
        <p className="text-muted-foreground/80 text-sm">{loadErr}</p>
      </div>
    );
  }

  // ── Intro screen ──────────────────────────────────────────────────────────
  if (!started && quiz?.instructions) {
    return (
      <div className="absolute inset-0 bg-background flex flex-col items-center justify-center px-8 text-center quiz-enter">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_35%,rgba(104,91,199,0.07),transparent)] pointer-events-none" />
        <Trophy className="h-12 w-12 text-accent mb-5 opacity-80" />
        <h2 className="text-2xl md:text-3xl font-black text-foreground leading-tight mb-4">{quiz.title}</h2>
        <p className="text-foreground/70 text-base leading-relaxed max-w-sm mx-auto mb-8 font-medium">
          {quiz.instructions}
        </p>
        <button
          onClick={() => setStarted(true)}
          className="bg-foreground text-background font-black text-lg px-8 py-3.5 rounded-full hover:bg-foreground/90 transition-transform hover:scale-105 active:scale-95 shadow-2xl"
        >
          Start Quiz
        </button>
      </div>
    );
  }

  // ── Score screen ──────────────────────────────────────────────────────────
  if (done && !isReviewing) {
    const pct = score / total;
    const pctScore = Math.round(pct * 100);
    const passed = pctScore >= passingScore;
    const tier = SCORE_TIERS.find((t) => pct >= t.min) ?? SCORE_TIERS[SCORE_TIERS.length - 1];
    const Icon = tier.icon;
    const barColor = pct >= 0.8 ? "rgb(104 91 199)" : pct >= 0.6 ? "rgb(104 91 199)" : "rgb(122 118 112)";

    return (
      <div
        role="status"
        aria-label={`${tier.label} You scored ${score} out of ${total}`}
        className="absolute inset-0 bg-background flex flex-col items-center justify-center gap-5 px-8"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_50%_at_50%_45%,rgba(104,91,199,0.07),transparent)] pointer-events-none" />

        {/* Tier icon + emoji */}
        <div className="quiz-score-in flex flex-col items-center gap-1">
          <span className="text-[52px] leading-none">{tier.emoji}</span>
          <Icon className={`h-5 w-5 ${tier.color} mt-1`} />
        </div>

        {/* Score number */}
        <div className="quiz-score-in text-center" style={{ animationDelay: "90ms" }}>
          <p className="text-[64px] font-bold text-foreground leading-none tabular-nums">
            {score}
            <span className="text-foreground/25 text-3xl font-normal">/{total}</span>
          </p>
          <p className={`text-base font-semibold mt-1.5 ${tier.color}`}>{tier.label}</p>
          <p className="text-foreground/35 text-[12px] mt-0.5">{tier.message}</p>
          {!passed && (
            <p className="text-foreground/30 text-[11px] mt-1.5">
              Passing score: {passingScore}%
            </p>
          )}
        </div>

        {/* Score bar */}
        <div
          className="quiz-score-in w-36 h-1.5 bg-background/8 rounded-full overflow-hidden"
          style={{ animationDelay: "180ms" }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct * 100}%`,
              background: barColor,
              transition: "width 0.8s cubic-bezier(0.34, 1.2, 0.64, 1) 0.4s",
            }}
          />
        </div>

        {/* Action button — pass → continue, fail+retry → try again, fail+no retry → continue (onFail) */}
        <div className="quiz-score-in flex flex-col items-center gap-2" style={{ animationDelay: "270ms" }}>
          {passed ? (
            <button
              onClick={() => onPass(pctScore)}
              className="flex items-center gap-2 bg-background text-foreground font-bold text-sm
                px-6 py-2.5 rounded-full shadow-2xl
                hover:bg-background/90 active:scale-95 transition-transform duration-150"
            >
              Continue <ChevronRight className="h-4 w-4" />
            </button>
          ) : allowRetry ? (
            <button
              onClick={handleRetry}
              className="flex items-center gap-2 bg-background text-foreground font-bold text-sm
                px-6 py-2.5 rounded-full shadow-2xl
                hover:bg-background/90 active:scale-95 transition-transform duration-150"
            >
              <RefreshCw className="h-4 w-4" /> Try Again
            </button>
          ) : (
            <button
              onClick={() => onFail()}
              className="flex items-center gap-2 bg-background text-foreground font-bold text-sm
                px-6 py-2.5 rounded-full shadow-2xl
                hover:bg-background/90 active:scale-95 transition-transform duration-150"
            >
              Continue <ChevronRight className="h-4 w-4" />
            </button>
          )}

          <button
            onClick={() => {
              setIsReviewing(true);
              setCurrentQ(0);
              setRevealed(true);
            }}
            className="mt-4 text-base font-bold text-foreground/70 hover:text-foreground transition-colors underline underline-offset-4"
          >
            Review Answers
          </button>
        </div>
      </div>
    );
  }

  // ── Question view ─────────────────────────────────────────────────────────
  const q = quiz!.questions[currentQ];

  return (
    <div className="absolute inset-0 bg-background flex flex-col select-none">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_35%,rgba(104,91,199,0.07),transparent)] pointer-events-none" />

      {/* Header — progress bar + counter */}
      <div className="shrink-0 px-6 pt-5 pb-2">
        <div className="flex items-center gap-1.5 mb-3 w-full">
          {Array.from({ length: total }).map((_, i) => {
            let bgColor = "bg-border/20"; // Unanswered
            if (userAnswers[i] && i !== currentQ) {
              const isCorrect = userAnswers[i] === quiz!.questions[i].correct_answer;
              bgColor = isCorrect ? "bg-accent" : "bg-destructive/80";
            } else if (i === currentQ) {
              bgColor = "bg-accent/50 animate-pulse";
            }
            return <div key={i} className={`h-1.5 flex-1 rounded-full ${bgColor} transition-colors duration-300`} />;
          })}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-foreground/70 text-xs font-bold uppercase tracking-widest">
            Knowledge Check
          </p>
          <p className="text-foreground/70 text-xs font-bold tabular-nums">
            {currentQ + 1} <span className="text-foreground/40">/ {total}</span>
          </p>
        </div>
      </div>

      {/* Body — keyed by question index so entry animations replay per question */}
      <div key={currentQ} className="flex-1 flex flex-col px-6 pb-5 gap-4 overflow-hidden min-h-0">
        {/* Question text */}
        <p className="quiz-enter text-foreground text-xl md:text-2xl font-bold leading-tight pt-2 shrink-0">
          {q.question}
        </p>

        {/* Optional Image */}
        {q.image_url && (
          <div className="quiz-enter shrink-0 w-full max-w-lg mx-auto rounded-xl overflow-hidden shadow-lg border border-border/10">
            <img src={`${q.image_url}?auto=format&q=75&fit=max&w=800`} alt="Question reference" className="w-full h-auto object-cover max-h-[30vh]" />
          </div>
        )}

        {/* Answer options */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 content-start" 
          role="group" 
          aria-label="Answer options"
          animate={isShaking ? { x: [-6, 6, -6, 6, 0] } : { x: 0 }}
          transition={{ duration: 0.4 }}
        >
          {q.options.map((option, i) => {
            const activeSelected = isReviewing ? userAnswers[currentQ] : selected;
            const isSelected = activeSelected === option;
            const isCorrect  = option === q.correct_answer;
            const showGreen  = revealed && isCorrect;
            const showRed    = revealed && isSelected && !isCorrect;
            const dimmed     = revealed && !isCorrect && !isSelected;

            const baseClass =
              "relative flex items-start gap-2.5 p-3 rounded-xl border text-left " +
              "transition-colors duration-150 disabled:cursor-default ";

            const stateClass = !revealed
              ? isSelected
                ? "border-accent/50 bg-accent/12"
                : "border-border/10 bg-background/5 hover:border-accent/25 hover:bg-accent/8"
              : showGreen
                ? "border-accent/65 bg-accent/12 quiz-option-correct"
                : showRed
                  ? "border-border/65 bg-muted/12 quiz-option-wrong"
                  : dimmed
                    ? "border-border/5 bg-background/3 opacity-40"
                    : "border-border/10 bg-background/5";

            return (
              <button
                key={option}
                onClick={() => handleSelect(option)}
                disabled={!!selected || isReviewing}
                aria-pressed={isSelected}
                aria-label={`${OPTION_LABELS[i]}: ${option}${
                  revealed && isCorrect ? " — correct" :
                  revealed && isSelected && !isCorrect ? " — incorrect" : ""
                }`}
                className={`${baseClass} ${stateClass} quiz-enter`}
                style={{ animationDelay: `${60 + i * 45}ms` }}
              >
                {/* Letter badge */}
                <span
                  className={`shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold border mt-px
                    ${showGreen ? "border-accent    text-accent"
                    : showRed   ? "border-border text-muted-foreground"
                    :             "border-border/20  text-foreground/35"}`}
                >
                  {OPTION_LABELS[i]}
                </span>

                {/* Option text */}
                <span
                  className={`text-base leading-snug font-semibold mt-px
                    ${showGreen ? "text-foreground"
                    : showRed   ? "text-muted-foreground"
                    :             "text-foreground/75"}`}
                >
                  {option}
                </span>

                {/* Result icon (after answer is revealed) */}
                {revealed && isSelected && (
                  <span className="absolute top-2 right-2">
                    {isCorrect
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-accent"        />
                      : <XCircle      className="h-3.5 w-3.5 text-muted-foreground" />
                    }
                  </span>
                )}
              </button>
            );
          })}
        </motion.div>

        {/* Explanation — appears after feedback is revealed */}
        {revealed && (
          <>
            <div className="quiz-enter shrink-0 bg-background/5 border border-border/8 rounded-2xl px-5 py-4 mt-2">
              {(() => {
                const activeSelected = isReviewing ? userAnswers[currentQ] : selected;
                const isCorrect = activeSelected === q.correct_answer;
                return (
                  <div className={`flex items-center gap-1.5 mb-2 ${isCorrect ? "text-accent" : "text-destructive"}`}>
                    {isCorrect ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                    <p className="text-sm font-black uppercase tracking-widest">
                      {isCorrect ? "Correct!" : "Incorrect"}
                    </p>
                  </div>
                );
              })()}
              <p className="text-foreground/80 text-base leading-relaxed font-medium">{q.explanation}</p>
            </div>

            {!isReviewing ? (
              <motion.button
                autoFocus
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleNext}
                className="w-full mt-4 flex items-center justify-center gap-2 bg-foreground text-background font-black text-base px-6 py-3.5 rounded-full shadow-[0_0_24px_rgba(0,0,0,0.15)] focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {currentQ + 1 >= total ? "Finish Quiz" : "Next Question"}
                <ChevronRight className="h-5 w-5" />
              </motion.button>
            ) : (
              <div className="flex items-center justify-between mt-6">
                <button
                  onClick={() => setCurrentQ((prev) => Math.max(0, prev - 1))}
                  disabled={currentQ === 0}
                  className="text-base font-black px-5 py-2.5 rounded-full border-2 border-foreground/10 text-foreground hover:border-foreground/30 hover:bg-foreground/5 transition-all disabled:opacity-20"
                >
                  Previous
                </button>
                <button
                  onClick={() => {
                    setDone(true);
                    setIsReviewing(false);
                  }}
                  className="text-base font-black px-6 py-2.5 bg-foreground text-background rounded-full hover:bg-foreground/90 transition-all shadow-lg"
                >
                  Back to Score
                </button>
                <button
                  onClick={() => setCurrentQ((prev) => Math.min(total - 1, prev + 1))}
                  disabled={currentQ === total - 1}
                  className="text-base font-black px-5 py-2.5 rounded-full border-2 border-foreground/10 text-foreground hover:border-foreground/30 hover:bg-foreground/5 transition-all disabled:opacity-20"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
