import { captureCourseDuplicateArtifact } from '@lb-studio/database';
import { enqueueCourseDuplicateJob, findExistingCourseDuplicateJob } from '@lb-studio/jobs';
import type { JobAcceptedResponse } from '@lb-studio/contracts/jobs';

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
