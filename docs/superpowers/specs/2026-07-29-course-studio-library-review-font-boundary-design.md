# Course Studio library review flow and product font boundary

## Status

Approved design for implementation planning.

## Context

Course Studio currently edits a course in the workspace and renders the Client review panel below the editor tools. The library lists courses but does not provide a review-preparation workflow. The application also currently applies MotoSans globally, which makes authoring, analytics, and other internal application surfaces look like the learner product.

Course Studio remains the authoring surface for complete learning masters. The learner-facing `moto tutor` experience is the product surface; Studio, the library, analytics, and review controls are application surfaces around that product.

## Goals

1. Let an author select a course from the library and prepare that course for client review without first opening the editor.
2. Keep editing and review preparation as distinct actions in the library.
3. Move the course-settings save/status footer into the editor's left outline while keeping the course-settings fields in the bottom tools area.
4. Apply MotoSans only to the learner-facing product experience and its embedded product preview. Use the existing Geist font for the application shell and internal tools.
5. Reuse the existing revision, review-link, and feedback APIs and preserve the immutable revision behavior.

## Non-goals

- No new review or revision data model.
- No replacement of the existing review-link or feedback endpoints.
- No changes to learner progress, course contracts, lesson IDs, or player routing.
- No redesign of the Course Studio canvas or lesson inspectors beyond relocating the save/status footer.
- No requirement for client review to become a full authoring workflow.

## User experience

### Library

Each course card keeps an explicit editing action and gains a secondary `Prepare for review` action. Selecting that action highlights the course and opens an inline review panel associated with the selected card. The selected course remains identifiable by title and thumbnail.

The review panel provides the existing workflow:

- load frozen revisions and feedback for the selected course;
- freeze the current course with optional revision notes;
- create or replace a shareable review link for a frozen revision;
- copy the generated link;
- review and resolve feedback.

Selecting a different course replaces the panel contents and loads that course's review state. No course is frozen merely by selecting it. On narrow screens, the panel appears below the course cards; on larger screens it may occupy a dedicated panel area without obscuring the course list. Opening the editor remains a separate action and navigates to `/studio/[courseId]`.

The library should communicate review readiness through the selected panel and its existing revision state. It should not introduce a second status vocabulary that can diverge from revision and feedback records.

### Editor save placement

The course-settings fields remain in the bottom tools area. The save/status footer moves to the bottom of the left outline when the course selection is active. It contains the current save status and the `Save course settings` action.

The save action remains the same form submission owned by `CourseInspector`; the left-panel control is associated with that form through a stable form identifier or an equivalent explicit callback. Dirty, valid, locked, saving, and error state must be supplied by the inspector to the outline so the button has the same enablement and messaging behavior as today.

Existing unsaved-change protection remains authoritative. Switching selection, leaving the editor, changing focus-preview mode, or performing a structural action continues to request confirmation when course settings are dirty.

## Component and data design

### Library review composition

Introduce a client-side library composition component responsible for selected-course state and review-panel visibility. The server library page continues to authenticate and load the course cards. The client component receives the card-safe course data and keeps the selected course ID in local state.

Adapt the existing revision panel so it can load review data for a selected course when mounted or when its course ID changes. The panel continues to use:

- `GET /api/course-studio/courses/[courseId]/revisions`;
- `GET /api/course-studio/courses/[courseId]/feedback`;
- `POST /api/course-studio/courses/[courseId]/revisions`;
- `POST /api/course-studio/revisions/[revisionId]/review`;
- the existing feedback `PATCH` endpoint.

The initial Studio editor continues to receive its server-loaded revision and feedback data. The library may fetch review data after selection, with a visible loading or unavailable state and no optimistic claim that a freeze or link was created.

### Save-state handoff

Extend the existing inspector-to-workspace state handoff with enough information for the outline save footer to render accurately. Keep mutation ownership in `CourseStudioWorkspace` and `CourseInspector`; `CourseOutline` only renders the action and invokes the supplied submit behavior. The form must remain keyboard-accessible and must not allow a disabled or invalid submission.

### Font boundary

Keep the MotoSans font-face definitions available, but change the global application font token to the Geist variable already loaded by the root layout. Define a product-surface font token or scoped class using MotoSans.

Apply the product font scope to:

- the learner-facing `MotoViewer` route under `/course/[slug]`;
- the product preview content rendered by `AuthoringPreview` inside Studio and client review.

Keep Geist on:

- the global application shell;
- Course Studio navigation, library cards, inspectors, and revision controls;
- analytics;
- the client-review page shell and feedback controls.

The scoped product font must inherit through lesson content without requiring every lesson type to be individually rewritten. Existing monospace and explicit typography utilities remain available for technical or code content.

## Error and loading behavior

- Selecting a course shows a loading state while its revisions and feedback are fetched.
- Failed review-data loads show an actionable inline error and leave the course card and editor link usable.
- Freeze, share, copy, and feedback actions preserve the current busy/disabled behavior and report API errors in the panel.
- Switching selected courses clears course-specific review messages, links, and feedback from the previous selection.
- If the selected course is deleted or becomes unavailable, the library clears the selection and returns to the card-only state.
- Font loading remains non-blocking; fallback rendering must remain readable while MotoSans loads.

## Verification

Use project-native checks without creating or running automated test files:

- inspect the diff and changed-file scope;
- run `npm run typecheck`;
- run `npm run lint`;
- run `npm run build` if the local database/migration prerequisite is available;
- use Chrome DevTools or Playwright against a running app to verify library selection, review loading, freeze/share controls, editor save placement, responsive layout, and the product/application font boundary;
- record any database, authentication, or browser-flow verification that remains blocked.

