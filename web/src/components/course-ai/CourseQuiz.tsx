'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Brain, CheckCircle, XCircle, Loader2, BarChart2, RefreshCw } from 'lucide-react';

import {
  ClientQuizSchema,
  QuestionResultSchema,
  SubmitQuizResponseSchema,
  type ClientQuiz,
  type QuestionResult,
  type SubmitQuizResponse,
} from '@/lib/contracts/quiz';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CourseQuizProps {
  courseId?: string;
  /** Topics the learner has not explored yet — steers quiz generation. */
  weakTopics?: string[];
  /** Session identity for recording the attempt server-side; omit when storage consent was declined. */
  sessionId?: string;
  /** Called with the server-graded score 0–100 (percentage) — only on a passing score. */
  onPass?: (score: number) => void;
  /** Called when the learner fails and chooses to move on / retry. */
  onFail?: () => void;
}

type Step = 'idle' | 'generating' | 'ready' | 'playing' | 'submitting' | 'results';

// Grading is server-side: the browser only ever holds the client-safe quiz
// (no correct_answer fields) and renders the per-question results returned by
// /api/quiz/grade.

export function CourseQuiz({ courseId, weakTopics, sessionId, onPass, onFail }: CourseQuizProps) {
  const [step, setStep] = useState<Step>('idle');
  const [quiz, setQuiz] = useState<ClientQuiz | null>(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [grading, setGrading] = useState(false);
  /** Server-graded feedback per question, filled as the learner answers. */
  const [results, setResults] = useState<(QuestionResult | undefined)[]>([]);
  const [answers, setAnswers] = useState<number[]>([]);
  /** Server-graded final summary — the only source of score/passed. */
  const [summary, setSummary] = useState<SubmitQuizResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const generateQuiz = async () => {
    setStep('generating');
    setErrorMsg(null);
    try {
      if (!courseId) throw new Error('Missing courseId');
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, weakTopics: weakTopics ?? [] }),
      });
      if (!res.ok) throw new Error(`Quiz request failed (${res.status})`);

      const parsed = ClientQuizSchema.safeParse(await res.json());
      if (!parsed.success) throw new Error('Quiz response failed validation');

      setQuiz(parsed.data);
      setStep('ready');
    } catch (error: unknown) {
      console.warn('Quiz generation failed:', error instanceof Error ? error.message : error);
      setErrorMsg("We couldn't generate your quiz right now. Please try again in a moment.");
      setStep('idle');
    }
  };

  const handleAnswer = async (optionIndex: number) => {
    if (selectedIndex !== null || grading || !quiz) return;
    setSelectedIndex(optionIndex);
    setGrading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/quiz/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'question',
          source: quiz.source,
          quizId: quiz.quizId,
          questionIndex: currentQIndex,
          selectedIndex: optionIndex,
        }),
      });
      if (!res.ok) throw new Error(`Grade request failed (${res.status})`);
      const parsed = QuestionResultSchema.safeParse(await res.json());
      if (!parsed.success) throw new Error('Grade response failed validation');

      setResults((prev) => {
        const next = [...prev];
        next[currentQIndex] = parsed.data;
        return next;
      });
      const nextAnswers = [...answers, optionIndex];
      setAnswers(nextAnswers);

      setTimeout(() => {
        if (currentQIndex < quiz.questions.length - 1) {
          setCurrentQIndex((q) => q + 1);
          setSelectedIndex(null);
        } else {
          void submitQuiz(nextAnswers);
        }
      }, 1500);
    } catch (error: unknown) {
      console.warn('Answer grading failed:', error instanceof Error ? error.message : error);
      // Re-enable selection so the learner can try the same question again.
      setSelectedIndex(null);
      setErrorMsg("We couldn't check your answer — tap an option to try again.");
    } finally {
      setGrading(false);
    }
  };

  // Final submission — the server computes score/passed and records the attempt.
  const submitQuiz = async (finalAnswers: number[]) => {
    if (!quiz) return;
    setStep('submitting');
    setErrorMsg(null);

    try {
      const res = await fetch('/api/quiz/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          source: quiz.source,
          quizId: quiz.quizId,
          answers: finalAnswers,
          // Identity is only attached when consent allows persistence.
          ...(sessionId && courseId ? { sessionId, courseId } : {}),
        }),
      });
      if (!res.ok) throw new Error(`Submit request failed (${res.status})`);
      const parsed = SubmitQuizResponseSchema.safeParse(await res.json());
      if (!parsed.success) throw new Error('Submit response failed validation');

      setSummary(parsed.data);
      setStep('results');
    } catch (error: unknown) {
      console.warn('Quiz submission failed:', error instanceof Error ? error.message : error);
      setErrorMsg("We couldn't score your quiz. Please try again.");
    }
  };

  const reset = () => {
    setStep('idle');
    setQuiz(null);
    setCurrentQIndex(0);
    setSelectedIndex(null);
    setGrading(false);
    setResults([]);
    setAnswers([]);
    setSummary(null);
    setErrorMsg(null);
  };

  const questions = quiz?.questions ?? [];
  const currentQuestion = questions[currentQIndex];
  const currentResult = results[currentQIndex];

  return (
    <div className="mx-auto flex h-[600px] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200/50 bg-white/70 shadow-xl backdrop-blur-xl dark:border-slate-800/50 dark:bg-slate-900/70">
      <div className="flex items-center border-b border-slate-200/50 bg-white/50 px-6 py-4 dark:border-slate-800/50 dark:bg-slate-900/50">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
          <Brain className="h-5 w-5" />
        </div>
        <div className="ml-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Adaptive AI Quiz
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Personalized learning path</p>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center p-8">
        <AnimatePresence mode="wait">
          {step === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center"
            >
              <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <BarChart2 className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="mb-2 text-2xl font-bold text-slate-800 dark:text-slate-100">
                Ready to test your knowledge?
              </h3>
              <p className="mb-8 text-slate-600 dark:text-slate-400">
                {weakTopics && weakTopics.length > 0
                  ? 'Your quiz will focus on the topics you have explored the least.'
                  : 'A short quiz will be generated from your course materials.'}
              </p>
              {errorMsg && (
                <p role="alert" className="mb-6 text-sm font-medium text-red-600 dark:text-red-400">
                  {errorMsg}
                </p>
              )}
              <button
                onClick={() => void generateQuiz()}
                className="group relative inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-8 py-3.5 text-sm font-medium text-white transition-all hover:bg-slate-800 hover:shadow-lg dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                <span>{errorMsg ? 'Try Again' : 'Generate Quiz'}</span>
                <Sparkles className="h-4 w-4 transition-transform group-hover:scale-110" />
              </button>
            </motion.div>
          )}

          {step === 'generating' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center text-center"
            >
              <Loader2 className="mb-6 h-12 w-12 animate-spin text-emerald-500" />
              <h3 className="mb-2 text-xl font-bold text-slate-800 dark:text-slate-100">
                Generating Custom Quiz…
              </h3>
              {weakTopics && weakTopics.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-300"
                >
                  <p className="mb-2 text-sm font-semibold">Focus topics:</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {weakTopics.map((topic) => (
                      <span
                        key={topic}
                        className="rounded-full bg-emerald-200/50 px-3 py-1 text-xs font-medium dark:bg-emerald-800/50"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {step === 'ready' && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center"
            >
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="mb-4 text-2xl font-bold text-slate-800 dark:text-slate-100">
                Your custom quiz is ready!
              </h3>
              <p className="mb-8 text-slate-600 dark:text-slate-400">
                {questions.length} questions tailored to your learning gaps.
              </p>
              <button
                onClick={() => setStep('playing')}
                className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-8 py-3.5 text-sm font-medium text-white transition-all hover:bg-emerald-500 hover:shadow-lg"
              >
                Start Quiz
              </button>
            </motion.div>
          )}

          {step === 'playing' && currentQuestion && (
            <motion.div
              key={`playing-${currentQIndex}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full"
            >
              <div className="mb-6 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Question {currentQIndex + 1} of {questions.length}
                </span>
                <div className="flex gap-1">
                  {questions.map((_, i) => (
                    <div
                      key={i}
                      className={`h-2 w-8 rounded-full ${i <= currentQIndex ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                    />
                  ))}
                </div>
              </div>

              <h3 className="mb-8 text-xl font-medium text-slate-800 dark:text-slate-100">
                {currentQuestion.question}
              </h3>

              <div className="space-y-3">
                {currentQuestion.options.map((option, idx) => {
                  const isSelected = selectedIndex === idx;
                  // Correctness comes exclusively from the server grade.
                  const revealed = currentResult !== undefined;
                  const showCorrect = revealed && currentResult.correctIndex === idx;
                  const showWrong = revealed && isSelected && !currentResult.correct;

                  return (
                    <button
                      key={idx}
                      onClick={() => void handleAnswer(idx)}
                      disabled={selectedIndex !== null || grading}
                      className={`relative flex w-full items-center justify-between rounded-xl border p-4 text-left transition-all ${
                        selectedIndex === null
                          ? 'border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 dark:border-slate-700 dark:hover:border-emerald-500 dark:hover:bg-emerald-900/20'
                          : showCorrect
                            ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-900/30'
                            : showWrong
                              ? 'border-red-500 bg-red-50 dark:border-red-500 dark:bg-red-900/30'
                              : 'border-slate-200 opacity-50 dark:border-slate-800'
                      }`}
                    >
                      <span
                        className={`font-medium ${showCorrect ? 'text-emerald-700 dark:text-emerald-300' : showWrong ? 'text-red-700 dark:text-red-300' : 'text-slate-700 dark:text-slate-200'}`}
                      >
                        {option}
                      </span>
                      {grading && isSelected && (
                        <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
                      )}
                      {showCorrect && <CheckCircle className="h-5 w-5 text-emerald-500" />}
                      {showWrong && <XCircle className="h-5 w-5 text-red-500" />}
                    </button>
                  );
                })}
              </div>

              {errorMsg && (
                <p role="alert" className="mt-4 text-sm font-medium text-red-600 dark:text-red-400">
                  {errorMsg}
                </p>
              )}
            </motion.div>
          )}

          {step === 'submitting' && (
            <motion.div
              key="submitting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center text-center"
            >
              {errorMsg ? (
                <>
                  <p
                    role="alert"
                    className="mb-6 text-sm font-medium text-red-600 dark:text-red-400"
                  >
                    {errorMsg}
                  </p>
                  <button
                    onClick={() => void submitQuiz(answers)}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-8 py-3 text-sm font-medium text-white transition-all hover:bg-emerald-500"
                  >
                    <RefreshCw className="h-4 w-4" /> Try Again
                  </button>
                </>
              ) : (
                <>
                  <Loader2 className="mb-6 h-12 w-12 animate-spin text-emerald-500" />
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                    Scoring your answers…
                  </h3>
                </>
              )}
            </motion.div>
          )}

          {step === 'results' && summary && (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div
                className={`mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full shadow-lg ${
                  summary.passed
                    ? 'bg-gradient-to-br from-emerald-400 to-teal-500'
                    : 'bg-gradient-to-br from-slate-400 to-slate-500'
                }`}
              >
                <span className="text-3xl font-bold text-white">
                  {Math.round((summary.score / summary.total) * 100)}%
                </span>
              </div>
              <h3 className="mb-2 text-2xl font-bold text-slate-800 dark:text-slate-100">
                {summary.passed ? 'Quiz Passed!' : 'Not Quite There Yet'}
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                You got {summary.score} out of {summary.total} questions correct.
              </p>
              {!summary.passed && (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Passing score: {summary.passingScore}%
                </p>
              )}
              <div className="mt-8" />

              {summary.passed ? (
                <button
                  onClick={() => {
                    if (onPass) onPass(Math.round((summary.score / summary.total) * 100));
                    else reset();
                  }}
                  className="inline-flex items-center justify-center rounded-full border-2 border-emerald-500 bg-transparent px-8 py-3 text-sm font-medium text-emerald-600 transition-all hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                >
                  {onPass ? 'Continue' : 'Try Another Quiz'}
                </button>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <button
                    onClick={reset}
                    className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-emerald-500 bg-transparent px-8 py-3 text-sm font-medium text-emerald-600 transition-all hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                  >
                    <RefreshCw className="h-4 w-4" /> Try Again
                  </button>
                  {onFail && (
                    <button
                      onClick={onFail}
                      className="text-sm font-medium text-slate-500 underline underline-offset-4 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      Continue without passing
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
