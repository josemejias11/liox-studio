import { z } from 'zod';

import { CourseImageReferenceSchema } from '@lb-studio/contracts/course-assets';
import { courseThemeSchema, DEFAULT_COURSE_THEME } from '@lb-studio/contracts/course-themes';

export type JsonObject = Record<string, unknown>;

const coverButtonColorSchema = z.enum(['primary', 'secondary', 'tertiary']);
export const disclaimerCategorySchema = z.enum([
  'legal',
  'safety',
  'regulatory',
  'warranty',
  'general',
]);

const courseCoverSchema = z
  .object({
    thumbnail: CourseImageReferenceSchema.optional(),
    coverImage: CourseImageReferenceSchema.optional(),
    coverHeadline: z.string().optional(),
    coverButtonText: z.string().optional(),
    coverButtonColor: coverButtonColorSchema.optional(),
  })
  .passthrough();

const specificationRowSchema = z
  .object({
    label: z.string().trim().min(1, 'Label is required.'),
    value: z.string().trim().min(1, 'Value is required.'),
    highlight: z.boolean().optional(),
  })
  .passthrough();

const specificationGroupSchema = z
  .object({
    groupName: z.string().trim().min(1, 'Group name is required.'),
    specs: z.array(specificationRowSchema),
  })
  .passthrough();

const courseSpecificationSchema = z
  .object({
    title: z.string().trim().min(1, 'Specification title is required.'),
    subtitle: z.string().optional(),
    heroImage: CourseImageReferenceSchema.optional(),
    specGroups: z.array(specificationGroupSchema),
    footnotes: z.array(z.string().trim().min(1, 'Footnote cannot be empty.')).optional(),
  })
  .passthrough();

const courseDisclaimerSchema = z
  .object({
    title: z.string().optional(),
    category: disclaimerCategorySchema.optional(),
    body: z.string().trim().min(1, 'Disclaimer body is required.'),
    disclaimers: z.array(z.string().trim().min(1, 'Disclaimer item cannot be empty.')).optional(),
    acknowledgementRequired: z.boolean().optional(),
    acknowledgementLabel: z.string().optional(),
  })
  .passthrough();

export const courseSettingsInputSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required.').max(120),
    slug: z.string().trim().min(1, 'Slug is required.').max(100),
    description: z.string().max(2000).nullable(),
    learningObjectives: z.array(z.string().trim().min(1, 'Objective cannot be empty.')),
    cover: courseCoverSchema.nullable(),
    theme: courseThemeSchema.default(DEFAULT_COURSE_THEME),
    specifications: z.array(courseSpecificationSchema),
    disclaimer: courseDisclaimerSchema.nullable(),
  })
  .passthrough();

export const courseSettingsPatchSchema = courseSettingsInputSchema.partial();

export type ImageReference = z.output<typeof CourseImageReferenceSchema>;
export type CourseSettingsInput = z.output<typeof courseSettingsInputSchema>;

export function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function jsonObject(value: unknown): JsonObject {
  return isJsonObject(value) ? value : {};
}

export function createCourseStudioKey(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function createStableCourseStudioKey(prefix: string, seed: string | number): string {
  const normalizedSeed = String(seed).replace(/[^a-zA-Z0-9_-]/g, '-');
  return `${prefix}-${normalizedSeed}`;
}

export function mergeKnownFields<T extends JsonObject>(
  original: unknown,
  known: T,
  knownKeys: readonly (keyof T & string)[],
): JsonObject & T {
  const next: JsonObject = { ...jsonObject(original) };
  for (const key of knownKeys) {
    const value = known[key];
    if (value === undefined) delete next[key];
    else next[key] = value;
  }
  return next as JsonObject & T;
}

export function stringField(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function booleanField(value: unknown): boolean {
  return value === true;
}

export function imageReference(value: unknown): ImageReference | undefined {
  const parsed = CourseImageReferenceSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}
