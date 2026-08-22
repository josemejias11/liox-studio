export type { StudioTrashItem } from './studio-client';

export type StudioSelection =
  | { kind: 'course'; id: string }
  | { kind: 'cover'; id: string }
  | { kind: 'chapter'; id: string }
  | { kind: 'lesson'; id: string }
  | { kind: 'quickCheck'; id: string }
  | { kind: 'finalQuiz'; id: string };
