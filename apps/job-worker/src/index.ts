import { prisma } from '@moto-ai/database';
import { executeJob, isRetryableJobError } from './handlers';
import {
  claimNextJob,
  cleanupExpiredJobs,
  completeJob,
  refreshLease,
  retryOrFailJob,
} from '@moto-ai/jobs';

const POLL_INTERVAL_MS = Number(process.env.JOB_WORKER_POLL_INTERVAL_MS ?? 1_000);
const LEASE_REFRESH_INTERVAL_MS = 30_000;

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function processOneJob(): Promise<boolean> {
  const job = await claimNextJob();
  if (!job) return false;

  const initialProgress =
    job.kind === 'DOCUMENT_INDEX'
      ? 'indexing document'
      : job.kind === 'SCORM_EXPORT'
        ? 'building SCORM package'
        : job.kind === 'COURSE_DUPLICATE'
          ? 'preparing course duplication'
          : 'generating AI response';
  await refreshLease(job, initialProgress);

  const leaseRefresh = setInterval(() => {
    void refreshLease(job).catch((error) => {
      console.error(`[jobs] could not refresh lease for ${job.id}:`, error);
    });
  }, LEASE_REFRESH_INTERVAL_MS);

  try {
    const result = await executeJob(job);
    await completeJob(job, result);
  } catch (error: unknown) {
    console.error(`[jobs] ${job.id} failed:`, error);
    await retryOrFailJob(job, error, isRetryableJobError(error));
  } finally {
    clearInterval(leaseRefresh);
  }
  return true;
}

async function main(): Promise<void> {
  let cleanupAt = 0;
  while (true) {
    const processed = await processOneJob();
    if (Date.now() >= cleanupAt) {
      await cleanupExpiredJobs();
      cleanupAt = Date.now() + 60 * 60 * 1000;
    }
    if (!processed) await sleep(POLL_INTERVAL_MS);
  }
}

function shutdown(signal: string) {
  console.info(`[jobs] received ${signal}; stopping worker`);
  void prisma.$disconnect().finally(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

void main().catch(async (error) => {
  console.error('[jobs] worker crashed:', error);
  await prisma.$disconnect();
  process.exit(1);
});
