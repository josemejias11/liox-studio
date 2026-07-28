import { PrismaClient } from './generated/prisma';

export {
  BackgroundJobKind,
  BackgroundJobStatus,
  CourseFeedbackStatus,
  CoursePublicationStatus,
  CourseRevisionStatus,
  Prisma,
} from './generated/prisma';
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
} from './generated/prisma';

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
} from './course-authoring';
export type { AuthoringChapter, AuthoringCourse, AuthoringLesson } from './course-authoring';
