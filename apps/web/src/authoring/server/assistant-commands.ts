import {
  deleteCourseAssistantQa,
  listCourseAssistantQa,
  prisma,
  updateCourseAssistantQa,
} from '@lb-studio/database';
import { enqueueAssistantQaGenerationJob } from '@lb-studio/jobs';
import type { AssistantQaItem } from '@lb-studio/contracts';

export function listAuthoringAssistantQa(courseId: string) {
  return listCourseAssistantQa(courseId);
}

export async function requestAuthoringAssistantQaDrafts(courseId: string, sourceIds: string[]) {
  const uniqueIds = [...new Set(sourceIds)].sort();
  if (!uniqueIds.length) throw new Error('ASSISTANT_QA_SOURCES_REQUIRED');
  const sources = await prisma.courseSourceFile.findMany({
    where: { courseId, id: { in: uniqueIds }, indexStatus: 'INDEXED' },
    select: { id: true, sha256: true },
  });
  if (sources.length !== uniqueIds.length) throw new Error('ASSISTANT_QA_SOURCES_NOT_INDEXED');
  return enqueueAssistantQaGenerationJob({
    courseId,
    sourceIds: uniqueIds,
    sourceHashes: uniqueIds.map((id) => sources.find((source) => source.id === id)!.sha256),
  });
}

export function updateAuthoringAssistantQa(courseId: string, id: string, input: AssistantQaItem) {
  return updateCourseAssistantQa(courseId, id, input);
}

export function deleteAuthoringAssistantQa(courseId: string, id: string) {
  return deleteCourseAssistantQa(courseId, id);
}
