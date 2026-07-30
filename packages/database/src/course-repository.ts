import { Prisma } from '@prisma/client';
import type {
  ChapterInput,
  CourseGraph,
  CourseGraphChapter,
  CourseLessonType,
  LessonInput,
} from '@moto-ai/contracts/course-studio';
import { prisma } from './index';

export { COURSE_LESSON_TYPES } from '@moto-ai/contracts/course-studio';
export type {
  ChapterInput,
  CourseGraph,
  CourseGraphChapter,
  CourseGraphLesson,
  CourseLessonType,
  LessonInput,
} from '@moto-ai/contracts/course-studio';

export interface CourseDetailsInput {
  title?: string;
  slug?: string;
  description?: string | null;
  learningObjectives?: Prisma.InputJsonValue | null;
  cover?: Prisma.InputJsonValue | null;
  specifications?: Prisma.InputJsonValue | null;
  disclaimer?: Prisma.InputJsonValue | null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'untitled-course';
}

function newId(prefix: string): string {
  return `${prefix}.${crypto.randomUUID()}`;
}

function jsonValue(value: Prisma.InputJsonValue | null | undefined) {
  return value === null ? Prisma.JsonNull : value;
}

async function requireGraph(courseId: string): Promise<CourseGraph> {
  const graph = await getAuthoringCourse(courseId);
  if (!graph) throw new Error('COURSE_NOT_FOUND');
  return graph;
}

async function courseIdForChapter(chapterId: string): Promise<string> {
  const chapter = await prisma.courseChapter.findUnique({
    where: { id: chapterId },
    select: { courseId: true },
  });
  if (!chapter) throw new Error('CHAPTER_NOT_FOUND');
  return chapter.courseId;
}

async function lessonLocation(lessonId: string): Promise<{ courseId: string; chapterId: string }> {
  const lesson = await prisma.courseLesson.findUnique({
    where: { id: lessonId },
    select: { chapterId: true, chapter: { select: { courseId: true } } },
  });
  if (!lesson) throw new Error('LESSON_NOT_FOUND');
  return { courseId: lesson.chapter.courseId, chapterId: lesson.chapterId };
}

export const courseGraphSelect = Prisma.validator<Prisma.CourseSelect>()({
  id: true,
  slug: true,
  title: true,
  description: true,
  learningObjectives: true,
  cover: true,
  specifications: true,
  disclaimer: true,
  chapters: {
    orderBy: { position: 'asc' },
    select: {
      id: true,
      title: true,
      position: true,
      estimatedDuration: true,
      lessons: {
        orderBy: { position: 'asc' },
        select: { id: true, position: true, lessonType: true, headline: true, body: true, payload: true },
      },
      quickCheck: {
        select: { id: true, title: true, instructions: true, payload: true },
      },
    },
  },
});

export type AuthoringCourseRecord = Prisma.CourseGetPayload<{ select: typeof courseGraphSelect }>;

export function toCourseGraph(course: AuthoringCourseRecord): CourseGraph {
  return course;
}

export async function listAuthoringCourses(): Promise<Array<Pick<CourseGraph, 'id' | 'slug' | 'title' | 'description' | 'cover'>>> {
  return prisma.course.findMany({
    orderBy: { updatedAt: 'desc' },
    select: { id: true, slug: true, title: true, description: true, cover: true },
  });
}

export async function getAuthoringCourse(courseId: string): Promise<CourseGraph | null> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: courseGraphSelect,
  });
  return course ? toCourseGraph(course) : null;
}

export async function createCourseTemplate(title: string): Promise<CourseGraph> {
  const baseSlug = slugify(title);
  const existing = await prisma.course.count({ where: { slug: { startsWith: baseSlug } } });
  const slug = existing === 0 ? baseSlug : `${baseSlug}-${existing + 1}`;
  const courseId = newId('course');
  const chapterId = newId('chapter');
  const lessonId = newId('lesson');

  const course = await prisma.course.create({
    data: {
      id: courseId,
      title,
      slug,
      chapters: {
        create: {
          id: chapterId,
          title: 'Introduction',
          position: 0,
          lessons: {
            create: {
              id: lessonId,
              position: 0,
              lessonType: 'content',
              headline: 'Welcome',
            },
          },
        },
      },
    },
    select: { id: true },
  });
  const graph = await getAuthoringCourse(course.id);
  if (!graph) throw new Error('Created course could not be loaded.');
  return graph;
}

export async function updateCourseDetails(
  courseId: string,
  input: CourseDetailsInput,
): Promise<CourseGraph> {
  await prisma.course.update({
    where: { id: courseId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.slug !== undefined ? { slug: slugify(input.slug) } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.learningObjectives !== undefined
        ? { learningObjectives: jsonValue(input.learningObjectives) }
        : {}),
      ...(input.cover !== undefined ? { cover: jsonValue(input.cover) } : {}),
      ...(input.specifications !== undefined
        ? { specifications: jsonValue(input.specifications) }
        : {}),
      ...(input.disclaimer !== undefined ? { disclaimer: jsonValue(input.disclaimer) } : {}),
    },
  });
  return requireGraph(courseId);
}

export async function createChapter(
  courseId: string,
  input: Required<Pick<ChapterInput, 'title'>>,
): Promise<CourseGraph> {
  await prisma.$transaction(async (tx) => {
    const position = await tx.courseChapter.count({ where: { courseId } });
    await tx.courseChapter.create({
      data: {
        id: newId('chapter'),
        courseId,
        title: input.title,
        position,
        lessons: {
          create: {
            id: newId('lesson'),
            position: 0,
            lessonType: 'content',
            headline: 'New content screen',
          },
        },
      },
    });
  });
  return requireGraph(courseId);
}

export async function updateChapter(
  chapterId: string,
  input: ChapterInput,
): Promise<CourseGraph> {
  const courseId = await courseIdForChapter(chapterId);
  await prisma.courseChapter.update({ where: { id: chapterId }, data: input });
  return requireGraph(courseId);
}

export async function deleteChapter(chapterId: string): Promise<CourseGraph> {
  const courseId = await courseIdForChapter(chapterId);
  await prisma.$transaction(async (tx) => {
    const chapters = await tx.courseChapter.findMany({
      where: { courseId },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    if (chapters.length <= 1) throw new Error('FINAL_CHAPTER');
    await tx.courseChapter.delete({ where: { id: chapterId } });
    const remaining = chapters.filter((chapter) => chapter.id !== chapterId);
    for (const [position, chapter] of remaining.entries()) {
      await tx.courseChapter.update({ where: { id: chapter.id }, data: { position } });
    }
  });
  return requireGraph(courseId);
}

export async function createLesson(
  chapterId: string,
  lessonType: CourseLessonType,
): Promise<CourseGraph> {
  const courseId = await courseIdForChapter(chapterId);
  await prisma.$transaction(async (tx) => {
    const position = await tx.courseLesson.count({ where: { chapterId } });
    await tx.courseLesson.create({
      data: {
        id: newId('lesson'),
        chapterId,
        position,
        lessonType,
        headline: `New ${lessonType} screen`,
        payload: {},
      },
    });
  });
  return requireGraph(courseId);
}

export async function updateLesson(
  lessonId: string,
  input: LessonInput,
): Promise<CourseGraph> {
  const { courseId } = await lessonLocation(lessonId);
  await prisma.courseLesson.update({
    where: { id: lessonId },
    data: {
      ...(input.headline !== undefined ? { headline: input.headline } : {}),
      ...(input.body !== undefined
        ? { body: jsonValue(input.body as Prisma.InputJsonValue | null) }
        : {}),
      ...(input.payload !== undefined ? { payload: input.payload as Prisma.InputJsonValue } : {}),
    },
  });
  return requireGraph(courseId);
}

export async function duplicateLesson(lessonId: string): Promise<CourseGraph> {
  const { courseId, chapterId } = await lessonLocation(lessonId);
  await prisma.$transaction(async (tx) => {
    const source = await tx.courseLesson.findUniqueOrThrow({ where: { id: lessonId } });
    const siblings = await tx.courseLesson.findMany({
      where: { chapterId },
      orderBy: { position: 'desc' },
      select: { id: true, position: true },
    });
    for (const sibling of siblings.filter((item) => item.position > source.position)) {
      await tx.courseLesson.update({
        where: { id: sibling.id },
        data: { position: sibling.position + 1 },
      });
    }
    await tx.courseLesson.create({
      data: {
        id: newId('lesson'),
        chapterId,
        position: source.position + 1,
        lessonType: source.lessonType,
        headline: `${source.headline} copy`,
        body: source.body ?? Prisma.JsonNull,
        payload: source.payload === null
          ? Prisma.JsonNull
          : source.payload as Prisma.InputJsonValue,
      },
    });
  });
  return requireGraph(courseId);
}

export async function reorderCourseItem(
  courseId: string,
  input: { kind: 'chapter' | 'lesson'; id: string; direction: 'up' | 'down' },
): Promise<CourseGraph> {
  await prisma.$transaction(async (tx) => {
    if (input.kind === 'chapter') {
      const items = await tx.courseChapter.findMany({
        where: { courseId },
        orderBy: { position: 'asc' },
        select: { id: true, position: true },
      });
      const index = items.findIndex((item) => item.id === input.id);
      const target = input.direction === 'up' ? index - 1 : index + 1;
      if (index < 0 || target < 0 || target >= items.length) return;
      await tx.courseChapter.update({ where: { id: items[index].id }, data: { position: -1 } });
      await tx.courseChapter.update({
        where: { id: items[target].id },
        data: { position: items[index].position },
      });
      await tx.courseChapter.update({
        where: { id: items[index].id },
        data: { position: items[target].position },
      });
      return;
    }

    const lesson = await tx.courseLesson.findUnique({
      where: { id: input.id },
      select: { chapterId: true },
    });
    if (!lesson) throw new Error('LESSON_NOT_FOUND');
    const items = await tx.courseLesson.findMany({
      where: { chapterId: lesson.chapterId },
      orderBy: { position: 'asc' },
      select: { id: true, position: true },
    });
    const index = items.findIndex((item) => item.id === input.id);
    const target = input.direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= items.length) return;
    await tx.courseLesson.update({ where: { id: items[index].id }, data: { position: -1 } });
    await tx.courseLesson.update({
      where: { id: items[target].id },
      data: { position: items[index].position },
    });
    await tx.courseLesson.update({
      where: { id: items[index].id },
      data: { position: items[target].position },
    });
  });
  return requireGraph(courseId);
}
