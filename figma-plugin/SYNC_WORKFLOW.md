# Figma Sync Workflow

## Source of truth

- `figma-plugin/src/board-defaults.ts` is the canonical source of truth for:
  - board copy
  - lesson type content
  - typography preferences
  - frame-level header alignment
  - labels
  - screenshot placeholders
  - board/page configuration
- `figma-plugin/src/code.ts` is the canonical source of truth for:
  - layout
  - geometry
  - spacing
  - frame composition
- `Figma` is generated output.

## Ongoing workflow

1. Make changes in the repo first.
2. Update:
   - `src/board-defaults.ts` for content and style changes
   - `src/code.ts` for layout and geometry changes
3. Rebuild with `npm run figma:build`.
4. Regenerate in Figma from the plugin.

## Rule

Do not expect manual Figma edits to persist after regeneration.

If something only exists on the canvas, it is not part of the system yet.

## Practical split

- Content and presentation:
  - titles
  - subtitles
  - lesson type flow text
  - card labels
  - screenshot names
  - preferred font family / styles
  - fallback font family / styles
  - display / subtitle / body scale
  - centered header frames
  - update `src/board-defaults.ts`

- Layout edits:
  - x/y positions
  - widths/heights
  - gaps
  - card stacking
  - frame-specific alignment
  - update `src/code.ts`

## Future improvement

If we ever want Figma to become editable without losing work, we need a deliberate reverse-sync feature. Until then, treat the plugin as canonical and Figma as a rendered artifact.
