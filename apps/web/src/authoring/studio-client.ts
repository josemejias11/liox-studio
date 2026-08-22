import type {
  ChapterInput,
  CourseGraph,
  CourseLessonType,
  LessonInput,
} from '@moto-ai/contracts/course-studio';
import type { CourseAssessmentInput } from '@moto-ai/contracts';
import type { CourseSettingsInput } from '@/shared/contracts/course-settings';
import { fetchJson } from '@/shared/fetch-json';

export interface StudioTrashItem {
  id: string;
  lessonId: string;
  chapterId: string;
  chapterTitle: string;
  position: number;
  lessonType: string;
  headline: string;
  deletedAt: string;
}

export interface StudioTrashMutation {
  course: CourseGraph;
  trash: StudioTrashItem[];
  trashItem?: StudioTrashItem;
  restoredLessonId?: string;
}

async function mutate(
  url: string,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  body: unknown,
): Promise<CourseGraph> {
  const init: RequestInit = {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
  const result = await fetchJson<{ course?: CourseGraph; error?: string }>(
    url,
    init,
    'Course Studio could not save this change.',
  );
  if (!result.course) {
    throw new Error(result.error || 'Course Studio could not save this change.');
  }
  return result.course;
}

async function mutateTrash(
  url: string,
  method: 'POST' | 'DELETE',
  body?: unknown,
): Promise<StudioTrashMutation> {
  const init: RequestInit = {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
  const result = await fetchJson<StudioTrashMutation & { error?: string }>(
    url,
    init,
    'Course Studio could not save this change.',
  );
  if (!result.course || !Array.isArray(result.trash)) {
    throw new Error(result.error || 'Course Studio could not save this change.');
  }
  return result;
}

async function mutateTrashList(url: string, method: 'DELETE'): Promise<StudioTrashItem[]> {
  const init: RequestInit = { method };
  const result = await fetchJson<{ trash?: StudioTrashItem[]; error?: string }>(
    url,
    init,
    'Course Studio could not save this change.',
  );
  if (!Array.isArray(result.trash)) {
    throw new Error(result.error || 'Course Studio could not save this change.');
  }
  return result.trash;
}

function courseUrl(courseId: string, suffix = '') {
  return `/api/course-studio/courses/${encodeURIComponent(courseId)}${suffix}`;
}

export const studioClient = {
  updateCourse: (courseId: string, input: CourseSettingsInput) =>
    mutate(courseUrl(courseId), 'PATCH', input),
  createChapter: (courseId: string, title: string) =>
    mutate(courseUrl(courseId, '/chapters'), 'POST', { title }),
  updateChapter: (courseId: string, chapterId: string, input: ChapterInput) =>
    mutate(courseUrl(courseId, '/chapters'), 'PATCH', { chapterId, ...input }),
  deleteChapter: (courseId: string, chapterId: string) =>
    mutate(courseUrl(courseId, '/chapters'), 'DELETE', { chapterId }),
  createLesson: (courseId: string, chapterId: string, lessonType: CourseLessonType) =>
    mutate(courseUrl(courseId, '/lessons'), 'POST', { chapterId, lessonType }),
  updateLesson: (courseId: string, lessonId: string, input: LessonInput) =>
    mutate(courseUrl(courseId, '/lessons'), 'PATCH', { lessonId, ...input }),
  duplicateLesson: (courseId: string, lessonId: string) =>
    mutate(courseUrl(courseId, '/lessons'), 'DELETE', { lessonId, action: 'duplicate' }),
  deleteLesson: (courseId: string, lessonId: string) =>
    mutate(courseUrl(courseId, '/lessons'), 'DELETE', { lessonId, action: 'delete' }),
  trashLesson: (courseId: string, lessonId: string) =>
    mutateTrash(courseUrl(courseId, '/lessons'), 'DELETE', { lessonId, action: 'delete' }),
  restoreTrashItem: (courseId: string, trashId: string) =>
    mutateTrash(courseUrl(courseId, `/trash/${encodeURIComponent(trashId)}`), 'POST'),
  permanentlyDeleteTrashItem: (courseId: string, trashId: string) =>
    mutateTrashList(courseUrl(courseId, `/trash/${encodeURIComponent(trashId)}`), 'DELETE'),
  emptyTrash: async (courseId: string): Promise<void> => {
    await mutateTrashList(courseUrl(courseId, '/trash'), 'DELETE');
  },
  upsertChapterQuickCheck: (courseId: string, chapterId: string, input: CourseAssessmentInput) =>
    mutate(
      courseUrl(courseId, `/chapters/${encodeURIComponent(chapterId)}/quick-check`),
      'PUT',
      input,
    ),
  removeChapterQuickCheck: (courseId: string, chapterId: string) =>
    mutate(
      courseUrl(courseId, `/chapters/${encodeURIComponent(chapterId)}/quick-check`),
      'DELETE',
      undefined,
    ),
  upsertFinalAssessment: (courseId: string, input: CourseAssessmentInput) =>
    mutate(courseUrl(courseId, '/final-assessment'), 'PUT', input),
  removeFinalAssessment: (courseId: string) =>
    mutate(courseUrl(courseId, '/final-assessment'), 'DELETE', undefined),
  reorder: (
    courseId: string,
    input: { kind: 'chapter' | 'lesson'; id: string; direction: 'up' | 'down' },
  ) => mutate(courseUrl(courseId, '/reorder'), 'POST', input),
};
