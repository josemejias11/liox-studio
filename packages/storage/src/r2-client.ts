import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type GetObjectCommandOutput,
} from '@aws-sdk/client-s3';

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

function getR2Config(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      'Cloudflare R2 is not configured. Set the R2_* environment variables before accessing storage.',
    );
  }

  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function createR2Client(): S3Client {
  const config = getR2Config();
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function bucketName(): string {
  return getR2Config().bucket;
}

export async function getR2Object(key: string): Promise<GetObjectCommandOutput> {
  return createR2Client().send(new GetObjectCommand({ Bucket: bucketName(), Key: key }));
}

export async function putR2Object(input: {
  key: string;
  bytes: Uint8Array;
  contentType?: string;
}): Promise<void> {
  await createR2Client().send(
    new PutObjectCommand({
      Bucket: bucketName(),
      Key: input.key,
      Body: input.bytes,
      ContentType: input.contentType,
    }),
  );
}

export async function deleteR2Object(key: string): Promise<void> {
  await createR2Client().send(new DeleteObjectCommand({ Bucket: bucketName(), Key: key }));
}
