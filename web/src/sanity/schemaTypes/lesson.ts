import { defineType, defineField } from "sanity";
import { HotspotMapInput } from "../components/HotspotMapInput";
import { TextOverlayMapInput } from "../components/TextOverlayMapInput";
import { Presentation } from "lucide-react";

export const lessonType = defineType({
  name: "lesson",
  title: "Lesson",
  type: "document",
  icon: Presentation,
  groups: [
    { name: "content", title: "Content" },
    { name: "interactions", title: "Interactions" },
    { name: "media", title: "Media" },
  ],
  fields: [
    defineField({
      name: "headline",
      title: "Headline",
      type: "string",
      group: "content",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "body",
      title: "Body Copy",
      type: "array",
      group: "content",
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
      description: "Upload a 16:9 image",
      type: "image",
      group: "media",
      options: { hotspot: true },
    }),
    defineField({
      name: "textOverlay",
      title: "Text Overlay Config",
      description: "Control the size and position of the frosted glass text card when an image is present.",
      type: "object",
      group: "media",
      components: { input: TextOverlayMapInput },
      hidden: ({ parent }) => !parent?.media,
      fields: [
        defineField({ name: "x", title: "X Position (%)", description: "Left offset", type: "number", initialValue: 6, validation: r => r.min(0).max(100) }),
        defineField({ name: "y", title: "Y Position (%)", description: "Top offset", type: "number", initialValue: 15, validation: r => r.min(0).max(100) }),
        defineField({ 
          name: "width", 
          title: "Card Width", 
          type: "string", 
          options: { 
            list: [
              { title: "Small", value: "small" },
              { title: "Medium", value: "medium" },
              { title: "Large", value: "large" },
              { title: "Full Width", value: "full" },
            ]
          },
          initialValue: "medium"
        })
      ]
    }),
    defineField({
      name: "lessonType",
      title: "Lesson Type",
      type: "string",
      group: "content",
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
      name: "videoUrl",
      title: "Video URL",
      description: "YouTube, Vimeo, or direct .mp4 URL.",
      type: "url",
      group: "media",
      hidden: ({ parent }) => parent?.lessonType !== "video",
    }),
    defineField({
      name: "videoFile",
      title: "Video File",
      description: "Upload an MP4 to Sanity CDN. Used when Video URL is empty.",
      type: "file",
      group: "media",
      options: { accept: "video/*" },
      hidden: ({ parent }) => parent?.lessonType !== "video",
    }),
    defineField({
      name: "stageBackground",
      title: "Stage Background Image",
      description: "Upload a 16:9 image. Optional full-bleed background for Product Stage lessons. If omitted, a gradient is used.",
      type: "image",
      group: "media",
      options: { hotspot: true },
      hidden: ({ parent }) => parent?.lessonType !== "stage",
    }),
    defineField({
      name: "completionTransition",
      title: "Completion Animation",
      description: "Animation played after all hotspots are discovered.",
      type: "string",
      group: "interactions",
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
      group: "interactions",
      components: { input: HotspotMapInput },
      hidden: ({ parent }) => parent?.lessonType !== "interaction" && parent?.lessonType !== "stage",
      of: [
        {
          type: "object",
          name: "hotspot",
          fields: [
            defineField({ name: "label", title: "Label", type: "string", validation: (r) => r.required() }),
            defineField({ name: "topic", title: "AI Topic Query", type: "string" }),
            defineField({ name: "x", title: "X Position (%)", type: "number", validation: (r) => r.min(0).max(100) }),
            defineField({ name: "y", title: "Y Position (%)", type: "number", validation: (r) => r.min(0).max(100) }),
            defineField({
              name: "contentMode",
              title: "Content Mode",
              type: "string",
              options: {
                list: [
                  { title: "Tooltip (Inline text panel)", value: "tooltip" },
                  { title: "Rich Layer (Full Screen)", value: "layer" }
                ],
                layout: "radio"
              },
              initialValue: "tooltip"
            }),
            defineField({
              name: "layerContent",
              title: "Layer Content",
              type: "layer",
              hidden: ({ parent }) => parent?.contentMode === "tooltip"
            }),
            defineField({
              name: "body",
              title: "Panel Body",
              type: "array",
              of: [{ type: "block" }],
              hidden: ({ parent }) => parent?.contentMode === "layer"
            }),
            defineField({
              name: "photos",
              title: "Photo Gallery",
              description: "Images shown as a swipeable card stack inside the panel.",
              type: "array",
              of: [{ type: "image", options: { hotspot: true } }],
              hidden: ({ parent }) => parent?.contentMode === "layer"
            }),
          ],
          preview: {
            select: { title: "label", subtitle: "topic" },
          },
        },
      ],
    }),
  ],
  preview: {
    select: { title: "headline", subtitle: "lessonType", media: "media" },
  },
});
