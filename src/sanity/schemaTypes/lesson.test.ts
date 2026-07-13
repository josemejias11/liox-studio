import { describe, expect, test } from 'vitest';

import { lessonType } from './lesson';

describe('Canvas lesson authoring', () => {
  test('offers Canvas Product Inspection as a lesson type', () => {
    const fields = lessonType.fields as Array<{ name?: string; options?: { list?: unknown[] } }>;
    const lessonTypeField = fields.find((field) => field.name === 'lessonType');

    expect(lessonTypeField?.options?.list).toContainEqual({
      title: 'Canvas Product Inspection',
      value: 'canvas',
    });
  });
});
