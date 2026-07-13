# Project Architecture Refactor Design

## Objective

Refactor the Moto Tutor AI codebase into smaller, focused modules while preserving the current product behavior, Sanity content model, public routes, API payloads, learner progress, and parser-service integration.

This is an architectural cleanup, not a feature redesign. It must leave the Standard and Canvas course experiences working through the existing `/course/[slug]` route and shared player.

## Constraints

- Do not create test files or restore a test runner.
- Verify each phase with ESLint, TypeScript, production build checks where available, and targeted manual inspection.
- Preserve all current routes, request and response payloads, Prisma data, Sanity document shapes, GROQ projections, and lesson type identifiers.
- Do not migrate or delete Sanity content.
- Do not add dependencies unless an existing platform API cannot support the required boundary.
- Preserve unrelated user changes, including the current uncommitted `package-lock.json` update.
- Commit each phase separately so it can be reviewed or reverted independently.

## Refactor Strategy

The project will be refactored incrementally, one subsystem at a time. Each phase must leave the application in a type-safe, lint-clean state before the next phase begins. Cross-subsystem rewrites are avoided because they make behavioral regressions difficult to isolate.

The sequence is:

1. Course player composition and lesson completion state.
2. Discovery panel and chat conversation state.
3. Sanity lesson schema organization.
4. Next.js API request and response boundaries.
5. Python parser-service route orchestration.
6. Repository consistency and documentation.

## Phase 1: Course Player Composition

### Current problem

`MotoViewer` currently derives course flow, current lesson state, completion requirements, progress values, frame props, navigation handlers, overlays, and phase rendering in one component. The logic works, but each new lesson capability adds more conditional state to the same file. Completion behavior is also distributed across `MotoViewer`, `useCourseNavigation`, `useLessonProgress`, `LessonRenderer`, and lesson-specific components.

### Design

Create a focused player model hook that accepts the course, sections, and persisted visit state and returns the current lesson runtime model. The model will contain:

- Current lesson, lesson key, hotspots, and visited labels.
- Completion mode and whether the lesson is locked.
- Refresher and Canvas completion counts.
- A single completion hint string.
- A completion callback used when marking a feature visited.

Extract frame-prop derivation from JSX into a dedicated helper. Extract persistent overlays such as the navigation map, AI assistant, progress warning, and completion burst into a small player-overlays component.

`MotoViewer` remains the orchestration shell: it owns top-level UI state, invokes hooks, renders animated phase content, and passes the derived model to `CoursePhaseScreen`.

### Boundaries

- `useCourseNavigation` remains the source of navigation state transitions.
- `useLessonProgress` remains the source of persisted visits.
- Lesson renderers remain responsible for lesson-specific interaction and visuals.
- Completion rules remain pure functions in `src/lib` and are composed by the player model.

## Phase 2: Discovery and Chat

### Current problem

`DiscoveryPanel` combines panel layout, focus behavior, mobile positioning, media rendering, lightweight Markdown rendering, suggestion state, fetch lifecycle, abort handling, conversation history, and announcements. Conversation behavior overlaps with `useChatConversation`.

### Design

Use one chat conversation hook for both discovery and course chat interfaces. The hook owns request cancellation, conversation history, streaming state, messages, and transport errors. Keep topic-specific prompt construction outside the transport layer so the discovery panel can provide feature context without coupling the shared hook to hotspots.

Split the discovery UI into focused internal components:

- Learn-content section for body, photos, and video.
- Conversation section for messages, suggestions, input, and submission.
- Positioning/layout wrapper for sidebar and popover modes.

The public `DiscoveryPanel` props and learner behavior remain unchanged.

## Phase 3: Sanity Lesson Schema

### Current problem

The lesson schema is a large document containing shared rich-text configuration, lesson-type options, refresher fields, media fields, hotspot definitions, and specialized lesson fields. Repeated Portable Text decorators and large inline object definitions make it difficult to understand which fields belong to which lesson type.

### Design

Extract schema fragments into files under `src/sanity/schemaTypes/lesson/`:

- Shared rich-text decorators and block definitions.
- Lesson type options.
- Refresher fields.
- Media fields.
- Hotspot fields.
- Specialized interaction fields.

The top-level lesson schema will compose these field arrays in the same order used today. Field names, groups, visibility rules, validation, initial values, and previews must remain unchanged so existing Sanity documents continue to work without migration.

## Phase 4: Next.js API Boundaries

### Current problem

API route handlers repeat JSON parsing, unauthorized or invalid-request responses, unexpected-error logging, and parser-service response mapping. The repeated patterns make response behavior drift between chat, quiz, upload, progress, and analytics routes.

### Design

Add small server-only helpers for:

- Safely parsing JSON request bodies.
- Returning consistent JSON errors.
- Mapping known parser-service failures to stable HTTP responses.
- Validating internal authentication where routes share the same policy.

Route handlers remain responsible for their route-specific validation and orchestration. Existing HTTP status codes and response payloads are preserved.

## Phase 5: Python Parser Service

### Current problem

The parser service already has useful modules for documents, vector storage, chat, quiz generation, runtime, and settings, but `main.py` still contains route-level orchestration and response translation that can be reduced further.

### Design

Keep FastAPI route functions as adapters:

1. Validate the incoming request.
2. Invoke a focused service operation.
3. Translate known domain errors into the existing HTTP response.

Move multi-step upload, deletion, chat, and quiz orchestration into service functions close to their domain modules. Preserve endpoint paths, headers, models, and JSON response shapes.

## Phase 6: Repository Consistency

### Design

After the subsystem refactors:

- Remove imports, comments, and files made obsolete by the extractions.
- Normalize naming for course, lesson, feature, and progress concepts without renaming public payload fields.
- Update README module maps and authoring guidance.
- Confirm generated code, local virtual environments, Chroma data, and build output remain excluded from refactor commits.
- Keep the project free of test files and test-runner configuration.

## Data Flow After Refactor

Sanity data continues through the existing boundary:

`GROQ payload -> Zod contract -> normalized course sections -> course flow -> player model -> phase renderer -> lesson renderer`

Learner progress continues through:

`lesson interaction -> player completion callback -> useLessonProgress -> /api/progress -> Prisma`

AI feature discovery continues through:

`DiscoveryPanel -> shared chat hook -> /api/chat -> parser-service -> ChromaDB/Ollama`

No phase changes these public flows; it only clarifies ownership inside them.

## Error Handling

- Player derivation must return safe empty values when there is no current lesson.
- Completion rules must preserve legacy behavior when refresher metadata or required Canvas targets are absent.
- Chat cancellation must not allow an older request to overwrite a newer conversation.
- API helpers must preserve route-specific status codes rather than replacing all failures with a generic response.
- Parser-service domain errors must remain distinguishable from unavailable dependencies and malformed requests.

## Verification

No test files will be created. Each phase will be verified using the checks relevant to the files changed:

- `npm run lint`
- `npm run typecheck`
- `npm run build` when required environment services are available
- Python syntax compilation for modified parser-service modules
- Import and formatting checks
- Manual review of the affected player and Studio paths when a local development server is available

Any verification blocked by unavailable PostgreSQL, Sanity, Ollama, or parser-service dependencies will be reported separately from code failures.

## Completion Criteria

The refactor is complete when:

- Major orchestration components have focused responsibilities.
- Duplicated chat and API boundary logic has one owner.
- The Sanity lesson schema is composed from clear fragments without changing its output.
- FastAPI route functions are thin adapters.
- Lint and typecheck pass.
- Available production build and manual checks pass.
- No test files or test-runner configuration have been introduced.
