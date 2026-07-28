# Feature Learning Loop Design

## Goal

Replace the generic discovery popup as the default hotspot response with a short, product-focused learning loop. Retain the existing AI tutor as an explicit optional path for deeper questions.

## Product principle

Moto Tutor is a learning app. A hotspot should create a usable product-learning moment, not merely reveal content or start a generic chat.

Each default interaction follows the same learner rhythm:

1. **Notice** — prompt the learner to inspect the exact product area before receiving an explanation.
2. **Reveal insight** — show concise authored learning content after the learner chooses to reveal it.
3. **Demonstrate** — ask one practical, reflective question about how the learner would point out or explain the benefit.

The learner can choose **Ask the AI tutor** at any point after the insight is revealed. This is a deeper, free-form conversation; it is never required for completion.

## V1 scope: Content lessons

V1 changes image hotspots rendered by `ContentLesson` only. Product Stage, Canvas, inline Portable Text cues, task-based lesson controls, authored Sanity documents, and progress data remain unchanged.

For an image hotspot, the current floating `DiscoveryPanel` no longer opens as the default. Instead, a compact **Product Lens** card is positioned near the chosen feature without covering the main lesson text or navigation.

The card has three states:

| State | Learner sees | Primary action |
|---|---|---|
| Notice | Feature label and a short observation prompt derived from the label | Reveal insight |
| Reveal insight | Existing authored hotspot body, with concise feature media if present | Continue to practice |
| Demonstrate | A practical prompt: “How would you point out this benefit?” | Ask the AI tutor or close |

Existing `hotspot.body`, photos, video, topic, label, and coordinates are reused. V1 adds no Sanity fields. The notice and demonstrate prompts are intentionally consistent system copy so authors do not need to maintain a second parallel content model.

## AI tutor distinction

The existing `DiscoveryPanel` remains the AI tutor. It is opened only from **Ask the AI tutor**, carrying the exact existing topic, body, photos, and video. Its conversation lifecycle, fallback behaviour, Escape handling, and close behaviour remain unchanged.

The learning card is not conversational and does not start a chat request. It is the completion-oriented authored path. Clicking the image hotspot still marks the feature visited through the existing `onVisit(label)` contract; opening, closing, or chatting with the tutor cannot add further completion state.

## Component boundaries

- `FeatureLearningLoop`: owns the Notice, Reveal insight, and Demonstrate states; it receives the active hotspot and `onAskTutor` / `onClose` callbacks.
- `ContentLesson`: owns the active hotspot selection, invokes `onVisit`, positions the loop, and opens the existing tutor only on the explicit secondary action.
- `DiscoveryPanel`: remains a generic AI tutor and is not redesigned in V1.

## Experience and accessibility

- Desktop is the baseline; the loop must stay clear of the top lesson label, primary lesson text, and bottom navigation.
- Opening the loop sends focus to its primary action. Escape closes it and returns focus to the originating hotspot.
- State transitions use short opacity/position transitions and respect reduced-motion preferences.
- Controls retain at least 44px targets. The loop has clear labels and does not depend on colour alone.

## Later family mapping

After V1 is validated, reuse the same learning states with family-specific shells:

- **Product Stage:** Product Lens anchored to the image.
- **Canvas:** Guided Sequence within the existing desktop workbench rail.
- **Inline layer links:** In-flow Lesson Cue inside the body copy.

This retains one instructional model while avoiding a repetitive visual response.

## Verification

No automated tests will be added or run, per the repository’s explicit instruction. Verification will use `npm run typecheck`, `npm run lint`, `git diff --check`, and desktop Chrome at 1440x900. The acceptance flow is: open a Content hotspot, progress through all three learning states, open and close the AI tutor explicitly, verify one progress visit, then verify Escape and focus return.
