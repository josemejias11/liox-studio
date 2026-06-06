import { defineType, defineField } from "sanity";

export const moduleType = defineType({
  name: "module",
  title: "Module",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title" },
      validation: (r) => r.required(),
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "text",
      rows: 3,
    }),
    defineField({
      name: "thumbnail",
      title: "Thumbnail",
      type: "image",
      options: { hotspot: true },
    }),
    defineField({
      name: "learningObjectives",
      title: "Learning Objectives",
      type: "array",
      of: [{ type: "string" }],
    }),
    defineField({
      name: "chapters",
      title: "Chapters",
      type: "array",
      of: [{ type: "reference", to: [{ type: "chapter" }] }],
      validation: (r) => r.required().min(1),
    }),
    defineField({
      name: "coverImage",
      title: "Cover Screen Image (optional)",
      description: "If not provided, the Thumbnail will be used.",
      type: "image",
      options: { hotspot: true },
    }),
    defineField({
      name: "coverHeadline",
      title: "Cover Headline (optional)",
      type: "string",
    }),
    defineField({
      name: "coverButtonText",
      title: "Start Button Text",
      type: "string",
      initialValue: "start course",
    }),
    defineField({
      name: "coverButtonColor",
      title: "Start Button Color",
      description: "Motorola 2026 brand-compliant button colors only.",
      type: "string",
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
      initialValue: false,
    }),
  ],
  preview: {
    select: { title: "title", subtitle: "description", media: "thumbnail" },
  },
});
