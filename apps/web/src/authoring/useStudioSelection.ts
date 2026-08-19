'use client';

import type { CourseGraph } from '@moto-ai/contracts/course-studio';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { StudioSelection } from './studio-types';

interface UseStudioSelectionOptions {
  courseId: string;
  courseSettingsDirty: boolean;
  saving: boolean;
  onDiscard: () => void;
  onNonCourseSelection: () => void;
}

export function useStudioSelection({
  courseId,
  courseSettingsDirty,
  saving,
  onDiscard,
  onNonCourseSelection,
}: UseStudioSelectionOptions) {
  const [selection, setSelection] = useState<StudioSelection>({ kind: 'course', id: courseId });
  const allowBrowserBack = useRef(false);

  const confirmDiscard = useCallback((): boolean => {
    if (saving) return false;
    if ((selection.kind !== 'course' && selection.kind !== 'cover') || !courseSettingsDirty) return true;
    if (!window.confirm('Discard unsaved course changes?')) return false;
    onDiscard();
    return true;
  }, [courseSettingsDirty, onDiscard, saving, selection.kind]);

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
      if (!confirmDiscard()) return;
      allowBrowserBack.current = true;
      window.history.back();
    }

    window.addEventListener('popstate', preventBrowserBack);
    return () => window.removeEventListener('popstate', preventBrowserBack);
  }, [confirmDiscard, courseSettingsDirty]);

  const setStudioSelection = useCallback(
    (nextSelection: StudioSelection): void => {
      setSelection(nextSelection);
      if (nextSelection.kind !== 'course' && nextSelection.kind !== 'cover') onNonCourseSelection();
    },
    [onNonCourseSelection],
  );

  const select = useCallback(
    (nextSelection: StudioSelection): void => {
      if (nextSelection.kind === selection.kind && nextSelection.id === selection.id) return;
      if (!confirmDiscard()) return;
      setStudioSelection(nextSelection);
    },
    [confirmDiscard, selection, setStudioSelection],
  );

  const reconcileSelection = useCallback((nextCourse: CourseGraph): void => {
    setSelection((current) => {
      if (current.kind === 'course' || current.kind === 'cover') {
        return current.id === nextCourse.id ? current : { kind: 'course', id: nextCourse.id };
      }
      const chapter = nextCourse.chapters.find((item) => item.id === current.id);
      if (current.kind === 'chapter')
        return chapter ? current : { kind: 'course', id: nextCourse.id };
      const lessonExists = nextCourse.chapters.some((item) =>
        item.lessons.some((lesson) => lesson.id === current.id),
      );
      return lessonExists ? current : { kind: 'course', id: nextCourse.id };
    });
  }, []);

  return { confirmDiscard, reconcileSelection, select, selection, setStudioSelection };
}
