import { createCourseStudioKey } from '@/lib/contracts/course-studio';
import type { HotspotDraft } from '@/lib/contracts/lesson-studio';
import { FieldError, fieldError, lessonInputClass } from './FieldError';
import { RepeatableField } from './RepeatableField';
import { AssetCollectionField } from './AssetCollectionField';
import { HotspotCanvas } from './HotspotCanvas';
import { RichTextField } from './RichTextField';

interface Props { legend?: string; courseId: string; image?: import('@/lib/contracts/lesson-studio').LessonImageDraft; cueTargets: string[]; items: HotspotDraft[]; errors: Record<string, string>; disabled: boolean; onChange: (items: HotspotDraft[]) => void }

function move<T>(items: T[], index: number, direction: -1 | 1) { const target = index + direction; if (target < 0 || target >= items.length) return items; const next = [...items]; [next[index], next[target]] = [next[target], next[index]]; return next; }

export function HotspotsField({ legend = 'Hotspots / inspection targets', courseId, image, cueTargets, items, errors, disabled, onChange }: Props) {
  const add = (x = '50', y = '50') => onChange([...items, { clientKey: createCourseStudioKey('hotspot'), persistedKey: createCourseStudioKey('hotspot-persisted'), label: '', topic: '', body: { text: '', touched: true, serialized: [] }, x, y, required: false, photos: [], videoAspectRatio: '' }]);
  return <fieldset className="space-y-3"><HotspotCanvas disabled={disabled} hotspots={items} image={image} onAdd={add} onChange={onChange} onRemove={(index) => onChange(items.filter((_, itemIndex) => itemIndex !== index))} /><RepeatableField legend={legend} addLabel="Add target" disabled={disabled} items={items} onAdd={() => add()} onMove={(index, direction) => onChange(move(items, index, direction))} onRemove={(index) => onChange(items.filter((_, itemIndex) => itemIndex !== index))} renderItem={(item, index) => {
    const update = (patch: Partial<HotspotDraft>) => onChange(items.map((hotspot, itemIndex) => itemIndex === index ? { ...hotspot, ...patch } : hotspot));
    return <div className="space-y-3">
      <label className="block text-xs font-medium">Label<input className={lessonInputClass} disabled={disabled} onChange={(event) => update({ label: event.target.value })} value={item.label} /></label>
      <FieldError message={fieldError(errors, `hotspots.${index}.label`)} />
      <label className="block text-xs font-medium">Topic<input className={lessonInputClass} disabled={disabled} onChange={(event) => update({ topic: event.target.value })} value={item.topic} /></label>
      <RichTextField cueTargets={cueTargets} disabled={disabled} error={fieldError(errors, `hotspots.${index}.body.layerLink`)} label="Learning content" onChange={(body) => update({ body })} value={item.body} />
      <div className="grid grid-cols-2 gap-2"><label className="block text-xs font-medium">X position (%)<input className={lessonInputClass} disabled={disabled} inputMode="decimal" onChange={(event) => update({ x: event.target.value })} type="number" value={item.x} /></label><label className="block text-xs font-medium">Y position (%)<input className={lessonInputClass} disabled={disabled} inputMode="decimal" onChange={(event) => update({ y: event.target.value })} type="number" value={item.y} /></label></div>
      <FieldError message={fieldError(errors, `hotspots.${index}.x`) || fieldError(errors, `hotspots.${index}.y`)} />
      <label className="flex items-center gap-2 text-xs font-medium"><input checked={item.required} disabled={disabled} onChange={(event) => update({ required: event.target.checked })} type="checkbox" /> Required to complete</label>
      <AssetCollectionField accept="image/*" courseId={courseId} disabled={disabled} label="Photo gallery" onChange={(photos) => update({ photos })} value={item.photos} />
      <AssetCollectionField accept="video/*" courseId={courseId} disabled={disabled} label="Supporting video" maxItems={1} onChange={(videos) => update({ videoFile: videos[0] })} value={item.videoFile ? [item.videoFile] : []} />
      <label className="block text-xs font-medium">Video aspect ratio<input className={lessonInputClass} disabled={disabled} onChange={(event) => update({ videoAspectRatio: event.target.value })} placeholder="16:9" value={item.videoAspectRatio} /></label>
    </div>;
  }} /></fieldset>;
}
