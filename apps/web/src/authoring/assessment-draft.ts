import {
  CourseAssessmentInputSchema,
  type CourseAssessmentInput,
  type CourseImageReference,
} from '@lb-studio/contracts';
import type { CourseGraphQuiz } from '@lb-studio/contracts/course-studio';
import {
  createCourseStudioKey,
  createStableCourseStudioKey,
  imageReference,
} from '@/shared/contracts/course-settings';

export interface AssessmentAnswerDraft {
  clientKey: string;
  persistedKey: string;
  text: string;
  isCorrect: boolean;
  feedback: string;
}

export interface AssessmentQuestionDraft {
  clientKey: string;
  persistedKey: string;
  questionText: string;
  image?: CourseImageReference;
  explanation: string;
  answers: AssessmentAnswerDraft[];
}

export interface AssessmentDraft {
  title: string;
  instructions: string;
  passingScore: string;
  allowRetry: boolean;
  showCorrectAnswers: boolean;
  questions: AssessmentQuestionDraft[];
}

export interface AssessmentValidation {
  valid: boolean;
  errors: Record<string, string>;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function string(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function persistedKey(prefix: string, value: Record<string, unknown>): string {
  return string(value._key) || createCourseStudioKey(`${prefix}-key`);
}

function clientKey(prefix: string, persisted: string, index: number): string {
  return createStableCourseStudioKey(prefix, `${persisted}-${index}`);
}

export function createAssessmentAnswerDraft(): AssessmentAnswerDraft {
  return {
    clientKey: createCourseStudioKey('assessment-answer'),
    persistedKey: createCourseStudioKey('assessment-answer-key'),
    text: '',
    isCorrect: false,
    feedback: '',
  };
}

export function createAssessmentQuestionDraft(): AssessmentQuestionDraft {
  return {
    clientKey: createCourseStudioKey('assessment-question'),
    persistedKey: createCourseStudioKey('assessment-question-key'),
    questionText: '',
    explanation: '',
    answers: [createAssessmentAnswerDraft(), createAssessmentAnswerDraft()],
  };
}

export function createAssessmentDraft(title: string): AssessmentDraft {
  return {
    title,
    instructions: '',
    passingScore: '80',
    allowRetry: true,
    showCorrectAnswers: true,
    questions: [],
  };
}

export function assessmentDraft(
  quiz: CourseGraphQuiz | null,
  fallbackTitle: string,
): AssessmentDraft {
  if (!quiz) return createAssessmentDraft(fallbackTitle);

  const payload = record(quiz.payload);
  const questions = Array.isArray(payload.questions) ? payload.questions : [];
  return {
    title: quiz.title ?? fallbackTitle,
    instructions: quiz.instructions ?? '',
    passingScore:
      typeof payload.passingScore === 'number' && Number.isFinite(payload.passingScore)
        ? String(payload.passingScore)
        : '80',
    allowRetry: payload.allowRetry === true,
    showCorrectAnswers: payload.showCorrectAnswers === true,
    questions: questions.map((value, questionIndex) => {
      const question = record(value);
      const questionPersistedKey = persistedKey('assessment-question', question);
      const answers = Array.isArray(question.answers) ? question.answers : [];
      return {
        clientKey: clientKey('assessment-question', questionPersistedKey, questionIndex),
        persistedKey: questionPersistedKey,
        questionText: string(question.questionText),
        image: imageReference(question.image),
        explanation: string(question.explanation),
        answers: answers.map((answerValue, answerIndex) => {
          const answer = record(answerValue);
          const answerPersistedKey = persistedKey('assessment-answer', answer);
          return {
            clientKey: clientKey(
              `assessment-answer-${questionIndex}`,
              answerPersistedKey,
              answerIndex,
            ),
            persistedKey: answerPersistedKey,
            text: string(answer.text),
            isCorrect: answer.isCorrect === true,
            feedback: string(answer.feedback),
          };
        }),
      };
    }),
  };
}

export function assessmentInput(draft: AssessmentDraft): CourseAssessmentInput {
  return CourseAssessmentInputSchema.parse({
    title: draft.title,
    instructions: draft.instructions || undefined,
    passingScore: Number(draft.passingScore),
    allowRetry: draft.allowRetry,
    showCorrectAnswers: draft.showCorrectAnswers,
    questions: draft.questions.map((question) => ({
      _key: question.persistedKey,
      questionText: question.questionText,
      questionType: 'single' as const,
      image: question.image,
      explanation: question.explanation || undefined,
      answers: question.answers.map((answer) => ({
        _key: answer.persistedKey,
        text: answer.text,
        isCorrect: answer.isCorrect,
        feedback: answer.feedback || undefined,
      })),
    })),
  });
}

export function assessmentFingerprint(draft: AssessmentDraft): string {
  return JSON.stringify(draft, (key, value) => (key === 'clientKey' ? undefined : value));
}

export function validateAssessmentDraft(draft: AssessmentDraft): AssessmentValidation {
  const parsed = CourseAssessmentInputSchema.safeParse({
    title: draft.title,
    instructions: draft.instructions || undefined,
    passingScore: Number(draft.passingScore),
    allowRetry: draft.allowRetry,
    showCorrectAnswers: draft.showCorrectAnswers,
    questions: draft.questions.map((question) => ({
      _key: question.persistedKey,
      questionText: question.questionText,
      questionType: 'single' as const,
      image: question.image,
      explanation: question.explanation || undefined,
      answers: question.answers.map((answer) => ({
        _key: answer.persistedKey,
        text: answer.text,
        isCorrect: answer.isCorrect,
        feedback: answer.feedback || undefined,
      })),
    })),
  });
  if (parsed.success) return { valid: true, errors: {} };

  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const path = issue.path.join('.');
    if (!errors[path]) errors[path] = issue.message;
  }
  return { valid: false, errors };
}
