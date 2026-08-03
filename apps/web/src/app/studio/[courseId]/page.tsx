import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { COURSE_STUDIO_COOKIE, courseStudioToken } from '@/server/auth/course-studio';
import { CourseStudioWorkspace } from '@/authoring/CourseStudioWorkspace';
import { loadAuthoringWorkspace } from '@/authoring/server/studio-loaders';

export default async function CourseWorkspace({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const expected = await courseStudioToken();
  const token = (await cookies()).get(COURSE_STUDIO_COOKIE)?.value;
  if (!expected || token !== expected) redirect('/studio/login');
  const courseId = (await params).courseId;
  const { course, sources, trash, revisions } = await loadAuthoringWorkspace(courseId);
  if (!course) notFound();
  return (
    <CourseStudioWorkspace
      initialCourse={course}
      initialRevisionId={revisions[0]?.id}
      initialSources={sources}
      initialTrash={trash.map((item) => ({ ...item, deletedAt: item.deletedAt.toISOString() }))}
    />
  );
}
