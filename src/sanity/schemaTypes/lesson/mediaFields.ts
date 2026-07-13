import { defineField } from 'sanity';
import { TextOverlayMapInput } from '../../components/TextOverlayMapInput';

export const lessonPrimaryMediaFields = [
  defineField({
    name: 'media',
    title: 'Media / Product Image',
    description: 'Upload a 16:9 image',
    type: 'image',
    group: 'media',
    options: { hotspot: true },
  }),
  defineField({
    name: 'textOverlay',
    title: 'Text Overlay Config',
    description:
      'Control the size and position of the frosted glass text card when an image is present.',
    type: 'object',
    group: 'media',
    components: { input: TextOverlayMapInput },
    hidden: ({ parent }) => !parent?.media,
    fields: [
      defineField({
        name: 'x',
        title: 'X Position (%)',
        description: 'Left offset',
        type: 'number',
        initialValue: 6,
        validation: (r) => r.min(0).max(100),
      }),
      defineField({
        name: 'y',
        title: 'Y Position (%)',
        description: 'Top offset',
        type: 'number',
        initialValue: 15,
        validation: (r) => r.min(0).max(100),
      }),
      defineField({
        name: 'width',
        title: 'Card Width',
        type: 'string',
        options: {
          list: [
            { title: 'Small', value: 'small' },
            { title: 'Medium', value: 'medium' },
            { title: 'Large', value: 'large' },
            { title: 'Full Width', value: 'full' },
          ],
        },
        initialValue: 'medium',
      }),
    ],
  }),
];

export const lessonSecondaryMediaFields = [
  defineField({
    name: 'videoFile',
    title: 'Video File',
    description: 'Upload an MP4 to Sanity CDN.',
    type: 'file',
    group: 'media',
    options: { accept: 'video/mp4' },
    hidden: ({ parent }) =>
      parent?.lessonType !== 'video' && parent?.lessonType !== 'splitScreen',
  }),
  defineField({
    name: 'videoAspectRatio',
    title: 'Video Aspect Ratio',
    type: 'string',
    group: 'media',
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
    hidden: ({ parent }) =>
      parent?.lessonType !== 'video' && parent?.lessonType !== 'splitScreen',
  }),
  defineField({
    name: 'stageBackground',
    title: 'Stage Background Image',
    description:
      'Upload a 16:9 image. Optional full-bleed background for Product Stage lessons. If omitted, a gradient is used.',
    type: 'image',
    group: 'media',
    options: { hotspot: true },
    hidden: ({ parent }) => parent?.lessonType !== 'stage',
  }),
];
