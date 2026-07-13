# Canvas Lessons: Product Direction and First Release

## Purpose

Moto Tutor AI will distinguish two course experiences:

- **Standard** courses use the existing structured, screen-based lesson flow.
- **Canvas** courses add spatial educational lessons that authors compose visually and learners explore interactively.

“Interactive” is not used as the product label because it describes a broad quality rather than the authoring and learner experience. Canvas is the shared concept for both audiences.

## Product Model

A Canvas lesson has one content model rendered in two contexts:

1. **Authoring canvas:** an instructional designer composes the experience in Sanity.
2. **Learner canvas:** a learner explores the resulting educational space in the course player.

Canvas lessons support learner choice while retaining instructional intent. Authors mark learning targets as required; learners may discover targets in any order, but lesson completion requires all required targets.

## First Release Scope

The first Canvas lesson is a hybrid product-inspection experience.

- One primary product image fills the lesson workspace.
- Learners can pan and zoom the image.
- Authors position feature hotspots over the image.
- Opening a hotspot reveals explanatory educational content.
- Each hotspot may be optional or required.
- The player displays required-target progress, such as `2 of 4 features explored`.
- Completion occurs when all required targets have been explored.

This release does not implement a freeform multi-image canvas, arbitrary node graphs, or all interaction types at once.

## Authoring Experience

In Sanity, the Canvas lesson editor provides:

1. A primary-image upload and 16:9 preview workspace.
2. Visual placement for product-feature hotspots.
3. Per-hotspot fields for title, instructional body, optional media, and required status.
4. A compact progress summary of required versus optional targets.

The authoring interface must use the same normalized coordinates consumed by the player, so published placement matches the Studio preview.

## Learner Experience

The Canvas lesson player provides:

1. Free pan and zoom of the product image.
2. Visible, accessible feature targets.
3. A focused explanation panel when a target is selected.
4. Progress feedback without prescribing a fixed exploration order.
5. A clear completion state after required targets are explored.

The existing course route, navigation, progress persistence, and player shell remain shared. Canvas adds a new lesson renderer and completion rule rather than a separate course player.

## Relationship to Existing Lesson Types

Existing standard lesson types remain intact. Canvas is a new lesson type and the long-term composition layer for richer interactions.

For this first release, Canvas supports product-image inspection only. Future Canvas object capabilities can incorporate video, quizzes, drag-and-drop, color switching, scroll stories, and content cards. Those capabilities should become objects within Canvas lessons rather than course-level eligibility flags.

## Course-Level Rules

The course mode vocabulary changes from `standard` / `interactive` to `standard` / `canvas`.

- A Standard course contains the existing structured lesson flow.
- A Canvas course may include ordinary structured lessons alongside Canvas lessons.
- Course mode describes the authored learning experience; it does not enforce the former list of “advanced lesson” permissions.

The current validation that rejects `dragDrop`, `colorSwitcher`, and `scrollStory` for Standard courses must be removed or replaced as part of the Canvas implementation. Existing content must remain renderable during the transition.

## Data and Completion Model

The Canvas lesson data needs a primary image and target array. Each target needs a stable ID, normalized x/y coordinates, instructional content, and `required` status. Learner progress must persist target visits through the existing lesson-progress mechanism or a narrowly-scoped extension of it.

The player computes Canvas completion from the set of required target IDs. Optional target visits enrich the experience but do not block navigation.

## Acceptance Criteria

1. Authors can create a Canvas lesson with one product image and feature targets in Sanity.
2. Learners can pan and zoom the image, open targets, and read the associated content.
3. Required-target progress is visible and Canvas completion occurs only after all required targets are visited.
4. Existing Standard courses and lesson renderers continue to work.
5. Canvas courses render through the existing route and player without a second player implementation.
6. Course-mode terminology is `standard` / `canvas`; old advanced-lesson gating is absent.

## Deferred Work

- Multiple independent images or arbitrary object placement.
- Connector/graph authoring.
- Embedded video, quiz, drag/drop, color-switcher, and scroll-story Canvas objects.
- Collaborative authoring, templates, and analytics beyond existing lesson progress.
