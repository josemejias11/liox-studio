# Course Studio Authoring Parity and Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the moto g87 demo's supported learning structure fully authorable, add a neutral comprehensive template, and add exact independent course duplication without treating moto g87 as a template.

**Architecture:** Dedicated `CourseQuiz` commands and guided assessment editors establish authoring parity, while a shared readiness service protects revision, review, and SCORM delivery. A code-owned generic template is instantiated transactionally without product assets; exact duplication remains a separate durable worker job that captures a live graph, deep-copies media, and preserves immutable source bindings and approved Q&A.

**Tech Stack:** TypeScript, React 19, Next.js App Router, Zod, Prisma/PostgreSQL, the existing PostgreSQL-backed job queue, local object storage through `@moto-ai/storage`, and the existing Moto Player/SCORM pipeline.

**Spec:** `docs/superpowers/specs/2026-08-22-course-studio-authoring-parity-templates-design.md`

## Global Constraints

- Moto g87 remains a finished demo and maintenance seed; no template code imports or executes `scripts/seed-moto-g87-course.ts`.
- The curated template contains neutral placeholder copy and empty media slots only. It contains no moto g87 names, URLs, source IDs, Q&A, citations, or storage keys.
- Template creation and exact course duplication remain separate user actions and separate server workflows.
- Learner and review payloads never expose `isCorrect`, answer feedback, or answer explanations; only controlled author preview may receive an answer-key projection.
- Only single-answer assessments are authorable. True/false uses two single-choice answers. Multiple-answer authoring is excluded.
- Remove Quiz from the new-lesson picker. Preserve existing inline quiz lessons, show them as unsupported, and block new frozen revisions while they remain.
- Preserve unknown lesson payload metadata unless the guided editor explicitly owns the field.
- Duplicate media into the destination course namespace; never leave a duplicate dependent on mutable source-course media.
- Reuse immutable `CourseSourceBinding` rows for duplicated grounding. Do not copy or re-index source bytes and do not call the parser or OpenAI.
- Do not copy revisions, reviews, feedback, learner sessions, progress, attempts, analytics, jobs, generations, or SCORM exports.
- Do not add automated test files or run an automated test suite. Verification is Prisma generation/migration, TypeScript checks, lint, builds, direct database inspection, and authenticated browser acceptance.
- Do not run the root formatter because it writes unrelated files. Format only files owned by the active task.
- Preserve unrelated worktree changes. In particular, inspect the current untracked `GUIDE.md` before the documentation task and never overwrite it wholesale.
- Each task receives an implementation review before its commit. Stage only the files listed for that task.

## File ownership map

- `packages/contracts/src/course-assessment.ts`: assessment authoring schema and readiness-safe payload types.
- `packages/contracts/src/course-template.ts`: versioned generic template and concrete checklist schemas.
- `packages/contracts/src/course-readiness.ts`: pure readiness issue contract and graph validator.
- `packages/contracts/src/jobs.ts`: duplication job payload, artifact, result, and public job-kind schemas.
- `packages/database/src/course-assessment-repository.ts`: transactional `CourseQuiz` attachment and removal.
- `packages/database/src/course-template-repository.ts`: transactional instantiation of a validated generic template.
- `packages/database/src/course-duplication-repository.ts`: capture helpers and transactional destination persistence.
- `apps/web/src/authoring/templates/`: curated template catalog and the neutral comprehensive definition.
- `apps/web/src/authoring/AssessmentInspector.tsx`: shared chapter/final assessment editor.
- `apps/web/src/authoring/assessment-draft.ts`: editor draft conversion, validation mapping, and payload serialization.
- `apps/web/src/authoring/CourseCreationPanel.tsx`: Blank course versus Comprehensive course choice.
- `apps/web/src/authoring/CourseDuplicationStatusPanel.tsx`: durable duplication progress and completion UI.
- `packages/storage/src/course-asset-copy.ts`: deterministic object copying, destination inventory metadata, and nested URL rewriting.
- `apps/job-worker/src/handlers.ts`: registered duplication orchestration only; persistence and object helpers remain in their owning packages.

---

### Task 1: Add assessment, template, readiness, and duplication contracts

**Files:**

- Create: `packages/contracts/src/course-assessment.ts`
- Create: `packages/contracts/src/course-template.ts`
- Create: `packages/contracts/src/course-readiness.ts`
- Modify: `packages/contracts/src/course-assets.ts`
- Modify: `packages/contracts/src/course-studio.ts`
- Modify: `packages/contracts/src/jobs.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/web/src/shared/contracts/course-settings.ts`
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/20260822000000_course_templates_and_duplication/migration.sql`
- Modify: `packages/database/src/course-repository.ts`
- Modify: `packages/database/src/index.ts`

**Interfaces:**

- Produces: `CourseImageReferenceSchema`, `CourseAssessmentInputSchema`, `CourseAssessmentInput`, `CourseTemplateDefinitionSchema`, `CourseTemplateDefinition`, `CourseTemplateChecklistSchema`, `CourseReadinessIssueSchema`, `CourseDuplicatePayloadSchema`, `CourseDuplicateArtifactSchema`, and `CourseDuplicateResultSchema`.
- Produces: optional `Course.createdFromTemplateKey`, `createdFromTemplateVersion`, `templateChecklist`, `creationJobId`, and `duplicatedFromCourseId` fields plus `BackgroundJobKind.COURSE_DUPLICATE`.
- Consumes: current `CourseGraph`, `CourseQuiz`, `AssistantQaItem`, and job artifact conventions.

- [x] **Step 1: Define the assessment schema**

Promote the existing persisted `{ asset: { url, originalFilename? } }` shape to `CourseImageReferenceSchema` in `packages/contracts/src/course-assets.ts`, then make the web course-settings schema import it. Create a strict single-answer authoring contract and keep generated client keys outside the persisted contract.

```ts
export const CourseAssessmentAnswerSchema = z.object({
  _key: z.string().min(1).max(120),
  text: z.string().trim().min(1).max(1000),
  isCorrect: z.boolean(),
  feedback: z.string().trim().max(2000).optional(),
});

export const CourseAssessmentQuestionSchema = z
  .object({
    _key: z.string().min(1).max(120),
    questionText: z.string().trim().min(1).max(2000),
    questionType: z.literal('single'),
    image: CourseImageReferenceSchema.optional(),
    explanation: z.string().trim().max(2000).optional(),
    answers: z.array(CourseAssessmentAnswerSchema).min(2).max(8),
  })
  .superRefine((question, context) => {
    if (question.answers.filter((answer) => answer.isCorrect).length !== 1) {
      context.addIssue({
        code: 'custom',
        path: ['answers'],
        message: 'Exactly one answer must be marked correct.',
      });
    }
  });
```

Export `CourseAssessmentInputSchema` with `title`, `instructions`, `questions`, `passingScore`, `allowRetry`, and `showCorrectAnswers`. Reuse the new shared image-reference schema from both assessment and course-settings validation so URL rules have one owner.

- [x] **Step 2: Define versioned template and checklist contracts**

Use definition-local keys for chapters, lessons, questions, and answers. Define checklist rules as a discriminated union:

```ts
const TemplateRequirementSchema = z.discriminatedUnion('rule', [
  z.object({
    id: z.string(),
    entityId: z.string(),
    field: z.string(),
    label: z.string(),
    rule: z.literal('changed'),
    initialFingerprint: z.string(),
  }),
  z.object({
    id: z.string(),
    entityId: z.string(),
    field: z.string(),
    label: z.string(),
    rule: z.literal('media'),
  }),
  z.object({
    id: z.string(),
    entityId: z.string(),
    field: z.string(),
    label: z.string(),
    rule: z.literal('minimum'),
    minimum: z.number().int().min(1),
  }),
  z.object({
    id: z.string(),
    entityId: z.string(),
    field: z.string(),
    label: z.string(),
    rule: z.literal('assessment'),
  }),
]);
```

`CourseTemplateDefinitionSchema` must accept the nine supported visual lesson types but reject `quiz`. `CourseTemplateChecklistSchema` stores concrete destination entity IDs so later catalog versions cannot alter existing course readiness.

- [x] **Step 3: Add readiness and duplication job contracts**

Define stable readiness issue codes including `template_placeholder`, `required_media`, `unsupported_lesson`, `invalid_assessment`, `invalid_drag_drop`, and `invalid_learning_cue`.

Add `course_duplicate` to `JobKindSchema` and define:

```ts
export const CourseDuplicatePayloadSchema = z.object({
  sourceCourseId: z.string().min(1).max(100),
  destinationCourseId: z.string().min(1).max(100),
});

export const CourseDuplicateResultSchema = z.object({
  courseId: z.string().min(1).max(100),
});
```

The artifact schema contains `requestedTitle`, `slugBase`, `graph`, approved Q&A, `sourceIds`, `assetUrls`, and a 64-character lowercase SHA-256 `contentHash`.

- [x] **Step 4: Extend Prisma additively**

Add the optional Course fields and duplication enum value. Use exact SQL that does not rewrite existing rows:

```sql
ALTER TYPE "BackgroundJobKind" ADD VALUE 'COURSE_DUPLICATE';
ALTER TABLE "Course"
  ADD COLUMN "createdFromTemplateKey" TEXT,
  ADD COLUMN "createdFromTemplateVersion" INTEGER,
  ADD COLUMN "templateChecklist" JSONB,
  ADD COLUMN "creationJobId" TEXT,
  ADD COLUMN "duplicatedFromCourseId" TEXT;
CREATE UNIQUE INDEX "Course_creationJobId_key" ON "Course"("creationJobId");
```

Do not add a cascading self-relation for `duplicatedFromCourseId`.

Add the optional provenance/checklist fields to `CourseGraph` and `courseGraphSelect`. Keep `templateChecklist` typed as `unknown | null` at the graph boundary and parse it with `CourseTemplateChecklistSchema` inside readiness validation; this avoids a circular import between course-studio and course-template contracts.

- [x] **Step 5: Regenerate Prisma and verify the contract baseline**

Run:

```bash
npm run db:generate
npm run db:migrate
npx prettier --write packages/contracts/src/course-assessment.ts packages/contracts/src/course-template.ts packages/contracts/src/course-readiness.ts packages/contracts/src/course-assets.ts packages/contracts/src/course-studio.ts packages/contracts/src/jobs.ts packages/contracts/src/index.ts apps/web/src/shared/contracts/course-settings.ts packages/database/prisma/schema.prisma packages/database/src/course-repository.ts packages/database/src/index.ts
npm run typecheck
git diff --check
```

Expected: migration applies once, Prisma client exposes the five optional Course fields and `COURSE_DUPLICATE`, and TypeScript exits 0.

- [x] **Step 6: Commit the contract and migration slice**

```bash
git add packages/contracts apps/web/src/shared/contracts/course-settings.ts packages/database/prisma packages/database/src/course-repository.ts packages/database/src/index.ts
git commit -m "feat: define course template and assessment contracts"
```

---

### Task 2: Implement transactional chapter and final assessments

**Files:**

- Create: `packages/database/src/course-assessment-repository.ts`
- Modify: `packages/database/src/index.ts`
- Modify: `apps/web/src/authoring/server/course-commands.ts`
- Create: `apps/web/src/app/api/course-studio/courses/[courseId]/final-assessment/route.ts`
- Create: `apps/web/src/app/api/course-studio/courses/[courseId]/chapters/[chapterId]/quick-check/route.ts`
- Modify: `apps/web/src/authoring/studio-client.ts`

**Interfaces:**

- Consumes: `CourseAssessmentInput` and the public `getAuthoringCourse()` refresh after each mutation.
- Produces: `upsertChapterQuickCheck`, `removeChapterQuickCheck`, `upsertFinalAssessment`, and `removeFinalAssessment`, each returning `Promise<CourseGraph>`.
- Produces: authenticated `PUT` and `DELETE` APIs returning `{ course: CourseGraph }`.

- [x] **Step 1: Add assessment payload conversion**

Create one private conversion function so both placements persist the same shape:

```ts
function assessmentPayload(input: CourseAssessmentInput): Prisma.InputJsonObject {
  return {
    questions: input.questions as unknown as Prisma.InputJsonArray,
    passingScore: input.passingScore,
    allowRetry: input.allowRetry,
    showCorrectAnswers: input.showCorrectAnswers,
  };
}
```

Keep title and instructions in the `CourseQuiz` columns, not duplicated inside payload.

- [x] **Step 2: Implement chapter quick-check transactions**

Verify `{ id: chapterId, courseId }` before mutation. Upsert the attached quiz when present; otherwise create a fresh `quiz.<uuid>` and assign `quickCheckId` inside the same transaction. Removal must clear `quickCheckId` first, delete the formerly attached `CourseQuiz`, and return successfully when no check exists. After the transaction, call public `getAuthoringCourse(courseId)` and throw `COURSE_NOT_FOUND` only if that refresh unexpectedly returns null; do not import the private `requireGraph()` helper from another module.

- [x] **Step 3: Implement final-assessment transactions**

Use the same pattern against `Course.finalQuizId`. Never update a quiz belonging to another course, and never leave an unattached quiz after removal.

- [x] **Step 4: Add server commands and routes**

Parse every `PUT` body with `CourseAssessmentInputSchema`. Map invalid input to 400 with field issues, missing course/chapter to 404, and repository failures through `unexpectedApiError`. Apply `isCourseStudioAuthorized()` before body parsing.

- [x] **Step 5: Add typed studio-client methods**

```ts
upsertChapterQuickCheck(courseId, chapterId, input);
removeChapterQuickCheck(courseId, chapterId);
upsertFinalAssessment(courseId, input);
removeFinalAssessment(courseId);
```

All methods reuse `mutate()` and return the refreshed `CourseGraph`.

- [x] **Step 6: Verify the persistence slice**

Run targeted formatting, `npm run typecheck`, `npm run lint`, and `git diff --check`. With the authenticated app running, issue one chapter-check `PUT`, read the workspace graph, remove it with `DELETE`, and confirm directly in Prisma Studio or a read-only Prisma query that no orphan `CourseQuiz` remains. Repeat for `finalQuizId`.

- [x] **Step 7: Commit assessment persistence**

```bash
git add packages/database/src/course-assessment-repository.ts packages/database/src/index.ts apps/web/src/authoring/server/course-commands.ts apps/web/src/app/api/course-studio/courses apps/web/src/authoring/studio-client.ts
git commit -m "feat: add structural assessment persistence"
```

---

### Task 3: Add guided assessment authoring and remove the misleading Quiz block

**Files:**

- Create: `apps/web/src/authoring/assessment-draft.ts`
- Create: `apps/web/src/authoring/AssessmentQuestionsField.tsx`
- Create: `apps/web/src/authoring/AssessmentInspector.tsx`
- Modify: `apps/web/src/authoring/studio-types.ts`
- Modify: `apps/web/src/authoring/CourseOutline.tsx`
- Modify: `apps/web/src/authoring/StudioInspector.tsx`
- Modify: `apps/web/src/authoring/CourseStudioWorkspace.tsx`
- Modify: `apps/web/src/authoring/useStudioSelection.ts`
- Modify: `apps/web/src/authoring/useStudioCourseCommands.ts`
- Modify: `apps/web/src/authoring/inspectors/LessonInspector.tsx`

**Interfaces:**

- Consumes: Task 2 studio-client methods and `CourseGraphChapter.quickCheck`/`CourseGraph.finalQuiz`.
- Produces: selections `{ kind: 'quickCheck'; id: chapterId }` and `{ kind: 'finalQuiz'; id: courseId }`.
- Produces: a shared `AssessmentInspector` whose save/remove callbacks return refreshed course graphs through existing persistence state.

- [x] **Step 1: Build the assessment draft adapter**

Represent stable React keys separately from persisted `_key`. `assessmentDraft(quiz)` loads existing `isCorrect`, feedback, explanation, score, and flags. `assessmentInput(draft)` must parse through `CourseAssessmentInputSchema` before a request. Its fingerprint excludes client-only keys.

- [x] **Step 2: Build question and answer controls**

`AssessmentQuestionsField` supports add/remove/reorder for questions and answers, one optional question image, a radio button for exactly one correct answer, feedback per answer, and question explanation. Selecting a new correct answer clears the previous selection rather than allowing an invalid multi-correct intermediate payload.

- [x] **Step 3: Build the shared inspector**

The inspector owns title, instructions, passing score, retry, answer reveal, questions, dirty state, saving state, structured errors, and a confirmed Remove assessment action. Disable Save until the draft differs from baseline and validates.

- [x] **Step 4: Extend outline and selection reconciliation**

Show an **Add knowledge check** or **Chapter knowledge check** row after each chapter's lessons and an **Add final assessment** or **Final assessment** row after all chapters. Update `useStudioSelection.reconcileSelection()` so removing an assessment returns selection to its chapter or course instead of leaving a dead inspector.

- [x] **Step 5: Connect workspace mutations**

Add `saveChapterQuickCheck`, `removeChapterQuickCheck`, `saveFinalAssessment`, and `removeFinalAssessment` commands using `persistence.run()`. Pass the selected quiz and callbacks through `StudioInspector` to `AssessmentInspector`.

- [x] **Step 6: Remove new inline Quiz creation and preserve existing rows**

Remove `{ type: 'quiz', label: 'Quiz' }` from `CourseOutline.BLOCKS`. In `LessonInspector`, short-circuit existing `lessonType === 'quiz'` to a read-only explanation that the legacy inline screen must be removed or replaced; do not serialize or overwrite its payload.

- [x] **Step 7: Verify assessment UI behavior**

Run targeted Prettier, typecheck, lint, and diff check. In an authenticated browser, add a chapter check, create two questions, mark one answer correct per question, preview correct and incorrect feedback, add a final assessment, reload and confirm persistence, remove both, and confirm the outline reconciles selection without console errors.

- [x] **Step 8: Commit assessment authoring**

```bash
git add apps/web/src/authoring
git commit -m "feat: add guided course assessments"
```

---

### Task 4: Complete Product Stage authoring parity

**Files:**

- Modify: `apps/web/src/authoring/inspectors/LessonInspector.tsx`
- Modify: `apps/web/src/authoring/inspectors/lesson/lesson-serializer.ts`

**Interfaces:**

- Consumes: existing `LessonDraft.media`, `LessonDraft.stageBackground`, and `uploadAsset(..., 'media')` support.
- Produces: independent **Product image** and **Stage background** fields whose payload keys match the player registry.

- [x] **Step 1: Add Product image to the Stage inspector**

Before Stage background, render:

```tsx
<AssetField
  accept="image/*"
  disabled={locked}
  label="Product image"
  onUpload={(file) => void uploadAsset(file, 'media')}
  value={draft.media}
/>
```

- [x] **Step 2: Make Stage serialization own `media`**

Inside the Stage branch, call `set('media', imagePayload(draft.media))` before `stageBackground`. Leave the initial `payload` copy and merge behavior intact.

- [x] **Step 3: Verify seeded and new stages**

Run targeted formatting, typecheck, lint, and diff check. Open moto g87's Stage and confirm both existing images load. Create a new Stage, upload two different images, save, reload, and confirm ProductStage renders both foreground and backdrop.

- [x] **Step 4: Commit Stage parity**

```bash
git add apps/web/src/authoring/inspectors/LessonInspector.tsx apps/web/src/authoring/inspectors/lesson/lesson-serializer.ts
git commit -m "feat: author product stage foreground media"
```

---

### Task 5: Add shared readiness validation and delivery gates

**Files:**

- Implement: `packages/contracts/src/course-readiness.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/database/src/course-review-repository.ts`
- Modify: `apps/web/src/authoring/server/course-commands.ts`
- Modify: `apps/web/src/app/api/course-studio/courses/[courseId]/revisions/route.ts`
- Modify: `apps/web/src/app/api/course-studio/revisions/[revisionId]/review/route.ts`
- Modify: `apps/web/src/app/api/course-studio/revisions/[revisionId]/scorm-export/route.ts`
- Modify: `apps/web/src/authoring/RevisionPanel.tsx`

**Interfaces:**

- Produces: `validateCourseReadiness(course: CourseGraph): CourseReadinessIssue[]` and `CourseNotReadyError` carrying stable issues.
- Consumes: concrete `Course.templateChecklist`, assessment schema, lesson payloads, and frozen `CourseRevision.snapshot`.
- Gates: live freeze and frozen-revision review/SCORM requests.

- [x] **Step 1: Implement general readiness rules**

Reject `lessonType === 'quiz'`; require `media` for canvas, drag/drop, and scroll story; require both `media` and `stageBackground` for Stage; require `videoFile` for video; require at least one complete color variant; validate drag/drop chip references, hotspot coordinates, and rich-text cue targets with the same rules used by the editor.

Add `assessmentInputFromQuiz(quiz)` to project the graph shape (`quiz.title`, `quiz.instructions`, and `quiz.payload`) into `CourseAssessmentInput`, then parse every attached quick check and final assessment through `CourseAssessmentInputSchema`. Convert failures to paths such as `Chapter 1 -> Knowledge check -> Question 2`.

- [x] **Step 2: Evaluate concrete template checklist requirements**

Resolve each requirement by concrete entity ID. `changed` compares the current field fingerprint against `initialFingerprint`; `media` requires a valid asset URL; `minimum` evaluates an array length; `assessment` parses the attached quiz. Unknown entity IDs are readiness failures rather than silently passing.

- [x] **Step 3: Gate live-course freezing inside the serializable transaction**

After `toCourseGraph(course)` and before source hashing, call the validator. Throw `CourseNotReadyError` without creating a revision. Keep the existing source-index gate.

- [x] **Step 4: Gate frozen review and SCORM requests**

Load and validate `CourseRevision.snapshot` in `createCourseReview()` and `requestScormExport()`. This prevents direct API calls from bypassing the new live freeze gate. Existing historical revisions that fail readiness remain readable; only new review-link replacement and export requests are blocked.

- [x] **Step 5: Return and render actionable issues**

Map `CourseNotReadyError` to HTTP 422 with `{ error, issues }`. Update `RevisionPanel` to render a compact issue list beneath the freeze/export message and clear it after a successful request.

- [x] **Step 6: Verify readiness gates**

Run targeted formatting, typecheck, lint, and diff check. Browser-check a legacy inline quiz, missing Stage image, invalid quick check, unchanged template field, and a ready course. Confirm only the ready course freezes and that direct review/export calls against an invalid captured snapshot return 422 without creating records/jobs.

- [x] **Step 7: Commit readiness**

```bash
git add packages/contracts/src apps/web/src/authoring/RevisionPanel.tsx apps/web/src/authoring/server/course-commands.ts apps/web/src/app/api/course-studio packages/database/src/course-review-repository.ts
git commit -m "feat: gate delivery on course readiness"
```

---

### Task 6: Implement the neutral comprehensive template backend

**Files:**

- Create: `apps/web/src/authoring/templates/comprehensive-course.ts`
- Create: `apps/web/src/authoring/templates/catalog.ts`
- Create: `packages/database/src/course-template-repository.ts`
- Modify: `packages/database/src/index.ts`
- Create: `apps/web/src/authoring/server/template-commands.ts`
- Create: `apps/web/src/app/api/course-studio/templates/[templateKey]/courses/route.ts`

**Interfaces:**

- Produces: `listCourseTemplateSummaries()`, `getCourseTemplate(key)`, and `createCourseFromTemplate(definition, title): Promise<CourseGraph>`.
- Consumes: Task 1 template/checklist schemas and Task 2 assessment payload conventions.
- Produces: a fresh course graph with concrete checklist entity IDs and no storage writes.

- [x] **Step 1: Define the exact comprehensive structure**

Create `comprehensive-course.v1` with this neutral flow:

```text
Chapter 1: Discover the product
  Content
  Interaction / hotspot
  Product Stage
  Chapter knowledge check
Chapter 2: Explain the experience
  Split screen
  Scroll story
  Canvas inspection
Chapter 3: Practice the recommendation
  Drag and drop
  Colour switcher
  Video
Final assessment
```

Use copy such as `Replace with the course headline` and `Describe the learner benefit`. Leave all media references absent. Add neutral specification and disclaimer rows. Include one valid placeholder single-answer question in each assessment but mark its copy and answer fields as `changed` requirements.

- [x] **Step 2: Validate and expose the catalog**

Parse definitions at module initialization. Expose only `{ key, version, title, description }` to the library. A schema failure throws a descriptive server configuration error containing the template key, not the invalid payload.

- [x] **Step 3: Instantiate a template transactionally**

Generate fresh course/chapter/lesson/quiz IDs before the transaction, translate definition-local keys to IDs, build the concrete checklist, and create the entire graph in one Prisma transaction. Set `createdFromTemplateKey`, `createdFromTemplateVersion`, and `templateChecklist`; do not create `CourseAsset`, `CourseSourceBinding`, or `CourseAssistantQa` rows.

- [x] **Step 4: Add authenticated creation API**

Accept `{ title: string }`, resolve the latest catalog entry for the route key, create the course, and return `{ course }` with status 201. Unknown keys return 404; invalid titles return 400; configuration failures return the normal safe 500 response.

- [x] **Step 5: Verify template purity and structure**

Run targeted formatting, typecheck, lint, and diff check. Create the template through the API, inspect the graph and database, and search its serialized course/Q&A/source/asset rows for `moto`, `g87`, `/api/course-assets/`, source IDs, citations, and storage keys. Expected: none. Confirm nine lesson types, one chapter check, one final assessment, and a concrete checklist.

- [x] **Step 6: Commit the template backend**

```bash
git add apps/web/src/authoring/templates apps/web/src/authoring/server/template-commands.ts apps/web/src/app/api/course-studio/templates packages/database/src/course-template-repository.ts packages/database/src/index.ts
git commit -m "feat: add neutral comprehensive course template"
```

---

### Task 7: Add Blank versus Comprehensive creation UI

**Files:**

- Create: `apps/web/src/authoring/CourseCreationPanel.tsx`
- Modify: `apps/web/src/app/studio/page.tsx`
- Modify: `apps/web/src/authoring/server/studio-loaders.ts`

**Interfaces:**

- Consumes: template summaries from Task 6 and `POST /api/course-studio/templates/[templateKey]/courses`.
- Produces: explicit Blank course and Comprehensive course cards; both redirect to the new authoring workspace.

- [x] **Step 1: Load template summaries server-side**

Add `templates: listCourseTemplateSummaries()` to `loadAuthoringLibrary()`. Pass only the parsed public summaries into the client creation panel.

- [x] **Step 2: Build the creation panel**

Keep the existing blank title form and server action. Add a Comprehensive card with its description and a title field. On submit, call the template API and `router.push('/studio/' + course.id)`. Disable both actions while one is submitting and display safe inline failures.

- [x] **Step 3: Replace the single Start a course form**

Render `CourseCreationPanel` from `/studio`, preserving the existing library heading, authentication, and course list below it.

- [x] **Step 4: Verify creation choices**

Run targeted formatting, typecheck, lint, and diff check. Browser-create one blank course and one comprehensive course. Confirm the blank course remains minimal, the comprehensive course opens with its full neutral outline, and neither action creates duplicate submissions during slow navigation.

- [x] **Step 5: Commit creation UI**

```bash
git add apps/web/src/authoring/CourseCreationPanel.tsx apps/web/src/app/studio/page.tsx apps/web/src/authoring/server/studio-loaders.ts
git commit -m "feat: add guided course creation choices"
```

---

### Task 8: Capture and enqueue exact course duplication

**Files:**

- Create: `packages/database/src/course-duplication-repository.ts`
- Modify: `packages/database/src/index.ts`
- Modify: `packages/jobs/src/queue.ts`
- Modify: `packages/jobs/src/index.ts`
- Modify: `packages/contracts/src/jobs.ts`
- Create: `apps/web/src/authoring/server/duplication-commands.ts`
- Create: `apps/web/src/app/api/course-studio/courses/[courseId]/duplicate/route.ts`

**Interfaces:**

- Produces: `captureCourseDuplicateArtifact(sourceCourseId, requestedTitle)`, `enqueueCourseDuplicateJob(input)`, and authenticated duplication POST returning `JobAcceptedResponse`.
- Consumes: current live graph, approved Course Assistant rows, owned/inherited source identities, and `collectAssetRefs()`.
- Produces: an immutable JSON job artifact and deterministic destination course ID.

- [x] **Step 1: Capture a consistent duplication snapshot**

In one repeatable-read transaction, load the current `CourseGraph`, approved Q&A including `sourceIds`, `sourceHashes`, and citations, and both owned and inherited source IDs. Reject any approved citation/source ID absent from the captured bindings. Collect unique asset URLs from the graph and approved Q&A.

- [x] **Step 2: Hash and validate the artifact**

Stable-stringify `{ graph, assistantQa, sourceIds, assetUrls, requestedTitle }`, compute SHA-256, construct the artifact, and parse it through `CourseDuplicateArtifactSchema` before returning it.

- [x] **Step 3: Add explicit queue mapping**

Map public `course_duplicate` to `BackgroundJobKind.COURSE_DUPLICATE` in both queue direction tables. Generate the job ID before insert, derive `destinationCourseId` from it, and enqueue the artifact bytes as `course-duplicate.json`.

```ts
export async function enqueueCourseDuplicateJob(input: {
  requestId: string;
  sourceCourseId: string;
  requestedTitle: string;
  artifact: CourseDuplicateArtifact;
}): Promise<JobAcceptedResponse>;
```

Accept a caller-generated UUID `requestId`. Extend the queue's private insert helper to accept an explicit job ID, set the duplication job ID to `requestId`, derive `destinationCourseId` from it, and use `course-duplicate:${requestId}` as the dedupe key. Two deliberate duplicate actions generate different request IDs, while a retried HTTP request with the same ID reuses its job.

- [x] **Step 4: Add the authenticated POST route**

Parse `{ requestId, title }`, capture the artifact, enqueue it, and return 202. Missing courses return 404; invalid grounding or asset references return 409 with safe actionable copy.

- [x] **Step 5: Verify queue capture without executing it**

Run targeted formatting, typecheck, lint, and diff check. Stop the worker, duplicate moto g87 once, and inspect the queued row/artifact: it must contain the live graph, assessments, approved Q&A, source IDs, asset URL list, and content hash, but no asset bytes or answer-key leakage in the HTTP response.

- [x] **Step 6: Commit duplication capture**

```bash
git add packages/database/src/course-duplication-repository.ts packages/database/src/index.ts packages/jobs packages/contracts/src/jobs.ts apps/web/src/authoring/server/duplication-commands.ts apps/web/src/app/api/course-studio/courses
git commit -m "feat: queue exact course duplication"
```

---

### Task 9: Execute idempotent media and course duplication

**Files:**

- Create: `packages/storage/src/course-asset-copy.ts`
- Modify: `packages/storage/src/asset-refs.ts`
- Modify: `packages/storage/src/index.ts`
- Modify: `packages/scorm-export/src/assets.ts`
- Implement: `packages/database/src/course-duplication-repository.ts`
- Modify: `apps/job-worker/src/handlers.ts`
- Modify: `apps/job-worker/src/index.ts`

**Interfaces:**

- Produces: `copyCourseAssetRefs(input): Promise<{ urlMap; assets; destinationKeys }>` and shared `rewriteAssetUrls(value, urlMap)`.
- Produces: `persistDuplicatedCourse(input): Promise<CourseDuplicateResult>` and `findCourseCreatedByJob(jobId)`.
- Consumes: Task 8 artifact and payload schemas, `getObject`/`putObject`/`deleteObject`, and the existing worker lease/retry contract.

- [x] **Step 1: Move generic nested URL rewriting into storage**

Move `rewriteAssetUrls` from `packages/scorm-export/src/assets.ts` to `packages/storage/src/asset-refs.ts`, export it from storage, and re-export it from SCORM assets to preserve existing imports. The function must recursively preserve arrays, objects, non-asset strings, and null values.

- [x] **Step 2: Implement deterministic asset copying**

For every sorted unique source URL, derive its source key with `r2KeyFor()`. Build a destination key from the destination course ID plus a SHA-256 of the source key and its safe filename. Read bytes and metadata, write with `putObject`, and return inventory rows with destination delivery URLs.

```ts
interface CopiedCourseAsset {
  r2Key: string;
  filename: string;
  contentType?: string;
  byteSize: number;
  deliveryUrl: string;
}
```

Malformed or missing objects throw a named non-retryable asset error with no local filesystem path in its message.

- [x] **Step 3: Implement transactional destination persistence**

First return an existing course found by `creationJobId`. Otherwise rewrite the captured graph and Q&A through the URL map, generate independent chapter/lesson/quiz/Q&A IDs, and create in one transaction:

- Course with `creationJobId` and `duplicatedFromCourseId`;
- chapters and lessons;
- chapter quick checks and final assessment;
- `CourseAsset` inventory rows;
- `CourseSourceBinding` rows; and
- approved `CourseAssistantQa` rows with captured source IDs/hashes and citations.

Use a slug ending in a stable destination-ID suffix rather than count-then-insert collision logic.

- [x] **Step 4: Register the worker handler**

Dispatch `BackgroundJobKind.COURSE_DUPLICATE` before AI-operation shape checks. Parse payload and artifact; report progress as `copying media`, `writing course`, and `completed`. If an existing destination is found, return it without copying again.

- [x] **Step 5: Implement retry cleanup**

On a retryable failure before the final attempt, retain deterministic destination objects for reuse. On a non-retryable or final failure with no committed destination course, delete the destination keys. If the database committed but job completion was interrupted, return the course found by `creationJobId` and do not clean its objects.

- [x] **Step 6: Fix worker progress labeling**

Update `apps/job-worker/src/index.ts` so document indexing, SCORM, duplication, and AI operations each receive truthful initial progress text instead of labeling every non-document job as AI generation.

- [x] **Step 7: Verify idempotent duplication directly**

Run targeted formatting, typecheck, lint, and diff check. Start the worker and process the queued moto g87 copy. Confirm:

- destination graph and assessment counts match;
- every destination asset key uses the destination course prefix and differs from moto g87;
- approved Q&A and citations match;
- source bindings reference the same immutable sources;
- source-course rows and bytes are unchanged; and
- invoking the handler recovery path for the same job resolves the same course ID and media keys.

- [x] **Step 8: Commit duplication execution**

```bash
git add packages/storage packages/scorm-export/src/assets.ts packages/database/src/course-duplication-repository.ts apps/job-worker/src
git commit -m "feat: execute independent course duplication"
```

---

### Task 10: Add duplication controls and durable status UI

**Files:**

- Create: `apps/web/src/authoring/CourseDuplicationStatusPanel.tsx`
- Modify: `apps/web/src/authoring/CourseLibrary.tsx`
- Modify: `apps/web/src/authoring/server/studio-loaders.ts`

**Interfaces:**

- Consumes: duplication POST route, existing `/api/jobs/[id]`, `CourseDuplicateResultSchema`, and library `router.refresh()` behavior.
- Produces: Duplicate course action, queued/running/failed status, and navigation to the completed copy.

- [x] **Step 1: Load recent duplication jobs for recovery**

Extend the library loader with the most recent 20 `COURSE_DUPLICATE` jobs, returning only client-safe job ID, status, progress, result, error message, source course ID, requested title, and timestamps. Do not expose artifact bytes or answer keys.

- [x] **Step 2: Add Duplicate course to each card**

Prompt for a default `<course title> copy`, generate one UUID for that user action, POST `{ requestId, title }`, and reuse the same request ID if that HTTP submission is retried. Add the returned queued job to local state. Disable repeat submission only while the request is being sent; after completion, a deliberate second duplicate generates a new request ID and remains allowed.

- [x] **Step 3: Poll and render durable status**

`CourseDuplicationStatusPanel` polls queued/running jobs every two seconds using the existing job API. On success, parse `CourseDuplicateResultSchema`, refresh the library, and navigate to `/studio/<courseId>`. On failure, show `errorMessage` and retain the source course untouched.

- [x] **Step 4: Verify refresh and failure recovery**

Run targeted formatting, typecheck, lint, and diff check. Browser-check queued state with worker stopped, successful navigation after worker starts, page refresh during running state, an induced missing-asset failure, and a second deliberate duplication. Confirm no console errors or duplicate destination from one job.

- [x] **Step 5: Commit duplication UI**

```bash
git add apps/web/src/authoring/CourseDuplicationStatusPanel.tsx apps/web/src/authoring/CourseLibrary.tsx apps/web/src/authoring/server/studio-loaders.ts
git commit -m "feat: add course duplication workflow"
```

---

### Task 11: Document and accept the complete authoring workflow

**Files:**

- Modify: `README.md`
- Modify: `GUIDE.md`
- Modify: only implementation files from Tasks 1-10 when verification finds an in-scope defect

**Interfaces:**

- Consumes: completed assessment, readiness, template, Stage, duplication, review, and SCORM flows.
- Produces: current user/operator documentation and observed release evidence.

- [x] **Step 1: Update root architecture and operations documentation**

Document Blank versus Comprehensive creation, template placeholder semantics, structural assessments, removal of inline Quiz creation, duplication worker behavior, media independence, inherited sources, readiness gates, new job kind, and deployment order migration → worker → web.

- [x] **Step 2: Update the practical guide in place**

Read the current untracked or tracked `GUIDE.md` before editing. Add exact author steps for choosing a template, resolving placeholders, adding chapter/final assessments, setting both Stage images, duplicating a course, and understanding what duplication excludes. Preserve its existing SCORM and local-startup guidance.

- [x] **Step 3: Run fresh repository checks**

```bash
npm run db:generate
npm run db:migrate
npm run typecheck
npm run lint
npm run build
npm run build --workspace=@moto-ai/scorm-export
npx prettier --check README.md GUIDE.md docs/superpowers/specs/2026-08-22-course-studio-authoring-parity-templates-design.md docs/superpowers/plans/2026-08-22-course-studio-authoring-parity-templates.md
git diff --check
```

Record every exit status. Do not claim a check passed without observing its output.

- [x] **Step 4: Run authenticated browser acceptance**

With PostgreSQL, worker, and web app running, verify all fifteen acceptance scenarios in the design specification. The parser may remain stopped while testing template creation and duplication; confirm no parser/OpenAI request occurs. Exercise review and SCORM only after readiness passes.

- [x] **Step 5: Inspect database and storage invariants**

Use read-only Prisma queries and storage listings to compare source and destination course counts, quiz attachment IDs, asset prefixes, source bindings, approved Q&A, and excluded related records. Confirm no template-created row contains moto g87 data and no duplicated media URL points to the source course prefix.

- [x] **Step 6: Review final scope and commit documentation**

Inspect `git status --short`, `git diff --name-only`, and each diff. Stage only the approved implementation, README, GUIDE, design, and plan files. Do not stage environment files or unrelated work.

```bash
git add README.md GUIDE.md docs/superpowers/specs/2026-08-22-course-studio-authoring-parity-templates-design.md docs/superpowers/plans/2026-08-22-course-studio-authoring-parity-templates.md
git commit -m "docs: guide complete course authoring workflows"
```

If implementation fixes remain uncommitted, commit them separately before the documentation commit using the task-specific message from the owning task.

## Final handoff checklist

- [x] Every task commit contains only its owned files.
- [x] Database migration, compatible worker, and web release order is recorded.
- [x] moto g87 remains a demo and is not referenced by template creation.
- [x] Comprehensive template contains no product-specific assets or grounding.
- [x] Assessment answer keys remain absent from learner and review payloads.
- [x] Duplicate media and graph edits cannot affect the source course.
- [x] Duplicate sources and citations remain grounded without parser/OpenAI work.
- [x] No revisions, reviews, learner data, jobs, generations, or exports were copied.
- [x] Static, migration, build, database, browser, review, and SCORM evidence is captured.
- [x] No automated test files were added.
