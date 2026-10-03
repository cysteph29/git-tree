# Repository entry and tree reveal plan

Status: implemented (steps 1–6). Validation results and remaining limitations are in `reports/repo-reveal-validation.md`.

Superseded in part by `TREE-INTERACTION-REMOVAL-PLAN.md`: replay, zoom and fit controls, panning, and branch inspection (including the branch inspector in the details) have since been removed. The references to them below are kept as a record of this plan.

## Intended experience

1. On page load, show the heading **What does your repo look like** with a repository URL input directly below it, centered on the screen.
2. On Enter, fade the heading and input away together.
3. Once repository data is available and the fade has finished, start the existing tree animation in the center of the screen.
4. Show repository details below the tree.
5. Place a Back button above and to the left of the tree. It returns the user to the home view.

Keep the existing paper background, typography, and ink artwork. This is a new page-flow change following the previous final-polish milestone.

## Differences from the current site

| Area | Current implementation | Planned implementation |
| --- | --- | --- |
| Initial view | Header, empty illustration panel, placeholder details, and form below | Centered heading and input |
| Submission | Enter submits; the form stays visible during loading | Enter starts fetching and fades the heading/input out |
| Illustration | Left column of a bordered specimen panel | Centered in the viewport |
| Repository details | Sidebar on desktop; stacked below on mobile | Below the tree at every screen size |
| Navigation | Another repository button below the panel | Back button above and left of the tree |
| Presentation | Specimen toolbar, figure labels, captions, and footer | Simplified home and result views with discreet tree controls |

## Working approach

Implement one agreed step at a time. After each step, show the running local result and stop for feedback before beginning the next step. The checkpoints below describe what should be reviewable at each stage; intermediate stages do not need to have the final transition sequence yet.

Before writing application code, read the relevant installed Next.js guides under `node_modules/next/dist/docs/`, as required by `AGENTS.md`.

## Step 1 — Create the minimal home view

### Work

- Replace the initial specimen panel and placeholder details with a centered entry view.
- Use the exact heading: `What does your repo look like`.
- Place a single URL input directly beneath the heading, with an accessible label and repository URL placeholder.
- Keep native form submission so Enter works, including the mobile keyboard submit action.
- Retain existing URL validation and fetch behavior. For this intermediate step, successful submission can still show the current result layout.
- Keep validation messages near the input and hide the current decorative header/footer from the home view.

### Files

- `app/page.tsx`
- `app/globals.css`

### Review checkpoint

The first screen shows the heading and input at desktop and mobile sizes. Invalid input displays an understandable error. A valid repository still loads successfully.

## Step 2 — Center the result and move details below it

### Work

- Replace the desktop tree/sidebar arrangement with a single-column result view.
- Give the illustration a viewport-aware stage so the tree is centered horizontally and vertically in the initial screen area.
- Put repository details after that stage in normal document flow, so they do not shift the tree away from the screen center.
- Move repository name, total branches, default branch, primary limb count, branch inspector, and fetch information below the tree.
- Remove specimen-table borders and decorative figure labels/captions from the result presentation.
- Keep replay, zoom, and fit controls usable and visually secondary.
- Preserve the current return control until its replacement is implemented in Step 3.

### Files

- `app/page.tsx`
- `app/globals.css`
- `app/ink-drawing.tsx` only if control placement needs adjustment

### Review checkpoint

A loaded repository draws in the center of the screen, with details underneath on desktop and mobile. Long names fit, controls remain accessible, and the page has no horizontal overflow. On short screens, details can be reached by scrolling.

## Step 3 — Add Back navigation and reset behavior

### Work

- Add a Back button above and to the left of the illustration, within the result stage.
- Replace the existing Another repository control with this button.
- Return to the home view without a full-page reload; both views can remain within the existing `/` page.
- Clear the active result, branch inspection, and replay state.
- Abort any pending request and prevent stale responses from restoring a result after returning home.
- Restore the top scroll position and focus the input.
- Preserve the previous URL so it can be edited or submitted again.

### Files

- `app/page.tsx`
- `app/globals.css`

### Review checkpoint

Back returns to the simple home screen. Repeated submit → Back → submit cycles work, input focus returns correctly, and no previous branch selection leaks into the next result.

## Step 4 — Sequence the fade, loading state, and drawing

### Work

- Track the visual transition separately from request status so animation timing and network timing cannot race.
- Validate the URL before starting the exit transition.
- On valid submission, start fetching immediately and fade the heading/input together over approximately 250 ms.
- Prevent duplicate submissions while leaving or loading.
- Mount the tree only after both the exit transition and a successful fetch have completed. Its existing mount-driven drawing animation then begins visibly at the center.
- If fetching takes longer than the fade, show a small centered `Gathering branches…` status in the reserved tree stage.
- Keep Back available during the loading stage.
- On fetch failure, restore the home view with the entered URL, error message, and input focus.
- Clean up transition listeners/timers and requests when returning home or unmounting.

### Files

- `app/page.tsx`
- `app/globals.css`

### Review checkpoint

The heading and input visibly fade together, and the tree never starts drawing behind the outgoing view. Fast and slow responses both work. Failed requests recover cleanly, and Back during loading cannot be undone by a late response.

## Step 5 — Coordinate the details reveal and accessibility

### Work

- Add a drawing-completion callback to `InkDrawing` so the page can coordinate the details reveal without duplicating animation-duration calculations.
- Proposed timing: reveal repository details when the drawing finishes. Reserve their layout space to prevent movement when they appear.
- On replay, keep already-visible details in place while the tree redraws.
- Handle repositories with no branches explicitly: show the existing empty-repository message and details without waiting for a drawing callback.
- Preserve the single-branch cactus behavior.
- Respect reduced-motion preferences by skipping the fades and showing the completed drawing/details immediately once data is available.
- Announce loading and result status, manage focus when views change, and ensure hidden outgoing content cannot receive keyboard focus.
- Preserve keyboard, pointer, and touch branch exploration.

### Files

- `app/page.tsx`
- `app/ink-drawing.tsx`
- `app/globals.css`

### Review checkpoint

Details appear below the tree without a layout jump. Replay, empty repositories, and single-branch repositories behave correctly. Keyboard navigation and reduced-motion mode complete the same flow without relying on animation events that may not fire.

## Step 6 — Run acceptance checks and show the finished local flow

### Work

- Review the complete experience at desktop, narrow mobile, and short viewport sizes.
- Check initial centering, Enter submission, fade sequencing, loading feedback, result centering, details placement, and Back positioning.
- Exercise invalid URLs, fetch errors/timeouts, rapid repeated submission, and cancellation during loading.
- Verify repeated navigation, scroll restoration, long repository/branch names, replay, zoom, fit, and branch inspection.
- Check keyboard focus, status announcements, and reduced-motion behavior.
- Add focused regression coverage where needed for transition ordering and stale-response cancellation; avoid tests that merely duplicate layout implementation.
- Run `npm test`, `npm run typecheck`, and `npm run build`.
- Start the local site, present the result, and record any remaining limitations.

### Review checkpoint

The full requested interaction is demonstrable locally, required checks pass, and the user can review the final result before any further work begins.

## Reused implementation and scope

Reuse repository URL parsing, GitHub fetching, pagination, caching, deterministic tree generation, and existing drawing/exploration behavior. The main changes are page composition, transition sequencing, and a drawing-completion notification.

This plan does not include deployment, an opening-screen demo tree, branch caps/grouping, new repository data, or additional product features. Existing rendering limits for very dense repositories remain a separate concern.
