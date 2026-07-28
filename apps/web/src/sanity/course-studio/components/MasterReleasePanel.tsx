import { Button, Card, Flex, Stack, Text } from '@sanity/ui';
import type { AuthoringCourse } from '../authoring-types';

interface MasterReleasePanelProps {
  course: AuthoringCourse;
  disabled?: boolean;
  onFreeze: () => void;
}

export function MasterReleasePanel({ course, disabled, onFreeze }: MasterReleasePanelProps) {
  const releaseCount = course.masterReleases?.length ?? 0;
  return (
    <Card border padding={4} radius={3} tone="transparent">
      <Stack space={3}>
        <Flex align="center" justify="space-between">
          <Stack space={1}>
            <Text size={1} weight="semibold">Master history</Text>
            <Text muted size={0}>Freeze the complete authored Course as a Lionbridge master record.</Text>
          </Stack>
          <Button disabled={disabled} onClick={onFreeze} text="Freeze master" tone="primary" />
        </Flex>
        <Text muted size={0}>
          {releaseCount === 0
            ? 'No masters frozen yet.'
            : `${releaseCount} master ${releaseCount === 1 ? 'release' : 'releases'} linked to this Course.`}
        </Text>
      </Stack>
    </Card>
  );
}
