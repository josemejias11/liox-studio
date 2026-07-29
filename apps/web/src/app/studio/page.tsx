import { listAuthoringCourses } from '@moto-ai/database';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { COURSE_STUDIO_COOKIE, courseStudioToken } from '@/lib/course-studio-auth';
import { CourseLibrary } from '@/course-studio/CourseLibrary';
import { createCourseAction } from './actions';

export default async function CourseStudioHome() {
  const expected = await courseStudioToken();
  const token = (await cookies()).get(COURSE_STUDIO_COOKIE)?.value;
  if (!expected || token !== expected) redirect('/studio/login');
  const courses = await listAuthoringCourses();

  return (
    <main className="bg-background min-h-screen px-6 py-10 text-foreground">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10">
          <div><h1 className="text-3xl font-semibold">Course Studio</h1><p className="text-muted-foreground mt-2">Create, revise, preview, and submit learning experiences for review.</p></div>
        </header>
        <section className="bg-card border-border mb-8 rounded-2xl border p-6">
          <h2 className="mb-4 text-lg font-semibold">Start a course</h2>
          <form action={createCourseAction} className="flex gap-3">
            <input className="border-input bg-background flex-1 rounded-lg border px-3 py-2" name="title" placeholder="Course title" required />
            <button className="bg-primary text-primary-foreground inline-flex items-center rounded-lg px-4 py-2 font-medium" type="submit">Create course</button>
          </form>
        </section>
        <section>
          <h2 className="mb-4 text-lg font-semibold">Your courses</h2>
          {courses.length === 0 ? (
            <p className="text-muted-foreground">No courses yet. Create the first one above.</p>
          ) : (
            <CourseLibrary courses={courses} />
          )}
        </section>
      </div>
    </main>
  );
}
