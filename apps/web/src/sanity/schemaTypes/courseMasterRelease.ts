import { defineField, defineType } from 'sanity';

export const COURSE_MASTER_RELEASE_STATUSES = ['draft', 'ready', 'delivered', 'archived'] as const;

export type CourseMasterReleaseStatus = (typeof COURSE_MASTER_RELEASE_STATUSES)[number];

export const courseMasterReleaseType = defineType({
  name: 'courseMasterRelease',
  title: 'Course Master Release',
  type: 'document',
  fields: [
    defineField({
      name: 'sourceCourse',
      title: 'Source Course',
      type: 'reference',
      to: [{ type: 'course' }],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'sourceRevision',
      title: 'Source Revision',
      type: 'string',
      readOnly: true,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'sourceFingerprint',
      title: 'Source Fingerprint',
      type: 'string',
      readOnly: true,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'sourceTitle',
      title: 'Source Title',
      type: 'string',
      readOnly: true,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      initialValue: 'draft',
      options: { list: [...COURSE_MASTER_RELEASE_STATUSES] },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'snapshot',
      title: 'Frozen Authoring Snapshot',
      description: 'A complete Course Studio master snapshot. This is not an agency package.',
      type: 'text',
      readOnly: true,
      validation: (rule) => rule.required(),
    }),
    defineField({ name: 'notes', title: 'Notes', type: 'text' }),
    defineField({ name: 'deliveredAt', title: 'Delivered At', type: 'datetime', readOnly: true }),
  ],
  preview: {
    select: { title: 'sourceTitle', status: 'status', revision: 'sourceRevision' },
    prepare({ title, status, revision }) {
      return {
        title: title ?? 'Untitled master release',
        subtitle: [status, revision ? `Rev ${revision.slice(0, 12)}` : undefined]
          .filter(Boolean)
          .join(' · '),
      };
    },
  },
});
