# Task 3 — Editor parity

## Delivery

- Added constrained Portable Text authoring for lesson, hotspot, and scroll-story body fields. It preserves original blocks until edited, supports bold, italic, superscript, bullets, and lesson-local `layerLink` cues, and rejects cues whose hotspot or covered-feature target no longer exists.
- Added inspector-local visual hotspot placement (click add, pointer drag, selection, Delete/Backspace removal, and arrow-key adjustment) with existing numeric `x`/`y` fields retained as the serialization boundary.
- Added drag-first text-overlay placement with `small`, `medium`, `large`, and `full` widths plus exact numeric fallbacks.
- Restored authenticated per-item asset authoring through the existing course asset endpoint for hotspot galleries and video, quiz images, color-variant images, and story-chapter images. The field performs client MIME/50 MB checks, reports upload status/errors, and retains the existing nested asset-reference payload.
- Extended draft validation and serialization only for editor-owned data; unknown row payload keys and untouched original rich-text blocks remain preserved.

## Verification

- `npx eslint` over all Task 3 files: passed with no findings.
- `npm run lint`: exited 0; existing warning only in `packages/database/src/course-repository.ts` for unused `CourseGraphChapter`.
- `git diff --check`: passed.
- `npm run typecheck`: blocked outside Task 3 by missing `@moto-ai/database` exports in `apps/web/src/app/course/[slug]/page.tsx` and `apps/web/src/app/page.tsx`; Task 3 files produced no diagnostics.

## Limitation

- Authenticated Studio/browser verification was not run in this task session because the repository-wide typecheck prerequisite is already blocked by the unrelated database export regression.
