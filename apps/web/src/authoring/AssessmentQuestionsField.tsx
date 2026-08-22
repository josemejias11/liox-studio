'use client';

import {
  createAssessmentAnswerDraft,
  createAssessmentQuestionDraft,
  type AssessmentQuestionDraft,
} from './assessment-draft';
import { AssetCollectionField } from './inspectors/lesson/AssetCollectionField';
import {
  FieldError,
  fieldError,
  lessonInputClass,
  lessonTextareaClass,
} from './inspectors/lesson/FieldError';

interface Props {
  courseId: string;
  disabled: boolean;
  errors: Record<string, string>;
  items: AssessmentQuestionDraft[];
  onChange: (update: (items: AssessmentQuestionDraft[]) => AssessmentQuestionDraft[]) => void;
}

function move<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function AssessmentQuestionsField({ courseId, disabled, errors, items, onChange }: Props) {
  function replaceQuestion(
    clientKey: string,
    update: (question: AssessmentQuestionDraft) => AssessmentQuestionDraft,
  ): void {
    onChange((current) =>
      current.map((item) => (item.clientKey === clientKey ? update(item) : item)),
    );
  }

  return (
    <fieldset className="studio-glass-control border-border space-y-3 rounded-xl border p-3">
      <legend className="px-1 text-sm font-semibold">Questions</legend>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-xs">Add at least one single-answer question.</p>
      ) : null}
      {items.map((question, questionIndex) => (
        <section
          className="studio-glass-panel border-border/70 space-y-3 rounded-lg border p-3"
          key={question.clientKey}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold">Question {questionIndex + 1}</p>
            <div className="flex items-center gap-1">
              <button
                aria-label={`Move question ${questionIndex + 1} up`}
                className="studio-glass-control rounded border px-2 py-1 text-xs disabled:opacity-40"
                disabled={disabled || questionIndex === 0}
                onClick={() => onChange((current) => move(current, questionIndex, -1))}
                type="button"
              >
                ↑
              </button>
              <button
                aria-label={`Move question ${questionIndex + 1} down`}
                className="studio-glass-control rounded border px-2 py-1 text-xs disabled:opacity-40"
                disabled={disabled || questionIndex === items.length - 1}
                onClick={() => onChange((current) => move(current, questionIndex, 1))}
                type="button"
              >
                ↓
              </button>
              <button
                className="studio-glass-control text-destructive rounded border px-2 py-1 text-xs disabled:opacity-40"
                disabled={disabled}
                onClick={() =>
                  onChange((current) =>
                    current.filter((item) => item.clientKey !== question.clientKey),
                  )
                }
                type="button"
              >
                Remove
              </button>
            </div>
          </div>
          <label className="block text-xs font-medium">
            Question
            <textarea
              className={lessonTextareaClass}
              disabled={disabled}
              onChange={(event) =>
                replaceQuestion(question.clientKey, (current) => ({
                  ...current,
                  questionText: event.target.value,
                }))
              }
              value={question.questionText}
            />
          </label>
          <FieldError message={fieldError(errors, `questions.${questionIndex}.questionText`)} />
          <AssetCollectionField
            accept="image/*"
            courseId={courseId}
            disabled={disabled}
            label="Question image"
            maxItems={1}
            onChange={(images) =>
              replaceQuestion(question.clientKey, (current) => ({
                ...current,
                image: images[0]
                  ? { asset: { url: images[0].url, originalFilename: images[0].originalFilename } }
                  : undefined,
              }))
            }
            value={
              question.image?.asset.url
                ? [
                    {
                      url: question.image.asset.url,
                      originalFilename: question.image.asset.originalFilename,
                      original: question.image,
                    },
                  ]
                : []
            }
          />
          <label className="block text-xs font-medium">
            Explanation after grading
            <textarea
              className={lessonTextareaClass}
              disabled={disabled}
              onChange={(event) =>
                replaceQuestion(question.clientKey, (current) => ({
                  ...current,
                  explanation: event.target.value,
                }))
              }
              value={question.explanation}
            />
          </label>
          <FieldError message={fieldError(errors, `questions.${questionIndex}.explanation`)} />
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold">Answer choices</legend>
            {question.answers.map((answer, answerIndex) => (
              <div className="border-border rounded-md border p-2" key={answer.clientKey}>
                <div className="flex items-center gap-2">
                  <input
                    checked={answer.isCorrect}
                    disabled={disabled}
                    id={`assessment-correct-${answer.clientKey}`}
                    name={`assessment-correct-${question.clientKey}`}
                    onChange={() =>
                      replaceQuestion(question.clientKey, (current) => ({
                        ...current,
                        answers: current.answers.map((item) => ({
                          ...item,
                          isCorrect: item.clientKey === answer.clientKey,
                        })),
                      }))
                    }
                    type="radio"
                  />
                  <label
                    className="text-xs font-medium"
                    htmlFor={`assessment-correct-${answer.clientKey}`}
                  >
                    Mark answer {answerIndex + 1} as correct
                  </label>
                  <button
                    className="text-destructive ml-auto text-xs disabled:opacity-40"
                    disabled={disabled || question.answers.length <= 2}
                    onClick={() =>
                      replaceQuestion(question.clientKey, (current) => ({
                        ...current,
                        answers: current.answers.filter(
                          (item) => item.clientKey !== answer.clientKey,
                        ),
                      }))
                    }
                    type="button"
                  >
                    Remove
                  </button>
                  <button
                    aria-label={`Move answer ${answerIndex + 1} up`}
                    className="studio-glass-control rounded border px-2 py-1 text-xs disabled:opacity-40"
                    disabled={disabled || answerIndex === 0}
                    onClick={() =>
                      replaceQuestion(question.clientKey, (current) => ({
                        ...current,
                        answers: move(current.answers, answerIndex, -1),
                      }))
                    }
                    type="button"
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`Move answer ${answerIndex + 1} down`}
                    className="studio-glass-control rounded border px-2 py-1 text-xs disabled:opacity-40"
                    disabled={disabled || answerIndex === question.answers.length - 1}
                    onClick={() =>
                      replaceQuestion(question.clientKey, (current) => ({
                        ...current,
                        answers: move(current.answers, answerIndex, 1),
                      }))
                    }
                    type="button"
                  >
                    ↓
                  </button>
                </div>
                <label
                  className="mt-2 block text-xs font-medium"
                  htmlFor={`assessment-answer-${answer.clientKey}`}
                >
                  Answer {answerIndex + 1}
                </label>
                <input
                  className={lessonInputClass}
                  disabled={disabled}
                  id={`assessment-answer-${answer.clientKey}`}
                  onChange={(event) =>
                    replaceQuestion(question.clientKey, (current) => ({
                      ...current,
                      answers: current.answers.map((item) =>
                        item.clientKey === answer.clientKey
                          ? { ...item, text: event.target.value }
                          : item,
                      ),
                    }))
                  }
                  value={answer.text}
                />
                <FieldError
                  message={fieldError(
                    errors,
                    `questions.${questionIndex}.answers.${answerIndex}.text`,
                  )}
                />
                <label
                  className="mt-2 block text-xs font-medium"
                  htmlFor={`assessment-feedback-${answer.clientKey}`}
                >
                  Feedback for answer {answerIndex + 1}
                </label>
                <textarea
                  className={lessonTextareaClass}
                  disabled={disabled}
                  id={`assessment-feedback-${answer.clientKey}`}
                  onChange={(event) =>
                    replaceQuestion(question.clientKey, (current) => ({
                      ...current,
                      answers: current.answers.map((item) =>
                        item.clientKey === answer.clientKey
                          ? { ...item, feedback: event.target.value }
                          : item,
                      ),
                    }))
                  }
                  value={answer.feedback}
                />
                <FieldError
                  message={fieldError(
                    errors,
                    `questions.${questionIndex}.answers.${answerIndex}.feedback`,
                  )}
                />
              </div>
            ))}
            <FieldError message={fieldError(errors, `questions.${questionIndex}.answers`)} />
            <button
              className="studio-glass-control border-border hover:border-primary hover:text-primary min-h-11 w-full rounded-lg border border-dashed px-3 py-2 text-xs font-medium disabled:opacity-50"
              disabled={disabled || question.answers.length >= 8}
              onClick={() =>
                replaceQuestion(question.clientKey, (current) => ({
                  ...current,
                  answers: [...current.answers, createAssessmentAnswerDraft()],
                }))
              }
              type="button"
            >
              + Add answer
            </button>
          </fieldset>
        </section>
      ))}
      <button
        className="studio-glass-control border-border hover:border-primary hover:text-primary min-h-11 w-full rounded-lg border border-dashed px-3 py-2 text-xs font-medium disabled:opacity-50"
        disabled={disabled || items.length >= 100}
        onClick={() => onChange((current) => [...current, createAssessmentQuestionDraft()])}
        type="button"
      >
        + Add question
      </button>
    </fieldset>
  );
}
