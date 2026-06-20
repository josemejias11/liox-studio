import { expect, test, describe } from 'vitest';
import { gradeQuestion, gradeSubmission, type GradableQuestion } from './quiz-grading';

describe('quiz-grading helpers', () => {
  const mockQuestion: GradableQuestion = {
    correctIndex: 1,
    options: ['A', 'B', 'C'],
    explanation: 'Explanation here',
  };

  test('gradeQuestion returns correct status and explanation', () => {
    const correctResult = gradeQuestion(mockQuestion, 1);
    expect(correctResult.correct).toBe(true);
    expect(correctResult.explanation).toBe('Explanation here');
    expect(correctResult.correctIndex).toBe(1);

    const incorrectResult = gradeQuestion(mockQuestion, 0);
    expect(incorrectResult.correct).toBe(false);
    expect(incorrectResult.explanation).toBe('Explanation here');
    expect(incorrectResult.correctIndex).toBe(1);
  });

  test('gradeSubmission calculates total score correctly', () => {
    const questions: GradableQuestion[] = [mockQuestion, mockQuestion];
    const userAnswers = [1, 0]; // 1 correct, 1 incorrect

    const submissionResult = gradeSubmission(questions, userAnswers, 100); // require 100%
    expect(submissionResult.score).toBe(1);
    expect(submissionResult.total).toBe(2);
    expect(submissionResult.passed).toBe(false);
    expect(submissionResult.results[0].correct).toBe(true);
    expect(submissionResult.results[1].correct).toBe(false);
  });
});
