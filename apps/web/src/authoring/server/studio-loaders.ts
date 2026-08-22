import type { CourseGenerationSummary } from '@moto-ai/contracts/course-generation';
import {
  getAuthoringCourse,
  buildOfflineAssistantPayload,
  getCourseGeneration,
  listAuthoringCourses,
  listCourseRevisions,
  listCourseSources,
  listCourseTrash,
  prisma,
} from '@moto-ai/database';
import { listCourseTemplateSummaries } from '@/authoring/server/template-commands';

export async function loadAuthoringLibrary() {
  const courses = await listAuthoringCourses();
  const templates = listCourseTemplateSummaries();
  const [revisionRecords, generationRecords] = await Promise.all([
    prisma.courseRevision.findMany({
      where: { sources: { some: {} } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        version: true,
        course: { select: { title: true } },
        _count: { select: { sources: true } },
      },
    }),
    prisma.courseGeneration.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true },
    }),
  ]);
  const generationDetails = await Promise.all(
    generationRecords.map(({ id }) => getCourseGeneration(id)),
  );
  const generations: CourseGenerationSummary[] = generationDetails.flatMap((generation) =>
    generation
      ? [
          {
            id: generation.id,
            jobId: generation.jobId,
            sourceRevisionId: generation.sourceRevisionId,
            brief: generation.brief,
            promptTemplateVersion: generation.promptTemplateVersion,
            requestedSourceIds: generation.requestedSources.map((source) => source.sourceId),
            modelIdentifier: generation.modelIdentifier,
            status: generation.status,
            error: generation.error,
            createdCourseId: generation.createdCourseId,
            createdAt: generation.createdAt.toISOString(),
            updatedAt: generation.updatedAt.toISOString(),
          },
        ]
      : [],
  );
  return { courses, generations, sourceRevisions: revisionRecords, templates };
}

export async function loadAuthoringWorkspace(courseId: string) {
  const [course, sources, trash, revisions, assistant] = await Promise.all([
    getAuthoringCourse(courseId),
    listCourseSources(courseId),
    listCourseTrash(courseId),
    listCourseRevisions(courseId),
    buildOfflineAssistantPayload(courseId),
  ]);
  return { course, sources, trash, revisions, assistant };
}
