# Final implementation validation

Measured 2026-10-01 on an Apple M3 Mac, Node 22.14.0 and Chrome 153. The browser ran an optimized Next.js build. This is local concept validation, not a production capacity certification.

## Final changes

- Limited each SVG reveal mask to its branch's control-point bounds, with padding for the reveal stroke. Drawing paths and the one-branch/one-limb mapping remain unchanged.
- Computed pine hit-test samples directly from the existing curves. This avoids 65 browser path queries per branch during setup.
- Pruned distant hit regions with bounding boxes. Eligible overlapping limbs are ranked by their actual centerline distance, with deterministic ties and the existing two-pixel hysteresis.
- Removed the step-number prototype label, added an accessible drawing status, kept long repository names inside the details column, and increased the mobile URL-input font to avoid automatic input zoom on iOS.
- Added a server-gated performance lab and reproducible service measurements. These are developer tools, not main-page controls.

## Browser measurements

The desktop canvas was 900 px wide; the narrow canvas was 390 px wide on the same desktop hardware. Both recorded runs used a 2560 × 1318 viewport at device pixel ratio 2. The tab and entire illustration remained visible, and each case's viewport stayed stable. Inputs are synthetic. Each density was measured once per canvas; figures are diagnostic observations, not statistical guarantees.

| Branches | SVG elements | Desktop ready | Narrow ready | Desktop drawing frame p95 | Narrow drawing frame p95 | Target probes, desktop / narrow |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 54 | 1.89 s | 1.80 s | 17.7 ms | 17.6 ms | 30/30 · 30/30 |
| 2 | 75 | 2.13 s | 2.13 s | 17.5 ms | 17.6 ms | 30/30 · 30/30 |
| 10 | 462 | 3.58 s | 3.59 s | 17.4 ms | 17.4 ms | 30/30 · 30/30 |
| 100 | 2,707 | 4.59 s | 4.55 s | 33.3 ms | 33.3 ms | 30/30 · 30/30 |
| 1,000 | 14,007 | 4.86 s | 4.95 s | 449.9 ms | 2,050.7 ms | 30/30 · 30/30 |

All ten cases retained every branch, preserved path geometry through pan/zoom, obeyed the 50%–800% zoom limits, restored 100% on Fit, and had zero remaining animations after completion.

The 1,000-branch illustration still has substantial animation stalls and heavily overlapping limbs. Pan/zoom frame p95 was about 100–117 ms in these dense cases. This is not an acceptable claim of smooth support for arbitrary density. Exact-centerline targeting probes demonstrate mapping correctness, not how easily a person can distinguish crowded limbs.

The earlier exploratory desktop run took 11.27 seconds at 1,000 branches and matched 8/30 targets. The final run took 4.86 seconds and matched 30/30. Treat this as directional evidence: the initial harness did not track whether the canvas remained in view, and background activity was uncontrolled. The final narrow run still exhibited a 1.3-second long task; there is no basis to claim all stalls are fixed.

Raw evidence: `step-6-browser-desktop.json`, `step-6-browser-narrow.json`, and the exploratory `step-5-browser-desktop.json`. Exclude `firstFrameMs` from timing conclusions: the initial callback timestamp calculation could be negative. The lab now measures callback entry with `performance.now()`. Other interval and ready-time measurements use their respective consistent clocks.

## Visitor-load evidence

`step-5-service.json` exercises the real loader with synthetic GitHub responses and a fixed 20 ms upstream delay. No external requests were made by that benchmark.

| Scenario | Total upstream requests | Peak upstream concurrency |
| --- | ---: | ---: |
| Cold repository with 1, 10 or 100 branches | 3 | 1 |
| Cold repository with 1,000 branches | 12 | 1 |
| 50 simultaneous visitors, same cold 1,000-branch repository | 12 | 1 |
| 50 simultaneous visitors, same cached repository | 1 | 1 |
| 50 sequential visitors, same cached repository | 50 | 1 |
| 50 simultaneous visitors, different cold 1,000-branch repositories | 600 | 50 |

Same-repository requests share a complete fetch. A cache hit deliberately still checks public visibility with GitHub. Different repositories can consume upstream quota quickly; these figures do not establish requests per second or visitor capacity in production. Caching and request sharing are process-local.

## Decisions and limits

Keep SVG for this concept: small specimens are responsive, individual paths support the ink style, and the targeted improvements preserve the composition. Do not introduce a branch cap or silently omit data. At 100 branches the drawing already misses a consistent 60 Hz frame budget; at 1,000, both readability and rendering require a separate density decision. A future renderer experiment alone will not solve visual overlap.

Before a broad deployment, validate on physical phones, decide the dense-repository experience, and add shared caching/upstream concurrency controls if using multiple server instances or expecting substantial traffic. No public deployment, sign-in system, opening demo, 3D or export/share feature is part of this implementation.

## Automated acceptance

23 Node tests pass, covering deterministic mapping and ordering, empty/cactus/pine fixtures, safe mask bounds, animation order, targeting/tolerance/hysteresis, URL parsing, complete pagination, visibility enforcement, caching, redirects, transient failures, rate limits and timeouts. Type checking and the optimized production build pass. Real-device touch behavior and a screen-reader audit remain manual validation limits.

## App checks in Chrome

- Loaded the real public `DietrichGebert/ponytail` repository: 42 branches, `main` as the trunk and 41 primary limbs.
- Invalid external-host input produced the validation message, preserved the entered URL and returned focus to the field.
- During the real fetch, the input and submission button were disabled and a loading state was announced.
- Keyboard inspection moved from `main` to `banner-readme`; the fixed panel and live announcement reflected the branch name. Escape cleared inspection.
- Replay disabled exploration during drawing and produced exactly the same SVG path geometry after completion.
- At a 390 × 844 viewport, the page had no horizontal overflow, the tree and stacked details panel remained usable, and the URL field used a 16 px font. This was responsive emulation on desktop, not physical touch testing.
- “Another repository” restored the input and keyboard focus while retaining the previous URL. The temporary viewport override was reset after verification.

Reduced-motion behavior remains implemented through CSS and the animation preference listener; this final pass did not change the operating system preference or perform a fresh screen-reader/reduced-motion-device audit.
