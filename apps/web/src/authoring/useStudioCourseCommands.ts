'use client';

import type {
  ChapterInput,
  CourseGraph,
  CourseLessonType,
  LessonInput,
} from '@lb-studio/contracts/course-studio';
import type { CourseAssessmentInput } from '@lb-studio/contracts';
import { useState } from 'react';
import type { CourseSettingsInput } from '@/shared/contracts/course-settings';
import { studioClient } from './studio-client';
import type { StudioSelection, StudioTrashItem } from './studio-types';

interface MutationOptions {
  structural?: boolean;
  onSuccess?: (course: CourseGraph) => void;
}

export interface StudioCoursePersistence {
  course: CourseGraph;
  saving: boolean;
  status: string | null;
  trash: StudioTrashItem[];
  undoTrashId: string | null;
  refreshCourse: () => void;
  replaceCourse: (course: CourseGraph) => void;
  run: (
    label: string,
    mutation: () => Promise<CourseGraph>,
    options?: MutationOptions,
  ) => Promise<void>;
  setSaving: (saving: boolean) => void;
  setStatus: (status: string | null) => void;
  setTrash: (trash: StudioTrashItem[]) => void;
  setUndoTrashId: (trashId: string | null) => void;
}

export function useStudioCoursePersistence({
  initialCourse,
  initialTrash,
}: {
  initialCourse: CourseGraph;
  initialTrash: StudioTrashItem[];
}): StudioCoursePersistence {
  const [course, setCourse] = useState(initialCourse);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [trash, setTrash] = useState(initialTrash);
  const [undoTrashId, setUndoTrashId] = useState<string | null>(null);

  async function run(
    label: string,
    mutation: () => Promise<CourseGraph>,
    options: MutationOptions = {},
  ): Promise<void> {
    setSaving(true);
    setStatus(`Saving ${label}…`);
    try {
      const next = await mutation();
      setCourse(next);
      options.onSuccess?.(next);
      if (options.structural) setUndoTrashId(null);
      setStatus(`${label} saved`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `${label} could not be saved`);
      throw error;
    } finally {
      setSaving(false);
    }
  }

  return {
    course,
    saving,
    status,
    trash,
    undoTrashId,
    refreshCourse: () => setCourse((current) => ({ ...current })),
    replaceCourse: setCourse,
    run,
    setSaving,
    setStatus,
    setTrash,
    setUndoTrashId,
  };
}

interface UseStudioCourseCommandsOptions {
  persistence: StudioCoursePersistence;
  confirmDiscard: () => boolean;
  reconcileSelection: (course: CourseGraph) => void;
  setStudioSelection: (selection: StudioSelection) => void;
}

export function useStudioCourseCommands({
  persistence,
  confirmDiscard,
  reconcileSelection,
  setStudioSelection,
}: UseStudioCourseCommandsOptions) {
  const { course, replaceCourse, run, setSaving, setStatus, setTrash, setUndoTrashId } =
    persistence;

  async function addChapter(): Promise<void> {
    const title = window.prompt('Chapter title', 'New chapter');
    if (!title?.trim()) return;
    if (!confirmDiscard()) return;
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

  async function addLesson(chapterId: string, lessonType: CourseLessonType): Promise<void> {
    if (!confirmDiscard()) return;
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

  async function moveScreenToTrash(lessonId: string): Promise<void> {
    if (!window.confirm('Move this screen to Trash? You can restore it later.')) return;
    if (!confirmDiscard()) return;
    setSaving(true);
    setStatus('Moving screen to Trash…');
    try {
      const next = await studioClient.trashLesson(course.id, lessonId);
      replaceCourse(next.course);
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

  async function restoreTrashItem(trashId: string): Promise<void> {
    if (!confirmDiscard()) return;
    setSaving(true);
    setStatus('Restoring screen…');
    try {
      const next = await studioClient.restoreTrashItem(course.id, trashId);
      replaceCourse(next.course);
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

  async function permanentlyDeleteTrashItem(trashId: string): Promise<void> {
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

  async function emptyTrash(): Promise<void> {
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
  ): Promise<void> {
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
    if (!confirmDiscard()) return;
    await run(
      kind === 'lesson' ? 'Screen' : 'Chapter',
      async () => {
        if (actionName === 'up' || actionName === 'down') {
          return studioClient.reorder(course.id, { kind, id, direction: actionName });
        }
        if (kind === 'lesson' && actionName === 'duplicate') {
          return studioClient.duplicateLesson(course.id, id);
        }
        return studioClient.deleteChapter(course.id, id);
      },
      {
        structural: true,
        onSuccess: actionName === 'delete' && kind === 'chapter' ? reconcileSelection : undefined,
      },
    );
  }

  async function saveCourse(input: CourseSettingsInput): Promise<void> {
    await run('Course', () => studioClient.updateCourse(course.id, input));
  }

  async function saveChapter(chapterId: string, input: ChapterInput): Promise<void> {
    await run('Chapter', () => studioClient.updateChapter(course.id, chapterId, input));
  }

  async function saveLesson(lessonId: string, input: LessonInput): Promise<void> {
    await run('Screen', () => studioClient.updateLesson(course.id, lessonId, input));
  }

  async function saveChapterQuickCheck(
    chapterId: string,
    input: CourseAssessmentInput,
  ): Promise<void> {
    await run('Knowledge check', () =>
      studioClient.upsertChapterQuickCheck(course.id, chapterId, input),
    );
  }

  async function removeChapterQuickCheck(chapterId: string): Promise<void> {
    await run('Knowledge check', () => studioClient.removeChapterQuickCheck(course.id, chapterId), {
      structural: true,
      onSuccess: reconcileSelection,
    });
  }

  async function saveFinalAssessment(input: CourseAssessmentInput): Promise<void> {
    await run('Final assessment', () => studioClient.upsertFinalAssessment(course.id, input));
  }

  async function removeFinalAssessment(): Promise<void> {
    await run('Final assessment', () => studioClient.removeFinalAssessment(course.id), {
      structural: true,
      onSuccess: reconcileSelection,
    });
  }

  return {
    action,
    addChapter,
    addLesson,
    emptyTrash,
    moveScreenToTrash,
    permanentlyDeleteTrashItem,
    restoreTrashItem,
    saveChapter,
    saveChapterQuickCheck,
    saveCourse,
    saveFinalAssessment,
    saveLesson,
    removeChapterQuickCheck,
    removeFinalAssessment,
  };
}
