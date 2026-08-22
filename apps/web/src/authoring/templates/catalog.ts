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

function currentCourseTemplates(): CourseTemplateDefinition[] {
  const latestTemplates = new Map<string, CourseTemplateDefinition>();
  const templateVersions = new Set<string>();
  for (const template of [comprehensiveCourseTemplate].map(parseTemplate)) {
    const versionKey = `${template.key}:${template.version}`;
    if (templateVersions.has(versionKey)) {
      throw new Error(
        `Duplicate course template configuration for "${template.key}" version ${template.version}.`,
      );
    }
    templateVersions.add(versionKey);
    const current = latestTemplates.get(template.key);
    if (!current || template.version > current.version) latestTemplates.set(template.key, template);
  }
  return [...latestTemplates.values()];
}

export function listCourseTemplateSummaries(): CourseTemplateSummary[] {
  return currentCourseTemplates().map(({ key, version, title, description }) => ({
    key,
    version,
    title,
    description: description ?? '',
  }));
}

export function getCourseTemplate(key: string): CourseTemplateDefinition | null {
  return currentCourseTemplates().find((template) => template.key === key) ?? null;
}
