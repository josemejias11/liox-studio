'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COURSE_STUDIO_COOKIE, courseStudioToken } from '@/server/auth/course-studio';
import { createAuthoringCourse } from '@/authoring/server/course-commands';

export interface CreateCourseActionState {
  error: string | null;
}

export async function createCourseAction(
  _previousState: CreateCourseActionState,
  formData: FormData,
): Promise<CreateCourseActionState> {
  const expected = await courseStudioToken();
  const token = (await cookies()).get(COURSE_STUDIO_COOKIE)?.value;
  if (!expected || token !== expected) redirect('/studio/login');
  const title = formData.get('title');
  if (typeof title !== 'string' || !title.trim()) {
    return { error: 'Enter a course title to continue.' };
  }
  let course;
  try {
    course = await createAuthoringCourse(title.trim());
  } catch {
    return { error: 'We could not create that course. Please try again.' };
  }
  redirect(`/studio/${course.id}`);
}
