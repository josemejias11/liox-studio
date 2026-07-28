import { PrismaClient } from '@prisma/client';

export {
  BackgroundJobKind,
  BackgroundJobStatus,
  CourseFeedbackStatus,
  CoursePublicationStatus,
  CourseRevisionStatus,
  Prisma,
} from '@prisma/client';
export type {
  BackgroundJob,
  Course,
  CourseAsset,
  CourseChapter,
  CourseLesson,
  CourseQuiz,
  CourseReview,
  CourseReviewFeedback,
  CourseRevision,
} from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export {
  createCourseTemplate,
  getAuthoringCourse,
  getPublishedCourseBySlug,
  listAuthoringCourses,
  listPublishedCourseSummaries,
} from './course-repository';
export type { CourseGraph, CourseGraphChapter, CourseGraphLesson } from './course-repository';
