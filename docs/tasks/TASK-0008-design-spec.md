# TASK-0008 — Animation & Interaction Design Spec

**Author:** product-designer  
**Date:** 2026-06-17  
**Feeds into:** TASK-0009 (web-engineer implementation)  
**Status:** Ready for implementation

---

## How to read this spec

Each section is structured:
1. **Current state** — what the code does today  
2. **Verdict** — keep / tune / remove, with rationale  
3. **Spec** — exact values, property names, and code to target  

All values are production-ready. "Tune" means change specific values in place — no new abstractions needed.

---

## 1. Lesson navigation transition

### Current state

`MotoViewer.tsx:35–39` — `slideVariants` and `AnimatePresence`:

```ts
enter: { x: direction > 0 ? '50%' : '-50%', opacity: 0 }
center: { x: 0, opacity: 1 }
exit:   { x: direction < 0 ? '50%' : '-50%', opacity: 0 }
transition: { duration: 0.35, ease: [0.32, 0.72, 0, 1] }
```

`globals.css:540–592` also defines `lesson-enter-forward / exit-forward / enter-backward / exit-backward` CSS keyframes (28px translate, scale 0.98, 0.32s / 0.2s) that are not applied by MotoViewer — these are dead code unless used elsewhere.

### Verdict: Tune

`x: ±50%` is 200–400px on a typical viewport. The motion overshoots the perceptual "page flip" idiom — it reads as a distant slide rather than an adjacent page. The CSS keyframes (28px + scale 0.98) are well-calibrated and closer to correct.

The ease `[0.32, 0.72, 0, 1]` (Expo Out) produces an aggressive initial velocity that feels abrupt at the 50% amplitude but would suit a 24px offset.

The exit at `ease: [0.32, 0.72, 0, 1]` on 0.35s is too slow for a departing screen — the eye doesn't need to follow it.

### Spec

Replace `slideVariants` and the `transition` prop on `motion.div` in `MotoViewer.tsx:374–381`:

```ts
// MotoViewer.tsx — replace slideVariants at line 35
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 24 : -24,
    opacity: 0,
    scale: 0.98,
  }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (direction: number) => ({
    x: direction < 0 ? 24 : -24,
    opacity: 0,
    scale: 0.98,
  }),
};

// On the <motion.div> at line 381 — replace transition prop:
transition={{
  enter: { duration: 0.32, ease: [0.34, 1.15, 0.64, 1] },
  exit:  { duration: 0.18, ease: [0.32, 0.72, 0, 1] },
}}
```

> **Why asymmetric?** The entering screen deserves a gentle overshoot spring (`[0.34,1.15,0.64,1]`) to feel like it lands. The exiting screen should be brief and invisible — users don't watch content leave. 0.18s with Expo Out disappears cleanly.

**Delete** the `lesson-enter-forward`, `lesson-exit-forward`, `lesson-enter-backward`, `lesson-exit-backward` keyframes from `globals.css:540–592` — they are unused.

---

## 2. ProductStage entrance sequence

### Current state (`globals.css:406–471`)

| Animation | Duration | Delay | Properties |
|-----------|----------|-------|------------|
| `stage-enter-bg` | 0.7s ease-out | 0 | opacity 0→1 |
| `stage-enter-product` | 0.9s cubic(0.34,1.15,0.64,1) | 0.08s | translateY(34px) + scale(0.92) + **blur(8px)** + opacity |
| `stage-enter-top` | 0.5s ease-out | varies per element (JSX) | translateY(-12px) + opacity |
| `stage-enter-bottom` | 0.55s ease-out | 700ms (JSX) | translateY(16px) + opacity |

### Verdict: Tune + remove blur

**`filter: blur(8px)` must be removed.** Blur forces GPU rasterisation of the entire layer on every frame of the entrance. On budget Android devices (1× DPR, GPU memory pressure) this produces a muddy dissolve that looks broken rather than polished. The visual intent — "product rises out of softness into clarity" — is already accomplished by the scale(0.92→1) + opacity. The blur adds render cost with no perceivable value once the product image is sharp in the static state.

**0.9s is too long** for a product entrance on a return visit. Shorten to 0.65s — still spring-like and tactile, but doesn't feel slow.

**The stagger feels natural** — bg fades first (0.7s), product enters slightly offset (0.08s delay), top/bottom labels follow. Keep the logic; tune the values.

### Spec

Replace the following in `globals.css`:

```css
/* REMOVE blur from stage-enter-product keyframe */
@keyframes stage-enter-product {
  0% {
    transform: translateY(20px) scale(0.94);
    opacity: 0;
    /* blur(8px) removed — causes GPU raster per frame */
  }
  100% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

/* Reduce duration from 0.9s to 0.65s */
.stage-enter-product {
  animation: stage-enter-product 0.65s cubic-bezier(0.34, 1.15, 0.64, 1) 0.08s both;
}

/* Tighten label entrances — reduce from 0.5s/0.55s to 0.4s/0.45s */
.stage-enter-top {
  animation: stage-enter-top 0.4s ease-out both;
}
.stage-enter-bottom {
  animation: stage-enter-bottom 0.45s ease-out both;
}
```

translateY start value reduced from 34px → 20px: 34px is excessive on a small screen (nearly one fingertip of travel on mobile). 20px reads as "rising" without drama.

---

## 3. Hotspot pulse rings

### Current state (`globals.css:267–291`)

```css
.stage-ring  { animation: stage-wave 2.4s ease-out infinite; }
.stage-ring-2 { animation-delay: 0.7s; }
.stage-ring-3 { animation-delay: 1.4s; }
/* stage-wave: scale(1)→scale(2.8), opacity 0.65→0 */
```

Three rings per unvisited hotspot. On a lesson with 5 hotspots that is **15 concurrent CSS animations**, all scaling and fading simultaneously.

### Verdict: Reduce rings, calm the pace

**Three rings → two rings.** The third ring at 1.4s delay overlaps heavily with the first ring starting its second cycle. It adds visual noise without adding discovery clarity. Two rings separated by 1.0s give a cleaner "pulse" read.

**Scale 2.8× → 2.2×.** 2.8× on a 34px effective ring diameter (inset: -5px) expands to ~95px — nearly touching adjacent hotspots on small screens. 2.2× = ~75px, which stays within the hotspot's personal space.

**2.4s cycle → 3.0s cycle.** Faster pulses read as "urgent" — appropriate for alerts, wrong for feature discovery in a training context. 3.0s is calm and inviting.

**Opacity start 0.65 → 0.5.** The rings are informational, not warning signals. Slightly lower initial opacity keeps them supportive rather than distracting.

### Spec

```css
/* globals.css — replace the stage-wave keyframe and .stage-ring rules */

@keyframes stage-wave {
  0% {
    transform: scale(1);
    opacity: 0.5;
  }
  100% {
    transform: scale(2.2);
    opacity: 0;
  }
}

.stage-ring {
  position: absolute;
  inset: -5px;
  border-radius: 9999px;
  border-width: 2px;
  border-style: solid;
  animation: stage-wave 3.0s ease-out infinite;
  pointer-events: none;
}
.stage-ring-2 {
  animation-delay: 1.0s;
}
/* DELETE .stage-ring-3 — remove the third ring entirely */
```

In `Hotspot.tsx:141–147`, remove the third ring element:
```tsx
{!visited && (
  <>
    <span className={`stage-ring stage-ring-1 ${ringClass}`} />
    <span className={`stage-ring stage-ring-2 ${ringClass}`} />
    {/* stage-ring-3 removed */}
  </>
)}
```

---

## 4. ProductStage completion animation (spin/rise)

### Current state (`globals.css:226–303`)

```css
@keyframes stage-product-spin {
  35% { transform: scale(1.035); filter: drop-shadow(0 0 45px rgba(255,255,255,0.35)) brightness(1.15); }
}
@keyframes stage-product-rise {
  100% { transform: translateY(-24px) scale(1.02); filter: brightness(1.08); }
}
```

### Verdict: Replace filter animations with composited glow overlay

`filter: drop-shadow()` and `filter: brightness()` force the GPU to re-rasterise the entire layer **on every animation frame** — they cannot be composited like `transform` or `opacity`. On mid-tier phones this causes visible jank during the spin/rise.

**Replacement pattern:** A sibling `<div>` (a "glow overlay") with a radial-gradient background and `opacity: 0 → 1 → 0` animation. Opacity changes on a layer are GPU-composited. The visual result — a white bloom behind/on the product — is identical to the brightness/drop-shadow effect.

### Spec

**1. New CSS keyframes (replace existing in `globals.css:296–304`)**

```css
/* stage-product-spin — transform only, no filter */
@keyframes stage-product-spin {
  0%   { transform: scale(1); }
  35%  { transform: scale(1.035); }
  100% { transform: scale(1); }
}

/* stage-product-rise — transform only, no filter */
@keyframes stage-product-rise {
  0%   { transform: translateY(0) scale(1); }
  100% { transform: translateY(-24px) scale(1.02); }
}

/* New: composited glow for spin — opacity only */
@keyframes stage-product-spin-glow {
  0%, 100% { opacity: 0; }
  35%       { opacity: 0.35; }
}

/* New: composited glow for rise — opacity only */
@keyframes stage-product-rise-glow {
  0%   { opacity: 0; }
  100% { opacity: 0.22; }
}

.stage-spin-anim {
  animation: stage-product-spin 1.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
.stage-rise-anim {
  animation: stage-product-rise 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
}
.stage-spin-glow {
  animation: stage-product-spin-glow 1.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
.stage-rise-glow {
  animation: stage-product-rise-glow 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
}
```

**2. DOM change in `ProductStage.tsx:285–305`** — add a sibling glow div inside the breathe/spin wrapper:

```tsx
{/* Breathe / spin layer */}
<div
  ref={imageWrapperRef}
  className={
    shouldAnimateCompletion && completionTransition === 'spin'
      ? 'stage-spin-anim'
      : shouldAnimateCompletion && completionTransition === 'rise'
        ? 'stage-rise-anim'
        : 'stage-product-breathe'
  }
>
  {/* Glow overlay — composited opacity animation, replaces filter: brightness/drop-shadow */}
  {shouldAnimateCompletion && (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 rounded-full ${
        completionTransition === 'spin' ? 'stage-spin-glow' : 'stage-rise-glow'
      }`}
      style={{
        background: 'radial-gradient(ellipse 70% 70% at 50% 50%, rgba(255,255,255,0.6), transparent)',
      }}
    />
  )}
  <Image … />
</div>
```

Also remove `filter: drop-shadow(…)` from the progress arc SVG `circle` (`ProductStage.tsx:439`) — replace with a static `stroke` color change on completion (`stroke="rgb(104,91,199)"` already present) without filter.

---

## 5. Ambient background gradient (LessonFrame root)

### Current state (`globals.css:174–189`)

```css
.bg-glass-gradient {
  background: linear-gradient(-45deg, var(--background), var(--muted), var(--secondary), var(--background));
  background-size: 400% 400%;
  animation: dynamic-gradient 20s ease infinite;
}
@keyframes dynamic-gradient {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
```

Applied to `LessonFrame.tsx:62` root shell — the outermost div. **This animation runs for the entire lifetime of the player.**

### Verdict: Remove animation

`background-position` is not GPU-composited. Every tick of `dynamic-gradient` triggers a full paint of the root element — the largest surface area in the component tree. On devices where the GPU is already occupied by lesson content, parallax springs, or hotspot rings, this is a guaranteed source of dropped frames.

The visual delta is minimal: the gradient shifts across three tones (`--background` = Frost #E9EAF2, `--muted` = Pearl #F0EDE9, `--secondary` = Frost again) that are nearly identical at 97–94% lightness. At 20s per cycle, the movement is imperceptible in peripheral vision while actively looking at lesson content.

**Remove the animation. Static gradient. Zero visual regression.** The Frost→Pearl→Frost gradient is pleasant as a static base.

### Spec

```css
/* globals.css — replace .bg-glass-gradient utility */
@layer utilities {
  .bg-glass-gradient {
    background: linear-gradient(
      -45deg,
      var(--background) 0%,
      var(--muted) 50%,
      var(--background) 100%
    );
    /* dynamic-gradient animation removed — background-position is not composited */
  }
}

/* DELETE the @keyframes dynamic-gradient block entirely */
```

No changes needed in `LessonFrame.tsx` — the class name stays, the animation is just gone.

---

## 6. Discovery panel (hotspot detail slide-in)

### Current state (`DiscoveryPanel.tsx:351–366`)

**Desktop floating:**
```
transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]
open:   opacity-100 scale-100
closed: opacity-0 scale-[0.3] pointer-events-none
```

**Mobile bottom-sheet:**
```
transition-transform duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]
open:   translate-y-0
closed: translate-y-full
```

**Sidebar:**
```
transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
```

### Verdict: Tune scale origin and duration

**`scale(0.3)` is too small.** The panel grows from 30% of its final size — it reads as a "pop" rather than an "expand from the hotspot." This feels theatrical rather than spatial. `scale(0.88)` is sufficient to communicate emergence while keeping the animation readable.

**`transition-all` must be replaced.** `transition-all` applies a transition to every CSS property that could change on this element. Since the panel also responds to `opacity` changes and position changes (the `floatingStyle` is set via `style`), `transition-all` can interfere with position updates. Replace with `transition-[opacity,transform]` to scope the transition precisely.

**400ms for open is slow** — especially noticeable on a first tap. The `cubic-bezier(0.16,1,0.3,1)` ease is already a strong decelerating spring so it feels longer than the number suggests. Use asymmetric timing: 260ms to open (fast arrival), 200ms to close (quick disappearance without lingering).

**Mobile bottom-sheet is well-designed.** The `translate-y-full → translate-y-0` slide and the 400ms duration feel correct for a full-screen drawer. Only tune from 400ms → 320ms.

### Spec

**Desktop floating panel — replace `floatingClasses` string in `DiscoveryPanel.tsx:351–354`:**
```tsx
const floatingClasses = `absolute ${panelWidthClass} rounded-3xl flex flex-col
  bg-card/80 dark:bg-card/95 backdrop-blur-3xl border border-white/10
  shadow-2xl transition-[opacity,transform] ${originClass}
  ${open
    ? 'opacity-100 scale-100 duration-[260ms] ease-[cubic-bezier(0.16,1,0.3,1)]'
    : 'opacity-0 scale-[0.88] pointer-events-none duration-[200ms] ease-[cubic-bezier(0.32,0.72,0,1)]'
  }`;
```

**Mobile bottom-sheet — replace `mobileClasses` in `DiscoveryPanel.tsx:357–360`:**
```tsx
const mobileClasses = `absolute bottom-0 left-0 right-0 w-full h-[72vh] rounded-t-3xl flex flex-col
  bg-card/80 dark:bg-card/95 backdrop-blur-3xl border-t border-white/10
  shadow-2xl transition-[transform] ease-[cubic-bezier(0.16,1,0.3,1)]
  ${open
    ? 'translate-y-0 duration-[320ms]'
    : 'translate-y-full pointer-events-none duration-[200ms]'
  }`;
```

**Sidebar — tune `sidebarClasses` in `DiscoveryPanel.tsx:363–366`:**
```tsx
const sidebarClasses = `absolute top-0 right-0 bottom-0 w-[48%] flex flex-col
  bg-card/80 dark:bg-card/95 backdrop-blur-2xl border-l border-white/10
  shadow-2xl transition-[transform] ease-[cubic-bezier(0.32,0.72,0,1)]
  ${open ? 'translate-x-0 duration-[280ms]' : 'translate-x-full duration-[200ms]'}`;
```

---

## 7. CompletionBurst

### Current state (`CompletionBurst.tsx`)

- 4 rings expanding from 60px to scale(9) ≈ 540px final diameter
- 24 particles in 6 colors at 3 radii (90, 135, 180px)
- 1 radial flash overlay
- Total animation window: ~1.1s

### Verdict: Keep, minor particle reduction

The burst is contextually appropriate — it fires **once** when all hotspots are discovered, lasts 1.1s, then unmounts. In a sales training context this is a meaningful reward signal and learners expect visual celebration. The scale(9) from a 60px ring base lands at ~540px which fills most viewports — this is correct for a "all done" moment.

**Single change:** Reduce particles from 24 to 16 for mobile GPU budget (fewer draw calls). Achieve by changing the `PARTICLES` array generation in `CompletionBurst.tsx:6–16`:

```ts
// CompletionBurst.tsx:6 — reduce from 24 to 16 particles
const PARTICLES = Array.from({ length: 16 }, (_, i) => {
  const angle = (i / 16) * 2 * Math.PI;
  const dist = 90 + (i % 3) * 45;
  return {
    tx: `${(Math.cos(angle) * dist).toFixed(1)}px`,
    ty: `${(Math.sin(angle) * dist).toFixed(1)}px`,
    color: COLORS[i % COLORS.length],
    delay: `${((i % 8) * 0.018).toFixed(3)}s`,
    size: i % 5 === 0 ? 9 : 5,
  };
});
```

Ring delays tightened for a crisper cascade (not required but improve feel):
```tsx
{/* burst-ring delays: 0s → 0.08s → 0.18s → 0.30s */}
<div className="burst-ring burst-ring-sky" />
<div className="burst-ring burst-ring-emerald" style={{ animationDelay: '0.08s' }} />
<div className="burst-ring burst-ring-white"   style={{ animationDelay: '0.18s' }} />
<div className="burst-ring burst-ring-amber"   style={{ animationDelay: '0.30s' }} />
```

---

## 8. Interaction micro-feedback

### 8a. Hotspot button (`Hotspot.tsx:128–139`)

**Current:**
```tsx
whileHover={{ scale: 1.15 }}
whileTap={{ scale: 0.9 }}
transition={{ type: "spring", stiffness: 400, damping: 17 }}
```

**Issues:**
- `scale(1.15)` on a 24px dot = effective 27.6px — 15% larger is noticeable but pushes against adjacent content. On mobile, hover doesn't apply; on desktop this reads as slightly overdone.
- `damping: 17` is low for `stiffness: 400` — the ratio (17/√400 ≈ 0.85) produces underdamped oscillation. The dot visibly bounces past its target on hover. In a precision tool, spring overshoot on micro-buttons reads as imprecision.

**Spec:**
```tsx
whileHover={{ scale: 1.1 }}   // 10% vs 15% — still clearly interactive
whileTap={{ scale: 0.9 }}     // keep — solid tactile feedback
transition={{ type: "spring", stiffness: 400, damping: 25 }}
// damping 25 is critically damped for stiffness 400 — arrives cleanly, no bounce
```

### 8b. `ChapterIntro` Begin button (`ChapterIntro.tsx:142–150`)

Already uses `stiffness: 400, damping: 25` — **no change needed.** This is the target spring preset.

### 8c. Nav bar buttons in `LessonFrame.tsx:105–121`

Chevron prev/next and LayoutGrid use `transition-all duration-150`. `transition-all` creates jank risk if layout properties shift during state changes.

**Spec:** Replace `transition-all` with `transition-[color,background-color,opacity]` on all nav buttons in `LessonFrame.tsx`. Specifically lines 105, 118, 143:
```tsx
className="… transition-[color,background-color,opacity] duration-150 …"
```

### 8d. `active:scale-[0.97]` in `NavMap.tsx:86`

Appropriate — keep as-is. `SectionRow` tap feedback is subtle and correct.

### 8e. Visited halo in `Hotspot.tsx:153–158`

```tsx
<motion.span 
  initial={{ opacity: 0, scale: 0.8 }}
  animate={{ opacity: 1, scale: 1 }}
  className="bg-accent/20 … blur-sm" 
/>
```

`blur-sm` (4px blur) on a `motion.span` that animates forces GPU rasterisation. Since this element persists (it's conditional on `visited`, not a one-shot animation), the blur layer stays live.

**Spec:** Remove `blur-sm` from the visited halo. The `bg-accent/20` with `-inset-1.5` padding already creates a softened glow halo visually. The blur is redundant and costly.

---

## 9. Mobile considerations

### Touch target size

**Current:** The `motion.button` in `Hotspot.tsx:129–139` has no minimum touch target size. The rendered dot is `h-6 w-6` = 24×24px. WCAG 2.2 SC 2.5.8 (AA) requires either a 24×24px target size OR ≥24px spacing between targets. Multiple hotspots in close proximity may fail this criterion.

**Spec:** Add `min-h-11 min-w-11` (44×44px) to the `motion.button` to meet the WCAG 2.5.5 AAA target size without changing visual size. The button background is transparent so only the 24px dot is visually present, but the tap area is 44px:

```tsx
// Hotspot.tsx:134 — add min-h-11 min-w-11 to className
className={`group focus-visible:ring-accent absolute z-10 -translate-x-1/2 -translate-y-1/2
  min-h-11 min-w-11 flex items-center justify-center
  focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none
  ${className}`}
```

### Hotspot ring visibility on small screens

Stage rings extend from `inset: -5px` to `scale(2.2)` after the tuning in §3. At a 24px dot (12px radius), the ring starts at ~34px diameter and expands to ~75px. On a 320px wide screen with 5 hotspots, ring overlap is possible. The **ring must not receive pointer events** — `pointer-events: none` is already set on `.stage-ring`. No change needed; just confirm this is preserved.

### ProductStage entrance on mobile

The 0.65s `stage-enter-product` entrance (§2) is fine for mid-range Android. The `filter: blur` removal in §2 is the critical mobile fix — blur is the most expensive property removed.

### Parallax on mobile

`DeviceOrientation` parallax in `ProductStage.tsx:202–219` uses a low-pass filter (`0.82 + rawX * 0.18`) and feeds Framer Motion springs. This is appropriate and requires no change. The parallax layer is independent of the hotspot layer.

### DiscoveryPanel bottom-sheet

The 72vh bottom-sheet on mobile (§6) is sized correctly. The swipe-down-to-close gesture (`swipeTouchStartY + 80px` threshold) is well-calibrated. The 320ms open duration from §6 will feel snappier on mobile without sacrificing legibility.

---

## Performance summary for TASK-0009 implementer

| Change | Layer affected | Expected gain |
|--------|---------------|---------------|
| Remove `filter: blur(8px)` from stage-enter | ProductStage entrance | Eliminates per-frame rasterize during 0.65s entrance |
| Remove `dynamic-gradient` animation | Root LessonFrame div | Eliminates continuous background-position paint |
| Replace `filter: drop-shadow / brightness` in spin/rise | ProductStage completion | Eliminates per-frame rasterize during 1.2–1.4s completion |
| Remove `blur-sm` from visited halo | Hotspot (persistent) | Eliminates rasterize layer that stays live per visited hotspot |
| `transition-all` → `transition-[opacity,transform]` on DiscoveryPanel | Panel | Eliminates accidental property transitions |
| Reduce hotspot rings 3→2, slower cycle | Hotspot (all unvisited) | Reduces concurrent CSS animations by ~33% on multi-hotspot stages |
| Reduce particles 24→16 in CompletionBurst | One-shot burst | Reduces draw calls on peak celebration frame |

All remaining animations (`transform`, `opacity`, spring motion values) are GPU-composited and require no changes for performance.

---

## Checklist

- [x] `docs/tasks/TASK-0008-design-spec.md` written with all 9 sections  
- [x] Each section contains exact values (duration, easing, property names)  
- [x] Performance-problematic animations flagged with replacement specs  
- [x] Mobile notes included (touch target, ring scale, entrance, panel)  
- [x] Spec is ready to hand directly to web-engineer for TASK-0009  
