import { describe, expect, test } from 'vitest';

import type { QuestionResult, SubmitQuizResponse } from '@/lib/contracts/quiz';

import { createQuizSessionState, quizSessionReducer } from './quiz-session';

describe('quiz-session reducer', () => {
  const correctResult: QuestionResult = {
    correct: true,
    correctIndex: 2,
    explanation: 'Because it is correct.',
  };

  const incorrectResult: QuestionResult = {
    correct: false,
    correctIndex: 1,
    explanation: 'Because it is incorrect.',
  };

  test('selects an answer for the current question', () => {
    const state = createQuizSessionState();

    const next = quizSessionReducer(state, { type: 'answer.selected', selectedIndex: 2 });

    expect(next.selectedIndex).toBe(2);
    expect(next.phase).toBe('answering');
    expect(next.error).toBeNull();
  });

  test('reveals a correct answer and advances to the next question', () => {
    const selected = quizSessionReducer(createQuizSessionState(), {
      type: 'answer.selected',
      selectedIndex: 2,
    });

    const revealed = quizSessionReducer(selected, {
      type: 'answer.revealed',
      selectedIndex: 2,
      result: correctResult,
    });

    expect(revealed.phase).toBe('revealed');
    expect(revealed.results[0]).toEqual(correctResult);
    expect(revealed.answers).toEqual([2]);

    const advanced = quizSessionReducer(revealed, {
      type: 'question.advanced',
      totalQuestions: 2,
    });

    expect(advanced.currentQuestionIndex).toBe(1);
    expect(advanced.selectedIndex).toBeNull();
    expect(advanced.phase).toBe('answering');
  });

  test('reveals an incorrect answer and enters submit mode on the last question', () => {
    const state = {
      ...createQuizSessionState(),
      currentQuestionIndex: 1,
    };

    const selected = quizSessionReducer(state, {
      type: 'answer.selected',
      selectedIndex: 0,
    });

    const revealed = quizSessionReducer(selected, {
      type: 'answer.revealed',
      selectedIndex: 0,
      result: incorrectResult,
    });

    expect(revealed.phase).toBe('revealed');
    expect(revealed.results[1]).toEqual(incorrectResult);
    expect(revealed.answers).toEqual([0]);

    const submitting = quizSessionReducer(revealed, {
      type: 'question.advanced',
      totalQuestions: 2,
    });

    expect(submitting.phase).toBe('submitting');
    expect(submitting.currentQuestionIndex).toBe(1);
  });

  test('stores the completion summary after submission succeeds', () => {
    const summary: SubmitQuizResponse = {
      score: 2,
      total: 2,
      passed: true,
      passingScore: 80,
      results: [correctResult, correctResult],
    };

    const submitting = quizSessionReducer(createQuizSessionState(), {
      type: 'submission.started',
    });

    const completed = quizSessionReducer(submitting, {
      type: 'submission.succeeded',
      summary,
    });

    expect(completed.phase).toBe('complete');
    expect(completed.summary).toEqual(summary);
    expect(completed.error).toBeNull();
  });

  test('supports retrying after answer and submission errors', () => {
    const answerFailure = quizSessionReducer(createQuizSessionState(), {
      type: 'answer.failed',
      message: 'Try again.',
    });

    expect(answerFailure.error).toBe('Try again.');
    expect(answerFailure.selectedIndex).toBeNull();
    expect(answerFailure.phase).toBe('answering');

    const retryAnswer = quizSessionReducer(answerFailure, { type: 'retry.requested' });

    expect(retryAnswer.error).toBeNull();
    expect(retryAnswer.phase).toBe('answering');

    const submitFailure = quizSessionReducer(
      quizSessionReducer(createQuizSessionState(), { type: 'submission.started' }),
      {
        type: 'submission.failed',
        message: 'Score it again.',
      },
    );

    expect(submitFailure.phase).toBe('submitting');
    expect(submitFailure.error).toBe('Score it again.');

    const retrySubmit = quizSessionReducer(submitFailure, { type: 'retry.requested' });

    expect(retrySubmit.phase).toBe('submitting');
    expect(retrySubmit.error).toBeNull();
  });
});
