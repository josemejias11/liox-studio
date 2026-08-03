import { createCourseStudioKey } from '@/shared/contracts/course-studio';
import type { ColorVariantDraft } from '@/authoring/inspectors/lesson/lesson-draft';
import { FieldError, lessonInputClass } from './FieldError';
import { RepeatableField } from './RepeatableField';
import { AssetCollectionField } from './AssetCollectionField';

interface Props { courseId: string; items: ColorVariantDraft[]; disabled: boolean; onChange: (items: ColorVariantDraft[]) => void }
function move<T>(items: T[], index: number, direction: -1 | 1) { const target = index + direction; if (target < 0 || target >= items.length) return items; const next = [...items]; [next[index], next[target]] = [next[target], next[index]]; return next; }

export function VariantsField({ courseId, items, disabled, onChange }: Props) {
  return <RepeatableField legend="Color variants" addLabel="Add variant" disabled={disabled} items={items} onAdd={() => onChange([...items, { clientKey: createCourseStudioKey('variant'), label: '', colorHex: '' }])} onMove={(index, direction) => onChange(move(items, index, direction))} onRemove={(index) => onChange(items.filter((_, itemIndex) => itemIndex !== index))} renderItem={(item, index) => <div className="space-y-3"><div className="grid grid-cols-[1fr_7rem] gap-2"><label className="block text-xs font-medium">Label<input className={lessonInputClass} disabled={disabled} onChange={(event) => onChange(items.map((variant, itemIndex) => itemIndex === index ? { ...variant, label: event.target.value } : variant))} value={item.label} /></label><label className="block text-xs font-medium">Color<input className={`${lessonInputClass} h-10 p-1`} disabled={disabled} onChange={(event) => onChange(items.map((variant, itemIndex) => itemIndex === index ? { ...variant, colorHex: event.target.value } : variant))} type="color" value={item.colorHex || '#685bc7'} /></label></div><FieldError message={!item.label.trim() ? 'Variant label is required.' : undefined} /><AssetCollectionField accept="image/*" courseId={courseId} disabled={disabled} label="Variant image" maxItems={1} onChange={(images) => onChange(items.map((variant, itemIndex) => itemIndex === index ? { ...variant, image: images[0] } : variant))} value={item.image ? [item.image] : []} /></div>} />;
}
