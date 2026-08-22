import { createReadStream } from 'node:fs';
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { Readable } from 'node:stream';

export interface LocalStorageObject {
  Body: {
    transformToWebStream(): ReadableStream;
    transformToByteArray(): Promise<Uint8Array>;
  };
  ContentType?: string;
  ContentLength?: number;
}

interface NotFoundError extends Error {
  $metadata: { httpStatusCode: number };
}

function notFoundError(key: string): NotFoundError {
  const error = new Error(`Object not found: ${key}`) as NotFoundError;
  error.name = 'NotFound';
  error.$metadata = { httpStatusCode: 404 };
  return error;
}

function isErrnoException(error: unknown, code: string): boolean {
  return error instanceof Error && (error as NodeJS.ErrnoException).code === code;
}

function getStorageRoot(): string {
  const root = process.env.LOCAL_STORAGE_ROOT;
  if (!root) {
    throw new Error(
      'Local storage is not configured. Set LOCAL_STORAGE_ROOT before accessing storage.',
    );
  }
  return root;
}

function resolvePath(key: string): string {
  const segments = key.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error(`Invalid storage key: ${key}`);
  }
  return path.join(getStorageRoot(), ...segments);
}

function metaPath(objectPath: string): string {
  return `${objectPath}.meta.json`;
}

interface ObjectMetadata {
  contentType?: string;
}

export async function getObject(key: string): Promise<LocalStorageObject> {
  const objectPath = resolvePath(key);

  let size: number;
  try {
    size = (await stat(objectPath)).size;
  } catch (error) {
    if (isErrnoException(error, 'ENOENT')) throw notFoundError(key);
    throw error;
  }

  let contentType: string | undefined;
  try {
    const meta = JSON.parse(await readFile(metaPath(objectPath), 'utf8')) as ObjectMetadata;
    contentType = meta.contentType;
  } catch (error) {
    if (!isErrnoException(error, 'ENOENT')) throw error;
  }

  return {
    Body: {
      transformToWebStream: () => Readable.toWeb(createReadStream(objectPath)) as ReadableStream,
      transformToByteArray: () => readFile(objectPath),
    },
    ContentType: contentType,
    ContentLength: size,
  };
}

export async function putObject(input: {
  key: string;
  bytes: Uint8Array;
  contentType?: string;
}): Promise<void> {
  const objectPath = resolvePath(input.key);
  await mkdir(path.dirname(objectPath), { recursive: true });

  const tempPath = `${objectPath}.tmp-${randomUUID()}`;
  await writeFile(tempPath, input.bytes);
  await rename(tempPath, objectPath);

  const metadata: ObjectMetadata = { contentType: input.contentType };
  await writeFile(metaPath(objectPath), JSON.stringify(metadata));
}

export async function deleteObject(key: string): Promise<void> {
  const objectPath = resolvePath(key);
  await Promise.all(
    [objectPath, metaPath(objectPath)].map((target) =>
      unlink(target).catch((error) => {
        if (!isErrnoException(error, 'ENOENT')) throw error;
      }),
    ),
  );
}
