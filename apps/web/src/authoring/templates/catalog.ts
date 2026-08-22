import { CourseTemplateDefinitionSchema, type CourseTemplateDefinition } from '@moto-ai/contracts';
import { comprehensiveCourseTemplate } from './comprehensive-course';

export interface CourseTemplateSummary {
  key: string;
  version: number;
  title: string;
  description: string;
}

function parseTemplate(definition: unknown): CourseTemplateDefinition {
  const parsed = CourseTemplateDefinitionSchema.safeParse(definition);
  if (parsed.success) return parsed.data;
  const key =
    definition !== null &&
    typeof definition === 'object' &&
    typeof (definition as { key?: unknown }).key === 'string'
      ? (definition as { key: string }).key
      : 'unknown';
  throw new Error(`Invalid course template configuration for "${key}".`);
}

const courseTemplates = [comprehensiveCourseTemplate].map(parseTemplate);

export function listCourseTemplateSummaries(): CourseTemplateSummary[] {
  return courseTemplates.map(({ key, version, title, description }) => ({
    key,
    version,
    title,
    description: description ?? '',
  }));
}

export function getCourseTemplate(key: string): CourseTemplateDefinition | null {
  return courseTemplates.find((template) => template.key === key) ?? null;
}
