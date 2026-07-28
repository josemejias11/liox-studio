import { createCourseStudioKey } from '@/lib/contracts/course-studio';
import type { HotspotDraft } from '@/lib/contracts/lesson-studio';
import { FieldError, fieldError, lessonInputClass, lessonTextareaClass } from './FieldError';
import { RepeatableField } from './RepeatableField';

interface Props { legend?: string; items: HotspotDraft[]; errors: Record<string, string>; disabled: boolean; onChange: (items: HotspotDraft[]) => void }

function move<T>(items: T[], index: number, direction: -1 | 1) { const target = index + direction; if (target < 0 || target >= items.length) return items; const next = [...items]; [next[index], next[target]] = [next[target], next[index]]; return next; }

export function HotspotsField({ legend = 'Hotspots / inspection targets', items, errors, disabled, onChange }: Props) {
  return <RepeatableField legend={legend} addLabel="Add target" disabled={disabled} items={items} onAdd={() => onChange([...items, { clientKey: createCourseStudioKey('hotspot'), persistedKey: createCourseStudioKey('hotspot-persisted'), label: '', topic: '', body: { text: '', touched: true }, x: '50', y: '50', required: false, photos: [], videoAspectRatio: '' }])} onMove={(index, direction) => onChange(move(items, index, direction))} onRemove={(index) => onChange(items.filter((_, itemIndex) => itemIndex !== index))} renderItem={(item, index) => {
    const update = (patch: Partial<HotspotDraft>) => onChange(items.map((hotspot, itemIndex) => itemIndex === index ? { ...hotspot, ...patch } : hotspot));
    return <div className="space-y-3">
      <label className="block text-xs font-medium">Label<input className={lessonInputClass} disabled={disabled} onChange={(event) => update({ label: event.target.value })} value={item.label} /></label>
      <FieldError message={fieldError(errors, `hotspots.${index}.label`)} />
      <label className="block text-xs font-medium">Topic<input className={lessonInputClass} disabled={disabled} onChange={(event) => update({ topic: event.target.value })} value={item.topic} /></label>
      <label className="block text-xs font-medium">Learning content<textarea className={lessonTextareaClass} disabled={disabled} onChange={(event) => update({ body: { ...item.body, text: event.target.value, touched: true } })} value={item.body.text} /></label>
      <div className="grid grid-cols-2 gap-2"><label className="block text-xs font-medium">X position (%)<input className={lessonInputClass} disabled={disabled} inputMode="decimal" onChange={(event) => update({ x: event.target.value })} type="number" value={item.x} /></label><label className="block text-xs font-medium">Y position (%)<input className={lessonInputClass} disabled={disabled} inputMode="decimal" onChange={(event) => update({ y: event.target.value })} type="number" value={item.y} /></label></div>
      <FieldError message={fieldError(errors, `hotspots.${index}.x`) || fieldError(errors, `hotspots.${index}.y`)} />
      <label className="flex items-center gap-2 text-xs font-medium"><input checked={item.required} disabled={disabled} onChange={(event) => update({ required: event.target.checked })} type="checkbox" /> Required to complete</label>
    </div>;
  }} />;
}
