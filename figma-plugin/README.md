# Figma Plugin

This plugin supports both the canonical renderer and a read-only pull captured from the live Figma board.

Source of truth:

- `figma-plugin/src/board-defaults.ts` is the canonical content/style source.
- `figma-plugin/src/code.ts` is the canonical renderer/layout source.
- `figma-plugin/src/live-board-snapshot.ts` preserves the complete live page captured on 2026-07-10.
- The generated Figma board is output, not source.

Useful commands from the repo root:

```bash
npm run figma:build
npm run figma:watch
```

Current controls in `ui.html`:

- safe-copy restoration of the pulled live snapshot; this always creates a new page
- board title
- frame width / height
- frame gap
- page-group selection
- clear existing generated pages
- screenshot placeholder toggles
- full board content JSON, including the top-level `style` object for typography and frame alignment overrides
