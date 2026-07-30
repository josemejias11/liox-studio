import type {
  ChapterInput,
  CourseGraph,
  CourseLessonType,
  LessonInput,
} from '@moto-ai/contracts/course-studio';
import type { CourseSettingsInput } from '@/lib/contracts/course-studio';

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
  method: 'POST' | 'PATCH' | 'DELETE',
  body: unknown,
): Promise<CourseGraph> {
  const response = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json() as { course?: CourseGraph; error?: string };
  if (!response.ok || !result.course) {
    throw new Error(result.error || 'Course Studio could not save this change.');
  }
  return result.course;
}

async function mutateTrash(
  url: string,
  method: 'POST' | 'DELETE',
  body?: unknown,
): Promise<StudioTrashMutation> {
  const response = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json() as StudioTrashMutation & { error?: string };
  if (!response.ok || !result.course || !Array.isArray(result.trash)) {
    throw new Error(result.error || 'Course Studio could not save this change.');
  }
  return result;
}

async function mutateTrashList(
  url: string,
  method: 'DELETE',
): Promise<StudioTrashItem[]> {
  const response = await fetch(url, { method });
  const result = await response.json() as { trash?: StudioTrashItem[]; error?: string };
  if (!response.ok || !Array.isArray(result.trash)) {
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
  reorder: (
    courseId: string,
    input: { kind: 'chapter' | 'lesson'; id: string; direction: 'up' | 'down' },
  ) => mutate(courseUrl(courseId, '/reorder'), 'POST', input),
};
