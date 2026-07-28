# Postgres Course Studio Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Sanity with an app-owned Course Studio at `/studio`, backed by PostgreSQL for authored course data and Cloudflare R2 for media, while preserving learner routes and progress identity.

**Architecture:** Course, Chapter, Lesson, Quiz, asset, and immutable release records are owned by Prisma in `packages/database`. Lesson-specific content remains typed JSON so the ten existing learner presentations retain their authored shape. The learner read model is produced by a server-only course repository, and Course Studio writes through protected Next.js route handlers. R2 stores bytes; Postgres stores object keys, metadata, and references.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma/PostgreSQL, Cloudflare R2 through AWS SDK v3 S3 compatibility, Zod, existing player components.

## Global Constraints

- Keep `/studio` as the internal Course Studio URL.
- Require `COURSE_STUDIO_PASSWORD`; do not reuse analytics credentials or expose the password to the browser.
- Preserve `/`, `/course/[slug]`, learner progress keys, all ten lesson types, and the existing player contracts.
- Retain imported Sanity document IDs as application IDs, so historical progress rows continue to resolve to the same course and lesson identities.
- Store course media in Cloudflare R2, not PostgreSQL. Store R2 keys and metadata in PostgreSQL.
- Do not create or run automated tests, start Ollama, or invoke AI APIs. Verify with typecheck, lint, diff checks, build when PostgreSQL is available, and browser checks.
- Do not delete Sanity source data remotely. Delete local Sanity code and dependencies only after the PostgreSQL/R2 import and learner cutover are verified.

---

## File structure

| File | Responsibility |
| --- | --- |
| `packages/database/prisma/schema.prisma` | App-owned authoring graph, releases, and asset metadata. |
| `packages/database/src/course-repository.ts` | Server-only read/write transactions and learner projection. |
| `packages/contracts/src/course.ts` | Shared authored course, asset, and learner projection contracts. |
| `apps/web/src/lib/course-repository.ts` | Web-facing repository adapter; no Sanity imports. |
| `apps/web/src/lib/r2.ts` | Server-only R2 client and object-key utilities. |
| `apps/web/src/app/api/course-studio/*` | Password-protected authoring, upload, and release handlers. |
| `apps/web/src/app/studio/*` | App-owned Course Studio UI and password login. |
| `apps/web/src/app/page.tsx` | Course library backed by the app repository. |
| `apps/web/src/app/course/[slug]/page.tsx` | Learner route backed by the app repository. |
| `scripts/import-sanity-content.mjs` | One-time explicit Sanity-to-Postgres/R2 import; never runs at build time. |

### Task 1: Add the app-owned content and asset model

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/contracts/src/course.ts`
- Modify: `packages/contracts/package.json`
- Modify: `packages/database/src/index.ts`

**Interfaces:**

```ts
export type LessonKind =
  | 'content' | 'interaction' | 'stage' | 'video' | 'quiz'
  | 'canvas' | 'colorSwitcher' | 'splitScreen' | 'dragDrop' | 'scrollStory';

export interface CourseAssetRef {
  id: string;
  url: string;
  filename?: string;
  contentType?: string;
}
```

- [ ] Add `Course`, `CourseChapter`, `CourseLesson`, `CourseQuiz`, `CourseAsset`, and `CourseRelease` Prisma models with stable string IDs, explicit ordering, timestamps, publish status, and cascading ownership.
- [ ] Keep common searchable fields as columns. Put each lesson type's variable fields in `Json` payload columns; keep Portable Text as JSON.
- [ ] Store an immutable ordered course snapshot and SHA-256 fingerprint in `CourseRelease`; block duplicate releases for the same Course revision.
- [ ] Generate Prisma client and typecheck the owning packages.

### Task 2: Build the course repository and learner projection

**Files:**
- Create: `packages/database/src/course-repository.ts`
- Create: `apps/web/src/lib/course-repository.ts`
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/app/course/[slug]/page.tsx`
- Modify: `apps/web/src/app/api/quiz/grade/route.ts`

**Interfaces:**

```ts
export async function listPublishedCourses(): Promise<CourseSummary[]>;
export async function getPublishedCourseBySlug(slug: string): Promise<CourseContent | null>;
export async function getQuizAnswerKey(quizId: string): Promise<QuizAnswerKey | null>;
```

- [ ] Implement the repository with Prisma transactions and Zod validation at the reader boundary.
- [ ] Translate database records to the existing `CourseContent` and `LessonSection` player shape so presentation components require no rewrite.
- [ ] Replace every production Sanity/GROQ course and quiz read with repository reads.
- [ ] Keep existing course and lesson IDs unchanged in the returned learner projection.

### Task 3: Add Cloudflare R2 storage and Course Studio authentication

**Files:**
- Modify: `apps/web/package.json`, `package-lock.json`, `.env.example`
- Create: `apps/web/src/lib/r2.ts`
- Create: `apps/web/src/lib/course-studio-auth.ts`
- Create: `apps/web/src/app/studio/login/page.tsx`
- Create: `apps/web/src/app/api/course-studio/login/route.ts`
- Modify: `apps/web/src/proxy.ts`

**Interfaces:**

```ts
export function requireCourseStudioRequest(request: NextRequest): void;
export async function putCourseAsset(input: UploadInput): Promise<CourseAssetRef>;
export async function deleteCourseAsset(asset: CourseAssetRef): Promise<void>;
```

- [ ] Add `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` in the web workspace.
- [ ] Configure the S3 client for R2 with `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, and `region: 'auto'`; document optional `R2_PUBLIC_BASE_URL`.
- [ ] Use a separate httpOnly `course_studio_token` cookie whose value is checked only against `COURSE_STUDIO_PASSWORD`. Fail closed when it is missing.
- [ ] Protect `/studio` and all Course Studio APIs, while leaving learner, analytics, and background-job routes unchanged.

### Task 4: Replace the embedded Studio with an app-owned Course Studio

**Files:**
- Replace: `apps/web/src/app/studio/[[...tool]]/*` with app-owned `/studio` route and layout
- Move/adapt: `apps/web/src/sanity/course-studio/*` to `apps/web/src/course-studio/*`
- Create: `apps/web/src/app/api/course-studio/courses/*`
- Create: `apps/web/src/app/api/course-studio/assets/*`
- Create: `apps/web/src/app/api/course-studio/releases/*`

**Interfaces:**

```ts
export async function createCourseTemplate(): Promise<AuthoringCourse>;
export async function updateCourseGraph(input: CourseGraphPatch): Promise<AuthoringCourse>;
export async function freezeCourseRelease(courseId: string): Promise<CourseRelease>;
```

- [ ] Preserve the existing Course Studio flow: course template, chapter/screen creation, ordering, selection, inspector, block catalog, and master history.
- [ ] Replace Sanity mutations and GROQ with authenticated route handlers and repository transactions.
- [ ] Replace Sanity asset inputs with R2 upload and asset references.
- [ ] Keep the current non-persistent preview boundary; never let preview write learner progress or authoring content.

### Task 5: Import data and cut over safely

**Files:**
- Create: `scripts/import-sanity-content.mjs`
- Create: `scripts/verify-course-import.mjs`
- Modify: `README.md`

**Interfaces:**

```ts
type ImportMode = 'dry-run' | 'apply';
async function importSanityContent(mode: ImportMode): Promise<ImportReport>;
```

- [ ] Require explicit `--apply`; default to a read-only dry run with counts and unresolved assets.
- [ ] Fetch Sanity content using the existing server token, preserve document IDs, upload each referenced asset to R2, then create equivalent PostgreSQL records in transactions.
- [ ] Compare published course count, slug set, chapter/lesson counts, quiz IDs, and asset count before the learner cutover.
- [ ] Only delete local Sanity code when the import report is complete and the learner home plus an imported course render through PostgreSQL.

### Task 6: Remove Sanity cleanly

**Files:**
- Delete: `apps/web/sanity.config.ts`, `apps/web/sanity.cli.ts`, `apps/web/src/sanity/**`
- Delete: Sanity-specific loader/configuration and embedded Studio route artifacts
- Modify: `apps/web/package.json`, `package-lock.json`, `apps/web/next.config.ts`, `.env.example`, `README.md`

- [ ] Remove `sanity`, `next-sanity`, `@sanity/*`, `styled-components`, and Sanity-only CSP/image settings once no import remains.
- [ ] Remove old documentation that calls course content, media, or authoring “Sanity”; document the Postgres/R2 configuration and Course Studio password instead.
- [ ] Run repository-wide searches proving no production Sanity, GROQ, or Studio dependency remains.

### Task 7: Final non-test acceptance

- [ ] Run `npm run db:generate`, `npm run typecheck`, `npm run lint`, and `git diff --check`.
- [ ] Run `npm run build` only after checking PostgreSQL is reachable; report environment failures distinctly from application failures.
- [ ] In desktop Chrome, sign into `/studio/login` with `COURSE_STUDIO_PASSWORD`, create a disposable draft, upload a disposable asset, create a release, and confirm learner home plus one imported `/course/[slug]` route render without Sanity requests.
- [ ] Confirm `/studio`, its APIs, and R2 upload routes fail closed without the Course Studio cookie.

## Plan self-review

- **Spec coverage:** PostgreSQL ownership, R2 media, dedicated Course Studio auth, learner compatibility, import preservation, and complete Sanity removal each have an implementation task.
- **No-test constraint:** The plan deliberately contains no automated test files or test commands.
- **Destructive safety:** Remote Sanity is read only during import. Local Sanity removal is last and is gated on import comparison plus browser confirmation.
