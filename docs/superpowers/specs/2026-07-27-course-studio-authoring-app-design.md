# Course Studio Authoring App Design

## Product decision

Course Studio is Lionbridge's internal web authoring application for producing Motorola e-learning masters. It replaces the Lionbridge Articulate 360 authoring workflow; it does not replace Motorola Insiders or HaLight, and it does not build an agency portal.

Lionbridge authors the complete e-learning master in Course Studio: course structure, on-screen copy, fixed media, interaction configuration, quizzes, navigation order, and learner preview. The authored master is then frozen as a versioned Course Studio master release for Lionbridge to deliver to Motorola. The external file/package format is intentionally outside this phase.

## Non-negotiable boundaries

- Course Studio remains the internal authoring surface at `/studio`, protected by its dedicated credential; there is no Motorola account or agency account.
- Desktop is the target experience at 1440×900. Mobile authoring is not a priority.
- Course Studio does not geolocate, translate, replace, package, or manage localization of individual assets. Assets belong to the authored master and remain unchanged.
- Motorola Insiders and HaLight are downstream delivery platforms. Course Studio preserves that relationship and does not reproduce their functions.
- The current learner route, progress keys, player behavior, and all current learning interactions remain compatible during the authoring redesign.
- Automated tests are not created or run. Verification is `npm run typecheck`, `npm run lint`, `git diff --check`, and desktop Chrome at 1440×900. Ollama and AI API calls are out of scope.

## Authoring experience

Course Studio is a first-party application surface. Its normal desktop layout is canvas-first:

```text
Course outline                     Live learner canvas                 Inspector
Course                             Exact desktop rendering             Selected course,
 └ Chapter                          of the selected screen              chapter, or screen
    ├ Screen                          at authoring size                  settings
    ├ Screen                                                             and block controls
    └ Quick Check
```

The left outline is the source of truth for course order. Authors can create a course from the Lionbridge template, add chapters, add screens from the block library, select, duplicate, reorder, and remove screens. The central canvas is the primary reference point: authors see the learner-facing result while editing rather than a collection of disconnected CMS fields. The right inspector edits the selected item. A focus-preview mode expands the learner canvas for validating interaction behavior.

## Templates and blocks

A new Course begins from the Lionbridge course template, not a blank database document. The template creates the Course, an opening Chapter, and a first Content screen with safe defaults. Authors can add, remove, duplicate, and reorder everything after creation.

The block library exposes every existing learner block without changing their meaning:

| Block | Existing runtime type |
| --- | --- |
| Content screen | `content` |
| Hotspot exploration | `interaction` |
| Product stage | `stage` |
| Video | `video` |
| In-lesson quiz | `quiz` |
| Canvas inspection | `canvas` |
| Colour switcher | `colorSwitcher` |
| Split screen | `splitScreen` |
| Drag and drop | `dragDrop` |
| Scroll story | `scrollStory` |

Course Studio is a guided visual editor, not a freeform Storyline clone. It intentionally offers validated screen templates and type-specific controls instead of arbitrary pixels, timelines, or scripting. This is the speed and consistency advantage over Articulate for Lionbridge production.

## Data model and compatibility

PostgreSQL `Course`, `CourseChapter`, `CourseLesson`, and `CourseQuiz` records are the live authoring model and continue to power the learner route. The authoring tool writes through protected application APIs and database transactions:

- `course.chapters[]` owns chapter order.
- `chapter.lessons[]` owns screen order.
- each `lesson.lessonType` selects the existing player presentation.

The tool reads a resolved authoring graph, not the public learner projection. It can create valid Course, Chapter, and Lesson records from deterministic defaults, and it can update ordering and selection safely in PostgreSQL transactions. Existing authored courses remain editable; the authoring tool must never rewrite or flatten their rich text, media references, or interaction data without an explicit author action.

## Master release

The former locale-release foundation is replaced by a master-release foundation. A `courseMasterRelease` records one frozen complete course version:

- master Course reference, title, source revision, source fingerprint, and creation time;
- complete resolved authoring snapshot serialized as read-only JSON text, including course, chapters, lessons, quizzes, specifications, disclaimer, and unchanged media references;
- lifecycle status: `draft`, `ready`, `delivered`, `archived`.

Creating a master release never edits the live course. It gives Lionbridge a traceable master in Course Studio now; generating the exact external deliverable that Motorola distributes is a later adapter, deliberately separate from authoring.

## Preview and safety

The canvas preview uses the same learner presentation components and a local preview runtime. Preview interactions never write learner progress, call AI, or mutate the course. Selecting a screen in the outline makes it the preview target. Preview focus mode is for desktop validation only.

Required feedback states:

- no course selected: explain how to create or choose a course;
- loading graph: show a local loading state without hiding the Studio shell;
- mutation failure: retain the selected item and show a recoverable error;
- delete: require confirmation and explain whether the author is removing a screen or chapter;
- master creation: block duplicate master records for the same source revision and show the created version in the master list.

## Delivery sequence

1. Replace the premature locale-release UI/schema with master-release records.
2. Add the Course Studio top-level custom tool and its resolved authoring graph contract.
3. Build the canvas-first shell, outline, template creation, screen library, and safe ordering mutations.
4. Add the shared inspector and type-specific authoring panels for every current block.
5. Embed a non-persistent learner preview and focus-preview mode.
6. Add master freezing and master-release history.
7. Verify the complete authoring workflow in desktop Chrome at 1440×900, without touching agency handoff formats or existing learner data.

## Explicitly deferred

- agency account access, package type, import, return QA, or localization workflow;
- any asset localization or asset management feature;
- SCORM/xAPI/Insiders/HaLight adapter implementation;
- a Storyline-compatible freeform canvas, animation timeline, or scripting engine;
- production AI and learner AI.
