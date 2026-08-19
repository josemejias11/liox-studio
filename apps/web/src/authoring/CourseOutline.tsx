'use client';

import type { CourseGraph, CourseLessonType } from '@moto-ai/contracts/course-studio';
import { ChevronDown, ChevronUp, Copy, PanelTop, Plus, Trash2 } from 'lucide-react';
import type { CourseInspectorSaveState } from './inspectors/CourseInspector';
import { TrashPanel } from './TrashPanel';
import type { StudioSelection, StudioTrashItem } from './studio-types';

const BLOCKS: Array<{ type: CourseLessonType; label: string }> = [
  { type: 'content', label: 'Content' },
  { type: 'interaction', label: 'Hotspot' },
  { type: 'stage', label: 'Product stage' },
  { type: 'video', label: 'Video' },
  { type: 'quiz', label: 'Quiz' },
  { type: 'canvas', label: 'Canvas inspection' },
  { type: 'colorSwitcher', label: 'Colour switcher' },
  { type: 'splitScreen', label: 'Split screen' },
  { type: 'dragDrop', label: 'Drag and drop' },
  { type: 'scrollStory', label: 'Scroll story' },
];

interface Props {
  className?: string;
  course: CourseGraph;
  trash: StudioTrashItem[];
  selection: StudioSelection;
  disabled: boolean;
  courseSaveState?: CourseInspectorSaveState;
  courseSettingsFormId?: string;
  onSelect: (selection: StudioSelection) => void;
  onAddChapter: () => void;
  onAddLesson: (chapterId: string, type: CourseLessonType) => void;
  onRestoreTrash: (trashId: string) => Promise<void>;
  onPermanentDeleteTrash: (trashId: string) => Promise<void>;
  onEmptyTrash: () => Promise<void>;
  onAction: (
    action: 'up' | 'down' | 'duplicate' | 'delete',
    kind: 'chapter' | 'lesson',
    id: string,
  ) => void;
}

function selected(selection: StudioSelection, kind: StudioSelection['kind'], id: string) {
  return selection.kind === kind && selection.id === id;
}

export function CourseOutline({
  className,
  course,
  trash,
  selection,
  disabled,
  courseSaveState,
  courseSettingsFormId,
  onSelect,
  onAddChapter,
  onAddLesson,
  onRestoreTrash,
  onPermanentDeleteTrash,
  onEmptyTrash,
  onAction,
}: Props) {
  return (
    <aside className={`studio-glass-panel flex max-h-[32rem] min-h-0 flex-col border-b border-border xl:h-full xl:max-h-none xl:border-r xl:border-b-0 xl:overflow-hidden ${className ?? ''}`}>
      <div className="border-b border-border p-4">
        <button
          className={`w-full rounded-lg px-3 py-2 text-left text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${selected(selection, 'course', course.id) ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          disabled={disabled}
          onClick={() => onSelect({ kind: 'course', id: course.id })}
          type="button"
        >
          Course settings
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <button
          className={`studio-glass-control mb-3 flex w-full items-center gap-3 rounded-xl border border-border px-3 py-3 text-left text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${selected(selection, 'cover', course.id) ? 'bg-primary text-primary-foreground' : 'hover:border-primary/50 hover:bg-muted'}`}
          disabled={disabled}
          onClick={() => onSelect({ kind: 'cover', id: course.id })}
          type="button"
        >
          <PanelTop className="h-4 w-4" />
          <span>Course cover</span>
        </button>
        {course.chapters.map((chapter) => (
          <section className="studio-glass-control mb-3 rounded-xl border border-border" key={chapter.id}>
            <div className="flex items-center gap-1 p-2">
              <button
                className={`min-w-0 flex-1 rounded-md px-2 py-2 text-left text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${selected(selection, 'chapter', chapter.id) ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                disabled={disabled}
                onClick={() => onSelect({ kind: 'chapter', id: chapter.id })}
                type="button"
              >
                {chapter.title}
              </button>
              <button aria-label="Move chapter up" className="rounded p-2 hover:bg-muted" disabled={disabled} onClick={() => onAction('up', 'chapter', chapter.id)} type="button"><ChevronUp className="h-4 w-4" /></button>
              <button aria-label="Move chapter down" className="rounded p-2 hover:bg-muted" disabled={disabled} onClick={() => onAction('down', 'chapter', chapter.id)} type="button"><ChevronDown className="h-4 w-4" /></button>
              <button aria-label="Delete chapter" className="rounded p-2 text-destructive hover:bg-destructive/10" disabled={disabled} onClick={() => onAction('delete', 'chapter', chapter.id)} type="button"><Trash2 className="h-4 w-4" /></button>
            </div>
            <div className="space-y-1 border-t border-border p-2">
              {chapter.lessons.map((lesson) => (
                <div className="group flex items-center gap-1" key={lesson.id}>
                  <button
                    className={`min-w-0 flex-1 rounded-md px-2 py-2 text-left text-xs disabled:cursor-not-allowed disabled:opacity-50 ${selected(selection, 'lesson', lesson.id) ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                    disabled={disabled}
                    onClick={() => onSelect({ kind: 'lesson', id: lesson.id })}
                    type="button"
                  >
                    <span className="block truncate font-medium">{lesson.headline}</span>
                    <span className="block opacity-65">{lesson.lessonType}</span>
                  </button>
                  <div className="hidden items-center group-hover:flex group-focus-within:flex">
                    <button aria-label="Move screen up" className="rounded p-1.5 hover:bg-muted" disabled={disabled} onClick={() => onAction('up', 'lesson', lesson.id)} type="button"><ChevronUp className="h-3.5 w-3.5" /></button>
                    <button aria-label="Move screen down" className="rounded p-1.5 hover:bg-muted" disabled={disabled} onClick={() => onAction('down', 'lesson', lesson.id)} type="button"><ChevronDown className="h-3.5 w-3.5" /></button>
                    <button aria-label="Duplicate screen" className="rounded p-1.5 hover:bg-muted" disabled={disabled} onClick={() => onAction('duplicate', 'lesson', lesson.id)} type="button"><Copy className="h-3.5 w-3.5" /></button>
                    <button aria-label="Delete screen" className="rounded p-1.5 text-destructive hover:bg-destructive/10" disabled={disabled} onClick={() => onAction('delete', 'lesson', lesson.id)} type="button"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
              <select
                aria-label={`Add screen to ${chapter.title}`}
                className="studio-glass-control mt-2 w-full rounded-md border border-input px-2 py-2 text-xs"
                defaultValue=""
                disabled={disabled}
                onChange={(event) => {
                  if (event.target.value) onAddLesson(chapter.id, event.target.value as CourseLessonType);
                  event.target.value = '';
                }}
              >
                <option disabled value="">+ Add screen</option>
                {BLOCKS.map((block) => <option key={block.type} value={block.type}>{block.label}</option>)}
              </select>
            </div>
          </section>
        ))}
        <button className="studio-glass-control flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm hover:border-primary hover:text-primary" disabled={disabled} onClick={onAddChapter} type="button"><Plus className="h-4 w-4" />Add chapter</button>
      </div>
      <TrashPanel
        disabled={disabled}
        items={trash}
        onEmpty={onEmptyTrash}
        onPermanentDelete={onPermanentDeleteTrash}
        onRestore={onRestoreTrash}
      />
      {(selection.kind === 'course' || selection.kind === 'cover') && courseSaveState && (
        <footer className="studio-glass border-x-0 border-b-0 border-t border-border p-4">
          <p aria-live="polite" className={`text-xs ${courseSaveState.error || (courseSaveState.dirty && !courseSaveState.valid) ? 'text-destructive' : 'text-muted-foreground'}`}>
            {courseSaveState.uploading
              ? 'Image upload in progress. Course settings are locked.'
              : courseSaveState.saving
                ? 'Saving course settings…'
                : courseSaveState.error ?? (courseSaveState.saved
                  ? 'Course settings saved.'
                  : courseSaveState.dirty && !courseSaveState.valid
                    ? 'Correct the highlighted fields before saving.'
                    : courseSaveState.dirty
                      ? 'Unsaved changes.'
                      : 'No unsaved changes.')}
          </p>
          <button
            className="mt-3 min-h-11 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            disabled={disabled || courseSaveState.locked || !courseSaveState.dirty || !courseSaveState.valid}
            form={courseSettingsFormId}
            type="submit"
          >
            {courseSaveState.saving ? 'Saving…' : 'Save course settings'}
          </button>
        </footer>
      )}
    </aside>
  );
}
