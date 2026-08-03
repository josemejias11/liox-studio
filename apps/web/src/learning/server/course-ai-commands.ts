import { askCourseQuestion } from '@moto-ai/parser-client';
import { resolveRevisionSources } from './revision-sources';

export { RagServiceError } from '@moto-ai/parser-client';

export async function askRevisionBoundCourseQuestion(input: {
  courseId: string;
  query: string;
  revisionId?: string;
  reviewToken?: string;
}) {
  const { sourceIds } = await resolveRevisionSources(input as Parameters<typeof resolveRevisionSources>[0]);
  return askCourseQuestion(input.courseId, sourceIds, input.query);
}
