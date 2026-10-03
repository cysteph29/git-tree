# Viewport fit validation

Checked 2026-10-03 against the final layout in Chrome, using device emulation against the dev server on port 3000. `npm test` (24 pass), `npm run typecheck`, and `npm run build` all pass. The dev server still responds after the build.

The pine, cactus, empty, and long-name cases used an in-page stand-in for `/api/repository`, so no GitHub requests were made. The page still validated the response and ran the real drawing. A 2-branch pine fills the same SVG frame as a denser one; the 981-branch `facebook/react` tree was measured on these same layout rules in Steps 2 and 3.

## Viewport matrix

One 2-branch pine was loaded at 1440 × 900, then the window was resized. The same SVG element stayed mounted and `complete` at every size. "Fits" means the document is no larger than the viewport.

| Viewport | Layout | Fits | Ink inside the SVG | Details fully visible |
| --- | --- | --- | --- | --- |
| 1440 × 900 | stacked | Yes | Yes | Yes |
| 1366 × 768 | stacked | Yes | Yes | Yes |
| 390 × 844 | stacked | Yes | Yes | Yes |
| 375 × 667 | stacked | Yes | Yes | Yes |
| 320 × 568 | stacked | Yes | Yes | Yes |
| 844 × 390 | side by side | Yes | Yes | Yes |
| 667 × 375 | side by side | Yes | Yes | Yes |
| 1280 × 600 | side by side | Yes | Yes | Yes |
| 720 × 450 (200% of 1440 × 900) | side by side | Yes | Yes | Yes |
| 360 × 225 (400% of 1440 × 900) | stacked | Scrolls to 384px | Yes | Reachable; overflow stays visible |

At 1440 × 900 the tree's bounds while drawing were `[122, 651, 632, 808]`, the same after the details faded in. Resizing from 390 × 844 to 844 × 390 while five strokes were animating kept that same SVG; the drawing finished instead of starting over.

## Cases

- **Cactus** (1 branch) at 390 × 844: fits, ink inside the SVG, and the tree bounds are identical before and after the details appear. One branch, default branch shown.
- **Empty** at 390 × 844, 1440 × 900, and 844 × 390: "Not yet rooted." with the details immediately, 0 branches, default branch "—". Fits, including side by side. Status: "acme/empty has no branches. Repository details follow."
- **Long names** at 320 × 568 and 844 × 390: the repository name, path, and default branch wrap, and the document does not overflow in either direction.
- **Validation** at 320 × 568: an invalid URL shows the error, keeps focus in the input, and fits.
- **Home** at 1440 × 900: fits. Back returns there with the input focused and no tree left behind. The following submit mounts a single tree.
- **Loading:** with a delayed response, "Gathering branches…" shows before the tree. Back is focused when the result opens.
- **Reduced motion:** the details transition is `0s`, the tree mounts already complete with no animations, and it fits at 1440 × 900.

## Limitations

- No physical phone, so the address bar showing and hiding and real notch insets were not exercised. The viewport meta includes `viewport-fit=cover`, and the result padding uses `env(safe-area-inset-*)`.
- Enlarged text was checked by shrinking the CSS viewport (720 × 450 and 360 × 225), which is what 200% and 400% zoom do. The browser's default font-size setting was not changed; sizes are in pixels.
- Cactus, empty, and long-name results came from the stand-in response, not a live repository.
