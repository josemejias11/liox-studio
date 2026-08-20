import type { QuestionResult, SubmitQuizResponse } from '@moto-ai/contracts/quiz';

type QuizSessionPhase = 'answering' | 'revealed' | 'submitting' | 'complete';

export interface QuizSessionState {
  phase: QuizSessionPhase;
  currentQuestionIndex: number;
  selectedIndex: number | null;
  results: Array<QuestionResult | undefined>;
  answers: number[];
  summary: SubmitQuizResponse | null;
  error: string | null;
}

export type QuizSessionAction =
  | { type: 'answer.selected'; selectedIndex: number }
  | { type: 'answer.revealed'; selectedIndex: number; result: QuestionResult }
  | { type: 'answer.failed'; message: string }
  | { type: 'question.advanced'; totalQuestions: number }
  | { type: 'submission.started' }
  | { type: 'submission.succeeded'; summary: SubmitQuizResponse }
  | { type: 'submission.failed'; message: string }
  | { type: 'retry.requested' }
  | { type: 'session.reset' };

export function createQuizSessionState(): QuizSessionState {
  return {
    phase: 'answering',
    currentQuestionIndex: 0,
    selectedIndex: null,
    results: [],
    answers: [],
    summary: null,
    error: null,
  };
}

export function quizSessionReducer(
  state: QuizSessionState,
  action: QuizSessionAction,
): QuizSessionState {
  switch (action.type) {
    case 'answer.selected':
      return {
        ...state,
        selectedIndex: action.selectedIndex,
        error: null,
      };

    case 'answer.revealed': {
      const results = [...state.results];
      results[state.currentQuestionIndex] = action.result;

      return {
        ...state,
        phase: 'revealed',
        selectedIndex: action.selectedIndex,
        results,
        answers: [...state.answers, action.selectedIndex],
        error: null,
      };
    }

    case 'answer.failed':
      return {
        ...state,
        phase: 'answering',
        selectedIndex: null,
        error: action.message,
      };

    case 'question.advanced':
      if (state.currentQuestionIndex >= action.totalQuestions - 1) {
        return {
          ...state,
          phase: 'submitting',
          error: null,
        };
      }

      return {
        ...state,
        phase: 'answering',
        currentQuestionIndex: state.currentQuestionIndex + 1,
        selectedIndex: null,
        error: null,
      };

    case 'submission.started':
      return {
        ...state,
        phase: 'submitting',
        error: null,
      };

    case 'submission.succeeded':
      return {
        ...state,
        phase: 'complete',
        summary: action.summary,
        error: null,
      };

    case 'submission.failed':
      return {
        ...state,
        phase: 'submitting',
        error: action.message,
      };

    case 'retry.requested':
      return {
        ...state,
        error: null,
      };

    case 'session.reset':
      return createQuizSessionState();
  }
}
