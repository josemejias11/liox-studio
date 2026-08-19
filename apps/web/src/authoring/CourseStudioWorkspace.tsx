'use client';

import type { ChapterInput, CourseGraph, CourseSourceFile } from '@moto-ai/contracts/course-studio';
import type { OfflineAssistantPayload } from '@moto-ai/contracts';
import { useCallback, useMemo, useState } from 'react';
import { toPlayerCourseContent } from '@/learning/course-player-adapter';
import { PlayerViewport } from '@/learning/PlayerViewport';
import { CourseOutline } from './CourseOutline';
import { StudioInspector } from './StudioInspector';
import { StudioToolbar } from './StudioToolbar';
import { SourcePanel } from './SourcePanel';
import { AssistantQaPanel } from './AssistantQaPanel';
import type { StudioTrashItem } from './studio-types';
import type { CourseInspectorSaveState } from './inspectors/CourseInspector';
import { useStudioCourseCommands, useStudioCoursePersistence } from './useStudioCourseCommands';
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
  initialAssistant,
}: {
  initialCourse: CourseGraph;
  initialSources: CourseSourceFile[];
  initialTrash: StudioTrashItem[];
  initialRevisionId?: string;
  initialAssistant: OfflineAssistantPayload;
}) {
  const [focusPreview, setFocusPreview] = useState(false);
  const [courseSettingsDirty, setCourseSettingsDirty] = useState(false);
  const [courseSaveState, setCourseSaveState] =
    useState<CourseInspectorSaveState>(neutralCourseSaveState);
  const persistence = useStudioCoursePersistence({ initialCourse, initialTrash });
  const { course, saving, status, trash, undoTrashId } = persistence;
  const preview = useMemo(() => toPlayerCourseContent(course, { includeAnswerKey: true }), [course]);

  const discardCourseSettings = useCallback((): void => {
    setCourseSettingsDirty(false);
    persistence.refreshCourse();
  }, [persistence]);
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
  const {
    action,
    addChapter,
    addLesson,
    emptyTrash,
    permanentlyDeleteTrashItem,
    restoreTrashItem,
    saveChapter,
    saveCourse,
    saveLesson,
  } = useStudioCourseCommands({
    persistence,
    confirmDiscard: confirmDiscardCourseSettings,
    reconcileSelection,
    setStudioSelection,
  });
  const { desktopGridStyle, outline, tools, workspaceRef } = useStudioPanelLayout();
  const selectedLessonId = selection.kind === 'lesson' ? selection.id : undefined;
  const showCover = selection.kind === 'cover';
  const selectPreviewLesson = useCallback(
    (lessonId: string): void => {
      if (selection.kind === 'lesson' && selection.id === lessonId) return;
      if (course.chapters.some((chapter) => chapter.lessons.some((lesson) => lesson.id === lessonId))) {
        setStudioSelection({ kind: 'lesson', id: lessonId });
      }
    },
    [course.chapters, selection, setStudioSelection],
  );

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
              assistant={initialAssistant}
              content={preview}
              fill
              onLessonChange={selectPreviewLesson}
              selectedLessonId={selectedLessonId}
              initialView={showCover ? 'cover' : undefined}
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
                  assistant={initialAssistant}
                  content={preview}
                  onLessonChange={selectPreviewLesson}
                  selectedLessonId={selectedLessonId}
                  initialView={showCover ? 'cover' : undefined}
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
                onSaveChapter={(chapterId, input) => saveChapter(chapterId, input as ChapterInput)}
                onDirtyChange={setCourseSettingsDirty}
                onSaveCourse={saveCourse}
                onSaveLesson={saveLesson}
                onSaveStateChange={setCourseSaveState}
                selection={selection}
                sourcePanel={
                  selection.kind === 'course' || selection.kind === 'cover' ? (
                    <><SourcePanel courseId={course.id} initialSources={initialSources} /><AssistantQaPanel courseId={course.id} sources={initialSources} /></>
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
