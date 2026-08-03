'use client';

import type {
  ChapterInput,
  CourseGraph,
  CourseLessonType,
  CourseSourceFile,
  LessonInput,
} from '@moto-ai/contracts/course-studio';
import { useCallback, useMemo, useState } from 'react';
import { toPlayerCourseContent } from '@/learning/course-player-adapter';
import type { CourseSettingsInput } from '@/shared/contracts/course-studio';
import { PlayerViewport } from '@/learning/PlayerViewport';
import { CourseOutline } from './CourseOutline';
import { StudioInspector } from './StudioInspector';
import { StudioToolbar } from './StudioToolbar';
import { SourcePanel } from './SourcePanel';
import { studioClient } from './studio-client';
import type { StudioTrashItem } from './studio-types';
import type { CourseInspectorSaveState } from './inspectors/CourseInspector';
import { useStudioPanelLayout } from './useStudioPanelLayout';
import { useStudioSelection } from './useStudioSelection';

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

export function CourseStudioWorkspace({
  initialCourse,
  initialSources,
  initialTrash,
  initialRevisionId,
}: {
  initialCourse: CourseGraph;
  initialSources: CourseSourceFile[];
  initialTrash: StudioTrashItem[];
  initialRevisionId?: string;
}) {
  const [course, setCourse] = useState(initialCourse);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [trash, setTrash] = useState(initialTrash);
  const [undoTrashId, setUndoTrashId] = useState<string | null>(null);
  const [focusPreview, setFocusPreview] = useState(false);
  const [courseSettingsDirty, setCourseSettingsDirty] = useState(false);
  const [courseSaveState, setCourseSaveState] =
    useState<CourseInspectorSaveState>(neutralCourseSaveState);
  const preview = useMemo(() => toPlayerCourseContent(course), [course]);

  const discardCourseSettings = useCallback((): void => {
    setCourseSettingsDirty(false);
    setCourse((current) => ({ ...current }));
  }, []);
  const {
    confirmDiscard: confirmDiscardCourseSettings,
    reconcileSelection,
    select,
    selection,
    setStudioSelection,
  } = useStudioSelection({
    courseId: initialCourse.id,
    courseSettingsDirty,
    saving,
    onDiscard: discardCourseSettings,
    onNonCourseSelection: () => setCourseSaveState(neutralCourseSaveState),
  });
  const { desktopGridStyle, outline, tools, workspaceRef } = useStudioPanelLayout();
  const selectedLessonId = selection.kind === 'lesson' ? selection.id : undefined;

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
    await run(
      'Chapter',
      async () => {
        const next = await studioClient.createChapter(course.id, title.trim());
        const created = next.chapters[next.chapters.length - 1];
        if (created) setStudioSelection({ kind: 'chapter', id: created.id });
        return next;
      },
      { structural: true },
    );
  }

  async function addLesson(chapterId: string, lessonType: CourseLessonType) {
    if (!confirmDiscardCourseSettings()) return;
    await run(
      'Screen',
      async () => {
        const previousIds = new Set(
          course.chapters.flatMap((chapter) => chapter.lessons.map((lesson) => lesson.id)),
        );
        const next = await studioClient.createLesson(course.id, chapterId, lessonType);
        const created = next.chapters
          .flatMap((chapter) => chapter.lessons)
          .find((lesson) => !previousIds.has(lesson.id));
        if (created) setStudioSelection({ kind: 'lesson', id: created.id });
        return next;
      },
      { structural: true },
    );
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
      setStatus(
        error instanceof Error ? error.message : 'Screen could not be permanently deleted.',
      );
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
    )
      return;
    if (!confirmDiscardCourseSettings()) return;
    await run(
      kind === 'lesson' ? 'Screen' : 'Chapter',
      async () => {
        if (actionName === 'up' || actionName === 'down') {
          return studioClient.reorder(course.id, { kind, id, direction: actionName });
        }
        if (kind === 'lesson' && actionName === 'duplicate') {
          return studioClient.duplicateLesson(course.id, id);
        }
        const next = await studioClient.deleteChapter(course.id, id);
        return next;
      },
      { structural: true, reconcileSelection: actionName === 'delete' && kind === 'chapter' },
    );
  }

  async function saveCourse(input: CourseSettingsInput): Promise<void> {
    await run('Course', () => studioClient.updateCourse(course.id, input));
  }

  function toggleFocusPreview(): void {
    if (!focusPreview && !confirmDiscardCourseSettings()) return;
    setFocusPreview((value) => !value);
  }

  return (
    <main className="studio-workspace text-foreground flex min-h-screen flex-col xl:h-screen xl:min-h-0 xl:overflow-hidden">
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
          {preview ? (
            <PlayerViewport
              aiIdentity={initialRevisionId ? { revisionId: initialRevisionId } : undefined}
              content={preview}
              fill
              selectedLessonId={selectedLessonId}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-white/70">
              The current draft cannot be rendered. Return to the editor and correct its structured
              fields.
            </div>
          )}
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
            aria-valuemax={outline.maximum}
            aria-valuemin={outline.minimum}
            aria-valuenow={outline.value}
            className="bg-border/55 hover:bg-primary/70 focus-visible:bg-primary hidden cursor-col-resize touch-none shadow-[inset_1px_0_0_rgb(255_255_255_/_22%)] transition-colors outline-none xl:block"
            onKeyDown={outline.onKeyDown}
            onPointerCancel={outline.onPointerCancel}
            onPointerDown={outline.onPointerDown}
            onPointerMove={outline.onPointerMove}
            onPointerUp={outline.onPointerUp}
            role="separator"
            tabIndex={0}
          />
          <section className="bg-muted/35 min-w-0 overflow-visible bg-[radial-gradient(circle_at_top_right,rgba(104,91,199,0.1),transparent_38%),linear-gradient(145deg,rgba(255,255,255,0.2),transparent_48%)] p-4 sm:p-6 xl:col-start-3 xl:row-start-1 xl:min-h-0 xl:overflow-auto">
            <div className="w-full">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">Live learner canvas</h2>
                  <p className="text-muted-foreground text-xs">
                    Preview mode never writes learner progress.
                  </p>
                </div>
                {selectedLessonId && (
                  <span className="bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-medium">
                    Selected screen
                  </span>
                )}
              </div>
              {preview ? (
                <PlayerViewport
                  aiIdentity={initialRevisionId ? { revisionId: initialRevisionId } : undefined}
                  content={preview}
                  selectedLessonId={selectedLessonId}
                />
              ) : (
                <div className="border-destructive/30 bg-card text-destructive flex aspect-video items-center justify-center rounded-xl border p-8 text-center text-sm">
                  This draft contains invalid player content. Correct the JSON in the inspector to
                  restore preview.
                </div>
              )}
            </div>
          </section>
          <div
            aria-label="Resize editor tools"
            aria-orientation="horizontal"
            aria-valuemax={tools.maximum}
            aria-valuemin={tools.minimum}
            aria-valuenow={tools.value}
            className="bg-border/55 hover:bg-primary/70 focus-visible:bg-primary hidden cursor-row-resize touch-none shadow-[inset_0_1px_0_rgb(255_255_255_/_22%)] transition-colors outline-none xl:col-start-3 xl:row-start-2 xl:block"
            onKeyDown={tools.onKeyDown}
            onPointerCancel={tools.onPointerCancel}
            onPointerDown={tools.onPointerDown}
            onPointerMove={tools.onPointerMove}
            onPointerUp={tools.onPointerUp}
            role="separator"
            tabIndex={0}
          />
          <div className="border-border flex flex-col border-t xl:col-start-3 xl:row-start-3 xl:min-h-0">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <StudioInspector
                course={course}
                courseSettingsFormId={courseSettingsFormId}
                disabled={saving}
                key={`${selection.kind}:${selection.id}`}
                onSaveChapter={(chapterId, input) =>
                  run('Chapter', () =>
                    studioClient.updateChapter(course.id, chapterId, input as ChapterInput),
                  )
                }
                onDirtyChange={setCourseSettingsDirty}
                onSaveCourse={saveCourse}
                onSaveLesson={(lessonId, input) =>
                  run('Screen', () =>
                    studioClient.updateLesson(course.id, lessonId, input as LessonInput),
                  )
                }
                onSaveStateChange={setCourseSaveState}
                selection={selection}
                sourcePanel={
                  selection.kind === 'course' ? (
                    <SourcePanel courseId={course.id} initialSources={initialSources} />
                  ) : undefined
                }
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
