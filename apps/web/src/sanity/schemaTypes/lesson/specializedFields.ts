import { defineField } from 'sanity';

export const lessonSpecializedFields = [
  defineField({
    name: 'colorVariants',
    title: 'Color Variants',
    description: 'Up to 4 images for the color switcher.',
    type: 'array',
    group: 'content',
    validation: (rule) => rule.max(4),
    hidden: ({ parent }) => parent?.lessonType !== 'colorSwitcher',
    of: [
      {
        type: 'object',
        fields: [
          defineField({
            name: 'label',
            title: 'Color Name',
            type: 'string',
            validation: (rule) => rule.required(),
          }),
          defineField({ name: 'colorHex', title: 'Color Hex (e.g. #FF0000)', type: 'string' }),
          defineField({
            name: 'image',
            title: 'Product Image',
            type: 'image',
            options: { hotspot: true },
            validation: (rule) => rule.required(),
          }),
        ],
        preview: {
          select: { title: 'label', subtitle: 'colorHex', media: 'image' },
        },
      },
    ],
  }),
  defineField({
    name: 'splitReverseLayout',
    title: 'Reverse Split Layout',
    description: 'If true, media is on the left and text is on the right.',
    type: 'boolean',
    group: 'content',
    initialValue: false,
    hidden: ({ parent }) => parent?.lessonType !== 'splitScreen',
  }),
];

export const lessonCompletionFields = [
  defineField({
    name: 'enableCompletionAnimation',
    title: 'Enable Gamified Completion',
    description: 'Trigger a special gamification animation when all hotspots are discovered.',
    type: 'boolean',
    group: 'completion',
    initialValue: false,
    hidden: ({ parent }) => parent?.lessonType !== 'stage',
  }),
  defineField({
    name: 'completionTransition',
    title: 'Completion Animation',
    description: 'Animation played after all hotspots are discovered.',
    type: 'string',
    group: 'completion',
    options: {
      list: [
        { title: 'Pulse & Glow (Premium product highlight)', value: 'spin' },
        { title: 'Rise (Content rises with light shift)', value: 'rise' },
        { title: 'Fade (Subtle fade out)', value: 'fade' },
      ],
      layout: 'radio',
    },
    initialValue: 'spin',
    hidden: ({ parent }) =>
      parent?.lessonType !== 'stage' || !parent?.enableCompletionAnimation,
  }),
];
