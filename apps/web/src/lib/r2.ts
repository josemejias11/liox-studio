import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { CourseAssetRef } from '@moto-ai/contracts/course';

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export interface CourseAssetUpload {
  courseId: string;
  filename: string;
  contentType?: string;
  bytes: Uint8Array;
}

function getR2Config(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('Cloudflare R2 is not configured. Set the R2_* environment variables before uploading assets.');
  }

  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function createR2Client(config: R2Config): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function safeFilename(filename: string): string {
  const normalized = filename.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '-');
  return normalized.replace(/-+/g, '-').replace(/^-|-$/g, '') || 'asset';
}

export function createCourseAssetKey(courseId: string, filename: string): string {
  return `courses/${courseId}/${crypto.randomUUID()}-${safeFilename(filename)}`;
}

export function courseAssetUrl(r2Key: string): string {
  return `/api/course-assets/${r2Key.split('/').map(encodeURIComponent).join('/')}`;
}

export async function putCourseAsset(input: CourseAssetUpload): Promise<CourseAssetRef & { r2Key: string }> {
  const config = getR2Config();
  const r2Key = createCourseAssetKey(input.courseId, input.filename);
  await createR2Client(config).send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: r2Key,
      Body: input.bytes,
      ContentType: input.contentType,
    }),
  );

  return {
    id: r2Key,
    r2Key,
    url: courseAssetUrl(r2Key),
    filename: input.filename,
    contentType: input.contentType,
  };
}

export async function getCourseAsset(r2Key: string) {
  const config = getR2Config();
  return createR2Client(config).send(new GetObjectCommand({ Bucket: config.bucket, Key: r2Key }));
}

export async function deleteCourseAsset(r2Key: string): Promise<void> {
  const config = getR2Config();
  await createR2Client(config).send(new DeleteObjectCommand({ Bucket: config.bucket, Key: r2Key }));
}
