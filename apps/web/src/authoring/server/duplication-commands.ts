import { captureCourseDuplicateArtifact } from '@moto-ai/database';
import { enqueueCourseDuplicateJob, findExistingCourseDuplicateJob } from '@moto-ai/jobs';
import type { JobAcceptedResponse } from '@moto-ai/contracts/jobs';

export async function requestAuthoringCourseDuplication(input: {
  requestId: string;
  sourceCourseId: string;
  requestedTitle: string;
}): Promise<JobAcceptedResponse> {
  const existing = await findExistingCourseDuplicateJob({
    requestId: input.requestId,
    sourceCourseId: input.sourceCourseId,
    requestedTitle: input.requestedTitle,
  });
  if (existing) return existing;
  const artifact = await captureCourseDuplicateArtifact(input.sourceCourseId, input.requestedTitle);
  return enqueueCourseDuplicateJob({
    requestId: input.requestId,
    sourceCourseId: input.sourceCourseId,
    requestedTitle: input.requestedTitle,
    artifact,
  });
}
