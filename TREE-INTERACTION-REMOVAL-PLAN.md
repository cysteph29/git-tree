# Tree interaction removal plan

Status: implemented (steps 1–5). Validation results and remaining limitations are in `reports/interaction-removal-validation.md`.

## Requested changes

1. No dragging or zooming the tree.
2. No hovering over a branch to reveal its name, and remove the details section that displays it.
3. No replay drawing function.

The result is a static illustration. The tree draws once, centered and fitted exactly as it is now. Repository details then appear below it without the branch panel.

## How these features are built today

### Drag and zoom

- `app/use-tree-explorer.ts` attaches a `d3-zoom` behavior to the `<svg>`. It handles mouse dragging, wheel and trackpad pinch zooming, touch dragging and pinching, and the 50%–800% zoom limits. Its `zoom` handler writes the `transform` attribute of the `<g class="drawing-content">` scene. It also updates the percentage label and `svg.dataset.zoom`.
- The same behavior also applies the initial **fit transform**. A scale and translation computed from `scene.getBBox()` centers the drawing at 84% of the stage. With zoom removed, the fit still has to be applied some other way.
- Keyboard bindings in the same hook: Shift+arrows pan, `+`/`=`/`-` zoom, and `Home`/`0` fit. `ensureVisible` pans a branch into view when it is selected with the keyboard.
- `app/ink-drawing.tsx` renders the `.viewport-controls` group (−, percentage, +, Fit tree) and the `.viewport-hint` line ("Drag to move · Scroll or pinch to zoom"). Before the drawing finishes, that same element shows "Drawing your branches…".
- `app/globals.css` contains `.viewport-controls*`, `.zoom-value`, `.viewport-hint*` and the `.result-stage` positioning overrides for them. `.tree-illustration.explorable` sets `touch-action: none` and the `grab` cursor, and `[data-panning]` sets the `grabbing` cursor. `touch-action: none` also blocks page scrolling for touches that start on the tree on phones.
- `package.json` lists `d3-zoom`, `d3-selection` and their `@types` packages. They are used only by this hook.

### Hover inspection and the branch panel

- In `app/use-tree-explorer.ts`, each `[data-branch]` group is turned into a hit model. The points come from `hitPoints` (precomputed in `lib/tree.ts`) or are sampled from the invisible `.hit-centerline` path. Mouse `pointermove` calls `pickBranch` from `lib/hit-testing.ts`. Touch and pen taps (`pointerdown`/`pointerup` with movement under 6 px) pin a branch. `pointerleave` clears it.
- Keyboard inspection uses the same `inspect()` function. On focus, the first branch is selected. Arrow keys, `Home` and `End` move through branches, and `Escape` and blur clear the selection.
- `inspect()` toggles `.is-inspected` on the branch (heavier ink in CSS), sets `data-inspected-branch` and `data-inspection-source`, and calls `onInspect`.
- `app/page.tsx` stores the result in `inspection` state. It renders the `.branch-inspector` panel ("A CLOSER LOOK" / "GIT BRANCH" / "DEFAULT BRANCH", the branch name, "Hover or tap a branch…", "Keyboard: focus the tree…"), plus an `aria-live` region announcing keyboard selections.
- The `<svg>` is focusable (`tabIndex`), has `role="group"`, the label "Explore repository branches" and screen-reader instructions describing the keys.

Touch-tap and keyboard inspection have no visible purpose once the panel is gone, so this plan removes all branch inspection, not just mouse hover. The consequence is that individual branch names are no longer discoverable from the illustration, including by screen-reader users. The details still list the total branches, the default branch and the primary limb count.

### Replay

- `app/page.tsx` keeps a `replay` counter. It is reset in `goHome` and `submit` and included in the `InkDrawing` key (`${repository.id}:${replay}`). The "↻ Replay drawing" button increments it, which remounts the drawing and restarts the animation.
- `app/globals.css` has `.replay-button` styles.
- A comment in `app/ink-drawing.tsx` mentions cancellation on replay.

### Other dependents

- `app/lab/performance-lab.tsx` (the `/lab` page, enabled only with `TREE_PERF_LAB=1`) passes `onInspect`. It fires synthetic `pointermove` events to measure targeting, Shift+arrow and `+`/`-` keydowns to measure pan and zoom frames, and reads `data-inspected-branch` and `data-zoom`. Its table, its `Row` type and the `.lab-inspector` aside reflect those metrics.
- Tests: `tests/hit-testing.test.ts` covers `pickBranch` only. The reveal-bounds test in `tests/layout.test.ts` uses `limb.hitPoints` as its sample points.
- `lib/tree.ts` imports `boundsForPoints` and `Bounds` from `lib/hit-testing.ts` for the reveal masks, which stay. It also produces `hitPoints`, which exist only for hit testing.
- Docs: `README.md` (intro, the replay sentence, and the exploration and refinement paragraphs) and `REPO-REVEAL-PLAN.md` describe these features. The files in `reports/` are historical measurements and are left unchanged.

## Working approach

Implement one step at a time. After each step, run `npm test` and `npm run typecheck`, show the local result, and wait for feedback before starting the next step. Before writing code, read the relevant installed Next.js guides under `node_modules/next/dist/docs/`, as `AGENTS.md` requires. `AGENTS.md` currently names the previous step 6 as the milestone, so update it when this plan is approved.

## Step 1 — Remove replay

### Work

- Delete the `replay` state, both `setReplay(0)` calls and the Replay button from `app/page.tsx`.
- Key `InkDrawing` by `repository.id` only.
- Delete the `.replay-button` CSS.
- Change the `ink-drawing.tsx` comment to mention only unmount.

### Files

- `app/page.tsx`
- `app/globals.css`
- `app/ink-drawing.tsx` (comment only)

### Review checkpoint

A repository draws once with no Replay control. Back → submit again still draws the tree from the start. Details still appear after the drawing completes.

## Step 2 — Remove branch inspection and the branch panel

### Work

- In `app/page.tsx`, delete the `inspection` state, `setInspection(null)` in `goHome`, the `.branch-inspector` block, the keyboard `aria-live` paragraph and the `Inspection` import.
- In `app/ink-drawing.tsx`, remove the `onInspect` prop and the screen-reader instructions paragraph.
- In `app/use-tree-explorer.ts`, remove the hit models, `inspect()`, the pointer listeners (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`, `pointerleave`), the branch-navigation keys, `ensureVisible`, the focus and blur handlers, the zoom `start` handler that cleared inspection, and the `Inspection` type. After this step the hook contains only the zoom behavior and its keys and buttons. Step 3 removes those.
- Make the `<svg>` a static image. Remove `tabIndex`, use `role="img"`, and point `aria-labelledby` at the existing `<title>` and `<desc>`. Keep `aria-busy` while drawing.
- Delete the `.branch-inspector`, `.inspected-name`, `.inspection-idle`, `.inspection-keyboard`, `.ink-branch.is-inspected*` and `.tree-illustration:focus-visible` CSS.
- So that `/lab` keeps compiling, remove only its `onInspect` prop and inspector aside here. Step 4 updates its measurements.

### Files

- `app/page.tsx`
- `app/ink-drawing.tsx`
- `app/use-tree-explorer.ts`
- `app/globals.css`
- `app/lab/performance-lab.tsx` (minimal compile fix)

### Review checkpoint

Hovering, tapping or tabbing to the tree does nothing to branches, and no panel appears in the details. The details show the name, the facts row and the fetch information. Tab moves from Back straight to the details, with no stop on the tree. Zoom still works until Step 3.

## Step 3 — Remove drag and zoom while keeping the fitted framing

### Work

- Replace `useTreeExplorer` with a small fit-only effect in `InkDrawing`, then delete `app/use-tree-explorer.ts`. It measures `scene.getBBox()` once per drawing and sets the scene `transform` to the same translation and scale as today's `fit`: 84% of the 680 × 780 viewBox, centered at (400, 460). Use `useLayoutEffect` so the tree is never painted unfitted.
- Remove the `.viewport-controls` group and the `.viewport-hint` element. The page-level status already announces "Drawing …" to screen readers, so the visual "Drawing your branches…" text goes too. If a visible drawing message should stay, it can be kept as a standalone line instead.
- Delete the `explorable` class, `touch-action: none`, the `grab`/`grabbing` cursors, the `[data-panning]` rule, `.viewport-controls*`, `.zoom-value`, `.viewport-hint*`, and the matching `.result-stage` and mobile overrides from `app/globals.css`.
- Check that `.result-stage` padding still centers the tree. That padding was partly reserving room for the controls above and the hint below.

### Files

- `app/ink-drawing.tsx`
- `app/use-tree-explorer.ts` (deleted)
- `app/globals.css`

### Review checkpoint

The tree appears with exactly the same size and position as before at desktop, phone and short viewport sizes. Wheel, trackpad pinch, drag and keyboard input do nothing to the tree. On a phone-sized viewport, a swipe that starts on the tree scrolls the page down to the details. There are no zoom controls or hints.

## Step 4 — Remove dead code and dependencies, update the lab and docs

### Work

- Delete `pickBranch`, `distanceToSegment` and `HitBranch` from `lib/hit-testing.ts`. Move the still-needed `Point`, `Bounds` and `boundsForPoints` into a file named for what they do, such as `lib/bounds.ts`, and update the import in `lib/tree.ts`.
- Remove `hitPoints` from `InkBranch` and from both places that set it in `lib/tree.ts`. Remove the invisible `.hit-centerline` path from each branch in `app/ink-drawing.tsx`, which removes one SVG node per branch. Keep `data-branch`, because the lab counts it.
- Delete `tests/hit-testing.test.ts`. Rewrite the reveal-bounds assertion in `tests/layout.test.ts` to sample each limb's curve from its `reveal` path (`M … C …`) instead of `hitPoints`.
- Uninstall `d3-zoom`, `d3-selection`, `@types/d3-zoom` and `@types/d3-selection`, and commit the updated `package-lock.json`.
- In `app/lab/performance-lab.tsx`, drop the targeting probes and the pan and zoom loops. Also remove the `pointerHandlerP95Ms`, `panFrameP95Ms`, `zoomFrameP95Ms`, `targetMatches`, `targetProbes` and `zoomBoundsCorrect` fields and their table columns, and update the explanatory text. Keep the drawing, frame, long-task, geometry and completion checks. Remove `.lab-inspector` from `performance-lab.css` and adjust `.lab-workbench` if it assumed the aside.
- Update `README.md`: the intro ("with branch exploration"), the replay sentence, the exploration paragraph, the keyboard and pan/zoom paragraph, and the refinement paragraph's references to hit testing and zoom. Mark the earlier references in `REPO-REVEAL-PLAN.md` as superseded by this plan rather than rewriting its history.

### Files

- `lib/hit-testing.ts` → `lib/bounds.ts`
- `lib/tree.ts`
- `app/ink-drawing.tsx`
- `tests/hit-testing.test.ts` (deleted), `tests/layout.test.ts`
- `package.json`, `package-lock.json`
- `app/lab/performance-lab.tsx`, `app/lab/performance-lab.css`
- `README.md`, `REPO-REVEAL-PLAN.md`

### Review checkpoint

`rg -i "zoom|pickBranch|hitPoints|inspect|replay|d3-"` finds no remaining application code. Tests and typecheck pass. `/lab` (with `TREE_PERF_LAB=1`) runs to completion with the reduced metric set. Removing `hitPoints` does not change `outline`, `detail`, `foliage`, `reveal` or `revealBounds`, so the rendered illustration is unchanged.

## Step 5 — Acceptance checks and local result

### Work

- Run `npm test`, `npm run typecheck` and `npm run build`.
- In the browser, check desktop, a 390 px phone width and a short viewport. Confirm the home view, the fade and loading sequence, a pine repository, a single-branch cactus, an empty repository, details reveal timing, Back and re-submit cycles, reduced-motion mode and the absence of horizontal overflow.
- Confirm that no interaction changes the tree. Test wheel, pinch, drag, hover, tap, Tab and keys.
- Record results and any limitations in `reports/interaction-removal-validation.md`. Start the local site and present the result.

### Review checkpoint

The tree draws once as a static, centered illustration with details below. There is no drag or zoom, no branch-name inspection or panel, and no replay. All checks pass.

## Scope

This plan only removes these features. It does not redesign the details section, add another way to list branch names, or change the tree layout, drawing animation, data fetching or caching.
