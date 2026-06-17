# TASK-0005 — Sanity CMS Integration Health Check
**Date:** 2026-06-17  
**Auditor:** qa-automation-engineer  
**Verdict: ALL CHECKS PASS**

---

## Summary

| # | Check | Result | Severity |
|---|-------|--------|----------|
| 1 | Env var presence | ✅ PASS | — |
| 2 | Live GROQ round-trip | ✅ PASS | — |
| 3 | GROQ → Zod field parity (6 fragments) | ✅ PASS | — |
| 4 | `lessonType` enum sync | ✅ PASS | — |
| 5 | `QUIZ_GRADING_QUERY` import isolation | ✅ PASS | — |
| 6 | Schema deployment status | ✅ PASS | — |
| 7 | TypeScript compilation | ✅ PASS | — |

No blockers. Two low-severity observations documented below.

---

## Requirement 1 — Env Var Presence

**Result: PASS**

| Variable | File | Status |
|---|---|---|
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | `web/.env` | ✅ Present |
| `NEXT_PUBLIC_SANITY_DATASET` | `web/.env` | ✅ Present |
| `SANITY_API_TOKEN` | `web/.env.local` | ✅ Present |

Notes:
- The two `NEXT_PUBLIC_*` vars live in `web/.env` (committed, non-secret). The `.env.example` comment correctly notes this: "already set in `.env`. Only override here if using a different Sanity project."
- `SANITY_API_TOKEN` is correctly placed in `.env.local` (gitignored).
- Absent `SANITY_API_TOKEN` would degrade only Studio write operations; read (`readClient`) works without it. That risk does not apply here.

---

## Requirement 2 — Live GROQ Round-Trip

**Result: PASS**

`COURSES_QUERY` executed against project `e7l925v5`, dataset `production`, perspective `published`. Returned 1 document.

```json
{
  "_id": "a702a6c3-7f54-436a-ba83-4b651e80d2a4",
  "title": "motorola Qira",
  "slug": { "_type": "slug", "current": "motorola-qira" },
  "description": "Headline (TBD)",
  "thumbnail": { "asset": { "url": "https://cdn.sanity.io/..." } },
  "learningObjectives": null,
  "chapterCount": 3
}
```

**`courseSummarySchema` validation — field-by-field:**

| Field | Value type | Zod rule | Result |
|---|---|---|---|
| `_id` | string | `z.string()` | ✅ |
| `title` | string | `z.string().catch('')` | ✅ |
| `slug` | `{ _type, current }` | `z.object({ current: z.string() })` | ✅ (extra `_type` key stripped by Zod, not an error) |
| `description` | string | `opt(z.string())` | ✅ |
| `thumbnail` | `{ asset: { url } }` | `opt(imageSchema)` | ✅ |
| `learningObjectives` | `null` | `opt(z.array(...))` | ✅ (`null → undefined` via `opt()`) |
| `chapterCount` | `3` | `z.number().catch(0)` | ✅ |

The live dataset contains 1 published course. This is low content volume but is not a CMS integration issue.

---

## Requirement 3 — GROQ → Zod Field Parity

**Result: PASS — zero field drift across all 6 fragments.**

### 3a. `LESSON_FIELDS` ↔ `lessonSchema`

| GROQ projected field | Zod field | Status |
|---|---|---|
| `sectionType` (synthetic) | `sectionType: z.literal('lesson')` | ✅ |
| `_key` (from `_id`) | `_key: z.string()` | ✅ |
| `headline` | `headline: plainStringSchema` | ✅ |
| `body` | `body: opt(richTextSchema)` | ✅ |
| `lessonType` | `lessonType: z.enum([...])` | ✅ |
| `media { asset->{ url } }` | `media: opt(imageSchema)` | ✅ |
| `textOverlay { x, y, width }` | `textOverlay: opt(textOverlaySchema)` | ✅ |
| `hotspots[] { _key, label, topic, x, y, body, photos, videoFile, videoAspectRatio }` | `hotspots: opt(z.array(hotspotSchema))` | ✅ |
| `videoAspectRatio` | `videoAspectRatio: opt(z.string())` | ✅ |
| `videoFile { asset->{ url } }` | `videoFile: opt(imageSchema)` | ✅ |
| `floatingGraphics[] { image, x, y, width }` | `floatingGraphics: opt(z.array(floatingGraphicSchema))` | ✅ |
| `stageBackground { asset->{ url } }` | `stageBackground: opt(imageSchema)` | ✅ |
| `enableCompletionAnimation` | `enableCompletionAnimation: opt(z.boolean())` | ✅ |
| `completionTransition` | `completionTransition: opt(z.enum(['spin','rise','fade']))` | ✅ |
| `colorVariants[] { label, colorHex, image }` | `colorVariants: opt(z.array(...))` | ✅ |
| `splitReverseLayout` | `splitReverseLayout: opt(z.boolean())` | ✅ |
| `dropZones[] { id, label, correctChipId, xPositionPct, yPositionPct }` | `dropZones: opt(z.array(...))` | ✅ |
| `chips[] { id, text }` | `chips: opt(z.array(...))` | ✅ |
| `scrollChapters[] { heading, body, image, targetScale, targetRotation, targetX, targetY }` | `scrollChapters: opt(z.array(...))` | ✅ |

**Drift: None.**

### 3b. `SPEC_FIELDS` ↔ `specificationSchema`

| GROQ projected field | Zod field | Status |
|---|---|---|
| `sectionType` (synthetic) | `sectionType: z.literal('specification')` | ✅ |
| `_key` (from `_id`) | `_key: opt(z.string())` | ✅ |
| `title` | `title: z.string().catch('')` | ✅ |
| `subtitle` | `subtitle: opt(z.string())` | ✅ |
| `heroImage { asset->{ url } }` | `heroImage: opt(imageSchema)` | ✅ |
| `specGroups[] { groupName, specs[] { label, value, highlight } }` | `specGroups: z.array(...)` | ✅ |
| `footnotes` | `footnotes: opt(z.array(z.string()))` | ✅ |

**Drift: None.**

### 3c. `QUIZ_FIELDS` (client-safe) ↔ `quizDocSchema`

| GROQ projected field | Zod field | Status |
|---|---|---|
| `sectionType` (synthetic) | `sectionType: z.literal('quiz')` | ✅ |
| `_key` (from `_id`) | `_key: z.string()` | ✅ |
| `title` | `title: opt(z.string())` | ✅ |
| `instructions` | `instructions: opt(z.string())` | ✅ |
| `questions[] { _key, questionText, questionType, image, answers[] { _key, text } }` | `questions: z.array(...)` | ✅ |
| `passingScore` | `passingScore: opt(z.number())` | ✅ |
| `allowRetry` | `allowRetry: opt(z.boolean())` | ✅ |
| `showCorrectAnswers` | `showCorrectAnswers: opt(z.boolean())` | ✅ |

**Drift: None. `isCorrect` and `feedback` are correctly absent from both the client projection and the Zod schema.**

### 3d. `DISCLAIMER_FIELDS` ↔ `disclaimerSchema`

| GROQ projected field | Zod field | Status |
|---|---|---|
| `sectionType` (synthetic) | `sectionType: z.literal('disclaimer')` | ✅ |
| `_key` (from `_id`) | `_key: opt(z.string())` | ✅ |
| `title` | `title: opt(z.string())` | ✅ |
| `category` | `category: opt(z.enum(['legal','safety','regulatory','warranty','general']))` | ✅ |
| `body` | `body: z.string().catch('')` | ✅ |
| `disclaimers` | `disclaimers: opt(z.array(z.string()))` | ✅ |
| `acknowledgementRequired` | `acknowledgementRequired: opt(z.boolean())` | ✅ |
| `acknowledgementLabel` | `acknowledgementLabel: opt(z.string())` | ✅ |

**Drift: None.**

### 3e. `COURSES_QUERY` ↔ `courseSummarySchema`

Covered by the live round-trip in Requirement 2. All 7 fields match. **Drift: None.**

### 3f. `COURSE_BY_SLUG_QUERY` ↔ `courseSchema`

| GROQ projected field | Zod field | Status |
|---|---|---|
| `_id` | `_id: z.string()` | ✅ |
| `title` | `title: z.string().catch('')` | ✅ |
| `description` | `description: opt(z.string())` | ✅ |
| `thumbnail { asset->{ url } }` | `thumbnail: opt(imageSchema)` | ✅ |
| `coverImage { asset->{ url } }` | `coverImage: opt(imageSchema)` | ✅ |
| `coverHeadline` | `coverHeadline: opt(z.string())` | ✅ |
| `coverButtonText` | `coverButtonText: opt(z.string())` | ✅ |
| `coverButtonColor` | `coverButtonColor: opt(z.string())` | ✅ |
| `learningObjectives` | `learningObjectives: opt(z.array(z.string()))` | ✅ |
| `chapters` (via `CHAPTER_FIELDS`) | `chapters: opt(z.array(chapterSchema))` | ✅ |
| `specifications` (via `SPEC_FIELDS`) | `specifications: opt(z.array(specificationSchema))` | ✅ |
| `disclaimer` (via `DISCLAIMER_FIELDS`) | `disclaimer: opt(disclaimerSchema)` | ✅ |

**chapterSchema sub-check:**

| GROQ field in `CHAPTER_FIELDS` | Zod field | Status |
|---|---|---|
| `_id` | `_id: opt(z.string())` | ✅ |
| `title` | `title: opt(z.string())` | ✅ |
| `estimatedDuration` | `estimatedDuration: opt(z.number())` | ✅ |
| `lessons` (via `LESSON_FIELDS`) | `lessons: opt(z.array(lessonSchema))` | ✅ |
| `quickCheck` (via `QUIZ_FIELDS`) | `quickCheck: opt(quizDocSchema)` | ✅ |

**Drift: None.**

---

## Requirement 4 — `lessonType` Enum Sync

**Result: PASS**

| Source | Values |
|---|---|
| Studio `schemaTypes/lesson.ts` (lines 111–121) | `content`, `interaction`, `stage`, `video`, `quiz`, `colorSwitcher`, `splitScreen`, `dragDrop`, `scrollStory` |
| Zod `contracts/sanity.ts` (line 90) | `content`, `interaction`, `stage`, `video`, `quiz`, `colorSwitcher`, `splitScreen`, `dragDrop`, `scrollStory` |
| Deployed schema (via Sanity MCP) | `content`, `interaction`, `stage`, `video`, `quiz`, `colorSwitcher`, `splitScreen`, `dragDrop`, `scrollStory` |

All three sources are identical 9-value sets. **No enum drift.**

---

## Requirement 5 — `QUIZ_GRADING_QUERY` Import Isolation

**Result: PASS**

Grep of `QUIZ_GRADING_QUERY` across all `.ts`/`.tsx` files:

```
web/src/sanity/lib/queries.ts:128         — definition (export)
web/src/app/api/quiz/grade/route.ts:5     — import (only consumer)
web/src/app/api/quiz/grade/route.ts:23    — comment reference
web/src/app/api/quiz/grade/route.ts:83    — runtime usage
```

No imports outside of `app/api/quiz/grade/route.ts`. The answer key never reaches the browser. **No isolation violation.**

---

## Requirement 6 — Schema Deployment Status

**Result: PASS**

**Deployed document types** (via Sanity MCP `get_schema` against `e7l925v5/production`):

| Deployed type | In `schemaTypes/index.ts` |
|---|---|
| `chapter` | ✅ `chapterType` |
| `course` | ✅ `courseType` |
| `disclaimer` | ✅ `disclaimerType` |
| `lesson` | ✅ `lessonType` |
| `quiz` | ✅ `quizType` |
| `specification` | ✅ `specificationType` |

**Registered but not in document list:** `layerType` — this is expected. `layer.ts` defines `type: 'object'`, meaning it is an embedded object type, not a top-level document type. Object types are referenced inline; they do not appear as queryable document types in the top-level schema. **Not a finding.**

**Note on `sanity.cli.ts`:** The `npx sanity schema extract` CLI command failed because `web/sanity.cli.ts` does not exist. The schema was verified via the Sanity MCP instead. This does not affect production but limits CLI-based schema tooling. See observation below.

---

## Requirement 7 — TypeScript Compilation

**Result: PASS**

```
npm run typecheck → tsc --noEmit → exit 0, zero errors
```

---

## Observations (Non-Blocking)

### OBS-1 — `sanity.cli.ts` absent (Low)

**Finding:** `web/sanity.cli.ts` does not exist. Running `npx sanity@latest schema extract` produces `NotFoundError: No CLI config found`.

**Impact:** CLI-based schema operations (`sanity schema extract`, `sanity dataset export`, `sanity documents get`) cannot run without it. The Sanity MCP can substitute for most read operations in local development.

**Recommendation:** Create `web/sanity.cli.ts`:
```ts
import { defineCliConfig } from 'sanity/cli';

export default defineCliConfig({
  api: {
    projectId: 'e7l925v5',
    dataset: 'production',
  },
});
```
This unblocks all CLI tooling and is a one-time, zero-risk addition.

### OBS-2 — `slug` carries extra `_type` field (Info)

**Finding:** GROQ returns `slug` as `{ "_type": "slug", "current": "motorola-qira" }`. The Zod schema `z.object({ current: z.string() })` silently strips the `_type` key.

**Impact:** None — this is correct Zod strip behavior. The `_type` field is a Sanity internal marker on slug objects. No code path consumes it.

**Recommendation:** No action required. Documented for awareness.

### OBS-3 — Single published course in production (Info)

**Finding:** The live `production` dataset contains exactly 1 published course ("motorola Qira").

**Impact:** This is a content/business state, not an integration issue. All integration checks pass regardless of content volume.

**Recommendation:** No action required from the integration layer.

---

## Checklist

- [x] Env var presence confirmed
- [x] Live GROQ round-trip passed
- [x] GROQ → Zod parity checked for all 6 fragments
- [x] `lessonType` enum verified in sync
- [x] `QUIZ_GRADING_QUERY` import scan passed
- [x] Schema deployment status verified
- [x] `npm run typecheck` passes
- [x] Results written to `docs/tasks/TASK-0005-results.md`
