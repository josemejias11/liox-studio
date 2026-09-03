import { PrismaPg } from '@prisma/adapter-pg';
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
  CourseAssistantQa,
  CourseAssistantQaStatus,
  CourseChapter,
  CourseGeneration,
  CourseLesson,
  CourseLessonTrash,
  CourseQuiz,
  CourseReview,
  CourseReviewFeedback,
  CourseRevision,
  CourseRevisionSource,
  CourseRevisionAssistantQa,
  CourseSourceFile,
} from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export {
  createChapter,
  createCourseTemplate,
  createLesson,
  CourseDeleteBlockedError,
  deleteChapter,
  deleteCourse,
  duplicateLesson,
  getAuthoringCourse,
  listAuthoringCourses,
  reorderCourseItem,
  updateChapter,
  updateCourseDetails,
  updateLesson,
} from './course-repository';
export type { DeletedCourseSourceFile } from './course-repository';
export { createCourseFromTemplate } from './course-template-repository';
export {
  captureCourseDuplicateArtifact,
  findCourseCreatedByJob,
  persistDuplicatedCourse,
} from './course-duplication-repository';
export {
  emptyCourseTrash,
  listCourseTrash,
  permanentlyDeleteCourseTrashItem,
  restoreCourseTrashItem,
  trashLesson,
} from './course-trash-repository';
export {
  createCourseReview,
  createReviewFeedback,
  getReviewByToken,
  listCourseReviewFeedback,
  listCourseRevisions,
  freezeCourseRevision,
  resolveCourseReviewFeedback,
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
  CreateCourseGenerationInput,
  RequestedGenerationSource,
} from './course-generation-repository';
export {
  COURSE_LESSON_TYPES,
  COURSE_SOURCE_INDEX_STATUSES,
} from '@lb-studio/contracts/course-studio';
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
} from '@lb-studio/contracts/course-studio';
export type { CourseTrashItem } from './course-trash-repository';
export {
  removeChapterQuickCheck,
  removeFinalAssessment,
  upsertChapterQuickCheck,
  upsertFinalAssessment,
} from './course-assessment-repository';
export {
  buildOfflineAssistantPayload,
  buildFrozenOfflineAssistantPayload,
  deleteCourseAssistantQa,
  listCourseAssistantQa,
  replaceCourseAssistantQaDrafts,
  updateCourseAssistantQa,
} from './course-assistant-repository';
