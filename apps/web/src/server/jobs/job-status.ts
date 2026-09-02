import { JobStatusResponseSchema } from '@lb-studio/contracts/jobs';
import { getJobStatus } from '@lb-studio/jobs';

export async function getClientSafeJobStatus(id: string) {
  const job = await getJobStatus(id);
  return job ? JobStatusResponseSchema.parse(job) : null;
}
