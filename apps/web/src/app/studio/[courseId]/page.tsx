import {
  getAuthoringCourse,
  listCourseTrash,
} from '@moto-ai/database';
import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { COURSE_STUDIO_COOKIE, courseStudioToken } from '@/lib/course-studio-auth';
import { CourseStudioWorkspace } from '@/course-studio/CourseStudioWorkspace';

export default async function CourseWorkspace({ params }: { params: Promise<{ courseId: string }> }) {
  const expected = await courseStudioToken();
  const token = (await cookies()).get(COURSE_STUDIO_COOKIE)?.value;
  if (!expected || token !== expected) redirect('/studio/login');
  const courseId = (await params).courseId;
  const [course, trash] = await Promise.all([
    getAuthoringCourse(courseId),
    listCourseTrash(courseId),
  ]);
  if (!course) notFound();
  return (
    <CourseStudioWorkspace
      initialCourse={course}
      initialTrash={trash.map((item) => ({ ...item, deletedAt: item.deletedAt.toISOString() }))}
    />
  );
}
