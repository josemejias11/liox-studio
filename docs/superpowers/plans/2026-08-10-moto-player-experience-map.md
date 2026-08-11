# Moto Player Experience Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create one presentation-quality, light-theme Penpot experience map that shows the complete real moto g87 player: course shell, chapter transitions, all lessons, the Chapter 1 Quick Check, Specifications, Disclaimer acknowledgement, and completion.

**Architecture:** The artifact is one continuous snake-path course journey, not a course map plus separate detail diagrams. Every lesson occupies a vertically paired unit: a real player capture on the backbone, its concrete interaction state immediately below, then a connector into the next paired unit. The penultimate state returns to the backbone; it never starts a second journey.

**Tech Stack:** Penpot design file, Penpot desktop/web UI for image placement, Moto Course Studio local preview at `http://localhost:3000`, Chrome DevTools for source-state inspection, Penpot SVG/PNG exports for QA.

## Global Constraints

- Use a light canvas: `#F7F9FC`, white cards, charcoal player chrome, muted gray connectors, and a restrained Moto-blue primary accent.
- Use actual player screenshots; do not use synthetic mini-screen wireframes or cards labelled as screenshot placeholders.
- Preserve the verified player order: Course cover → Chapter 1 intro → Content / required Quick Recall → Product Stage → Interaction / required Quick Recall → Split Screen → Chapter 1 Quick Check → Chapter 2 intro → Scroll Story → Canvas Inspection → Drag and Drop → Chapter 3 intro → Colour Switcher → Video → Specifications → Disclaimer acknowledgement → Finish course.
- Show the chapter titles exactly: `Capture and create`, `Keep up with every day`, and `Recommend with confidence`.
- Treat the Chapter 1 Quick Check as a player phase after `From image to share`; it is not a normal lesson card and is not listed in the Course Map.
- Treat Specifications and Disclaimer as real navigable player phases after Video. Disclaimer keeps Next disabled until the learner reaches the end and checks `I understand the LATAM availability and claim limitations.`
- Make every prerequisite explicit: a disabled Next state, the learner action, the visible feedback/state change, and the enabled Next state.
- Product Stage must show the real required-hotspot loop: open a hotspot, see authored detail/media, close it, update `0/3` through `3/3`, then unlock Next.
- Keep text legible at 100% board view: section titles at least 24 px; card titles at least 18 px; interaction labels at least 14 px.
- Do not create or run automated tests. Verify with the live local player, Penpot shape inspection, and exported visual review.
- Do not delete the existing Penpot boards; hide or retain them as working history.

---

## File / Artifact Structure

- Penpot file `Moto Player — Executive Experience Map`, page `Page 1` — owns the final named board `Moto Player — moto g87 Experience Map`.
- Local Course Studio preview `http://localhost:3000/studio/course.128d9f41-958b-43f1-b9b9-081f8bb47d9f` — source of truth for the player captures and interaction conditions.
- `docs/superpowers/plans/2026-08-10-moto-player-experience-map.md` — this execution contract; no app source files change.

### Task 1: Capture the correct learner evidence before designing

**Artifacts:**
- Create: a capture set imported into the Penpot file, one or more images per state below.

**Consumes:** The live Moto Course Studio course and its authored course outline.

**Produces:** Real captures with no Studio editor chrome, all at the same desktop viewport and without browser controls.

- [ ] **Step 1: Establish the capture viewport**

Open the preview at 1440 × 900. Hide the Studio chrome through Focus Preview. Confirm the player header, progress, Back, and Next are visible in every capture.

- [ ] **Step 2: Capture shell and chapter-transition states**

Capture the course cover with `Start learning`, then one Chapter Intro screen for each of `Capture and create`, `Keep up with every day`, and `Recommend with confidence`. Each intro must visibly lead to its first lesson and must be represented as a real transition in the map.

- [ ] **Step 3: Capture the single-state lessons**

Capture one player screen for each of these moments:

| Lesson | Capture must prove |
| --- | --- |
| Content | `Social-creation story` and normal `Continue` |
| Split Screen | Both panels visible |
| Scroll Story | Story content and the completion/continue point |
| Canvas Inspection | Visible inspectable targets |
| Colour Switcher | Finish-switching control and selected finish |
| Video | Video player and completion affordance |
| Specifications | Camera, Battery and charging, Display and platform, and Protection and connectivity groups |
| Disclaimer | Legal heading, scroll-to-bottom instruction, acknowledgement checkbox, and disabled Next before acknowledgement |

- [ ] **Step 4: Capture prerequisite, quiz, and recovery states**

Capture paired states for the lessons that branch:

| Lesson | Before state | After / recovery state |
| --- | --- | --- |
| Content Quick Recall | `0/3` with Next disabled | all answers revealed with Next enabled |
| Product Stage | `0/3` with three hotspots | open hotspot detail/media, then `3/3` with Next enabled |
| Interaction Quick Recall | `0/3` with Next disabled | all three covered features revealed with Next enabled |
| Drag and Drop | unsolved arrangement | correct arrangement / enabled Next |
| Chapter 1 Quick Check | first question and answer choices | pass/fail feedback followed by Chapter 2 intro |
| Disclaimer | initial / disabled Next | scrolled and acknowledged / enabled Next |

- [ ] **Step 5: Import image assets manually through Penpot**

The Penpot MCP rejects image payloads with HTTP 413, so use Penpot's own import/drag-and-drop UI for the capture set. Name each imported image with its real player position and state, for example `00-cover`, `01-chapter-intro-capture`, `02-content-recall-locked`, `04-stage-0-of-3`, `04-stage-hotspot-detail`, `04-stage-3-of-3`, `06-chapter-quick-check`, `10-specifications`, `11-disclaimer-locked`, and `11-disclaimer-acknowledged`. Do not downsample the originals before import; crop copies only inside Penpot.

- [ ] **Step 6: Acceptance check**

Count image fills in the final Penpot board. Expected: at least 22 real image fills and zero `LIVE PLAYER CAPTURE` / placeholder labels.

### Task 2: Establish the visual system and the one-path composition

**Artifacts:**
- Create: Penpot board `Moto Player — moto g87 Experience Map`.

**Consumes:** The imported capture set from Task 1.

**Produces:** A presentation-scale board with one unbroken reading order.

- [ ] **Step 1: Create the light board and title block**

Create a board approximately 4800 × 2600. Use `#F7F9FC` for the canvas. Add the title `Moto Player — moto g87 experience map` and subtitle `What the learner sees, does, and unlocks—across one course journey.`

- [ ] **Step 2: Lay out a three-chapter snake path**

Use three horizontal chapter bands with explicit headings and retain all non-lesson phases in the same path:

1. `Capture and create`: Course cover → Chapter 1 intro → Content / Quick Recall → Product Stage → Interaction / Quick Recall → Split Screen → Chapter 1 Quick Check.
2. `Keep up with every day`: Chapter 2 intro → Scroll Story → Canvas Inspection → Drag and Drop.
3. `Recommend with confidence`: Chapter 3 intro → Colour Switcher → Video → Specifications → Disclaimer acknowledgement → Finish course.

Draw one connector sequence. At the end of each band, turn the connector down and left into the next band. No free-standing scenario panel, legend lane, or duplicate flow is allowed.

- [ ] **Step 3: Define the repeated lesson unit**

For each player phase, place the screenshot card directly on the backbone. Immediately below it place a state card with this fixed order: `Learner action` → `What the player shows` → `Advance rule`. Use the screenshot's actual crop, not an illustration of the player. Connect the screenshot down to its state card, and the state card to the next screenshot. Chapter intro, Quick Check, Specifications, and Disclaimer follow this same component pattern; they must not be represented as footnotes or side panels.

- [ ] **Step 4: Establish hierarchy and color**

Use charcoal (`#17212F`) only for player chrome; use Moto blue (`#1677D2`) for the backbone and standard progress; use teal (`#20A48A`) only for discovery/inspection gates; use amber (`#F0A11A`) only for answer/retry gates; use pink (`#D45A8A`) only for video completion. Keep all card surfaces white with `#D9E1EA` 1 px borders.

- [ ] **Step 5: Acceptance check**

At a 100% exported view, a reviewer can follow the course from left to right, turn into the next chapter, and reach Finish course without consulting labels outside the path.

### Task 3: Build the real branching interactions and player phases into the same path

**Artifacts:**
- Modify: the screenshot and state-card pair for Content, Product Stage, Interaction, Canvas, Drag and Drop, Chapter 1 Quick Check, Specifications, and Disclaimer on `Moto Player — moto g87 Experience Map`.

**Consumes:** Named real capture assets and the established repeated lesson unit.

**Produces:** Branches that explain actual learner behavior and recover into the main route.

- [ ] **Step 1: Build Quick Recall as a two-state gate**

Under `Quick Recall`, place the locked `0/3` capture first and the all-revealed capture second. Label the connector `Reveal answer ×3`. The state card must state: `Next is disabled while any answer remains hidden; after 3/3, Next unlocks.`

- [ ] **Step 2: Build Product Stage as a visible hotspot loop**

Use three adjacent states under `Explore the camera system`: `0/3` stage, open hotspot detail/media, and `3/3` stage. Include the three hotspot labels: `50MP Sony LYTIA 600`, `8MP ultra-wide`, and `32MP selfie camera`. The arrows must read `open`, `close`, and `repeat until all 3`. Only the `3/3` state connects forward to Interaction.

- [ ] **Step 3: Build answer recovery for Interaction and Drag and Drop**

For Drag and Drop, use a fork into `Correct` and `Not yet`. `Correct` rejoins the main course connector. `Not yet` returns to the same prompt with a `Retry` arrow. For Interaction, show its actual Quick Recall reveal sequence instead of inventing answer scoring. Do not route failure to a different lesson or a dead end.

- [ ] **Step 4: Build inspection completion for Canvas**

Show the real canvas capture and a state card that names the visible targets. Route `inspect required targets` to `all required targets inspected`, then to the next lesson.

- [ ] **Step 5: Build the Chapter 1 Quick Check transition**

After `From image to share`, connect to the real `Capture and create check` quiz screen. Show answer selection and feedback, then route both quiz outcomes to `Keep up with every day` Chapter Intro. Do not show a fake final AI quiz: the verified player source has no course-level final-quiz phase.

- [ ] **Step 6: Build Specifications and Disclaimer as gated player phases**

After Video, show the real Specifications page with its four information groups. Connect its standard Next to Disclaimer. On Disclaimer, draw a required sequence: `read / reach bottom` → `check acknowledgement` → `Next enabled` → `Finish course`. Include the exact acknowledgement label; do not reduce it to a generic legal note.

- [ ] **Step 7: Acceptance check**

Every branch has an arrow into it, a readable learner action, an observable player state, and either a retry arrow or a forward connector. No branch ends without an explicit destination.

### Task 4: Place the shared player behavior without creating another flow

**Artifacts:**
- Modify: the border/header treatment of the final Penpot board.

**Consumes:** The single connected course path.

**Produces:** Shared controls understood as persistent player behavior, not a separate diagram.

- [ ] **Step 1: Add a compact persistent-controls rail**

Place a narrow rail across the top of the board: `Course map`, `Progress`, `Back`, `Next`, and `Course Assistant`. Each item has a one-line behavior statement. It must not use arrows or read as a learner path.

- [ ] **Step 2: Use only verified behavior copy**

Use these statements: `Back returns to the previous navigable player phase`; `Progress uses the 11 navigable course sections (9 lessons, Specifications, Disclaimer)`; `Next is enabled only when the authored lesson condition is complete`; `Course map groups the 9 lessons by chapter and lists Specifications and Disclaimer separately`; `Course Assistant opens and returns the learner to the same state.` Do not imply a final AI quiz, adaptive scoring, or unverified chat availability.

- [ ] **Step 3: Acceptance check**

The main course path remains visually dominant; the rail reads as player chrome, not a second sequence.

### Task 5: QA the finished artifact before handoff

**Artifacts:**
- Create: one exported PNG of the final board and a concise QA record in the execution handoff.

**Consumes:** The final Penpot board and local player source states.

**Produces:** Evidence that the final board is both accurate and visually legible.

- [ ] **Step 1: Run structural Penpot QA**

Inspect the final board for: exactly one visible final experience-map board; at least 22 image fills; zero placeholder labels; all shapes contained inside the board; and one card/state pairing for every player phase, including three chapter intros, Chapter 1 Quick Check, Specifications, and Disclaimer.

- [ ] **Step 2: Run visual export QA**

Export the board as PNG at 50% and inspect it. Reject the board if any body text is unreadable, if a connector crosses an unrelated card, if chapter transitions are ambiguous, or if the board appears to contain separate diagrams.

- [ ] **Step 3: Cross-check player truth**

Compare the complete backbone and all prerequisite branches with the local player source and captures. Confirm the three chapter transitions, Chapter 1 Quick Check after Split Screen, Product Stage `0/3` → hotspot detail → `3/3`, Specifications after Video, and the Disclaimer scroll-and-acknowledge gate before completion.

- [ ] **Step 4: Handoff**

Report: Penpot board name, screenshot count, the exact verified prerequisite branches, the exported visual result, and any remaining limitation. Do not call the work complete until all three QA checks pass.

## Plan Self-Review

- Spec coverage: includes real source captures, a light-theme visual system, the complete player backbone, every lesson, all chapter transitions, the Chapter 1 Quick Check, Specifications, Disclaimer acknowledgement, the Product Stage loop, practice recovery, persistent controls, and visual/structural QA.
- Placeholder scan: no deferred design decisions or synthetic-screen substitutions are permitted; the manual Penpot image-import gate is explicit because the MCP upload endpoint has a verified size limitation.
- Consistency: the visual system and the QA rules require one board, one journey, and real player evidence throughout.
