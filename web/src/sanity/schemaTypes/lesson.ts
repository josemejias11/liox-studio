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
    { name: "content", title: "Content", default: true },
    { name: "media", title: "Media" },
    { name: "interactions", title: "Interactions" },
    { name: "completion", title: "Completion Animation" },
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
          { title: "Quiz (In-Lesson)", value: "quiz" },
        ],
        layout: "radio",
      },
      initialValue: "content",
    }),
    defineField({
      name: "videoFile",
      title: "Video File",
      description: "Upload an MP4 to Sanity CDN.",
      type: "file",
      group: "media",
      options: { accept: "video/mp4" },
      hidden: ({ parent }) => parent?.lessonType !== "video",
    }),
    defineField({
      name: "videoAspectRatio",
      title: "Video Aspect Ratio",
      type: "string",
      group: "media",
      options: {
        list: [
          { title: "16:9", value: "16:9" },
          { title: "1:1 (Square)", value: "1:1" },
          { title: "4:5 (Portrait)", value: "4:5" },
          { title: "9:16 (Vertical)", value: "9:16" },
        ],
        layout: "radio"
      },
      initialValue: "16:9",
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
    defineField({
      name: "floatingGraphics",
      title: "Floating Logos & Graphics",
      description: "Add SVG or PNG logos that float above the lesson background.",
      type: "array",
      group: "media",
      components: { input: HotspotMapInput }, // reusing HotspotMapInput since it provides x/y mapping
      of: [
        {
          type: "object",
          name: "graphic",
          fields: [
            defineField({ 
              name: "image", 
              title: "Graphic File (SVG/PNG)", 
              type: "image", 
              options: { accept: "image/png, image/svg+xml" },
              validation: r => r.required() 
            }),
            defineField({ name: "x", title: "X Position (%)", type: "number", validation: (r) => r.min(0).max(100) }),
            defineField({ name: "y", title: "Y Position (%)", type: "number", validation: (r) => r.min(0).max(100) }),
            defineField({ 
              name: "width", 
              title: "Size", 
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
          ],
          preview: {
            select: { title: "width", media: "image" },
            prepare({ title, media }) {
              return { title: `Floating Graphic (${title})`, media };
            }
          }
        }
      ]
    }),
    defineField({
      name: "enableCompletionAnimation",
      title: "Enable Gamified Completion",
      description: "Trigger a special gamification animation when all hotspots are discovered.",
      type: "boolean",
      group: "completion",
      initialValue: false,
      hidden: ({ parent }) => parent?.lessonType !== "stage",
    }),
    defineField({
      name: "completionTransition",
      title: "Completion Animation",
      description: "Animation played after all hotspots are discovered.",
      type: "string",
      group: "completion",
      options: {
        list: [
          { title: "Pulse & Glow (Premium product highlight)", value: "spin" },
          { title: "Rise (Content rises with light shift)", value: "rise" },
          { title: "Fade (Subtle fade out)", value: "fade" },
        ],
        layout: "radio",
      },
      initialValue: "spin",
      hidden: ({ parent }) => parent?.lessonType !== "stage" || !parent?.enableCompletionAnimation,
    }),
  ],
  preview: {
    select: { title: "headline", subtitle: "lessonType", media: "media" },
  },
});
