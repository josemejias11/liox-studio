import { notFound } from 'next/navigation';
import { readClient } from '@/sanity/lib/client';
import { COURSE_BY_SLUG_QUERY } from '@/sanity/lib/queries';
import MotoViewer from '@/player/MotoViewer';
import { normalizeCourseContent } from '@/lib/course-content';

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;

  const raw = await readClient.fetch<unknown>(
    COURSE_BY_SLUG_QUERY,
    { slug: resolvedParams.slug },
    { next: { revalidate: 300 } },
  );

  if (!raw) {
    notFound();
  }

  const content = normalizeCourseContent(raw);
  if (!content) {
    console.error(`[course/${resolvedParams.slug}] Sanity payload failed contract validation`);
    notFound();
  }

  return (
    <div className="bg-background h-dvh w-full overflow-hidden">
      <MotoViewer course={content.course} sections={content.sections} />
    </div>
  );
}
