import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import archiver from 'archiver';
import { getR2Object } from '@moto-ai/storage';
import { buildImsManifest } from './manifest';
import { collectAssetRefs, rewriteAssetUrls, r2KeyFor } from './assets';

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

async function streamToBuffer(stream: { transformToByteArray(): Promise<Uint8Array> }): Promise<Buffer> {
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

  for (const assetUrl of assetUrls) {
    const r2Key = r2KeyFor(assetUrl);
    if (!r2Key) continue;
    const relativePath = `assets/${r2Key.split('/').slice(1).join('/')}`;
    urlMap.set(assetUrl, relativePath);
    const object = await getR2Object(r2Key);
    if (!object.Body) throw new Error(`Asset not found in storage: ${r2Key}`);
    assetFiles[relativePath] = await streamToBuffer(object.Body);
  }

  const rewrittenContent = rewriteAssetUrls(input.content, urlMap);
  const rewrittenAssistant = input.assistant ? rewriteAssetUrls(input.assistant, urlMap) : undefined;
  const coursePayload = JSON.stringify({ content: rewrittenContent, assistant: rewrittenAssistant ?? null });

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

  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    archive.on('data', (chunk) => chunks.push(chunk));
    archive.on('warning', (warning) => {
      if (warning.code !== 'ENOENT') reject(warning);
    });
    archive.on('error', reject);
    archive.on('end', () => {
      const buffer = Buffer.concat(chunks);
      resolve({
        buffer,
        byteSize: buffer.byteLength,
        sha256: createHash('sha256').update(buffer).digest('hex'),
      });
    });

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

    void archive.finalize();
  });
}
