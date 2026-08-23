import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { BookOpen } from 'lucide-react';
import { COURSE_STUDIO_COOKIE, courseStudioToken } from '@/server/auth/course-studio';
import { CourseCreationPanel } from '@/authoring/CourseCreationPanel';
import { CourseLibrary } from '@/authoring/CourseLibrary';
import { loadAuthoringLibrary } from '@/authoring/server/studio-loaders';
import { createCourseAction } from './actions';

export default async function CourseStudioHome() {
  const expected = await courseStudioToken();
  const token = (await cookies()).get(COURSE_STUDIO_COOKIE)?.value;
  if (!expected || token !== expected) redirect('/studio/login');
  const { courses, generations, sourceRevisions, templates, duplicationJobs } =
    await loadAuthoringLibrary();

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
        <CourseCreationPanel createBlankCourse={createCourseAction} templates={templates} />
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
            sourceRevisions={sourceRevisions.map((revision) => ({
              id: revision.id,
              courseTitle: revision.course.title,
              version: revision.version,
              sourceCount: revision._count.sources,
            }))}
            duplicationJobs={duplicationJobs}
          />
        </section>
      </div>
    </main>
  );
}
