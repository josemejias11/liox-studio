import { defineType, defineField } from "sanity";
import { HotspotMapInput } from "../components/HotspotMapInput";

export const layerType = defineType({
  name: "layer",
  title: "Layer",
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
      of: [{ type: "block" }]
    }),
    defineField({
      name: "media",
      title: "Media / Product Image",
      type: "image",
      options: { hotspot: true },
    }),
    defineField({
      name: "photos",
      title: "Photo Gallery",
      description: "Optional image carousel to display in the layer.",
      type: "array",
      of: [{ type: "image", options: { hotspot: true } }],
    }),
    defineField({
      name: "speakerNotes",
      title: "Speaker Notes",
      type: "text",
      rows: 3,
    }),
    defineField({
      name: "layerType",
      title: "Layer Type",
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
      name: "theme",
      title: "Layer Color Theme",
      description: "Controls the layer background and text color pairing.",
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
      hidden: ({ parent }) => parent?.layerType === "video",
    }),
    defineField({
      name: "videoUrl",
      title: "Video URL",
      description: "YouTube, Vimeo, or direct .mp4 URL.",
      type: "url",
      hidden: ({ parent }) => parent?.layerType !== "video",
    }),
    defineField({
      name: "videoFile",
      title: "Video File",
      description: "Upload an MP4 to Sanity CDN. Used when Video URL is empty.",
      type: "file",
      options: { accept: "video/*" },
      hidden: ({ parent }) => parent?.layerType !== "video",
    }),
    defineField({
      name: "hotspots",
      title: "Hotspot Definitions",
      type: "array",
      components: { input: HotspotMapInput },
      hidden: ({ parent }) => parent?.layerType !== "interaction",
      of: [
        {
          type: "object",
          name: "hotspot",
          fields: [
            defineField({ name: "label", title: "Label", type: "string", validation: (r) => r.required() }),
            defineField({ name: "topic", title: "AI Topic Query", type: "string" }),
            defineField({
              name: "body",
              title: "Panel Body",
              description: "Content shown in the discovery panel when this hotspot is opened.",
              type: "text",
              rows: 5,
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
  ],
  preview: {
    select: { title: "headline", subtitle: "layerType", media: "media" },
  },
});
