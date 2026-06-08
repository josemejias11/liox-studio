import { defineType, defineField } from "sanity";

export const courseType = defineType({
  name: "course",
  title: "Course",
  type: "document",
  groups: [
    { name: "content", title: "Content" },
    { name: "coverUi", title: "Cover UI" },
    { name: "settings", title: "Settings" },
  ],
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      group: "content",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      group: "content",
      options: {
        source: "title",
        maxLength: 96,
        isUnique: (value, context) => context.defaultIsUnique(value, context),
      },
      validation: (r) => r.required(),
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "text",
      group: "content",
      rows: 3,
    }),
    defineField({
      name: "thumbnail",
      title: "Thumbnail",
      description: "Upload a 16:9 image",
      type: "image",
      group: "content",
      options: { hotspot: true },
    }),
    defineField({
      name: "learningObjectives",
      title: "Learning Objectives",
      type: "array",
      group: "content",
      of: [{ type: "string" }],
    }),
    defineField({
      name: "chapters",
      title: "Chapters",
      type: "array",
      group: "content",
      of: [{ type: "reference", to: [{ type: "chapter" }] }],
      validation: (r) => r.required().min(1),
    }),
    defineField({
      name: "specifications",
      title: "Specification Sheets",
      description: "Tech spec sheets shown after all chapters complete. Course-level — not per chapter.",
      type: "array",
      group: "content",
      of: [
        {
          type: "reference",
          to: [{ type: "specification" }],
          validation: (r) =>
            r.custom(async (ref, context) => {
              const typedRef = ref as { _ref?: string } | undefined;
              if (!typedRef?._ref) return true;

              const currentDocId = context.document?._id?.replace(/^drafts\./, "");
              const client = context.getClient({ apiVersion: "2024-01-01" });
              const count = await client.fetch<number>(
                `count(*[
                  _type == "course" &&
                  _id != $currentDocId &&
                  $specRef in specifications[]._ref
                ])`,
                { currentDocId, specRef: typedRef._ref }
              );

              return count > 0
                ? "This specification is already assigned to another course."
                : true;
            }),
        },
      ],
    }),
    defineField({
      name: "quiz",
      title: "Course Quiz",
      description: "The course completion quiz. Learner must score ≥80% to earn completion.",
      type: "reference",
      group: "content",
      to: [{ type: "quiz" }],
      validation: (r) =>
        r.custom(async (ref, context) => {
          const typedRef = ref as { _ref?: string } | undefined;
          if (!typedRef?._ref) return true;

          const currentDocId = context.document?._id?.replace(/^drafts\./, "");
          const client = context.getClient({ apiVersion: "2024-01-01" });
          const count = await client.fetch<number>(
            `count(*[
              _type == "course" &&
              _id != $currentDocId &&
              quiz._ref == $quizRef
            ])`,
            { currentDocId, quizRef: typedRef._ref }
          );

          return count > 0
            ? "This quiz is already assigned to another course."
            : true;
        }),
    }),
    defineField({
      name: "disclaimer",
      title: "Disclaimer",
      description: "Shown as the very last screen after quiz pass.",
      type: "reference",
      group: "content",
      to: [{ type: "disclaimer" }],
      validation: (r) =>
        r.custom(async (ref, context) => {
          const typedRef = ref as { _ref?: string } | undefined;
          if (!typedRef?._ref) return true;

          const currentDocId = context.document?._id?.replace(/^drafts\./, "");
          const client = context.getClient({ apiVersion: "2024-01-01" });
          const count = await client.fetch<number>(
            `count(*[
              _type == "course" &&
              _id != $currentDocId &&
              disclaimer._ref == $disclaimerRef
            ])`,
            { currentDocId, disclaimerRef: typedRef._ref }
          );

          return count > 0
            ? "This disclaimer is already assigned to another course."
            : true;
        }),
    }),
    defineField({
      name: "coverImage",
      title: "Cover Screen Image (optional)",
      description: "Upload a 16:9 image. If not provided, the Thumbnail will be used.",
      type: "image",
      group: "coverUi",
      options: { hotspot: true },
    }),
    defineField({
      name: "coverHeadline",
      title: "Cover Headline (optional)",
      type: "string",
      group: "coverUi",
    }),
    defineField({
      name: "coverButtonText",
      title: "Start Button Text",
      type: "string",
      group: "coverUi",
      initialValue: "start course",
    }),
    defineField({
      name: "coverButtonColor",
      title: "Start Button Color",
      description: "Motorola 2026 brand-compliant button colors only.",
      type: "string",
      group: "coverUi",
      options: {
        list: [
          { title: "Black (Primary)", value: "moto-black" },
          { title: "Moto Indigo (Accent)", value: "moto-indigo" },
          { title: "Frost (Light)", value: "moto-frost" },
          { title: "Pearl (Warm Light)", value: "moto-pearl" },
        ],
        layout: "radio",
      },
      initialValue: "moto-black",
    }),
    defineField({
      name: "published",
      title: "Published",
      type: "boolean",
      group: "settings",
      initialValue: false,
    }),
  ],
  preview: {
    select: { title: "title", subtitle: "description", media: "thumbnail" },
  },
});
