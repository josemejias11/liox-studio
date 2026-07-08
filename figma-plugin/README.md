# Figma Plugin

This plugin is now built from `figma-plugin/src/code.ts`.

Source of truth:

- `figma-plugin/src/board-defaults.ts` is the canonical content/style source.
- `figma-plugin/src/code.ts` is the canonical renderer/layout source.
- The generated Figma board is output, not source.

Useful commands from the repo root:

```bash
npm run figma:build
npm run figma:watch
```

Current controls in `ui.html`:

- board title
- frame width / height
- frame gap
- page-group selection
- clear existing generated pages
- screenshot placeholder toggles
- full board content JSON, including the top-level `style` object for typography and frame alignment overrides
