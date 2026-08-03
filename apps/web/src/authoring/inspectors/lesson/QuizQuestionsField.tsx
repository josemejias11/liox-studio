import { createCourseStudioKey } from '@/shared/contracts/course-studio';
import type { QuizQuestionDraft } from '@/authoring/inspectors/lesson/lesson-draft';
import { FieldError, fieldError, lessonInputClass, lessonTextareaClass } from './FieldError';
import { RepeatableField } from './RepeatableField';
import { AssetCollectionField } from './AssetCollectionField';

interface Props { courseId: string; items: QuizQuestionDraft[]; errors: Record<string, string>; disabled: boolean; onChange: (items: QuizQuestionDraft[]) => void }
function move<T>(items: T[], index: number, direction: -1 | 1) { const target = index + direction; if (target < 0 || target >= items.length) return items; const next = [...items]; [next[index], next[target]] = [next[target], next[index]]; return next; }

export function QuizQuestionsField({ courseId, items, errors, disabled, onChange }: Props) {
  return <RepeatableField legend="Questions" addLabel="Add question" disabled={disabled} items={items} onAdd={() => onChange([...items, { clientKey: createCourseStudioKey('question'), persistedKey: createCourseStudioKey('question-persisted'), questionText: '', questionType: 'single', answers: [] }])} onMove={(index, direction) => onChange(move(items, index, direction))} onRemove={(index) => onChange(items.filter((_, itemIndex) => itemIndex !== index))} renderItem={(item, index) => {
    const update = (patch: Partial<QuizQuestionDraft>) => onChange(items.map((question, itemIndex) => itemIndex === index ? { ...question, ...patch } : question));
    return <div className="space-y-3">
      <label className="block text-xs font-medium">Question<textarea className={lessonTextareaClass} disabled={disabled} onChange={(event) => update({ questionText: event.target.value })} value={item.questionText} /></label>
      <FieldError message={fieldError(errors, `quizQuestions.${index}.questionText`)} />
      <label className="block text-xs font-medium">Question type<select className={lessonInputClass} disabled={disabled} onChange={(event) => update({ questionType: event.target.value })} value={item.questionType}><option value="single">Single answer</option><option value="multi">Multiple answers</option><option value="truefalse">True / false</option></select></label>
      <AssetCollectionField accept="image/*" courseId={courseId} disabled={disabled} label="Question image" maxItems={1} onChange={(images) => update({ image: images[0] })} value={item.image ? [item.image] : []} />
      <div className="space-y-2 rounded-lg bg-muted/40 p-2"><p className="text-xs font-semibold">Answer choices</p>{item.answers.map((answer, answerIndex) => <div className="flex items-start gap-2" key={answer.clientKey}><input aria-label={`Answer ${answerIndex + 1}`} className={lessonInputClass} disabled={disabled} onChange={(event) => update({ answers: item.answers.map((candidate, candidateIndex) => candidateIndex === answerIndex ? { ...candidate, text: event.target.value } : candidate) })} value={answer.text} /><button className="min-h-11 rounded px-2 text-xs text-destructive hover:bg-destructive/10" disabled={disabled} onClick={() => update({ answers: item.answers.filter((_, candidateIndex) => candidateIndex !== answerIndex) })} type="button">Remove</button><FieldError message={fieldError(errors, `quizQuestions.${index}.answers.${answerIndex}.text`)} /></div>)}<button className="min-h-11 rounded border border-dashed border-border px-3 text-xs hover:border-primary" disabled={disabled} onClick={() => update({ answers: [...item.answers, { clientKey: createCourseStudioKey('answer'), persistedKey: createCourseStudioKey('answer-persisted'), text: '' }] })} type="button">+ Add answer</button></div>
    </div>;
  }} />;
}
