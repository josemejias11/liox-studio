import { Button, Card, Grid, Stack, Text } from '@sanity/ui';
import { BLOCK_CATALOG, type BlockType } from '../block-catalog';

interface BlockLibraryProps {
  disabled?: boolean;
  onAdd: (type: BlockType) => void;
}

export function BlockLibrary({ disabled, onAdd }: BlockLibraryProps) {
  return (
    <Stack space={3}>
      <Text size={1} weight="semibold">Add a learning screen</Text>
      <Grid columns={2} gap={2}>
        {BLOCK_CATALOG.map((block) => (
          <Card border key={block.type} padding={3} radius={2} tone="transparent">
            <Stack space={3}>
              <Text size={1} weight="semibold">{block.title}</Text>
              <Text muted size={0}>{block.description}</Text>
              <Button
                disabled={disabled}
                fontSize={1}
                onClick={() => onAdd(block.type)}
                text="Add screen"
                tone="primary"
              />
            </Stack>
          </Card>
        ))}
      </Grid>
    </Stack>
  );
}
