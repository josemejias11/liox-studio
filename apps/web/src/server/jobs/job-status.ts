import { JobStatusResponseSchema } from '@moto-ai/contracts/jobs';
import { getJobStatus } from '@moto-ai/jobs';

export async function getClientSafeJobStatus(id: string) {
  const job = await getJobStatus(id);
  return job ? JobStatusResponseSchema.parse(job) : null;
}
