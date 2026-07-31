import { PrismaClient } from '@prisma/client';

export {
  BackgroundJobKind,
  BackgroundJobStatus,
  CourseFeedbackStatus,
  CourseGenerationStatus,
  CourseRevisionStatus,
  CourseSourceIndexStatus,
  Prisma,
} from '@prisma/client';
export type {
  BackgroundJob,
  Course,
  CourseAsset,
  CourseChapter,
  CourseGeneration,
  CourseLesson,
  CourseLessonTrash,
  CourseQuiz,
  CourseReview,
  CourseReviewFeedback,
  CourseRevision,
  CourseRevisionSource,
  CourseSourceFile,
} from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export {
  createChapter,
  createCourseTemplate,
  createLesson,
  deleteChapter,
  duplicateLesson,
  getAuthoringCourse,
  listAuthoringCourses,
  reorderCourseItem,
  updateChapter,
  updateCourseDetails,
  updateLesson,
} from './course-repository';
export {
  emptyCourseTrash,
  listCourseTrash,
  permanentlyDeleteCourseTrashItem,
  restoreCourseTrashItem,
  trashLesson,
} from './course-trash-repository';
export {
  createCourseReview,
  createCourseRevision,
  createReviewFeedback,
  getReviewByToken,
  listCourseReviewFeedback,
  listCourseRevisions,
  freezeCourseRevision,
  resolveCourseReviewFeedback,
} from './course-review-repository';
export type {
  CourseFeedbackSummary,
  CourseReviewSnapshot,
  CourseRevisionSummary,
} from './course-review-repository';
export type { CourseDetailsInput } from './course-repository';
export type { AuthoringCourseSummary } from './course-repository';
export {
  beginCourseSourceRemoval,
  completeCourseSourceRemoval,
  createPendingSource,
  getCourseSource,
  listCourseSources,
  listFrozenRevisionSourceIds,
  listRevisionSources,
  markSourceFailed,
  markSourceIndexed,
  retryCourseSourceIndex,
} from './course-source-repository';
export type { CreatePendingSourceInput } from './course-source-repository';
export {
  createCourseGeneration,
  getCourseGeneration,
  markCourseGenerationFailed,
  markCourseGenerationRunning,
  markCourseGenerationSucceeded,
  persistGeneratedCourse,
} from './course-generation-repository';
export type {
  CourseGenerationRecord,
  CourseGenerationStatus as CourseGenerationRecordStatus,
  CreateCourseGenerationInput,
  RequestedGenerationSource,
} from './course-generation-repository';
export {
  COURSE_LESSON_TYPES,
  COURSE_SOURCE_INDEX_STATUSES,
} from '@moto-ai/contracts/course-studio';
export type {
  ChapterInput,
  CourseGraph,
  CourseGraphChapter,
  CourseGraphLesson,
  CourseLessonType,
  CourseRevisionSource as CourseRevisionSourceContract,
  CourseSourceFile as CourseSourceFileContract,
  CourseSourceIndexStatus as CourseSourceIndexStatusContract,
  LessonInput,
} from '@moto-ai/contracts/course-studio';
export type {
  CourseTrashItem,
  RestoreTrashItemResult,
  TrashLessonResult,
} from './course-trash-repository';
