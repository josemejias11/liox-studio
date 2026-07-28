import { useState } from 'react';
import { Button, Card, Select, Stack, Text, TextArea, TextInput } from '@sanity/ui';
import type { AuthoringCourse, AuthoringSelection } from '../authoring-types';
import { BLOCK_CATALOG, type BlockType } from '../block-catalog';

interface SelectionInspectorProps {
  course: AuthoringCourse;
  selection: AuthoringSelection;
  disabled?: boolean;
  onSave: (documentId: string, values: Record<string, unknown>) => void;
}

function portableTextToPlainText(value: unknown): string {
  if (!Array.isArray(value)) return '';
  return value
    .flatMap((block) => (Array.isArray(block?.children) ? block.children : []))
    .map((child) => (typeof child?.text === 'string' ? child.text : ''))
    .filter(Boolean)
    .join('\n');
}

function plainTextToPortableText(value: string): Array<Record<string, unknown>> {
  return value.split('\n').filter(Boolean).map((text) => ({
    _key: crypto.randomUUID(),
    _type: 'block',
    style: 'normal',
    markDefs: [],
    children: [{ _key: crypto.randomUUID(), _type: 'span', text, marks: [] }],
  }));
}

export function SelectionInspector({ course, selection, disabled, onSave }: SelectionInspectorProps) {
  const chapter = selection.kind === 'course' ? undefined : course.chapters.find((item) => item._id === selection.chapterId);
  const lesson = selection.kind === 'lesson' ? chapter?.lessons.find((item) => item._id === selection.lessonId) : undefined;
  const title = lesson?.headline ?? chapter?.title ?? course.title ?? 'Untitled course';
  const kind = lesson?.lessonType ?? selection.kind;
  const documentId = lesson?._id ?? chapter?._id ?? course._id;
  const [draftTitle, setDraftTitle] = useState(title);
  const [bodyCopy, setBodyCopy] = useState(() => portableTextToPlainText(lesson?.body));
  const fieldName = lesson ? 'headline' : 'title';
  const type = (lesson?.lessonType ?? 'content') as BlockType;
  const saveCopy = { [fieldName]: draftTitle, ...(lesson ? { body: plainTextToPortableText(bodyCopy) } : {}) };

  return (
    <Stack space={3}>
      <Text size={1} weight="semibold">Inspector</Text>
      <Card border padding={4} radius={3} tone="transparent">
        <Stack space={3}>
          <Text size={1} weight="semibold">{title}</Text>
          <Text muted size={0}>Editing {kind} in the current authoring graph.</Text>
          <TextInput
            aria-label={fieldName === 'headline' ? 'Screen headline' : 'Title'}
            disabled={disabled}
            onChange={(event) => setDraftTitle(event.currentTarget.value)}
            value={draftTitle}
          />
          {lesson && (
            <>
              <Select
                aria-label="Learning block"
                disabled={disabled}
                onChange={(event) => onSave(documentId, { lessonType: event.currentTarget.value })}
                value={type}
              >
                {BLOCK_CATALOG.map((block) => <option key={block.type} value={block.type}>{block.title}</option>)}
              </Select>
              <TextArea
                aria-label="Body copy"
                disabled={disabled}
                onChange={(event) => setBodyCopy(event.currentTarget.value)}
                rows={8}
                value={bodyCopy}
              />
              <Text muted size={0}>Saving body copy intentionally replaces only this screen’s Portable Text blocks; untouched rich text and media remain unchanged.</Text>
            </>
          )}
          {chapter && !lesson && (
            <TextInput
              aria-label="Estimated duration in minutes"
              disabled={disabled}
              inputMode="numeric"
              onChange={(event) => onSave(documentId, { estimatedDuration: Number(event.currentTarget.value) || undefined })}
              placeholder="Estimated duration (minutes)"
              value={chapter.estimatedDuration?.toString() ?? ''}
            />
          )}
          <Button disabled={disabled} onClick={() => onSave(documentId, saveCopy)} text="Save changes" tone="primary" />
        </Stack>
      </Card>
    </Stack>
  );
}
