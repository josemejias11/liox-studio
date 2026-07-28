# Course Studio Screen Trash Design

## Purpose

Course Studio authors must be able to recover accidentally deleted screens. A
screen deletion must remove the screen from the active course immediately
without destroying its authored content. Deleted screens remain recoverable
indefinitely until an author explicitly removes them from Trash.

This feature covers course screens only. Chapter recovery is outside this
scope.

## Authoring Experience

Deleting a screen keeps the existing confirmation boundary but changes the
language from permanent removal to moving the screen to Trash. After a
successful deletion, Course Studio shows an immediate Undo action.

Course Studio exposes a Trash panel for the current course. Each item shows the
screen headline, block type, original chapter, original position, and deletion
time. Authors can:

- restore one screen;
- permanently delete one screen; or
- empty the course Trash after an explicit confirmation.

Trash items do not expire automatically.

## Persistence

PostgreSQL owns a dedicated screen-trash record containing:

- a durable trash-item ID;
- the course ID;
- the deleted screen's original ID;
- the original chapter ID and chapter title;
- the original position;
- the screen type, headline, body, and complete payload snapshot;
- the deletion timestamp.

The active `CourseLesson` row is removed in the same database transaction that
creates the trash record and compacts the remaining lesson positions. This
keeps active course queries unchanged and prevents a successful deletion from
losing recovery data.

Restoring a screen recreates its original durable lesson ID and inserts it at
its original position. Existing siblings at or after that position move down.
If the original chapter no longer exists, restoration fails without changing
the trash item. If the original lesson ID is already active, restoration also
fails and preserves the trash item.

Permanent deletion removes only the selected trash record. Empty Trash removes
all trash records belonging to the selected course. Neither action affects
active lessons.

## Application Boundaries

The database package exposes focused operations for:

- listing a course's deleted screens;
- moving a lesson to Trash;
- restoring one trash item;
- permanently deleting one trash item; and
- emptying a course's Trash.

Authenticated Course Studio API routes expose those operations. Public learner
and review routes cannot read or mutate Trash.

The existing lesson-delete request continues to be the authoring entry point,
but its database behavior becomes recoverable. The mutation response includes
the updated course graph and the created trash item so the client can offer
immediate Undo without another lookup.

## UI State and Feedback

Course Studio keeps the current course graph and trash list in local state.
Deletion updates both from the server response. Undo calls the restore endpoint
for the newly created trash item and replaces the graph and trash state with
the server result.

The Trash panel remains available after reload. Restore, permanent deletion,
and Empty Trash disable conflicting authoring mutations while in flight and
surface server errors in the existing Studio status area.

Restoring the currently selected deleted screen selects the restored lesson.
If a deleted screen was selected, deletion returns selection to the course
settings.

## Safety and Error Handling

- A chapter must still retain at least one active screen.
- Deletion and trash creation are atomic.
- Restoration and trash removal are atomic.
- Empty Trash requires a confirmation that recovery will no longer be
  possible.
- A missing original chapter or conflicting lesson ID never destroys the trash
  snapshot.
- Trash is scoped by course in every database and API operation.
- Frozen revisions and client reviews remain immutable and are not affected.

## Verification

No automated test files will be added, following the repository's current
project constraint. Verification will use:

- Prisma schema generation and migration;
- TypeScript type checking;
- linting and diff validation;
- browser QA for delete, immediate Undo, reload persistence, restore ordering,
  permanent deletion, Empty Trash confirmation, and learner preview behavior;
- direct inspection that public learner and review routes expose no trash data.

## Acceptance Criteria

- Deleting a screen never permanently destroys it.
- Immediate Undo restores the complete screen and its original position.
- A deleted screen remains in Trash across reloads and service restarts.
- Restore preserves the original lesson ID, body, media, interactions, and
  block configuration.
- Trash items remain indefinitely.
- Permanent deletion and Empty Trash require deliberate author actions.
- Learner delivery, frozen revisions, and reviews behave exactly as before.
