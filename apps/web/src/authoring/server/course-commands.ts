import {
  createChapter,
  createCourseReview,
  createCourseTemplate,
  createLesson,
  CourseDeleteBlockedError,
  deleteChapter,
  deleteCourse,
  duplicateLesson,
  emptyCourseTrash,
  freezeCourseRevision,
  getAuthoringCourse,
  listCourseRevisions,
  listCourseReviewFeedback,
  listCourseTrash,
  listFrozenRevisionSourceIds,
  permanentlyDeleteCourseTrashItem,
  prisma,
  reorderCourseItem,
  removeChapterQuickCheck,
  removeFinalAssessment,
  resolveCourseReviewFeedback,
  restoreCourseTrashItem,
  trashLesson,
  updateChapter,
  updateCourseDetails,
  updateLesson,
  upsertChapterQuickCheck,
  upsertFinalAssessment,
  type CourseDetailsInput,
  type CourseTrashItem,
} from '@lb-studio/database';
import { enqueueScormExportJob } from '@lb-studio/jobs';
import { deleteCourseDocument } from '@lb-studio/parser-client';
import {
  OfflineAssistantPayloadSchema,
  OFFLINE_ASSISTANT_PAYLOAD_VERSION,
  type CourseAssessmentInput,
  CourseNotReadyError,
  validateCourseReadiness,
} from '@lb-studio/contracts';
import type { JobAcceptedResponse } from '@lb-studio/contracts/jobs';
import type { CourseLessonType, LessonInput, CourseGraph } from '@lb-studio/contracts/course-studio';
import { toPlayerCourseContent } from '@/learning/course-player-adapter';
import { deleteCourseAsset } from '@/server/storage/course-assets';

function serializeCourseTrashItem(item: CourseTrashItem) {
  return { ...item, deletedAt: item.deletedAt.toISOString() };
}

export { CourseDeleteBlockedError };

export function createAuthoringCourse(title: string) {
  return createCourseTemplate(title);
}

export async function deleteAuthoringCourse(courseId: string): Promise<void> {
  const sourceFiles = await deleteCourse(courseId);
  const cleanup = await Promise.allSettled(
    sourceFiles.flatMap((source) => [
      deleteCourseAsset(source.r2Key),
      deleteCourseDocument(courseId, source.id),
    ]),
  );
  for (const result of cleanup) {
    if (result.status === 'rejected') {
      console.error('[course-studio/courses] course delete cleanup failed:', result.reason);
    }
  }
}

export function updateAuthoringCourse(courseId: string, input: unknown) {
  return updateCourseDetails(courseId, input as CourseDetailsInput);
}

export function createAuthoringChapter(courseId: string, input: { title: string }) {
  return createChapter(courseId, input);
}

export function updateAuthoringChapter(
  courseId: string,
  chapterId: string,
  input: { title?: string; estimatedDuration?: number | null },
) {
  return updateChapter(chapterId, courseId, input);
}

export function deleteAuthoringChapter(courseId: string, chapterId: string) {
  return deleteChapter(chapterId, courseId);
}

export function createAuthoringLesson(
  courseId: string,
  chapterId: string,
  lessonType: CourseLessonType,
) {
  return createLesson(chapterId, courseId, lessonType);
}

export function updateAuthoringLesson(courseId: string, lessonId: string, input: LessonInput) {
  return updateLesson(lessonId, courseId, input);
}

export function upsertAuthoringChapterQuickCheck(
  courseId: string,
  chapterId: string,
  input: CourseAssessmentInput,
) {
  return upsertChapterQuickCheck(courseId, chapterId, input);
}

export function removeAuthoringChapterQuickCheck(courseId: string, chapterId: string) {
  return removeChapterQuickCheck(courseId, chapterId);
}

export function upsertAuthoringFinalAssessment(courseId: string, input: CourseAssessmentInput) {
  return upsertFinalAssessment(courseId, input);
}

export function removeAuthoringFinalAssessment(courseId: string) {
  return removeFinalAssessment(courseId);
}

export async function deleteOrDuplicateAuthoringLesson({
  courseId,
  lessonId,
  action,
}: {
  courseId: string;
  lessonId: string;
  action: 'delete' | 'duplicate';
}) {
  if (action === 'duplicate') return { course: await duplicateLesson(lessonId, courseId) };

  const course = await getAuthoringCourse(courseId);
  const lessonExists = course?.chapters.some((chapter) =>
    chapter.lessons.some((lesson) => lesson.id === lessonId),
  );
  if (!lessonExists) throw new Error('LESSON_NOT_FOUND');

  const result = await trashLesson(lessonId);
  return {
    course: result.course,
    trashItem: serializeCourseTrashItem(result.trashItem),
    trash: result.trash.map(serializeCourseTrashItem),
  };
}

export function reorderAuthoringCourseItem(
  courseId: string,
  input: { kind: 'chapter' | 'lesson'; id: string; direction: 'up' | 'down' },
) {
  return reorderCourseItem(courseId, input);
}

export async function listAuthoringRevisions(courseId: string) {
  const revisions = await listCourseRevisions(courseId);
  return Promise.all(
    revisions.map(async (revision) => ({
      ...revision,
      sourceIds: await listFrozenRevisionSourceIds(courseId, revision.id),
    })),
  );
}

export async function createAuthoringRevision(courseId: string, notes?: string) {
  const revision = await freezeCourseRevision(
    courseId,
    notes,
    (graph) => toPlayerCourseContent(graph, { includeAnswerKey: true }) !== null,
  );
  return { ...revision, sourceIds: await listFrozenRevisionSourceIds(courseId, revision.id) };
}

export async function listAuthoringReviewFeedback(courseId: string) {
  return listCourseReviewFeedback(courseId);
}

export async function resolveAuthoringReviewFeedback(courseId: string, feedbackId: string) {
  await resolveCourseReviewFeedback(courseId, feedbackId);
}

export async function listAuthoringTrash(courseId: string) {
  return (await listCourseTrash(courseId)).map(serializeCourseTrashItem);
}

export async function emptyAuthoringTrash(courseId: string) {
  await emptyCourseTrash(courseId);
}

export async function restoreAuthoringTrashItem(courseId: string, trashId: string) {
  const result = await restoreCourseTrashItem(courseId, trashId);
  return {
    course: result.course,
    restoredLessonId: result.restoredLessonId,
    trash: result.trash.map(serializeCourseTrashItem),
  };
}

export async function permanentlyDeleteAuthoringTrashItem(courseId: string, trashId: string) {
  const exists = (await listCourseTrash(courseId)).some((item) => item.id === trashId);
  if (!exists) throw new Error('TRASH_ITEM_NOT_FOUND');
  return (await permanentlyDeleteCourseTrashItem(courseId, trashId)).map(serializeCourseTrashItem);
}

export function createAuthoringReview(revisionId: string) {
  return createCourseReview(revisionId);
}

export async function requestScormExport(revisionId: string): Promise<JobAcceptedResponse> {
  const revision = await prisma.courseRevision.findUnique({
    where: { id: revisionId },
    include: { assistantSnapshot: true },
  });
  if (!revision) throw new Error('REVISION_NOT_FOUND');

  const graph = revision.snapshot as unknown as CourseGraph;
  const readinessIssues = validateCourseReadiness(graph);
  if (readinessIssues.length > 0) throw new CourseNotReadyError(readinessIssues);
  const content = toPlayerCourseContent(graph, { includeAnswerKey: true });
  if (!content) throw new Error('REVISION_CONTENT_INVALID');

  const assistant =
    revision.assistantSnapshot.length > 0
      ? OfflineAssistantPayloadSchema.parse({
          version: OFFLINE_ASSISTANT_PAYLOAD_VERSION,
          items: revision.assistantSnapshot.map(
            ({ assistantQaId, citations: _citations, ...item }) => ({
              id: assistantQaId,
              ...item,
            }),
          ),
        })
      : undefined;

  const finalQuizPassingScore =
    graph.finalQuiz && typeof graph.finalQuiz.payload === 'object' && graph.finalQuiz.payload
      ? (graph.finalQuiz.payload as { passingScore?: number }).passingScore
      : undefined;

  return enqueueScormExportJob({
    revisionId,
    content,
    assistant,
    masteryScore: finalQuizPassingScore ?? 80,
  });
}
