import { notFound } from 'next/navigation';
import { getPublishedCourseBySlug } from '@moto-ai/database';
import MotoViewer from '@/player/MotoViewer';
import { toPlayerCourseContent } from '@/lib/course-player-adapter';

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;

  const course = await getPublishedCourseBySlug(resolvedParams.slug);
  if (!course) {
    notFound();
  }

  const content = toPlayerCourseContent(course);
  if (!content) {
    console.error(`[course/${resolvedParams.slug}] Course payload failed player contract validation`);
    notFound();
  }

  return (
    <div className="bg-background h-dvh w-full overflow-hidden">
      <MotoViewer course={content.course} sections={content.sections} />
    </div>
  );
}
