import type { CourseGenerationSummary } from '@moto-ai/contracts/course-generation';
import { CourseDuplicateCurrentPayloadSchema, JobStatusSchema } from '@moto-ai/contracts/jobs';
import type { JobStatus } from '@moto-ai/contracts/jobs';
import {
  BackgroundJobKind,
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

export interface CourseDuplicationJobSummary {
  id: string;
  status: JobStatus;
  progress: string | null;
  result: unknown;
  errorMessage: string | null;
  sourceCourseId: string;
  requestedTitle: string;
  createdAt: string;
  updatedAt: string;
}

export async function loadAuthoringLibrary() {
  const courses = await listAuthoringCourses();
  const templates = listCourseTemplateSummaries();
  const [revisionRecords, generationRecords, duplicationJobRecords] = await Promise.all([
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
    prisma.backgroundJob.findMany({
      where: { kind: BackgroundJobKind.COURSE_DUPLICATE },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        status: true,
        progress: true,
        result: true,
        errorMessage: true,
        payload: true,
        createdAt: true,
        updatedAt: true,
      },
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
  const duplicationJobs: CourseDuplicationJobSummary[] = duplicationJobRecords.flatMap((job) => {
    const payload = CourseDuplicateCurrentPayloadSchema.safeParse(job.payload);
    const status = JobStatusSchema.safeParse(job.status.toLowerCase());
    if (!payload.success || !status.success) return [];
    return [
      {
        id: job.id,
        status: status.data,
        progress: job.progress,
        result: job.result,
        errorMessage: job.errorMessage,
        sourceCourseId: payload.data.sourceCourseId,
        requestedTitle: payload.data.requestedTitle,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
      },
    ];
  });
  return { courses, generations, sourceRevisions: revisionRecords, templates, duplicationJobs };
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
