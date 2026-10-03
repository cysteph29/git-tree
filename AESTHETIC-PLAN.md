# Paper, ink, and blossom — aesthetic implementation plan

Status: Step 1 visual study delivered; the user chose B, Full bloom (the second evergreen painting). Step 2 is accepted. Step 3 is accepted. Step 4 is complete and awaiting feedback; Step 5 has not started. Written 2026-10-03.

Review decision: carry forward B's fuller blossom clusters with the approved warm cream paper and dark twisting branches. The user requested minimal necessary checks and quicker review pauses; do not run an exhaustive validation matrix for each step. Step 1 passed typecheck, the 24 existing tests, and production build. Desktop artwork was inspected; phone viewport verification was interrupted and is not claimed complete.

Reference: [Tree project Pinterest board](https://in.pinterest.com/cyrilstephen808/tree-project/) ([shared link](https://pin.it/4wmRGgboC)). All six saved references were inspected visually, along with the running app and its drawing code. Suggested colors below are design proposals, not sampled values from the artwork.

## Visual direction

Build the experience around a botanical painting on pale paper: substantial dark brushwork, selective colored pigment, visible material, and generous unpainted space.

The board mixes several treatments rather than one uniform historical style. Its shared visual properties are more useful than applying a broad “Japanese” label:

| Reference | What to carry into this project |
| --- | --- |
| Orange fruit against a blue panel | A limited warm/cool pairing; irregular dark contours; color in discrete clusters; paper around the image |
| Sparse pink blossoms on cream | Large areas of exposed paper; dark twisting branches; small, soft color accents |
| Pink canopy and solitary figure | Uneven pigment clusters, a strong dark silhouette, and variation between dense and open areas; the saturation is an upper bound rather than the default |
| Red blossoms on pale paper | The strongest primary reference for tapered ink branches, irregular branching, restrained color, and asymmetry |
| Blue almond-blossom print | A useful alternate palette: cool ground, warm ivory petals, muted branch colors |
| Small tiger on textured cream | Material texture and the visual weight of a small dark subject with a restrained red accent |

The references often crop branches at the picture edge. Borrow their asymmetry and use of empty space while retaining this app's complete, visible tree and repository information.

### Approved palette direction — starting color values

| Role | Proposed color | Application |
| --- | --- | --- |
| Paper | `#F2EBDD` | Dominant page ground |
| Pale fiber / wash | `#E3D8C5` | Very low-contrast material variation |
| Ink | `#292A26` | Branch mass and primary text |
| Secondary ink | `#66645D` | Supporting text, subject to contrast checks |
| Muted blossom red | `#A7504F` | Main pigment accent |
| Dusty blossom pink | `#CC9190` | Lighter petal layers; not small text |

Keep most of the page light. Put most color in the tree, with only a small related accent in the interface. Judge colors as combinations at actual display size. Do not combine every board palette in the first implementation.

### Material and brush rules

- Paper has fine fibers and gentle tonal variation. Avoid a prominent repeating tile, dirty vignette, or moving grain.
- Paper texture sits beneath text and controls. The current `body::before` overlays the whole interface at `z-index: 10`; revise that layering deliberately.
- Branches should read as filled, tapered brush marks with thick-to-thin transitions, occasional broken edges, and controlled dry-brush gaps. Merely increasing outline thickness will retain the current pen-drawing appearance.
- Separate paper grain from pigment texture. Ink needs its own local variation; a global noise layer alone does not make a stroke look painted.
- Color gathers in irregular clusters with variation in size, spacing, opacity, and occasional overlap. Avoid identical blossom stamps or a uniform halo around every limb.
- Keep text crisp and readable. Start by evaluating the existing Instrument Serif and supporting fonts against the new illustration; choose a replacement only if the study shows a clear mismatch.
- Express the direction through material, mark-making, composition, and color. Additional motifs or decorative writing need a separate design reason.

## Current implementation and implications

- `app/globals.css` already supplies a warm light ground, a procedural noise overlay, serif headings, and muted green controls. Its color values are partly tokens and partly hardcoded.
- `lib/tree.ts` creates a deterministic pine with regularly alternating limbs, outline paths, bark marks, and needle strokes. One branch produces a cactus; zero branches produces an empty state.
- `app/ink-drawing.tsx` reveals outlines through bounded SVG masks, then reveals foliage as strokes. Filled petals and wider painted branches need explicit reveal support, not just CSS recoloring.
- `lib/drawing-timing.ts` coordinates a bounded drawing sequence. Preserve its branch-before-foliage ordering and completion behavior.
- The current viewport-fitting code uses the SVG geometry's bounds. Stroke width and filter bleed can extend beyond those bounds; visual padding must include the painted extent.
- Heavy texture filters or a separate animation for every petal would multiply cost on large repositories. Prefer reusable texture assets, bounded effects, grouped pigment layers, and deterministic variation.

Keep SVG for the data-driven drawing. If a raster paper texture is useful, make or license an original small reusable asset. The Pinterest images are references, not product backgrounds or replacement tree illustrations.

## Approved decisions and remaining study details

1. **Tree silhouette — approved:** an irregular flowering tree with twisting, tapered dark branches. Changing the silhouette is a generator change, not a theme toggle.
2. **Palette — approved:** warm cream/ivory paper, charcoal branches, and muted red/pink blossoms. Exact color values, pigment density, and paper strength will be refined in the visual study. Multiple user-selectable themes are not part of this plan.
3. **Single-branch case:** preserve the cactus by default and give it the same material treatment. If a flowering-tree direction calls for replacing it with a bare stem or sapling, agree that rule before implementation. Do not silently change the existing data representation.

## Working agreement and retained behavior

Implement one agreed step at a time. Show its local result, report the checks actually run, and pause for feedback before the next step. Feedback adjustments stay within that step.

This document proposes a new aesthetic milestone; it does not mark the viewport milestone accepted. Before application implementation begins, reconcile any outstanding viewport feedback and update `AGENTS.md` to identify the agreed active step. Preserve existing uncommitted files. Read the relevant installed Next.js guides under `node_modules/next/dist/docs/` before writing application code.

Retain public repository loading, caching, deterministic output, the actual default branch as trunk, and every Git branch's representation. Color and blossom count are decorative and must not imply commit activity or other data that the app does not fetch. Retain the one-screen result, accessible overflow at extreme sizes, Back, the drawing/reveal sequence, and reduced-motion support.

Deployment, an opening-screen demo, branch caps/grouping, tree inspection, dragging/zooming, export, and other new product features remain outside this plan.

## Step 1 — Make a small visual study and choose the direction

**Work:** Build a local-only comparison using the same specimen data for the current and proposed treatment. Show a full ordinary tree, an enlarged branch sample, paper and pigment swatches, and a small heading/input/details sample. Include desktop and phone compositions. Use renderer-compatible SVG for the branch study so the approved brushwork has a practical implementation path. The study is a development artifact, not a new opening-screen demo.

Compare a restrained ink/blossom treatment with one richer treatment, both using the approved flowering-tree silhouette and cream/charcoal/red-pink palette. Show the one-branch and crowded-case implications as small studies.

**Deliverable:** A local visual study and recorded choices for silhouette, paper strength, palette, brush character, and the single-branch case. Record baseline node counts and drawing performance using the existing lab for later comparison.

**Likely files:** A development-only study entry, reusable SVG study assets, and this plan. Inspect the existing gated `/lab` setup before choosing how to expose the study locally.

**Review checkpoint:** Does it feel like it belongs with the board? Is the paper light enough? Does the branch look brushed rather than outlined? Is the color restrained enough? Is the whole tree convincing at phone size?

**Validation:** Visual inspection at desktop and phone sizes; confirm the study is not exposed as a production feature. This step selects a direction, not production readiness.

Pause for feedback.

## Step 2 — Establish paper, palette, and surface tokens

**Work:** Apply the chosen paper treatment and consolidate UI/drawing colors into semantic variables. Separate paper texture from content so glyphs and focus outlines stay clean. Make grain static, subtle, and free of conspicuous tiling at desktop and mobile scales. Keep the current layout and tree structure for this checkpoint.

**Likely files:** `app/globals.css`; `public/textures/` only if a reusable asset is needed.

**Visible result:** Home, result, and empty states share the approved light material and palette foundation.

**Validation:** Inspect texture at actual size and enlarged zoom; check normal text contrast of at least 4.5:1, large text and essential control boundaries/focus treatment as applicable; run typecheck if component changes are needed. Check normal desktop and portrait overflow.

**Review checkpoint:** The material is perceptible without competing with content; the background stays light; text and controls remain clear.

Pause for feedback.

## Step 3 — Implement the ink branches and approved silhouette

**Work:** Implement the approved tapered branch shapes and controlled ink variation. Replace the regular pine arrangement with deterministic curved, uneven flowering-tree branches and balanced asymmetry. Keep every data-bearing limb; adjust decorative detail rather than remove branches. Use seeded visual variation that does not change on resize or re-render. Version the generator if its output changes.

Render branch bodies as painted forms and use limited bark/dry-brush marks. Adapt reveal paths, mask widths, bounds, and frame padding together so the wider marks reveal fully and do not clip. Keep the complete composition within the fitted illustration region.

**Likely files:** `lib/tree.ts`, `app/ink-drawing.tsx`, `app/globals.css`, `lib/bounds.ts` if required, and `tests/layout.test.ts`. If a drawing kind changes, update its type, accessible description, timing call sites, and lab assumptions together.

**Visible result:** The approved dark tree structure, reviewed before adding full blossom color.

**Validation:** Run existing tests and typecheck. Adapt geometry tests to meaningful new painted bounds without weakening branch mapping or determinism assertions. Inspect 1/2/10/100/1,000-branch cases for completeness, clipping, visual density, and performance. Compare the ordinary specimen to the study.

**Review checkpoint:** Thick-to-thin marks and asymmetry look intentional; low-branch specimens still look composed; dense specimens remain complete. Report density limitations honestly rather than introducing a hidden cap.

Pause for feedback.

## Step 4 — Add colored pigment and integrate its reveal

**Work:** Add the approved foliage/blossom shapes as bounded decorative clusters attached to the generated limbs. Use a limited family of irregular marks, controlled opacity overlap, and deterministic placement. Reduce decoration as branch density rises while retaining all data-bearing limbs.

Filled marks need their own reveal method; the existing stroke-dash animation will not reveal filled petals correctly. Reveal each pigment group after its supporting limb using the existing shared timeline. Avoid one animation per petal. Keep the details completion signal accurate, clean up animations, and make reduced motion show the completed painting immediately. Implement the approved single-branch treatment here if it only requires surface/color changes; structural changes belong in Step 3.

**Likely files:** `lib/tree.ts`, `app/ink-drawing.tsx`, `lib/drawing-timing.ts`, `app/globals.css`, relevant layout/timing tests.

**Visible result:** A complete colored painting that draws in a coherent order.

**Validation:** Tests and typecheck; replay through submit/Back/resubmit; toggle reduced motion during playback; resize during and after drawing; compare SVG node count, animation count, and lab frame measurements with Step 1. Verify ink/pigment bounds and details reveal timing. Simplify texture/decorative marks if measurements regress materially.

**Review checkpoint:** Color supports the dark structure, clusters avoid looking stamped, open paper remains visible, and drawing feels deliberate without prolonging the wait.

Pause for feedback.

## Step 5 — Bring the interface into the same visual language

**Work:** Tune heading hierarchy, supporting text, input, Back, separators, focus, error, loading, and empty states around the approved painting. Keep the interface visually quieter than the illustration. Preserve readable repository paths and default-branch names. Adjust spacing within the existing shared viewport budget; preserve the landscape side-by-side arrangement.

Evaluate the existing font combination in context. If replacing or loading fonts differently, read the installed Next.js font guide and verify fallback behavior and layout stability. Do not add decorative UI solely to signal a theme.

**Likely files:** `app/globals.css`, `app/page.tsx`, and `app/layout.tsx` only if fonts or metadata actually need changes.

**Visible result:** A coherent home-to-result experience using the new art direction.

**Validation:** Typecheck and relevant existing tests; keyboard navigation, input errors, loading, empty state, long names, focus visibility, text contrast, and portrait/landscape fit. Confirm no layout shift when details appear.

**Review checkpoint:** The illustration is the focal point, controls remain obvious, and all repository information is comfortable to read in one screen at normal sizes.

Pause for feedback.

## Step 6 — Final aesthetic and regression review

**Work:** Compare the completed app side by side with the selected references and approved Step 1 study. Refine only issues needed to meet the accepted direction. Remove or keep production-gated any temporary study code. Record final verification in `reports/aesthetic-validation.md` and update milestone status.

**Validation:** Run `npm test`, `npm run typecheck`, and `npm run build`. Recheck desktop 1440 × 900 and 1366 × 768; portrait 390 × 844, 375 × 667, and 320 × 568; landscape 844 × 390 and 667 × 375; short desktop 1280 × 600. Include empty, single-branch, sparse, ordinary, dense, and long-name cases. Inspect painted bounds as well as DOM bounds: a texture or stroke clipped by a filter is still a failure even if the document does not overflow.

Check reduced motion, enlarged text/zoom, resize without restarting drawing, Back/resubmit, error/loading states, and the existing performance lab. Use a physical phone if available; otherwise explicitly record that emulation does not verify device performance or mobile browser-bar behavior.

**Deliverable:** Running localhost result, concise before/after comparison, completed validation record, and any remaining limitations.

**Review checkpoint:** The paper, palette, branchwork, pigment, and UI feel like one composition, and the viewport and repository behavior still work.

Pause for final feedback. Deployment is a separate decision.

## Step 2 completion

Applied the approved warm cream paper, static grain behind content, charcoal ink, muted supporting text, and rose control accents in `app/globals.css`. Consolidated page and drawing colors into semantic variables without changing layout or drawing geometry. Checked the running desktop home and result screens, Back navigation, focus appearance, palette contrast, and diff whitespace. No broad regression suite was run for this CSS-only step. Mobile and zoom were not rechecked. Awaiting feedback before Step 3.

## Step 3 completion

Replaced the production pine with deterministic tapered ink branches adapted from the approved Full bloom study. Added irregular contours, pale dry-brush highlights, and decorative twig tips. Every repository branch remains represented; the single-branch cactus is unchanged. Masks now follow sampled branch and twig centerlines, with widths and bounds sized for the painted shapes. No expensive texture filter was added. Colored blossoms remain Step 4.

Minimal validation: typecheck and all five layout/determinism/mask/timing tests pass, including 0/1/2/10/100/1,000-branch fixtures. Visually checked a live 47-branch repository on desktop: drawing completes, the whole tree is visible, and details reveal correctly. Phone and dense-tree visual/performance checks were not repeated. No full build or service test suite was run.

## Step 4 completion

Added Full bloom pigment clusters in three muted red/pink shades with irregular petals and small dark centers. A separate deterministic pigment seed preserves Step 3 branch geometry. Decoration decreases with density; every repository limb remains. Each limb uses three combined petal paths and one center path, revealed together with a single opacity animation after the branch. Existing completion, cancellation, and reduced-motion handling includes the pigment groups. The cactus remains unchanged.

Focused validation: typecheck and five existing drawing tests pass. Re-submitted the live 47-branch repository and inspected the finished painting: all 46 limb pigment groups are visible, drawing state is complete, and repository details are revealed. No broad viewport/performance suite was repeated; reduced motion was implemented but not manually toggled in this step. Browser animation-count inspection was unavailable through the read-only browser API, so cleanup is not claimed independently measured.
