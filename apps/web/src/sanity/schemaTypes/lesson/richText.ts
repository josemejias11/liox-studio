import { defineField } from 'sanity';

export const richTextDecorators = [
  { title: 'Strong', value: 'strong' },
  { title: 'Emphasis', value: 'em' },
  { title: 'Underline', value: 'underline' },
  { title: 'Strike', value: 'strike-through' },
  { title: 'Code', value: 'code' },
  { title: 'Superscript', value: 'sup' },
];

export const layerLinkAnnotation = defineField({
  name: 'layerLink',
  type: 'object',
  title: 'Learning Cue',
  fields: [
    defineField({
      name: 'linkedLayer',
      type: 'string',
      title: 'Linked Feature Label',
      description: 'Must match a hotspot or covered feature label in this lesson.',
      validation: (rule) => rule.required(),
    }),
  ],
});
