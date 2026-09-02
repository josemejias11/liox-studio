import { BackgroundJobKind, Prisma } from '@prisma/client';
import type {
  ChapterInput,
  CourseGraph,
  CourseLessonType,
  LessonInput,
} from '@lb-studio/contracts/course-studio';
import { prisma } from './index';

export type { CourseGraph } from '@lb-studio/contracts/course-studio';

export interface CourseDetailsInput {
  title?: string;
  slug?: string;
  description?: string | null;
  learningObjectives?: Prisma.InputJsonValue | null;
  cover?: Prisma.InputJsonValue | null;
  specifications?: Prisma.InputJsonValue | null;
  disclaimer?: Prisma.InputJsonValue | null;
  theme?: string;
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'untitled-course'
  );
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

async function courseIdForChapter(chapterId: string, expectedCourseId: string): Promise<string> {
  const chapter = await prisma.courseChapter.findUnique({
    where: { id: chapterId },
    select: { courseId: true },
  });
  if (!chapter || chapter.courseId !== expectedCourseId) throw new Error('CHAPTER_NOT_FOUND');
  return chapter.courseId;
}

async function lessonLocation(
  lessonId: string,
  expectedCourseId: string,
): Promise<{ courseId: string; chapterId: string }> {
  const lesson = await prisma.courseLesson.findUnique({
    where: { id: lessonId },
    select: { chapterId: true, chapter: { select: { courseId: true } } },
  });
  if (!lesson || lesson.chapter.courseId !== expectedCourseId) throw new Error('LESSON_NOT_FOUND');
  return { courseId: lesson.chapter.courseId, chapterId: lesson.chapterId };
}

export const courseGraphSelect = Prisma.validator<Prisma.CourseSelect>()({
  id: true,
  slug: true,
  title: true,
  description: true,
  createdFromTemplateKey: true,
  createdFromTemplateVersion: true,
  templateChecklist: true,
  creationJobId: true,
  duplicatedFromCourseId: true,
  learningObjectives: true,
  cover: true,
  specifications: true,
  disclaimer: true,
  theme: true,
  finalQuiz: {
    select: { id: true, title: true, instructions: true, payload: true },
  },
  chapters: {
    orderBy: { position: 'asc' },
    select: {
      id: true,
      title: true,
      position: true,
      estimatedDuration: true,
      lessons: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          position: true,
          lessonType: true,
          headline: true,
          body: true,
          payload: true,
        },
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

export interface AuthoringCourseSummary extends Pick<
  CourseGraph,
  'id' | 'slug' | 'title' | 'description' | 'cover'
> {
  generatedBy: {
    id: string;
    sourceRevisionId: string;
    sourceRevisionVersion: number;
    modelIdentifier: string | null;
    createdAt: Date;
  } | null;
}

export async function listAuthoringCourses(): Promise<AuthoringCourseSummary[]> {
  return prisma.course
    .findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        cover: true,
        generatedBy: {
          select: {
            id: true,
            sourceRevisionId: true,
            modelIdentifier: true,
            createdAt: true,
            sourceRevision: { select: { version: true } },
          },
        },
      },
    })
    .then((courses) =>
      courses.map((course) => ({
        ...course,
        generatedBy: course.generatedBy
          ? {
              id: course.generatedBy.id,
              sourceRevisionId: course.generatedBy.sourceRevisionId,
              sourceRevisionVersion: course.generatedBy.sourceRevision.version,
              modelIdentifier: course.generatedBy.modelIdentifier,
              createdAt: course.generatedBy.createdAt,
            }
          : null,
      })),
    );
}

export async function getAuthoringCourse(courseId: string): Promise<CourseGraph | null> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: courseGraphSelect,
  });
  return course ? toCourseGraph(course) : null;
}

export class CourseDeleteBlockedError extends Error {
  constructor() {
    super('COURSE_DELETE_BLOCKED');
    this.name = 'CourseDeleteBlockedError';
  }
}

export interface DeletedCourseSourceFile {
  id: string;
  r2Key: string;
}

// A course's own revisions can be Restrict-blocked from deletion if one was
// used as the sourceRevisionId for generating a *different* course (that FK
// is intentionally non-nullable — see CourseGeneration's schema comment).
// createdCourseId (this course being the *output* of a generation) is safe
// to detach: it only records provenance, so we null it rather than block.
export async function deleteCourse(courseId: string): Promise<DeletedCourseSourceFile[]> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { sourceFiles: { select: { id: true, r2Key: true } } },
  });
  if (!course) throw new Error('COURSE_NOT_FOUND');

  try {
    await prisma.$transaction([
      prisma.courseGeneration.updateMany({
        where: { createdCourseId: courseId },
        data: { createdCourseId: null },
      }),
      // The duplication panel links out to this course by id; once it's gone that
      // link would 404, so drop the now-stale request instead of leaving it behind.
      prisma.backgroundJob.deleteMany({
        where: {
          kind: BackgroundJobKind.COURSE_DUPLICATE,
          payload: { path: ['destinationCourseId'], equals: courseId },
        },
      }),
      prisma.course.delete({ where: { id: courseId } }),
    ]);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      throw new CourseDeleteBlockedError();
    }
    throw error;
  }

  return course.sourceFiles;
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
      ...(input.theme !== undefined ? { theme: input.theme } : {}),
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
  courseId: string,
  input: ChapterInput,
): Promise<CourseGraph> {
  await courseIdForChapter(chapterId, courseId);
  await prisma.courseChapter.update({ where: { id: chapterId }, data: input });
  return requireGraph(courseId);
}

export async function deleteChapter(chapterId: string, courseId: string): Promise<CourseGraph> {
  await courseIdForChapter(chapterId, courseId);
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
  courseId: string,
  lessonType: CourseLessonType,
): Promise<CourseGraph> {
  await courseIdForChapter(chapterId, courseId);
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
  courseId: string,
  input: LessonInput,
): Promise<CourseGraph> {
  await lessonLocation(lessonId, courseId);
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

export async function duplicateLesson(lessonId: string, courseId: string): Promise<CourseGraph> {
  const { chapterId } = await lessonLocation(lessonId, courseId);
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
        payload:
          source.payload === null ? Prisma.JsonNull : (source.payload as Prisma.InputJsonValue),
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
      select: { chapterId: true, chapter: { select: { courseId: true } } },
    });
    if (!lesson || lesson.chapter.courseId !== courseId) throw new Error('LESSON_NOT_FOUND');
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
