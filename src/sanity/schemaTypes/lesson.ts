import { Presentation } from 'lucide-react';
import { defineType } from 'sanity';
import { lessonConfigurationFields, lessonCoreContentFields } from './lesson/contentFields';
import { lessonInteractionFields } from './lesson/interactionFields';
import { lessonPrimaryMediaFields, lessonSecondaryMediaFields } from './lesson/mediaFields';
import { lessonCompletionFields, lessonSpecializedFields } from './lesson/specializedFields';

export const lessonType = defineType({
  name: 'lesson',
  title: 'Lesson',
  type: 'document',
  icon: Presentation,
  groups: [
    { name: 'content', title: 'Content', default: true },
    { name: 'media', title: 'Media' },
    { name: 'interactions', title: 'Interactions' },
    { name: 'completion', title: 'Completion Animation' },
  ],
  fields: [
    ...lessonCoreContentFields,
    ...lessonPrimaryMediaFields,
    ...lessonConfigurationFields,
    ...lessonSecondaryMediaFields,
    ...lessonSpecializedFields,
    ...lessonInteractionFields,
    ...lessonCompletionFields,
  ],
  preview: {
    select: { title: 'headline', subtitle: 'lessonType', media: 'media' },
  },
});
