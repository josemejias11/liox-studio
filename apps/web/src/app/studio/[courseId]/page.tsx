import { getAuthoringCourse } from '@moto-ai/database';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { COURSE_STUDIO_COOKIE, courseStudioToken } from '@/lib/course-studio-auth';
import { toPlayerPreview } from '@/lib/authoring-preview';
import { AuthoringPreview } from '@/course-studio/AuthoringPreview';

export default async function CourseWorkspace({ params }: { params: Promise<{ courseId: string }> }) {
  const expected = await courseStudioToken();
  const token = (await cookies()).get(COURSE_STUDIO_COOKIE)?.value;
  if (!expected || token !== expected) redirect('/studio/login');
  const course = await getAuthoringCourse((await params).courseId);
  if (!course) notFound();
  const preview = toPlayerPreview(course);
  return <main className="bg-background min-h-screen px-6 py-10 text-foreground"><div className="mx-auto max-w-5xl"><Link className="text-primary text-sm" href="/studio">← All courses</Link><h1 className="mt-5 text-3xl font-semibold">{course.title}</h1><p className="text-muted-foreground mt-2">Authoring workspace</p><div className="mt-8 grid gap-5 lg:grid-cols-[18rem_1fr]"><aside className="bg-card border-border rounded-xl border p-5"><h2 className="font-semibold">Course outline</h2>{course.chapters.map((chapter) => <div className="mt-4" key={chapter.id}><h3 className="font-medium">{chapter.title}</h3><ul className="text-muted-foreground mt-2 space-y-1 text-sm">{chapter.lessons.map((lesson) => <li key={lesson.id}>{lesson.headline}</li>)}</ul></div>)}</aside><section className="bg-card border-border rounded-xl border p-6"><h2 className="mb-4 font-semibold">Player preview</h2>{preview ? <AuthoringPreview content={preview} /> : <p className="text-muted-foreground">This course has invalid authored content and cannot be previewed yet.</p>}</section></div></div></main>;
}
