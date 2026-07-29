# Course Studio Bottom Tools Workspace

## Goal

Move the Course Studio inspector and revision tools below the learner canvas
so authors have more horizontal canvas real estate while retaining immediate
access to editing controls.

## Current layout

The editor uses a desktop three-column grid: course outline on the left,
learner canvas in the center, and a narrow right column containing the
inspector above the revision panel. Focus preview is already a separate
full-canvas mode and remains unchanged.

## Design

On wide screens, replace the three-column editor grid with a two-column,
two-row composition:

- The course outline remains in the left column and spans both rows.
- The learner canvas occupies the full center width in the first row.
- A bottom tools dock occupies the center width in the second row.
- The dock remains visible by default, has a bounded height, and scrolls its
  inspector content internally when needed.
- The inspector and revision panel remain separate vertical sections inside
  the dock so existing behavior and component ownership are preserved.

On smaller screens, the layout remains a single vertical flow: outline, canvas,
then the visible tools dock. Focus preview continues to hide editing tools and
use the full available area.

## Boundaries

- Do not change Studio selection, save, revision, trash, preview, or auth
  behavior.
- Do not create a collapsed-by-default tools control; the dock is visible by
  default as explicitly chosen.
- Keep the existing `CourseOutline`, `StudioInspector`, and `RevisionPanel`
  components; change only their layout container and responsive sizing.
- Do not create automated test files; verify with typecheck, lint, build, diff
  checks, and Chrome DevTools/Playwright browser evidence.

## Acceptance criteria

- On wide screens, the learner canvas is wider than in the current right-panel
  layout.
- The inspector and revisions are visible below the canvas without requiring a
  new interaction to reveal them.
- Long inspector content scrolls inside the tools dock rather than forcing the
  entire editor page to become unusable.
- The outline remains available on the left and spans the editor height.
- Focus preview remains a full-canvas presentation.
- Smaller screens preserve a usable vertical order and visible tools.
