import { notFound, redirect } from 'next/navigation';
import { isCourseStudioSessionValid } from '@/server/auth/course-studio';
import { CourseStudioWorkspace } from '@/authoring/CourseStudioWorkspace';
import { loadAuthoringWorkspace } from '@/authoring/server/studio-loaders';

export default async function CourseWorkspace({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  if (!(await isCourseStudioSessionValid())) redirect('/studio/login');
  const courseId = (await params).courseId;
  const { course, sources, trash, revisions, assistant } = await loadAuthoringWorkspace(courseId);
  if (!course) notFound();
  return (
    <CourseStudioWorkspace
      initialCourse={course}
      initialAssistant={assistant}
      initialRevisionId={revisions[0]?.id}
      initialSources={sources}
      initialTrash={trash.map((item) => ({ ...item, deletedAt: item.deletedAt.toISOString() }))}
    />
  );
}
