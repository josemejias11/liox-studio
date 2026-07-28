'use server';

import { createCourseTemplate } from '@moto-ai/database';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COURSE_STUDIO_COOKIE, courseStudioToken } from '@/lib/course-studio-auth';

export async function createCourseAction(formData: FormData): Promise<void> {
  const expected = await courseStudioToken();
  const token = (await cookies()).get(COURSE_STUDIO_COOKIE)?.value;
  if (!expected || token !== expected) redirect('/studio/login');
  const title = formData.get('title');
  if (typeof title !== 'string' || !title.trim()) redirect('/studio?error=title');
  const course = await createCourseTemplate(title.trim());
  redirect(`/studio/${course.id}`);
}
