// One-time migration: copies every object currently referenced by CourseAsset,
// CourseSourceFile, and CourseScormExport from the (soon to be cancelled) Cloudflare
// R2 bucket down to LOCAL_STORAGE_ROOT, verifying byte size and, where the DB row has
// one, sha256. Purely additive against R2 — it never deletes or modifies anything
// there. Deleting the R2 bucket contents stays a manual step after reviewing this
// script's summary output.
//
// The R2 read client is intentionally inlined here rather than imported from
// @moto-ai/storage, since that package's public surface has already moved to the
// local-filesystem backend. This script (and its @aws-sdk/client-s3 dependency, still
// declared on packages/storage until this has been run once) is the last piece of the
// codebase that still talks to R2 at all.
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { loadEnvConfig } from '@next/env';
import { prisma } from '@moto-ai/database';

const REQUIRED_ENVIRONMENT_VARIABLES = [
  'DATABASE_URL',
  'LOCAL_STORAGE_ROOT',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
] as const;

interface MigrationRow {
  table: 'CourseAsset' | 'CourseSourceFile' | 'CourseScormExport';
  r2Key: string;
  byteSize: number | null;
  sha256: string | null;
  contentType: string | null;
}

interface RowResult {
  row: MigrationRow;
  status: 'migrated' | 'skipped-already-present' | 'failed';
  detail?: string;
}

function createR2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

function localObjectPath(key: string): string {
  return path.join(process.env.LOCAL_STORAGE_ROOT!, ...key.split('/'));
}

function localMetaPath(objectPath: string): string {
  return `${objectPath}.meta.json`;
}

async function loadRows(): Promise<MigrationRow[]> {
  const [assets, sources, exports_] = await Promise.all([
    prisma.courseAsset.findMany({
      select: { r2Key: true, byteSize: true, contentType: true },
    }),
    prisma.courseSourceFile.findMany({
      select: { r2Key: true, byteSize: true, sha256: true, contentType: true },
    }),
    prisma.courseScormExport.findMany({
      select: { r2Key: true, byteSize: true, sha256: true },
    }),
  ]);

  return [
    ...assets.map((row): MigrationRow => ({
      table: 'CourseAsset',
      r2Key: row.r2Key,
      byteSize: row.byteSize,
      sha256: null,
      contentType: row.contentType,
    })),
    ...sources.map((row): MigrationRow => ({
      table: 'CourseSourceFile',
      r2Key: row.r2Key,
      byteSize: row.byteSize,
      sha256: row.sha256,
      contentType: row.contentType,
    })),
    ...exports_.map((row): MigrationRow => ({
      table: 'CourseScormExport',
      r2Key: row.r2Key,
      byteSize: row.byteSize,
      sha256: row.sha256,
      contentType: 'application/zip',
    })),
  ];
}

async function alreadyMigrated(row: MigrationRow, objectPath: string): Promise<boolean> {
  let stats: Awaited<ReturnType<typeof stat>>;
  try {
    stats = await stat(objectPath);
  } catch {
    return false;
  }
  if (row.byteSize !== null && stats.size !== row.byteSize) return false;
  if (row.sha256) {
    const bytes = await readFile(objectPath);
    if (createHash('sha256').update(bytes).digest('hex') !== row.sha256) return false;
  }
  return true;
}

async function migrateRow(client: S3Client, row: MigrationRow): Promise<RowResult> {
  const objectPath = localObjectPath(row.r2Key);

  if (await alreadyMigrated(row, objectPath)) {
    return { row, status: 'skipped-already-present' };
  }

  try {
    const response = await client.send(
      new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: row.r2Key }),
    );
    if (!response.Body) throw new Error('R2 returned no object body');
    const bytes = Buffer.from(await response.Body.transformToByteArray());

    if (row.byteSize !== null && bytes.byteLength !== row.byteSize) {
      throw new Error(`byte size mismatch: expected ${row.byteSize}, got ${bytes.byteLength}`);
    }
    if (row.sha256) {
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      if (sha256 !== row.sha256) {
        throw new Error(`sha256 mismatch: expected ${row.sha256}, got ${sha256}`);
      }
    }

    await mkdir(path.dirname(objectPath), { recursive: true });
    const tempPath = `${objectPath}.tmp-${randomUUID()}`;
    await writeFile(tempPath, bytes);
    await rename(tempPath, objectPath);
    await writeFile(
      localMetaPath(objectPath),
      JSON.stringify({ contentType: row.contentType ?? response.ContentType }),
    );

    return { row, status: 'migrated' };
  } catch (error) {
    return {
      row,
      status: 'failed',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());

  const missing = REQUIRED_ENVIRONMENT_VARIABLES.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const rows = await loadRows();
  console.log(
    `Found ${rows.length} object(s) referenced across CourseAsset, CourseSourceFile, and CourseScormExport.`,
  );

  const client = createR2Client();
  const results: RowResult[] = [];
  for (const row of rows) {
    const result = await migrateRow(client, row);
    results.push(result);
    console.log(
      `${result.status.padEnd(24)} ${row.table.padEnd(18)} ${row.r2Key}${result.detail ? ` — ${result.detail}` : ''}`,
    );
  }

  const migrated = results.filter((r) => r.status === 'migrated');
  const skipped = results.filter((r) => r.status === 'skipped-already-present');
  const failed = results.filter((r) => r.status === 'failed');
  const bytesTransferred = migrated.reduce((sum, r) => sum + (r.row.byteSize ?? 0), 0);

  console.log('');
  console.log('--- Summary ---');
  console.log(`Total objects:        ${results.length}`);
  console.log(
    `Migrated now:         ${migrated.length} (${bytesTransferred.toLocaleString()} bytes)`,
  );
  console.log(`Already present:      ${skipped.length}`);
  console.log(`Failed:               ${failed.length}`);

  if (failed.length > 0) {
    console.log('');
    console.log('Failures:');
    for (const result of failed) {
      console.log(`  ${result.row.table} ${result.row.r2Key} — ${result.detail}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('');
  console.log('All objects verified on local disk. R2 has not been modified — delete the bucket');
  console.log('contents / cancel the subscription manually once you are satisfied.');
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Migration failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
