# SCORM 1.2 Export Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "SCORM package export" action to a frozen `CourseRevision` in Course Studio, producing a downloadable, fully self-contained SCORM 1.2 zip that runs offline in Motorola's Insiders LMS with zero calls back to our servers — reusing the existing Moto Player, not rebuilding it.

**Architecture:** `apps/web` computes the exact same zero-answer-hiding player payload its own author-preview already produces (`toPlayerCourseContent(revision.snapshot, { includeAnswerKey: true })`), plus the frozen offline Course Assistant Q&A, and hands both to a new durable background job as a `JobArtifact` (same mechanism already used for uploaded source-file bytes). `apps/job-worker` — now given R2 access via a new shared `packages/storage` — walks that JSON for asset URLs, fetches each from R2, rewrites them to relative in-zip paths, generates a SCORM 1.2 `imsmanifest.xml`, and zips it all together with a prebuilt, deploy-time-compiled standalone bundle of the real `MotoViewer` component tree plus a small hand-written SCORM 1.2 API bridge.

**Tech Stack:** TypeScript, esbuild (standalone player bundle), `archiver` (zip streaming), `@aws-sdk/client-s3` (R2), Prisma/PostgreSQL, existing durable-job queue (`packages/jobs`).

**Spec:** `/Users/josemejias/.claude/plans/nifty-leaping-mitten.md` (the approved plan-mode design). This implementation plan corrects one part of that design after deeper research — see "Deviation from the approved design" below — everything else matches it.

## Deviation from the approved design

The approved design's step 2 said to move `toPlayerCourseContent`/`normalizeCourseContent` into a shared package
so `apps/job-worker` could call them directly. Reading the actual code revealed this is a much bigger move than
described: `normalizeCourseContent` depends on `courseSchema`/`CourseContent`/`CourseSection` from
`apps/web/src/shared/contracts/player-course.ts` — a large, apps/web-local Zod schema file used pervasively by
`MotoViewer`, `CoursePhaseScreen`, `ReviewPlayer`, and others. Moving it would mean relocating that whole schema
file and updating every one of its consumers — a large, risky refactor unrelated to this feature's actual goal.

**Correction:** `apps/web` keeps doing the `CourseGraph` → `NormalizedCourseContent` conversion exactly where that
code already lives (it's pure, synchronous, in-memory work — perfectly fine inside a request handler). The
resulting JSON, plus the frozen `OfflineAssistantPayload` (Course Assistant Q&A — already proven, already sitting
on the frozen revision, and directly serves the "hardcoded AI content baked into the delivered file" goal), gets
serialized and handed to the export job as a `JobArtifact` — the exact same pattern `enqueueDocumentIndexJob`
already uses to pass raw uploaded file bytes to job-worker. `apps/job-worker`'s job becomes purely: parse this
JSON, fetch+embed its referenced assets, build the manifest, zip it. No code moves out of `apps/web`.

## Global Constraints

- No test suite exists on the TS side of this repo — verification is `npm run lint && npm run typecheck` plus
  manual smoke checks, per this repo's established pattern.
- The feature is gated by the existing `COURSE_STUDIO_PASSWORD` mechanism only — no new auth/role work.
- `CourseRevision.snapshot` is immutable once frozen — the export always operates on a specific `revisionId`,
  never the live/editable course graph.
- Every new package follows the existing monorepo convention: `package.json` with `"name": "@moto-ai/X"`,
  `"private": true`, `"type": "module"`, `"exports": { ".": "./src/index.ts" }`, a `"typecheck": "tsc --noEmit"`
  script, and a `tsconfig.json` extending `../../tsconfig.base.json` (see `packages/database/package.json`,
  `packages/parser-client/package.json` as the exact templates).
- Commit directly to `stg` (per this session's established workflow), one commit per task.
- Every commit message ends with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

### Task 1: Extract R2 access into `packages/storage`

**Files:**
- Create: `packages/storage/package.json`, `packages/storage/tsconfig.json`, `packages/storage/src/index.ts`,
  `packages/storage/src/r2-client.ts`
- Modify: `apps/web/src/server/storage/course-assets.ts:1-93` (full current content already read)
- Modify: `apps/job-worker/package.json`
- Modify: `tsconfig.base.json`'s consuming workspaces — no change needed, each package already extends it directly.

**Interfaces:**
- Produces: `createR2Client(): S3Client` (config read from env internally, throws the same descriptive error as
  today if unset), `getR2Object(key: string): Promise<GetObjectCommandOutput>`,
  `putR2Object(input: { key: string; bytes: Uint8Array; contentType?: string }): Promise<void>`,
  `deleteR2Object(key: string): Promise<void>` — all exported from `@moto-ai/storage`.
- Consumes (Task 6, 10): job-worker imports `getR2Object`/`putR2Object` from `@moto-ai/storage` directly.

- [ ] **Step 1: Create the package scaffold**

`packages/storage/package.json`:
```json
{
  "name": "@moto-ai/storage",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.1096.0"
  }
}
```

`packages/storage/tsconfig.json` (copy the exact shape of `packages/database/tsconfig.json` — read it first to
match verbatim; it extends `../../tsconfig.base.json` with `rootDir`/`outDir`/`include` pointed at this package's
own `src`).

- [ ] **Step 2: Write `packages/storage/src/r2-client.ts`**

Move the R2 config/client logic verbatim from `apps/web/src/server/storage/course-assets.ts` (lines 1-47), generalized to raw key/bytes operations instead of course-asset-specific ones:

```ts
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type GetObjectCommandOutput,
} from '@aws-sdk/client-s3';

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

function getR2Config(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      'Cloudflare R2 is not configured. Set the R2_* environment variables before accessing storage.',
    );
  }

  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function createR2Client(): S3Client {
  const config = getR2Config();
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function bucketName(): string {
  return getR2Config().bucket;
}

export async function getR2Object(key: string): Promise<GetObjectCommandOutput> {
  return createR2Client().send(new GetObjectCommand({ Bucket: bucketName(), Key: key }));
}

export async function putR2Object(input: {
  key: string;
  bytes: Uint8Array;
  contentType?: string;
}): Promise<void> {
  await createR2Client().send(
    new PutObjectCommand({
      Bucket: bucketName(),
      Key: input.key,
      Body: input.bytes,
      ContentType: input.contentType,
    }),
  );
}

export async function deleteR2Object(key: string): Promise<void> {
  await createR2Client().send(new DeleteObjectCommand({ Bucket: bucketName(), Key: key }));
}
```

- [ ] **Step 3: `packages/storage/src/index.ts`**

```ts
export { getR2Object, putR2Object, deleteR2Object } from './r2-client';
```

- [ ] **Step 4: Rewrite `apps/web/src/server/storage/course-assets.ts` to use the shared client**

Replace the whole file with (keeps `CourseAssetUpload`, `putCourseAsset`, `getCourseAsset`, `deleteCourseAsset`,
`createCourseAssetKey`, `courseAssetUrl` — the course-asset-specific naming/URL logic — but delegates the actual
R2 I/O to `@moto-ai/storage`):

```ts
import { getR2Object, putR2Object, deleteR2Object } from '@moto-ai/storage';
import type { CourseAssetRef } from '@moto-ai/contracts/course-assets';

export interface CourseAssetUpload {
  courseId: string;
  filename: string;
  contentType?: string;
  bytes: Uint8Array;
}

function safeFilename(filename: string): string {
  const normalized = filename.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '-');
  return normalized.replace(/-+/g, '-').replace(/^-|-$/g, '') || 'asset';
}

function createCourseAssetKey(courseId: string, filename: string): string {
  return `courses/${courseId}/${crypto.randomUUID()}-${safeFilename(filename)}`;
}

function courseAssetUrl(r2Key: string): string {
  return `/api/course-assets/${r2Key.split('/').map(encodeURIComponent).join('/')}`;
}

export async function putCourseAsset(
  input: CourseAssetUpload,
): Promise<CourseAssetRef & { r2Key: string }> {
  const r2Key = createCourseAssetKey(input.courseId, input.filename);
  await putR2Object({ key: r2Key, bytes: input.bytes, contentType: input.contentType });

  return {
    id: r2Key,
    r2Key,
    url: courseAssetUrl(r2Key),
    filename: input.filename,
    contentType: input.contentType,
  };
}

export async function getCourseAsset(r2Key: string) {
  return getR2Object(r2Key);
}

export async function deleteCourseAsset(r2Key: string): Promise<void> {
  await deleteR2Object(r2Key);
}
```

Add `@moto-ai/storage` to `apps/web/package.json`'s dependencies (version `"0.1.0"`, matching how other internal
packages are referenced there).

- [ ] **Step 5: Add the dependency to job-worker**

`apps/job-worker/package.json` — add `"@moto-ai/storage": "0.1.0"` to `dependencies` (alongside the existing
`@moto-ai/contracts`/`@moto-ai/database`/`@moto-ai/jobs`/`@moto-ai/parser-client` entries).

- [ ] **Step 6: Install and verify**

Run: `npm install` (picks up the new workspace + dependency edges), then `npm run lint && npm run typecheck`.
Expected: both clean. `apps/web`'s asset upload/download/delete flows are behaviorally unchanged — only the
internal R2 client construction moved.

- [ ] **Step 7: Manual smoke check**

If reachable, run `npm run dev`, upload a course asset via any Studio media field, and confirm it still uploads
and renders (same as before — this task is a pure internal refactor with no intended behavior change).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor: extract R2 client into packages/storage

Job-worker needs R2 access for the SCORM export pipeline (fetching course
assets to embed in the zip) but had none. Moves the low-level S3/R2 client
out of apps/web into a new shared package; apps/web keeps its
course-asset-specific key naming and URL construction on top of it.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Schema — `SCORM_EXPORT` job kind and `CourseScormExport` model

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

**Interfaces:**
- Produces: `enum BackgroundJobKind` gains `SCORM_EXPORT`; new `model CourseScormExport` with a unique `jobId`
  (mirrors `CourseGeneration`'s relation to `BackgroundJob`) and a `revisionId` relation to `CourseRevision`.
- Consumes (Task 3, 10, 11): the new enum value and model, from `@moto-ai/database`.

- [ ] **Step 1: Add the enum value**

Change:
```prisma
enum BackgroundJobKind {
  DOCUMENT_INDEX
  QUIZ_GENERATE
  AI_OPERATION
}
```
to:
```prisma
enum BackgroundJobKind {
  DOCUMENT_INDEX
  QUIZ_GENERATE
  AI_OPERATION
  SCORM_EXPORT
}
```

- [ ] **Step 2: Add the relation field to `BackgroundJob`**

In the `model BackgroundJob { ... }` block, add a line alongside the existing `generation CourseGeneration?`:
```prisma
  generation     CourseGeneration?
  scormExport    CourseScormExport?
```

- [ ] **Step 3: Add the relation field to `CourseRevision`**

In the `model CourseRevision { ... }` block (has `generations CourseGeneration[]` today), add:
```prisma
  generations CourseGeneration[]
  scormExports CourseScormExport[]
```

- [ ] **Step 4: Add the new model**

Place directly after the `CourseGeneration` model (same section of the file), mirroring its structure:
```prisma
// Durable record of one SCORM export artifact for a frozen revision. Kept
// separate from the BackgroundJob row itself, same pattern as CourseGeneration,
// so the export's identity (and its R2 location) survives independent of job
// retention/cleanup.
model CourseScormExport {
  id         String        @id @default(cuid())
  revisionId String
  jobId      String        @unique
  r2Key      String
  byteSize   Int
  sha256     String
  createdAt  DateTime      @default(now())
  revision   CourseRevision @relation(fields: [revisionId], references: [id], onDelete: Cascade)
  job        BackgroundJob  @relation(fields: [jobId], references: [id], onDelete: Restrict)

  @@index([revisionId, createdAt])
}
```

- [ ] **Step 5: Generate and apply the migration**

Run: `npm run db:migrate:dev` from the repo root. Give it a descriptive name when prompted (e.g.
`add_scorm_export`). Expected: migration applies cleanly, `npm run db:generate` runs automatically as part of
`db:migrate:dev`.

- [ ] **Step 6: Verify**

Run: `npm run typecheck`. Expected: clean — this confirms the regenerated Prisma client's types are consistent
across every workspace that imports `@moto-ai/database`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: add SCORM_EXPORT job kind and CourseScormExport model

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Contracts — job payload/result schemas

**Files:**
- Modify: `packages/contracts/src/jobs.ts:1-9` (the `JobKindSchema` and imports section)

**Interfaces:**
- Produces: `ScormExportPayloadSchema`, `ScormExportResultSchema`, `ScormExportPayload`, `ScormExportResult` types,
  `'scorm_export'` added to `JobKindSchema`.
- Consumes (Task 10, 11): job-worker's handler and apps/web's enqueue function both import these.

- [ ] **Step 1: Extend `JobKindSchema`**

Change:
```ts
export const JobKindSchema = z.enum([
  'document_index',
  'assistant_qa_generate',
  'course_generate',
  'ai_operation',
]);
```
to:
```ts
export const JobKindSchema = z.enum([
  'document_index',
  'assistant_qa_generate',
  'course_generate',
  'ai_operation',
  'scorm_export',
]);
```

- [ ] **Step 2: Add the payload/result schemas**

Add after `CourseGenerationResultSchema`'s neighborhood — after the existing `CourseGenerationPayloadSchema`
block (line 39 in the current file) and before `AiOperationPayloadSchema`:

```ts
export const ScormExportPayloadSchema = z.object({
  revisionId: z.string().min(1).max(100),
});
export type ScormExportPayload = z.infer<typeof ScormExportPayloadSchema>;

export const ScormExportResultSchema = z.object({
  exportId: z.string().min(1),
  r2Key: z.string().min(1),
  byteSize: z.number().int().min(0),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});
export type ScormExportResult = z.infer<typeof ScormExportResultSchema>;
```

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run typecheck`. Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: add scorm_export job contracts

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: New package `packages/scorm-export` — manifest builder + static SCORM schemas

**Files:**
- Create: `packages/scorm-export/package.json`, `packages/scorm-export/tsconfig.json`,
  `packages/scorm-export/src/index.ts`, `packages/scorm-export/src/manifest.ts`
- Create (static, copied from the reference export): `packages/scorm-export/static/adlcp_rootv1p2.xsd`,
  `packages/scorm-export/static/imscp_rootv1p1p2.xsd`, `packages/scorm-export/static/imsmd_rootv1p2p1.xsd`,
  `packages/scorm-export/static/ims_xml.xsd`

**Interfaces:**
- Produces: `buildImsManifest(input: { title: string; scoIdentifier: string; masteryScore: number }): string`.
- Consumes (Task 6): the zip orchestrator calls this and bundles the static XSDs alongside its output.

- [ ] **Step 1: Package scaffold**

`packages/scorm-export/package.json`:
```json
{
  "name": "@moto-ai/scorm-export",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "archiver": "^7.0.1"
  },
  "devDependencies": {
    "@types/archiver": "^6.0.3",
    "esbuild": "^0.24.0"
  }
}
```
`tsconfig.json`: copy the exact shape used by `packages/database/tsconfig.json` (extends
`../../tsconfig.base.json`), pointed at this package's own `src`.

- [ ] **Step 2: Extract the four SCORM 1.2 schema files from the reference export**

These are static, unchanging boilerplate required by the SCORM 1.2 spec — copy them byte-for-byte, do not
hand-author them:

```bash
mkdir -p packages/scorm-export/static
cd packages/scorm-export/static
unzip -p "/Users/josemejias/Downloads/2026_STARSHIP_TRAINING_ELEARNING_LMS_MASTER_EN.zip" adlcp_rootv1p2.xsd > adlcp_rootv1p2.xsd
unzip -p "/Users/josemejias/Downloads/2026_STARSHIP_TRAINING_ELEARNING_LMS_MASTER_EN.zip" imscp_rootv1p1p2.xsd > imscp_rootv1p1p2.xsd
unzip -p "/Users/josemejias/Downloads/2026_STARSHIP_TRAINING_ELEARNING_LMS_MASTER_EN.zip" imsmd_rootv1p2p1.xsd > imsmd_rootv1p2p1.xsd
unzip -p "/Users/josemejias/Downloads/2026_STARSHIP_TRAINING_ELEARNING_LMS_MASTER_EN.zip" ims_xml.xsd > ims_xml.xsd
```
Verify each file is non-empty and starts with `<?xml` before committing.

- [ ] **Step 3: `packages/scorm-export/src/manifest.ts`**

Template ground-truthed from the reference export's `imsmanifest.xml` (organization → one item →
`adlcp:masteryscore` → one `webcontent`/`sco` resource listing every file). `fileHrefs` is the full list of
every file path that will exist in the zip (populated by Task 6's orchestrator, which knows the final file list
after assembling the bundle + assets):

```ts
function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function buildImsManifest(input: {
  title: string;
  scoIdentifier: string;
  masteryScore: number;
  entryHref: string;
  fileHrefs: string[];
}): string {
  const { title, scoIdentifier, masteryScore, entryHref, fileHrefs } = input;
  const orgId = `${scoIdentifier}_ORG`;
  const resourceId = `${scoIdentifier}_RES`;
  const fileTags = fileHrefs
    .map((href) => `      <file href="${escapeXml(href)}" />`)
    .join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<manifest identifier="${escapeXml(scoIdentifier)}" version="1.0" xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="${escapeXml(orgId)}">
    <organization identifier="${escapeXml(orgId)}">
      <title>${escapeXml(title)}</title>
      <item identifier="${escapeXml(scoIdentifier)}_ITEM" isvisible="true" identifierref="${escapeXml(resourceId)}">
        <title>${escapeXml(title)}</title>
        <adlcp:masteryscore>${masteryScore}</adlcp:masteryscore>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="${escapeXml(resourceId)}" type="webcontent" href="${escapeXml(entryHref)}" adlcp:scormtype="sco">
${fileTags}
    </resource>
  </resources>
</manifest>
`;
}
```

- [ ] **Step 4: `packages/scorm-export/src/index.ts`**

```ts
export { buildImsManifest } from './manifest';
```

- [ ] **Step 5: Verify**

Run: `npm install && npm run lint && npm run typecheck`. Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: add packages/scorm-export with IMS manifest builder

Ground-truthed against a real, currently-delivered Articulate SCORM 1.2
export: single organization/item/resource, adlcp:masteryscore, static XSD
schema files copied verbatim from the reference package.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Asset collection and URL rewriting

**Files:**
- Create: `packages/scorm-export/src/assets.ts`
- Modify: `packages/scorm-export/src/index.ts`

**Interfaces:**
- Produces: `collectAssetRefs(payload: unknown): string[]`, `rewriteAssetUrls(payload: unknown, urlMap: Map<string, string>): unknown`.
- Consumes (Task 10): the job-worker handler calls both when assembling the export.

Course-asset URLs are same-origin relative paths of the exact shape
`/api/course-assets/courses/<courseId>/<uuid>-<filename>` (confirmed from
`apps/web/src/server/storage/course-assets.ts`'s `courseAssetUrl`/`createCourseAssetKey`), embedded at arbitrary
depth throughout the content JSON (lesson payloads, cover image, quiz question images, etc.) — there's no single
canonical list today, so this does a generic recursive walk.

- [ ] **Step 1: `packages/scorm-export/src/assets.ts`**

```ts
const ASSET_URL_PATTERN = /^\/api\/course-assets\/(courses\/[^/]+\/[^/?#]+)$/;

export function collectAssetRefs(payload: unknown): string[] {
  const found = new Set<string>();

  function walk(value: unknown): void {
    if (typeof value === 'string') {
      const match = value.match(ASSET_URL_PATTERN);
      if (match) found.add(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (value && typeof value === 'object') {
      for (const item of Object.values(value as Record<string, unknown>)) walk(item);
    }
  }

  walk(payload);
  return [...found];
}

/**
 * r2KeyFor extracts the R2 object key ("courses/<id>/<uuid>-<filename>") from
 * one of the URLs collectAssetRefs found, for fetching from storage.
 */
export function r2KeyFor(assetUrl: string): string | null {
  const match = assetUrl.match(ASSET_URL_PATTERN);
  return match ? decodeURIComponent(match[1]) : null;
}

export function rewriteAssetUrls(payload: unknown, urlMap: Map<string, string>): unknown {
  function walk(value: unknown): unknown {
    if (typeof value === 'string') {
      return urlMap.get(value) ?? value;
    }
    if (Array.isArray(value)) {
      return value.map(walk);
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, walk(item)]),
      );
    }
    return value;
  }

  return walk(payload);
}
```

- [ ] **Step 2: Update `packages/scorm-export/src/index.ts`**

```ts
export { buildImsManifest } from './manifest';
export { collectAssetRefs, rewriteAssetUrls, r2KeyFor } from './assets';
```

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run typecheck`. Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: add asset URL collection/rewriting for SCORM export

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Zip orchestrator

**Files:**
- Create: `packages/scorm-export/src/build-package.ts`
- Modify: `packages/scorm-export/src/index.ts`

**Interfaces:**
- Consumes: `buildImsManifest` (Task 4), `collectAssetRefs`/`rewriteAssetUrls`/`r2KeyFor` (Task 5), `getR2Object`
  from `@moto-ai/storage` (Task 1).
- Produces: `buildScormPackage(input): Promise<{ buffer: Buffer; byteSize: number; sha256: string }>` — the
  complete orchestration. Consumed by Task 10's job-worker handler.

- [ ] **Step 1: `packages/scorm-export/src/build-package.ts`**

```ts
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import archiver from 'archiver';
import { getR2Object } from '@moto-ai/storage';
import { buildImsManifest } from './manifest';
import { collectAssetRefs, rewriteAssetUrls, r2KeyFor } from './assets';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = path.join(__dirname, '..', 'static');
const XSD_FILES = [
  'adlcp_rootv1p2.xsd',
  'imscp_rootv1p1p2.xsd',
  'imsmd_rootv1p2p1.xsd',
  'ims_xml.xsd',
];

export interface ScormPackageInput {
  title: string;
  scoIdentifier: string;
  masteryScore: number;
  /** The full { course, sections } content JSON, already answer-key-included. */
  content: unknown;
  /** The frozen OfflineAssistantPayload, or undefined if the course has none. */
  assistant: unknown;
  /** Prebuilt player bundle files, keyed by their in-zip relative path. */
  playerBundle: Record<string, Buffer>;
}

async function streamToBuffer(stream: { transformToByteArray(): Promise<Uint8Array> }): Promise<Buffer> {
  return Buffer.from(await stream.transformToByteArray());
}

export async function buildScormPackage(input: ScormPackageInput): Promise<{
  buffer: Buffer;
  byteSize: number;
  sha256: string;
}> {
  const assetUrls = collectAssetRefs(input.content);
  const urlMap = new Map<string, string>();
  const assetFiles: Record<string, Buffer> = {};

  for (const assetUrl of assetUrls) {
    const r2Key = r2KeyFor(assetUrl);
    if (!r2Key) continue;
    const relativePath = `assets/${r2Key.split('/').slice(1).join('/')}`;
    urlMap.set(assetUrl, relativePath);
    const object = await getR2Object(r2Key);
    if (!object.Body) throw new Error(`Asset not found in storage: ${r2Key}`);
    assetFiles[relativePath] = await streamToBuffer(object.Body);
  }

  const rewrittenContent = rewriteAssetUrls(input.content, urlMap);
  const rewrittenAssistant = input.assistant ? rewriteAssetUrls(input.assistant, urlMap) : undefined;
  const coursePayload = JSON.stringify({ content: rewrittenContent, assistant: rewrittenAssistant ?? null });

  const entryHref = 'index_lms.html';
  const fileHrefs = [
    ...Object.keys(input.playerBundle),
    ...Object.keys(assetFiles),
    'meta.xml',
  ].sort();

  const manifest = buildImsManifest({
    title: input.title,
    scoIdentifier: input.scoIdentifier,
    masteryScore: input.masteryScore,
    entryHref,
    fileHrefs: [entryHref, ...fileHrefs],
  });

  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    archive.on('data', (chunk) => chunks.push(chunk));
    archive.on('warning', (warning) => {
      if (warning.code !== 'ENOENT') reject(warning);
    });
    archive.on('error', reject);
    archive.on('end', () => {
      const buffer = Buffer.concat(chunks);
      resolve({
        buffer,
        byteSize: buffer.byteLength,
        sha256: createHash('sha256').update(buffer).digest('hex'),
      });
    });

    archive.append(manifest, { name: 'imsmanifest.xml' });
    for (const filename of XSD_FILES) {
      archive.file(path.join(STATIC_DIR, filename), { name: filename });
    }
    for (const [relativePath, buffer] of Object.entries(input.playerBundle)) {
      archive.append(buffer, { name: relativePath });
    }
    for (const [relativePath, buffer] of Object.entries(assetFiles)) {
      archive.append(buffer, { name: relativePath });
    }
    archive.append(
      `<?xml version="1.0" encoding="utf-8"?><meta><project title="${input.title.replace(/[<>&"']/g, '')}" datepublished="${new Date().toISOString()}" /></meta>`,
      { name: 'meta.xml' },
    );
    archive.append(
      `<!doctype html>\n<html><head><meta charset="utf-8" /><title>${input.title.replace(/[<>&]/g, '')}</title><meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'"><link rel="stylesheet" href="player.css" /></head><body><div id="app"></div><script id="course-data" type="application/json">${coursePayload.replace(/</g, '\\u003c')}</script><script src="player.js"></script></body></html>\n`,
      { name: entryHref },
    );

    void archive.finalize();
  });
}
```

Note on `readFile` import: not actually used directly since `archive.file()` reads from disk itself — remove the
unused `readFile` import if lint flags it (this is scaffolding written ahead of running lint; verify and drop
anything unused in Step 2 below).

- [ ] **Step 2: Update `packages/scorm-export/src/index.ts`**

```ts
export { buildImsManifest } from './manifest';
export { collectAssetRefs, rewriteAssetUrls, r2KeyFor } from './assets';
export { buildScormPackage, type ScormPackageInput } from './build-package';
```

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run typecheck`. Fix any unused-import/type issues surfaced (e.g. the `readFile` note
above). Expected: clean after fixes.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: add SCORM zip orchestrator (build-package.ts)

Streams the manifest, static XSDs, prebuilt player bundle, fetched/embedded
assets, and rewritten content JSON into a single zip via archiver.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: SCORM 1.2 API bridge

**Files:**
- Create: `packages/scorm-export/src/player-bundle/scorm-api.ts`

**Interfaces:**
- Produces: `class ScormBridge` with `connect()`, `isConnected`, `getBookmark()`, `setBookmark(lessonKey)`,
  `getSuspendData()`, `setSuspendData(data)`, `reportInProgress()`,
  `reportQuizResult({score, total, passed})`, `reportComplete()`, `finish()`.
- Consumes (Task 8): the player-bundle entry point instantiates one `ScormBridge` and wires it to `MotoViewer`'s
  callbacks.

Ground-truthed against the reference export's `lms/scormdriver.js`: SCORM 1.2 only (the reference manifest
declares `adlcp_rootv1p2`, no SCORM 2004 evidence), covering exactly the CMI fields our player needs:
`cmi.core.lesson_status`, `cmi.core.score.raw/min/max`, `cmi.core.session_time`, `cmi.core.exit`,
`cmi.core.lesson_location` (bookmark), `cmi.suspend_data` (resume blob).

- [ ] **Step 1: Write the file**

```ts
interface ScormLmsApi {
  LMSInitialize(param: string): string;
  LMSFinish(param: string): string;
  LMSGetValue(name: string): string;
  LMSSetValue(name: string, value: string): string;
  LMSCommit(param: string): string;
  LMSGetLastError(): string;
}

declare global {
  interface Window {
    API?: ScormLmsApi;
  }
}

const MAX_WINDOW_HOPS = 500;

function searchWindowChain(start: Window): ScormLmsApi | null {
  let current: Window = start;
  for (let hops = 0; hops < MAX_WINDOW_HOPS; hops += 1) {
    if (current.API) return current.API;
    if (current.parent && current.parent !== current) {
      current = current.parent;
      continue;
    }
    break;
  }
  return null;
}

function findApi(win: Window): ScormLmsApi | null {
  const fromSelf = searchWindowChain(win);
  if (fromSelf) return fromSelf;
  const opener = win.opener as Window | null | undefined;
  if (opener && !opener.closed) return searchWindowChain(opener);
  return null;
}

function formatSessionTime(totalSeconds: number): string {
  const clamped = Math.max(0, Math.round(totalSeconds));
  const hours = String(Math.floor(clamped / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((clamped % 3600) / 60)).padStart(2, '0');
  const seconds = String(clamped % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

export class ScormBridge {
  private api: ScormLmsApi | null = null;
  private initialized = false;
  private sessionStartMs = 0;

  connect(): boolean {
    if (typeof window === 'undefined') return false;
    this.api = findApi(window);
    if (!this.api) return false;
    const result = this.api.LMSInitialize('');
    this.initialized = result === 'true' || result === '1';
    if (this.initialized) this.sessionStartMs = Date.now();
    return this.initialized;
  }

  get isConnected(): boolean {
    return this.initialized;
  }

  getBookmark(): string {
    if (!this.initialized || !this.api) return '';
    return this.api.LMSGetValue('cmi.core.lesson_location');
  }

  setBookmark(lessonKey: string): void {
    if (!this.initialized || !this.api) return;
    this.api.LMSSetValue('cmi.core.lesson_location', lessonKey.slice(0, 255));
    this.api.LMSCommit('');
  }

  getSuspendData(): string {
    if (!this.initialized || !this.api) return '';
    return this.api.LMSGetValue('cmi.suspend_data');
  }

  setSuspendData(data: string): void {
    if (!this.initialized || !this.api) return;
    this.api.LMSSetValue('cmi.suspend_data', data.slice(0, 4096));
  }

  reportInProgress(): void {
    if (!this.initialized || !this.api) return;
    const current = this.api.LMSGetValue('cmi.core.lesson_status');
    if (current === '' || current === 'not attempted') {
      this.api.LMSSetValue('cmi.core.lesson_status', 'incomplete');
      this.api.LMSCommit('');
    }
  }

  reportQuizResult(result: { score: number; total: number; passed: boolean }): void {
    if (!this.initialized || !this.api) return;
    const raw = result.total > 0 ? Math.round((result.score / result.total) * 100) : 0;
    this.api.LMSSetValue('cmi.core.score.raw', String(raw));
    this.api.LMSSetValue('cmi.core.score.min', '0');
    this.api.LMSSetValue('cmi.core.score.max', '100');
    this.api.LMSSetValue('cmi.core.lesson_status', result.passed ? 'passed' : 'failed');
    this.api.LMSCommit('');
  }

  reportComplete(): void {
    if (!this.initialized || !this.api) return;
    const current = this.api.LMSGetValue('cmi.core.lesson_status');
    if (current !== 'passed' && current !== 'failed') {
      this.api.LMSSetValue('cmi.core.lesson_status', 'completed');
      this.api.LMSCommit('');
    }
  }

  finish(): void {
    if (!this.initialized || !this.api) return;
    const sessionSeconds = (Date.now() - this.sessionStartMs) / 1000;
    this.api.LMSSetValue('cmi.core.session_time', formatSessionTime(sessionSeconds));
    this.api.LMSSetValue('cmi.core.exit', 'suspend');
    this.api.LMSCommit('');
    this.api.LMSFinish('');
    this.initialized = false;
  }
}
```

- [ ] **Step 2: Verify**

This file isn't wired into `packages/scorm-export/src/index.ts` (it's browser-only code for the player bundle,
not part of the Node-side package API) — no export change needed here. Run `npm run typecheck` from
`packages/scorm-export` directly (`cd packages/scorm-export && npx tsc --noEmit`) to confirm this file alone
type-checks correctly (it won't be picked up by the root `npm run typecheck` until Task 8 wires it into an
entry point that's part of the package's `include`).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: add SCORM 1.2 API bridge

Hand-written from the SCORM 1.2 spec, covering exactly the CMI fields this
player needs (lesson_status, score, session_time, lesson_location bookmark,
suspend_data resume blob) — not a port of Articulate's generic 34K-line
dual-mode wrapper, since the reference export is SCORM 1.2 only.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Standalone player bundle (esbuild entry point + build script)

**Files:**
- Create: `packages/scorm-export/src/player-bundle/entry.tsx`,
  `packages/scorm-export/src/player-bundle/styles.css`, `packages/scorm-export/scripts/build-player.mjs`
- Modify: `packages/scorm-export/package.json` (add `build` script + React/esbuild/PostCSS deps)

**Interfaces:**
- Consumes: `MotoViewer` from `apps/web/src/learning/player/MotoViewer.tsx` (imported by relative path across
  the workspace — see Step 1 for how esbuild resolves the `@/` alias apps/web code uses internally), `ScormBridge`
  (Task 7).
- Produces: `dist/player.js`, `dist/player.css` — read by Task 6's `buildScormPackage` as the `playerBundle` input.

- [ ] **Step 1: Confirm the `@/` alias mapping esbuild needs to resolve**

`MotoViewer.tsx` and its dependency tree import via the `@/` alias (e.g. `@/learning/course-structure`,
`@/shared/contracts/player-course`) which Next.js resolves via `apps/web/tsconfig.json`'s `paths`. Read
`apps/web/tsconfig.json` to confirm the exact mapping (expected: `"@/*": ["./src/*"]`) before writing the esbuild
alias config in Step 3 — esbuild needs an explicit `alias` option pointing `@` at the absolute path of
`apps/web/src`.

- [ ] **Step 2: `packages/scorm-export/src/player-bundle/styles.css`**

Read `apps/web/src/app/globals.css` in full and copy it here **verbatim** (all `@import` lines, the
`@font-face` rules, `@custom-variant dark`, and the complete `@theme inline { ... }` block) so the standalone
bundle renders with the identical Motorola brand theme as the live app — do not re-author the theme tokens from
memory. After the copied content, add one line so Tailwind's v4 automatic content-scanning also covers the
player component tree (which lives outside this package's own directory):
```css
@source '../../../../apps/web/src';
```

- [ ] **Step 3: `packages/scorm-export/src/player-bundle/entry.tsx`**

```tsx
import { createRoot } from 'react-dom/client';
import MotoViewer from '@/learning/player/MotoViewer';
import { ScormBridge } from './scorm-api';
import './styles.css';

interface CourseDataPayload {
  content: { course: unknown; sections: unknown };
  assistant: unknown;
}

function readCoursePayload(): CourseDataPayload {
  const script = document.getElementById('course-data');
  if (!script?.textContent) throw new Error('Course data payload missing.');
  return JSON.parse(script.textContent) as CourseDataPayload;
}

function mount(): void {
  const container = document.getElementById('app');
  if (!container) throw new Error('Mount point #app missing.');

  const payload = readCoursePayload();
  const bridge = new ScormBridge();
  bridge.connect();

  const savedBookmark = bridge.getBookmark() || undefined;

  const root = createRoot(container);
  root.render(
    <MotoViewer
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      course={payload.content.course as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sections={payload.content.sections as any}
      preview
      bypassNavigationLocks={false}
      initialSectionKey={savedBookmark}
      assistant={payload.assistant ?? undefined}
      onLessonChange={(lessonKey) => {
        bridge.reportInProgress();
        bridge.setBookmark(lessonKey);
      }}
      onFinalQuizResult={(result) => bridge.reportQuizResult(result)}
      onCourseComplete={() => bridge.reportComplete()}
    />,
  );

  window.addEventListener('beforeunload', () => bridge.finish());
}

mount();
```

Note: the `as any` casts are deliberate — the content JSON was produced by `apps/web`'s own
`toPlayerCourseContent`, which already returns exactly the `CourseContent`/`CourseSection[]` shape `MotoViewer`
expects, but this package has no direct type dependency on `apps/web/src/shared/contracts/player-course.ts`
(that's the whole point of Task 11's design — avoid that cross-package coupling), so the shape isn't
statically provable here. This is intentional, not a shortcut to fix later.

- [ ] **Step 4: `packages/scorm-export/scripts/build-player.mjs`**

```js
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const webSrc = path.join(root, '..', '..', 'apps', 'web', 'src');
const outDir = path.join(root, 'dist');

await mkdir(outDir, { recursive: true });

await build({
  entryPoints: [path.join(root, 'src', 'player-bundle', 'entry.tsx')],
  bundle: true,
  minify: true,
  format: 'iife',
  outfile: path.join(outDir, 'player.js'),
  jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
  alias: { '@': webSrc },
  define: { 'process.env.NODE_ENV': '"production"' },
});

const cssEntry = path.join(root, 'src', 'player-bundle', 'styles.css');
const cssSource = await readFile(cssEntry, 'utf8');
const result = await postcss([tailwindcss()]).process(cssSource, { from: cssEntry, to: path.join(outDir, 'player.css') });
await writeFile(path.join(outDir, 'player.css'), result.css);

console.log('Built packages/scorm-export/dist/player.js and player.css');
```

- [ ] **Step 5: Add build tooling to `packages/scorm-export/package.json`**

Add to `"scripts"`: `"build": "node scripts/build-player.mjs"`. Add to `"dependencies"`: `"react": "^19"`,
`"react-dom": "^19"` (match the exact versions `apps/web/package.json` uses — read that file's `react`/
`react-dom` version strings first and mirror them precisely, since the bundle must be binary-compatible with the
component tree it's importing). Add to `"devDependencies"`: `"@tailwindcss/postcss"`, `"postcss"`, `"@types/react"`,
`"@types/react-dom"` (again matching `apps/web/package.json`'s versions), plus whatever `tw-animate-css` /
`shadcn` packages `globals.css` imports resolve to (check `apps/web/package.json` for those exact package names
and versions too, since `styles.css` in Step 2 imports them by the same names).

- [ ] **Step 6: Build and manually verify**

Run: `cd packages/scorm-export && npm run build`. Expected: `dist/player.js` and `dist/player.css` are produced
with no errors. Then hand-craft a minimal test HTML file locally (not committed) that loads `dist/player.js`/
`dist/player.css` with a `#course-data` script tag containing a small real course's JSON (fetch one via
`psql`/Prisma Studio from a frozen `CourseRevision.snapshot`, run it through `toPlayerCourseContent` in a
scratch Node REPL using `apps/web`'s existing code) — open it in a browser and confirm the player renders,
navigates, and (since no `window.API` exists in this manual test) the SCORM bridge's `connect()` returns `false`
gracefully without throwing.

- [ ] **Step 7: Verify lint/typecheck**

Run: `npm run lint && npm run typecheck` from the repo root. Expected: clean. (The `dist/` output directory
should not be committed — add `packages/scorm-export/dist/` to `.gitignore` if not already covered by an
existing pattern; check `.gitignore` first.)

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: add standalone player bundle (esbuild + Tailwind) for SCORM export

Mounts the real MotoViewer component tree client-side against a JSON
payload inlined in the generated HTML, with zero live API calls — reuses
the exact same 'preview' code path already proven by Course Studio's own
author-preview and the review-link surface, and shares the live app's
Tailwind theme verbatim rather than re-authoring it.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: `MotoViewer` completion-signal props (additive only)

**Files:**
- Modify: `apps/web/src/learning/player/MotoViewer.tsx`
- Modify: `apps/web/src/learning/player/CoursePhaseScreen.tsx`

**Interfaces:**
- Produces: two new optional `MotoViewer` props, `onFinalQuizResult?: (result: { score: number; total: number;
  passed: boolean }) => void` and `onCourseComplete?: () => void`.
- Consumes (Task 8): the player-bundle entry point wires both to the `ScormBridge`.

**No existing caller passes these props** (`CourseStudioWorkspace.tsx`, `ReviewPlayer.tsx` via `PlayerViewport`) —
this must be a strictly additive change with zero behavior difference for them.

- [ ] **Step 1: Read the current files before editing**

Read `apps/web/src/learning/player/MotoViewer.tsx` and `apps/web/src/learning/player/CoursePhaseScreen.tsx` in
full — both were touched by two bugfixes earlier this session; confirm current line numbers before editing
rather than trusting any numbers cited elsewhere in this plan.

- [ ] **Step 2: Add the props to `MotoViewer`'s signature**

In the destructured props and the type annotation, add `onFinalQuizResult` and `onCourseComplete` alongside the
existing `onLessonChange`/`onAssistantAnswer` props (same optional-callback shape):
```ts
onFinalQuizResult?: (result: { score: number; total: number; passed: boolean }) => void;
onCourseComplete?: () => void;
```

- [ ] **Step 3: Wire `onCourseComplete`**

Find the existing `useEffect` that watches `phase.phase === 'complete'` (used today for the burst/localStorage
resume-write logic — read the current file to locate it precisely) and add a call to `onCourseComplete?.()`
guarded the same way the existing logic distinguishes "just became complete" from "already was complete" (mirror
`useCourseNavigation.ts`'s `wasComplete` ref pattern if `MotoViewer` doesn't already have an equivalent local
guard — do not fire on every render while `phase.phase === 'complete'` stays true, only once on the transition).

- [ ] **Step 4: Thread `onFinalQuizResult` through to `CoursePhaseScreen`**

Add `onFinalQuizResult?: (result: { score: number; total: number; passed: boolean }) => void;` to
`CoursePhaseScreenProps` and the destructured props in `CoursePhaseScreen.tsx`. In the `case 'final-quiz':`
branch, `QuizLessonDynamic` already receives `onPass={finishQuiz}` and `onFail={finishQuiz}` (both no-arg,
confirmed at the current file's lines 144-145). Read `apps/web/src/learning/player/lesson-types/QuizLesson.tsx`
(or wherever the actual quiz-session summary with score/total lives — check `CourseQuizPlayer.tsx`'s
`submitQuiz`/`session.summary` for the exact shape) to confirm what data is available at the moment `onPass`/
`onFail` fire, then wire additional `onScored={(result) => onFinalQuizResult?.(result)}`-style prop (name it to
match whatever prop `QuizLesson`/`CourseQuizPlayer` already expose for a scored-result callback, or add one
following the same additive-optional-prop pattern if none exists) — pass `{ score, total, passed: <matches
onPass fired> }`. Do not replace the existing `onPass`/`onFail` wiring; add alongside it. In `MotoViewer.tsx`,
pass `onFinalQuizResult={onFinalQuizResult}` down into the `<CoursePhaseScreen ... />` call.

- [ ] **Step 5: Verify**

Run: `npm run lint && npm run typecheck`. Expected: clean.

- [ ] **Step 6: Manual smoke check**

Run `npm run dev`, exercise the existing Course Studio preview and/or a real course's final quiz in the learner
player — confirm zero visible behavior change (the new props are unused by every current caller, so this should
be a no-op regression check).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: add optional onFinalQuizResult/onCourseComplete props to MotoViewer

Additive only — no existing caller passes these, zero behavior change for
Course Studio preview or the review-link player. Needed by the SCORM
export's player bundle to report quiz score/pass-fail and course
completion to the SCORM API bridge.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Job-worker handler

**Files:**
- Modify: `apps/job-worker/src/handlers.ts`
- Modify: `apps/job-worker/package.json` (add `@moto-ai/scorm-export` dependency)

**Interfaces:**
- Consumes: `ScormExportPayloadSchema` (Task 3), `buildScormPackage` (Task 6), `putR2Object` (Task 1), Prisma
  client (`prisma.courseRevision.findUnique`, `prisma.courseScormExport.create` — direct Prisma access from
  job-worker is already an established pattern, see `generateCourse`'s `prisma.courseRevision.findUnique` call
  at the current file's line ~139).
- Produces: `scormExport(job: ClaimedJob): Promise<ScormExportResult>`, wired into `executeJob`'s dispatch.

The job payload carries only `{ revisionId }` — the actual content JSON (already answer-key-included, already
converted from `CourseGraph` to player-ready shape by `apps/web` — see Task 11) arrives as the job's
`JobArtifact` bytes, exactly like `DocumentIndexPayload` jobs receive uploaded file bytes today.

- [ ] **Step 1: Add the handler**

Add near the other handler functions in `apps/job-worker/src/handlers.ts`:

```ts
async function scormExport(job: ClaimedJob): Promise<import('@moto-ai/contracts/jobs').ScormExportResult> {
  const payload = ScormExportPayloadSchema.safeParse(job.payload);
  if (!payload.success) {
    throw new NonRetryableJobError('The queued export request is invalid. Trigger a new export.');
  }
  if (!job.artifact) {
    throw new NonRetryableJobError('The queued course content is missing. Trigger a new export.');
  }

  const revision = await prisma.courseRevision.findUnique({
    where: { id: payload.data.revisionId },
    select: { id: true, sourceTitle: true, version: true },
  });
  if (!revision) {
    throw new NonRetryableJobError('The frozen revision no longer exists. Trigger a new export.');
  }

  let bundlePayload: { content: unknown; assistant: unknown; masteryScore: number };
  try {
    bundlePayload = JSON.parse(job.artifact.bytes.toString('utf8'));
  } catch {
    throw new NonRetryableJobError('The queued course content is corrupted. Trigger a new export.');
  }

  const playerBundleDir = path.join(playerBundleRoot(), 'dist');
  const playerBundle = {
    'player.js': await readFile(path.join(playerBundleDir, 'player.js')),
    'player.css': await readFile(path.join(playerBundleDir, 'player.css')),
  };

  const scoIdentifier = `export_${revision.id}`;
  const built = await buildScormPackage({
    title: revision.sourceTitle,
    scoIdentifier,
    masteryScore: bundlePayload.masteryScore,
    content: bundlePayload.content,
    assistant: bundlePayload.assistant,
    playerBundle,
  });

  const r2Key = `exports/${revision.id}/${job.id}.zip`;
  await putR2Object({ key: r2Key, bytes: built.buffer, contentType: 'application/zip' });

  const record = await prisma.courseScormExport.create({
    data: {
      revisionId: revision.id,
      jobId: job.id,
      r2Key,
      byteSize: built.byteSize,
      sha256: built.sha256,
    },
  });

  return { exportId: record.id, r2Key, byteSize: built.byteSize, sha256: built.sha256 };
}

function playerBundleRoot(): string {
  const configured = process.env.SCORM_PLAYER_BUNDLE_PATH;
  if (configured) return configured;
  throw new NonRetryableJobError(
    'SCORM_PLAYER_BUNDLE_PATH is not configured. The player bundle must be built and its location set before exports can run.',
  );
}
```

Add the needed imports at the top of the file: `import path from 'node:path';`, `import { readFile } from
'node:fs/promises';`, `import { ScormExportPayloadSchema, type ScormExportResult } from
'@moto-ai/contracts/jobs';`, `import { buildScormPackage } from '@moto-ai/scorm-export';`, `import { putR2Object }
from '@moto-ai/storage';`.

- [ ] **Step 2: Wire it into `executeJob`'s dispatch**

The current dispatch checks `kind === 'document_index'` then falls through to payload-shape sniffing for the
`AI_OPERATION`-overloaded kinds. `SCORM_EXPORT` is a first-class enum value (Task 2), so it doesn't need
sniffing — add an explicit branch. Change:
```ts
export async function executeJob(job: ClaimedJob): Promise<unknown> {
  const kind: JobKind =
    job.kind === 'DOCUMENT_INDEX'
      ? 'document_index'
      : job.kind === 'QUIZ_GENERATE'
        ? 'ai_operation'
        : 'ai_operation';

  if (kind === 'document_index') return indexDocument(job);
  if (AssistantQaGenerationPayloadSchema.safeParse(job.payload).success)
    return generateAssistantQa(job);
  if (CourseGenerationPayloadSchema.safeParse(job.payload).success) return generateCourse(job);
  throw new NonRetryableJobError('This AI operation is not registered with the worker.');
}
```
to:
```ts
export async function executeJob(job: ClaimedJob): Promise<unknown> {
  if (job.kind === 'DOCUMENT_INDEX') return indexDocument(job);
  if (job.kind === 'SCORM_EXPORT') return scormExport(job);

  if (AssistantQaGenerationPayloadSchema.safeParse(job.payload).success)
    return generateAssistantQa(job);
  if (CourseGenerationPayloadSchema.safeParse(job.payload).success) return generateCourse(job);
  throw new NonRetryableJobError('This AI operation is not registered with the worker.');
}
```
(This also simplifies away the unused `kind` variable's `QUIZ_GENERATE`/`ai_operation` ternary, which was dead
weight — both branches of that ternary resolved to `'ai_operation'` and `kind` was only ever compared against
`'document_index'`. Confirm via `grep -n "\bkind\b" apps/job-worker/src/handlers.ts` after this edit that `kind`
has no other remaining use before removing the `const kind: JobKind = ...` line entirely; if it's genuinely
unused now, delete it rather than leaving dead code.)

- [ ] **Step 3: Add the `@moto-ai/scorm-export` dependency**

`apps/job-worker/package.json` — add `"@moto-ai/scorm-export": "0.1.0"` to `dependencies`.

- [ ] **Step 4: Verify**

Run: `npm install && npm run lint && npm run typecheck`. Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: add scormExport job-worker handler

Loads the frozen revision's queued content JSON (delivered as a job
artifact, same pattern as document-index uploads), fetches/embeds its
referenced assets, builds the SCORM package, uploads it to R2, and records
a CourseScormExport row.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Enqueue function + apps/web server command (builds the content JSON)

**Files:**
- Modify: `packages/jobs/src/queue.ts`
- Modify: `apps/web/src/authoring/server/course-commands.ts`

**Interfaces:**
- Produces: `enqueueScormExportJob(input: { revisionId: string; content: unknown; assistant: unknown;
  masteryScore: number }): Promise<JobAcceptedResponse>` in `packages/jobs`; `requestScormExport(revisionId:
  string): Promise<JobAcceptedResponse>` in `apps/web`'s server commands (the piece that actually builds the
  content JSON via `toPlayerCourseContent`).
- Consumes (Task 12): the new POST API route calls `requestScormExport`.

- [ ] **Step 1: Add `enqueueScormExportJob` to `packages/jobs/src/queue.ts`**

Add `SCORM_EXPORT` to the `databaseKind`/`publicKind` maps:
```ts
const databaseKind: Record<JobKind, BackgroundJobKind> = {
  document_index: BackgroundJobKind.DOCUMENT_INDEX,
  assistant_qa_generate: BackgroundJobKind.AI_OPERATION,
  course_generate: BackgroundJobKind.AI_OPERATION,
  ai_operation: BackgroundJobKind.AI_OPERATION,
  scorm_export: BackgroundJobKind.SCORM_EXPORT,
};

const publicKind: Record<BackgroundJobKind, Exclude<JobKind, 'course_generate'>> = {
  DOCUMENT_INDEX: 'document_index',
  QUIZ_GENERATE: 'ai_operation',
  AI_OPERATION: 'ai_operation',
  SCORM_EXPORT: 'scorm_export',
};
```
Add the enqueue function, following `enqueueDocumentIndexJob`'s artifact-carrying pattern exactly:
```ts
export async function enqueueScormExportJob(input: {
  revisionId: string;
  content: unknown;
  assistant: unknown;
  masteryScore: number;
}): Promise<JobAcceptedResponse> {
  const bytes = Buffer.from(
    JSON.stringify({ content: input.content, assistant: input.assistant, masteryScore: input.masteryScore }),
    'utf8',
  );
  return enqueue('scorm_export', { revisionId: input.revisionId }, `scorm-export:${input.revisionId}:${bytes.length}`, {
    filename: 'course-content.json',
    contentType: 'application/json',
    bytes,
  });
}
```
Note the dedupe key intentionally includes `bytes.length`, not a content hash — re-exporting the exact same
frozen revision should be idempotent against the *queue* (avoid piling up duplicate in-flight jobs for rapid
double-clicks), but a byte-length-only key is a weak dedupe; if two different revisions' content happened to
serialize to the exact same byte length this would incorrectly dedupe them together. Use a proper content hash
instead: `createHash('sha256').update(bytes).digest('hex')` (import `createHash` from `node:crypto`) as part of
the dedupe key, i.e. `` `scorm-export:${input.revisionId}:${contentHash}` `` — correct this before finalizing the
function, don't ship the byte-length version.

- [ ] **Step 2: Add `requestScormExport` to `apps/web/src/authoring/server/course-commands.ts`**

Read the current file's imports and the shape of a neighboring function (e.g. `createAuthoringRevision`,
`createAuthoringReview`) before editing, to match existing conventions (error types thrown, how `prisma`/
`toCourseGraph` are imported). Add:

```ts
export async function requestScormExport(revisionId: string): Promise<JobAcceptedResponse> {
  const revision = await prisma.courseRevision.findUnique({
    where: { id: revisionId },
    include: { assistantSnapshot: true },
  });
  if (!revision) throw new Error('REVISION_NOT_FOUND');

  const graph = revision.snapshot as unknown as CourseGraph;
  const content = toPlayerCourseContent(graph, { includeAnswerKey: true });
  if (!content) throw new Error('REVISION_CONTENT_INVALID');

  const assistant =
    revision.assistantSnapshot.length > 0
      ? OfflineAssistantPayloadSchema.parse({
          version: OFFLINE_ASSISTANT_PAYLOAD_VERSION,
          items: revision.assistantSnapshot.map(({ citations: _citations, ...item }) => item),
        })
      : undefined;

  const finalQuizPassingScore =
    graph.finalQuiz && typeof graph.finalQuiz.payload === 'object' && graph.finalQuiz.payload
      ? (graph.finalQuiz.payload as { passingScore?: number }).passingScore
      : undefined;

  return enqueueScormExportJob({
    revisionId,
    content,
    assistant,
    masteryScore: finalQuizPassingScore ?? 80,
  });
}
```

Add imports: `toPlayerCourseContent` from `@/learning/course-player-adapter`, `enqueueScormExportJob` and
`JobAcceptedResponse` from `@moto-ai/jobs`/`@moto-ai/contracts/jobs`, `OfflineAssistantPayloadSchema`/
`OFFLINE_ASSISTANT_PAYLOAD_VERSION` from `@moto-ai/contracts` (same import already used in
`packages/database/src/course-review-repository.ts:5-10` — mirror that exact import list), `type CourseGraph`
from `@moto-ai/contracts/course-studio`.

Note the `80` fallback matches `DEFAULT_PASSING_SCORE` in `apps/web/src/learning/server/quiz-grading.ts` — this
is the same value, kept as a literal here rather than importing that constant, since it's a different concern
(SCORM manifest default vs. in-app quiz grading default) that happens to share a value today; don't couple them.

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run typecheck`. Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: add enqueueScormExportJob and requestScormExport

apps/web builds the exact same answer-key-included player payload its own
author-preview already produces, plus the frozen Course Assistant Q&A, and
hands both to job-worker as a job artifact — job-worker never needs to
import apps/web's content-conversion code.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: API routes

**Files:**
- Create: `apps/web/src/app/api/course-studio/revisions/[revisionId]/scorm-export/route.ts`
- Create: `apps/web/src/app/api/course-studio/exports/[exportId]/download/route.ts`

**Interfaces:**
- Consumes: `requestScormExport` (Task 11), `getR2Object` from `@moto-ai/storage` (Task 1), `prisma` for the
  download route's `CourseScormExport` lookup.

- [ ] **Step 1: POST export-trigger route**

Mirror `apps/web/src/app/api/course-studio/revisions/[revisionId]/review/route.ts` exactly (already read in
full):

```ts
import { NextRequest, NextResponse } from 'next/server';
import { isCourseStudioAuthorized } from '@/server/auth/course-studio';
import { jsonError, unexpectedApiError } from '@/shared/server/http';
import { requestScormExport } from '@/authoring/server/course-commands';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ revisionId: string }> },
): Promise<NextResponse> {
  if (!(await isCourseStudioAuthorized(request))) return jsonError('Unauthorized', 401);
  try {
    const result = await requestScormExport((await params).revisionId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'REVISION_NOT_FOUND') {
      return jsonError('Revision not found', 404);
    }
    if (error instanceof Error && error.message === 'REVISION_CONTENT_INVALID') {
      return jsonError('This revision contains invalid player content and cannot be exported.', 422);
    }
    return unexpectedApiError('course-studio/scorm-export', error);
  }
}
```

- [ ] **Step 2: GET download route**

Mirror `apps/web/src/app/api/course-assets/[...key]/route.ts`'s streaming pattern (already read in full), gated
by Course Studio auth (unlike the public asset route):

```ts
import { NextRequest } from 'next/server';
import { prisma } from '@moto-ai/database';
import { getR2Object } from '@moto-ai/storage';
import { isCourseStudioAuthorized } from '@/server/auth/course-studio';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ exportId: string }> },
) {
  if (!(await isCourseStudioAuthorized(request))) return new Response('Unauthorized', { status: 401 });

  const { exportId } = await params;
  const record = await prisma.courseScormExport.findUnique({ where: { id: exportId } });
  if (!record) return new Response('Export not found', { status: 404 });

  try {
    const object = await getR2Object(record.r2Key);
    if (!object.Body) return new Response('Export not found', { status: 404 });

    const headers = new Headers({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="scorm-export-${record.id}.zip"`,
      'Content-Length': String(record.byteSize),
    });

    return new Response(object.Body.transformToWebStream(), { headers });
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) return new Response('Export not found', { status: 404 });
    console.error('[api/course-studio/exports] R2 read failed');
    return new Response('Export unavailable', { status: 502 });
  }
}
```

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run typecheck`. Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: add SCORM export trigger and download API routes

Mirrors the existing review-link (POST, trigger) and course-asset (GET,
R2 stream) route patterns exactly. Both gated by the existing Course
Studio password auth.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: `RevisionPanel` UI

**Files:**
- Modify: `apps/web/src/authoring/RevisionPanel.tsx`

**Interfaces:**
- Consumes: the two new API routes (Task 12), `GET /api/jobs/[id]` (existing, unchanged).

- [ ] **Step 1: Add export state**

Alongside the existing `busy`/`message`/`reviewUrl` state, add:
```ts
const [exportUrl, setExportUrl] = useState<string | null>(null);
```

- [ ] **Step 2: Add the export handler**

Following `createLink`'s exact structure (already read in full — `fetchJson` call, `isCurrentCourse` guard,
`setMessage`/`setBusy` lifecycle):

```ts
async function exportScorm(revisionId: string) {
  const generation = courseGeneration.current;
  setBusy(true);
  setExportUrl(null);
  setMessage('Building SCORM package…');
  try {
    const { jobId } = await fetchJson<{ jobId: string }>(
      `/api/course-studio/revisions/${encodeURIComponent(revisionId)}/scorm-export`,
      { method: 'POST' },
      'SCORM export could not be started.',
    );
    if (!isCurrentCourse(generation)) return;

    let status: 'queued' | 'running' | 'succeeded' | 'failed' = 'queued';
    let result: { exportId?: string } | null = null;
    while (status === 'queued' || status === 'running') {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (!isCurrentCourse(generation)) return;
      const job = await fetchJson<{
        status: typeof status;
        result: { exportId?: string } | null;
        errorMessage: string | null;
      }>(`/api/jobs/${encodeURIComponent(jobId)}`, { method: 'GET' }, 'SCORM export status could not be read.');
      if (!isCurrentCourse(generation)) return;
      status = job.status;
      result = job.result;
      if (status === 'failed') throw new Error(job.errorMessage || 'SCORM export failed.');
    }

    if (!result?.exportId) throw new Error('SCORM export finished without a result.');
    setExportUrl(`/api/course-studio/exports/${encodeURIComponent(result.exportId)}/download`);
    setMessage('SCORM package ready. Download it now.');
  } catch (error) {
    if (!isCurrentCourse(generation)) return;
    setMessage(error instanceof Error ? error.message : 'SCORM export could not be started.');
  } finally {
    if (isCurrentCourse(generation)) setBusy(false);
  }
}
```

- [ ] **Step 3: Add the button and download link to the render**

In the per-revision row (the `revisions.map((revision) => ...)` block), add an "Export SCORM package" button
next to the existing "Create review link"/"Replace review link" button, following the same
`studio-glass-control` styling class used there:

```tsx
<button
  className="studio-glass-control border-border hover:border-primary hover:text-primary rounded-md border px-2 py-1"
  disabled={busy}
  onClick={() => exportScorm(revision.id)}
  type="button"
>
  Export SCORM package
</button>
```

Below the existing `reviewUrl` download-link block, add an analogous one for `exportUrl`:
```tsx
{exportUrl && (
  <a
    className="studio-glass-control border-primary text-primary mt-3 flex w-full items-center gap-2 rounded-lg border p-2 text-left text-xs"
    href={exportUrl}
    download
  >
    <Clipboard className="h-4 w-4 shrink-0" />
    <span className="truncate">Download SCORM package</span>
  </a>
)}
```
(Reuses the already-imported `Clipboard` icon for visual consistency; swap for a more literal download icon from
`lucide-react` if one is already imported elsewhere in this file — check the current import list first.)

- [ ] **Step 4: Verify**

Run: `npm run lint && npm run typecheck`. Expected: clean.

- [ ] **Step 5: Manual smoke check**

Run `npm run dev`, open Course Studio, freeze a revision, click "Export SCORM package," wait for the poll loop
to resolve, download the resulting zip, unzip it, and load `index_lms.html` directly in a browser — confirm the
course renders and navigates with zero network-tab activity (no `window.API` present locally, so the SCORM
bridge should simply not connect — this is expected, not an error).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: add SCORM export UI to RevisionPanel

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Deploy wiring — job-worker build step

**Files:**
- Modify: `apps/job-worker/package.json`
- Modify: root `package.json` (if a root `build` orchestration step should cover this — check current root
  `build` script content first; it currently only builds `apps/web`)

**Interfaces:** None new — this is operational wiring so the prebuilt player bundle Task 10's handler reads via
`SCORM_PLAYER_BUNDLE_PATH` actually exists at runtime.

- [ ] **Step 1: Add a `build` script to `apps/job-worker/package.json`**

`apps/job-worker` currently has no `build` script (only `dev`/`typecheck`). Add:
```json
"build": "npm run build --workspace=@moto-ai/scorm-export"
```
(Confirm `packages/scorm-export/package.json`'s `build` script — added in Task 8 — is what actually runs; adjust
the workspace-invocation syntax to match how this monorepo's `npm run` scripts already invoke cross-workspace
commands, e.g. check `scripts/run-workspace.mjs`'s usage pattern first and follow the same convention rather than
assuming raw `npm run build --workspace=X` is idiomatic here if the repo has its own wrapper for this.)

- [ ] **Step 2: Document the `SCORM_PLAYER_BUNDLE_PATH` env var**

Add it to `.env.example` (and `.env.local.example` if that's where other path-like/deploy-specific vars for
job-worker live — check `JOB_WORKER_POLL_INTERVAL_MS`'s location as the precedent) with a comment explaining it
must point at the absolute path containing `packages/scorm-export/dist/{player.js,player.css}` after that
package's `build` script has run.

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run typecheck`. Expected: clean (this task touches no TypeScript).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: wire job-worker's deploy build step to the SCORM player bundle

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage**: every step of the approved plan-mode design is covered, with one documented, justified
  deviation (Task 11 replaces the approved design's "move toPlayerCourseContent to a shared package" with
  "apps/web builds the JSON and hands it to job-worker as an artifact") — the outcome (job-worker never needs
  apps/web-local schema code) is the same intent, achieved more safely.
- **Placeholder scan**: every task has either real, complete code (new modules: manifest, assets, build-package,
  scorm-api, entry.tsx, build-player.mjs, API routes, RevisionPanel additions) or, where exact current file
  content genuinely couldn't be pre-verified without live access at plan-writing time (the final-quiz score
  threading in Task 9 Step 4, the workspace-build-invocation syntax in Task 14 Step 1), an explicit instruction
  to read the current file first and match its existing pattern — not a vague "handle it appropriately."
- **Type consistency**: `ScormExportResult`'s fields (`exportId`, `r2Key`, `byteSize`, `sha256`) are used
  identically in Task 3 (schema), Task 10 (handler return value), and Task 13 (UI reads `job.result.exportId`).
  `ScormBridge`'s method names in Task 7 match Task 8's `entry.tsx` call sites exactly.
