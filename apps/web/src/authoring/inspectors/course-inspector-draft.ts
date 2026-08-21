import type { CourseGraph } from '@moto-ai/contracts/course-studio';
import {
  booleanField,
  createStableCourseStudioKey,
  disclaimerCategorySchema,
  imageReference,
  jsonObject,
  mergeKnownFields,
  stringField,
  type ImageReference,
  type JsonObject,
} from '@/shared/contracts/course-settings';
import {
  specificationDrafts,
  specificationsPayload,
  type SpecificationDraft,
} from './SpecificationsField';
import type { StringListItem } from './StringListField';

export interface CoverDraft {
  coverButtonColor: '' | 'moto-indigo' | 'moto-frost' | 'moto-pearl';
  coverButtonText: string;
  coverHeadline: string;
  coverImage?: ImageReference;
  original?: JsonObject;
  present: boolean;
  thumbnail?: ImageReference;
}

export interface DisclaimerDraft {
  acknowledgementLabel: string;
  acknowledgementRequired: boolean;
  body: string;
  category: 'legal' | 'safety' | 'regulatory' | 'warranty' | 'general';
  clientKey: string;
  disclaimers: StringListItem[];
  original?: JsonObject;
  title: string;
}

export interface CourseFormDraft {
  cover: CoverDraft;
  description: string;
  disclaimer: DisclaimerDraft | null;
  learningObjectives: StringListItem[];
  slug: string;
  specifications: SpecificationDraft[];
  title: string;
}

function objectiveDrafts(value: unknown): StringListItem[] {
  return Array.isArray(value)
    ? value.map((item, index) => ({
        clientKey: createStableCourseStudioKey('objective', index),
        value: typeof item === 'string' ? item : '',
      }))
    : [];
}

function coverDraft(value: unknown): CoverDraft {
  const source = jsonObject(value);
  const color = source.coverButtonColor;
  return {
    present: Object.keys(source).length > 0,
    original: Object.keys(source).length > 0 ? source : undefined,
    coverHeadline: stringField(source.coverHeadline),
    coverButtonText: stringField(source.coverButtonText),
    coverButtonColor:
      color === 'moto-indigo' || color === 'moto-frost' || color === 'moto-pearl' ? color : '',
    coverImage: imageReference(source.coverImage),
    thumbnail: imageReference(source.thumbnail),
  };
}

function disclaimerDraft(value: unknown): DisclaimerDraft | null {
  if (value === null || value === undefined || !Object.keys(jsonObject(value)).length) return null;
  const source = jsonObject(value);
  const category = disclaimerCategorySchema.safeParse(source.category);
  return {
    clientKey: createStableCourseStudioKey('disclaimer', 'root'),
    original: source,
    title: stringField(source.title),
    category: category.success ? category.data : 'general',
    body: stringField(source.body),
    disclaimers: Array.isArray(source.disclaimers)
      ? source.disclaimers.map((item, index) => ({
          clientKey: createStableCourseStudioKey('disclaimer-item', index),
          value: typeof item === 'string' ? item : '',
        }))
      : [],
    acknowledgementRequired: booleanField(source.acknowledgementRequired),
    acknowledgementLabel: stringField(source.acknowledgementLabel),
  };
}

export function formDraft(course: CourseGraph): CourseFormDraft {
  return {
    title: course.title,
    slug: course.slug,
    description: course.description ?? '',
    learningObjectives: objectiveDrafts(course.learningObjectives),
    cover: coverDraft(course.cover),
    specifications: specificationDrafts(course.specifications),
    disclaimer: disclaimerDraft(course.disclaimer),
  };
}

export function formFingerprint(value: CourseFormDraft): string {
  return JSON.stringify(value, (_key, item) => (_key === 'clientKey' ? undefined : item));
}

export function formPayload(form: CourseFormDraft): unknown {
  const cover = form.cover;
  const coverPayload =
    !cover.present && !cover.original
      ? null
      : mergeKnownFields(
          cover.original,
          {
            thumbnail: cover.thumbnail,
            coverImage: cover.coverImage,
            coverHeadline: cover.coverHeadline || undefined,
            coverButtonText: cover.coverButtonText || undefined,
            coverButtonColor: cover.coverButtonColor || undefined,
          },
          ['thumbnail', 'coverImage', 'coverHeadline', 'coverButtonText', 'coverButtonColor'],
        );
  const disclaimer = form.disclaimer
    ? mergeKnownFields(
        form.disclaimer.original,
        {
          title: form.disclaimer.title || undefined,
          category: form.disclaimer.category,
          body: form.disclaimer.body,
          disclaimers:
            form.disclaimer.disclaimers.length > 0
              ? form.disclaimer.disclaimers.map((item) => item.value)
              : undefined,
          acknowledgementRequired: form.disclaimer.acknowledgementRequired || undefined,
          acknowledgementLabel: form.disclaimer.acknowledgementLabel || undefined,
        },
        [
          'title',
          'category',
          'body',
          'disclaimers',
          'acknowledgementRequired',
          'acknowledgementLabel',
        ],
      )
    : null;
  return {
    title: form.title,
    slug: form.slug,
    description: form.description || null,
    learningObjectives: form.learningObjectives.map((item) => item.value),
    cover: coverPayload,
    specifications: specificationsPayload(form.specifications),
    disclaimer,
  };
}

export function errorMap(
  issues: Array<{ path: PropertyKey[]; message: string }>,
): Record<string, string> {
  return Object.fromEntries(issues.map((issue) => [issue.path.join('.'), issue.message]));
}
