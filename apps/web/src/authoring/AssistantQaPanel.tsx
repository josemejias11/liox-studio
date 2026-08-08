'use client';

import type { AssistantQaItem } from '@moto-ai/contracts';
import type { CourseSourceFile } from '@moto-ai/contracts/course-studio';
import { useCallback, useEffect, useState } from 'react';

export function AssistantQaPanel({ courseId, sources }: { courseId: string; sources: CourseSourceFile[] }) {
  const [items, setItems] = useState<AssistantQaItem[]>([]);
  const [selected, setSelected] = useState(() => sources.filter((source) => source.ownership === 'owned' && source.indexStatus === 'indexed').map((source) => source.id));
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const url = `/api/course-studio/courses/${encodeURIComponent(courseId)}/assistant-qa`;
  const load = useCallback(async () => {
    const response = await fetch(url, { cache: 'no-store' }); const result = await response.json() as { items?: AssistantQaItem[]; error?: string };
    if (!response.ok) throw new Error(result.error || 'Assistant Q&A could not be loaded.'); setItems(result.items ?? []);
  }, [url]);
  useEffect(() => { const timer = window.setTimeout(() => { void load().catch((error) => setMessage(error instanceof Error ? error.message : 'Assistant Q&A could not be loaded.')); }, 0); return () => window.clearTimeout(timer); }, [load]);
  async function generate() {
    setBusy(true); setMessage(null);
    try { const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sourceIds: selected }) }); const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error || 'Draft generation could not start.'); setMessage('Draft generation is queued. Refresh this panel after processing completes.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Draft generation could not start.'); } finally { setBusy(false); }
  }
  async function save(item: AssistantQaItem, status = item.status) {
    setBusy(true); setMessage(null);
    try { const response = await fetch(url, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...item, status }) }); const result = await response.json() as { item?: AssistantQaItem; error?: string }; if (!response.ok || !result.item) throw new Error(result.error || 'Assistant Q&A could not be saved.'); setItems((current) => current.map((entry) => entry.id === item.id ? result.item! : entry)); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Assistant Q&A could not be saved.'); } finally { setBusy(false); }
  }
  async function remove(id: string) { setBusy(true); try { const response = await fetch(`${url}?id=${encodeURIComponent(id)}`, { method: 'DELETE' }); if (!response.ok) throw new Error('Assistant Q&A could not be discarded.'); setItems((current) => current.filter((item) => item.id !== id)); } catch (error) { setMessage(error instanceof Error ? error.message : 'Assistant Q&A could not be discarded.'); } finally { setBusy(false); } }
  return <section aria-labelledby="assistant-qa-heading" className="mt-6 space-y-3 border-t border-border pt-5">
    <div><p className="text-primary text-[11px] font-semibold tracking-[0.16em] uppercase">Course Assistant</p><h2 id="assistant-qa-heading" className="mt-1 text-base font-semibold">Approved offline answers</h2><p className="text-muted-foreground mt-1 text-xs">AI can draft from selected indexed sources. Edit and approve each answer before it can enter a frozen revision.</p></div>
    <div className="studio-glass-control border-border rounded-xl border p-3 text-xs"><p className="font-medium">Sources for a new draft set</p>{sources.filter((source) => source.ownership === 'owned' && source.indexStatus === 'indexed').map((source) => <label key={source.id} className="mt-2 flex gap-2"><input checked={selected.includes(source.id)} onChange={() => setSelected((current) => current.includes(source.id) ? current.filter((id) => id !== source.id) : [...current, source.id])} type="checkbox" />{source.filename}</label>)}<div className="mt-3 flex gap-2"><button className="rounded-md bg-primary px-3 py-2 font-semibold text-primary-foreground disabled:opacity-50" disabled={busy || !selected.length} onClick={() => void generate()} type="button">Generate assistant Q&A</button><button className="rounded-md border px-3 py-2 font-semibold disabled:opacity-50" disabled={busy} onClick={() => void load()} type="button">Refresh</button></div></div>
    {message && <p className="rounded-lg bg-muted px-3 py-2 text-xs" role="status">{message}</p>}
    {items.map((item) => <AssistantQaEditor key={item.id} item={item} busy={busy} onDelete={remove} onSave={save} />)}
    {!items.length && <p className="text-muted-foreground text-xs">No assistant Q&A drafts yet.</p>}
  </section>;
}

function AssistantQaEditor({ item, busy, onSave, onDelete }: { item: AssistantQaItem; busy: boolean; onSave: (item: AssistantQaItem, status?: AssistantQaItem['status']) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const [draft, setDraft] = useState(item);
  return <article className="studio-glass-control border-border rounded-xl border p-3 text-xs"><p className="font-semibold">{draft.status === 'approved' ? 'Approved answer' : 'Draft answer'}</p><label className="mt-2 block">Question variants<textarea className="mt-1 w-full rounded border bg-background p-2" value={draft.questionVariants.join('\n')} onChange={(event) => setDraft({ ...draft, questionVariants: event.target.value.split('\n').map((value) => value.trim()).filter(Boolean) })} /></label><label className="mt-2 block">Keywords<input className="mt-1 w-full rounded border bg-background p-2" value={draft.matchingKeywords.join(', ')} onChange={(event) => setDraft({ ...draft, matchingKeywords: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} /></label><label className="mt-2 block">Approved answer<textarea className="mt-1 min-h-24 w-full rounded border bg-background p-2" value={draft.approvedAnswer} onChange={(event) => setDraft({ ...draft, approvedAnswer: event.target.value })} /></label><p className="text-muted-foreground mt-2">Author citations: {draft.citations.map((citation) => citation.label).join(', ')}</p><div className="mt-3 flex gap-2"><button className="rounded border px-2 py-1 font-semibold disabled:opacity-50" disabled={busy} onClick={() => void onSave(draft)} type="button">Save draft</button><button className="rounded bg-primary px-2 py-1 font-semibold text-primary-foreground disabled:opacity-50" disabled={busy} onClick={() => void onSave(draft, 'approved')} type="button">Approve</button><button className="text-destructive rounded px-2 py-1 font-semibold disabled:opacity-50" disabled={busy} onClick={() => void onDelete(item.id)} type="button">Discard</button></div></article>;
}
