'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Brain, CheckCircle, XCircle, Loader2, BarChart2 } from 'lucide-react';

type Question = {
  question: string;
  options: string[];
  correct_answer: string;
};

type QuizResponse = {
  questions?: Question[];
  quiz?: Question[]; // alternate possible key
  raw_text?: string;
};

export function CourseQuiz({ courseId = 'course_123', onPass }: { courseId?: string; onPass?: (score: number) => void }) {
  const [step, setStep] = useState<'idle' | 'analyzing' | 'generating' | 'ready' | 'playing' | 'results'>('idle');
  const [weakTopics, setWeakTopics] = useState<string[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [score, setScore] = useState(0);

  const startAnalysis = async () => {
    setStep('analyzing');
    // Simulate analyzing user analytics
    setTimeout(() => {
      setWeakTopics(['Advanced Camera Features', 'Battery Optimization']);
      setStep('generating');
      generateQuiz(['Advanced Camera Features', 'Battery Optimization']);
    }, 2500);
  };

  const generateQuiz = async (topics: string[]) => {
    try {
      const res = await fetch('http://localhost:8000/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: courseId,
          weak_topics: topics,
        }),
      });

      if (!res.ok) throw new Error('Failed to generate quiz');

      const data: QuizResponse = await res.json();
      
      const parsedQuestions = data.questions || data.quiz || [];
      if (parsedQuestions.length > 0) {
        setQuestions(parsedQuestions);
      } else {
        // Fallback dummy data if API returns an unexpected format
        setQuestions([
          {
            question: "Which of the following is a key feature of the advanced camera system?",
            options: ["Macro Lens", "Night Vision", "Optical Zoom", "All of the above"],
            correct_answer: "All of the above"
          },
          {
            question: "How can you optimize battery life during heavy usage?",
            options: ["Turn up brightness", "Enable battery saver mode", "Keep all background apps running", "Disable Wi-Fi"],
            correct_answer: "Enable battery saver mode"
          }
        ]);
      }
      setStep('ready');
    } catch (error) {
      console.error('Quiz generation error:', error);
      // Fallback
      setQuestions([
        {
          question: "Which of the following is a key feature of the advanced camera system?",
          options: ["Macro Lens", "Night Vision", "Optical Zoom", "All of the above"],
          correct_answer: "All of the above"
        },
        {
          question: "How can you optimize battery life during heavy usage?",
          options: ["Turn up brightness", "Enable battery saver mode", "Keep all background apps running", "Disable Wi-Fi"],
          correct_answer: "Enable battery saver mode"
        }
      ]);
      setStep('ready');
    }
  };

  const handleAnswer = (option: string) => {
    if (selectedOption) return; // Prevent double click
    setSelectedOption(option);
    
    const isCorrect = option === questions[currentQIndex].correct_answer;
    if (isCorrect) setScore(s => s + 1);

    setTimeout(() => {
      if (currentQIndex < questions.length - 1) {
        setCurrentQIndex(q => q + 1);
        setSelectedOption(null);
      } else {
        setStep('results');
      }
    }, 1500);
  };

  const reset = () => {
    setStep('idle');
    setWeakTopics([]);
    setQuestions([]);
    setCurrentQIndex(0);
    setSelectedOption(null);
    setScore(0);
  };

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
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Personalized learning path
          </p>
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
              <h3 className="mb-2 text-2xl font-bold text-slate-800 dark:text-slate-100">Ready to test your knowledge?</h3>
              <p className="mb-8 text-slate-600 dark:text-slate-400">We'll analyze your recent activity to focus on topics you might need help with.</p>
              <button
                onClick={startAnalysis}
                className="group relative inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-8 py-3.5 text-sm font-medium text-white transition-all hover:bg-slate-800 hover:shadow-lg dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                <span>Analyze & Generate Quiz</span>
                <Sparkles className="h-4 w-4 transition-transform group-hover:scale-110" />
              </button>
            </motion.div>
          )}

          {(step === 'analyzing' || step === 'generating') && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center text-center"
            >
              <Loader2 className="mb-6 h-12 w-12 animate-spin text-emerald-500" />
              <h3 className="mb-2 text-xl font-bold text-slate-800 dark:text-slate-100">
                {step === 'analyzing' ? 'Analyzing Activity Data...' : 'Generating Custom Quiz...'}
              </h3>
              {step === 'analyzing' && (
                <p className="text-slate-500 dark:text-slate-400">Scanning for least visited modules and recent interactions.</p>
              )}
              {step === 'generating' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-300"
                >
                  <p className="mb-2 text-sm font-semibold">Identified Weak Topics:</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {weakTopics.map(topic => (
                      <span key={topic} className="rounded-full bg-emerald-200/50 px-3 py-1 text-xs font-medium dark:bg-emerald-800/50">{topic}</span>
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
              <h3 className="mb-4 text-2xl font-bold text-slate-800 dark:text-slate-100">Your custom quiz is ready!</h3>
              <p className="mb-8 text-slate-600 dark:text-slate-400">{questions.length} questions tailored to your learning gaps.</p>
              <button
                onClick={() => setStep('playing')}
                className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-8 py-3.5 text-sm font-medium text-white transition-all hover:bg-emerald-500 hover:shadow-lg"
              >
                Start Quiz
              </button>
            </motion.div>
          )}

          {step === 'playing' && questions.length > 0 && (
            <motion.div
              key="playing"
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
                {questions[currentQIndex].question}
              </h3>

              <div className="space-y-3">
                {questions[currentQIndex].options.map((option, idx) => {
                  const isSelected = selectedOption === option;
                  const isCorrectAnswer = option === questions[currentQIndex].correct_answer;
                  const showCorrect = selectedOption && isCorrectAnswer;
                  const showWrong = isSelected && !isCorrectAnswer;

                  return (
                    <button
                      key={idx}
                      onClick={() => handleAnswer(option)}
                      disabled={!!selectedOption}
                      className={`relative flex w-full items-center justify-between rounded-xl border p-4 text-left transition-all ${
                        !selectedOption
                          ? 'border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 dark:border-slate-700 dark:hover:border-emerald-500 dark:hover:bg-emerald-900/20'
                          : showCorrect
                          ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-900/30'
                          : showWrong
                          ? 'border-red-500 bg-red-50 dark:border-red-500 dark:bg-red-900/30'
                          : 'border-slate-200 opacity-50 dark:border-slate-800'
                      }`}
                    >
                      <span className={`font-medium ${showCorrect ? 'text-emerald-700 dark:text-emerald-300' : showWrong ? 'text-red-700 dark:text-red-300' : 'text-slate-700 dark:text-slate-200'}`}>
                        {option}
                      </span>
                      {showCorrect && <CheckCircle className="h-5 w-5 text-emerald-500" />}
                      {showWrong && <XCircle className="h-5 w-5 text-red-500" />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {step === 'results' && (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg">
                <span className="text-3xl font-bold text-white">{Math.round((score / questions.length) * 100)}%</span>
              </div>
              <h3 className="mb-2 text-2xl font-bold text-slate-800 dark:text-slate-100">Quiz Completed!</h3>
              <p className="mb-8 text-slate-600 dark:text-slate-400">You got {score} out of {questions.length} questions correct.</p>
              
              <button
                onClick={() => {
                  if (onPass) onPass(Math.round((score / questions.length) * 100));
                  else reset();
                }}
                className="inline-flex items-center justify-center rounded-full border-2 border-emerald-500 bg-transparent px-8 py-3 text-sm font-medium text-emerald-600 transition-all hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
              >
                {onPass ? "Continue" : "Try Another Quiz"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
