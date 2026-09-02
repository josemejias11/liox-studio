# Course theme system

Status: Draft
Date: 2026-09-02

## Background

Course Studio was built exclusively for Motorola content. Motorola's brand
colors are hardcoded as the only options for a course's cover CTA button:

```ts
// apps/web/src/shared/contracts/course-settings.ts
const coverButtonColorSchema = z.enum(['moto-indigo', 'moto-frost', 'moto-pearl']);
```

These literal values flow through the authoring inspector
(`apps/web/src/authoring/inspectors/course-inspector-draft.ts`) and the
player (`apps/web/src/learning/player/CourseCover.tsx`), and are persisted
in `Course.cover` (a JSON column) and frozen into
`CourseRevision.snapshot` once a course is reviewed.

Course Studio is expected to become a shared authoring platform across
multiple Lionbridge accounts (Motorola, Yamaha, Lenovo confirmed so far).
Each account has its own brand identity. The current schema has no concept
of "which client's colors apply to this course" — it only has Motorola's
literal color names as the entire option set.

This spec covers introducing a **course-level theme** so a course can
declare which client's visual identity it uses, with Motorola's existing
colors becoming the first theme (`moto-theme`) and a `yamaha-theme` stub
added as the second, unpopulated theme to prove the system is genuinely
pluggable — not to invent Yamaha's real brand yet.

## Goals

- A course has an explicit `theme` (`'moto-theme' | 'yamaha-theme'`),
  defaulting existing and new courses to `'moto-theme'` so today's
  Motorola content renders identically, unchanged.
- `coverButtonColor` becomes a theme-relative semantic choice
  (`'primary' | 'secondary' | 'tertiary'`) instead of a literal Motorola
  color name, resolved against the course's theme at render time.
- Adding a future real client theme (populating `yamaha-theme`'s real
  colors, or adding a `lenovo-theme`) is a registry-entry change, not a
  schema or contract change.
- A reviewed `CourseRevision` keeps the theme it was reviewed with, even
  if a course's live theme changes afterward — consistent with how the
  rest of course settings freeze today.

## Non-goals (explicitly out of scope)

- **Per-theme fonts.** `MotoSans` stays the one global font
  (`apps/web/src/app/globals.css`, and the font files the job-worker
  bundles into SCORM exports in `apps/job-worker/src/handlers.ts`) for
  now. Making the font theme-aware means changing both the web app's font
  loading and the SCORM export bundling pipeline — real work with no
  concrete second font to justify it yet. Revisit once a client supplies
  real brand font assets.
- **Real Yamaha brand values.** `yamaha-theme`'s color tokens are
  explicit placeholders. This spec proves the plumbing, not the brand.
- **A database-backed theme table / admin UI for editing themes.** With
  two-to-three known clients, an in-code registry is enough; a DB-backed
  system would add real complexity (a `Theme` table, an editing surface,
  cache invalidation) for configurability nobody has asked for.
- **The `moto-ai` → Lionbridge tool/repo rebrand**, and internal renames
  like `MotoViewer` → `CoursePlayer`. Tracked as a separate sub-project;
  this spec is theming only.

## Design

### Data model

Add a `theme` column to `Course` (`packages/database/prisma/schema.prisma`):

```prisma
model Course {
  // ...existing fields
  theme String @default("moto-theme")
}
```

A plain `String` column (not a Prisma enum) matches how the codebase
already treats extensible small-vocabulary fields — validation lives in
the Zod contract, not the database, so adding a theme later needs no
migration to widen a DB enum.

Migration: add the column with `DEFAULT 'moto-theme'`, so every existing
course keeps rendering with today's Motorola colors with zero data
backfill required.

### Theme registry

New module: `packages/contracts/src/course-themes.ts`.

```ts
export const courseThemeSchema = z.enum(['moto-theme', 'yamaha-theme']);
export type CourseTheme = z.output<typeof courseThemeSchema>;

interface ThemeTokens {
  label: string; // shown in the authoring theme picker
  buttonColors: {
    primary: string; // Tailwind class(es) applied for 'primary'
    secondary: string;
    tertiary: string;
  };
}

export const COURSE_THEMES: Record<CourseTheme, ThemeTokens> = {
  'moto-theme': {
    label: 'Motorola',
    buttonColors: {
      primary: 'bg-accent text-white hover:bg-accent/90', // today's moto-indigo
      secondary: 'bg-background text-foreground hover:bg-background/90', // today's moto-frost
      tertiary: 'bg-card text-foreground hover:bg-card/90', // today's moto-pearl
    },
  },
  'yamaha-theme': {
    label: 'Yamaha (placeholder)',
    buttonColors: {
      // Grayscale stand-ins, deliberately distinct from Motorola's palette
      // so nobody mistakes these for a real Yamaha brand choice.
      // TODO: replace with Yamaha's real brand colors once supplied.
      primary: 'bg-neutral-700 text-white hover:bg-neutral-700/90',
      secondary: 'bg-neutral-300 text-black hover:bg-neutral-300/90',
      tertiary: 'bg-neutral-100 text-black hover:bg-neutral-100/90',
    },
  },
};
```

Both `apps/web` (authoring + player) and `apps/job-worker` (SCORM export,
if it ever needs button styling outside the bundled player JS) import
this from `@moto-ai/contracts` — one source of truth, matching how
`CourseImageReferenceSchema` is already shared today.

### Contract changes

`apps/web/src/shared/contracts/course-settings.ts`:

- `coverButtonColorSchema` changes from the literal Motorola enum to
  `z.enum(['primary', 'secondary', 'tertiary'])`.
- `courseSettingsInputSchema` gains a top-level `theme: courseThemeSchema`
  field (default `'moto-theme'`), separate from `cover` — theme is a
  course-wide property, not a cover-page-specific one.

### Resolution in the player

`apps/web/src/learning/player/CourseCover.tsx` currently does:

```ts
if (buttonColor === 'moto-indigo' || buttonColor?.toLowerCase() === '#685bc7') {
  btnClass = /* ... */;
} else if (buttonColor === 'moto-frost') btnClass = /* ... */;
else if (buttonColor === 'moto-pearl') btnClass = /* ... */;
```

This becomes a lookup against the resolved theme's token set:

```ts
const tokens = COURSE_THEMES[course.theme].buttonColors;
const btnClass = buttonColor ? tokens[buttonColor] : tokens.primary;
```

The legacy `#685bc7` hex-string fallback branch is dropped — it's dead
code from before the enum existed (nothing in the current schema can
produce that value).

### Authoring UI

`apps/web/src/authoring/inspectors/course-inspector-draft.ts` and its
inspector component gain:

- A theme picker (a simple select) scoped to the course, listing
  `COURSE_THEMES` by `label`.
- The existing cover-button-color picker keeps its position in the UI but
  its options become `Primary / Secondary / Tertiary`, swatched using the
  *currently selected theme's* resolved colors — so an author picking
  "Primary" sees the actual color their theme will render, without ever
  needing to know the underlying theme's class names.

### Revision freeze

`CourseRevision.snapshot` already copies the full course graph verbatim
at review time (see `CLAUDE.md`'s data model section) — `theme` rides
along for free as part of that existing snapshot mechanism. No new
freeze logic is needed, only confirming the snapshot-building code copies
the new `theme` field along with the rest of `Course` (it does, since it
serializes the course record as-is).

## Migration plan

1. Prisma migration: add `Course.theme` (`String`, `@default("moto-theme")`).
2. Contracts: add `course-themes.ts`, update `course-settings.ts`'s
   `coverButtonColorSchema` and add `theme` to
   `courseSettingsInputSchema`.
3. Backfill mapping for existing stored `cover.coverButtonColor` values:
   a one-time data migration script maps
   `'moto-indigo' → 'primary'`, `'moto-frost' → 'secondary'`,
   `'moto-pearl' → 'tertiary'` in both `Course.cover` and any
   `CourseRevisionSource`/snapshot copies that stored the old literal
   values, so existing courses keep the exact same rendered color after
   the schema change.
4. Update `CourseCover.tsx` to the theme-token lookup.
5. Add the authoring theme picker and re-skin the button-color picker as
   Primary/Secondary/Tertiary swatches.
6. Update any other reader of the old literal color strings uncovered
   during implementation (the `grep` done during design found the enum
   itself, `CourseCover.tsx`, and `course-inspector-draft.ts` as the only
   production call sites; `apps/web/src/learning/player/safe-storage.ts`,
   `lesson-types/CanvasInspectionLesson.tsx`, and
   `lesson-types/Hotspot.tsx` matched only on unrelated "moto" tokens
   during the initial grep and should be re-checked at implementation
   time for any additional coverButtonColor references before treating
   step 3 as complete).

## Testing

- Contract-level: `coverButtonColorSchema` and `courseThemeSchema` accept
  only their new valid values and reject the old literal Motorola names.
- Migration: a course with each of the three legacy `coverButtonColor`
  values renders an identical button class before and after migration.
- Player: `CourseCover` renders the correct class for each of
  `primary`/`secondary`/`tertiary` under both `moto-theme` and
  `yamaha-theme`.
- Authoring: selecting a theme in the inspector updates the swatch colors
  shown for the button-color picker.
- No JS/TS test runner exists in this repo today (per `CLAUDE.md`) — these
  should be manual verification via `npm run dev` plus `npm run typecheck`
  unless the user asks to add a runner as separate, explicit work.

## Open questions

- Where should the theme picker live in the inspector UI relative to the
  existing cover settings — same panel, or its own top-level course
  settings section? (Implementation-time UI call, not a design blocker.)
