import { defineType, defineField, defineArrayMember } from 'sanity';
import { CourseFileUploadInput } from '../components/CourseFileUploadInput';
import { CourseLocalizationInput } from '../components/CourseLocalizationInput';

export const courseType = defineType({
  name: 'course',
  title: 'Course',
  type: 'document',
  groups: [
    { name: 'content', title: 'Content' },
    { name: 'coverUi', title: 'Cover UI' },
    { name: 'settings', title: 'Settings' },
    { name: 'courseStudio', title: 'Course Studio' },
  ],
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      group: 'content',
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      group: 'content',
      options: {
        source: 'title',
        maxLength: 96,
        isUnique: (value, context) => context.defaultIsUnique(value, context),
      },
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      group: 'content',
      rows: 3,
    }),
    defineField({
      name: 'thumbnail',
      title: 'Thumbnail',
      description: 'Upload a 16:9 image',
      type: 'image',
      group: 'content',
      options: { hotspot: true },
    }),
    defineField({
      name: 'learningObjectives',
      title: 'Learning Objectives',
      type: 'array',
      group: 'content',
      of: [{ type: 'string' }],
    }),
    defineField({
      name: 'courseMode',
      title: 'Course Mode',
      description:
        'Standard courses use structured lesson screens. Canvas courses add spatial, product-inspection learning experiences.',
      type: 'string',
      group: 'settings',
      options: {
        list: [
          { title: 'Standard — informational', value: 'standard' },
          { title: 'Canvas — spatial learning experiences', value: 'canvas' },
        ],
        layout: 'radio',
      },
      initialValue: 'standard',
    }),
    defineField({
      name: 'chapters',
      title: 'Chapters',
      type: 'array',
      group: 'content',
      of: [{ type: 'reference', to: [{ type: 'chapter' }] }],
      validation: (r) => r.required().min(1),
    }),
    defineField({
      name: 'courseMaterial',
      title: 'Course Material',
      type: 'array',
      group: 'content',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'uploadedFile',
          fields: [
            defineField({ name: 'filename', type: 'string', title: 'Filename' }),
            defineField({ name: 'chunks', type: 'number', title: 'Chunks' }),
            defineField({ name: 'uploadedAt', type: 'string', title: 'Uploaded At' }),
          ],
        }),
      ],
      components: {
        input: CourseFileUploadInput,
      },
    }),
    defineField({
      name: 'specifications',
      title: 'Specification Sheets',
      description:
        'Tech spec sheets shown after all chapters complete. Course-level — not per chapter.',
      type: 'array',
      group: 'content',
      of: [
        {
          type: 'reference',
          to: [{ type: 'specification' }],
          validation: (r) =>
            r.custom(async (ref, context) => {
              const typedRef = ref as { _ref?: string } | undefined;
              if (!typedRef?._ref) return true;

              const currentDocId = context.document?._id?.replace(/^drafts\./, '');
              const draftId = `drafts.${currentDocId}`;
              const client = context.getClient({ apiVersion: '2024-01-01' });
              const count = await client.fetch<number>(
                `count(*[
                  _type == "course" &&
                  _id != $currentDocId &&
                  _id != $draftId &&
                  $specRef in specifications[]._ref
                ])`,
                { currentDocId, draftId, specRef: typedRef._ref },
              );

              return count > 0 ? 'This specification is already assigned to another course.' : true;
            }),
        },
      ],
    }),
    defineField({
      name: 'disclaimer',
      title: 'Disclaimer',
      description: 'Shown as the very last screen after quiz pass.',
      type: 'reference',
      group: 'content',
      to: [{ type: 'disclaimer' }],
      validation: (r) =>
        r.custom(async (ref, context) => {
          const typedRef = ref as { _ref?: string } | undefined;
          if (!typedRef?._ref) return true;

          const currentDocId = context.document?._id?.replace(/^drafts\./, '');
          const draftId = `drafts.${currentDocId}`;
          const client = context.getClient({ apiVersion: '2024-01-01' });
          const count = await client.fetch<number>(
            `count(*[
              _type == "course" &&
              _id != $currentDocId &&
              _id != $draftId &&
              disclaimer._ref == $disclaimerRef
            ])`,
            { currentDocId, draftId, disclaimerRef: typedRef._ref },
          );

          return count > 0 ? 'This disclaimer is already assigned to another course.' : true;
        }),
    }),
    defineField({
      name: 'coverImage',
      title: 'Cover Screen Image (optional)',
      description: 'Upload a 16:9 image. If not provided, the Thumbnail will be used.',
      type: 'image',
      group: 'coverUi',
      options: { hotspot: true },
    }),
    defineField({
      name: 'coverHeadline',
      title: 'Cover Headline (optional)',
      type: 'string',
      group: 'coverUi',
    }),
    defineField({
      name: 'coverButtonText',
      title: 'Start Button Text',
      type: 'string',
      group: 'coverUi',
      initialValue: 'start course',
    }),
    defineField({
      name: 'coverButtonColor',
      title: 'Start Button Color',
      description: 'Motorola 2026 brand-compliant button colors only.',
      type: 'string',
      group: 'coverUi',
      options: {
        list: [
          { title: 'Black (Primary)', value: 'moto-black' },
          { title: 'Moto Indigo (Accent)', value: 'moto-indigo' },
          { title: 'Frost (Light)', value: 'moto-frost' },
          { title: 'Pearl (Warm Light)', value: 'moto-pearl' },
        ],
        layout: 'radio',
      },
      initialValue: 'moto-black',
    }),
    defineField({
      name: 'published',
      title: 'Published',
      type: 'boolean',
      group: 'settings',
      initialValue: false,
    }),
    defineField({
      name: 'sourceLocale',
      title: 'Source Locale',
      type: 'string',
      group: 'courseStudio',
      initialValue: 'en-US',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'localizationReleases',
      title: 'Localization Releases',
      description:
        'Lionbridge-only release tracking. Agencies receive exported packages; they do not access Course Studio.',
      type: 'array',
      group: 'courseStudio',
      of: [{ type: 'reference', to: [{ type: 'courseLocaleRelease' }] }],
      components: {
        input: CourseLocalizationInput,
      },
    }),
  ],
  preview: {
    select: { title: 'title', subtitle: 'description', media: 'thumbnail' },
  },
});
