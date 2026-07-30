'use client';

import type {
  ChapterInput,
  CourseGraph,
  CourseLessonType,
  LessonInput,
} from '@moto-ai/contracts/course-studio';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { toPlayerCourseContent } from '@/lib/course-player-adapter';
import type { CourseSettingsInput } from '@/lib/contracts/course-studio';
import { AuthoringPreview } from './AuthoringPreview';
import { CourseOutline } from './CourseOutline';
import { StudioInspector } from './StudioInspector';
import { StudioToolbar } from './StudioToolbar';
import { studioClient } from './studio-client';
import type { StudioSelection, StudioTrashItem } from './studio-types';
import type { CourseInspectorSaveState } from './inspectors/CourseInspector';
import { usePersistentPanelSize } from './usePersistentPanelSize';

const courseSettingsFormId = 'course-settings-form';
const neutralCourseSaveState: CourseInspectorSaveState = {
  dirty: false,
  valid: true,
  locked: false,
  saving: false,
  uploading: false,
  saved: false,
  error: null,
};

const outlineMinimum = 240;
const outlineMaximum = 420;
const toolsMinimum = 240;
const defaultToolsMaximum = 260;
const desktopBreakpoint = 1280;

function getViewportToolsMaximum(): number {
  return Math.max(toolsMinimum, Math.floor(window.innerHeight * 0.6));
}

export function CourseStudioWorkspace({
  initialCourse,
  initialTrash,
}: {
  initialCourse: CourseGraph;
  initialTrash: StudioTrashItem[];
}) {
  const [course, setCourse] = useState(initialCourse);
  const [selection, setSelection] = useState<StudioSelection>({ kind: 'course', id: initialCourse.id });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [trash, setTrash] = useState(initialTrash);
  const [undoTrashId, setUndoTrashId] = useState<string | null>(null);
  const [focusPreview, setFocusPreview] = useState(false);
  const [courseSettingsDirty, setCourseSettingsDirty] = useState(false);
  const [courseSaveState, setCourseSaveState] = useState<CourseInspectorSaveState>(neutralCourseSaveState);
  const [toolsMaximum, setToolsMaximum] = useState(defaultToolsMaximum);
  const [toolsMaximumReady, setToolsMaximumReady] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const outlinePointerId = useRef<number | null>(null);
  const toolsPointerId = useRef<number | null>(null);
  const allowBrowserBack = useRef(false);
  const [outlineWidth, setOutlineWidth] = usePersistentPanelSize({
    key: 'moto-tutor:course-studio:outline-width',
    defaultValue: 320,
    minimum: outlineMinimum,
    maximum: outlineMaximum,
  });
  const [toolsHeight, setToolsHeight] = usePersistentPanelSize({
    key: 'moto-tutor:course-studio:tools-height',
    defaultValue: 260,
    minimum: toolsMinimum,
    maximum: toolsMaximum,
    restoreWhen: toolsMaximumReady,
  });
  const preview = useMemo(() => toPlayerCourseContent(course), [course]);
  const selectedLessonId = selection.kind === 'lesson' ? selection.id : undefined;

  const discardCourseSettings = useCallback((): void => {
    setCourseSettingsDirty(false);
    // Give the Course Inspector the persisted graph again so a confirmed discard
    // also resets its local form if a later structural mutation cannot complete.
    setCourse((current) => ({ ...current }));
  }, []);

  const confirmDiscardCourseSettings = useCallback((): boolean => {
    if (saving) return false;
    if (selection.kind !== 'course' || !courseSettingsDirty) return true;
    if (!window.confirm('Discard unsaved course changes?')) return false;
    discardCourseSettings();
    return true;
  }, [courseSettingsDirty, discardCourseSettings, saving, selection.kind]);

  useEffect(() => {
    const updateToolsMaximum = () => {
      setToolsMaximum(getViewportToolsMaximum());
      setToolsMaximumReady(true);
    };
    const animationFrame = window.requestAnimationFrame(updateToolsMaximum);
    window.addEventListener('resize', updateToolsMaximum);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', updateToolsMaximum);
    };
  }, []);

  useEffect(() => {
    function preventUnsavedSettingsLoss(event: BeforeUnloadEvent): void {
      if (!courseSettingsDirty) return;
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', preventUnsavedSettingsLoss);
    return () => window.removeEventListener('beforeunload', preventUnsavedSettingsLoss);
  }, [courseSettingsDirty]);

  useEffect(() => {
    if (!courseSettingsDirty) return;
    const editorUrl = window.location.href;

    function preventBrowserBack(): void {
      if (allowBrowserBack.current) {
        allowBrowserBack.current = false;
        return;
      }
      window.history.pushState(window.history.state, '', editorUrl);
      if (!confirmDiscardCourseSettings()) return;
      allowBrowserBack.current = true;
      window.history.back();
    }

    window.addEventListener('popstate', preventBrowserBack);
    return () => window.removeEventListener('popstate', preventBrowserBack);
  }, [confirmDiscardCourseSettings, courseSettingsDirty]);

  function setStudioSelection(nextSelection: StudioSelection): void {
    setSelection(nextSelection);
    if (nextSelection.kind !== 'course') setCourseSaveState(neutralCourseSaveState);
  }

  function select(nextSelection: StudioSelection): void {
    if (nextSelection.kind === selection.kind && nextSelection.id === selection.id) return;
    if (!confirmDiscardCourseSettings()) return;
    setStudioSelection(nextSelection);
  }

  function reconcileSelection(nextCourse: CourseGraph) {
    setSelection((current) => {
      if (current.kind === 'course') {
        return current.id === nextCourse.id ? current : { kind: 'course', id: nextCourse.id };
      }
      const chapter = nextCourse.chapters.find((item) => item.id === current.id);
      if (current.kind === 'chapter') {
        return chapter ? current : { kind: 'course', id: nextCourse.id };
      }
      const lessonExists = nextCourse.chapters.some((item) => item.lessons.some((lesson) => lesson.id === current.id));
      return lessonExists ? current : { kind: 'course', id: nextCourse.id };
    });
  }

  async function run(
    label: string,
    mutation: () => Promise<CourseGraph>,
    options: { structural?: boolean; reconcileSelection?: boolean } = {},
  ) {
    setSaving(true);
    setStatus(`Saving ${label}…`);
    try {
      const next = await mutation();
      setCourse(next);
      if (options.reconcileSelection) reconcileSelection(next);
      if (options.structural) setUndoTrashId(null);
      setStatus(`${label} saved`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `${label} could not be saved`);
      throw error;
    } finally {
      setSaving(false);
    }
  }

  async function addChapter() {
    const title = window.prompt('Chapter title', 'New chapter');
    if (!title?.trim()) return;
    if (!confirmDiscardCourseSettings()) return;
    await run('Chapter', async () => {
      const next = await studioClient.createChapter(course.id, title.trim());
      const created = next.chapters[next.chapters.length - 1];
      if (created) setStudioSelection({ kind: 'chapter', id: created.id });
      return next;
    }, { structural: true });
  }

  async function addLesson(chapterId: string, lessonType: CourseLessonType) {
    if (!confirmDiscardCourseSettings()) return;
    await run('Screen', async () => {
      const previousIds = new Set(course.chapters.flatMap((chapter) => chapter.lessons.map((lesson) => lesson.id)));
      const next = await studioClient.createLesson(course.id, chapterId, lessonType);
      const created = next.chapters.flatMap((chapter) => chapter.lessons).find((lesson) => !previousIds.has(lesson.id));
      if (created) setStudioSelection({ kind: 'lesson', id: created.id });
      return next;
    }, { structural: true });
  }

  async function moveScreenToTrash(lessonId: string) {
    if (!window.confirm('Move this screen to Trash? You can restore it later.')) return;
    if (!confirmDiscardCourseSettings()) return;
    setSaving(true);
    setStatus('Moving screen to Trash…');
    try {
      const next = await studioClient.trashLesson(course.id, lessonId);
      setCourse(next.course);
      setTrash(next.trash);
      reconcileSelection(next.course);
      setUndoTrashId(next.trashItem?.id ?? null);
      setStatus('Screen moved to Trash.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Screen could not be moved to Trash.');
    } finally {
      setSaving(false);
    }
  }

  async function restoreTrashItem(trashId: string) {
    if (!confirmDiscardCourseSettings()) return;
    setSaving(true);
    setStatus('Restoring screen…');
    try {
      const next = await studioClient.restoreTrashItem(course.id, trashId);
      setCourse(next.course);
      setTrash(next.trash);
      if (next.restoredLessonId) setStudioSelection({ kind: 'lesson', id: next.restoredLessonId });
      setUndoTrashId(null);
      setStatus('Screen restored from Trash.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Screen could not be restored.');
    } finally {
      setSaving(false);
    }
  }

  async function permanentlyDeleteTrashItem(trashId: string) {
    setSaving(true);
    setStatus('Permanently deleting screen…');
    try {
      setTrash(await studioClient.permanentlyDeleteTrashItem(course.id, trashId));
      setUndoTrashId(null);
      setStatus('Screen permanently deleted.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Screen could not be permanently deleted.');
    } finally {
      setSaving(false);
    }
  }

  async function emptyTrash() {
    setSaving(true);
    setStatus('Emptying Trash…');
    try {
      await studioClient.emptyTrash(course.id);
      setTrash([]);
      setUndoTrashId(null);
      setStatus('Trash emptied.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Trash could not be emptied.');
    } finally {
      setSaving(false);
    }
  }

  async function action(
    actionName: 'up' | 'down' | 'duplicate' | 'delete',
    kind: 'chapter' | 'lesson',
    id: string,
  ) {
    if (actionName === 'delete' && kind === 'lesson') {
      await moveScreenToTrash(id);
      return;
    }
    if (
      actionName === 'delete' &&
      !window.confirm(
        'Permanently delete this chapter and its active screens? Screens already in Trash are kept. This cannot be undone.',
      )
    ) return;
    if (!confirmDiscardCourseSettings()) return;
    await run(kind === 'lesson' ? 'Screen' : 'Chapter', async () => {
      if (actionName === 'up' || actionName === 'down') {
        return studioClient.reorder(course.id, { kind, id, direction: actionName });
      }
      if (kind === 'lesson' && actionName === 'duplicate') {
        return studioClient.duplicateLesson(course.id, id);
      }
      const next = await studioClient.deleteChapter(course.id, id);
      return next;
    }, { structural: true, reconcileSelection: actionName === 'delete' && kind === 'chapter' });
  }

  async function saveCourse(input: CourseSettingsInput): Promise<void> {
    await run('Course', () => studioClient.updateCourse(course.id, input));
  }

  function toggleFocusPreview(): void {
    if (!focusPreview && !confirmDiscardCourseSettings()) return;
    setFocusPreview((value) => !value);
  }

  function isDesktopEditor(): boolean {
    return typeof window !== 'undefined' && window.innerWidth >= desktopBreakpoint;
  }

  function updateOutlineWidth(clientX: number): void {
    const bounds = workspaceRef.current?.getBoundingClientRect();
    if (bounds) setOutlineWidth(clientX - bounds.left);
  }

  function updateToolsHeight(clientY: number): void {
    const bounds = workspaceRef.current?.getBoundingClientRect();
    if (bounds) setToolsHeight(bounds.bottom - clientY);
  }

  function beginPointerDrag(
    event: PointerEvent<HTMLDivElement>,
    pointerId: { current: number | null },
    update: (position: number) => void,
  ): void {
    if (!isDesktopEditor()) return;
    pointerId.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    update(event.currentTarget.dataset.axis === 'x' ? event.clientX : event.clientY);
  }

  function continuePointerDrag(
    event: PointerEvent<HTMLDivElement>,
    pointerId: { current: number | null },
    update: (position: number) => void,
  ): void {
    if (pointerId.current !== event.pointerId) return;
    update(event.currentTarget.dataset.axis === 'x' ? event.clientX : event.clientY);
  }

  function endPointerDrag(event: PointerEvent<HTMLDivElement>, pointerId: { current: number | null }): void {
    if (pointerId.current !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pointerId.current = null;
  }

  function adjustPanelWithKeyboard(
    event: KeyboardEvent<HTMLDivElement>,
    value: number,
    setValue: (nextValue: number) => void,
    minimum: number,
    maximum: number,
  ): void {
    const increment = event.shiftKey ? 48 : 16;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      setValue(value - increment);
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      setValue(value + increment);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setValue(minimum);
    } else if (event.key === 'End') {
      event.preventDefault();
      setValue(maximum);
    }
  }

  const desktopGridStyle = {
    '--course-studio-outline-width': `${outlineWidth}px`,
    '--course-studio-tools-height': `${toolsHeight}px`,
  } as CSSProperties;

  return (
    <main className="studio-workspace flex min-h-screen flex-col text-foreground xl:h-screen xl:min-h-0 xl:overflow-hidden">
      <StudioToolbar
        focusPreview={focusPreview}
        onNavigateToLibrary={confirmDiscardCourseSettings}
        onToggleFocus={toggleFocusPreview}
        onUndo={undoTrashId ? () => void restoreTrashItem(undoTrashId) : undefined}
        status={status}
        title={course.title}
        undoDisabled={saving}
      />
      {focusPreview ? (
        <div className="min-h-0 flex-1 bg-zinc-950 p-5">
          {preview
            ? <AuthoringPreview content={preview} fill selectedLessonId={selectedLessonId} />
            : <div className="flex h-full items-center justify-center text-sm text-white/70">The current draft cannot be rendered. Return to the editor and correct its structured fields.</div>}
        </div>
      ) : (
        <div
          className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[var(--course-studio-outline-width)_0.75rem_minmax(0,1fr)] xl:grid-rows-[minmax(0,1fr)_0.75rem_var(--course-studio-tools-height)] xl:overflow-hidden"
          ref={workspaceRef}
          style={desktopGridStyle}
        >
          <div className="min-h-0 xl:row-span-3 xl:overflow-hidden">
            <CourseOutline
              className="h-full"
              course={course}
              courseSaveState={courseSaveState}
              courseSettingsFormId={courseSettingsFormId}
              disabled={saving}
              onAction={action}
              onAddChapter={addChapter}
              onAddLesson={addLesson}
              onEmptyTrash={emptyTrash}
              onPermanentDeleteTrash={permanentlyDeleteTrashItem}
              onRestoreTrash={restoreTrashItem}
              onSelect={select}
              selection={selection}
              trash={trash}
            />
          </div>
          <div
            aria-label="Resize course outline"
            aria-orientation="vertical"
            aria-valuemax={outlineMaximum}
            aria-valuemin={outlineMinimum}
            aria-valuenow={outlineWidth}
            className="hidden cursor-col-resize touch-none bg-border/55 shadow-[inset_1px_0_0_rgb(255_255_255_/_22%)] outline-none transition-colors hover:bg-primary/70 focus-visible:bg-primary xl:block"
            data-axis="x"
            onKeyDown={(event) => adjustPanelWithKeyboard(event, outlineWidth, setOutlineWidth, outlineMinimum, outlineMaximum)}
            onPointerCancel={(event) => endPointerDrag(event, outlinePointerId)}
            onPointerDown={(event) => beginPointerDrag(event, outlinePointerId, updateOutlineWidth)}
            onPointerMove={(event) => continuePointerDrag(event, outlinePointerId, updateOutlineWidth)}
            onPointerUp={(event) => endPointerDrag(event, outlinePointerId)}
            role="separator"
            tabIndex={0}
          />
          <section className="min-w-0 overflow-visible bg-[radial-gradient(circle_at_top_right,rgba(104,91,199,0.1),transparent_38%),linear-gradient(145deg,rgba(255,255,255,0.2),transparent_48%)] bg-muted/35 p-4 sm:p-6 xl:col-start-3 xl:row-start-1 xl:min-h-0 xl:overflow-auto">
            <div className="w-full">
              <div className="mb-3 flex items-center justify-between">
                <div><h2 className="text-sm font-semibold">Live learner canvas</h2><p className="text-xs text-muted-foreground">Preview mode never writes learner progress.</p></div>
                {selectedLessonId && <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">Selected screen</span>}
              </div>
              {preview
                ? <AuthoringPreview content={preview} selectedLessonId={selectedLessonId} />
                : <div className="flex aspect-video items-center justify-center rounded-xl border border-destructive/30 bg-card p-8 text-center text-sm text-destructive">This draft contains invalid player content. Correct the JSON in the inspector to restore preview.</div>}
            </div>
          </section>
          <div
            aria-label="Resize editor tools"
            aria-orientation="horizontal"
            aria-valuemax={toolsMaximum}
            aria-valuemin={toolsMinimum}
            aria-valuenow={toolsHeight}
            className="hidden cursor-row-resize touch-none bg-border/55 shadow-[inset_0_1px_0_rgb(255_255_255_/_22%)] outline-none transition-colors hover:bg-primary/70 focus-visible:bg-primary xl:col-start-3 xl:row-start-2 xl:block"
            data-axis="y"
            onKeyDown={(event) => adjustPanelWithKeyboard(event, toolsHeight, setToolsHeight, toolsMinimum, toolsMaximum)}
            onPointerCancel={(event) => endPointerDrag(event, toolsPointerId)}
            onPointerDown={(event) => beginPointerDrag(event, toolsPointerId, updateToolsHeight)}
            onPointerMove={(event) => continuePointerDrag(event, toolsPointerId, updateToolsHeight)}
            onPointerUp={(event) => endPointerDrag(event, toolsPointerId)}
            role="separator"
            tabIndex={0}
          />
          <div className="flex flex-col border-t border-border xl:col-start-3 xl:row-start-3 xl:min-h-0">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <StudioInspector
                course={course}
                courseSettingsFormId={courseSettingsFormId}
                disabled={saving}
                key={`${selection.kind}:${selection.id}`}
                onSaveChapter={(chapterId, input) => run('Chapter', () => studioClient.updateChapter(course.id, chapterId, input as ChapterInput))}
                onDirtyChange={setCourseSettingsDirty}
                onSaveCourse={saveCourse}
                onSaveLesson={(lessonId, input) => run('Screen', () => studioClient.updateLesson(course.id, lessonId, input as LessonInput))}
                onSaveStateChange={setCourseSaveState}
                selection={selection}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
