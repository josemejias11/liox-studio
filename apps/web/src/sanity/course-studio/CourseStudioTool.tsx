import { useCallback, useEffect, useState } from 'react';
import { Box, Button, Card, Flex, Stack, Text } from '@sanity/ui';
import { useClient } from 'sanity';
import type { AuthoringCourse, AuthoringCourseSummary } from './authoring-types';
import { AUTHORING_COURSE_QUERY, AUTHORING_COURSES_QUERY } from './authoring-query';
import { createChapter, createLesson, createLionbridgeCourse, createMasterRelease, patchDocument } from './authoring-mutations';
import type { BlockType } from './block-catalog';
import { AuthoringShell } from './components/AuthoringShell';
import { MasterReleasePanel } from './components/MasterReleasePanel';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Course Studio could not load this course.';
}

export function CourseStudioTool() {
  const client = useClient({ apiVersion: '2025-07-27' });
  const [courses, setCourses] = useState<AuthoringCourseSummary[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<AuthoringCourse>();
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string>();

  const loadCourse = useCallback(
    async (courseId: string) => {
      setIsLoading(true);
      setError(undefined);
      try {
        const course = await client.fetch<AuthoringCourse | null>(AUTHORING_COURSE_QUERY, { courseId });
        if (!course) throw new Error('This Course no longer exists.');
        setSelectedCourse(course);
      } catch (nextError: unknown) {
        setError(errorMessage(nextError));
      } finally {
        setIsLoading(false);
      }
    },
    [client],
  );

  useEffect(() => {
    let isCurrent = true;
    void client
      .fetch<AuthoringCourseSummary[]>(AUTHORING_COURSES_QUERY)
      .then((nextCourses) => {
        if (!isCurrent) return;
        setCourses(nextCourses);
        setIsLoading(false);
      })
      .catch((nextError: unknown) => {
        if (!isCurrent) return;
        setError(errorMessage(nextError));
        setIsLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [client]);

  const refreshCourses = useCallback(async () => {
    setCourses(await client.fetch<AuthoringCourseSummary[]>(AUTHORING_COURSES_QUERY));
  }, [client]);

  const mutate = useCallback(async (action: () => Promise<void>) => {
    setIsMutating(true);
    setError(undefined);
    try {
      await action();
      await refreshCourses();
    } catch (nextError: unknown) {
      setError(errorMessage(nextError));
    } finally {
      setIsMutating(false);
    }
  }, [refreshCourses]);

  const handleCreateCourse = () => void mutate(async () => {
    const courseId = await createLionbridgeCourse(client);
    await loadCourse(courseId);
  });

  const handleAddChapter = () => {
    if (!selectedCourse) return;
    void mutate(async () => {
      await createChapter(client, selectedCourse._id);
      await loadCourse(selectedCourse._id);
    });
  };

  const handleAddLesson = (chapterId: string, type: BlockType) => {
    if (!selectedCourse) return;
    void mutate(async () => {
      await createLesson(client, chapterId, type);
      await loadCourse(selectedCourse._id);
    });
  };

  const handleSave = (documentId: string, values: Record<string, unknown>) => {
    if (!selectedCourse) return;
    void mutate(async () => {
      await patchDocument(client, documentId, values);
      await loadCourse(selectedCourse._id);
    });
  };

  const handleFreezeMaster = () => {
    if (!selectedCourse) return;
    void mutate(async () => {
      await createMasterRelease(client, selectedCourse);
      await loadCourse(selectedCourse._id);
    });
  };

  return (
    <Box padding={5} style={{ minWidth: 1180 }}>
      <Stack space={5}>
        <Flex align="center" justify="space-between">
          <Stack space={2}>
            <Text size={3} weight="bold">Course Studio</Text>
            <Text muted size={1}>Lionbridge authoring workspace for Motorola e-learning masters.</Text>
          </Stack>
          <Button disabled={isMutating} onClick={handleCreateCourse} text="Create a course" tone="primary" />
        </Flex>

        {error && <Card padding={4} radius={2} tone="critical"><Text>{error}</Text></Card>}

        <Card border padding={4} radius={3} tone="transparent">
          <Stack space={3}>
            <Text size={1} weight="semibold">Choose a course to author</Text>
            {isLoading && <Text muted>Loading Course Studio…</Text>}
            {!isLoading && courses.length === 0 && (
              <Text muted>No courses yet. Create the first Lionbridge course from the standard template.</Text>
            )}
            <Flex gap={2} wrap="wrap">
              {courses.map((course) => (
                <Button
                  key={course._id}
                  mode={selectedCourse?._id === course._id ? 'default' : 'ghost'}
                  onClick={() => void loadCourse(course._id)}
                  text={course.title ?? 'Untitled course'}
                />
              ))}
            </Flex>
          </Stack>
        </Card>

        {selectedCourse && (
          <Stack space={4}>
            <MasterReleasePanel course={selectedCourse} disabled={isMutating} onFreeze={handleFreezeMaster} />
            <AuthoringShell course={selectedCourse} isMutating={isMutating} onAddChapter={handleAddChapter} onAddLesson={handleAddLesson} onSave={handleSave} />
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
