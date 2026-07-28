import { useMemo, useState } from 'react';
import { Box, Card, Flex, Stack, Text } from '@sanity/ui';
import type { AuthoringCourse, AuthoringSelection } from '../authoring-types';
import type { BlockType } from '../block-catalog';
import { BlockLibrary } from './BlockLibrary';
import { CourseOutline } from './CourseOutline';
import { SelectionInspector } from './SelectionInspector';

interface AuthoringShellProps {
  course: AuthoringCourse;
  isMutating?: boolean;
  onAddChapter: () => void;
  onAddLesson: (chapterId: string, type: BlockType) => void;
  onSave: (documentId: string, values: Record<string, unknown>) => void;
}

export function AuthoringShell({ course, isMutating, onAddChapter, onAddLesson, onSave }: AuthoringShellProps) {
  const [selection, setSelection] = useState<AuthoringSelection>({ kind: 'course', courseId: course._id });
  const activeChapter = useMemo(
    () =>
      selection.kind === 'course'
        ? course.chapters[0]
        : course.chapters.find((chapter) => chapter._id === selection.chapterId),
    [course.chapters, selection],
  );
  const activeLesson = useMemo(
    () =>
      selection.kind === 'lesson'
        ? activeChapter?.lessons.find((lesson) => lesson._id === selection.lessonId)
        : undefined,
    [activeChapter?.lessons, selection],
  );

  return (
    <Box style={{ minWidth: 1180 }}>
      <Flex gap={3} style={{ alignItems: 'stretch' }}>
        <Card border padding={4} radius={3} tone="transparent" style={{ width: 286, flexShrink: 0 }}>
          <CourseOutline course={course} disabled={isMutating} onAddChapter={onAddChapter} onSelect={setSelection} selection={selection} />
        </Card>

        <Stack space={3} style={{ flex: 1, minWidth: 0 }}>
          <Card border padding={4} radius={3} tone="transparent">
            <Stack space={3}>
              <Text muted size={0}>Live learner canvas</Text>
              <Card padding={5} radius={3} style={{ background: '#17182d', minHeight: 360 }}>
                <Stack space={4}>
                  <Text size={2} weight="bold" style={{ color: 'white' }}>{activeLesson?.headline ?? activeChapter?.title ?? course.title ?? 'Select a screen'}</Text>
                  <Text style={{ color: '#c7c9df' }}>
                    {activeLesson ? `${activeLesson.lessonType ?? 'content'} screen preview` : 'Select a learning screen in the course flow to preview it.'}
                  </Text>
                  <Card padding={4} radius={2} style={{ background: 'rgba(255,255,255,0.1)' }}>
                    <Text style={{ color: 'white' }}>The exact learner renderer is connected in the preview pass. This canvas already reflects author selection and reserves the final desktop composition.</Text>
                  </Card>
                </Stack>
              </Card>
            </Stack>
          </Card>

          <Card border padding={4} radius={3} tone="transparent">
            {activeChapter ? (
              <BlockLibrary disabled={isMutating} onAdd={(type) => onAddLesson(activeChapter._id, type)} />
            ) : (
              <Text muted>Create a chapter before adding learning screens.</Text>
            )}
          </Card>
        </Stack>

        <Card border padding={4} radius={3} tone="transparent" style={{ width: 320, flexShrink: 0 }}>
          <SelectionInspector
            course={course}
            disabled={isMutating}
            key={`${selection.kind}:${selection.kind === 'course' ? selection.courseId : selection.kind === 'chapter' ? selection.chapterId : selection.lessonId}:${course._rev}`}
            onSave={onSave}
            selection={selection}
          />
        </Card>
      </Flex>
    </Box>
  );
}
