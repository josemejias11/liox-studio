import { createHash } from 'node:crypto';

import { getObject, putObject } from './local-client';
import { r2KeyFor } from './asset-refs';

export interface CopiedCourseAsset {
  r2Key: string;
  filename: string;
  contentType?: string;
  byteSize: number;
  deliveryUrl: string;
}

export class CourseAssetCopyError extends Error {
  readonly destinationKeys: string[];

  constructor(message: string, destinationKeys: string[] = []) {
    super(message);
    this.name = 'CourseAssetCopyError';
    this.destinationKeys = destinationKeys;
  }
}

function safeFilename(value: string): string {
  const normalized = value.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '-');
  return normalized.replace(/-+/g, '-').replace(/^-|-$/g, '') || 'asset';
}

function deliveryUrl(r2Key: string): string {
  return `/api/course-assets/${r2Key.split('/').map(encodeURIComponent).join('/')}`;
}

function destinationKey(
  destinationCourseId: string,
  sourceKey: string,
): { key: string; filename: string } {
  const filename = safeFilename(decodeURIComponent(sourceKey.split('/').at(-1) ?? 'asset'));
  const hash = createHash('sha256').update(sourceKey).digest('hex');
  return { key: `courses/${destinationCourseId}/duplicated/${hash}-${filename}`, filename };
}

export function plannedCourseAssetDestinationKeys(input: {
  destinationCourseId: string;
  sourceUrls: Iterable<string>;
}): string[] {
  return [...new Set(input.sourceUrls)].sort().map((sourceUrl) => {
    const sourceKey = r2KeyFor(sourceUrl);
    if (!sourceKey || !sourceKey.startsWith('courses/')) {
      throw new CourseAssetCopyError(
        'A referenced course asset is invalid. Duplicate the course again.',
      );
    }
    return destinationKey(input.destinationCourseId, sourceKey).key;
  });
}

export async function copyCourseAssetRefs(input: {
  destinationCourseId: string;
  sourceUrls: Iterable<string>;
}): Promise<{
  urlMap: Map<string, string>;
  assets: CopiedCourseAsset[];
  destinationKeys: string[];
}> {
  const urlMap = new Map<string, string>();
  const assets: CopiedCourseAsset[] = [];
  const destinationKeys: string[] = [];
  const sourceUrls = [...new Set(input.sourceUrls)].sort();

  const planned = sourceUrls.map((sourceUrl) => {
    const sourceKey = r2KeyFor(sourceUrl);
    if (!sourceKey || !sourceKey.startsWith('courses/')) {
      throw new CourseAssetCopyError(
        'A referenced course asset is invalid. Duplicate the course again.',
      );
    }
    return {
      sourceUrl,
      sourceKey,
      destination: destinationKey(input.destinationCourseId, sourceKey),
    };
  });
  for (const { sourceUrl, sourceKey, destination } of planned) {
    destinationKeys.push(destination.key);
    try {
      const source = await getObject(sourceKey);
      const bytes = await source.Body.transformToByteArray();
      const contentLength = source.ContentLength;
      if (
        contentLength === undefined ||
        !Number.isSafeInteger(contentLength) ||
        contentLength < 0
      ) {
        throw new CourseAssetCopyError(
          'A referenced course asset is invalid. Duplicate the course again.',
        );
      }
      await putObject({ key: destination.key, bytes, contentType: source.ContentType });
      const url = deliveryUrl(destination.key);
      urlMap.set(sourceUrl, url);
      assets.push({
        r2Key: destination.key,
        filename: destination.filename,
        contentType: source.ContentType,
        byteSize: bytes.byteLength,
        deliveryUrl: url,
      });
    } catch (error) {
      if (error instanceof CourseAssetCopyError) {
        throw new CourseAssetCopyError(error.message, destinationKeys);
      }
      if (error instanceof Error && error.name === 'NotFound') {
        throw new CourseAssetCopyError(
          'A referenced course asset is missing. Duplicate the course again.',
          destinationKeys,
        );
      }
      throw error;
    }
  }
  return { urlMap, assets, destinationKeys };
}
