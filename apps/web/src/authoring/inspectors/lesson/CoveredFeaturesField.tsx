import type { CoveredFeatureDraft } from '@/authoring/inspectors/lesson/lesson-draft';
import { createCoveredFeatureDraft } from '@/authoring/inspectors/lesson/lesson-draft';
import { FieldError, fieldError, lessonInputClass, lessonTextareaClass } from './FieldError';
import { RepeatableField } from './RepeatableField';

interface Props {
  items: CoveredFeatureDraft[];
  errors: Record<string, string>;
  disabled: boolean;
  onChange: (items: CoveredFeatureDraft[]) => void;
}

export function CoveredFeaturesField({ items, errors, disabled, onChange }: Props) {
  return (
    <RepeatableField
      addLabel="Add feature"
      createItem={createCoveredFeatureDraft}
      disabled={disabled}
      items={items}
      legend="Covered features"
      onChange={onChange}
      renderItem={(item, index, actions) => (
        <div className="space-y-3">
          <label className="block text-xs font-medium">
            Feature label
            <input
              className={lessonInputClass}
              disabled={disabled}
              onChange={(event) =>
                actions.replace(item.clientKey, (current) => ({
                  ...current,
                  label: event.target.value,
                }))
              }
              value={item.label}
            />
          </label>
          <FieldError message={fieldError(errors, `coveredFeatures.${index}.label`)} />
          <label className="block text-xs font-medium">
            Summary
            <textarea
              className={lessonTextareaClass}
              disabled={disabled}
              onChange={(event) =>
                actions.replace(item.clientKey, (current) => ({
                  ...current,
                  summary: event.target.value,
                }))
              }
              value={item.summary}
            />
          </label>
        </div>
      )}
    />
  );
}
