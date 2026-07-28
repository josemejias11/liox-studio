# Course Studio Screen Trash Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace permanent Course Studio screen deletion with indefinite PostgreSQL Trash, immediate Undo, restore, permanent deletion, and Empty Trash.

**Architecture:** A dedicated `CourseLessonTrash` table stores a complete deleted-screen snapshot without complicating active course queries. Atomic database operations move screens between `CourseLesson` and Trash, authenticated Studio routes expose those operations, and the Studio workspace owns the current course graph plus trash state so every mutation updates the outline and recovery UI together.

**Tech Stack:** Prisma ORM 5.22, PostgreSQL, Next.js 16 App Router, React 19, TypeScript 6, existing Course Studio fetch client and three-pane UI.

## Global Constraints

- Trash records remain indefinitely until an author permanently removes them.
- This scope covers screens only; chapter recovery is not included.
- Frozen revisions, reviews, learner delivery, and stable lesson IDs remain unchanged.
- Public learner and review routes must not expose Trash.
- Do not add or run automated tests or create testing files.
- Verify with Prisma generation/migration, typecheck, lint, diff validation, direct database inspection, and browser QA.
- Preserve all unrelated user changes in the dirty `stg` worktree.

---

### Task 1: Add the durable screen-trash data boundary

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/20260728190000_add_course_lesson_trash/migration.sql`
- Create: `packages/database/src/course-trash-repository.ts`
- Modify: `packages/database/src/course-repository.ts`
- Modify: `packages/database/src/index.ts`

**Interfaces:**
- Produces:

```ts
export interface CourseTrashItem {
  id: string;
  lessonId: string;
  chapterId: string;
  chapterTitle: string;
  position: number;
  lessonType: string;
  headline: string;
  deletedAt: Date;
}

export interface TrashLessonResult {
  course: CourseGraph;
  trashItem: CourseTrashItem;
  trash: CourseTrashItem[];
}

export interface RestoreTrashItemResult {
  course: CourseGraph;
  restoredLessonId: string;
  trash: CourseTrashItem[];
}

export function listCourseTrash(courseId: string): Promise<CourseTrashItem[]>;
export function trashLesson(lessonId: string): Promise<TrashLessonResult>;
export function restoreCourseTrashItem(courseId: string, trashId: string): Promise<RestoreTrashItemResult>;
export function permanentlyDeleteCourseTrashItem(courseId: string, trashId: string): Promise<CourseTrashItem[]>;
export function emptyCourseTrash(courseId: string): Promise<void>;
```

- Consumes: existing `CourseGraph`, `getAuthoringCourse()`, shared Prisma client, and course/chapter/lesson identities.

- [ ] **Step 1: Add the Prisma model and course relation**

Add this model and `trashItems CourseLessonTrash[]` to `Course`:

```prisma
model CourseLessonTrash {
  id           String   @id @default(cuid())
  courseId     String
  lessonId     String
  chapterId    String
  chapterTitle String
  position     Int
  lessonType   String
  headline     String
  body         Json?
  payload      Json
  deletedAt    DateTime @default(now())
  course       Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)

  @@index([courseId, deletedAt])
  @@index([courseId, lessonId])
}
```

- [ ] **Step 2: Add the matching SQL migration**

Create the PostgreSQL table with `JSONB` body/payload columns, primary key,
course/deletion and course/lesson indexes, and an `ON DELETE CASCADE` foreign
key to `Course`.

- [ ] **Step 3: Implement atomic move-to-Trash**

In `course-trash-repository.ts`, query the active lesson with its chapter and
course. In one `prisma.$transaction()`:

1. Reject deletion when the chapter has one active lesson with `FINAL_LESSON`.
2. Create the Trash snapshot from the complete lesson and chapter.
3. Delete the active lesson.
4. Compact remaining sibling positions in ascending order.

After the transaction, return the refreshed graph, created trash summary, and
the course trash list ordered by `deletedAt DESC`.

- [ ] **Step 4: Implement restore and permanent-removal operations**

Restore in one transaction:

1. Load the trash item with `courseId` scope.
2. Fail with `TRASH_ITEM_NOT_FOUND` when missing.
3. Fail with `ORIGINAL_CHAPTER_NOT_FOUND` when its chapter is gone.
4. Fail with `LESSON_ID_CONFLICT` when `lessonId` is already active.
5. Shift siblings at or after `min(originalPosition, siblingCount)` upward in
   descending position order.
6. Recreate the original lesson ID, type, headline, body, and payload.
7. Delete the trash record.

Permanent deletion and Empty Trash delete only course-scoped trash records.

- [ ] **Step 5: Replace the hard-delete export**

Remove `deleteLesson()` from the active course repository and public exports.
Export the Trash interfaces and operations from `packages/database/src/index.ts`.
No caller may retain a path that directly hard-deletes a screen.

- [ ] **Step 6: Generate and validate the Prisma client**

Run:

```bash
npm run db:generate
npm run typecheck
git diff --check
```

Expected: all commands exit `0`; the generated Prisma client exposes
`courseLessonTrash`.

---

### Task 2: Add authenticated Trash application routes

**Files:**
- Modify: `apps/web/src/app/api/course-studio/courses/[courseId]/lessons/route.ts`
- Create: `apps/web/src/app/api/course-studio/courses/[courseId]/trash/route.ts`
- Create: `apps/web/src/app/api/course-studio/courses/[courseId]/trash/[trashId]/route.ts`
- Modify: `apps/web/src/course-studio/studio-client.ts`

**Interfaces:**
- Consumes: Task 1 database operations and existing Course Studio authorization helpers.
- Produces:

```ts
export interface StudioTrashItem {
  id: string;
  lessonId: string;
  chapterId: string;
  chapterTitle: string;
  position: number;
  lessonType: string;
  headline: string;
  deletedAt: string;
}

export interface StudioTrashMutation {
  course: CourseGraph;
  trash: StudioTrashItem[];
  trashItem?: StudioTrashItem;
  restoredLessonId?: string;
}
```

- [ ] **Step 1: Make lesson deletion recoverable**

Keep `DELETE /api/course-studio/courses/[courseId]/lessons` with
`action: "delete" | "duplicate"`. Duplicate returns `{ course }`. Delete calls
`trashLesson()` and returns:

```json
{
  "course": {},
  "trashItem": {},
  "trash": []
}
```

Map `FINAL_LESSON` to `409` as before.

- [ ] **Step 2: Add the course Trash collection route**

`GET /api/course-studio/courses/[courseId]/trash` returns serialized trash
items. `DELETE` empties the course Trash and returns `{ trash: [] }`. Require
Course Studio authorization for both methods.

- [ ] **Step 3: Add the individual Trash route**

`POST /api/course-studio/courses/[courseId]/trash/[trashId]` restores and
returns `{ course, restoredLessonId, trash }`.

`DELETE` permanently removes the item and returns `{ trash }`.

Map errors:

- `TRASH_ITEM_NOT_FOUND` → `404`;
- `ORIGINAL_CHAPTER_NOT_FOUND` → `409`;
- `LESSON_ID_CONFLICT` → `409`;
- unexpected errors → the existing sanitized `500` response.

- [ ] **Step 4: Add typed Studio client methods**

Keep generic course mutations unchanged. Add:

```ts
trashLesson(courseId: string, lessonId: string): Promise<StudioTrashMutation>;
restoreTrashItem(courseId: string, trashId: string): Promise<StudioTrashMutation>;
permanentlyDeleteTrashItem(courseId: string, trashId: string): Promise<StudioTrashItem[]>;
emptyTrash(courseId: string): Promise<void>;
```

Do not expose trash methods from learner or review clients.

- [ ] **Step 5: Verify route contracts statically**

Run:

```bash
npm run typecheck
npm run lint
git diff --check
```

Expected: all commands exit `0`.

---

### Task 3: Add Undo and the persistent Trash panel

**Files:**
- Modify: `apps/web/src/app/studio/[courseId]/page.tsx`
- Modify: `apps/web/src/course-studio/CourseStudioWorkspace.tsx`
- Modify: `apps/web/src/course-studio/CourseOutline.tsx`
- Modify: `apps/web/src/course-studio/StudioToolbar.tsx`
- Modify: `apps/web/src/course-studio/studio-types.ts`
- Create: `apps/web/src/course-studio/TrashPanel.tsx`

**Interfaces:**
- Consumes: `StudioTrashItem`, `StudioTrashMutation`, and Task 2 client methods.
- Produces:

```ts
interface TrashPanelProps {
  disabled: boolean;
  items: StudioTrashItem[];
  onRestore: (trashId: string) => Promise<void>;
  onPermanentDelete: (trashId: string) => Promise<void>;
  onEmpty: () => Promise<void>;
}
```

- [ ] **Step 1: Server-render the initial Trash list**

Load `listCourseTrash(courseId)` beside course, revisions, and feedback in the
Studio page. Serialize `deletedAt` to ISO strings and pass `initialTrash` to the
workspace.

- [ ] **Step 2: Own Trash and Undo state in the workspace**

Add:

```ts
const [trash, setTrash] = useState(initialTrash);
const [undoTrashId, setUndoTrashId] = useState<string | null>(null);
```

On lesson deletion:

1. Confirm with “Move this screen to Trash? You can restore it later.”
2. Call `studioClient.trashLesson()`.
3. Replace course and trash state from the response.
4. Reset a deleted selection to course settings.
5. Set the toolbar message to “Screen moved to Trash.”
6. Store the returned trash item ID for Undo.

Undo calls restore, replaces course/trash state, selects
`restoredLessonId`, and clears the Undo action.

- [ ] **Step 3: Extend the toolbar with immediate Undo**

Add optional props:

```ts
undoLabel?: string;
onUndo?: () => void;
undoDisabled?: boolean;
```

Render a small “Undo” button beside status only while `onUndo` exists. Clear
the action after another successful structural mutation or after Undo.

- [ ] **Step 4: Build the persistent Trash panel**

Place a collapsible Trash section at the bottom of `CourseOutline`, below the
active outline scroll area. Show the count even when collapsed. Each item shows
headline, block type, original chapter, and localized deletion time.

Each item provides:

- Restore;
- Permanently delete, guarded by `window.confirm()`.

“Empty Trash” appears only when items exist and requires:

```ts
window.confirm('Permanently delete every screen in Trash? This cannot be undone.')
```

- [ ] **Step 5: Keep UI mutations coherent**

While any Trash mutation runs, disable outline editing, restore, permanent
delete, Empty Trash, and Undo. On failure, keep current course/trash state and
show the server error in the toolbar status.

- [ ] **Step 6: Run static verification**

Run:

```bash
npm run typecheck
npm run lint
git diff --check
```

Expected: all commands exit `0`.

---

### Task 4: Apply the migration, document behavior, and verify the complete flow

**Files:**
- Modify: `README.md`
- Modify: `DEPLOYMENT.md`

**Interfaces:**
- Consumes: complete Tasks 1–3 behavior.
- Produces: migrated local database and browser evidence for the recovery flow.

- [ ] **Step 1: Apply the local migration**

Run:

```bash
npm run db:migrate
```

Expected: migration `20260728190000_add_course_lesson_trash` applies
successfully.

- [ ] **Step 2: Update operator and author documentation**

Document:

- deletions move screens to indefinite Trash;
- immediate Undo and persistent restore;
- permanent delete and Empty Trash are the only destructive screen operations;
- the new Prisma migration is required before starting the updated app.

- [ ] **Step 3: Verify deletion and immediate Undo in the browser**

At `/studio/course-atlas-product-experience-lab`:

1. Create a temporary Content screen.
2. Give it recognizable copy and save.
3. Delete it and confirm it leaves the outline and appears in Trash.
4. Click Undo.
5. Confirm its same lesson ID, copy, type, and position return.

Delete the temporary screen again and leave it in Trash for the reload check.

- [ ] **Step 4: Verify persistence and ordering**

Reload the Studio and confirm the trash item remains. Restore it from the Trash
panel and confirm:

- it returns to its original chapter and position;
- its body and payload render in the inspector;
- selecting it updates the Moto Player preview;
- no learner progress, quiz-grade, analytics, or AI request is generated by
  selection.

- [ ] **Step 5: Verify permanent deletion and Empty Trash**

Using temporary screens only:

1. Permanently delete one trash item and reload to confirm it remains absent.
2. Put two temporary screens in Trash.
3. Cancel Empty Trash once and confirm both remain.
4. Confirm Empty Trash and reload to confirm both are gone.
5. Confirm active course screens were not changed.

- [ ] **Step 6: Verify failure safety**

Create a temporary chapter with two screens. Move one screen to Trash, then
delete the temporary chapter containing the other active screen. Attempt
restore and confirm the UI reports that the original chapter no longer exists
while the Trash item remains recoverable. Permanently delete the temporary
trash item afterward.

- [ ] **Step 7: Run final project-native checks**

Run:

```bash
npm run db:generate
npm run typecheck
npm run lint
git diff --check
npm run build
```

Expected: every command exits `0`. If build is blocked by PostgreSQL or another
local service, record the exact command output and remaining risk rather than
claiming success.

- [ ] **Step 8: Inspect final browser evidence**

Confirm:

- no Next.js error overlay;
- no console errors introduced by Trash;
- no failed Trash API requests;
- `/course/moto-things-atlas-product-experience-lab` still renders;
- a public review route cannot access any `/api/course-studio/**/trash` endpoint
  without the Studio credential.
