import { defineType, defineField } from 'sanity';
import { TableProperties } from 'lucide-react';

export const specificationType = defineType({
  name: 'specification',
  title: 'Specification',
  type: 'document',
  icon: TableProperties,
  groups: [{ name: 'content', title: 'Content', default: true }],
  fields: [
    defineField({
      name: 'title',
      title: 'Spec Sheet Title',
      type: 'string',
      group: 'content',
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'subtitle',
      title: 'Subtitle',
      description: 'Optional secondary heading (e.g. product model or variant name).',
      type: 'string',
      group: 'content',
    }),
    defineField({
      name: 'heroImage',
      title: 'Hero Image',
      description: 'Optional product image displayed at the top of the spec sheet.',
      type: 'image',
      group: 'content',
      options: { hotspot: true },
    }),
    defineField({
      name: 'specGroups',
      title: 'Specification Groups',
      description:
        'Group related specs (e.g. Display, Battery, Camera). Each group becomes a section.',
      type: 'array',
      group: 'content',
      validation: (r) => r.required().min(1),
      of: [
        {
          type: 'object',
          name: 'specGroup',
          fields: [
            defineField({
              name: 'groupName',
              title: 'Group Name',
              type: 'string',
              validation: (r) => r.required(),
            }),
            defineField({
              name: 'specs',
              title: 'Specifications',
              type: 'array',
              validation: (r) => r.min(1),
              of: [
                {
                  type: 'object',
                  name: 'spec',
                  fields: [
                    defineField({
                      name: 'label',
                      title: 'Label',
                      type: 'string',
                      validation: (r) => r.required(),
                    }),
                    defineField({
                      name: 'value',
                      title: 'Value',
                      type: 'string',
                      validation: (r) => r.required(),
                    }),
                    defineField({
                      name: 'highlight',
                      title: 'Highlight this spec?',
                      description: 'Draws attention to key selling points.',
                      type: 'boolean',
                      initialValue: false,
                    }),
                  ],
                  preview: {
                    select: { title: 'label', subtitle: 'value' },
                  },
                },
              ],
            }),
          ],
          preview: {
            select: { title: 'groupName' },
            prepare({ title }) {
              return { title: title ?? 'Unnamed Group' };
            },
          },
        },
      ],
    }),
    defineField({
      name: 'footnotes',
      title: 'Footnotes',
      description: 'Optional legal or contextual notes displayed at the bottom of the spec sheet.',
      type: 'array',
      group: 'content',
      of: [{ type: 'string' }],
    }),
  ],
  preview: {
    select: { title: 'title', subtitle: 'subtitle', media: 'heroImage' },
  },
});
