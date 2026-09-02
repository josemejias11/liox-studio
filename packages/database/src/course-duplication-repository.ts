import { createHash } from 'node:crypto';

import { Prisma } from '@prisma/client';
import {
  CourseDuplicateArtifactSchema,
  CourseDuplicateAssistantQaItemSchema,
  type CourseDuplicateResult,
  type CourseDuplicateArtifact,
} from '@lb-studio/contracts/jobs';
import { courseAssetUrlSchema } from '@lb-studio/contracts';
import { collectAssetRefs, rewriteAssetUrls, type CopiedCourseAsset } from '@lb-studio/storage';

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

function newId(prefix: string): string {
  return `${prefix}.${crypto.randomUUID()}`;
}

function jsonValue(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null || value === undefined ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

function remapTemplateChecklist(value: unknown, entityIds: Map<string, string>): unknown {
  if (Array.isArray(value)) return value.map((item) => remapTemplateChecklist(item, entityIds));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      key === 'entityId' && typeof item === 'string'
        ? (() => {
            const entityId = entityIds.get(item);
            if (!entityId) throw new Error('COURSE_DUPLICATE_GRAPH_INVALID');
            return entityId;
          })()
        : remapTemplateChecklist(item, entityIds),
    ]),
  );
}

function duplicateSlug(slugBase: string, destinationCourseId: string): string {
  const prefix = 'course.duplicate.';
  const requestId = destinationCourseId.startsWith(prefix)
    ? destinationCourseId.slice(prefix.length)
    : destinationCourseId;
  return `${slugify(slugBase).slice(0, 63)}-${requestId}`;
}

export async function findCourseCreatedByJob(jobId: string): Promise<CourseDuplicateResult | null> {
  const course = await prisma.course.findUnique({
    where: { creationJobId: jobId },
    select: { id: true },
  });
  return course ? { courseId: course.id } : null;
}

export async function persistDuplicatedCourse(input: {
  jobId: string;
  sourceCourseId: string;
  destinationCourseId: string;
  requestedTitle: string;
  artifact: CourseDuplicateArtifact;
  urlMap: Map<string, string>;
  assets: CopiedCourseAsset[];
}): Promise<CourseDuplicateResult> {
  const existing = await findCourseCreatedByJob(input.jobId);
  if (existing) return existing;

  const graph = rewriteAssetUrls(
    input.artifact.graph,
    input.urlMap,
  ) as CourseDuplicateArtifact['graph'];
  const assistantQa = rewriteAssetUrls(
    input.artifact.assistantQa,
    input.urlMap,
  ) as CourseDuplicateArtifact['assistantQa'];
  const chapterIds = new Map(graph.chapters.map((chapter) => [chapter.id, newId('chapter')]));
  const lessonIds = new Map(
    graph.chapters.flatMap((chapter) =>
      chapter.lessons.map((lesson) => [lesson.id, newId('lesson')] as const),
    ),
  );
  const quizIds = new Map<string, string>();
  for (const chapter of graph.chapters) {
    if (chapter.quickCheck) quizIds.set(chapter.quickCheck.id, newId('quiz'));
  }
  if (graph.finalQuiz) quizIds.set(graph.finalQuiz.id, newId('quiz'));
  const entityIds = new Map<string, string>([
    [graph.id, input.destinationCourseId],
    ...chapterIds,
    ...lessonIds,
    ...quizIds,
  ]);

  return prisma.$transaction(
    async (tx) => {
      const alreadyCreated = await tx.course.findUnique({
        where: { creationJobId: input.jobId },
        select: { id: true },
      });
      if (alreadyCreated) return { courseId: alreadyCreated.id };

      const sourceFiles = await tx.courseSourceFile.findMany({
        where: { id: { in: input.artifact.sourceIds } },
        select: { id: true, sha256: true },
      });
      if (sourceFiles.length !== input.artifact.sourceIds.length) {
        throw new Error('COURSE_DUPLICATE_GROUNDING_INVALID');
      }
      const sourceHashes = new Map(sourceFiles.map((source) => [source.id, source.sha256]));
      for (const item of assistantQa) {
        if (
          item.sourceIds.length !== item.sourceHashes.length ||
          item.sourceIds.some(
            (sourceId, index) => sourceHashes.get(sourceId) !== item.sourceHashes[index],
          ) ||
          item.citations.some((citation) => !item.sourceIds.includes(citation.sourceId))
        ) {
          throw new Error('COURSE_DUPLICATE_GROUNDING_INVALID');
        }
      }

      await tx.course.create({
        data: {
          id: input.destinationCourseId,
          title: input.requestedTitle,
          slug: duplicateSlug(input.artifact.slugBase, input.destinationCourseId),
          description: graph.description ?? null,
          learningObjectives: jsonValue(graph.learningObjectives),
          cover: jsonValue(graph.cover),
          specifications: jsonValue(graph.specifications),
          disclaimer: jsonValue(graph.disclaimer),
          theme: graph.theme,
          createdFromTemplateKey: graph.createdFromTemplateKey ?? null,
          createdFromTemplateVersion: graph.createdFromTemplateVersion ?? null,
          templateChecklist: jsonValue(remapTemplateChecklist(graph.templateChecklist, entityIds)),
          creationJobId: input.jobId,
          duplicatedFromCourseId: input.sourceCourseId,
        },
      });

      for (const chapter of graph.chapters) {
        const chapterId = chapterIds.get(chapter.id);
        if (!chapterId) throw new Error('COURSE_DUPLICATE_GRAPH_INVALID');
        await tx.courseChapter.create({
          data: {
            id: chapterId,
            courseId: input.destinationCourseId,
            title: chapter.title,
            position: chapter.position,
            estimatedDuration: chapter.estimatedDuration ?? null,
          },
        });
        for (const lesson of chapter.lessons) {
          const lessonId = lessonIds.get(lesson.id);
          if (!lessonId) throw new Error('COURSE_DUPLICATE_GRAPH_INVALID');
          await tx.courseLesson.create({
            data: {
              id: lessonId,
              chapterId,
              position: lesson.position,
              lessonType: lesson.lessonType,
              headline: lesson.headline,
              body: jsonValue(lesson.body),
              payload: jsonValue(lesson.payload),
            },
          });
        }
        if (chapter.quickCheck) {
          const quizId = quizIds.get(chapter.quickCheck.id);
          if (!quizId) throw new Error('COURSE_DUPLICATE_GRAPH_INVALID');
          await tx.courseQuiz.create({
            data: {
              id: quizId,
              courseId: input.destinationCourseId,
              title: chapter.quickCheck.title ?? null,
              instructions: chapter.quickCheck.instructions ?? null,
              payload: jsonValue(chapter.quickCheck.payload),
            },
          });
          await tx.courseChapter.update({
            where: { id: chapterId },
            data: { quickCheckId: quizId },
          });
        }
      }
      if (graph.finalQuiz) {
        const quizId = quizIds.get(graph.finalQuiz.id);
        if (!quizId) throw new Error('COURSE_DUPLICATE_GRAPH_INVALID');
        await tx.courseQuiz.create({
          data: {
            id: quizId,
            courseId: input.destinationCourseId,
            title: graph.finalQuiz.title ?? null,
            instructions: graph.finalQuiz.instructions ?? null,
            payload: jsonValue(graph.finalQuiz.payload),
          },
        });
        await tx.course.update({
          where: { id: input.destinationCourseId },
          data: { finalQuizId: quizId },
        });
      }
      if (input.assets.length) {
        await tx.courseAsset.createMany({ data: input.assets });
      }
      if (input.artifact.sourceIds.length) {
        await tx.courseSourceBinding.createMany({
          data: input.artifact.sourceIds.map((sourceFileId) => ({
            courseId: input.destinationCourseId,
            sourceFileId,
          })),
        });
      }
      if (assistantQa.length) {
        await tx.courseAssistantQa.createMany({
          data: assistantQa.map((item) => ({
            id: newId('assistant-qa'),
            courseId: input.destinationCourseId,
            questionVariants: item.questionVariants as Prisma.InputJsonValue,
            matchingKeywords: item.matchingKeywords as Prisma.InputJsonValue,
            approvedAnswer: item.approvedAnswer,
            citations: item.citations as Prisma.InputJsonValue,
            status: 'APPROVED',
            sourceIds: item.sourceIds as Prisma.InputJsonValue,
            sourceHashes: item.sourceHashes as Prisma.InputJsonValue,
          })),
        });
      }
      return { courseId: input.destinationCourseId };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
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
