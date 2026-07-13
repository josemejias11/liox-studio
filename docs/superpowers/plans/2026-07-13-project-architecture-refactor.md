# Project Architecture Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the course player, discovery chat, Sanity lesson schema, Next.js API boundaries, and Python parser service into focused modules without changing product behavior or public contracts.

**Architecture:** Work subsystem by subsystem and leave each phase lint-clean and type-safe before continuing. Existing routes, Sanity field names, GROQ payloads, Prisma progress data, lesson identifiers, and parser-service response shapes remain unchanged.

**Tech Stack:** Next.js 16, React 19, TypeScript 6, Sanity 5, Zod 4, Prisma 5, FastAPI, Pydantic.

## Global Constraints

- Do not create test files or restore a test runner.
- Do not modify or stage the existing unrelated `package-lock.json` change.
- Do not add dependencies.
- Preserve current UI behavior, routes, API status codes, payloads, Sanity document shapes, and lesson completion behavior.
- Verify TypeScript phases with `npm run lint` and `npm run typecheck`.
- Verify Python phases with `python -m compileall` against only the modified source modules.
- Commit every completed phase separately on the current authorized `main` branch.

---

### Task 1: Course player runtime model and overlays

**Files:**
- Create: `src/player/hooks/useLessonRuntime.ts`
- Create: `src/player/PlayerOverlays.tsx`
- Modify: `src/player/MotoViewer.tsx`
- Modify: `src/player/CoursePhaseScreen.tsx`

**Interfaces:**
- Consumes: `LessonSection`, `SanityHotspot`, `getLessonCompletionMode()`, `getCoveredFeatureLabels()`, `isRefresherComplete()`, `getRequiredCanvasTargetCount()`, `isCanvasComplete()`, and the existing `useLessonProgress().markVisited` callback.
- Produces: `useLessonRuntime({ currentLesson, visited, baseMarkVisited })`, returning `lessonKey`, `hotspots`, `visitedLabels`, `completionMode`, `isSpecialComplete`, `markVisited`, `completionHint`, and progress counts.
- Produces: `PlayerOverlays`, which renders `NavMap`, `CourseAIFab`, progress-sync status, and `CompletionBurst` from explicit props.

- [ ] **Step 1: Extract lesson runtime derivation**

Create `useLessonRuntime.ts` with a typed input and return value. Move current-lesson hotspot lookup, refresher label derivation, Canvas required-target counting, manual-completion state, visit callback construction, and completion-hint construction from `MotoViewer` into this hook. Preserve precedence: refresher requirements override Canvas requirements, Canvas requirements override generic hotspot requirements.

- [ ] **Step 2: Extract persistent player overlays**

Create `PlayerOverlays.tsx` with explicit props for flow, section index, visited state, map visibility, navigation callbacks, current phase, current lesson type, course ID, progress error, persistence state, and burst state. Move only overlay JSX; do not move navigation or progress ownership.

- [ ] **Step 3: Simplify player orchestration**

Update `MotoViewer.tsx` to consume `useLessonRuntime`, pass the returned runtime values to `CoursePhaseScreen`, and render `PlayerOverlays`. Keep animation, phase routing, session ownership, weak-topic derivation, and disclaimer state in `MotoViewer`.

- [ ] **Step 4: Tighten phase renderer props**

Replace the separate `lessonKey`, `hotspots`, `visitedLesson`, `isSpecialComplete`, and `markVisited` props in `CoursePhaseScreen` with a single `lessonRuntime` object typed from `useLessonRuntime.ts`. Leave course-phase callbacks as explicit props.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npx eslint src/player/MotoViewer.tsx src/player/CoursePhaseScreen.tsx src/player/PlayerOverlays.tsx src/player/hooks/useLessonRuntime.ts
npm run typecheck
```

Expected: both commands exit with code 0. Commit only the four Task 1 files with `refactor: separate course player runtime`.

### Task 2: Shared discovery conversation state

**Files:**
- Modify: `src/components/course-ai/useChatConversation.ts`
- Modify: `src/components/course-ai/CourseChat.tsx`
- Create: `src/components/discovery/DiscoveryLearnContent.tsx`
- Create: `src/components/discovery/DiscoveryConversation.tsx`
- Modify: `src/components/DiscoveryPanel.tsx`

**Interfaces:**
- Extends: `useChatConversation()` with `send(query, options?)`, where `options` supports `displayUserMessage?: boolean` and `queryOverride?: string`.
- Produces: stable `abort()`, `reset()`, and `onAssistantMessage` behavior so consumers do not manage request controllers or conversation refs.
- Preserves: `DiscoveryPanelProps` and the current `/api/chat` request format.

- [ ] **Step 1: Consolidate conversation lifecycle**

Move abort-controller ownership, assistant fallback messages, request ordering protection, and reset behavior into `useChatConversation`. Generate message IDs with a local monotonic ref rather than timestamps. Keep `askCourseChat` as the only transport.

- [ ] **Step 2: Support discovery prompts without transport duplication**

Add optional send controls so `DiscoveryPanel` can hide its automatic greeting prompt from the UI while sending a topic-prefixed query. Expose `onAssistantMessage` for live-region announcements. Do not add hotspot knowledge to the hook.

- [ ] **Step 3: Extract discovery view sections**

Move body/photo/video rendering into `DiscoveryLearnContent.tsx`. Move message list, suggestion buttons, text input, and submit control into `DiscoveryConversation.tsx`. Keep popover/sidebar placement, focus trap, swipe close, and accessibility announcements in `DiscoveryPanel`.

- [ ] **Step 4: Adopt the shared hook in both chat surfaces**

Update `DiscoveryPanel` to remove its local message, streaming, conversation, and abort state. Update `CourseChat` for the extended hook return type without changing its visual behavior.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npx eslint src/components/DiscoveryPanel.tsx src/components/discovery/DiscoveryLearnContent.tsx src/components/discovery/DiscoveryConversation.tsx src/components/course-ai/useChatConversation.ts src/components/course-ai/CourseChat.tsx
npm run typecheck
```

Expected: both commands exit with code 0. Commit only the five Task 2 files with `refactor: unify discovery chat state`.

### Task 3: Composable Sanity lesson schema

**Files:**
- Create: `src/sanity/schemaTypes/lesson/richText.ts`
- Create: `src/sanity/schemaTypes/lesson/contentFields.ts`
- Create: `src/sanity/schemaTypes/lesson/mediaFields.ts`
- Create: `src/sanity/schemaTypes/lesson/interactionFields.ts`
- Create: `src/sanity/schemaTypes/lesson/specializedFields.ts`
- Modify: `src/sanity/schemaTypes/lesson.ts`

**Interfaces:**
- Produces: `lessonContentFields`, `lessonMediaFields`, `lessonInteractionFields`, and `lessonSpecializedFields`, each as arrays of Sanity field definitions.
- Produces: shared Portable Text decorators and block definitions from `richText.ts`.
- Preserves: every existing field name, order, group, hidden callback, validation rule, initial value, preview, and custom input component.

- [ ] **Step 1: Extract rich-text definitions**

Move the repeated decorator list and body block configuration into exported constants. Preserve the `layerLink` annotation on the main lesson body and preserve simpler hotspot/scroll-story block configurations where they intentionally differ.

- [ ] **Step 2: Extract content and refresher fields**

Move `headline`, `body`, `lessonType`, `deviceName`, `coveredFeatures`, color variants, split layout, drag/drop, and scroll-story authoring fields into focused field arrays.

- [ ] **Step 3: Extract media and interaction fields**

Move product media, text overlay, video, stage background, hotspots, hotspot media, and completion-animation fields into their own arrays while retaining `HotspotMapInput` and `TextOverlayMapInput` references.

- [ ] **Step 4: Compose the document schema**

Reduce `lesson.ts` to document metadata, groups, and ordered field-array spreads. Confirm the composed order matches the original Studio form.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npx eslint src/sanity/schemaTypes/lesson.ts src/sanity/schemaTypes/lesson/*.ts
npm run typecheck
```

Expected: both commands exit with code 0. Commit only Task 3 schema files with `refactor: compose lesson schema fields`.

### Task 4: Consistent Next.js API boundaries

**Files:**
- Create: `src/lib/server/http.ts`
- Modify: `src/app/api/chat/route.ts`
- Modify: `src/app/api/quiz/route.ts`
- Modify: `src/app/api/upload/route.ts`
- Modify: `src/app/api/progress/route.ts`
- Modify: `src/app/api/analytics/weak-topics/route.ts`
- Modify: `src/app/api/quiz/grade/route.ts`

**Interfaces:**
- Produces: `readJson(request, schema)`, returning a discriminated success/error result without throwing.
- Produces: `jsonError(message, status)`, returning the existing `{ error: string }` payload shape.
- Produces: `unexpectedApiError(scope, error)`, logging scoped details and returning the existing generic 500 response.
- Preserves: route-specific schemas, auth checks, status codes, success payloads, and parser-service calls.

- [ ] **Step 1: Add server-only HTTP helpers**

Create `src/lib/server/http.ts` with `import 'server-only'`, Zod-based body parsing, consistent error JSON, and scoped unexpected-error handling. Keep malformed JSON distinct from schema-invalid JSON only when the current route already distinguishes them.

- [ ] **Step 2: Refactor parser-backed routes**

Adopt helpers in chat, quiz, and upload routes. Keep `RagServiceError` status mapping and all current user-safe messages unchanged.

- [ ] **Step 3: Refactor database-backed routes**

Adopt helpers in progress, weak-topics analytics, and quiz grading routes. Preserve authentication, Prisma operations, and response bodies.

- [ ] **Step 4: Verify and commit**

Run:

```bash
npx eslint src/lib/server/http.ts src/app/api/chat/route.ts src/app/api/quiz/route.ts src/app/api/upload/route.ts src/app/api/progress/route.ts src/app/api/analytics/weak-topics/route.ts src/app/api/quiz/grade/route.ts
npm run typecheck
```

Expected: both commands exit with code 0. Commit only Task 4 files with `refactor: standardize API boundaries`.

### Task 5: Thin FastAPI route adapters

**Files:**
- Create: `parser-service/service_operations.py`
- Modify: `parser-service/main.py`
- Modify: `parser-service/documents.py`

**Interfaces:**
- Produces: `store_course_document(course_id, upload_file) -> tuple[str, int]`.
- Produces: `remove_course_document(course_id, filename) -> str`.
- Preserves: FastAPI paths, Pydantic models, internal-token dependency, HTTP status mapping, response payloads, logging scopes, and temporary-file cleanup.

- [ ] **Step 1: Extract document orchestration**

Move filename normalization, extension validation, temporary-file lifecycle, document parsing/storage, and deletion orchestration into `service_operations.py`. Define focused domain exceptions for invalid documents, oversized uploads, extraction failures, and missing documents.

- [ ] **Step 2: Reduce route handlers to adapters**

Update `main.py` upload and delete routes to call service operations and translate each domain exception to the same status and detail currently returned. Keep chat and quiz routes as direct adapters to their already-focused domain functions.

- [ ] **Step 3: Remove obsolete compatibility exports**

Remove the stale comment and re-export structure that existed only for deleted tests. Import only names used by the running application. Do not rename public models or route functions.

- [ ] **Step 4: Verify and commit**

Run:

```bash
cd parser-service && python -m compileall main.py documents.py service_operations.py
```

Expected: all three modules compile successfully. Commit only Task 5 files with `refactor: isolate parser service operations`.

### Task 6: Repository consistency and final verification

**Files:**
- Modify: `README.md`
- Modify: only source files from Tasks 1-5 if lint reveals mechanical formatting or unused imports.

**Interfaces:**
- Documents: the new player runtime, shared discovery conversation, composed Sanity lesson schema, API helper, and parser-service operation boundaries.
- Preserves: no test script, test dependency, test config, or test source files.

- [ ] **Step 1: Update architecture documentation**

Update README module tables and data-flow descriptions to point to the extracted modules. Remove descriptions that imply orchestration still lives in the old large files.

- [ ] **Step 2: Confirm repository constraints**

Run:

```bash
rg --files | rg '(^|/)(test|tests|__tests__)(/|$)|\.(test|spec)\.[^.]+$|vitest\.config'
```

Expected: no output. Confirm `git diff -- package-lock.json` remains identical to the pre-refactor unrelated workspace change and is not staged.

- [ ] **Step 3: Run final TypeScript verification**

Run:

```bash
npm run lint
npm run typecheck
```

Expected: both commands exit with code 0.

- [ ] **Step 4: Run available production verification**

Run `npm run build` only when the configured PostgreSQL instance is available because the build command begins with `prisma migrate deploy`. If unavailable, report the environmental block without changing build scripts or database configuration.

- [ ] **Step 5: Commit documentation and handoff**

Commit README and any final mechanical cleanup with `docs: update refactored architecture`. Report each verification command and any environment-only build limitation.
