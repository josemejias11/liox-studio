import { defineField } from 'sanity';
import { richTextDecorators } from './richText';

export const lessonCoreContentFields = [
  defineField({
    name: 'headline',
    title: 'Headline',
    type: 'string',
    group: 'content',
    validation: (r) => r.required(),
  }),
  defineField({
    name: 'body',
    title: 'Body Copy',
    type: 'array',
    group: 'content',
    hidden: ({ parent }) => parent?.lessonType === 'scrollStory',
    of: [
      {
        type: 'block',
        marks: {
          decorators: richTextDecorators,
          annotations: [
            {
              name: 'layerLink',
              type: 'object',
              title: 'Layer Link',
              fields: [
                defineField({
                  name: 'linkedLayer',
                  type: 'string',
                  title: 'Linked Layer Headline',
                  description: 'The headline of the layer to open.',
                  validation: (r) => r.required(),
                }),
              ],
            },
          ],
        },
      },
    ],
  }),
];

export const lessonConfigurationFields = [
  defineField({
    name: 'lessonType',
    title: 'Lesson Type',
    type: 'string',
    group: 'content',
    options: {
      list: [
        { title: 'Content', value: 'content' },
        { title: 'Interaction (Hotspots)', value: 'interaction' },
        { title: 'Product Stage', value: 'stage' },
        { title: 'Video', value: 'video' },
        { title: 'Quiz (In-Lesson)', value: 'quiz' },
        { title: 'Canvas Product Inspection', value: 'canvas' },
        { title: 'Color Switcher', value: 'colorSwitcher' },
        { title: 'Split Screen', value: 'splitScreen' },
        { title: 'Drag & Drop', value: 'dragDrop' },
        { title: 'Scroll Story', value: 'scrollStory' },
      ],
      layout: 'radio',
    },
    initialValue: 'content',
  }),
  defineField({
    name: 'deviceName',
    title: 'Device Name',
    description: 'The device this refresher reviews.',
    type: 'string',
    group: 'content',
  }),
  defineField({
    name: 'coveredFeatures',
    title: 'Covered Features',
    description: 'Learners must open every listed feature before continuing.',
    type: 'array',
    group: 'content',
    of: [
      {
        type: 'object',
        name: 'coveredFeature',
        fields: [
          defineField({
            name: 'label',
            title: 'Feature Name',
            type: 'string',
            validation: (r) => r.required(),
          }),
          defineField({
            name: 'summary',
            title: 'Feature Review',
            description: 'A concise reminder of what the learner should remember.',
            type: 'text',
            rows: 3,
            validation: (r) => r.required(),
          }),
        ],
        preview: {
          select: { title: 'label', subtitle: 'summary' },
        },
      },
    ],
  }),
];
