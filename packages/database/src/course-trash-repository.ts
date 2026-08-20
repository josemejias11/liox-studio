import { Prisma } from '@prisma/client';
import { prisma } from './index';
import { getAuthoringCourse, type CourseGraph } from './course-repository';

export interface CourseTrashItem {
  id: string;
  lessonId: string;
  chapterId: string;
  chapterTitle: string;
  position: number;
  lessonType: string;
  headline: string;
  deletedAt: Date;
}

interface TrashLessonResult {
  course: CourseGraph;
  trashItem: CourseTrashItem;
  trash: CourseTrashItem[];
}

interface RestoreTrashItemResult {
  course: CourseGraph;
  restoredLessonId: string;
  trash: CourseTrashItem[];
}

function toCourseTrashItem(item: {
  id: string;
  lessonId: string;
  chapterId: string;
  chapterTitle: string;
  position: number;
  lessonType: string;
  headline: string;
  deletedAt: Date;
}): CourseTrashItem {
  return item;
}

function toInputJson(
  value: Prisma.JsonValue | null,
): Prisma.InputJsonValue | Prisma.NullTypes.JsonNull {
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

async function requireAuthoringCourse(courseId: string): Promise<CourseGraph> {
  const course = await getAuthoringCourse(courseId);
  if (!course) throw new Error('COURSE_NOT_FOUND');
  return course;
}

export async function listCourseTrash(courseId: string): Promise<CourseTrashItem[]> {
  const trash = await prisma.courseLessonTrash.findMany({
    where: { courseId },
    orderBy: { deletedAt: 'desc' },
    select: {
      id: true,
      lessonId: true,
      chapterId: true,
      chapterTitle: true,
      position: true,
      lessonType: true,
      headline: true,
      deletedAt: true,
    },
  });
  return trash.map(toCourseTrashItem);
}

export async function trashLesson(lessonId: string): Promise<TrashLessonResult> {
  const { courseId, trashItem } = await prisma.$transaction(async (tx) => {
    const lesson = await tx.courseLesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        chapterId: true,
        position: true,
        lessonType: true,
        headline: true,
        body: true,
        payload: true,
        chapter: {
          select: {
            id: true,
            title: true,
            course: { select: { id: true } },
          },
        },
      },
    });
    if (!lesson) throw new Error('LESSON_NOT_FOUND');

    const siblings = await tx.courseLesson.findMany({
      where: { chapterId: lesson.chapterId },
      orderBy: { position: 'asc' },
      select: { id: true, position: true },
    });
    if (siblings.length <= 1) throw new Error('FINAL_LESSON');

    const createdTrashItem = await tx.courseLessonTrash.create({
      data: {
        courseId: lesson.chapter.course.id,
        lessonId: lesson.id,
        chapterId: lesson.chapter.id,
        chapterTitle: lesson.chapter.title,
        position: lesson.position,
        lessonType: lesson.lessonType,
        headline: lesson.headline,
        body: toInputJson(lesson.body),
        payload: toInputJson(lesson.payload),
      },
      select: {
        id: true,
        lessonId: true,
        chapterId: true,
        chapterTitle: true,
        position: true,
        lessonType: true,
        headline: true,
        deletedAt: true,
      },
    });
    await tx.courseLesson.delete({ where: { id: lesson.id } });
    for (const [position, sibling] of siblings.filter((item) => item.id !== lesson.id).entries()) {
      await tx.courseLesson.update({ where: { id: sibling.id }, data: { position } });
    }

    return {
      courseId: lesson.chapter.course.id,
      trashItem: toCourseTrashItem(createdTrashItem),
    };
  });

  const [course, trash] = await Promise.all([
    requireAuthoringCourse(courseId),
    listCourseTrash(courseId),
  ]);
  return { course, trashItem, trash };
}

export async function restoreCourseTrashItem(
  courseId: string,
  trashId: string,
): Promise<RestoreTrashItemResult> {
  const restoredLessonId = await prisma.$transaction(async (tx) => {
    const trashItem = await tx.courseLessonTrash.findFirst({
      where: { id: trashId, courseId },
    });
    if (!trashItem) throw new Error('TRASH_ITEM_NOT_FOUND');

    const chapter = await tx.courseChapter.findFirst({
      where: { id: trashItem.chapterId, courseId },
      select: { id: true },
    });
    if (!chapter) throw new Error('ORIGINAL_CHAPTER_NOT_FOUND');

    const activeLesson = await tx.courseLesson.findUnique({
      where: { id: trashItem.lessonId },
      select: { id: true },
    });
    if (activeLesson) throw new Error('LESSON_ID_CONFLICT');

    const siblings = await tx.courseLesson.findMany({
      where: { chapterId: chapter.id },
      orderBy: { position: 'desc' },
      select: { id: true, position: true },
    });
    const position = Math.min(trashItem.position, siblings.length);
    for (const sibling of siblings.filter((item) => item.position >= position)) {
      await tx.courseLesson.update({
        where: { id: sibling.id },
        data: { position: sibling.position + 1 },
      });
    }

    await tx.courseLesson.create({
      data: {
        id: trashItem.lessonId,
        chapterId: chapter.id,
        position,
        lessonType: trashItem.lessonType,
        headline: trashItem.headline,
        body: toInputJson(trashItem.body),
        payload: toInputJson(trashItem.payload),
      },
    });
    await tx.courseLessonTrash.delete({ where: { id: trashItem.id } });
    return trashItem.lessonId;
  });

  const [course, trash] = await Promise.all([
    requireAuthoringCourse(courseId),
    listCourseTrash(courseId),
  ]);
  return { course, restoredLessonId, trash };
}

export async function permanentlyDeleteCourseTrashItem(
  courseId: string,
  trashId: string,
): Promise<CourseTrashItem[]> {
  await prisma.courseLessonTrash.deleteMany({ where: { id: trashId, courseId } });
  return listCourseTrash(courseId);
}

export async function emptyCourseTrash(courseId: string): Promise<void> {
  await prisma.courseLessonTrash.deleteMany({ where: { courseId } });
}
