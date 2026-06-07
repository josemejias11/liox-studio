import { defineType, defineField } from "sanity";
import { HotspotMapInput } from "../components/HotspotMapInput";

export const lessonType = defineType({
  name: "lesson",
  title: "Lesson",
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
      type: "array",
      of: [
        {
          type: "block",
          marks: {
            annotations: [
              {
                name: "layerLink",
                type: "object",
                title: "Layer Link",
                fields: [
                  {
                    name: "linkedLayer",
                    type: "string",
                    title: "Linked Layer Headline",
                    description: "The headline of the layer to open.",
                    validation: (r) => r.required()
                  }
                ]
              }
            ]
          }
        }
      ]
    }),
    defineField({
      name: "media",
      title: "Media / Product Image",
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
      name: "lessonType",
      title: "Lesson Type",
      type: "string",
      options: {
        list: [
          { title: "Content", value: "content" },
          { title: "Interaction (Hotspots)", value: "interaction" },
          { title: "Product Stage", value: "stage" },
          { title: "Video", value: "video" },
          { title: "Quiz", value: "quiz" },
        ],
        layout: "radio",
      },
      initialValue: "content",
    }),
    defineField({
      name: "theme",
      title: "Lesson Color Theme",
      description: "Controls the lesson background and text color pairing. Motorola 2026 approved pairings only.",
      type: "string",
      options: {
        list: [
          { title: "Frost / Black (Cool — default)", value: "frost-black" },
          { title: "Black / Frost (Dark Cool)", value: "black-frost" },
          { title: "Pearl / Black (Warm)", value: "pearl-black" },
          { title: "Black / Pearl (Dark Warm)", value: "black-pearl" },
          { title: "Moto Indigo / Frost (Brand)", value: "indigo-frost" },
        ],
        layout: "radio",
      },
      initialValue: "frost-black",
      hidden: ({ parent }) => parent?.lessonType === "video",
    }),
    defineField({
      name: "videoUrl",
      title: "Video URL",
      description: "YouTube, Vimeo, or direct .mp4 URL.",
      type: "url",
      hidden: ({ parent }) => parent?.lessonType !== "video",
    }),
    defineField({
      name: "videoFile",
      title: "Video File",
      description: "Upload an MP4 to Sanity CDN. Used when Video URL is empty.",
      type: "file",
      options: { accept: "video/*" },
      hidden: ({ parent }) => parent?.lessonType !== "video",
    }),
    defineField({
      name: "stageBackground",
      title: "Stage Background Image",
      description: "Optional full-bleed background for Product Stage lessons. If omitted, a gradient is used.",
      type: "image",
      options: { hotspot: true },
      hidden: ({ parent }) => parent?.lessonType !== "stage",
    }),
    defineField({
      name: "completionTransition",
      title: "Completion Animation",
      description: "Animation played after all hotspots are discovered.",
      type: "string",
      options: {
        list: [
          { title: "Spin (360° product rotate)", value: "spin" },
          { title: "Rise (content rises in)", value: "rise" },
          { title: "Fade", value: "fade" },
        ],
        layout: "radio",
      },
      initialValue: "spin",
      hidden: ({ parent }) => parent?.lessonType !== "stage",
    }),
    defineField({
      name: "hotspots",
      title: "Hotspot Definitions",
      type: "array",
      components: { input: HotspotMapInput },
      hidden: ({ parent }) => parent?.lessonType !== "interaction" && parent?.lessonType !== "stage",
      of: [
        {
          type: "object",
          name: "hotspot",
          fields: [
            defineField({ name: "label", title: "Label", type: "string", validation: (r) => r.required() }),
            defineField({ name: "topic", title: "AI Topic Query", type: "string" }),
            defineField({ 
              name: "linkedLayer", 
              title: "Linked Layer Headline", 
              description: "If provided, tapping this hotspot opens the matching deep dive layer instead of the inline panel.",
              type: "string" 
            }),
            defineField({
      name: "body",
      title: "Panel Body",
      type: "array",
      of: [{ type: "block" }]
    }),
            defineField({
              name: "photos",
              title: "Photo Gallery",
              description: "Images shown as a swipeable card stack inside the panel.",
              type: "array",
              of: [{ type: "image", options: { hotspot: true } }],
            }),
            defineField({ name: "x", title: "X Position (%)", type: "number", validation: (r) => r.min(0).max(100) }),
            defineField({ name: "y", title: "Y Position (%)", type: "number", validation: (r) => r.min(0).max(100) }),
          ],
          preview: {
            select: { title: "label", subtitle: "topic" },
          },
        },
      ],
    }),
    defineField({
      name: "layers",
      title: "Deep Dive Layers",
      type: "array",
      of: [{ type: "layer" }],
      description: "Optional deep dive topics that exist on the Z-axis inside this lesson.",
    }),
  ],
  preview: {
    select: { title: "headline", subtitle: "lessonType", media: "media" },
  },
});
