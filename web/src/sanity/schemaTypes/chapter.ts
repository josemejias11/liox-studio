import { defineType, defineField } from "sanity";
import { BookOpen } from "lucide-react";
import { OrderableLessonsInput } from "../components/OrderableLessonsInput";

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
      components: { input: OrderableLessonsInput },
      of: [
        {
          type: "reference",
          to: [{ type: "lesson" }],
          validation: (r) =>
            r.custom(async (ref, context) => {
              const typedRef = ref as { _ref?: string } | undefined;
              if (!typedRef?._ref) return true;

              const currentDocId = context.document?._id?.replace(
                /^drafts\./,
                ""
              );
              const draftId = `drafts.${currentDocId}`;

              const client = context.getClient({ apiVersion: "2024-01-01" });
              const count = await client.fetch<number>(
                `count(*[
                  _type == "chapter" &&
                  _id != $currentDocId &&
                  _id != $draftId &&
                  $lessonRef in lessons[]._ref
                ])`,
                { currentDocId, draftId, lessonRef: typedRef._ref }
              );

              return count > 0
                ? "This lesson is already assigned to another chapter."
                : true;
            }),
        },
      ],
    }),

  ],
  preview: {
    select: { title: "title", subtitle: "estimatedDuration" },
    prepare({ title, subtitle }) {
      return { title, subtitle: subtitle ? `${subtitle} min` : "No duration set" };
    },
  },
});
