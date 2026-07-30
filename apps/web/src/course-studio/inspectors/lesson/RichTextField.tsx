'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toPlainText } from '@/lib/contracts/player-course';
import type { TextDraft } from '@/lib/contracts/lesson-studio';

interface RichTextFieldProps {
  label: string;
  value: TextDraft;
  cueTargets: string[];
  disabled: boolean;
  onChange: (value: TextDraft) => void;
}

type Mark = 'strong' | 'em' | 'sup' | string;
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]!));
const key = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

function toEditorHtml(value: unknown) {
  if (!Array.isArray(value)) return `<p>${escapeHtml(toPlainText(value))}</p>`;
  return value.map((raw) => {
    const block = raw as { children?: Array<{ text?: unknown; marks?: unknown }>; markDefs?: Array<{ _key?: unknown; _type?: unknown; linkedLayer?: unknown }>; listItem?: unknown };
    const markDefs = new Map((block.markDefs ?? []).flatMap((definition) => typeof definition._key === 'string' && definition._type === 'layerLink' && typeof definition.linkedLayer === 'string' ? [[definition._key, definition.linkedLayer] as const] : []));
    const children = (block.children ?? []).map((child) => {
      let html = escapeHtml(typeof child.text === 'string' ? child.text : '');
      for (const mark of Array.isArray(child.marks) ? child.marks : []) {
        if (mark === 'strong') html = `<strong>${html}</strong>`;
        else if (mark === 'em') html = `<em>${html}</em>`;
        else if (mark === 'sup') html = `<sup>${html}</sup>`;
        else if (typeof mark === 'string' && markDefs.has(mark)) html = `<a data-layer-link="${escapeHtml(markDefs.get(mark) ?? '')}" href="#cue">${html}</a>`;
      }
      return html;
    }).join('') || '<br>';
    return block.listItem === 'bullet' ? `<ul><li>${children}</li></ul>` : `<p>${children}</p>`;
  }).join('');
}

function serializeEditor(root: HTMLElement): unknown[] {
  const blocks: unknown[] = [];
  for (const element of Array.from(root.children)) {
    const lines = element.tagName === 'UL' || element.tagName === 'OL' ? Array.from(element.children) : [element];
    for (const line of lines) {
      const markDefs: Array<{ _key: string; _type: 'layerLink'; linkedLayer: string }> = [];
      const markKeys = new Map<string, string>();
      const children: Array<{ _type: 'span'; _key: string; text: string; marks: Mark[] }> = [];
      const visit = (node: Node, active: Mark[]) => {
        if (node.nodeType === Node.TEXT_NODE) {
          if (node.textContent) children.push({ _type: 'span', _key: key('span'), text: node.textContent, marks: active });
          return;
        }
        if (!(node instanceof HTMLElement)) return;
        const tag = node.tagName.toLowerCase();
        let marks = active;
        if (tag === 'strong' || tag === 'b') marks = [...marks, 'strong'];
        if (tag === 'em' || tag === 'i') marks = [...marks, 'em'];
        if (tag === 'sup') marks = [...marks, 'sup'];
        if (tag === 'a' && node.dataset.layerLink) {
          const target = node.dataset.layerLink;
          let markKey = markKeys.get(target);
          if (!markKey) { markKey = key('cue'); markKeys.set(target, markKey); markDefs.push({ _key: markKey, _type: 'layerLink', linkedLayer: target }); }
          marks = [...marks, markKey];
        }
        node.childNodes.forEach((child) => visit(child, marks));
      };
      line.childNodes.forEach((child) => visit(child, []));
      blocks.push({ _type: 'block', _key: key('block'), style: 'normal', ...(element.tagName === 'UL' || element.tagName === 'OL' ? { listItem: 'bullet', level: 1 } : {}), children: children.length ? children : [{ _type: 'span', _key: key('span'), text: '', marks: [] }], ...(markDefs.length ? { markDefs } : {}) });
    }
  }
  return blocks;
}

/** Deliberately small Portable Text editor: emphasis, bullets, superscript, and lesson-local learning cues. */
export function RichTextField({ label, value, cueTargets, disabled, onChange }: RichTextFieldProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const initialized = useRef(false);
  const [cueTarget, setCueTarget] = useState('');
  const options = useMemo(() => [...new Set(cueTargets.filter(Boolean))].sort((a, b) => a.localeCompare(b)), [cueTargets]);

  useEffect(() => {
    if (!editorRef.current || initialized.current) return;
    editorRef.current.innerHTML = toEditorHtml(value.touched ? value.serialized : value.original);
    initialized.current = true;
  }, [value.original, value.serialized, value.touched]);

  function sync() {
    const serialized = editorRef.current ? serializeEditor(editorRef.current) : [];
    onChange({ ...value, text: toPlainText(serialized), serialized, touched: true });
  }
  function command(name: string) {
    editorRef.current?.focus();
    document.execCommand(name);
    sync();
  }
  function addCue() {
    if (!cueTarget) return;
    editorRef.current?.focus();
    document.execCommand('createLink', false, '#cue');
    const selection = window.getSelection();
    const anchor = selection?.anchorNode?.parentElement?.closest('a');
    if (anchor) { anchor.dataset.layerLink = cueTarget; anchor.setAttribute('href', '#cue'); }
    sync();
  }
  return <label className="block text-xs font-medium">{label}
    <span className="studio-glass-control mt-1 block rounded-lg border border-border p-2">
      <span className="flex flex-wrap gap-1" role="toolbar" aria-label={`${label} formatting`}>
        <button className="min-h-11 rounded px-2 text-xs hover:bg-muted" disabled={disabled} onClick={() => command('bold')} type="button">Bold</button><button className="min-h-11 rounded px-2 text-xs hover:bg-muted" disabled={disabled} onClick={() => command('italic')} type="button">Italic</button><button className="min-h-11 rounded px-2 text-xs hover:bg-muted" disabled={disabled} onClick={() => command('superscript')} type="button">Superscript</button><button className="min-h-11 rounded px-2 text-xs hover:bg-muted" disabled={disabled} onClick={() => command('insertUnorderedList')} type="button">Bullets</button>
        <select aria-label="Learning cue target" className="min-h-11 rounded border border-input bg-background px-2 text-xs" disabled={disabled || options.length === 0} onChange={(event) => setCueTarget(event.target.value)} value={cueTarget}><option value="">Learning cue…</option>{options.map((target) => <option key={target} value={target}>{target}</option>)}</select><button className="min-h-11 rounded px-2 text-xs hover:bg-muted" disabled={disabled || !cueTarget} onClick={addCue} type="button">Add cue</button>
      </span>
      <span aria-disabled={disabled} aria-label={label} className="mt-2 block min-h-28 rounded border border-input bg-background p-2 text-sm leading-relaxed focus-within:ring-2 focus-within:ring-ring" contentEditable={!disabled} onInput={sync} ref={editorRef} role="textbox" suppressContentEditableWarning />
      <span className="mt-2 block text-[11px] font-normal text-muted-foreground">Learning cues can reference only targets defined on this lesson.</span>
    </span>
  </label>;
}
