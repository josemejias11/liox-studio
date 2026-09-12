import { Prisma } from '@prisma/client';
import { CourseTemplateChecklistSchema } from '@lb-studio/contracts';
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

/**
 * Trashing a lesson (or, later, a chapter) can remove the only entity a
 * template-completeness requirement pointed at. Left alone, that requirement's
 * `entityId` no longer resolves against the live graph and the readiness
 * check (`resolveEntity` in `@lb-studio/contracts/course-readiness`) reports
 * it as "references an unknown template item" forever — the course could
 * never be frozen again even though the author deliberately, and validly,
 * removed that screen via Trash. Prune requirements whose entity no longer
 * exists so deleting a templated screen doesn't permanently block freeze.
 */
async function pruneTemplateChecklistRequirements(
  tx: Prisma.TransactionClient,
  courseId: string,
  removedEntityIds: readonly string[],
): Promise<void> {
  if (removedEntityIds.length === 0) return;
  const course = await tx.course.findUnique({
    where: { id: courseId },
    select: { templateChecklist: true },
  });
  if (!course?.templateChecklist) return;
  const parsed = CourseTemplateChecklistSchema.safeParse(course.templateChecklist);
  if (!parsed.success) return;
  const removed = new Set(removedEntityIds);
  const requirements = parsed.data.requirements.filter(
    (requirement) => !removed.has(requirement.entityId),
  );
  if (requirements.length === parsed.data.requirements.length) return;
  await tx.course.update({
    where: { id: courseId },
    data: {
      templateChecklist: { ...parsed.data, requirements } as unknown as Prisma.InputJsonValue,
    },
  });
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
    await pruneTemplateChecklistRequirements(tx, lesson.chapter.course.id, [lesson.id]);

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
