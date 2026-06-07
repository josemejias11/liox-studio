import { defineType, defineField } from "sanity";
import { BookOpen } from "lucide-react";

export const chapterType = defineType({
  name: "chapter",
  title: "Chapter",
  type: "document",
  icon: BookOpen,
  groups: [
    { name: "info", title: "Info", default: true },
    { name: "lessons", title: "Lessons" },
  ],
  fields: [
    // ── Info ──────────────────────────────────────────────────────────────────
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      group: "info",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      group: "info",
      options: {
        source: "title",
        maxLength: 96,
        isUnique: (value, context) => context.defaultIsUnique(value, context),
      },
      validation: (r) => r.required(),
    }),
    defineField({
      name: "estimatedDuration",
      title: "Estimated Duration (minutes)",
      type: "number",
      group: "info",
    }),

    // ── Lessons ───────────────────────────────────────────────────────────────
    defineField({
      name: "lessons",
      title: "Lessons",
      description: "Interactive learning slides for this chapter.",
      type: "array",
      group: "lessons",
      of: [{ type: "reference", to: [{ type: "lesson" }] }],
    }),

  ],
  preview: {
    select: { title: "title", subtitle: "estimatedDuration" },
    prepare({ title, subtitle }) {
      return { title, subtitle: subtitle ? `${subtitle} min` : "No duration set" };
    },
  },
});
