import { z } from 'zod';
import type { PortableTextBlock } from '@portabletext/types';
import { ALL_LESSON_TYPES, type CourseMode } from '@/lib/course-modes';

// ── Sanity content contract ───────────────────────────────────────────────────
// Single source of truth for the shapes returned by the GROQ queries in
// src/sanity/lib/queries.ts. The course page validates the raw fetch result
// against `courseSchema` once at the boundary; everything downstream consumes
// the inferred types. Keep each schema in lockstep with its GROQ fragment.

// ── Plain-text helper ─────────────────────────────────────────────────────────

/** Coerce a string or PortableText block array to plain text. */
export function toPlainText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value
      .map((block) => {
        const children = (block as { children?: Array<{ text?: unknown }> }).children;
        return children?.map((c) => (typeof c.text === 'string' ? c.text : '')).join('') ?? '';
      })
      .join('');
  }
  return value == null ? '' : String(value);
}

// ── Shared fragments ──────────────────────────────────────────────────────────

/** GROQ returns `null` for missing projections; normalize to `undefined`. */
const opt = <T extends z.ZodType>(schema: T) =>
  schema.nullish().transform((v) => (v ?? undefined) as z.output<T> | undefined);

/** PortableText block content — structurally validated as an array only. */
export const portableTextSchema = z.custom<PortableTextBlock[]>((v) => Array.isArray(v));

/** Rich text fields tolerate both plain strings and PortableText arrays. */
export type RichText = string | PortableTextBlock[];
const richTextSchema = z.union([z.string(), portableTextSchema]);

/** Headline/label fields: tolerate legacy PortableText values, emit a string. */
const plainStringSchema = z
  .union([z.string(), portableTextSchema])
  .catch('')
  .transform(toPlainText);

const imageSchema = z.object({
  asset: opt(z.object({ url: opt(z.string()) })),
});

export const photoSchema = z.object({
  asset: opt(z.object({ url: opt(z.string()), originalFilename: opt(z.string()) })),
});
export type SanityPhoto = z.output<typeof photoSchema>;

const textOverlaySchema = z.object({
  x: opt(z.number()),
  y: opt(z.number()),
  width: opt(z.string()),
});

// ── Lesson hotspots ───────────────────────────────────────────────────────────

export const hotspotSchema = z.object({
  _key: z.string(),
  label: plainStringSchema,
  topic: z.string().catch(''),
  // Coordinates default to 0 when un-placed/malformed rather than failing the course.
  x: z.number().catch(0),
  y: z.number().catch(0),
  body: opt(richTextSchema),
  required: opt(z.boolean()),
  photos: opt(z.array(photoSchema)),
  videoFile: opt(imageSchema),
  videoAspectRatio: opt(z.string()),
});
export type SanityHotspot = z.output<typeof hotspotSchema>;

// ── Lesson ────────────────────────────────────────────────────────────────────

export const lessonSchema = z.object({
  sectionType: z.literal('lesson'),
  _key: z.string(),
  headline: plainStringSchema,
  body: opt(richTextSchema),
  lessonType: z.enum(ALL_LESSON_TYPES).catch('content'),
  deviceName: opt(z.string()),
  coveredFeatures: opt(z.array(z.object({
    _key: z.string(),
    label: z.string().catch(''),
    summary: opt(z.string()),
  }))),
  media: opt(imageSchema),
  textOverlay: opt(textOverlaySchema),
  hotspots: opt(z.array(hotspotSchema)),
  videoAspectRatio: opt(z.string()),
  videoFile: opt(imageSchema),
  stageBackground: opt(imageSchema),
  enableCompletionAnimation: opt(z.boolean()),
  completionTransition: opt(z.enum(['spin', 'rise', 'fade'])),
  colorVariants: opt(z.array(z.object({
    label: z.string().catch(''),
    colorHex: opt(z.string()),
    image: opt(imageSchema),
  }))),
  splitReverseLayout: opt(z.boolean()),
  dropZones: opt(z.array(z.object({
    id: z.string().catch(''),
    label: z.string().catch(''),
    correctChipId: z.string().catch(''),
    xPositionPct: z.number().catch(0),
    yPositionPct: z.number().catch(0),
  }))),
  chips: opt(z.array(z.object({
    id: z.string().catch(''),
    text: z.string().catch(''),
  }))),
  scrollChapters: opt(z.array(z.object({
    heading: z.string().catch(''),
    body: opt(richTextSchema),
    image: opt(imageSchema),
    targetScale: opt(z.number()),
    targetRotation: opt(z.number()),
    targetX: opt(z.number()),
    targetY: opt(z.number()),
  }))),
});
export type SanityLesson = z.output<typeof lessonSchema>;

/** A lesson enriched with chapter metadata — what the sections array contains. */
export type LessonSection = SanityLesson & {
  chapterTitle: string;
  chapterIndex: number;
};

// ── Specification ─────────────────────────────────────────────────────────────

export const specificationSchema = z.object({
  sectionType: z.literal('specification'),
  _key: opt(z.string()),
  title: z.string().catch(''),
  subtitle: opt(z.string()),
  heroImage: opt(imageSchema),
  specGroups: z
    .array(
      z.object({
        groupName: z.string().catch(''),
        specs: z
          .array(
            z.object({
              label: z.string().catch(''),
              value: z.string().catch(''),
              highlight: opt(z.boolean()),
            }),
          )
          .catch([]),
      }),
    )
    .catch([]),
  footnotes: opt(z.array(z.string())),
});
export type SanitySpecification = z.output<typeof specificationSchema>;

// ── Quiz ──────────────────────────────────────────────────────────────────────
// Client-safe projection: `isCorrect` / `feedback` are deliberately absent —
// grading happens server-side via /api/quiz/grade (see contracts/quiz.ts).

export const quizDocSchema = z.object({
  sectionType: z.literal('quiz'),
  _key: z.string(),
  title: opt(z.string()),
  instructions: opt(z.string()),
  questions: z
    .array(
      z.object({
        _key: z.string(),
        questionText: z.string().catch(''),
        // Sanity schema values: "single" | "multi" | "truefalse"
        questionType: opt(z.string()),
        image: opt(imageSchema),
        answers: z
          .array(
            z.object({
              _key: z.string(),
              text: z.string().catch(''),
            }),
          )
          .catch([]),
      }),
    )
    .catch([]),
  passingScore: opt(z.number()),
  allowRetry: opt(z.boolean()),
  showCorrectAnswers: opt(z.boolean()),
});
export type SanityQuizDoc = z.output<typeof quizDocSchema>;

// ── Disclaimer ────────────────────────────────────────────────────────────────

export const disclaimerSchema = z.object({
  sectionType: z.literal('disclaimer'),
  _key: opt(z.string()),
  title: opt(z.string()),
  category: opt(z.enum(['legal', 'safety', 'regulatory', 'warranty', 'general'])),
  body: z.string().catch(''),
  disclaimers: opt(z.array(z.string())),
  acknowledgementRequired: opt(z.boolean()),
  acknowledgementLabel: opt(z.string()),
});
export type SanityDisclaimer = z.output<typeof disclaimerSchema>;

// ── Course ────────────────────────────────────────────────────────────────────

const chapterSchema = z.object({
  _id: opt(z.string()),
  title: opt(z.string()),
  estimatedDuration: opt(z.number()),
  lessons: opt(z.array(lessonSchema)),
  quickCheck: opt(quizDocSchema),
});

export const courseSchema = z.object({
  _id: z.string(),
  title: z.string().catch(''),
  courseMode: z.enum(['standard', 'canvas']).catch('standard'),
  description: opt(z.string()),
  thumbnail: opt(imageSchema),
  coverImage: opt(imageSchema),
  coverHeadline: opt(z.string()),
  coverButtonText: opt(z.string()),
  coverButtonColor: opt(z.string()),
  learningObjectives: opt(z.array(z.string())),
  chapters: opt(z.array(chapterSchema)),
  specifications: opt(z.array(specificationSchema)),
  disclaimer: opt(disclaimerSchema),
});
export type SanityCourse = z.output<typeof courseSchema>;
export type { CourseMode };

/** Flat discriminated union of every section type in the course flow. */
export type CourseSection = LessonSection | SanitySpecification | SanityQuizDoc | SanityDisclaimer;

// ── Course summary (COURSES_QUERY) ────────────────────────────────────────────

export const courseSummarySchema = z.object({
  _id: z.string(),
  title: z.string().catch(''),
  courseMode: z.enum(['standard', 'canvas']).catch('standard'),
  slug: z.object({ current: z.string() }),
  description: opt(z.string()),
  thumbnail: opt(imageSchema),
  learningObjectives: opt(z.array(z.string())),
  chapterCount: z.number().catch(0),
});
export type CourseSummary = z.output<typeof courseSummarySchema>;
