import { defineArrayMember, defineField, defineType } from 'sanity';

export const COURSE_LOCALE_RELEASE_STATUSES = [
  'draft',
  'readyForExport',
  'exported',
  'returned',
  'qa',
  'approved',
  'published',
  'archived',
  'outdated',
] as const;

export type CourseLocaleReleaseStatus =
  (typeof COURSE_LOCALE_RELEASE_STATUSES)[number];

export const courseLocaleReleaseType = defineType({
  name: 'courseLocaleRelease',
  title: 'Course Locale Release',
  type: 'document',
  fields: [
    defineField({
      name: 'masterCourse',
      title: 'Master Course',
      type: 'reference',
      to: [{ type: 'course' }],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'locale',
      title: 'Locale',
      type: 'string',
      validation: (rule) =>
        rule.required().regex(/^[a-z]{2,3}(-[A-Z]{2})?$/, {
          name: 'locale',
          invert: false,
        }),
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      options: { list: [...COURSE_LOCALE_RELEASE_STATUSES] },
      initialValue: 'draft',
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
      name: 'unitCount',
      title: 'Unit Count',
      type: 'number',
      readOnly: true,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'localizationUnits',
      title: 'Localization Units',
      type: 'array',
      readOnly: true,
      of: [
        defineArrayMember({
          name: 'localizationUnit',
          title: 'Localization Unit',
          type: 'object',
          fields: [
            defineField({
              name: 'unitId',
              title: 'Unit ID',
              type: 'string',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'sourceText',
              title: 'Source Text',
              type: 'text',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'kind',
              title: 'Kind',
              type: 'string',
              options: { list: ['plainText', 'portableTextSpan'] },
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'context',
              title: 'Context',
              type: 'string',
              validation: (rule) => rule.required(),
            }),
          ],
        }),
      ],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'notes',
      title: 'Notes',
      type: 'text',
    }),
    defineField({
      name: 'exportedAt',
      title: 'Exported At',
      type: 'datetime',
      readOnly: true,
    }),
    defineField({
      name: 'returnedAt',
      title: 'Returned At',
      type: 'datetime',
      readOnly: true,
    }),
    defineField({
      name: 'approvedAt',
      title: 'Approved At',
      type: 'datetime',
      readOnly: true,
    }),
  ],
  preview: {
    select: {
      sourceTitle: 'sourceTitle',
      locale: 'locale',
      status: 'status',
      unitCount: 'unitCount',
    },
    prepare({ sourceTitle, locale, status, unitCount }) {
      return {
        title: [sourceTitle, locale].filter(Boolean).join(' — '),
        subtitle: [status, typeof unitCount === 'number' ? `${unitCount} units` : undefined]
          .filter(Boolean)
          .join(' · '),
      };
    },
  },
});
