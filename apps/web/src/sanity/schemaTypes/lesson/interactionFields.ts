import { defineField } from 'sanity';
import { HotspotMapInput } from '../../components/HotspotMapInput';
import { layerLinkAnnotation, richTextDecorators } from './richText';

export const lessonInteractionFields = [
  defineField({
    name: 'hotspots',
    title: 'Hotspot Definitions',
    type: 'array',
    group: 'interactions',
    components: { input: HotspotMapInput },
    hidden: ({ parent }) =>
      parent?.lessonType !== 'interaction' &&
      parent?.lessonType !== 'stage' &&
      parent?.lessonType !== 'canvas',
    of: [
      {
        type: 'object',
        name: 'hotspot',
        fields: [
          defineField({
            name: 'label',
            title: 'Label',
            type: 'string',
            validation: (r) => r.required(),
          }),
          defineField({ name: 'topic', title: 'AI Topic Query', type: 'string' }),
          defineField({
            name: 'required',
            title: 'Required for Completion',
            description: 'Canvas lessons require learners to explore this feature before continuing.',
            type: 'boolean',
            initialValue: false,
            hidden: ({ parent: _parent, document }) => document?.lessonType !== 'canvas',
          }),
          defineField({
            name: 'x',
            title: 'X Position (%)',
            type: 'number',
            validation: (r) => r.min(0).max(100),
          }),
          defineField({
            name: 'y',
            title: 'Y Position (%)',
            type: 'number',
            validation: (r) => r.min(0).max(100),
          }),
          defineField({
            name: 'body',
            title: 'Body Text',
            type: 'array',
            of: [{ type: 'block', marks: { decorators: richTextDecorators } }],
          }),
          defineField({
            name: 'photos',
            title: 'Photos',
            description:
              '1 photo = hero image. 2 or more = swipeable carousel. Hidden when a video is set.',
            type: 'array',
            of: [{ type: 'image', options: { hotspot: true } }],
          }),
          defineField({
            name: 'videoFile',
            title: 'Video',
            description: 'Upload an MP4. Takes the media slot and overrides photos when set.',
            type: 'file',
            options: { accept: 'video/mp4' },
          }),
          defineField({
            name: 'videoAspectRatio',
            title: 'Video Aspect Ratio',
            type: 'string',
            options: {
              list: [
                { title: '16:9', value: '16:9' },
                { title: '1:1 (Square)', value: '1:1' },
                { title: '4:5 (Portrait)', value: '4:5' },
                { title: '9:16 (Vertical)', value: '9:16' },
              ],
              layout: 'radio',
            },
            initialValue: '16:9',
            hidden: ({ parent }) => !parent?.videoFile,
          }),
        ],
        preview: {
          select: { title: 'label', subtitle: 'topic' },
        },
      },
    ],
  }),
  defineField({
    name: 'dropZones',
    title: 'Drop Zones',
    type: 'array',
    group: 'interactions',
    hidden: ({ parent }) => parent?.lessonType !== 'dragDrop',
    of: [
      {
        type: 'object',
        fields: [
          defineField({
            name: 'id',
            title: 'Zone ID',
            type: 'string',
            validation: (r) => r.required(),
          }),
          defineField({
            name: 'label',
            title: 'Label',
            type: 'string',
            validation: (r) => r.required(),
          }),
          defineField({
            name: 'correctChipId',
            title: 'Correct Chip ID',
            type: 'string',
            validation: (r) => r.required(),
          }),
          defineField({
            name: 'xPositionPct',
            title: 'X Position (%)',
            type: 'number',
            validation: (r) => r.min(0).max(100).required(),
          }),
          defineField({
            name: 'yPositionPct',
            title: 'Y Position (%)',
            type: 'number',
            validation: (r) => r.min(0).max(100).required(),
          }),
        ],
        preview: {
          select: { title: 'label', subtitle: 'correctChipId' },
        },
      },
    ],
  }),
  defineField({
    name: 'chips',
    title: 'Chips',
    type: 'array',
    group: 'interactions',
    hidden: ({ parent }) => parent?.lessonType !== 'dragDrop',
    of: [
      {
        type: 'object',
        fields: [
          defineField({
            name: 'id',
            title: 'Chip ID',
            type: 'string',
            validation: (r) => r.required(),
          }),
          defineField({
            name: 'text',
            title: 'Text',
            type: 'string',
            validation: (r) => r.required(),
          }),
        ],
        preview: {
          select: { title: 'text', subtitle: 'id' },
        },
      },
    ],
  }),
  defineField({
    name: 'scrollChapters',
    title: 'Scroll Chapters',
    type: 'array',
    group: 'interactions',
    hidden: ({ parent }) => parent?.lessonType !== 'scrollStory',
    of: [
      {
        type: 'object',
        fields: [
          defineField({
            name: 'heading',
            title: 'Heading',
            type: 'string',
            validation: (r) => r.required(),
          }),
          defineField({
            name: 'body',
            title: 'Body Text',
            type: 'array',
            of: [
              {
                type: 'block',
                marks: {
                  decorators: richTextDecorators,
                  annotations: [layerLinkAnnotation],
                },
              },
            ],
          }),
          defineField({
            name: 'image',
            title: 'Chapter Image',
            description:
              "Overrides the hero image for this chapter. Leave blank to inherit the previous chapter's image.",
            type: 'image',
            options: { hotspot: true },
          }),
          defineField({
            name: 'targetScale',
            title: 'Target Scale',
            type: 'number',
            initialValue: 1,
            description: '1 = original size. 1.2 zooms in 20%.',
          }),
          defineField({
            name: 'targetRotation',
            title: 'Target Rotation (deg)',
            type: 'number',
            initialValue: 0,
            description: 'Degrees. Positive = clockwise.',
          }),
          defineField({
            name: 'targetX',
            title: 'Target X Offset (px)',
            type: 'number',
            initialValue: 0,
            description: 'Pixel offset from centre. Positive X moves right; positive Y moves down.',
          }),
          defineField({
            name: 'targetY',
            title: 'Target Y Offset (px)',
            type: 'number',
            initialValue: 0,
            description: 'Pixel offset from centre. Positive X moves right; positive Y moves down.',
          }),
        ],
        preview: {
          select: { title: 'heading' },
        },
      },
    ],
  }),
];
