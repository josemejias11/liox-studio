import { defineType, defineField } from "sanity";

export const chapterType = defineType({
  name: "chapter",
  title: "Chapter",
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
      options: { 
        source: "title",
        maxLength: 96,
        isUnique: (value, context) => context.defaultIsUnique(value, context)
      },
      validation: (r) => r.required(),
    }),
    defineField({
      name: "estimatedDuration",
      title: "Estimated Duration (minutes)",
      type: "number",
    }),
    defineField({
      name: "lessons",
      title: "Lessons",
      type: "array",
      of: [{ type: "reference", to: [{ type: "lesson" }] }],
      validation: (r) => r.required().min(1),
    }),
  ],
  preview: {
    select: { title: "title", subtitle: "estimatedDuration" },
    prepare({ title, subtitle }) {
      return { title, subtitle: subtitle ? `${subtitle} min` : "No duration set" };
    },
  },
});
