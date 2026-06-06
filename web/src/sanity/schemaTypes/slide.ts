import { defineType, defineField } from "sanity";

export const slide = defineType({
  name: "slide",
  title: "Slide",
  type: "object",
  fields: [
    defineField({
      name: "headline",
      title: "Headline",
      type: "string",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "body",
      title: "Body Copy",
      type: "text",
      rows: 4,
    }),
    defineField({
      name: "media",
      title: "Media",
      type: "image",
      options: { hotspot: true },
    }),
    defineField({
      name: "speakerNotes",
      title: "Speaker Notes",
      type: "text",
      rows: 3,
    }),
    defineField({
      name: "slideType",
      title: "Slide Type",
      type: "string",
      options: {
        list: [
          { title: "Content", value: "content" },
          { title: "Interaction (Hotspots)", value: "interaction" },
          { title: "Video", value: "video" },
          { title: "Quiz", value: "quiz" },
        ],
        layout: "radio",
      },
      initialValue: "content",
    }),
    defineField({
      name: "hotspots",
      title: "Hotspot Definitions",
      type: "array",
      hidden: ({ parent }) => parent?.slideType !== "interaction",
      of: [
        {
          type: "object",
          name: "hotspot",
          fields: [
            defineField({ name: "label", title: "Label", type: "string", validation: (r) => r.required() }),
            defineField({ name: "topic", title: "AI Topic Query", type: "string" }),
            defineField({ name: "x", title: "X Position (%)", type: "number", validation: (r) => r.min(0).max(100) }),
            defineField({ name: "y", title: "Y Position (%)", type: "number", validation: (r) => r.min(0).max(100) }),
          ],
          preview: {
            select: { title: "label", subtitle: "topic" },
          },
        },
      ],
    }),
  ],
  preview: {
    select: { title: "headline", subtitle: "slideType", media: "media" },
  },
});
