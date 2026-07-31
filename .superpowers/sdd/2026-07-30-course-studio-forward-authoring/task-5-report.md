# Task 5 Report: Authoring-only routes and master review

## Outcome

- `/` now redirects directly to `/studio` and performs no course query or catalog rendering.
- The public `/course/[slug]` player page was removed. The authoring library remains protected by Studio authentication, while the tokenized `/review/[token]` route continues to render the saved revision snapshot.
- Studio library and revision controls now describe authoring, author preview, frozen master revisions, and review links. The review-feedback endpoint uses matching frozen-master wording without changing its token-based authorization or feedback persistence behavior.

## Files changed

- `apps/web/src/app/page.tsx`
- `apps/web/src/app/course/[slug]/page.tsx` (deleted)
- `apps/web/src/app/studio/page.tsx`
- `apps/web/src/course-studio/CourseLibrary.tsx`
- `apps/web/src/course-studio/RevisionPanel.tsx`
- `apps/web/src/app/api/reviews/[token]/feedback/route.ts`

## Verification

- `git diff --check` exited 0.
- Route/static scan found no remaining `listPublishedCourseSummaries`, `getPublishedCourseBySlug`, or `/course/[slug]` usage in `apps/web/src` or `packages`.
- `npm run typecheck` exited 0 across all workspaces.
- `npm run lint` exited 0 with one pre-existing warning in `packages/database/src/course-repository.ts` for unused `CourseGraphChapter`; it reported no lint errors.
- No automated tests were added or run, per the forward-authoring plan.

## Remaining verification

- Authenticated browser verification was not run in this task: it still needs live confirmation that `/` redirects through Studio login as appropriate, the embedded `AuthoringPreview` renders from the library editor, and a review token exposes only its frozen snapshot and feedback endpoint.
- `apps/web/src/app/course/[slug]/layout.tsx` remains as an inert layout after the page deletion because Task 5 explicitly listed only the page for deletion. It no longer creates a player route or imports public-catalog data.
