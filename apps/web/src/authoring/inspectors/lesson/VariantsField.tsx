import {
  createColorVariantDraft,
  type ColorVariantDraft,
} from '@/authoring/inspectors/lesson/lesson-draft';
import { FieldError, lessonInputClass } from './FieldError';
import { AssetCollectionField } from './AssetCollectionField';
import { RepeatableField } from './RepeatableField';

interface Props {
  courseId: string;
  items: ColorVariantDraft[];
  disabled: boolean;
  onChange: (items: ColorVariantDraft[]) => void;
}

export function VariantsField({ courseId, items, disabled, onChange }: Props) {
  return (
    <RepeatableField
      addLabel="Add variant"
      createItem={createColorVariantDraft}
      disabled={disabled}
      items={items}
      legend="Color variants"
      onChange={onChange}
      renderItem={(item, _index, actions) => (
        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_7rem] gap-2">
            <label className="block text-xs font-medium">
              Label
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
            <label className="block text-xs font-medium">
              Color
              <input
                className={`${lessonInputClass} h-10 p-1`}
                disabled={disabled}
                onChange={(event) =>
                  actions.replace(item.clientKey, (current) => ({
                    ...current,
                    colorHex: event.target.value,
                  }))
                }
                type="color"
                value={item.colorHex || '#685bc7'}
              />
            </label>
          </div>
          <FieldError message={!item.label.trim() ? 'Variant label is required.' : undefined} />
          <AssetCollectionField
            accept="image/*"
            courseId={courseId}
            disabled={disabled}
            label="Variant image"
            maxItems={1}
            onChange={(images) =>
              actions.replace(item.clientKey, (current) => ({ ...current, image: images[0] }))
            }
            value={item.image ? [item.image] : []}
          />
        </div>
      )}
    />
  );
}
