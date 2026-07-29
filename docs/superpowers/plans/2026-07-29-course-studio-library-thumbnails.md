# Course Studio Library Thumbnails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each available Course Studio course with its authored library thumbnail, a cover-image fallback, or a stable placeholder.

**Architecture:** Extend the existing authoring-course list query to include the current `Course.cover` JSON payload. Keep image selection local to the Studio library page using defensive extraction of `thumbnail.asset.url` and `coverImage.asset.url`, then render the selected same-origin asset with `next/image` inside the existing course card link.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma, `next/image`, Tailwind CSS.

## Global Constraints

- Do not add a new database column or asset endpoint.
- Do not change learner course rendering or published-course contracts.
- Do not create automated test files; verify with typecheck, lint, build, diff checks, and browser evidence where available.
- Preserve the current library links, title, description, and empty state.

---

### Task 1: Return course cover data to the Studio library

**Files:**
- Modify: `packages/database/src/course-repository.ts:132-137`

**Interfaces:**
- Consumes: Existing `CourseGraph.cover: Prisma.JsonValue | null` and Prisma `course.findMany` selection.
- Produces: `listAuthoringCourses()` returning `Pick<CourseGraph, 'id' | 'slug' | 'title' | 'description' | 'cover'>[]`.

- [x] **Step 1: Extend the list return type and Prisma selection**

Change the function signature to include `cover` and add `cover: true` to the `findMany` select. Do not alter ordering or any existing fields:

```ts
export async function listAuthoringCourses(): Promise<
  Array<Pick<CourseGraph, 'id' | 'slug' | 'title' | 'description' | 'cover'>>
> {
  return prisma.course.findMany({
    orderBy: { updatedAt: 'desc' },
    select: { id: true, slug: true, title: true, description: true, cover: true },
  });
}
```

- [x] **Step 2: Run the focused static check**

Run: `npm run typecheck`

Expected: exit 0 with all workspace TypeScript checks passing.

### Task 2: Render library thumbnails with safe fallbacks

**Files:**
- Modify: `apps/web/src/app/studio/page.tsx:1-55`

**Interfaces:**
- Consumes: `course.cover` from Task 1 and existing asset references stored under `cover.thumbnail` and `cover.coverImage`.
- Produces: Course cards with an accessible image media area and placeholder fallback.

- [x] **Step 1: Add defensive image URL extraction**

Add `Image` and `BookOpen` imports as needed, then define a small local helper that accepts unknown JSON and returns only a non-empty string URL. Prefer `thumbnail`, then `coverImage`; malformed values return `undefined`:

```ts
function courseLibraryImageUrl(cover: unknown): string | undefined {
  if (!cover || typeof cover !== 'object' || Array.isArray(cover)) return undefined;
  const source = cover as { thumbnail?: unknown; coverImage?: unknown };
  for (const candidate of [source.thumbnail, source.coverImage]) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const asset = (candidate as { asset?: unknown }).asset;
    if (!asset || typeof asset !== 'object' || Array.isArray(asset)) continue;
    const url = (asset as { url?: unknown }).url;
    if (typeof url === 'string' && url.trim()) return url;
  }
  return undefined;
}
```

- [x] **Step 2: Add the fixed-ratio card media area**

Compute the first course index with a valid image URL, then map each course to `const imageUrl = courseLibraryImageUrl(course.cover)` and place a media section before the card title. For a URL, render `next/image` with `fill`, `alt={course.title}`, `priority={index === firstImageIndex}`, `sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"`, and `className="object-cover"`. For no URL, render the existing `BookOpen` icon in the same fixed-ratio container. Keep the outer `Link`, title, description, and empty-state text unchanged.

- [x] **Step 3: Run formatting and static checks**

Run: `npm run lint`

Expected: exit 0 with no ESLint errors.

Run: `git diff --check`

Expected: exit 0 with no whitespace errors.

### Task 3: Verify the integrated library route

**Files:**
- Verify: `packages/database/src/course-repository.ts`
- Verify: `apps/web/src/app/studio/page.tsx`

- [x] **Step 1: Run the production build**

Run: `npm run build`

Expected: Prisma reports no pending migrations and Next.js compiles the Studio route successfully.

- [x] **Step 2: Inspect the authenticated Studio library**

Start the app with `npm run dev`, authenticate at `/studio/login`, and inspect `/studio` through the available Chrome DevTools or Playwright MCP browser tools. Confirm a course card contains the authored thumbnail when present and that a missing image shows the placeholder without breaking the card link.

- [x] **Step 3: Review the final diff**

Run: `git status --short` and `git diff --check`.

Expected: only the intended repository source and plan/spec documentation are changed; no generated or test files are added.
