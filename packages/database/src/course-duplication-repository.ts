import { createHash } from 'node:crypto';

import { Prisma } from '@prisma/client';
import {
  CourseDuplicateArtifactSchema,
  CourseDuplicateAssistantQaItemSchema,
  type CourseDuplicateArtifact,
} from '@moto-ai/contracts/jobs';
import { collectAssetRefs } from '@moto-ai/storage';

import { prisma } from './index';
import { courseGraphSelect, toCourseGraph } from './course-repository';

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
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
          select: { id: true },
        }),
        tx.courseSourceBinding.findMany({
          where: { courseId: sourceCourseId },
          select: { sourceFileId: true },
        }),
      ]);
      if (!course) throw new Error('COURSE_NOT_FOUND');

      const sourceIds = [
        ...new Set([
          ...ownedSources.map((source) => source.id),
          ...inheritedBindings.map((binding) => binding.sourceFileId),
        ]),
      ].sort((left, right) => left.localeCompare(right));
      const capturedSourceIds = new Set(sourceIds);
      const assistantQa = assistantQaRecords.map((record) =>
        CourseDuplicateAssistantQaItemSchema.parse({
          ...record,
          status: record.status.toLowerCase(),
        }),
      );

      for (const item of assistantQa) {
        const referencedSourceIds = new Set([
          ...item.sourceIds,
          ...item.citations.map((citation) => citation.sourceId),
        ]);
        if ([...referencedSourceIds].some((sourceId) => !capturedSourceIds.has(sourceId))) {
          throw new Error('COURSE_DUPLICATE_GROUNDING_INVALID');
        }
      }

      const graph = toCourseGraph(course);
      const assetUrls = [...new Set(collectAssetRefs({ graph, assistantQa }))].sort((left, right) =>
        left.localeCompare(right),
      );
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
