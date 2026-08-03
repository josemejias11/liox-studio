import { z } from 'zod';

/** JSON objects are kept intact while the Studio edits their known keys. */
export type JsonObject = Record<string, unknown>;

export const coverButtonColorSchema = z.enum(['moto-indigo', 'moto-frost', 'moto-pearl']);
export const disclaimerCategorySchema = z.enum([
  'legal',
  'safety',
  'regulatory',
  'warranty',
  'general',
]);

/**
 * The player consumes this nested asset reference. Both levels deliberately
 * pass through legacy delivery metadata when an author changes another field.
 */
export const imageReferenceSchema = z.object({
  asset: z.object({
    url: z.string().url(),
    originalFilename: z.string().optional(),
  }).passthrough(),
}).passthrough();

export const courseCoverSchema = z.object({
  thumbnail: imageReferenceSchema.optional(),
  coverImage: imageReferenceSchema.optional(),
  coverHeadline: z.string().optional(),
  coverButtonText: z.string().optional(),
  coverButtonColor: coverButtonColorSchema.optional(),
}).passthrough();

export const specificationRowSchema = z.object({
  label: z.string().trim().min(1, 'Label is required.'),
  value: z.string().trim().min(1, 'Value is required.'),
  highlight: z.boolean().optional(),
}).passthrough();

export const specificationGroupSchema = z.object({
  groupName: z.string().trim().min(1, 'Group name is required.'),
  specs: z.array(specificationRowSchema),
}).passthrough();

export const courseSpecificationSchema = z.object({
  title: z.string().trim().min(1, 'Specification title is required.'),
  subtitle: z.string().optional(),
  heroImage: imageReferenceSchema.optional(),
  specGroups: z.array(specificationGroupSchema),
  footnotes: z.array(z.string().trim().min(1, 'Footnote cannot be empty.')).optional(),
}).passthrough();

export const courseDisclaimerSchema = z.object({
  title: z.string().optional(),
  category: disclaimerCategorySchema.optional(),
  body: z.string().trim().min(1, 'Disclaimer body is required.'),
  disclaimers: z.array(z.string().trim().min(1, 'Disclaimer item cannot be empty.')).optional(),
  acknowledgementRequired: z.boolean().optional(),
  acknowledgementLabel: z.string().optional(),
}).passthrough();

/** Complete, explicit Course Settings save payload. */
export const courseSettingsInputSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(120),
  slug: z.string().trim().min(1, 'Slug is required.').max(100),
  description: z.string().max(2000).nullable(),
  learningObjectives: z.array(z.string().trim().min(1, 'Objective cannot be empty.')),
  cover: courseCoverSchema.nullable(),
  specifications: z.array(courseSpecificationSchema),
  disclaimer: courseDisclaimerSchema.nullable(),
}).passthrough();

/** PATCH accepts a partial update, while every supplied known field is strict. */
export const courseSettingsPatchSchema = courseSettingsInputSchema.partial();

export type ImageReference = z.output<typeof imageReferenceSchema>;
export type CourseCover = z.output<typeof courseCoverSchema>;
export type SpecificationRow = z.output<typeof specificationRowSchema>;
export type SpecificationGroup = z.output<typeof specificationGroupSchema>;
export type CourseSpecification = z.output<typeof courseSpecificationSchema>;
export type CourseDisclaimer = z.output<typeof courseDisclaimerSchema>;
export type CourseSettingsInput = z.output<typeof courseSettingsInputSchema>;
export type CourseSettingsPatchInput = z.output<typeof courseSettingsPatchSchema>;

export function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function jsonObject(value: unknown): JsonObject {
  return isJsonObject(value) ? value : {};
}

/** A client-only key. It is never merged into the persisted JSON payload. */
export function createCourseStudioKey(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

/** A deterministic client-only key for server-rendered draft collections. */
export function createStableCourseStudioKey(prefix: string, seed: string | number): string {
  const normalizedSeed = String(seed).replace(/[^a-zA-Z0-9_-]/g, '-');
  return `${prefix}-${normalizedSeed}`;
}

/**
 * Merge editable known fields over their original persisted object. Omitting a
 * known optional field removes only that key; all unknown metadata survives.
 */
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
  const parsed = imageReferenceSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}
