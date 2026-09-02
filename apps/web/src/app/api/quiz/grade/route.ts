import { NextRequest, NextResponse } from 'next/server';
import { QuizGradeRequestSchema } from '@lb-studio/contracts/quiz';
import {
  CourseConfigurationError,
  gradeQuestion,
  gradeSubmission,
  loadQuizAnswerKey,
  recordQuizAttempt,
} from '@/learning/server/quiz-grading';
import { jsonError, readJson, unexpectedApiError } from '@/shared/server/http';

export async function POST(req: NextRequest) {
  const parsed = await readJson(req, QuizGradeRequestSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  try {
    const key = await loadQuizAnswerKey(body.source, body.quizId);
    if (!key) {
      return jsonError('Quiz not found', 404);
    }
    if (body.action === 'submit' && body.source === 'course' && key.courseId !== body.courseId) {
      return jsonError('This quiz does not belong to the specified course', 400);
    }

    if (body.action === 'question') {
      const question = key.questions[body.questionIndex];
      if (!question || body.selectedIndex >= question.options.length) {
        return jsonError('Question or answer out of range', 400);
      }
      return NextResponse.json(gradeQuestion(question, body.selectedIndex));
    }
    if (body.answers.length !== key.questions.length) {
      return jsonError('Answer count does not match question count', 400);
    }

    const result = gradeSubmission(key.questions, body.answers, key.passingScore);
    if (body.sessionId && body.courseId) {
      await recordQuizAttempt({
        sessionId: body.sessionId,
        courseId: body.courseId,
        quizId: body.quizId,
        result,
        answers: body.answers,
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof CourseConfigurationError) {
      return jsonError(err.message, 422);
    }
    return unexpectedApiError('api/quiz/grade', err);
  }
}
