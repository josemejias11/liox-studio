import { listAuthoringCourses } from '@moto-ai/database';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { BookOpen, Plus } from 'lucide-react';
import { COURSE_STUDIO_COOKIE, courseStudioToken } from '@/lib/course-studio-auth';
import { createCourseAction } from './actions';

function courseLibraryImageUrl(cover: unknown): string | undefined {
  if (!cover || typeof cover !== 'object' || Array.isArray(cover)) return undefined;
  const source = cover as { thumbnail?: unknown; coverImage?: unknown };
  for (const candidate of [source.thumbnail, source.coverImage]) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const asset = (candidate as { asset?: unknown }).asset;
    if (!asset || typeof asset !== 'object' || Array.isArray(asset)) continue;
    const url = (asset as { url?: unknown }).url;
    if (typeof url === 'string' && url.trim()) return url;
  }
  return undefined;
}

export default async function CourseStudioHome() {
  const expected = await courseStudioToken();
  const token = (await cookies()).get(COURSE_STUDIO_COOKIE)?.value;
  if (!expected || token !== expected) redirect('/studio/login');
  const courses = await listAuthoringCourses();
  const firstImageIndex = courses.findIndex((course) => courseLibraryImageUrl(course.cover));

  return (
    <main className="bg-background min-h-screen px-6 py-10 text-foreground">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 flex items-start justify-between gap-6">
          <div><h1 className="text-3xl font-semibold">Course Studio</h1><p className="text-muted-foreground mt-2">Create, revise, preview, and submit learning experiences for review.</p></div>
          <BookOpen className="text-primary h-8 w-8" aria-hidden="true" />
        </header>
        <section className="bg-card border-border mb-8 rounded-2xl border p-6">
          <h2 className="mb-4 text-lg font-semibold">Start a course</h2>
          <form action={createCourseAction} className="flex gap-3">
            <input className="border-input bg-background flex-1 rounded-lg border px-3 py-2" name="title" placeholder="Course title" required />
            <button className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-lg px-4 py-2 font-medium" type="submit"><Plus className="h-4 w-4" />Create course</button>
          </form>
        </section>
        <section><h2 className="mb-4 text-lg font-semibold">Your courses</h2><div className="grid gap-3 sm:grid-cols-2">
          {courses.map((course, index) => {
            const imageUrl = courseLibraryImageUrl(course.cover);
            return (
              <Link className="bg-card border-border hover:border-primary overflow-hidden rounded-xl border transition-colors" href={`/studio/${course.id}`} key={course.id}>
                <div className="bg-muted relative aspect-[16/9] w-full overflow-hidden">
                  {imageUrl ? <Image alt={course.title} className="object-cover" fill priority={index === firstImageIndex} sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw" src={imageUrl} /> : <div className="flex h-full w-full items-center justify-center"><BookOpen className="text-muted-foreground/30 h-10 w-10" /></div>}
                </div>
                <div className="p-5"><h3 className="font-semibold">{course.title}</h3><p className="text-muted-foreground mt-1 text-sm">{course.description || 'Draft course'}</p></div>
              </Link>
            );
          })}
          {courses.length === 0 && <p className="text-muted-foreground">No courses yet. Create the first one above.</p>}
        </div></section>
      </div>
    </main>
  );
}
