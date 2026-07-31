import type { CourseGenerationSummary } from '@moto-ai/contracts/course-generation';
import { getCourseGeneration, listAuthoringCourses, prisma } from '@moto-ai/database';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { BookOpen, Plus } from 'lucide-react';
import { COURSE_STUDIO_COOKIE, courseStudioToken } from '@/lib/course-studio-auth';
import { CourseLibrary } from '@/course-studio/CourseLibrary';
import { createCourseAction } from './actions';

export default async function CourseStudioHome() {
  const expected = await courseStudioToken();
  const token = (await cookies()).get(COURSE_STUDIO_COOKIE)?.value;
  if (!expected || token !== expected) redirect('/studio/login');
  const courses = await listAuthoringCourses();
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

  return (
    <main className="studio-workspace bg-background text-foreground min-h-screen px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="studio-glass mb-10 flex items-start justify-between gap-6 rounded-2xl p-6">
          <div>
            <h1 className="text-3xl font-semibold">Course Studio</h1>
            <p className="text-muted-foreground mt-2">
              Create and revise learning experiences, then use the author preview or share a frozen
              master revision for review.
            </p>
          </div>
          <BookOpen className="text-primary h-8 w-8" aria-hidden="true" />
        </header>
        <section className="studio-glass mb-8 rounded-2xl p-6">
          <h2 className="mb-4 text-lg font-semibold">Start a course</h2>
          <form action={createCourseAction} className="flex gap-3">
            <input
              className="border-input bg-background flex-1 rounded-lg border px-3 py-2"
              name="title"
              placeholder="Course title"
              required
            />
            <button
              className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-lg px-4 py-2 font-medium"
              type="submit"
            >
              <Plus className="h-4 w-4" />
              Create course
            </button>
          </form>
        </section>
        <section>
          <h2 className="mb-4 text-lg font-semibold">Your courses</h2>
          {courses.length === 0 && (
            <p className="text-muted-foreground mb-4">
              No courses yet. Create the first one above.
            </p>
          )}
          <CourseLibrary
            courses={courses.map((course) => ({
              ...course,
              generatedBy: course.generatedBy
                ? { ...course.generatedBy, createdAt: course.generatedBy.createdAt.toISOString() }
                : null,
            }))}
            generations={generations}
            sourceRevisions={revisionRecords.map((revision) => ({
              id: revision.id,
              courseTitle: revision.course.title,
              version: revision.version,
              sourceCount: revision._count.sources,
            }))}
          />
        </section>
      </div>
    </main>
  );
}
