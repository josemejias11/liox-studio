# Desktop Quick Recall Rail Design

## Goal

Give Quick Recall a premium, learning-first presence in the desktop course player. It should feel like an intentional reflection moment that complements the lesson, rather than a small utility panel in the upper-left corner.

## Product Principle

Moto AI is a learning application. Visual hierarchy, pacing, interaction, and feedback must reinforce learning. Premium styling should make the instructional purpose clearer; it must not add decorative UI that competes with the course material.

## Desktop Layout

The desktop Content lesson uses a two-zone composition inside the existing 16:9 player:

- The left side remains the instructional zone: lesson category, headline, and explanatory body copy.
- The right third becomes the Quick Recall learning rail when the lesson has recall features.
- The rail is vertically centered with generous outer margins instead of sitting in a corner.
- The rail has a dark indigo surface, a clear progress indicator, one prompt, brief reflection guidance, and a large primary reveal action.
- The completed state keeps the last revealed answer visible and adds a calm completion acknowledgement.

The rail must respect the player’s existing navigation and not cover the course map, primary navigation controls, or lesson headline.

## Recall Flow

1. The learner reads the Content lesson in the instructional zone.
2. The learning rail presents one recall prompt at a time.
3. Selecting **Reveal answer** marks the existing feature label visited, displays the answer, and updates progress.
4. Selecting **Next feature** advances to the next unvisited prompt.
5. When every answer has been revealed, the rail shows the final answer and a completion acknowledgement. Existing navigation unlock behavior remains unchanged.

The stored authoring fields and persisted visited labels remain unchanged.

## Visual Language

- Use the course’s indigo and deep-slate palette, with a restrained border, layered surface, and soft shadow.
- Use roomy spacing and large prompt typography to establish a focused study rhythm.
- Keep one clear primary action: **Reveal answer**.
- Use concise learning language: “Pause and recall,” progress such as “1 of 2,” and a completion acknowledgement.
- Avoid dashboard-style widgets, dense feature lists, and utility-panel styling.

## Responsive Boundary

This change is desktop-first. Desktop layout quality drives the implementation. Existing smaller-screen behavior must remain functional, but mobile redesign, mobile-specific visual polish, and mobile-led layout decisions are explicitly out of scope.

## Scope

Modify only the existing Quick Recall presentation and its associated desktop layout integration. Do not add schema fields, change progress keys, add routes, introduce dependencies, or redesign other lesson types.

## Verification

- Run formatting, `npm run typecheck`, `npm run lint`, and `git diff --check`.
- Verify the Content lesson in the browser at desktop player dimensions.
- Confirm the rail has one visible prompt, reveal preserves the answer, next prompt progression works, and course navigation unlocks after all answers are revealed.
- Confirm the existing smaller-screen experience remains functional without treating it as a design target.
