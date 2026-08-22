import { captureCourseDuplicateArtifact } from '@moto-ai/database';
import { enqueueCourseDuplicateJob } from '@moto-ai/jobs';
import type { JobAcceptedResponse } from '@moto-ai/contracts/jobs';

export async function requestAuthoringCourseDuplication(input: {
  requestId: string;
  sourceCourseId: string;
  requestedTitle: string;
}): Promise<JobAcceptedResponse> {
  const artifact = await captureCourseDuplicateArtifact(input.sourceCourseId, input.requestedTitle);
  return enqueueCourseDuplicateJob({
    requestId: input.requestId,
    sourceCourseId: input.sourceCourseId,
    requestedTitle: input.requestedTitle,
    artifact,
  });
}
