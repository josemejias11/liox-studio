import { createCourseFromTemplate } from '@lb-studio/database';
import { getCourseTemplate, listCourseTemplateSummaries } from '@/authoring/templates/catalog';

export { listCourseTemplateSummaries };

export async function createAuthoringCourseFromTemplate(templateKey: string, title: string) {
  const template = getCourseTemplate(templateKey);
  if (!template) throw new Error('COURSE_TEMPLATE_NOT_FOUND');
  return createCourseFromTemplate(template, title);
}
