# moto g87 Course Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an editable, source-grounded LATAM moto g87 course in Course Studio, with every supported lesson type represented and all assets served through the existing Cloudflare R2 boundary.

**Architecture:** A one-purpose, idempotent TypeScript authoring script will create the course graph, upload selected learner-ready files to R2, persist asset inventory records, and write each lesson's existing player payload shape into PostgreSQL. Course Studio and the learner preview consume that graph unchanged; the script is operational authoring tooling, not an alternate runtime path.

**Tech Stack:** TypeScript, Prisma/PostgreSQL, Next.js Course Studio, Cloudflare R2 S3 API, existing `@moto-ai/contracts` course schemas.

## Global Constraints

- Target LATAM only: display `moto g87`, use `up to 56 hours`, and retain market-availability language.
- Use the Venice Copy Guide, PMB, and marketing-spec workbook as factual authority; do not invent product claims.
- Include every `COURSE_LESSON_TYPES` member at least once across three chapters.
- Keep authored content and assessments authoritative; do not invoke the OpenAI generation path.
- Use existing Cloudflare R2 storage and existing course asset URL contract; do not add a storage provider.
- Create no automated test files and do not run automated tests.
- Preserve unrelated user changes; the new course is editable and must not be frozen, published, or delivered.

---

### Task 1: Bring up the local runtime safely

**Files:**
- Modify: none
- Verify: local PostgreSQL service, Prisma schema, web app, job worker, parser service health endpoint

**Interfaces:**
- Consumes: ignored root `.env`/`.env.local` and `services/parser-service/.env`
- Produces: a running Studio stack; parser health may be `degraded` until a real `OPENAI_API_KEY` is configured

- [ ] **Step 1: Verify the database endpoint before starting any application process**

Run:

```bash
pg_isready -h localhost -p 5432
```

Expected: `accepting connections`; if it is not, inspect the `postgresql@18` service and its log before making any state change.

- [ ] **Step 2: Apply the committed schema migrations**

Run:

```bash
npm run db:migrate
```

Expected: Prisma reports that migrations are applied successfully.

- [ ] **Step 3: Start the three runtime processes in separate terminals**

Run:

```bash
npm run dev
npm run jobs:worker
cd services/parser-service && ./venv/bin/python -m moto_parser
```

Expected: Next.js serves the Studio, the worker begins polling, and `GET /health` returns an OpenAI configuration status without exposing the key.

- [ ] **Step 4: Confirm the current R2 configuration is present without printing credentials**

Run:

```bash
awk -F= '/^R2_(ACCOUNT_ID|ACCESS_KEY_ID|SECRET_ACCESS_KEY|BUCKET)=/{print $1 "=" (length($2) ? "set" : "empty")}' .env.local
```

Expected: all four variables report `set`; otherwise stop before any upload because incomplete credentials would create a partial course.

### Task 2: Add the idempotent moto g87 authoring seed

**Files:**
- Create: `scripts/seed-moto-g87-course.ts`
- Modify: none
- Verify: `scripts/seed-moto-g87-course.ts` source and resulting database course graph

**Interfaces:**
- Consumes: `/Users/josemejias/Downloads/Venice Content`, `DATABASE_URL`, and `R2_*` variables
- Produces: one course with slug `moto-g87-always-social-ready`, R2-backed `CourseAsset` records, three chapters, and `CourseLesson` payloads compatible with `apps/web/src/shared/contracts/player-course.ts`

- [ ] **Step 1: Implement the source and storage guardrails**

The script must fail before writing if any required source file is missing or if a required R2 variable is absent. It must find an existing course by slug and exit with its Studio URL rather than duplicate it.

```ts
const existing = await prisma.course.findUnique({ where: { slug: COURSE_SLUG }, select: { id: true } });
if (existing) {
  console.log(`/studio/${existing.id}`);
  return;
}
```

- [ ] **Step 2: Upload only player-ready selected assets through the existing storage boundary**

Use product PNGs, JPG camera samples, marketing-screen PNGs, and MP4s. Exclude PSD and AI working files. For each selected file, call `putCourseAsset`, then persist `prisma.courseAsset.create` with its `r2Key`, delivery URL, byte size, and content type, matching `uploadAuthoringAsset`.

```ts
const stored = await putCourseAsset({ courseId, filename, contentType, bytes });
return prisma.courseAsset.create({
  data: { r2Key: stored.r2Key, filename, contentType, byteSize: bytes.byteLength, deliveryUrl: stored.url },
});
```

- [ ] **Step 3: Create the three chapters and complete lesson map**

Create the following authored lessons, with non-empty headlines, learning copy, and payloads that use actual R2 delivery URLs:

```ts
const chapters = [
  ['Capture and create', ['content', 'stage', 'interaction', 'splitScreen', 'video', 'quiz']],
  ['Keep up with every day', ['scrollStory', 'canvas', 'dragDrop', 'interaction', 'quiz']],
  ['Recommend with confidence', ['colorSwitcher', 'stage', 'content', 'dragDrop', 'splitScreen', 'quiz']],
] as const;
```

`stage` and `canvas` payloads must include labelled hotspots. `interaction`, `content`, `splitScreen`, and `scrollStory` payloads must include covered features where they provide learning cues. `video` must reference a supplied MP4. Each `quiz` must use authored questions and answers. `dragDrop` must have unique chip IDs with matching `correctChipId` values. `colorSwitcher` must include Stargazer, Alaskan Blue, and Malaga with their exact render assets.

- [ ] **Step 4: Set course-level retail-learning metadata**

Use `updateCourseDetails` or a direct Prisma update to save the title, description, three learning objectives, cover reference, compact specification groups, and LATAM limitation disclaimer. Preserve the existing `CourseGraph` JSON boundaries by using `unknown`/Prisma JSON only at persistence.

```ts
await updateCourseDetails(courseId, {
  title: 'moto g87: Always Social Ready',
  slug: 'moto-g87-always-social-ready',
  learningObjectives: [
    'Match shopper needs to the moto g87 camera and social-creation features.',
    'Explain the LATAM battery, performance, display, and connected-experience value accurately.',
    'Deliver a concise, legal-safe moto g87 retail recommendation.',
  ],
  cover: { asset: { url: heroAsset.deliveryUrl } },
});
```

- [ ] **Step 5: Run the seed once and record the returned Studio path**

Run the repository-supported TypeScript execution command selected after inspecting the installed local runner. Do not pass secrets on the command line.

Expected: one course, three chapters, all ten lesson types, and no duplicate slug.

### Task 3: Add the original documents as traceable course sources

**Files:**
- Modify: `scripts/seed-moto-g87-course.ts`
- Verify: Studio Sources panel and PostgreSQL source records

**Interfaces:**
- Consumes: the final DOCX, PPTX, and XLSX Venice sources
- Produces: three course-owned source records with their R2 bytes, filenames, SHA-256 identities, and pending/indexed state managed by the existing source flow

- [ ] **Step 1: Use the existing source repository/command shape, not an ad-hoc database-only record**

The script must upload each source document to R2 and create its pending source record with its content type, byte size, filename, and SHA-256. It must not pretend the documents are indexed while the parser service has no key.

```ts
await createPendingSource({
  courseId,
  r2Key: uploaded.r2Key,
  filename,
  contentType,
  byteSize: bytes.byteLength,
  sha256,
});
```

- [ ] **Step 2: Queue or leave indexing pending according to parser health**

If parser health reports OpenAI unconfigured, leave the source status pending and clearly print that retrieval will activate after the API key is supplied. If configured, use the existing job queue path; do not call parser endpoints directly from the seed script.

- [ ] **Step 3: Confirm the Sources panel shows all three source files**

In the authenticated Studio, open the course and inspect Sources. Expected: the DOCX, PPTX, and XLSX filenames appear, and each record's state is accurately reflected.

### Task 4: Verify the complete authored experience

**Files:**
- Modify: none
- Verify: Studio save/reload, R2 delivery, and player preview

**Interfaces:**
- Consumes: seeded course graph, R2 asset URLs, and authenticated Studio session
- Produces: browser evidence that the course is editable and every authored renderer reaches its intended content

- [ ] **Step 1: Check course-graph completeness directly from PostgreSQL**

Run a read-only Prisma query or equivalent that reports the course title, chapter count, each lesson type, and asset-record count. Expected: exactly three chapters and every member of `COURSE_LESSON_TYPES` is represented.

- [ ] **Step 2: Save and reload the course in Studio**

Open `/studio/<course-id>`, edit a safe text field, save, reload, and confirm the saved content returns. This proves the authored graph is not merely a one-off insertion.

- [ ] **Step 3: Preview every lesson renderer and asset-backed media**

Use the Studio preview/player to reach `content`, `interaction`, `stage`, `video`, `quiz`, `canvas`, `colorSwitcher`, `splitScreen`, `dragDrop`, and `scrollStory`. Confirm a representative R2 image and MP4 resolve through `/api/course-assets/...`; report any renderer or asset that is not browser-proven.

- [ ] **Step 4: Run static project checks permitted by the project rules**

Run:

```bash
npm run typecheck
npm run lint
git diff --check
```

Expected: commands complete successfully. If an existing unrelated failure occurs, record its exact command and isolate it from the course result.
