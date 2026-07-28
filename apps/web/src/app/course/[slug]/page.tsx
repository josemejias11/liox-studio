import { notFound } from 'next/navigation';
import { getPublishedCourseBySlug } from '@moto-ai/database';
import MotoViewer from '@/player/MotoViewer';
import { toPostgresCourseContent } from '@/lib/postgres-course-content';

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;

  const course = await getPublishedCourseBySlug(resolvedParams.slug);
  if (!course) {
    notFound();
  }

  const content = toPostgresCourseContent(course);
  if (!content) {
    console.error(`[course/${resolvedParams.slug}] Postgres payload failed course contract validation`);
    notFound();
  }

  return (
    <div className="bg-background h-dvh w-full overflow-hidden">
      <MotoViewer course={content.course} sections={content.sections} />
    </div>
  );
}
