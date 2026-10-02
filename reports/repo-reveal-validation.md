# Repository reveal flow validation

Checked 2026-10-01 against the optimized production build (`next start` on port 3001) in Chrome, using CDP device emulation. Timing-sensitive cases used an in-page stand-in for `/api/repository` so fast, slow, failing and late responses could be produced on demand. One real public repository and one missing repository were loaded through the real API.

## Automated checks

- `npm test`: 29 tests pass. The 6 new tests in `tests/reveal-flow.test.ts` cover the sequencing reducer in `lib/reveal-flow.ts`: the tree mounts only after both the fade and the response (in either order), reduced motion skips the fade but still waits for data, duplicate submissions are ignored, a late success or failure after Back is discarded, only the newest request settles after resubmitting, and failures during the fade or loading stage return home with their message.
- `npm run typecheck` and `npm run build` pass.

## Layout

| Viewport | Home block center | Tree center | Back above-left of tree | Details below stage | Horizontal overflow |
| --- | --- | --- | --- | --- | --- |
| 1440 × 900 | 720, 450 (exact) | 720, 426 | Yes, level with zoom controls | Yes, title peeks above the fold | None |
| 1280 × 600 | 640, 300 (exact) | 640, 276 | Yes | Yes | None |
| 375 × 740 | 188, 370 (exact) | 187, 350 | Yes | Yes | None |
| 320 × 568 | 160, 284 (exact) | 160, 264 | Yes, no overlap with controls | Yes | None |

The stage is 56 px (48 px on phones) shorter than the viewport so the repository name hints at the details below; the tree therefore sits about 24 px above the exact vertical center. The heading is one line from desktop down to narrow tablets and two lines on phones. Long repository and branch names (80+ characters without spaces) wrap without overflow.

## Behaviour

- Invalid input (empty, free text, non-GitHub host, reserved owner, owner without repository): error shown, input focused and marked invalid, no fade, no request.
- Rate-limit response: the form fades out, then returns with the server message and its retry time; the URL is preserved.
- Network failure and 35 s timeout: home restored with the matching message and input focus. During the timeout wait the stage showed Back and “Gathering branches…”.
- Seven rapid submissions produced one request.
- Back during the loading stage, with the stand-in ignoring the abort signal and resolving later: the late response never drew a tree.
- Five submit → scroll → Back cycles: Back focused on arrival, scroll restored to 0 and the input focused with the URL kept each time; no branch inspection carried into the next result.
- Zoom in/out (50% floor), Fit (back to 100%), keyboard inspection with announcement, Escape, mouse hover, touch tap and Replay all work. Replay keeps the details in place.
- Announcements come from one persistent status element: loading → drawing → drawn with details below → cleared on Back. The fading form and the not-yet-revealed details are `inert`.
- Reduced motion: no fade, Back focused immediately, the drawing mounts complete with no running animations, details appear without transition, and failures restore the form at once.
- Real API: `DietrichGebert/ponytail` loaded 42 branches (trunk `main`, 41 limbs) in 5.1 s; a non-existent repository returned the “could not be accessed” message.

## Limitations

- The automation browser was hidden behind the editor and rendered at about one frame per second, sometimes none. Drawing durations observed there are not representative, so this report makes no animation-smoothness claims. `InkDrawing` now also completes from a timer 500 ms after the scheduled end, because `Animation.finished` only settles on a rendered frame.
- Back is not shown during the 250 ms fade itself; it appears with the loading stage.
- Physical-device touch, iOS keyboard “Go”, and a real screen-reader pass were not performed. Enter submission relies on native implicit submission of the single-field form, which automation can only trigger through `requestSubmit()`.
- Dense-repository rendering limits from `final-validation.md` are unchanged.
