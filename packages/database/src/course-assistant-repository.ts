import { Prisma } from '@prisma/client';
import {
  AssistantQaItemSchema,
  OfflineAssistantPayloadSchema,
  OFFLINE_ASSISTANT_PAYLOAD_VERSION,
  type AssistantQaItem,
  type OfflineAssistantPayload,
} from '@moto-ai/contracts';
import { prisma } from './index';

function parseItem(value: unknown): AssistantQaItem {
  return AssistantQaItemSchema.parse(value);
}

function toItem(record: {
  id: string; questionVariants: unknown; matchingKeywords: unknown; approvedAnswer: string; status: string; citations: unknown;
}): AssistantQaItem {
  return parseItem({
    id: record.id,
    questionVariants: record.questionVariants,
    matchingKeywords: record.matchingKeywords,
    approvedAnswer: record.approvedAnswer,
    status: record.status.toLowerCase(),
    citations: record.citations,
  });
}

export async function listCourseAssistantQa(courseId: string): Promise<AssistantQaItem[]> {
  const records = await prisma.courseAssistantQa.findMany({ where: { courseId }, orderBy: { updatedAt: 'desc' } });
  return records.map(toItem);
}

export async function replaceCourseAssistantQaDrafts(input: {
  courseId: string;
  sourceIds: string[];
  sourceHashes: string[];
  drafts: Omit<AssistantQaItem, 'id' | 'status'>[];
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.courseAssistantQa.deleteMany({ where: { courseId: input.courseId, status: 'DRAFT' } });
    if (input.drafts.length) await tx.courseAssistantQa.createMany({
      data: input.drafts.map((draft) => ({
        courseId: input.courseId,
        questionVariants: draft.questionVariants as Prisma.InputJsonValue,
        matchingKeywords: draft.matchingKeywords as Prisma.InputJsonValue,
        approvedAnswer: draft.approvedAnswer,
        citations: draft.citations as Prisma.InputJsonValue,
        sourceIds: input.sourceIds as Prisma.InputJsonValue,
        sourceHashes: input.sourceHashes as Prisma.InputJsonValue,
      })),
    });
  });
}

export async function updateCourseAssistantQa(
  courseId: string,
  id: string,
  input: Pick<AssistantQaItem, 'questionVariants' | 'matchingKeywords' | 'approvedAnswer' | 'citations' | 'status'>,
): Promise<AssistantQaItem> {
  const record = await prisma.courseAssistantQa.updateMany({
    where: { id, courseId },
    data: {
      questionVariants: input.questionVariants as Prisma.InputJsonValue,
      matchingKeywords: input.matchingKeywords as Prisma.InputJsonValue,
      approvedAnswer: input.approvedAnswer,
      citations: input.citations as Prisma.InputJsonValue,
      status: input.status.toUpperCase() as 'DRAFT' | 'APPROVED',
    },
  });
  if (record.count !== 1) throw new Error('ASSISTANT_QA_NOT_FOUND');
  const updated = await prisma.courseAssistantQa.findUniqueOrThrow({ where: { id } });
  return toItem(updated);
}

export async function deleteCourseAssistantQa(courseId: string, id: string): Promise<void> {
  const result = await prisma.courseAssistantQa.deleteMany({ where: { courseId, id } });
  if (result.count !== 1) throw new Error('ASSISTANT_QA_NOT_FOUND');
}

export async function buildOfflineAssistantPayload(courseId: string): Promise<OfflineAssistantPayload> {
  const items = await listCourseAssistantQa(courseId);
  return {
    version: OFFLINE_ASSISTANT_PAYLOAD_VERSION,
    items: items.filter((item) => item.status === 'approved').map(({ citations: _citations, status: _status, ...item }) => item),
  };
}

export async function buildFrozenOfflineAssistantPayload(revisionId: string): Promise<OfflineAssistantPayload> {
  const revision = await prisma.courseRevision.findUnique({
    where: { id: revisionId },
    select: { assistantSnapshot: { orderBy: { assistantQaId: 'asc' } } },
  });
  if (!revision) throw new Error('REVISION_NOT_FOUND');
  return OfflineAssistantPayloadSchema.parse({
    version: OFFLINE_ASSISTANT_PAYLOAD_VERSION,
    items: revision.assistantSnapshot.map(({ citations: _citations, ...item }) => item),
  });
}
