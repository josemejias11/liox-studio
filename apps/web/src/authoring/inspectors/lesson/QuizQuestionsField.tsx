import {
  createQuizAnswerDraft,
  createQuizQuestionDraft,
  type QuizQuestionDraft,
} from '@/authoring/inspectors/lesson/lesson-draft';
import { FieldError, fieldError, lessonInputClass, lessonTextareaClass } from './FieldError';
import { AssetCollectionField } from './AssetCollectionField';
import { RepeatableField } from './RepeatableField';

interface Props {
  courseId: string;
  items: QuizQuestionDraft[];
  errors: Record<string, string>;
  disabled: boolean;
  onChange: (items: QuizQuestionDraft[]) => void;
}

export function QuizQuestionsField({ courseId, items, errors, disabled, onChange }: Props) {
  return (
    <RepeatableField
      addLabel="Add question"
      createItem={createQuizQuestionDraft}
      disabled={disabled}
      items={items}
      legend="Questions"
      onChange={onChange}
      renderItem={(item, index, questionActions) => {
        const update = (patch: Partial<QuizQuestionDraft>) =>
          questionActions.replace(item.clientKey, (current) => ({ ...current, ...patch }));

        return (
          <div className="space-y-3">
            <label className="block text-xs font-medium">
              Question
              <textarea
                className={lessonTextareaClass}
                disabled={disabled}
                onChange={(event) => update({ questionText: event.target.value })}
                value={item.questionText}
              />
            </label>
            <FieldError message={fieldError(errors, `quizQuestions.${index}.questionText`)} />
            <label className="block text-xs font-medium">
              Question type
              <select
                className={lessonInputClass}
                disabled={disabled}
                onChange={(event) => update({ questionType: event.target.value })}
                value={item.questionType}
              >
                <option value="single">Single answer</option>
                <option value="multi">Multiple answers</option>
                <option value="truefalse">True / false</option>
              </select>
            </label>
            <AssetCollectionField
              accept="image/*"
              courseId={courseId}
              disabled={disabled}
              label="Question image"
              maxItems={1}
              onChange={(images) => update({ image: images[0] })}
              value={item.image ? [item.image] : []}
            />
            <RepeatableField
              addLabel="Add answer"
              createItem={createQuizAnswerDraft}
              disabled={disabled}
              items={item.answers}
              legend="Answer choices"
              onChange={(answers) => update({ answers })}
              renderItem={(answer, answerIndex, answerActions) => (
                <div className="space-y-2">
                  <input
                    aria-label={`Answer ${answerIndex + 1}`}
                    className={lessonInputClass}
                    disabled={disabled}
                    onChange={(event) =>
                      answerActions.replace(answer.clientKey, (current) => ({
                        ...current,
                        text: event.target.value,
                      }))
                    }
                    value={answer.text}
                  />
                  <FieldError
                    message={fieldError(
                      errors,
                      `quizQuestions.${index}.answers.${answerIndex}.text`,
                    )}
                  />
                </div>
              )}
            />
          </div>
        );
      }}
    />
  );
}
