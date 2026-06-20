import { defineType, defineField, defineArrayMember } from 'sanity';
import { ShieldAlert } from 'lucide-react';

export const disclaimerType = defineType({
  name: 'disclaimer',
  title: 'Disclaimer',
  type: 'document',
  icon: ShieldAlert,
  groups: [
    { name: 'content', title: 'Content', default: true },
    { name: 'settings', title: 'Settings' },
  ],
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      description: "Internal reference title (e.g. 'SAR Disclosure' or 'Regulatory Notice').",
      type: 'string',
      group: 'content',
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      group: 'content',
      options: {
        list: [
          { title: 'Legal', value: 'legal' },
          { title: 'Safety', value: 'safety' },
          { title: 'Regulatory', value: 'regulatory' },
          { title: 'Warranty', value: 'warranty' },
          { title: 'General', value: 'general' },
        ],
        layout: 'radio',
      },
      initialValue: 'general',
    }),
    defineField({
      name: 'body',
      title: 'Disclaimer Body',
      description: 'Introductory paragraph shown above the numbered disclaimers.',
      type: 'text',
      group: 'content',
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'disclaimers',
      title: 'Disclaimers',
      description: 'Each entry becomes a numbered item.',
      type: 'array',
      group: 'content',
      of: [defineArrayMember({ type: 'string' })],
    }),
    defineField({
      name: 'acknowledgementRequired',
      title: 'Require Acknowledgement',
      description: "Learner must tap an 'I Acknowledge' button to continue.",
      type: 'boolean',
      group: 'settings',
      initialValue: false,
    }),
    defineField({
      name: 'acknowledgementLabel',
      title: 'Acknowledgement Button Label',
      type: 'string',
      group: 'settings',
      initialValue: 'I Acknowledge',
      hidden: ({ parent }) => !parent?.acknowledgementRequired,
    }),
  ],
  preview: {
    select: { title: 'title', subtitle: 'category' },
    prepare({ title, subtitle }) {
      const labels: Record<string, string> = {
        legal: '⚖️ Legal',
        safety: '⚠️ Safety',
        regulatory: '🏛️ Regulatory',
        warranty: '🛡️ Warranty',
        general: '📋 General',
      };
      return { title: title ?? 'Untitled Disclaimer', subtitle: labels[subtitle] ?? subtitle };
    },
  },
});
