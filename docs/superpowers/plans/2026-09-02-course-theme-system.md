# Course Theme System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each course an explicit theme (`moto-theme` today, `yamaha-theme` as a placeholder) so the cover button's colors resolve from a shared registry instead of Motorola's colors being the only hardcoded option.

**Architecture:** Add a `theme` column to `Course` (default `moto-theme`), a `COURSE_THEMES` registry in `packages/contracts`, and change `coverButtonColor` from a Motorola-literal enum (`moto-indigo`/`moto-frost`/`moto-pearl`) to a theme-relative semantic slot (`primary`/`secondary`/`tertiary`) resolved against the course's theme at render time. A migration backfills existing stored `coverButtonColor` values so already-approved courses render identically.

**Tech Stack:** TypeScript, Zod, Prisma/PostgreSQL, Next.js (React). No JS/TS test runner exists in this repo (confirmed with the user) — verification is `npm run typecheck`, `npm run lint`, and manual checks via `npm run dev`, not automated tests.

**Spec:** `docs/superpowers/specs/2026-09-02-course-theme-system-design.md`

## Global Constraints

- `theme` defaults existing and new courses to `'moto-theme'` — zero behavior change for current Motorola content until an author explicitly changes it.
- `yamaha-theme`'s colors are deliberate grayscale placeholders (not a real Yamaha brand), per the spec's design.
- Font (`MotoSans`) stays global — not theme-aware. Out of scope per spec.
- No DB-backed theme table, no real Yamaha brand values, no `moto-ai`/`MotoViewer` rebrand — out of scope per spec.
- No automated tests exist in this repo; every task verifies via `npm run typecheck`, `npm run lint`, and a manual check, never invents a test file.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/contracts/src/course-themes.ts` (new) | `courseThemeSchema`, `CourseTheme` type, `COURSE_THEMES` registry (colors per theme) |
| `packages/contracts/src/index.ts` | Re-export the new module |
| `packages/contracts/package.json` | Add `./course-themes` subpath export |
| `packages/contracts/src/course-studio.ts` | `CourseGraph.theme`, `CourseGraphSchema.theme` |
| `packages/database/prisma/schema.prisma` | `Course.theme` column |
| `packages/database/prisma/migrations/<ts>_add_course_theme/migration.sql` (new) | Add column + backfill legacy `coverButtonColor` values |
| `packages/database/src/course-repository.ts` | `courseGraphSelect`, `CourseDetailsInput`, `updateCourseDetails` carry `theme` |
| `packages/database/src/course-duplication-repository.ts` | Duplicated courses copy the source's `theme` |
| `apps/web/src/shared/contracts/course-settings.ts` | `coverButtonColorSchema` → semantic slots; `theme` field on course settings |
| `apps/web/src/authoring/inspectors/course-inspector-draft.ts` | `CoverDraft`/`CourseFormDraft` carry `theme`; draft/payload mapping |
| `apps/web/src/authoring/inspectors/CourseInspector.tsx` | Theme picker UI; button-color picker becomes Primary/Secondary/Tertiary |
| `apps/web/src/shared/contracts/player-course.ts` | `courseSchema.theme` |
| `apps/web/src/learning/course-player-adapter.ts` | `rawCourse()` carries `theme` |
| `apps/web/src/learning/player/CourseCover.tsx` | Resolves button class from `COURSE_THEMES` instead of literal Motorola names |
| `apps/web/src/learning/player/CoursePhaseScreen.tsx` | Passes `theme` down to `CourseCover` |

---

### Task 1: Theme data layer — contracts, schema, and repository

This task is one unit because TypeScript's structural typing ties them together: `course-repository.ts`'s `toCourseGraph` is `return course` cast as `CourseGraph` — if `CourseGraph.theme` is required, the Prisma select must supply it in the same change, or the tree won't typecheck.

**Files:**
- Create: `packages/contracts/src/course-themes.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/package.json`
- Modify: `packages/contracts/src/course-studio.ts:105-121` (interface), `:148-165` (schema)
- Modify: `packages/database/prisma/schema.prisma` (`Course` model, after line 61 `disclaimer Json?`)
- Create: `packages/database/prisma/migrations/<timestamp>_add_course_theme/migration.sql`
- Modify: `packages/database/src/course-repository.ts:12-19` (`CourseDetailsInput`), `:68-91` (`courseGraphSelect`), `:260-280` (`updateCourseDetails`)
- Modify: `packages/database/src/course-duplication-repository.ts:167-182`

**Interfaces:**
- Produces: `courseThemeSchema: z.ZodEnum<['moto-theme', 'yamaha-theme']>`, `type CourseTheme = 'moto-theme' | 'yamaha-theme'`, `COURSE_THEMES: Record<CourseTheme, ThemeTokens>` where `ThemeTokens = { label: string; buttonColors: { primary: string; secondary: string; tertiary: string } }` — all exported from `@moto-ai/contracts/course-themes` and re-exported from `@moto-ai/contracts`.
- Produces: `CourseGraph.theme: string`, `CourseDetailsInput.theme?: string` — consumed by Task 2 (apps/web contracts) and Task 3 (player).

- [ ] **Step 1: Create the theme registry**

`packages/contracts/src/course-themes.ts`:

```ts
import { z } from 'zod';

export const courseThemeSchema = z.enum(['moto-theme', 'yamaha-theme']);
export type CourseTheme = z.output<typeof courseThemeSchema>;

export interface ThemeButtonColors {
  primary: string;
  secondary: string;
  tertiary: string;
}

export interface ThemeTokens {
  label: string;
  buttonColors: ThemeButtonColors;
}

export const COURSE_THEMES: Record<CourseTheme, ThemeTokens> = {
  'moto-theme': {
    label: 'Motorola',
    buttonColors: {
      primary: 'bg-accent text-white hover:bg-accent/90',
      secondary: 'bg-background text-foreground hover:bg-background/90',
      tertiary: 'bg-card text-foreground hover:bg-card/90',
    },
  },
  'yamaha-theme': {
    label: 'Yamaha (placeholder)',
    buttonColors: {
      // Grayscale stand-ins, deliberately distinct from Motorola's palette.
      // TODO: replace with Yamaha's real brand colors once supplied.
      primary: 'bg-neutral-700 text-white hover:bg-neutral-700/90',
      secondary: 'bg-neutral-300 text-black hover:bg-neutral-300/90',
      tertiary: 'bg-neutral-100 text-black hover:bg-neutral-100/90',
    },
  },
};

export const DEFAULT_COURSE_THEME: CourseTheme = 'moto-theme';
```

- [ ] **Step 2: Export it from the package**

In `packages/contracts/src/index.ts`, add a line (keep alphabetical with the rest):

```ts
export * from './course-themes';
```

In `packages/contracts/package.json`, add to `"exports"` (keep alphabetical):

```json
    "./course-themes": "./src/course-themes.ts",
```

- [ ] **Step 3: Add `theme` to `CourseGraph` and `CourseGraphSchema`**

In `packages/contracts/src/course-studio.ts`, add the import at the top of the file:

```ts
import { courseThemeSchema } from './course-themes';
```

In the `CourseGraph` interface (currently lines 105-121), add after `disclaimer: unknown | null;`:

```ts
  theme: string;
```

In `CourseGraphSchema` (currently starting line 148), add after `disclaimer: CourseGraphJsonValueSchema,`:

```ts
  theme: courseThemeSchema,
```

- [ ] **Step 4: Run contracts typecheck**

Run: `npm run typecheck --workspace=@moto-ai/contracts`
Expected: passes (the new module and field additions are self-contained within this package).

- [ ] **Step 5: Add the Prisma column**

In `packages/database/prisma/schema.prisma`, in `model Course`, add after the `disclaimer Json?` line:

```prisma
  theme                      String                @default("moto-theme")
```

- [ ] **Step 6: Generate and hand-edit the migration**

Run: `npm run db:migrate:dev` and when prompted for a migration name, use `add_course_theme`. This creates `packages/database/prisma/migrations/<timestamp>_add_course_theme/migration.sql` with the `ALTER TABLE "Course" ADD COLUMN "theme" TEXT NOT NULL DEFAULT 'moto-theme';` statement generated by Prisma.

After it's generated, open that `migration.sql` file and append the backfill statements, so existing stored `coverButtonColor` values (in both the live `Course.cover` JSON and any already-frozen `CourseRevision.snapshot` JSON) keep rendering the same button color under the new semantic names:

```sql
-- Backfill legacy Motorola-literal coverButtonColor values to theme-relative
-- semantic slots, so existing courses render identically after this change.
UPDATE "Course"
SET "cover" = jsonb_set(cover::jsonb, '{coverButtonColor}', '"primary"')
WHERE cover->>'coverButtonColor' = 'moto-indigo';

UPDATE "Course"
SET "cover" = jsonb_set(cover::jsonb, '{coverButtonColor}', '"secondary"')
WHERE cover->>'coverButtonColor' = 'moto-frost';

UPDATE "Course"
SET "cover" = jsonb_set(cover::jsonb, '{coverButtonColor}', '"tertiary"')
WHERE cover->>'coverButtonColor' = 'moto-pearl';

-- Same mapping inside already-frozen CourseRevision.snapshot, which mirrors
-- the CourseGraph shape (snapshot.cover.coverButtonColor). This preserves
-- exactly what a reviewer already approved rendered as; it does not change
-- any content, only the internal representation of the same visual choice.
UPDATE "CourseRevision"
SET "snapshot" = jsonb_set(snapshot::jsonb, '{cover,coverButtonColor}', '"primary"')
WHERE snapshot->'cover'->>'coverButtonColor' = 'moto-indigo';

UPDATE "CourseRevision"
SET "snapshot" = jsonb_set(snapshot::jsonb, '{cover,coverButtonColor}', '"secondary"')
WHERE snapshot->'cover'->>'coverButtonColor' = 'moto-frost';

UPDATE "CourseRevision"
SET "snapshot" = jsonb_set(snapshot::jsonb, '{cover,coverButtonColor}', '"tertiary"')
WHERE snapshot->'cover'->>'coverButtonColor' = 'moto-pearl';
```

Note: `CourseRevisionSource` (a different model) only stores source-file metadata (sha256, filename), not a course-graph copy — it needs no backfill.

- [ ] **Step 7: Verify the migration applied**

Run: `npm run db:generate`
Expected: Prisma client regenerates with `theme` on the `Course` model, no errors.

Run (with your local Postgres running and `DATABASE_URL` set):
```bash
psql "$DATABASE_URL" -c "SELECT column_name, column_default FROM information_schema.columns WHERE table_name = 'Course' AND column_name = 'theme';"
```
Expected: one row, `theme` / `'moto-theme'::text`.

If any pre-existing course had a legacy `coverButtonColor`, verify the backfill too:
```bash
psql "$DATABASE_URL" -c "SELECT id, cover->>'coverButtonColor' FROM \"Course\" WHERE cover->>'coverButtonColor' IS NOT NULL;"
```
Expected: only `primary`/`secondary`/`tertiary` values, never `moto-indigo`/`moto-frost`/`moto-pearl`.

- [ ] **Step 8: Wire the repository layer**

In `packages/database/src/course-repository.ts`:

In `CourseDetailsInput` (currently lines 12-19), add after `cover?: Prisma.InputJsonValue | null;`:

```ts
  theme?: string;
```

In `courseGraphSelect` (currently lines 68-91), add after `disclaimer: true,`:

```ts
  theme: true,
```

In `updateCourseDetails` (currently lines 260-280), add after the `input.cover` line:

```ts
      ...(input.theme !== undefined ? { theme: input.theme } : {}),
```

- [ ] **Step 9: Make duplication copy the source course's theme**

In `packages/database/src/course-duplication-repository.ts`, in the `tx.course.create({ data: {...} })` call (currently starting line 167), add after `disclaimer: jsonValue(graph.disclaimer),`:

```ts
          theme: graph.theme,
```

Without this, a duplicated course would silently fall back to the Prisma column default (`moto-theme`) instead of matching its source course's actual theme.

- [ ] **Step 10: Full-repo typecheck and lint**

Run: `npm run typecheck`
Expected: passes across every workspace — `CourseGraph.theme` is now backed by the Prisma select everywhere it's constructed.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 11: Commit**

```bash
git add packages/contracts packages/database
git commit -m "feat: add course theme data layer (moto-theme default, yamaha-theme placeholder)"
```

---

### Task 2: apps/web course-settings contract — semantic button-color slots

**Files:**
- Modify: `apps/web/src/shared/contracts/course-settings.ts:1-25` (imports, `coverButtonColorSchema`, `courseCoverSchema`), `:62-71` (`courseSettingsInputSchema`)

**Interfaces:**
- Consumes: `courseThemeSchema`, `DEFAULT_COURSE_THEME` from `@moto-ai/contracts/course-themes` (Task 1).
- Produces: `coverButtonColorSchema: z.ZodEnum<['primary', 'secondary', 'tertiary']>`, `courseSettingsInputSchema` now includes `theme: CourseTheme` (defaulted) — consumed by Task 4 (authoring UI).

- [ ] **Step 1: Update the color enum and add `theme` to course settings**

In `apps/web/src/shared/contracts/course-settings.ts`, add to the imports at the top:

```ts
import { courseThemeSchema, DEFAULT_COURSE_THEME } from '@moto-ai/contracts/course-themes';
```

Replace the existing line:

```ts
const coverButtonColorSchema = z.enum(['moto-indigo', 'moto-frost', 'moto-pearl']);
```

with:

```ts
const coverButtonColorSchema = z.enum(['primary', 'secondary', 'tertiary']);
```

In `courseSettingsInputSchema` (currently starting line 62), add a `theme` field alongside the existing top-level fields (e.g. after `cover: courseCoverSchema.nullable(),`):

```ts
    theme: courseThemeSchema.default(DEFAULT_COURSE_THEME),
```

- [ ] **Step 2: Typecheck and lint**

Run: `npm run typecheck --workspace=@moto-ai/web`
Expected: passes. (`coverButtonColorSchema`'s new values aren't referenced elsewhere in this file, and `theme`'s `.default()` makes it optional for any existing caller that doesn't send it yet.)

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Manual check via API**

With `npm run dev` running and Course Studio unlocked (`COURSE_STUDIO_PASSWORD`), pick an existing course id and confirm the settings PATCH endpoint now accepts (and defaults) `theme`:

```bash
curl -s -X PATCH "http://localhost:3000/api/course-studio/courses/<courseId>" \
  -H "Content-Type: application/json" \
  -H "Cookie: <your course-studio session cookie>" \
  -d '{"title":"<same existing title>","slug":"<same existing slug>","description":null,"learningObjectives":[],"cover":null,"specifications":[],"disclaimer":null}' | head -c 500
```

Expected: `200` response; the returned `course.theme` is `"moto-theme"` even though the request body didn't include it.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/shared/contracts/course-settings.ts
git commit -m "feat: make coverButtonColor theme-relative and add course theme setting"
```

---

### Task 3: Player rendering — resolve button color from the course's theme

**Files:**
- Modify: `apps/web/src/shared/contracts/player-course.ts:214-226` (`courseSchema`)
- Modify: `apps/web/src/learning/course-player-adapter.ts:61-91` (`rawCourse`)
- Modify: `apps/web/src/learning/player/CourseCover.tsx:1-35`
- Modify: `apps/web/src/learning/player/CoursePhaseScreen.tsx:95-111`

**Interfaces:**
- Consumes: `COURSE_THEMES`, `CourseTheme`, `DEFAULT_COURSE_THEME` from `@moto-ai/contracts/course-themes` (Task 1); `CourseGraph.theme` (Task 1).
- Produces: `CourseContent.theme: CourseTheme` — nothing downstream of this task consumes it yet, this task is the end of the chain.

- [ ] **Step 1: Add `theme` to the player content schema**

In `apps/web/src/shared/contracts/player-course.ts`, add to the imports at the top:

```ts
import { courseThemeSchema, DEFAULT_COURSE_THEME } from '@moto-ai/contracts/course-themes';
```

In `courseSchema` (currently starting line 214), add after `coverButtonColor: opt(z.string()),`:

```ts
  theme: courseThemeSchema.catch(DEFAULT_COURSE_THEME),
```

Using `.catch()` (not `.optional()`) means content built from an old frozen `CourseRevision.snapshot` that predates this feature (and so has no `theme` key at all) still resolves to `'moto-theme'` at render time, without needing that snapshot to be migrated.

- [ ] **Step 2: Carry `theme` through the adapter**

In `apps/web/src/learning/course-player-adapter.ts`, in `rawCourse()` (currently starting line 61), add after `coverButtonColor: cover.coverButtonColor,`:

```ts
    theme: course.theme,
```

- [ ] **Step 3: Resolve the button class from the theme registry**

Replace the top of `apps/web/src/learning/player/CourseCover.tsx`:

```tsx
'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

interface CourseCoverProps {
  title: string;
  coverHeadline?: string;
  coverImage?: string;
  buttonText?: string;
  buttonColor?: string;
  learningObjectives?: string[];
  imageSizes?: string;
  onStart: () => void;
}

export function CourseCover({
  title,
  coverHeadline,
  coverImage,
  buttonText = 'Start Course',
  buttonColor,
  learningObjectives,
  imageSizes = '100vw',
  onStart,
}: CourseCoverProps) {
  const finalHeadline = coverHeadline || title;
  let btnClass = 'bg-white text-black hover:bg-white/90';
  if (buttonColor === 'moto-indigo' || buttonColor?.toLowerCase() === '#685bc7') {
    btnClass = 'bg-accent text-white hover:bg-accent/90';
  } else if (buttonColor === 'moto-frost')
    btnClass = 'bg-background text-foreground hover:bg-background/90';
  else if (buttonColor === 'moto-pearl') btnClass = 'bg-card text-foreground hover:bg-card/90';
```

with:

```tsx
'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { COURSE_THEMES, DEFAULT_COURSE_THEME, type CourseTheme } from '@moto-ai/contracts/course-themes';

interface CourseCoverProps {
  title: string;
  coverHeadline?: string;
  coverImage?: string;
  buttonText?: string;
  buttonColor?: string;
  theme?: CourseTheme;
  learningObjectives?: string[];
  imageSizes?: string;
  onStart: () => void;
}

export function CourseCover({
  title,
  coverHeadline,
  coverImage,
  buttonText = 'Start Course',
  buttonColor,
  theme = DEFAULT_COURSE_THEME,
  learningObjectives,
  imageSizes = '100vw',
  onStart,
}: CourseCoverProps) {
  const finalHeadline = coverHeadline || title;
  const themeColors = COURSE_THEMES[theme].buttonColors;
  const btnClass =
    buttonColor === 'primary' || buttonColor === 'secondary' || buttonColor === 'tertiary'
      ? themeColors[buttonColor]
      : 'bg-white text-black hover:bg-white/90';
```

(The rest of the file, from the `return (` line onward, is unchanged — `btnClass` is still used the same way further down.)

- [ ] **Step 4: Pass `theme` down from `CoursePhaseScreen`**

In `apps/web/src/learning/player/CoursePhaseScreen.tsx`, in the `case 'cover':` block (currently lines 95-111), add a `theme` prop to `<CourseCover>` after `buttonColor={course.coverButtonColor}`:

```tsx
          theme={course.theme}
```

- [ ] **Step 5: Typecheck and lint**

Run: `npm run typecheck --workspace=@moto-ai/web`
Expected: passes.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 6: Manual check**

Run `npm run dev`, open the author preview for an existing Motorola course whose cover has a button color set (Course Studio → that course → Preview), and confirm the Start button renders with the same color as before this change (the migration in Task 1 already remapped its stored value to `primary`/`secondary`/`tertiary`, and `moto-theme` is the default, so nothing should look different).

Then temporarily set that course's `theme` to `yamaha-theme` directly in the database to confirm the plumbing works end-to-end (the authoring UI to do this doesn't exist until Task 4):

```bash
psql "$DATABASE_URL" -c "UPDATE \"Course\" SET theme = 'yamaha-theme' WHERE id = '<courseId>';"
```

Reload the preview — the Start button should now render in one of the grayscale placeholder shades instead of Motorola's colors. Revert afterward:

```bash
psql "$DATABASE_URL" -c "UPDATE \"Course\" SET theme = 'moto-theme' WHERE id = '<courseId>';"
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/shared/contracts/player-course.ts apps/web/src/learning/course-player-adapter.ts apps/web/src/learning/player/CourseCover.tsx apps/web/src/learning/player/CoursePhaseScreen.tsx
git commit -m "feat: resolve course cover button color from the course's theme"
```

---

### Task 4: Authoring UI — theme picker and semantic color picker

**Files:**
- Modify: `apps/web/src/authoring/inspectors/course-inspector-draft.ts:1-70` (`CoverDraft`, `CourseFormDraft`, `coverDraft`, `formDraft`), `:110-125` (`formPayload`)
- Modify: `apps/web/src/authoring/inspectors/CourseInspector.tsx:1-30` (imports, props usage), `:278-334` (cover fieldset)

**Interfaces:**
- Consumes: `CourseTheme`, `COURSE_THEMES`, `DEFAULT_COURSE_THEME` from `@moto-ai/contracts/course-themes` (Task 1); `courseSettingsInputSchema` with `theme` (Task 2); `CourseGraph.theme` (Task 1).
- Produces: nothing further downstream — this is the last task.

- [ ] **Step 1: Carry `theme` through the form draft**

In `apps/web/src/authoring/inspectors/course-inspector-draft.ts`, add to the imports:

```ts
import { COURSE_THEMES, DEFAULT_COURSE_THEME, courseThemeSchema, type CourseTheme } from '@moto-ai/contracts/course-themes';
```

Change `CoverDraft.coverButtonColor`'s type from:

```ts
  coverButtonColor: '' | 'moto-indigo' | 'moto-frost' | 'moto-pearl';
```

to:

```ts
  coverButtonColor: '' | 'primary' | 'secondary' | 'tertiary';
```

Add `theme` to `CourseFormDraft`, after `cover: CoverDraft;`:

```ts
  theme: CourseTheme;
```

In `coverDraft()`, update the color check from:

```ts
    coverButtonColor:
      color === 'moto-indigo' || color === 'moto-frost' || color === 'moto-pearl' ? color : '',
```

to:

```ts
    coverButtonColor: color === 'primary' || color === 'secondary' || color === 'tertiary' ? color : '',
```

In `formDraft()`, add `theme` to the returned object, after `cover: coverDraft(course.cover),`:

```ts
    theme: courseThemeSchema.catch(DEFAULT_COURSE_THEME).parse(course.theme),
```

In `formPayload()`, add `theme` to the returned object, after `cover: coverPayload,`:

```ts
    theme: form.theme,
```

- [ ] **Step 2: Add the theme picker and re-skin the color picker**

In `apps/web/src/authoring/inspectors/CourseInspector.tsx`, add to the imports, alongside the existing `@moto-ai/contracts/course-studio` import:

```ts
import { COURSE_THEMES, type CourseTheme } from '@moto-ai/contracts/course-themes';
```

Add a theme picker fieldset before the existing `<fieldset>` for "Course cover" (currently starting at line 278):

```tsx
        <fieldset className="studio-glass-control border-border space-y-4 rounded-xl border p-3">
          <legend className="px-1 text-sm font-semibold">Theme</legend>
          <label className="block text-xs font-medium" htmlFor="course-theme">
            Client theme
            <select
              className={inputClass}
              disabled={locked}
              id="course-theme"
              onChange={(event) =>
                update((current) => ({
                  ...current,
                  theme: event.target.value as CourseTheme,
                }))
              }
              value={form.theme}
            >
              {Object.entries(COURSE_THEMES).map(([id, tokens]) => (
                <option key={id} value={id}>
                  {tokens.label}
                </option>
              ))}
            </select>
          </label>
        </fieldset>

```

Replace the existing button-color `<label>` (currently inside the "Course cover" fieldset, around lines 306-327):

```tsx
          <label className="block text-xs font-medium" htmlFor="cover-button-color">
            Start button colour
            <select
              className={inputClass}
              disabled={locked}
              id="cover-button-color"
              onChange={(event) =>
                update((current) => ({
                  ...current,
                  cover: {
                    ...current.cover,
                    present: true,
                    coverButtonColor: event.target.value as CoverDraft['coverButtonColor'],
                  },
                }))
              }
              value={form.cover.coverButtonColor}
            >
              <option value="">Default</option>
              <option value="moto-indigo">Moto Indigo</option>
              <option value="moto-frost">Moto Frost</option>
              <option value="moto-pearl">Moto Pearl</option>
            </select>
          </label>
```

with:

```tsx
          <label className="block text-xs font-medium" htmlFor="cover-button-color">
            Start button colour
            <select
              className={inputClass}
              disabled={locked}
              id="cover-button-color"
              onChange={(event) =>
                update((current) => ({
                  ...current,
                  cover: {
                    ...current.cover,
                    present: true,
                    coverButtonColor: event.target.value as CoverDraft['coverButtonColor'],
                  },
                }))
              }
              value={form.cover.coverButtonColor}
            >
              <option value="">Default</option>
              <option value="primary">Primary</option>
              <option value="secondary">Secondary</option>
              <option value="tertiary">Tertiary</option>
            </select>
            <span className="mt-2 flex gap-2" aria-hidden="true">
              {(['primary', 'secondary', 'tertiary'] as const).map((slot) => (
                <span
                  key={slot}
                  className={`h-5 w-5 rounded-full border border-white/20 ${COURSE_THEMES[form.theme].buttonColors[slot]}`}
                  title={slot}
                />
              ))}
            </span>
          </label>
```

This swatch row shows the author the actual colors their currently-selected theme will render for Primary/Secondary/Tertiary, without them needing to know the underlying class names.

- [ ] **Step 3: Typecheck and lint**

Run: `npm run typecheck --workspace=@moto-ai/web`
Expected: passes.

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 4: Manual check**

Run `npm run dev`, open Course Studio, open an existing course's settings inspector, and confirm:
1. A "Theme" fieldset appears with "Motorola" selected by default.
2. The "Start button colour" options read Default/Primary/Secondary/Tertiary, with three color swatches beneath matching Motorola's palette.
3. Switching the theme dropdown to "Yamaha (placeholder)" changes the swatches to grayscale.
4. Selecting "Primary" and saving, then opening the course's Preview, shows the Start button in the theme's primary color.
5. Switching theme to Yamaha, saving, and reloading Preview shows the grayscale primary color.
6. Switch it back to Motorola/Primary and save, leaving the course as it was before testing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/authoring/inspectors/course-inspector-draft.ts apps/web/src/authoring/inspectors/CourseInspector.tsx
git commit -m "feat: add course theme picker and semantic button-color swatches"
```

---

## Self-Review Notes

- **Spec coverage:** Data model (Task 1), theme registry (Task 1), contract changes (Task 2), player resolution (Task 3), authoring UI (Task 4), migration (Task 1 step 6), revision-freeze (rides along automatically via the existing `courseGraphSelect`/`toCourseGraph` snapshot mechanism, confirmed by tracing `freezeCourseRevision` in `course-review-repository.ts`) are all covered.
- **Correction to the spec:** the spec's migration section mentioned backfilling `CourseRevisionSource` copies; that model only stores source-file metadata (sha256, filename), not a course-graph copy, and needs no backfill. Task 1 Step 6 backfills `Course.cover` and `CourseRevision.snapshot` only, which are the actual places the legacy literal values live.
- **Type consistency:** `CourseTheme`, `courseThemeSchema`, `COURSE_THEMES`, `DEFAULT_COURSE_THEME` names are used identically across all four tasks.
