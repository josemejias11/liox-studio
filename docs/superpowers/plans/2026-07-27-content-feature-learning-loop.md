# Content Feature Learning Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Content image hotspots into short authored learning loops while keeping the AI tutor as an explicit optional deep-dive.

**Architecture:** A new `FeatureLearningLoop` component owns the three instructional states and renders the active hotspot’s authored content. `ContentLesson` owns target selection, existing progress writes, hotspot focus return, and the handoff to the unchanged `DiscoveryPanel` only when the learner chooses to ask the AI tutor.

**Tech Stack:** React 19, TypeScript, Next.js, Tailwind CSS, Lucide, Portable Text.

## Global Constraints

- Desktop is the design baseline; verify at 1440x900.
- Reuse current hotspot label, body, photos, video, topic, and progress contracts; add no Sanity fields.
- The AI tutor is optional and must not affect completion.
- Preserve Product Stage, Canvas, inline layer links, task-based lesson controls, and existing `DiscoveryPanel` consumers.
- Do not create or run automated tests; use typecheck, lint, diff validation, and desktop browser verification.
- Do not start Ollama.

---

### Task 1: Create the authored learning-loop component

**Files:**
- Create: `apps/web/src/player/lesson-types/FeatureLearningLoop.tsx`

**Interfaces:**
- Consumes: `label`, `body`, `photos`, `videoFile`, `videoAspectRatio`, `onAskTutor`, `onClose`, and `returnFocusRef` from `ContentLesson`.
- Produces: `FeatureLearningLoop`, a focus-managed three-state learning card with no persistence logic.

- [ ] **Step 1: Define the component contract and learning states**

Create the exported props and local state:

```tsx
type LearningStep = 'notice' | 'insight' | 'demonstrate';

export interface FeatureLearningLoopProps {
  label: string;
  body?: RichText;
  photos?: SanityPhoto[];
  videoFile?: { asset?: { url?: string } };
  videoAspectRatio?: string;
  onAskTutor: () => void;
  onClose: () => void;
  returnFocusRef: React.RefObject<HTMLButtonElement | null>;
}
```

Initialize the loop at `notice` whenever its `label` changes. Focus the current primary button after each transition. On Escape, call `onClose()` and restore `returnFocusRef.current?.focus()`.

- [ ] **Step 2: Implement Notice, Insight, and Demonstrate**

Notice uses the label, a system observation prompt, and a 44px `Reveal insight` action. Insight renders existing authored content through `DiscoveryLearnContent` and advances with `Continue`. Demonstrate uses the fixed practical prompt and two actions:

```tsx
<p>How would you point out this benefit to someone seeing the product for the first time?</p>
<button onClick={onAskTutor}>Ask the AI tutor</button>
<button onClick={onClose}>Keep exploring</button>
```

Use an explicit close button, semantic dialog labeling, and short transitions that respect reduced-motion preferences. Position the card over the product image without covering the top lesson label, primary text, or bottom navigation.

### Task 2: Make Content hotspots open the learning loop by default

**Files:**
- Modify: `apps/web/src/player/lesson-types/ContentLesson.tsx`

**Interfaces:**
- Consumes: `FeatureLearningLoop` from Task 1 and existing `DiscoveryPanel` props.
- Produces: separate learning-loop and tutor state without changing `onVisit(label)` or Sanity data.

- [ ] **Step 1: Split active learning and tutor state**

Replace the single `activePanel` state with:

```tsx
const [activeLearningTarget, setActiveLearningTarget] = useState<SanityHotspot | null>(null);
const [activeTutorTarget, setActiveTutorTarget] = useState<ActivePanel | null>(null);
const hotspotRefs = useRef<Array<HTMLButtonElement | null>>([]);
```

Keep `toActivePanel` for the tutor only. Do not change the existing `onVisit(h.label)` callback or completion calculations.

- [ ] **Step 2: Wire image hotspots to the learning loop**

For each rendered image hotspot, attach its ref and select the original `SanityHotspot` when opened:

```tsx
ref={(element) => {
  hotspotRefs.current[i] = element;
}}
onOpen={() => setActiveLearningTarget(h)}
```

Render `FeatureLearningLoop` only when `activeLearningTarget` exists. `onClose` clears the learning target. `onAskTutor` converts the target with `toActivePanel`, clears the learning target, and opens the tutor state.

- [ ] **Step 3: Preserve non-V1 paths**

Leave `resolveLinkedLayer`, `InlineDiscoveryCue`, `linkedHotspotLabels`, Product Stage, and Canvas unchanged. Point `DiscoveryPanel.open` at `activeTutorTarget !== null`, pass its existing content props from that value, and clear only `activeTutorTarget` on close.

### Task 3: Verify the desktop learning flow

**Files:**
- Modify only if verification identifies a direct implementation defect in the Task 1 or Task 2 files.

**Interfaces:**
- Consumes: the finished Content learning loop.
- Produces: static and live evidence that the new default path does not change completion or other lesson families.

- [ ] **Step 1: Run static checks**

Run:

```bash
npm run typecheck
npm run lint
git diff --check
```

Expected: all three commands exit successfully with no errors.

- [ ] **Step 2: Verify the Content hotspot flow at 1440x900**

Open a Content lesson with image hotspots. Confirm: Notice appears first; Reveal insight shows authored content; Continue reaches Demonstrate; Ask the AI tutor opens the existing tutor; closing it returns to the lesson; one visit is recorded for the feature.

- [ ] **Step 3: Verify keyboard and regression boundaries**

Confirm Escape closes the loop and returns focus to its hotspot. Confirm Content’s Next gate still unlocks from feature visits. Open Canvas and Product Stage to confirm their interaction surfaces are unchanged. Treat tutor 502s as expected only while Ollama remains stopped.
