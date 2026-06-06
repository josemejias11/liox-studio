"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle, Loader2, ChevronRight, Trophy, Star, ThumbsUp, RefreshCw } from "lucide-react";

interface Question {
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
}

interface QuizData {
  title: string;
  questions: Question[];
}

interface QuizLessonProps {
  context: string;
  numQuestions?: number;
  onNext: () => void;
  sessionId?: string;
  moduleId?: string;
}

const OPTION_LABELS = ["A", "B", "C", "D"];

const SCORE_TIERS = [
  { min: 1.0,  icon: Trophy,    color: "text-moto-sandstone", label: "Perfect Score!",   message: "You're a certified product expert.",      emoji: "🏆" },
  { min: 0.8,  icon: Star,      color: "text-moto-indigo",    label: "Excellent!",        message: "Almost flawless — great retention.",       emoji: "⭐" },
  { min: 0.6,  icon: ThumbsUp,  color: "text-moto-indigo",    label: "Good Work!",        message: "Solid grasp of the key features.",         emoji: "👍" },
  { min: 0,    icon: RefreshCw, color: "text-moto-slate",     label: "Keep Exploring!",   message: "Revisit the features and give it another go.", emoji: "🔁" },
];

export function QuizLesson({ context, numQuestions = 5, onNext, sessionId, moduleId }: QuizLessonProps) {
  const [quiz, setQuiz]       = useState<QuizData | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore]     = useState(0);
  const [done, setDone]       = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Persist quiz result when complete
  useEffect(() => {
    if (!done || !sessionId || !moduleId) return;
    fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "quiz", sessionId, moduleId, score, total: quiz?.questions.length ?? numQuestions, answers: [] }),
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  // Fetch once on mount
  useEffect(() => {
    fetch("/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context, num_questions: numQuestions }),
    })
      .then((r) => r.json())
      .then((data: QuizData) => setQuiz(data))
      .catch(() => setLoadErr("Couldn't generate quiz. Please try again."));

    return () => timers.current.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSelect(option: string) {
    if (selected) return;
    const isCorrect = option === quiz!.questions[currentQ].correct_answer;
    if (isCorrect) setScore((s) => s + 1);
    setSelected(option);

    // Reveal feedback after a brief pause so the selection state registers visually
    const t1 = setTimeout(() => setRevealed(true), 90);

    // Advance to next question (or score screen) after feedback
    const t2 = setTimeout(() => {
      const next = currentQ + 1;
      if (next >= quiz!.questions.length) {
        setDone(true);
      } else {
        setCurrentQ(next);
        setSelected(null);
        setRevealed(false);
      }
    }, 2100);

    timers.current = [t1, t2];
  }

  const total = quiz?.questions.length ?? numQuestions;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (!quiz && !loadErr) {
    return (
      <div className="absolute inset-0 bg-moto-black flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-7 w-7 text-moto-indigo animate-spin" />
        <p className="text-moto-frost/40 text-sm font-medium">Generating knowledge check…</p>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (loadErr) {
    return (
      <div className="absolute inset-0 bg-moto-black flex items-center justify-center">
        <p className="text-moto-sandstone/80 text-sm">{loadErr}</p>
      </div>
    );
  }

  // ── Score screen ──────────────────────────────────────────────────────────
  if (done) {
    const pct = score / total;
    const tier = SCORE_TIERS.find((t) => pct >= t.min) ?? SCORE_TIERS[SCORE_TIERS.length - 1];
    const Icon = tier.icon;
    const barColor = pct >= 0.8 ? "rgb(104 91 199)" : pct >= 0.6 ? "rgb(104 91 199)" : "rgb(122 118 112)";

    return (
      <div role="status" aria-label={`${tier.label} You scored ${score} out of ${total}`} className="absolute inset-0 bg-moto-black flex flex-col items-center justify-center gap-5 px-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_50%_at_50%_45%,rgba(104,91,199,0.07),transparent)] pointer-events-none" />

        {/* Icon */}
        <div className="quiz-score-in flex flex-col items-center gap-1">
          <span className="text-[52px] leading-none">{tier.emoji}</span>
          <Icon className={`h-5 w-5 ${tier.color} mt-1`} />
        </div>

        {/* Score number */}
        <div className="quiz-score-in text-center" style={{ animationDelay: "90ms" }}>
          <p className="text-[64px] font-bold text-moto-frost leading-none tabular-nums">
            {score}
            <span className="text-moto-frost/25 text-3xl font-normal">/{total}</span>
          </p>
          <p className={`text-base font-semibold mt-1.5 ${tier.color}`}>{tier.label}</p>
          <p className="text-moto-frost/35 text-[12px] mt-0.5">{tier.message}</p>
        </div>

        {/* Score bar */}
        <div className="quiz-score-in w-36 h-1.5 bg-moto-frost/8 rounded-full overflow-hidden" style={{ animationDelay: "180ms" }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${pct * 100}%`, background: barColor, transition: "width 0.8s cubic-bezier(0.34, 1.2, 0.64, 1) 0.4s" }}
          />
        </div>

        {/* Continue */}
        <div className="quiz-score-in" style={{ animationDelay: "270ms" }}>
          <button
            onClick={onNext}
            className="flex items-center gap-2 bg-moto-black text-moto-frost font-bold text-sm
              px-6 py-2.5 rounded-full shadow-2xl shadow-moto-black/50
              hover:bg-moto-black/90 active:scale-95 transition-transform duration-150"
          >
            Continue <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // ── Question ──────────────────────────────────────────────────────────────
  const q = quiz!.questions[currentQ];

  return (
    <div className="absolute inset-0 bg-moto-black flex flex-col select-none">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_35%,rgba(104,91,199,0.07),transparent)] pointer-events-none" />

      {/* ── Header ── */}
      <div className="shrink-0 px-6 pt-5 pb-2">
        <div className="h-[2px] bg-moto-frost/8 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-moto-indigo rounded-full transition-all duration-500 ease-out"
            style={{ width: `${(currentQ / total) * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-moto-frost/25 text-[10px] font-semibold uppercase tracking-widest">
            Knowledge Check
          </p>
          <p className="text-moto-frost/25 text-[10px] font-medium tabular-nums">
            {currentQ + 1} <span className="text-moto-frost/15">/ {total}</span>
          </p>
        </div>
      </div>

      {/* ── Body — keyed by question index so animations replay ── */}
      <div key={currentQ} className="flex-1 flex flex-col px-6 pb-5 gap-4 overflow-hidden min-h-0">

        {/* Question text */}
        <p className="quiz-enter text-moto-frost text-[17px] font-semibold leading-snug pt-1 shrink-0">
          {q.question}
        </p>

        {/* Options 2 × 2 grid */}
        <div className="grid grid-cols-2 gap-2.5 flex-1 content-start" role="group" aria-label="Answer options">
          {q.options.map((option, i) => {
            const isSelected = selected === option;
            const isCorrect  = option === q.correct_answer;
            const showGreen  = revealed && isCorrect;
            const showRed    = revealed && isSelected && !isCorrect;
            const dimmed     = revealed && !isCorrect && !isSelected;

            const baseClass =
              "relative flex items-start gap-2.5 p-3 rounded-xl border text-left " +
              "transition-colors duration-150 disabled:cursor-default ";

            const stateClass = !revealed
              ? isSelected
                ? "border-moto-indigo/50 bg-moto-indigo/12"
                : "border-moto-frost/10 bg-moto-frost/5 hover:border-moto-indigo/25 hover:bg-moto-indigo/8"
              : showGreen
                ? "border-moto-indigo/65 bg-moto-indigo/12 quiz-option-correct"
                : showRed
                  ? "border-moto-sandstone/65 bg-moto-sandstone/12 quiz-option-wrong"
                  : dimmed
                    ? "border-moto-frost/5 bg-moto-frost/3 opacity-40"
                    : "border-moto-frost/10 bg-moto-frost/5";

            return (
              <button
                key={option}
                onClick={() => handleSelect(option)}
                disabled={!!selected}
                aria-pressed={isSelected}
                aria-label={`${OPTION_LABELS[i]}: ${option}${revealed && isCorrect ? " — correct" : revealed && isSelected && !isCorrect ? " — incorrect" : ""}`}
                className={`${baseClass} ${stateClass} quiz-enter`}
                style={{ animationDelay: `${60 + i * 45}ms` }}
              >
                {/* Letter badge */}
                <span
                  className={`shrink-0 h-[18px] w-[18px] rounded-full flex items-center justify-center text-[9px] font-bold border mt-[1px]
                    ${showGreen ? "border-moto-indigo    text-moto-indigo"
                    : showRed   ? "border-moto-sandstone text-moto-sandstone"
                    :             "border-moto-frost/20  text-moto-frost/35"}`}
                >
                  {OPTION_LABELS[i]}
                </span>

                {/* Option text */}
                <span
                  className={`text-[12px] leading-snug font-medium
                    ${showGreen ? "text-moto-frost"
                    : showRed   ? "text-moto-sandstone"
                    :             "text-moto-frost/75"}`}
                >
                  {option}
                </span>

                {/* Result icon */}
                {revealed && isSelected && (
                  <span className="absolute top-2 right-2">
                    {isCorrect
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-moto-indigo"    />
                      : <XCircle      className="h-3.5 w-3.5 text-moto-sandstone" />
                    }
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Explanation — lessons in after reveal */}
        {revealed && (
          <div className="quiz-enter shrink-0 bg-moto-frost/5 border border-moto-frost/8 rounded-xl px-4 py-3">
            <p className="text-[9.5px] text-moto-frost/25 font-semibold uppercase tracking-widest mb-1">Why</p>
            <p className="text-moto-frost/55 text-[11.5px] leading-relaxed">{q.explanation}</p>
          </div>
        )}
      </div>
    </div>
  );
}
