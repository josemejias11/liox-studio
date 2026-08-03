import {
  createHotspotDraft,
  type HotspotDraft,
  type LessonImageDraft,
} from '@/authoring/inspectors/lesson/lesson-draft';
import { FieldError, fieldError, lessonInputClass } from './FieldError';
import { AssetCollectionField } from './AssetCollectionField';
import { HotspotCanvas } from './HotspotCanvas';
import { RepeatableField } from './RepeatableField';
import { RichTextField } from './RichTextField';

interface Props {
  legend?: string;
  courseId: string;
  image?: LessonImageDraft;
  cueTargets: string[];
  items: HotspotDraft[];
  errors: Record<string, string>;
  disabled: boolean;
  onChange: (items: HotspotDraft[]) => void;
}

export function HotspotsField({
  legend = 'Hotspots / inspection targets',
  courseId,
  image,
  cueTargets,
  items,
  errors,
  disabled,
  onChange,
}: Props) {
  return (
    <RepeatableField
      addLabel="Add target"
      createItem={createHotspotDraft}
      disabled={disabled}
      items={items}
      legend={legend}
      onChange={onChange}
      renderBeforeItems={(actions) => (
        <HotspotCanvas
          disabled={disabled}
          hotspots={items}
          image={image}
          onAdd={(x, y) => actions.append(createHotspotDraft(x, y))}
          onRemove={actions.remove}
          onReplace={actions.replace}
        />
      )}
      renderItem={(item, index, actions) => {
        const update = (patch: Partial<HotspotDraft>) =>
          actions.replace(item.clientKey, (current) => ({ ...current, ...patch }));

        return (
          <div className="space-y-3">
            <label className="block text-xs font-medium">
              Label
              <input
                className={lessonInputClass}
                disabled={disabled}
                onChange={(event) => update({ label: event.target.value })}
                value={item.label}
              />
            </label>
            <FieldError message={fieldError(errors, `hotspots.${index}.label`)} />
            <label className="block text-xs font-medium">
              Topic
              <input
                className={lessonInputClass}
                disabled={disabled}
                onChange={(event) => update({ topic: event.target.value })}
                value={item.topic}
              />
            </label>
            <RichTextField
              cueTargets={cueTargets}
              disabled={disabled}
              error={fieldError(errors, `hotspots.${index}.body.layerLink`)}
              label="Learning content"
              onChange={(body) => update({ body })}
              value={item.body}
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-medium">
                X position (%)
                <input
                  className={lessonInputClass}
                  disabled={disabled}
                  inputMode="decimal"
                  onChange={(event) => update({ x: event.target.value })}
                  type="number"
                  value={item.x}
                />
              </label>
              <label className="block text-xs font-medium">
                Y position (%)
                <input
                  className={lessonInputClass}
                  disabled={disabled}
                  inputMode="decimal"
                  onChange={(event) => update({ y: event.target.value })}
                  type="number"
                  value={item.y}
                />
              </label>
            </div>
            <FieldError
              message={
                fieldError(errors, `hotspots.${index}.x`) ||
                fieldError(errors, `hotspots.${index}.y`)
              }
            />
            <label className="flex items-center gap-2 text-xs font-medium">
              <input
                checked={item.required}
                disabled={disabled}
                onChange={(event) => update({ required: event.target.checked })}
                type="checkbox"
              />{' '}
              Required to complete
            </label>
            <AssetCollectionField
              accept="image/*"
              courseId={courseId}
              disabled={disabled}
              label="Photo gallery"
              onChange={(photos) => update({ photos })}
              value={item.photos}
            />
            <AssetCollectionField
              accept="video/*"
              courseId={courseId}
              disabled={disabled}
              label="Supporting video"
              maxItems={1}
              onChange={(videos) => update({ videoFile: videos[0] })}
              value={item.videoFile ? [item.videoFile] : []}
            />
            <label className="block text-xs font-medium">
              Video aspect ratio
              <input
                className={lessonInputClass}
                disabled={disabled}
                onChange={(event) => update({ videoAspectRatio: event.target.value })}
                placeholder="16:9"
                value={item.videoAspectRatio}
              />
            </label>
          </div>
        );
      }}
    />
  );
}
