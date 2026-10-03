# One-screen repository result plan

Status: planned; no implementation steps completed.

## Goal

Keep Back, the complete tree illustration, the repository title, the repository path, the total branch count, and the default branch visible within one screen at normal text size across desktop and phone layouts.

“One screen” means 100% of the viewport height, not the CSS unit `1vh` (which is 1%). Use `100dvh` with a `100vh` fallback so the page can respond to mobile browser bars.

For extremely small windows, unusually long content, or enlarged accessibility text, preserve readable content and allow scrolling if necessary. Do not hide required information or disable document scrolling to make an overflow check pass.

## Why the page currently scrolls

- In `app/globals.css`, `.result-stage` takes nearly a full viewport by itself: `max(520px, 100svh - 56px)` on desktop and `max(460px, 100svh - 48px)` on phones.
- `app/page.tsx` places `.result-details` after that stage, adding the title, repository path, branch facts, and padding below it.
- The details have generous spacing, including 80px bottom padding on desktop and 56px on phones. The mobile facts stack vertically.
- The existing SVG already fits its drawing into a fixed viewBox. The surrounding page layout needs to give that SVG an appropriate share of the screen.

## Working agreement

Implement only one agreed step at a time. After completing that step, run its checks, show the running localhost result, and stop for user feedback before starting the next step. Feedback fixes belong to the current step.

Before writing application code, read the relevant installed Next.js guides under `node_modules/next/dist/docs/`, as required by `AGENTS.md`. When implementation begins, update the current milestone in `AGENTS.md` to reference this plan and the active step.

Preserve existing uncommitted changes in `app/page.tsx` and `app/globals.css`. This plan starts from the current working tree.

Every implementation response must include:

1. **Completed step:** its number and a short explanation of the visible change.
2. **Local preview:** a working localhost link and any instructions needed to reach the result.
3. **What to look for:** a concrete checklist taken from that step's review checkpoint, including screen sizes or interactions to try.
4. **Validation:** checks actually run, their results, and any remaining limitations. Do not describe untested behavior as verified.
5. **Review pause:** explicitly say that the next step has not started and await feedback.

Do not deploy as part of this plan.

## Step 1 — Give the result a shared viewport budget

### Implementation

- Make `.result` a viewport-height layout using `100vh` as a fallback followed by `100dvh`.
- Allocate space for Back, a flexible illustration region, and content-sized repository details. A grid with a `minmax(0, 1fr)` illustration track is a suitable starting point.
- Remove the stage's independent viewport height and its desktop/mobile minimum heights.
- Give the illustration wrappers the shrinkable dimensions they need, including `min-height: 0` and `min-width: 0` where applicable. Keep the SVG contained and proportional.
- Reserve the details' space while the tree is drawing, retaining the existing delayed reveal. Once repository data is available and drawing starts, the tree should not resize when the details become visible.
- Keep Back clear of the drawing and accessible by keyboard. Account for its space explicitly rather than letting it overlap a shrunken tree.
- Establish the basic compact details spacing needed for the shared layout; fine-tune typography and phone layouts in Step 2.
- Keep the existing drawing geometry and animation behavior.

### Expected files

- `app/globals.css`
- `app/page.tsx` if layout wrappers or Back placement need adjustment
- `AGENTS.md` to record the new milestone

### Validation

- Run `npm test` and `npm run typecheck`.
- Check a normal repository at 1440 × 900 and 1366 × 768 CSS pixels.
- Check the loading-to-drawing-to-details transition and Back navigation.
- Inspect document and element bounds to confirm that the normal desktop result fits without vertical or horizontal overflow.

### What the user should look for

- At normal browser zoom, the tree, repo title, repo path, total branches, and default branch are all visible without scrolling on desktop.
- The tree is complete and proportional, with no cut-off tips or ground line.
- The tree stays the same size and position as the details fade in.
- Back stays visible and works.

Pause here for feedback before Step 2.

## Step 2 — Tune portrait layouts and readable details

### Implementation

- Adjust title size, vertical gaps, and padding responsively using bounded values. Include viewport height in the sizing decisions, not only viewport width.
- Give the tree the space left after readable details are laid out; avoid scaling the entire interface and its text as one image.
- Keep branch facts side by side where they fit. Use a compact stacked arrangement when necessary for legibility.
- Handle long repository paths and default branch names without horizontal overflow or silently dropping information.
- Include mobile safe-area spacing where applicable.
- Check home and error-state spacing for consistency with the one-screen goal; make only necessary fit adjustments.

### Expected files

- `app/globals.css`
- `app/page.tsx` only if the presentation structure requires adjustment

### Validation

- Run `npm test` and `npm run typecheck`.
- Check portrait viewports at 390 × 844, 375 × 667, and 320 × 568 CSS pixels.
- Check long repository and branch names as well as ordinary short names.
- Check the input, validation error, result, and Back flow.

### What the user should look for

- On a portrait phone, the title and branch information fit on the same screen as the tree.
- The text is comfortably readable, and the tree still has enough presence.
- There is no excessive blank space between the illustration and its details.
- Long names do not run off the side or overlap neighboring text.
- The input and error message remain usable when returning home.

Pause here for feedback before Step 3.

## Step 3 — Handle short screens and landscape phones

### Implementation

- Add a layout rule based on available height and width for short, wide screens.
- Place the illustration and details beside each other when that provides a better fit, while keeping Back in a predictable position.
- Retain the stacked layout where side-by-side content would become too narrow.
- Ensure resizing and rotating the viewport refit the SVG without restarting its animation.
- Check mobile browser-bar changes with `100dvh` and retain sufficient safe-area spacing.
- Make extreme-size and enlarged-text overflow accessible: allow scrolling when content cannot fit readably, with no clipped content or blocked controls.
- Update screen-reader status wording if it describes details as being “below the tree” when the layout can now put them beside it.

### Expected files

- `app/globals.css`
- `app/page.tsx` for layout-neutral status wording if needed
- `app/ink-drawing.tsx` only if browser verification identifies a sizing issue that cannot be addressed in the container styles

### Validation

- Run `npm test` and `npm run typecheck`.
- Check 844 × 390 and 667 × 375 landscape phone viewports, and a 1280 × 600 desktop viewport.
- Resize between portrait and landscape proportions during and after drawing.
- Check browser zoom at 200% and keyboard access to Back and the input.
- Verify browser-bar behavior on a mobile browser if one is available; otherwise record that limitation explicitly.

### What the user should look for

- Turning a phone sideways keeps the tree and repository information visible, using a side-by-side layout where appropriate.
- The tree never stretches, gets cut off, or redraws solely because the window changed size.
- Back remains easy to reach in either orientation.
- At enlarged text sizes, all content remains reachable even when scrolling is necessary.

Pause here for feedback before Step 4.

## Step 4 — Acceptance checks and final local review

### Work

- Run `npm test`, `npm run typecheck`, and `npm run build`.
- Repeat the viewport matrix from Steps 1–3 against the final layout.
- Check a multi-branch pine, a single-branch cactus, an empty repository, and long repository/default-branch names.
- Check the home screen, validation errors, loading, drawing, detail reveal, Back, re-submit, and reduced-motion mode.
- Check vertical and horizontal document overflow and the bounds of visible content. Hidden or clipped content does not count as fitting.
- Confirm resizing does not restart drawing or cause a jump when details reveal.
- Record verified results and limitations in `reports/viewport-fit-validation.md`.
- Update this plan's status and `AGENTS.md` to reflect completed work, then present the running localhost result.

### What the user should look for

- At normal text size across the tested desktop and phone sizes, no scrolling is required to see the complete tree, repo title, repo path, total branches, and default branch for ordinary content.
- The composition feels balanced in both portrait and landscape: readable details and a suitably sized tree.
- Loading and reveal transitions feel stable, with no layout jump when the details appear.
- Empty repositories, long names, and reduced motion remain clear and usable.
- Enlarged text and extreme window sizes preserve access to all information.

Pause for final feedback. Deployment is outside this plan.

## Scope boundaries

This is a responsive layout change. Preserve the static illustration, drawing sequence, delayed details reveal, repository fetching, and caching. It does not reintroduce dragging, zooming, replay, or branch inspection, and does not add an opening-screen demo, branch caps, grouping, or new product features.
