import { Prisma } from '@prisma/client';
import { prisma } from './index';

export interface CourseGraphLesson {
  id: string;
  position: number;
  lessonType: string;
  headline: string;
  body: Prisma.JsonValue | null;
  payload: Prisma.JsonValue;
}

export interface CourseGraphChapter {
  id: string;
  title: string;
  position: number;
  estimatedDuration: number | null;
  lessons: CourseGraphLesson[];
  quickCheck: {
    id: string;
    title: string | null;
    instructions: string | null;
    payload: Prisma.JsonValue;
  } | null;
}

export interface CourseGraph {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  courseMode: string;
  learningObjectives: Prisma.JsonValue | null;
  cover: Prisma.JsonValue | null;
  specifications: Prisma.JsonValue | null;
  disclaimer: Prisma.JsonValue | null;
  sourceFiles: Prisma.JsonValue | null;
  chapters: CourseGraphChapter[];
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

function toCourseGraph(course: {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  courseMode: string;
  learningObjectives: Prisma.JsonValue | null;
  cover: Prisma.JsonValue | null;
  specifications: Prisma.JsonValue | null;
  disclaimer: Prisma.JsonValue | null;
  sourceFiles: Prisma.JsonValue | null;
  chapters: Array<CourseGraphChapter>;
}): CourseGraph {
  return course;
}

export async function listAuthoringCourses(): Promise<Array<Pick<CourseGraph, 'id' | 'slug' | 'title' | 'description' | 'courseMode'>>> {
  return prisma.course.findMany({
    orderBy: { updatedAt: 'desc' },
    select: { id: true, slug: true, title: true, description: true, courseMode: true },
  });
}

export async function getAuthoringCourse(courseId: string): Promise<CourseGraph | null> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      courseMode: true,
      learningObjectives: true,
      cover: true,
      specifications: true,
      disclaimer: true,
      sourceFiles: true,
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
    },
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
      courseMode: 'standard',
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

export async function listPublishedCourseSummaries() {
  return prisma.course.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      slug: true,
      title: true,
      courseMode: true,
      description: true,
      learningObjectives: true,
      cover: true,
      _count: { select: { chapters: true } },
    },
  });
}

export async function getPublishedCourseBySlug(slug: string): Promise<CourseGraph | null> {
  const course = await prisma.course.findFirst({
    where: { slug, status: 'PUBLISHED' },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      courseMode: true,
      learningObjectives: true,
      cover: true,
      specifications: true,
      disclaimer: true,
      sourceFiles: true,
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
    },
  });
  return course ? toCourseGraph(course) : null;
}
