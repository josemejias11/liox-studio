'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { toPlainText } from '@/shared/contracts/player-course';
import { isJsonObject } from '@/shared/contracts/course-studio';
import type { TextDraft } from '@/authoring/inspectors/lesson/lesson-draft';

interface RichTextFieldProps { label: string; value: TextDraft; cueTargets: string[]; disabled: boolean; error?: string; onChange: (value: TextDraft) => void }
type Mark = 'strong' | 'em' | 'sup' | string;
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]!));
const key = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const object = (value: unknown) => isJsonObject(value) ? value : {};
const marks = (value: unknown) => Array.isArray(value) ? value.filter((mark): mark is string => typeof mark === 'string') : [];

function toEditorHtml(value: unknown) {
  if (!Array.isArray(value)) return `<p>${escapeHtml(toPlainText(value))}</p>`;
  return value.map((raw, index) => {
    const block = object(raw) as { children?: Array<{ text?: unknown; marks?: unknown }>; markDefs?: Array<{ _key?: unknown; _type?: unknown; linkedLayer?: unknown }>; listItem?: unknown };
    const linkedMarks = new Map((block.markDefs ?? []).flatMap((definition) => typeof definition._key === 'string' && definition._type === 'layerLink' && typeof definition.linkedLayer === 'string' ? [[definition._key, definition.linkedLayer] as const] : []));
    const children = (block.children ?? []).map((child, childIndex) => {
      let html = escapeHtml(typeof child.text === 'string' ? child.text : '');
      for (const mark of marks(child.marks)) {
        if (mark === 'strong') html = `<strong>${html}</strong>`;
        else if (mark === 'em') html = `<em>${html}</em>`;
        else if (mark === 'sup') html = `<sup>${html}</sup>`;
        else if (linkedMarks.has(mark)) html = `<a data-layer-link="${escapeHtml(linkedMarks.get(mark) ?? '')}" data-studio-mark-key="${escapeHtml(mark)}" href="#cue">${html}</a>`;
      }
      return `<span data-studio-child-index="${childIndex}" data-studio-marks="${escapeHtml(JSON.stringify(marks(child.marks)))}">${html}</span>`;
    }).join('') || '<br>';
    const attributes = ` data-studio-block-index="${index}"`;
    if (block.listItem === 'bullet') return `<ul><li${attributes}>${children}</li></ul>`;
    if (block.listItem === 'number') return `<ol><li${attributes}>${children}</li></ol>`;
    return `<p${attributes}>${children}</p>`;
  }).join('');
}

function serializeEditor(root: HTMLElement, original: unknown, originalMarkup: Map<number, string>, originalChildMarkup: Map<string, string>): unknown[] {
  const originalBlocks = Array.isArray(original) ? original : [];
  const blocks: unknown[] = [];
  for (const element of Array.from(root.children)) {
    const lines = element.tagName === 'UL' || element.tagName === 'OL' ? Array.from(element.children) : [element];
    for (const line of lines) {
      const originalIndex = Number(line.getAttribute('data-studio-block-index'));
      const originalBlock = Number.isInteger(originalIndex) ? originalBlocks[originalIndex] : undefined;
      if (originalBlock !== undefined && originalMarkup.get(originalIndex) === line.innerHTML) { blocks.push(originalBlock); continue; }
      const existing = object(originalBlock);
      const allOriginalMarkDefs = Array.isArray(existing.markDefs) ? existing.markDefs.map(object) : [];
      const markDefs = allOriginalMarkDefs.filter((definition) => definition._type !== 'layerLink');
      const markKeys = new Map(allOriginalMarkDefs.flatMap((definition) => definition._type === 'layerLink' && typeof definition._key === 'string' && typeof definition.linkedLayer === 'string' ? [[definition.linkedLayer, definition._key] as const] : []));
      const originalChildren = Array.isArray(existing.children) ? existing.children.map(object) : [];
      const children: Array<Record<string, unknown>> = [];
      const visit = (node: Node, active: Mark[]) => {
        if (node.nodeType === Node.TEXT_NODE) { if (node.textContent) children.push({ _type: 'span', _key: key('span'), text: node.textContent, marks: [...new Set(active)] }); return; }
        if (!(node instanceof HTMLElement)) return;
        const originalChildIndex = Number(node.dataset.studioChildIndex);
        const originalChild = Number.isInteger(originalChildIndex) ? originalChildren[originalChildIndex] : undefined;
        const childMarkupKey = `${originalIndex}:${originalChildIndex}`;
        if (originalChild !== undefined && originalChildMarkup.get(childMarkupKey) === node.innerHTML) {
          for (const mark of marks(originalChild.marks)) {
            const definition = allOriginalMarkDefs.find((item) => item._type === 'layerLink' && item._key === mark);
            if (definition && !markDefs.some((item) => item._key === definition._key)) markDefs.push(definition);
          }
          children.push(originalChild);
          return;
        }
        const tag = node.tagName.toLowerCase();
        let activeMarks = tag === 'span' && node.dataset.studioMarks ? [...active, ...marks(JSON.parse(node.dataset.studioMarks))] : active;
        if (tag === 'strong' || tag === 'b') activeMarks = [...activeMarks, 'strong'];
        if (tag === 'em' || tag === 'i') activeMarks = [...activeMarks, 'em'];
        if (tag === 'sup') activeMarks = [...activeMarks, 'sup'];
        if (tag === 'a' && node.dataset.layerLink) {
          const target = node.dataset.layerLink;
          const markKey = node.dataset.studioMarkKey || markKeys.get(target) || key('cue');
          markKeys.set(target, markKey);
          if (!markDefs.some((definition) => definition._key === markKey)) markDefs.push({ _key: markKey, _type: 'layerLink', linkedLayer: target });
          activeMarks = [...activeMarks, markKey];
        }
        if (originalChild !== undefined) {
          const segments: Array<{ text: string; marks: string[] }> = [];
          const collect = (current: Node, inherited: Mark[]) => {
            if (current.nodeType === Node.TEXT_NODE) {
              if (current.textContent) segments.push({ text: current.textContent, marks: [...new Set(inherited)] });
              return;
            }
            if (!(current instanceof HTMLElement)) return;
            let next = inherited;
            const currentTag = current.tagName.toLowerCase();
            if (currentTag === 'strong' || currentTag === 'b') next = [...next, 'strong'];
            if (currentTag === 'em' || currentTag === 'i') next = [...next, 'em'];
            if (currentTag === 'sup') next = [...next, 'sup'];
            if (currentTag === 'a' && current.dataset.layerLink) {
              const target = current.dataset.layerLink;
              const markKey = current.dataset.studioMarkKey || markKeys.get(target) || key('cue');
              markKeys.set(target, markKey);
              if (!markDefs.some((definition) => definition._key === markKey)) markDefs.push({ _key: markKey, _type: 'layerLink', linkedLayer: target });
              next = [...next, markKey];
            }
            current.childNodes.forEach((child) => collect(child, next));
          };
          collect(node, activeMarks);
          const rebuilt = segments.length ? segments : [{ text: '', marks: [] }];
          rebuilt.forEach((segment, index) => children.push(index === 0
            ? { ...originalChild, _type: originalChild._type ?? 'span', _key: originalChild._key ?? key('span'), text: segment.text, marks: segment.marks }
            : { _type: 'span', _key: key('span'), text: segment.text, marks: segment.marks }));
          return;
        }
        node.childNodes.forEach((child) => visit(child, activeMarks));
      };
      line.childNodes.forEach((child) => visit(child, []));
      blocks.push({ ...existing, _type: existing._type ?? 'block', _key: existing._key ?? key('block'), children: children.length ? children : [{ _type: 'span', _key: key('span'), text: '', marks: [] }], ...(markDefs.length ? { markDefs } : { markDefs: undefined }), ...(element.tagName === 'UL' ? { listItem: 'bullet' } : element.tagName === 'OL' ? { listItem: 'number' } : { listItem: undefined }) });
    }
  }
  return blocks;
}

/** Small Portable Text editor that preserves untouched blocks verbatim and only serializes changed blocks. */
export function RichTextField({ label, value, cueTargets, disabled, error, onChange }: RichTextFieldProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const initialized = useRef(false);
  const originalMarkup = useRef(new Map<number, string>());
  const originalChildMarkup = useRef(new Map<string, string>());
  const errorId = useId();
  const [cueTarget, setCueTarget] = useState('');
  const options = useMemo(() => [...new Set(cueTargets.filter(Boolean))].sort((a, b) => a.localeCompare(b)), [cueTargets]);
  useEffect(() => {
    if (!editorRef.current || initialized.current) return;
    editorRef.current.innerHTML = toEditorHtml(value.touched ? value.serialized : value.original);
    editorRef.current.querySelectorAll<HTMLElement>('[data-studio-block-index]').forEach((block) => {
      const blockIndex = Number(block.dataset.studioBlockIndex);
      originalMarkup.current.set(blockIndex, block.innerHTML);
      block.querySelectorAll<HTMLElement>('[data-studio-child-index]').forEach((child) => originalChildMarkup.current.set(`${blockIndex}:${child.dataset.studioChildIndex}`, child.innerHTML));
    });
    initialized.current = true;
  }, [value.original, value.serialized, value.touched]);
  function sync() { const serialized = editorRef.current ? serializeEditor(editorRef.current, value.original, originalMarkup.current, originalChildMarkup.current) : []; onChange({ ...value, text: toPlainText(serialized), serialized, touched: true }); }
  function command(name: string) { editorRef.current?.focus(); document.execCommand(name); sync(); }
  function addCue() { if (!cueTarget) return; editorRef.current?.focus(); document.execCommand('createLink', false, '#cue'); const anchor = window.getSelection()?.anchorNode?.parentElement?.closest('a'); if (anchor) { anchor.dataset.layerLink = cueTarget; anchor.setAttribute('href', '#cue'); } sync(); }
  return <label className="block text-xs font-medium">{label}<span className="studio-glass-control mt-1 block rounded-lg border border-border p-2"><span className="flex flex-wrap gap-1" role="toolbar" aria-label={`${label} formatting`}><button className="min-h-11 rounded px-2 text-xs hover:bg-muted" disabled={disabled} onClick={() => command('bold')} type="button">Bold</button><button className="min-h-11 rounded px-2 text-xs hover:bg-muted" disabled={disabled} onClick={() => command('italic')} type="button">Italic</button><button className="min-h-11 rounded px-2 text-xs hover:bg-muted" disabled={disabled} onClick={() => command('superscript')} type="button">Superscript</button><button className="min-h-11 rounded px-2 text-xs hover:bg-muted" disabled={disabled} onClick={() => command('insertUnorderedList')} type="button">Bullets</button><select aria-label="Learning cue target" className="min-h-11 rounded border border-input bg-background px-2 text-xs" disabled={disabled || options.length === 0} onChange={(event) => setCueTarget(event.target.value)} value={cueTarget}><option value="">Learning cue…</option>{options.map((target) => <option key={target} value={target}>{target}</option>)}</select><button className="min-h-11 rounded px-2 text-xs hover:bg-muted" disabled={disabled || !cueTarget} onClick={addCue} type="button">Add cue</button></span><span aria-disabled={disabled} aria-describedby={error ? errorId : undefined} aria-invalid={Boolean(error)} aria-label={label} className="mt-2 block min-h-28 rounded border border-input bg-background p-2 text-sm leading-relaxed focus-within:ring-2 focus-within:ring-ring" contentEditable={!disabled} onInput={sync} ref={editorRef} role="textbox" suppressContentEditableWarning /><span className="mt-2 block text-[11px] font-normal text-muted-foreground">Learning cues can reference only targets this lesson can activate.</span>{error && <span className="mt-2 block text-xs font-normal text-destructive" id={errorId} role="alert">{error}</span>}</span></label>;
}
