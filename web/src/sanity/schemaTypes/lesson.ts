import { defineType, defineField } from "sanity";

export const lesson = defineType({
  name: "lesson",
  title: "Lesson",
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
      name: "estimatedDuration",
      title: "Estimated Duration (minutes)",
      type: "number",
    }),
    defineField({
      name: "slides",
      title: "Slides",
      type: "array",
      of: [{ type: "slide" }],
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
