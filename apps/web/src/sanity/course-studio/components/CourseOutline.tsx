import { Button, Card, Flex, Stack, Text } from '@sanity/ui';
import type { AuthoringCourse, AuthoringSelection } from '../authoring-types';

interface CourseOutlineProps {
  course: AuthoringCourse;
  selection: AuthoringSelection;
  disabled?: boolean;
  onAddChapter: () => void;
  onSelect: (selection: AuthoringSelection) => void;
}

export function CourseOutline({ course, selection, disabled, onAddChapter, onSelect }: CourseOutlineProps) {
  return (
    <Stack space={3}>
      <Flex align="center" justify="space-between">
        <Text size={1} weight="semibold">Course flow</Text>
        <Button disabled={disabled} fontSize={1} mode="ghost" onClick={onAddChapter} text="Add chapter" />
      </Flex>
      <Button
        mode={selection.kind === 'course' ? 'default' : 'ghost'}
        onClick={() => onSelect({ kind: 'course', courseId: course._id })}
        text={course.title ?? 'Untitled course'}
      />
      {course.chapters.map((chapter, chapterIndex) => (
        <Card border key={chapter._id} padding={3} radius={2} tone="transparent">
          <Stack space={2}>
            <Button
              mode={selection.kind === 'chapter' && selection.chapterId === chapter._id ? 'default' : 'ghost'}
              onClick={() => onSelect({ kind: 'chapter', courseId: course._id, chapterId: chapter._id })}
              text={`${chapterIndex + 1}. ${chapter.title ?? 'Untitled chapter'}`}
            />
            <Stack space={1}>
              {chapter.lessons.map((lesson, lessonIndex) => (
                <Button
                  key={lesson._id}
                  mode={selection.kind === 'lesson' && selection.lessonId === lesson._id ? 'default' : 'bleed'}
                  onClick={() => onSelect({
                    kind: 'lesson',
                    courseId: course._id,
                    chapterId: chapter._id,
                    lessonId: lesson._id,
                  })}
                  text={`${chapterIndex + 1}.${lessonIndex + 1} ${lesson.headline ?? 'Untitled screen'}`}
                />
              ))}
              {chapter.quickCheck && <Text muted size={0}>Quick Check · {chapter.quickCheck.title ?? 'Untitled'}</Text>}
            </Stack>
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}
