import { createHash } from 'node:crypto';

import { Prisma } from '@prisma/client';
import {
  CourseDuplicateArtifactSchema,
  CourseDuplicateAssistantQaItemSchema,
  type CourseDuplicateArtifact,
} from '@moto-ai/contracts/jobs';
import { courseAssetUrlSchema } from '@moto-ai/contracts';
import { collectAssetRefs } from '@moto-ai/storage';

import { prisma } from './index';
import { courseGraphSelect, toCourseGraph } from './course-repository';

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function assertCanonicalCourseAssetUrls(value: unknown): void {
  if (typeof value === 'string') {
    if (value.startsWith('/api/course-assets/') && !courseAssetUrlSchema.safeParse(value).success) {
      throw new Error('COURSE_DUPLICATE_ASSET_INVALID');
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) assertCanonicalCourseAssetUrls(item);
    return;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) {
      assertCanonicalCourseAssetUrls(item);
    }
  }
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'untitled-course'
  );
}

export async function captureCourseDuplicateArtifact(
  sourceCourseId: string,
  requestedTitle: string,
): Promise<CourseDuplicateArtifact> {
  const normalizedTitle = requestedTitle.trim();
  return prisma.$transaction(
    async (tx) => {
      const [course, assistantQaRecords, ownedSources, inheritedBindings] = await Promise.all([
        tx.course.findUnique({ where: { id: sourceCourseId }, select: courseGraphSelect }),
        tx.courseAssistantQa.findMany({
          where: { courseId: sourceCourseId, status: 'APPROVED' },
          orderBy: { id: 'asc' },
          select: {
            id: true,
            questionVariants: true,
            matchingKeywords: true,
            approvedAnswer: true,
            status: true,
            citations: true,
            sourceIds: true,
            sourceHashes: true,
          },
        }),
        tx.courseSourceFile.findMany({
          where: { courseId: sourceCourseId },
          select: { id: true, sha256: true },
        }),
        tx.courseSourceBinding.findMany({
          where: { courseId: sourceCourseId },
          select: { sourceFile: { select: { id: true, sha256: true } } },
        }),
      ]);
      if (!course) throw new Error('COURSE_NOT_FOUND');

      const sourceIdentityById = new Map<string, string>();
      for (const source of [
        ...ownedSources,
        ...inheritedBindings.map((binding) => binding.sourceFile),
      ]) {
        sourceIdentityById.set(source.id, source.sha256);
      }
      const sourceIds = [...sourceIdentityById.keys()].sort(compareCodeUnits);
      const assistantQa = assistantQaRecords.map((record) =>
        CourseDuplicateAssistantQaItemSchema.parse({
          ...record,
          status: record.status.toLowerCase(),
        }),
      );

      for (const item of assistantQa) {
        if (
          item.sourceIds.length !== item.sourceHashes.length ||
          new Set(item.sourceIds).size !== item.sourceIds.length
        ) {
          throw new Error('COURSE_DUPLICATE_GROUNDING_INVALID');
        }
        for (const [index, sourceId] of item.sourceIds.entries()) {
          if (sourceIdentityById.get(sourceId) !== item.sourceHashes[index]) {
            throw new Error('COURSE_DUPLICATE_GROUNDING_INVALID');
          }
        }
        if (item.citations.some((citation) => !item.sourceIds.includes(citation.sourceId))) {
          throw new Error('COURSE_DUPLICATE_GROUNDING_INVALID');
        }
      }

      const graph = toCourseGraph(course);
      const assetPayload = { graph, assistantQa };
      assertCanonicalCourseAssetUrls(assetPayload);
      const assetUrls = [...new Set(collectAssetRefs(assetPayload))].sort(compareCodeUnits);
      const contentHash = createHash('sha256')
        .update(
          stableJson({ graph, assistantQa, sourceIds, assetUrls, requestedTitle: normalizedTitle }),
        )
        .digest('hex');

      return CourseDuplicateArtifactSchema.parse({
        requestedTitle: normalizedTitle,
        slugBase: slugify(normalizedTitle),
        graph,
        assistantQa,
        sourceIds,
        assetUrls,
        contentHash,
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
