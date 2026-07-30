'use client';

import type { CourseGraph, LessonInput } from '@moto-ai/contracts/course-studio';
import { useEffect, useMemo, useState } from 'react';
import { createLessonDraft, validateLessonDraft, type LessonDraft } from '@/lib/contracts/lesson-studio';
import { serializeLessonDraft } from './lesson/lesson-serializer';
import { AssetField } from './lesson/AssetField';
import { CoveredFeaturesField } from './lesson/CoveredFeaturesField';
import { DragDropField } from './lesson/DragDropField';
import { FieldError, lessonInputClass, lessonTextareaClass } from './lesson/FieldError';
import { HotspotsField } from './lesson/HotspotsField';
import { QuizQuestionsField } from './lesson/QuizQuestionsField';
import { ScrollChaptersField } from './lesson/ScrollChaptersField';
import { VariantsField } from './lesson/VariantsField';

type StudioLesson = CourseGraph['chapters'][number]['lessons'][number];

interface LessonInspectorProps {
  course: CourseGraph;
  lesson: StudioLesson;
  disabled?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onSaveLesson: (lessonId: string, input: LessonInput) => Promise<void>;
}

const inputClass = lessonInputClass;

function fingerprint(draft: LessonDraft) {
  return JSON.stringify(draft, (_key, value) => _key === 'clientKey' ? undefined : value);
}

export function LessonInspector({ course, lesson, disabled = false, onDirtyChange, onSaveLesson }: LessonInspectorProps) {
  const [draft, setDraft] = useState(() => createLessonDraft(lesson));
  const [baseline, setBaseline] = useState(() => fingerprint(createLessonDraft(lesson)));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = fingerprint(draft) !== baseline;
  const validation = useMemo(() => validateLessonDraft(draft), [draft]);
  const locked = disabled || saving || uploading;

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  function update(updateDraft: (current: LessonDraft) => LessonDraft) {
    setDraft(updateDraft);
    setSaved(false);
    setError(null);
  }

  async function uploadAsset(file: File, field: 'media' | 'stageBackground' | 'videoFile') {
    setUploading(true);
    setError(null);
    try {
      const data = new FormData();
      data.set('courseId', course.id);
      data.set('file', file);
      const response = await fetch('/api/course-studio/assets', { method: 'POST', body: data });
      const result = await response.json() as { asset?: { deliveryUrl?: string; filename?: string }; error?: string };
      if (!response.ok || !result.asset?.deliveryUrl) throw new Error(result.error || 'Asset upload failed.');
      update((current) => ({ ...current, [field]: { url: result.asset!.deliveryUrl!, originalFilename: result.asset!.filename } }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Asset upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setError(null);
    if (!validation.valid) {
      setError('Correct the highlighted fields before saving.');
      return;
    }
    setSaving(true);
    try {
      await onSaveLesson(lesson.id, serializeLessonDraft(draft));
      setBaseline(fingerprint(draft));
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The change could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  const type = lesson.lessonType;
  const isContentFamily = type === 'content' || type === 'interaction';

  return (
    <form className="studio-glass-panel flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain" noValidate onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <header className="studio-glass sticky top-0 z-10 border-x-0 border-t-0 border-b border-border px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{type} screen</p>
        <p className="mt-1 text-xs text-muted-foreground">Edit this screen with guided fields. The preview updates after Save.</p>
      </header>
      <div className="space-y-4 px-5 py-5">
        <fieldset className="studio-glass-control space-y-3 rounded-xl border border-border p-3">
          <legend className="px-1 text-sm font-semibold">Screen content</legend>
          <label className="block text-xs font-medium">Headline<input className={inputClass} disabled={locked} onChange={(event) => update((current) => ({ ...current, headline: event.target.value }))} value={draft.headline} /></label>
          <FieldError message={validation.errors.headline} />
          <label className="block text-xs font-medium">Body<textarea className={lessonTextareaClass} disabled={locked} onChange={(event) => update((current) => ({ ...current, body: { ...current.body, text: event.target.value, touched: true } }))} value={draft.body.text} /></label>
        </fieldset>

        {isContentFamily && <>
          <AssetField accept="image/*,video/*" disabled={locked} label="Primary media" onUpload={(file) => void uploadAsset(file, 'media')} value={draft.media} />
          <fieldset className="studio-glass-control space-y-3 rounded-xl border border-border p-3"><legend className="px-1 text-sm font-semibold">Text overlay</legend><div className="grid grid-cols-3 gap-2"><label className="block text-xs font-medium">X<input className={inputClass} disabled={locked} onChange={(event) => update((current) => ({ ...current, textOverlay: { ...current.textOverlay, x: event.target.value } }))} type="number" value={draft.textOverlay.x} /></label><label className="block text-xs font-medium">Y<input className={inputClass} disabled={locked} onChange={(event) => update((current) => ({ ...current, textOverlay: { ...current.textOverlay, y: event.target.value } }))} type="number" value={draft.textOverlay.y} /></label><label className="block text-xs font-medium">Width<input className={inputClass} disabled={locked} onChange={(event) => update((current) => ({ ...current, textOverlay: { ...current.textOverlay, width: event.target.value } }))} value={draft.textOverlay.width} /></label></div></fieldset>
          <CoveredFeaturesField disabled={locked} errors={validation.errors} items={draft.coveredFeatures} onChange={(coveredFeatures) => update((current) => ({ ...current, coveredFeatures }))} />
          <HotspotsField disabled={locked} errors={validation.errors} items={draft.hotspots} onChange={(hotspots) => update((current) => ({ ...current, hotspots }))} />
        </>}

        {type === 'stage' && <><AssetField accept="image/*" disabled={locked} label="Stage background" onUpload={(file) => void uploadAsset(file, 'stageBackground')} value={draft.stageBackground} /><fieldset className="studio-glass-control space-y-3 rounded-xl border border-border p-3"><legend className="px-1 text-sm font-semibold">Completion</legend><label className="flex items-center gap-2 text-xs font-medium"><input checked={draft.enableCompletionAnimation} disabled={locked} onChange={(event) => update((current) => ({ ...current, enableCompletionAnimation: event.target.checked }))} type="checkbox" /> Show completion animation</label><select className={inputClass} disabled={locked} onChange={(event) => update((current) => ({ ...current, completionTransition: event.target.value as LessonDraft['completionTransition'] }))} value={draft.completionTransition}><option value="spin">Spin</option><option value="rise">Rise</option><option value="fade">Fade</option></select></fieldset><HotspotsField disabled={locked} errors={validation.errors} items={draft.hotspots} legend="Stage hotspots" onChange={(hotspots) => update((current) => ({ ...current, hotspots }))} /></>}

        {type === 'canvas' && <><AssetField accept="image/*" disabled={locked} label="Inspection canvas image" onUpload={(file) => void uploadAsset(file, 'media')} value={draft.media} /><HotspotsField disabled={locked} errors={validation.errors} items={draft.hotspots} legend="Inspection targets" onChange={(hotspots) => update((current) => ({ ...current, hotspots }))} /></>}

        {type === 'video' && <><AssetField accept="video/*" disabled={locked} label="Video" onUpload={(file) => void uploadAsset(file, 'videoFile')} value={draft.videoFile} /><label className="block text-xs font-medium">Aspect ratio<input className={inputClass} disabled={locked} onChange={(event) => update((current) => ({ ...current, videoAspectRatio: event.target.value }))} placeholder="16:9" value={draft.videoAspectRatio} /></label></>}

        {type === 'quiz' && <><fieldset className="studio-glass-control space-y-3 rounded-xl border border-border p-3"><legend className="px-1 text-sm font-semibold">Quiz settings</legend><label className="block text-xs font-medium">Title<input className={inputClass} disabled={locked} onChange={(event) => update((current) => ({ ...current, quizTitle: event.target.value }))} value={draft.quizTitle} /></label><label className="block text-xs font-medium">Instructions<textarea className={lessonTextareaClass} disabled={locked} onChange={(event) => update((current) => ({ ...current, quizInstructions: event.target.value }))} value={draft.quizInstructions} /></label><label className="block text-xs font-medium">Passing score (%)<input className={inputClass} disabled={locked} max="100" min="0" onChange={(event) => update((current) => ({ ...current, passingScore: event.target.value }))} type="number" value={draft.passingScore} /></label><label className="flex items-center gap-2 text-xs font-medium"><input checked={draft.allowRetry} disabled={locked} onChange={(event) => update((current) => ({ ...current, allowRetry: event.target.checked }))} type="checkbox" /> Allow retry</label><label className="flex items-center gap-2 text-xs font-medium"><input checked={draft.showCorrectAnswers} disabled={locked} onChange={(event) => update((current) => ({ ...current, showCorrectAnswers: event.target.checked }))} type="checkbox" /> Show correct answers after grading</label></fieldset><QuizQuestionsField disabled={locked} errors={validation.errors} items={draft.quizQuestions} onChange={(quizQuestions) => update((current) => ({ ...current, quizQuestions }))} /></>}

        {type === 'colorSwitcher' && <VariantsField disabled={locked} items={draft.colorVariants} onChange={(colorVariants) => update((current) => ({ ...current, colorVariants }))} />}

        {type === 'splitScreen' && <><AssetField accept="image/*,video/*" disabled={locked} label="Split-screen media" onUpload={(file) => void uploadAsset(file, 'media')} value={draft.media} /><label className="flex items-center gap-2 text-xs font-medium"><input checked={draft.splitReverseLayout} disabled={locked} onChange={(event) => update((current) => ({ ...current, splitReverseLayout: event.target.checked }))} type="checkbox" /> Reverse media and text</label><CoveredFeaturesField disabled={locked} errors={validation.errors} items={draft.coveredFeatures} onChange={(coveredFeatures) => update((current) => ({ ...current, coveredFeatures }))} /></>}

        {type === 'dragDrop' && <><AssetField accept="image/*" disabled={locked} label="Drag-and-drop media" onUpload={(file) => void uploadAsset(file, 'media')} value={draft.media} /><DragDropField chips={draft.chips} disabled={locked} errors={validation.errors} onChange={(chips, dropZones) => update((current) => ({ ...current, chips, dropZones }))} zones={draft.dropZones} /></>}

        {type === 'scrollStory' && <><AssetField accept="image/*" disabled={locked} label="Story hero media" onUpload={(file) => void uploadAsset(file, 'media')} value={draft.media} /><ScrollChaptersField disabled={locked} errors={validation.errors} items={draft.scrollChapters} onChange={(scrollChapters) => update((current) => ({ ...current, scrollChapters }))} /></>}

        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
        {saved && <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700">Saved.</p>}
        <button className="min-h-11 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50" disabled={locked || !dirty || !validation.valid} type="submit">{saving ? 'Saving…' : 'Save changes'}</button>
      </div>
    </form>
  );
}
