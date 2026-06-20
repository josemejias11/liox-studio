import { defineType, defineField } from 'sanity';
import { TextOverlayMapInput } from '../components/TextOverlayMapInput';

export const layerType = defineType({
  name: 'layer',
  title: 'Layer',
  type: 'object',
  fields: [
    defineField({
      name: 'layerType',
      title: 'Layer Type',
      type: 'string',
      options: {
        list: [
          { title: 'Content', value: 'content' },
          { title: 'Video', value: 'video' },
          { title: 'Quiz', value: 'quiz' },
        ],
        layout: 'radio',
      },
      initialValue: 'content',
    }),
    defineField({
      name: 'headline',
      title: 'Headline',
      type: 'string',
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'body',
      title: 'Body Copy',
      type: 'array',
      of: [{ type: 'block', marks: { decorators: [
        { title: 'Strong', value: 'strong' },
        { title: 'Emphasis', value: 'em' },
        { title: 'Underline', value: 'underline' },
        { title: 'Strike', value: 'strike-through' },
        { title: 'Code', value: 'code' },
        { title: 'Superscript', value: 'sup' },
      ] } }],
      hidden: ({ parent }) => parent?.layerType === 'interaction' || parent?.layerType === 'video',
    }),
    defineField({
      name: 'media',
      title: 'Media / Product Image',
      description: 'Upload a 16:9 image',
      type: 'image',
      options: { hotspot: true },
      hidden: ({ parent }) => parent?.layerType === 'interaction' || parent?.layerType === 'video',
    }),
    defineField({
      name: 'photos',
      title: 'Photo Gallery',
      description: 'Optional image carousel to display in the layer.',
      type: 'array',
      of: [{ type: 'image', options: { hotspot: true } }],
      hidden: ({ parent }) => parent?.layerType !== 'content' && parent?.layerType !== undefined,
    }),
    defineField({
      name: 'textOverlay',
      title: 'Text Overlay Config',
      description:
        'Control the size and position of the frosted glass text card when an image or carousel is present.',
      type: 'object',
      components: { input: TextOverlayMapInput },
      hidden: ({ parent }) =>
        (parent?.layerType !== 'content' && parent?.layerType !== undefined) ||
        (!parent?.media && !(parent?.photos?.length > 0)),
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

    defineField({
      name: 'videoFile',
      title: 'Video File',
      description: 'Upload an MP4 to Sanity CDN.',
      type: 'file',
      options: { accept: 'video/mp4' },
      hidden: ({ parent }) => parent?.layerType !== 'video',
    }),
    defineField({
      name: 'videoAspectRatio',
      title: 'Video Aspect Ratio',
      type: 'string',
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
      hidden: ({ parent }) => parent?.layerType !== 'video',
    }),
  ],
  preview: {
    select: { title: 'headline', subtitle: 'layerType', media: 'media' },
  },
});
