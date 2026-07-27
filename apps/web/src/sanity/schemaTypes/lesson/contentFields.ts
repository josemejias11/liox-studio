import { defineField } from 'sanity';
import { layerLinkAnnotation, richTextDecorators } from './richText';

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
          annotations: [layerLinkAnnotation],
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
    title: 'Quick Recall Topic',
    description: 'Optional title shown above this lesson’s Quick Recall activity.',
    type: 'string',
    group: 'content',
  }),
  defineField({
    name: 'coveredFeatures',
    title: 'Quick Recall Features',
    description: 'Learners reveal every answer before continuing.',
    type: 'array',
    group: 'content',
    of: [
      {
        type: 'object',
        name: 'coveredFeature',
        fields: [
          defineField({
            name: 'label',
            title: 'Recall Prompt',
            description: 'The feature name or question learners see before revealing the answer.',
            type: 'string',
            validation: (r) => r.required(),
          }),
          defineField({
            name: 'summary',
            title: 'Revealed Answer',
            description: 'A concise answer shown after the learner chooses Reveal answer.',
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
