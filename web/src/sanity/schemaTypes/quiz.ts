import { defineType, defineField } from "sanity";
import { ClipboardList } from "lucide-react";

export const quizType = defineType({
  name: "quiz",
  title: "Quiz",
  type: "document",
  icon: ClipboardList,
  groups: [
    { name: "content", title: "Content", default: true },
    { name: "settings", title: "Settings" },
  ],
  fields: [
    defineField({
      name: "title",
      title: "Quiz Title",
      type: "string",
      group: "content",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "instructions",
      title: "Instructions",
      description: "Optional intro text shown before the quiz starts.",
      type: "text",
      rows: 3,
      group: "content",
    }),
    defineField({
      name: "questions",
      title: "Questions",
      type: "array",
      group: "content",
      validation: (r) => r.required().min(1),
      of: [
        {
          type: "object",
          name: "question",
          fields: [
            defineField({
              name: "questionText",
              title: "Question",
              type: "string",
              validation: (r) => r.required(),
            }),
            defineField({
              name: "questionType",
              title: "Question Type",
              type: "string",
              options: {
                list: [
                  { title: "Multiple Choice (Single Answer)", value: "single" },
                  { title: "Multiple Choice (Multi Answer)", value: "multi" },
                  { title: "True / False", value: "truefalse" },
                ],
                layout: "radio",
              },
              initialValue: "single",
            }),
            defineField({
              name: "answers",
              title: "Answer Options",
              type: "array",
              of: [
                {
                  type: "object",
                  name: "answer",
                  fields: [
                    defineField({ name: "text", title: "Answer Text", type: "string", validation: (r) => r.required() }),
                    defineField({ name: "isCorrect", title: "Correct Answer?", type: "boolean", initialValue: false }),
                    defineField({ name: "feedback", title: "Feedback (optional)", description: "Shown after selection.", type: "string" }),
                  ],
                  preview: {
                    select: { title: "text", subtitle: "isCorrect" },
                    prepare({ title, subtitle }) {
                      return { title, subtitle: subtitle ? "✅ Correct" : "❌ Incorrect" };
                    },
                  },
                },
              ],
              validation: (r) => r.min(2),
            }),
            defineField({
              name: "explanation",
              title: "Explanation",
              description: "Shown after the question is answered, explaining the correct answer.",
              type: "text",
              rows: 3,
            }),
          ],
          preview: {
            select: { title: "questionText", subtitle: "questionType" },
            prepare({ title, subtitle }) {
              const labels: Record<string, string> = { single: "Single Choice", multi: "Multi Choice", truefalse: "True / False" };
              return { title, subtitle: labels[subtitle] ?? subtitle };
            },
          },
        },
      ],
    }),
    defineField({
      name: "passingScore",
      title: "Passing Score (%)",
      description: "Minimum percentage required to pass. Default is 80%.",
      type: "number",
      group: "settings",
      validation: (r) => r.min(0).max(100),
      initialValue: 80,
    }),
    defineField({
      name: "allowRetry",
      title: "Allow Retry",
      description: "Let learners retake the quiz if they fail.",
      type: "boolean",
      group: "settings",
      initialValue: true,
    }),
    defineField({
      name: "showCorrectAnswers",
      title: "Show Correct Answers After Completion",
      type: "boolean",
      group: "settings",
      initialValue: true,
    }),
  ],
  preview: {
    select: { title: "title", subtitle: "passingScore" },
    prepare({ title, subtitle }) {
      return { title: title ?? "Untitled Quiz", subtitle: `Pass: ${subtitle ?? 80}%` };
    },
  },
});
