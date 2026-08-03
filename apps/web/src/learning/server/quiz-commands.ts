import { enqueueQuizGenerationJob } from '@moto-ai/jobs';
import { resolveRevisionSources } from './revision-sources';

export async function requestRevisionBoundQuiz(input: {
  courseId: string;
  revisionId?: string;
  reviewToken?: string;
  weakTopics?: string[];
}) {
  const { revisionId, sourceIds } = await resolveRevisionSources(input as Parameters<typeof resolveRevisionSources>[0]);
  return enqueueQuizGenerationJob({
    courseId: input.courseId,
    revisionId,
    sourceIds,
    weakTopics: input.weakTopics ?? [],
  });
}
