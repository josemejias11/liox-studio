import { Prisma } from '@prisma/client';
import { prisma } from './index';
import { courseGraphSelect, toCourseGraph, type CourseGraph } from './course-repository';

interface CourseRevisionSummary {
  id: string;
  version: number;
  status: string;
  notes: string | null;
  sourceHash: string;
  createdAt: Date;
  hasReview: boolean;
}

interface CourseReviewSnapshot {
  reviewId: string;
  revisionId: string;
  version: number;
  title: string;
  course: CourseGraph;
  expiresAt: Date | null;
}

interface CourseFeedbackSummary {
  id: string;
  revisionVersion: number;
  lessonId: string | null;
  authorName: string;
  message: string;
  status: string;
  createdAt: Date;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function summary(revision: {
  id: string;
  version: number;
  status: string;
  notes: string | null;
  sourceHash: string;
  createdAt: Date;
  review: unknown;
}): CourseRevisionSummary {
  return {
    id: revision.id,
    version: revision.version,
    status: revision.status,
    notes: revision.notes,
    sourceHash: revision.sourceHash,
    createdAt: revision.createdAt,
    hasReview: !!revision.review,
  };
}

export async function listCourseRevisions(courseId: string): Promise<CourseRevisionSummary[]> {
  const revisions = await prisma.courseRevision.findMany({
    where: { courseId },
    orderBy: { version: 'desc' },
    include: { review: { select: { id: true } } },
  });
  return revisions.map(summary);
}

export async function freezeCourseRevision(
  courseId: string,
  notes?: string,
): Promise<CourseRevisionSummary> {
  const revision = await prisma.$transaction(
    async (tx) => {
      const course = await tx.course.findUnique({
        where: { id: courseId },
        select: courseGraphSelect,
      });
      if (!course) throw new Error('COURSE_NOT_FOUND');

      const [ownedSources, inheritedBindings] = await Promise.all([
        tx.courseSourceFile.findMany({
          where: { courseId },
          orderBy: { id: 'asc' },
          select: { id: true, sha256: true, filename: true, indexStatus: true },
        }),
        tx.courseSourceBinding.findMany({
          where: { courseId },
          orderBy: { sourceFileId: 'asc' },
          select: {
            sourceFile: { select: { id: true, sha256: true, filename: true, indexStatus: true } },
          },
        }),
      ]);
      const sources = [
        ...ownedSources,
        ...inheritedBindings.map((binding) => binding.sourceFile),
      ].sort((left, right) => left.id.localeCompare(right.id));
      if (sources.some((source) => source.indexStatus !== 'INDEXED')) {
        throw new Error('COURSE_SOURCES_NOT_INDEXED');
      }

      const graph = toCourseGraph(course);
      const frozenSources = sources.map(({ id, sha256: sourceSha256, filename }) => ({
        sourceFileId: id,
        sha256: sourceSha256,
        filename,
      }));
      const sourceHash = await sha256(stableJson({ graph, sources: frozenSources }));
      const existing = await tx.courseRevision.findUnique({
        where: { courseId_sourceHash: { courseId, sourceHash } },
        include: { review: { select: { id: true } } },
      });
      if (existing) return existing;

      const latest = await tx.courseRevision.findFirst({
        where: { courseId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      return tx.courseRevision.create({
        data: {
          courseId,
          sourceHash,
          sourceTitle: course.title,
          version: (latest?.version ?? 0) + 1,
          status: 'IN_REVIEW',
          snapshot: graph as unknown as Prisma.InputJsonValue,
          notes: notes?.trim() || null,
          submittedAt: new Date(),
          sources: {
            create: frozenSources,
          },
        },
        include: { review: { select: { id: true } } },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  return summary(revision);
}
export async function createCourseReview(
  revisionId: string,
): Promise<{ reviewId: string; token: string }> {
  const revision = await prisma.courseRevision.findUnique({
    where: { id: revisionId },
    select: { id: true },
  });
  if (!revision) throw new Error('REVISION_NOT_FOUND');
  const token = `${crypto.randomUUID().replaceAll('-', '')}${crypto.randomUUID().replaceAll('-', '')}`;
  const accessTokenHash = await sha256(token);
  const review = await prisma.courseReview.upsert({
    where: { revisionId },
    create: { revisionId, accessTokenHash },
    update: { accessTokenHash, expiresAt: null },
    select: { id: true },
  });
  return { reviewId: review.id, token };
}

export async function getReviewByToken(token: string): Promise<CourseReviewSnapshot | null> {
  const accessTokenHash = await sha256(token);
  const review = await prisma.courseReview.findUnique({
    where: { accessTokenHash },
    include: { revision: true },
  });
  if (!review || (review.expiresAt && review.expiresAt <= new Date())) return null;
  return {
    reviewId: review.id,
    revisionId: review.revisionId,
    version: review.revision.version,
    title: review.revision.sourceTitle,
    course: review.revision.snapshot as unknown as CourseGraph,
    expiresAt: review.expiresAt,
  };
}

export async function createReviewFeedback(
  token: string,
  input: {
    authorName: string;
    message: string;
    lessonId?: string;
    anchor?: Prisma.InputJsonValue;
  },
) {
  const review = await getReviewByToken(token);
  if (!review) throw new Error('REVIEW_NOT_FOUND');
  return prisma.courseReviewFeedback.create({
    data: {
      reviewId: review.reviewId,
      authorName: input.authorName,
      message: input.message,
      lessonId: input.lessonId || null,
      ...(input.anchor !== undefined ? { anchor: input.anchor } : {}),
    },
    select: {
      id: true,
      authorName: true,
      message: true,
      lessonId: true,
      status: true,
      createdAt: true,
    },
  });
}

export async function listCourseReviewFeedback(courseId: string): Promise<CourseFeedbackSummary[]> {
  const feedback = await prisma.courseReviewFeedback.findMany({
    where: { review: { revision: { courseId } } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      lessonId: true,
      authorName: true,
      message: true,
      status: true,
      createdAt: true,
      review: { select: { revision: { select: { version: true } } } },
    },
  });
  return feedback.map((item) => ({
    id: item.id,
    revisionVersion: item.review.revision.version,
    lessonId: item.lessonId,
    authorName: item.authorName,
    message: item.message,
    status: item.status,
    createdAt: item.createdAt,
  }));
}

export async function resolveCourseReviewFeedback(
  courseId: string,
  feedbackId: string,
): Promise<void> {
  const feedback = await prisma.courseReviewFeedback.findFirst({
    where: { id: feedbackId, review: { revision: { courseId } } },
    select: { id: true },
  });
  if (!feedback) throw new Error('FEEDBACK_NOT_FOUND');
  await prisma.courseReviewFeedback.update({
    where: { id: feedbackId },
    data: { status: 'RESOLVED', resolvedAt: new Date() },
  });
}
