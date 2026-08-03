import { createCourseStudioKey, type JsonObject } from '@/shared/contracts/course-studio';
import type { CoveredFeatureDraft } from '@/authoring/inspectors/lesson/lesson-draft';
import { FieldError, fieldError, lessonInputClass, lessonTextareaClass } from './FieldError';
import { RepeatableField } from './RepeatableField';

interface Props { items: CoveredFeatureDraft[]; errors: Record<string, string>; disabled: boolean; onChange: (items: CoveredFeatureDraft[]) => void }

function move<T>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function CoveredFeaturesField({ items, errors, disabled, onChange }: Props) {
  return <RepeatableField legend="Covered features" addLabel="Add feature" disabled={disabled} items={items} onAdd={() => onChange([...items, { clientKey: createCourseStudioKey('feature'), persistedKey: createCourseStudioKey('feature-persisted'), label: '', summary: '' }])} onMove={(index, direction) => onChange(move(items, index, direction))} onRemove={(index) => onChange(items.filter((_, itemIndex) => itemIndex !== index))} renderItem={(item, index) => (
    <div className="space-y-3">
      <label className="block text-xs font-medium">Feature label<input className={lessonInputClass} disabled={disabled} onChange={(event) => onChange(items.map((feature, itemIndex) => itemIndex === index ? { ...feature, label: event.target.value } : feature))} value={item.label} /></label>
      <FieldError message={fieldError(errors, `coveredFeatures.${index}.label`)} />
      <label className="block text-xs font-medium">Summary<textarea className={lessonTextareaClass} disabled={disabled} onChange={(event) => onChange(items.map((feature, itemIndex) => itemIndex === index ? { ...feature, summary: event.target.value } : feature))} value={item.summary} /></label>
    </div>
  )} />;
}

export type { JsonObject };
