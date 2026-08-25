import { redirect } from 'next/navigation';
import { BookOpen } from 'lucide-react';
import { isCourseStudioSessionValid } from '@/server/auth/course-studio';
import { CourseCreationPanel } from '@/authoring/CourseCreationPanel';
import { CourseLibrary } from '@/authoring/CourseLibrary';
import { loadAuthoringLibrary } from '@/authoring/server/studio-loaders';
import { ThemeToggle } from '@/shared/theme';
import { createCourseAction } from './actions';

export default async function CourseStudioHome() {
  if (!(await isCourseStudioSessionValid())) redirect('/studio/login');
  const { courses, generations, sourceRevisions, templates, duplicationJobs } =
    await loadAuthoringLibrary();

  return (
    <main className="studio-workspace bg-background text-foreground min-h-screen px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="studio-glass mb-10 flex items-start justify-between gap-6 rounded-2xl p-6">
          <div>
            <h1 className="text-3xl font-semibold">Course Studio</h1>
            <p className="text-muted-foreground mt-2">
              Create and review e-learning experiences, using the authoring tool or sharing a master revision for client review.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <BookOpen className="text-primary h-8 w-8" aria-hidden="true" />
          </div>
        </header>
        <CourseCreationPanel
          createBlankCourse={createCourseAction}
          templates={templates}
          defaultOpen={courses.length === 0}
          generations={generations}
          sourceRevisions={sourceRevisions.map((revision) => ({
            id: revision.id,
            courseTitle: revision.course.title,
            version: revision.version,
            sourceCount: revision._count.sources,
          }))}
        />
        <section>
          <h2 className="mb-4 text-lg font-semibold">Course Library</h2>
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
            duplicationJobs={duplicationJobs}
          />
        </section>
      </div>
    </main>
  );
}
