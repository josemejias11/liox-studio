'use client';

import React, { useReducer, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Brain, CheckCircle, XCircle, Loader2, BarChart2, RefreshCw } from 'lucide-react';

import {
  ClientQuizSchema,
  QuestionResultSchema,
  SubmitQuizResponseSchema,
  type ClientQuiz,
} from '@moto-ai/contracts/quiz';
import { JobAcceptedResponseSchema, JobStatusResponseSchema } from '@moto-ai/contracts/jobs';
import { RevisionBoundQuizRequestSchema } from '@/shared/contracts/api';
import { createQuizSessionState, quizSessionReducer } from '@/learning/quiz-session';

export interface CourseQuizProps {
  courseId?: string;

  revisionId?: string;

  reviewToken?: string;

  weakTopics?: string[];

  sessionId?: string;

  onPass?: (score: number) => void;

  onFail?: () => void;

  preview?: boolean;
}

type Step = 'idle' | 'generating' | 'ready' | 'playing';

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForQuizJob(jobId: string, onProgress: (progress: string | null) => void) {
  for (let attempt = 0; attempt < 300; attempt++) {
    const response = await fetch(`/api/jobs/${jobId}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Quiz status request failed (${response.status})`);
    const parsed = JobStatusResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error('Quiz status response failed validation');
    onProgress(parsed.data.progress);
    if (parsed.data.status === 'failed') {
      throw new Error(parsed.data.errorMessage ?? 'Quiz generation failed');
    }
    if (parsed.data.status === 'succeeded') {
      const quiz = ClientQuizSchema.safeParse(parsed.data.result);
      if (!quiz.success) throw new Error('Quiz result failed validation');
      return quiz.data;
    }
    await sleep(1_000);
  }
  throw new Error('Quiz generation timed out');
}

export function CourseQuiz({
  courseId,
  revisionId,
  reviewToken,
  weakTopics,
  sessionId,
  onPass,
  onFail,
  preview = false,
}: CourseQuizProps) {
  const [step, setStep] = useState<Step>('idle');
  const [quiz, setQuiz] = useState<ClientQuiz | null>(null);
  const [session, dispatch] = useReducer(quizSessionReducer, undefined, createQuizSessionState);
  const [grading, setGrading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState<string | null>(null);

  if (preview) {
    return (
      <div className="border-border/20 bg-background mx-auto flex h-[600px] w-full max-w-2xl flex-col items-center justify-center rounded-2xl border p-8 text-center shadow-xl backdrop-blur-xl">
        <div className="bg-accent/10 mb-6 flex h-20 w-20 items-center justify-center rounded-full">
          <Brain className="text-accent h-10 w-10" />
        </div>
        <h2 className="text-foreground text-2xl font-bold">Adaptive AI quiz preview</h2>
        <p className="text-muted-foreground mt-3 max-w-md leading-relaxed">
          This quiz is generated for each learner from their course activity. It is unavailable in
          preview, so no quiz is generated or graded here.
        </p>
      </div>
    );
  }

  const generateQuiz = async () => {
    setStep('generating');
    setErrorMsg(null);
    setGenerationProgress('queueing');
    try {
      if (!courseId) throw new Error('Missing courseId');
      const request = RevisionBoundQuizRequestSchema.safeParse({
        courseId,
        weakTopics: weakTopics ?? [],
        ...(revisionId ? { revisionId } : {}),
        ...(reviewToken ? { reviewToken } : {}),
      });
      if (!request.success) throw new Error('Missing or ambiguous revision identity');
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.data),
      });
      if (!res.ok) throw new Error(`Quiz request failed (${res.status})`);
      const parsed = JobAcceptedResponseSchema.safeParse(await res.json());
      if (!parsed.success) throw new Error('Quiz response failed validation');

      setQuiz(await waitForQuizJob(parsed.data.jobId, setGenerationProgress));
      setStep('ready');
    } catch (error: unknown) {
      console.warn('Quiz generation failed:', error instanceof Error ? error.message : error);
      setErrorMsg("We couldn't generate your quiz right now. Please try again in a moment.");
      setGenerationProgress(null);
      setStep('idle');
    }
  };

  const handleAnswer = async (optionIndex: number) => {
    if (session.selectedIndex !== null || grading || !quiz) return;
    dispatch({ type: 'answer.selected', selectedIndex: optionIndex });
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
      const nextAnswers = [...session.answers, optionIndex];
      const isLastQuestion = session.currentQuestionIndex >= quiz.questions.length - 1;

      setTimeout(() => {
        dispatch({ type: 'question.advanced', totalQuestions: quiz.questions.length });
        if (isLastQuestion) {
          void submitQuiz(nextAnswers);
        }
      }, 1500);
    } catch (error: unknown) {
      console.warn('Answer grading failed:', error instanceof Error ? error.message : error);
      dispatch({
        type: 'answer.failed',
        message: "We couldn't check your answer — tap an option to try again.",
      });
    } finally {
      setGrading(false);
    }
  };
  const submitQuiz = async (finalAnswers: number[]) => {
    if (!quiz) return;
    dispatch({ type: 'submission.started' });

    try {
      const res = await fetch('/api/quiz/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          source: quiz.source,
          quizId: quiz.quizId,
          answers: finalAnswers,
          ...(sessionId && courseId ? { sessionId, courseId } : {}),
        }),
      });
      if (!res.ok) throw new Error(`Submit request failed (${res.status})`);
      const parsed = SubmitQuizResponseSchema.safeParse(await res.json());
      if (!parsed.success) throw new Error('Submit response failed validation');

      dispatch({ type: 'submission.succeeded', summary: parsed.data });
    } catch (error: unknown) {
      console.warn('Quiz submission failed:', error instanceof Error ? error.message : error);
      dispatch({
        type: 'submission.failed',
        message: "We couldn't score your quiz. Please try again.",
      });
    }
  };

  const reset = () => {
    setStep('idle');
    setQuiz(null);
    setGrading(false);
    setErrorMsg(null);
    setGenerationProgress(null);
    dispatch({ type: 'session.reset' });
  };

  const questions = quiz?.questions ?? [];
  const currentQuestion = questions[session.currentQuestionIndex];
  const currentResult = session.results[session.currentQuestionIndex];

  return (
    <div className="border-border/20 bg-background mx-auto flex h-[600px] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border shadow-xl backdrop-blur-xl">
      <div className="border-border/20 bg-background/50 flex items-center border-b px-6 py-4">
        <div className="bg-accent text-background flex h-10 w-10 items-center justify-center rounded-full shadow-md">
          <Brain className="h-5 w-5" />
        </div>
        <div className="ml-4">
          <h2 className="text-foreground text-lg font-semibold">Adaptive AI Quiz</h2>
          <p className="text-muted-foreground text-xs">Personalized learning path</p>
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
              <div className="bg-accent/10 mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full">
                <BarChart2 className="text-accent h-12 w-12" />
              </div>
              <h3 className="text-foreground mb-2 text-2xl font-bold">
                Ready to test your knowledge?
              </h3>
              <p className="text-muted-foreground mb-8">
                {weakTopics && weakTopics.length > 0
                  ? 'Your quiz will focus on the topics you have explored the least.'
                  : 'A short quiz will be generated from your course materials.'}
              </p>
              {errorMsg && (
                <p role="alert" className="text-destructive mb-6 text-sm font-medium">
                  {errorMsg}
                </p>
              )}
              <button
                onClick={() => void generateQuiz()}
                className="group bg-foreground text-background hover:bg-foreground/90 relative inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-sm font-medium transition-all hover:shadow-lg"
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
              <Loader2 className="text-accent mb-6 h-12 w-12 animate-spin" />
              <h3 className="text-foreground mb-2 text-xl font-bold">Generating Custom Quiz…</h3>
              {generationProgress && (
                <p className="text-muted-foreground text-sm capitalize">{generationProgress}</p>
              )}
              {weakTopics && weakTopics.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border-accent/20 bg-accent/8 text-accent mt-4 rounded-xl border p-4"
                >
                  <p className="mb-2 text-sm font-semibold">Focus topics:</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {weakTopics.map((topic) => (
                      <span
                        key={topic}
                        className="bg-accent/15 rounded-full px-3 py-1 text-xs font-medium"
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
              <div className="bg-accent/10 mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full">
                <CheckCircle className="text-accent h-10 w-10" />
              </div>
              <h3 className="text-foreground mb-4 text-2xl font-bold">
                Your custom quiz is ready!
              </h3>
              <p className="text-muted-foreground mb-8">
                {questions.length} questions tailored to your learning gaps.
              </p>
              <button
                onClick={() => setStep('playing')}
                className="bg-accent text-background hover:bg-accent/90 inline-flex items-center justify-center rounded-full px-8 py-3.5 text-sm font-medium transition-all hover:shadow-lg"
              >
                Start Quiz
              </button>
            </motion.div>
          )}

          {step === 'playing' &&
            session.phase !== 'submitting' &&
            session.phase !== 'complete' &&
            currentQuestion && (
              <motion.div
                key={`playing-${session.currentQuestionIndex}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full"
              >
                <div className="mb-6 flex items-center justify-between">
                  <span className="text-muted-foreground text-sm font-medium">
                    Question {session.currentQuestionIndex + 1} of {questions.length}
                  </span>
                  <div className="flex gap-1">
                    {questions.map((_, i) => (
                      <div
                        key={i}
                        className={`h-2 w-8 rounded-full ${i <= session.currentQuestionIndex ? 'bg-accent' : 'bg-border'}`}
                      />
                    ))}
                  </div>
                </div>

                <h3 className="text-foreground mb-8 text-xl font-medium">
                  {currentQuestion.question}
                </h3>

                <div className="space-y-3">
                  {currentQuestion.options.map((option, idx) => {
                    const isSelected = session.selectedIndex === idx;
                    const revealed = currentResult !== undefined;
                    const showCorrect = revealed && currentResult.correctIndex === idx;
                    const showWrong = revealed && isSelected && !currentResult.correct;

                    return (
                      <button
                        key={idx}
                        onClick={() => void handleAnswer(idx)}
                        disabled={session.selectedIndex !== null || grading}
                        className={`relative flex w-full items-center justify-between rounded-xl border p-4 text-left transition-all ${
                          session.selectedIndex === null
                            ? 'border-border hover:border-accent/50 hover:bg-accent/8'
                            : showCorrect
                              ? 'border-accent/65 bg-accent/12'
                              : showWrong
                                ? 'border-destructive/60 bg-destructive/8'
                                : 'border-border opacity-50'
                        }`}
                      >
                        <span
                          className={`font-medium ${showCorrect ? 'text-accent' : showWrong ? 'text-destructive' : 'text-foreground/80'}`}
                        >
                          {option}
                        </span>
                        {grading && isSelected && (
                          <Loader2 className="text-accent h-5 w-5 animate-spin" />
                        )}
                        {showCorrect && <CheckCircle className="text-accent h-5 w-5" />}
                        {showWrong && <XCircle className="text-destructive h-5 w-5" />}
                      </button>
                    );
                  })}
                </div>

                {session.error && (
                  <p role="alert" className="text-destructive mt-4 text-sm font-medium">
                    {session.error}
                  </p>
                )}
              </motion.div>
            )}

          {step === 'playing' && session.phase === 'submitting' && (
            <motion.div
              key="submitting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center text-center"
            >
              {session.error ? (
                <>
                  <p role="alert" className="text-destructive mb-6 text-sm font-medium">
                    {session.error}
                  </p>
                  <button
                    onClick={() => {
                      dispatch({ type: 'retry.requested' });
                      void submitQuiz(session.answers);
                    }}
                    className="bg-accent text-background hover:bg-accent/90 inline-flex items-center justify-center gap-2 rounded-full px-8 py-3 text-sm font-medium transition-all"
                  >
                    <RefreshCw className="h-4 w-4" /> Try Again
                  </button>
                </>
              ) : (
                <>
                  <Loader2 className="text-accent mb-6 h-12 w-12 animate-spin" />
                  <h3 className="text-foreground text-xl font-bold">Scoring your answers…</h3>
                </>
              )}
            </motion.div>
          )}

          {step === 'playing' && session.phase === 'complete' && session.summary && (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div
                className={`mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full shadow-lg ${
                  session.summary.passed
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                <span className="text-3xl font-bold">
                  {Math.round((session.summary.score / session.summary.total) * 100)}%
                </span>
              </div>
              <h3 className="text-foreground mb-2 text-2xl font-bold">
                {session.summary.passed ? 'Quiz Passed!' : 'Not Quite There Yet'}
              </h3>
              <p className="text-muted-foreground">
                You got {session.summary.score} out of {session.summary.total} questions correct.
              </p>
              {!session.summary.passed && (
                <p className="text-muted-foreground mt-1 text-sm">
                  Passing score: {session.summary.passingScore}%
                </p>
              )}
              <div className="mt-8" />

              {session.summary.passed ? (
                <button
                  onClick={() => {
                    if (onPass)
                      onPass(Math.round((session.summary!.score / session.summary!.total) * 100));
                    else reset();
                  }}
                  className="border-accent text-accent hover:bg-accent/8 inline-flex items-center justify-center rounded-full border-2 bg-transparent px-8 py-3 text-sm font-medium transition-all"
                >
                  {onPass ? 'Continue' : 'Try Another Quiz'}
                </button>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <button
                    onClick={reset}
                    className="border-accent text-accent hover:bg-accent/8 inline-flex items-center justify-center gap-2 rounded-full border-2 bg-transparent px-8 py-3 text-sm font-medium transition-all"
                  >
                    <RefreshCw className="h-4 w-4" /> Try Again
                  </button>
                  {onFail && (
                    <button
                      onClick={onFail}
                      className="text-muted-foreground hover:text-foreground text-sm font-medium underline underline-offset-4 transition-colors"
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
