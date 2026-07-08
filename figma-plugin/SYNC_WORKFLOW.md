# Figma Sync Workflow

## Source of truth

- `Figma` is the visual source of truth for:
  - spacing
  - coordinates
  - alignment
  - casing shown on canvas
  - frame composition
- `figma-plugin/src/board-defaults.ts` is the generation source of truth for:
  - default content
  - typography preferences
  - frame-level header alignment
  - labels
  - screenshot placeholders
  - board/page configuration
- `figma-plugin/src/code.ts` is the renderer/orchestration layer.

## Ongoing workflow

1. Make visual edits in `Moto Tutor AI · App Flow Board`.
2. When a section is stable, pull those edits back into the plugin.
3. Update:
   - `src/board-defaults.ts` for content changes
   - `src/board-defaults.ts` `style` section for typography/alignment changes
   - `src/code.ts` for layout/geometry changes
4. Rebuild with `npm run figma:build`.
5. Regenerate from the plugin when needed.

## Rule

Do not expect manual Figma edits to persist after regeneration unless they have been synced back into the plugin.

## Practical split

- Content edits:
  - titles
  - subtitles
  - bullet copy
  - card labels
  - screenshot names
  - update `src/board-defaults.ts`

- Presentation-style edits:
  - preferred font family / styles
  - fallback font family / styles
  - display / subtitle / body scale
  - centered header frames
  - update `src/board-defaults.ts` `style`

- Layout edits:
  - x/y positions
  - widths/heights
  - gaps
  - card stacking
  - frame-specific alignment
  - update `src/code.ts`

## Future improvement

If pullbacks remain frequent, add a plugin mode that exports current frame metadata as JSON so Figma-to-plugin sync becomes more direct and less manual.
