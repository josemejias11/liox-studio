import {
  createScrollChapterDraft,
  type ScrollChapterDraft,
} from '@/authoring/inspectors/lesson/lesson-draft';
import { FieldError, fieldError, lessonInputClass } from './FieldError';
import { AssetCollectionField } from './AssetCollectionField';
import { RepeatableField } from './RepeatableField';
import { RichTextField } from './RichTextField';

interface Props {
  courseId: string;
  cueTargets: string[];
  items: ScrollChapterDraft[];
  errors: Record<string, string>;
  disabled: boolean;
  onChange: (items: ScrollChapterDraft[]) => void;
}

export function ScrollChaptersField({
  courseId,
  cueTargets,
  items,
  errors,
  disabled,
  onChange,
}: Props) {
  return (
    <RepeatableField
      addLabel="Add chapter"
      createItem={createScrollChapterDraft}
      disabled={disabled}
      items={items}
      legend="Story chapters"
      onChange={onChange}
      renderItem={(item, index, actions) => (
        <div className="space-y-3">
          <label className="block text-xs font-medium">
            Heading
            <input
              className={lessonInputClass}
              disabled={disabled}
              onChange={(event) =>
                actions.replace(item.clientKey, (current) => ({
                  ...current,
                  heading: event.target.value,
                }))
              }
              value={item.heading}
            />
          </label>
          <FieldError message={fieldError(errors, `scrollChapters.${index}.heading`)} />
          <RichTextField
            cueTargets={cueTargets}
            disabled={disabled}
            error={fieldError(errors, `scrollChapters.${index}.body.layerLink`)}
            label="Body"
            onChange={(body) =>
              actions.replace(item.clientKey, (current) => ({ ...current, body }))
            }
            value={item.body}
          />
          <AssetCollectionField
            accept="image/*"
            courseId={courseId}
            disabled={disabled}
            label="Chapter image"
            maxItems={1}
            onChange={(images) =>
              actions.replace(item.clientKey, (current) => ({ ...current, image: images[0] }))
            }
            value={item.image ? [item.image] : []}
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-medium">
              Scale
              <input
                className={lessonInputClass}
                disabled={disabled}
                onChange={(event) =>
                  actions.replace(item.clientKey, (current) => ({
                    ...current,
                    targetScale: event.target.value,
                  }))
                }
                type="number"
                value={item.targetScale}
              />
            </label>
            <label className="block text-xs font-medium">
              Rotation
              <input
                className={lessonInputClass}
                disabled={disabled}
                onChange={(event) =>
                  actions.replace(item.clientKey, (current) => ({
                    ...current,
                    targetRotation: event.target.value,
                  }))
                }
                type="number"
                value={item.targetRotation}
              />
            </label>
            <label className="block text-xs font-medium">
              X
              <input
                className={lessonInputClass}
                disabled={disabled}
                onChange={(event) =>
                  actions.replace(item.clientKey, (current) => ({
                    ...current,
                    targetX: event.target.value,
                  }))
                }
                type="number"
                value={item.targetX}
              />
            </label>
            <label className="block text-xs font-medium">
              Y
              <input
                className={lessonInputClass}
                disabled={disabled}
                onChange={(event) =>
                  actions.replace(item.clientKey, (current) => ({
                    ...current,
                    targetY: event.target.value,
                  }))
                }
                type="number"
                value={item.targetY}
              />
            </label>
          </div>
        </div>
      )}
    />
  );
}
