import { createWriteStream } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZipArchive } from 'archiver';
import { getObject } from '@lb-studio/storage';
import { buildImsManifest } from './manifest';
import { collectAssetRefs, rewriteAssetUrls, r2KeyFor } from './assets';

// Thrown when a course-referenced asset is missing from storage at export time. Distinguished
// from a generic Error so callers (the job-worker handler) can treat this as non-retryable and
// show the author a clean, actionable message instead of burning retries re-fetching every
// other already-successfully-fetched asset on a failure that retrying can't fix.
export class AssetNotFoundError extends Error {
  constructor(public readonly r2Key: string) {
    super(`Asset not found in storage: ${r2Key}`);
    this.name = 'AssetNotFoundError';
  }
}

const MAX_EXPORT_ASSET_BYTES = 500 * 1024 * 1024; // 500 MB, matches this app's course-media scale today

export class ExportTooLargeError extends Error {
  constructor(public readonly totalBytes: number) {
    super(
      `Course media totals ${totalBytes} bytes, exceeding the ${MAX_EXPORT_ASSET_BYTES}-byte export limit`,
    );
    this.name = 'ExportTooLargeError';
  }
}

function isNotFoundError(error: unknown): boolean {
  return (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode === 404;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = path.join(__dirname, '..', 'static');
const XSD_FILES = [
  'adlcp_rootv1p2.xsd',
  'imscp_rootv1p1p2.xsd',
  'imsmd_rootv1p2p1.xsd',
  'ims_xml.xsd',
];

export interface ScormPackageInput {
  title: string;
  scoIdentifier: string;
  masteryScore: number;
  /** The full { course, sections } content JSON, already answer-key-included. */
  content: unknown;
  /** The frozen OfflineAssistantPayload, or undefined if the course has none. */
  assistant: unknown;
  /** Prebuilt player bundle files, keyed by their in-zip relative path. */
  playerBundle: Record<string, Buffer>;
}

async function streamToBuffer(stream: {
  transformToByteArray(): Promise<Uint8Array>;
}): Promise<Buffer> {
  return Buffer.from(await stream.transformToByteArray());
}

export async function buildScormPackage(input: ScormPackageInput): Promise<{
  buffer: Buffer;
  byteSize: number;
  sha256: string;
}> {
  const assetUrls = collectAssetRefs(input.content);
  const urlMap = new Map<string, string>();
  const assetFiles: Record<string, Buffer> = {};
  let totalAssetBytes = 0;

  for (const assetUrl of assetUrls) {
    const r2Key = r2KeyFor(assetUrl);
    if (!r2Key) continue;
    const relativePath = `assets/${r2Key.split('/').slice(1).join('/')}`;
    urlMap.set(assetUrl, relativePath);
    let object: Awaited<ReturnType<typeof getObject>>;
    try {
      object = await getObject(r2Key);
    } catch (error) {
      if (isNotFoundError(error)) throw new AssetNotFoundError(r2Key);
      throw error;
    }
    if (!object.Body) throw new AssetNotFoundError(r2Key);
    totalAssetBytes += object.ContentLength ?? 0;
    if (totalAssetBytes > MAX_EXPORT_ASSET_BYTES) throw new ExportTooLargeError(totalAssetBytes);
    assetFiles[relativePath] = await streamToBuffer(object.Body);
  }

  const rewrittenContent = rewriteAssetUrls(input.content, urlMap);
  const rewrittenAssistant = input.assistant
    ? rewriteAssetUrls(input.assistant, urlMap)
    : undefined;
  const coursePayload = JSON.stringify({
    content: rewrittenContent,
    assistant: rewrittenAssistant ?? null,
  });

  const entryHref = 'index_lms.html';
  const fileHrefs = [
    ...Object.keys(input.playerBundle),
    ...Object.keys(assetFiles),
    'meta.xml',
  ].sort();

  const manifest = buildImsManifest({
    title: input.title,
    scoIdentifier: input.scoIdentifier,
    masteryScore: input.masteryScore,
    entryHref,
    fileHrefs: [entryHref, ...fileHrefs],
  });

  const tempDir = await mkdtemp(path.join(tmpdir(), 'scorm-export-'));
  const tempZipPath = path.join(tempDir, 'package.zip');

  try {
    await new Promise<void>((resolve, reject) => {
      const archive = new ZipArchive({ zlib: { level: 9 } });
      const output = createWriteStream(tempZipPath);
      archive.pipe(output);
      archive.on('warning', (warning) => {
        if (warning.code !== 'ENOENT') reject(warning);
      });
      archive.on('error', reject);
      output.on('error', reject);
      output.on('close', resolve);

      archive.append(manifest, { name: 'imsmanifest.xml' });
      for (const filename of XSD_FILES) {
        archive.file(path.join(STATIC_DIR, filename), { name: filename });
      }
      for (const [relativePath, buffer] of Object.entries(input.playerBundle)) {
        archive.append(buffer, { name: relativePath });
      }
      for (const [relativePath, buffer] of Object.entries(assetFiles)) {
        archive.append(buffer, { name: relativePath });
      }
      archive.append(
        `<?xml version="1.0" encoding="utf-8"?><meta><project title="${input.title.replace(/[<>&"']/g, '')}" datepublished="${new Date().toISOString()}" /></meta>`,
        { name: 'meta.xml' },
      );
      archive.append(
        `<!doctype html>\n<html><head><meta charset="utf-8" /><title>${input.title.replace(/[<>&]/g, '')}</title><meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'"><link rel="stylesheet" href="player.css" /></head><body><div id="app"></div><script id="course-data" type="application/json">${coursePayload.replace(/</g, '\\u003c')}</script><script src="player.js"></script></body></html>\n`,
        { name: entryHref },
      );

      // archiver v8's finalize() returns a promise that rejects on the same errors already
      // surfaced through the 'error' event above (which calls reject()); swallow it here so
      // that rejection doesn't also surface as an unhandled promise rejection.
      archive.finalize().catch(() => {});
    });

    const buffer = await readFile(tempZipPath);
    return {
      buffer,
      byteSize: buffer.byteLength,
      sha256: createHash('sha256').update(buffer).digest('hex'),
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
