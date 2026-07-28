import type { CourseGraph } from '@moto-ai/database';

export type { StudioTrashItem, StudioTrashMutation } from './studio-client';

export type StudioSelection =
  | { kind: 'course'; id: string }
  | { kind: 'chapter'; id: string }
  | { kind: 'lesson'; id: string };

export interface StudioMutationResult {
  course: CourseGraph;
}
