# Course Studio Library Thumbnails

## Goal

Show a useful thumbnail for every available course in the Course Studio library.

## Existing contract

Course authoring already stores the library image as `course.cover.thumbnail` in
the course `cover` JSON payload. The Course Inspector exposes this field as
“Library thumbnail”. No schema or upload changes are needed.

## Design

`listAuthoringCourses` will return the existing `cover` value in addition to the
course identity and text fields. The Studio library page will derive the image
source from the existing cover payload in this order:

1. `cover.thumbnail.asset.url`
2. `cover.coverImage.asset.url`
3. a styled, image-free placeholder

The course card will render the selected image in a fixed aspect-ratio media
area above the title and description. The image will use the existing internal
asset delivery URL and Next Image conventions. Missing or malformed cover data
must not prevent the course card from rendering.

## Boundaries

- Do not add a new database column or asset endpoint.
- Do not change learner course rendering or published-course contracts.
- Do not create automated test files; verify with typecheck, lint, build, diff
  checks, and browser evidence where available.
- Preserve the current library links, title, description, and empty state.

## Acceptance criteria

- A course with a library thumbnail displays that image in `/studio`.
- A course without a thumbnail falls back to its cover image when available.
- A course without either image displays a stable placeholder and remains
  clickable.
- The library route continues to require Studio authentication.
- Existing Course Studio authoring and asset delivery behavior remains intact.
