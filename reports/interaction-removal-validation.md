# Tree interaction removal validation

Checked 2026-10-02 against the optimized production build (`next start` on port 3002) in Chrome, using CDP device emulation. `DietrichGebert/ponytail` (45 branches) was loaded through the real API. Single-branch, empty and 10- and 45-branch cases used an in-page stand-in for `/api/repository`. This covers `TREE-INTERACTION-REMOVAL-PLAN.md` steps 1–4: replay, branch inspection and the branch panel, drag and zoom, and the code, dependencies and lab metrics that supported them.

## Automated checks

- `npm test`: 24 tests pass. The 5 `pickBranch` tests were removed with `lib/hit-testing.ts`; the reveal-bounds test in `tests/layout.test.ts` now samples each limb's curve from its `reveal` path.
- `npm run typecheck` and `npm run build` pass.
- `rg -i "zoom|pickBranch|hitPoints|inspect|replay|d3-"` finds nothing in `app/`, `lib/`, `tests/`, `scripts/`, `package.json` or `package-lock.json`.
- Geometry fingerprints (`outline`, `detail`, `foliage`, `reveal`, `revealBounds`, `ground`) for the 1, 2, 10, 100 and 1,000-branch fixtures are identical before and after removing `hitPoints`.

## Layout

| Viewport | Home block center | Tree center | Back above-left of tree | Details below stage | Horizontal overflow |
| --- | --- | --- | --- | --- | --- |
| 1440 × 900 | 720, 450 | 720, 426 | Yes | Yes | None |
| 390 × 844 | 195, 422 | 195, 402 | Yes | Yes | None |
| 1280 × 560 | 640, 280 | 640, 264 | Yes | Yes | None |

The desktop tree center matches `repo-reveal-validation.md`. Before and after Step 3, `vercel/next.js` produced the same scene transform (`translate(25.37…, 35.47…) scale(0.932…)`) and the same on-screen frame and tree rectangles at all three viewports. The fit is applied in a layout effect, so the transform is present when the tree first appears.

## Behaviour

At every viewport, for the pine, the cactus and the empty repository:

- The form fades, the stage shows Back (focused) and “Gathering branches…” until data arrives, and the drawing starts once both the fade and the response are done.
- The details are revealed only after the drawing state is `complete` (pine about 4.5 s after mount, cactus about 1.8 s). The empty state reveals them immediately.
- No `.viewport-controls`, `.viewport-hint`, `.replay-button`, `.branch-inspector`, `.hit-centerline` or `.is-inspected` element exists.
- The details contain only the name, the facts row and the fetch line. Back is the only tab stop on the result page.
- The `<svg>` has `role="img"`, no `tabindex`, cannot be focused, and is named by its title and description (for example “Pine-inspired ink tree — main is the trunk, with 44 primary limbs…”).
- Mouse hover, touch tap, touch drag, mouse drag, wheel, Ctrl+wheel (trackpad pinch), arrow keys, Shift+arrows, `+`, `-`, `=`, `0`, `Home`, `End` and `Escape` leave the scene transform unchanged and mark no branch. No wheel event had its default prevented. The `<svg>` and its scene have no event listeners, `touch-action` is `auto` and the cursor is the default, so a swipe or wheel over the tree scrolls the page.
- Scrolling down and pressing Back returns home with scroll at 0, the input focused and the URL kept.

Back and re-submit:

- Back pressed 0, 250, 700, 1,500 and 2,500 ms into a drawing returned home each time with no tree left behind, details never shown, and the input focused.
- A following submission mounted one tree in the `drawing` state with the details hidden, then completed with all 10 branches and revealed the details.

Reduced motion: no fade, Back focused immediately, the tree mounts already `complete` with no running animations, and the details appear at once.

Performance lab (`TREE_PERF_LAB=1`, desktop canvas) ran to completion with the reduced metric set. Every row reported all branches present, stable geometry, no animations after completion, and a visible tab, in-view canvas and stable viewport. Removing the invisible hit path cut one SVG node per branch (14,007 → 13,007 at 1,000 branches).

## Limitations

- GitHub's unauthenticated rate limit was exhausted near the end, so `vercel/next.js` (2,728 branches) could not be reloaded through the production build. The app returned home with GitHub's message and retry time, and kept the URL. The same repository drew fully on the dev server during steps 1–3, and the lab covers 1,000-branch fixtures.
- The automation tab was intermittently throttled while the editor had focus: two runs took far longer than scheduled. Those runs were repeated and passed with normal timings. This report makes no animation-smoothness claims.
- Swiping was verified indirectly (no listeners, `touch-action: auto`, wheel not prevented) rather than with native touch scrolling. Physical-device touch and a real screen-reader pass were not performed.
- Individual branch names are no longer discoverable from the illustration, by any input or by screen readers. This is the intended consequence of the plan.
