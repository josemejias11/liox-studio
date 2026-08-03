import { getReviewByToken, listFrozenRevisionSourceIds } from '@moto-ai/database';

type RevisionBoundInput =
  | { courseId: string; revisionId: string; reviewToken?: never }
  | { courseId: string; reviewToken: string; revisionId?: never };

export async function resolveRevisionSources(input: RevisionBoundInput) {
  if (typeof input.reviewToken === 'string') {
    const review = await getReviewByToken(input.reviewToken);
    if (!review) throw new Error('REVIEW_NOT_FOUND');
    if (review.course.id !== input.courseId) throw new Error('REVISION_COURSE_MISMATCH');
    return {
      revisionId: review.revisionId,
      sourceIds: await listFrozenRevisionSourceIds(input.courseId, review.revisionId),
    };
  }
  return {
    revisionId: input.revisionId,
    sourceIds: await listFrozenRevisionSourceIds(input.courseId, input.revisionId),
  };
}
