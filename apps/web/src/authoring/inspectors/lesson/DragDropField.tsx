import {
  createDragChipDraft,
  createDropZoneDraft,
  type DragChipDraft,
  type DropZoneDraft,
} from '@/authoring/inspectors/lesson/lesson-draft';
import { FieldError, fieldError, lessonInputClass } from './FieldError';
import { RepeatableField } from './RepeatableField';

interface Props {
  chips: DragChipDraft[];
  zones: DropZoneDraft[];
  errors: Record<string, string>;
  disabled: boolean;
  onChange: (chips: DragChipDraft[], zones: DropZoneDraft[]) => void;
}

export function DragDropField({ chips, zones, errors, disabled, onChange }: Props) {
  return (
    <div className="space-y-4">
      <RepeatableField
        addLabel="Add chip"
        createItem={createDragChipDraft}
        disabled={disabled}
        items={chips}
        legend="Draggable chips"
        onChange={(nextChips) => onChange(nextChips, zones)}
        renderItem={(item, index, actions) => (
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-medium">
              ID
              <input
                className={lessonInputClass}
                disabled={disabled}
                onChange={(event) =>
                  actions.replace(item.clientKey, (current) => ({
                    ...current,
                    id: event.target.value,
                  }))
                }
                value={item.id}
              />
            </label>
            <label className="block text-xs font-medium">
              Text
              <input
                className={lessonInputClass}
                disabled={disabled}
                onChange={(event) =>
                  actions.replace(item.clientKey, (current) => ({
                    ...current,
                    text: event.target.value,
                  }))
                }
                value={item.text}
              />
            </label>
            <FieldError
              message={
                fieldError(errors, `chips.${index}.id`) || fieldError(errors, `chips.${index}.text`)
              }
            />
          </div>
        )}
      />
      <RepeatableField
        addLabel="Add drop zone"
        createItem={createDropZoneDraft}
        disabled={disabled}
        items={zones}
        legend="Drop zones"
        onChange={(nextZones) => onChange(chips, nextZones)}
        renderItem={(item, index, actions) => (
          <div className="space-y-2">
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
              Correct chip
              <select
                className={lessonInputClass}
                disabled={disabled}
                onChange={(event) =>
                  actions.replace(item.clientKey, (current) => ({
                    ...current,
                    correctChipId: event.target.value,
                  }))
                }
                value={item.correctChipId}
              >
                <option value="">Select a chip</option>
                {chips.map((chip) => (
                  <option key={chip.id} value={chip.id}>
                    {chip.text || chip.id}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                aria-label="Horizontal position"
                className={lessonInputClass}
                disabled={disabled}
                onChange={(event) =>
                  actions.replace(item.clientKey, (current) => ({
                    ...current,
                    xPositionPct: event.target.value,
                  }))
                }
                type="number"
                value={item.xPositionPct}
              />
              <input
                aria-label="Vertical position"
                className={lessonInputClass}
                disabled={disabled}
                onChange={(event) =>
                  actions.replace(item.clientKey, (current) => ({
                    ...current,
                    yPositionPct: event.target.value,
                  }))
                }
                type="number"
                value={item.yPositionPct}
              />
            </div>
            <FieldError
              message={
                fieldError(errors, `dropZones.${index}.label`) ||
                fieldError(errors, `dropZones.${index}.xPositionPct`) ||
                fieldError(errors, `dropZones.${index}.yPositionPct`)
              }
            />
          </div>
        )}
      />
    </div>
  );
}
