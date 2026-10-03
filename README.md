# GitHub Tree

Public GitHub repositories become deterministic botanical ink drawings. Paste a repository home URL, a `.git` URL, or a GitHub branch/file URL. The actual default branch becomes the trunk, regardless of the branch named in the URL. One branch produces an armless cactus; no branches produces an empty state.

## Run

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3000.

The app works without a token, using GitHub's unauthenticated rate limit. For a higher allowance, copy `.env.example` to `.env.local`, set `GITHUB_TOKEN` locally, and restart the server. Prefer a token without private-repository access. Never put the token in a `NEXT_PUBLIC_` variable or commit it. No visitor sign-in is required.

## Check

```sh
npm test
npm run typecheck
npm run build
```

`lib/tree.ts` is the pure layout function. Repository ID, default-branch name, exact sorted branch names, and the layout version determine geometry. Commit metadata and viewport dimensions are not inputs. Branch-set changes can rebalance the tree. Decorative twig density decreases for crowded specimens, but no Git branches are omitted.

The flowering-tree structure uses tapered filled ink shapes, dry-brush highlights, and fine twigs. The trunk draws first, then the limbs and their twigs; muted red/pink blossom groups fade in after their supporting limbs. Decorative pigment is deterministic and does not represent commit activity. SVG masks follow the existing geometry; normalized strokes reveal individual foliage marks. The browser's Web Animations API coordinates playback without a React render loop. The cactus takes 1.77 seconds, the ten-branch tree 3.54 seconds, and the dense experiments 4.5 seconds. The drawing plays once per repository. All animations are canceled on completion, specimen changes, or unmount. Reduced-motion preferences display the complete illustration immediately, including when enabled during playback.

`GET /api/repository?url=...` validates the URL, retrieves public metadata, and follows every branch page. No partial response is rendered or cached. A fresh metadata request checks public visibility even on cache hits; another check occurs after a complete fetch. Renames are followed only within the GitHub API. Unexpected default-branch changes or duplicate pagination trigger one complete retry. This is a complete pagination pass, not an atomic historical snapshot while a repository changes.

Successful branch lists are cached for five minutes in this server process (up to 100 results and 5 MiB total). A result larger than the cache budget is still returned in full, without caching. Concurrent requests for the same normalized URL share a fetch. Multiple server instances do not share this cache. There is no branch cap or sampling. A 30-second server deadline returns a timeout instead of partial data; the client waits at most 35 seconds. Transient network/5xx errors get one bounded retry; rate limits use GitHub's retry information without immediate retries.

The Node tests exercise real parser, pagination, cache, visibility, redirect, timeout, and error-handling code with controlled GitHub responses. The 0/1/2/10/100/1,000-branch fixtures remain in layout tests; the main page uses only real GitHub data.

The tree is a static illustration. Before the first paint, the drawing is scaled to fill 84% of its frame and centered; it cannot be dragged, zoomed or inspected, and individual branch names are not shown. Screen readers announce it as one image described by its default branch and primary limb count. The details below it list the total branches, the default branch and the primary limb count.

## Performance lab

```sh
npm run measure
npm run build
TREE_PERF_LAB=1 npm run start -- --port 3002
```

Open http://127.0.0.1:3002/lab and run the desktop and narrow-canvas measurements. Keep the entire drawing visible while a run is active. The lab exercises the actual drawing code. Results include visibility checks; discard a run if the tab or canvas was hidden or the viewport changed. A narrow canvas on desktop hardware is not a physical phone test. `/lab` returns 404 unless `TREE_PERF_LAB=1` is set on the server.

`npm run measure` writes `reports/step-5-service.json` using controlled upstream responses, without GitHub traffic. It measures request sharing, cache behavior and pagination, not production capacity. The browser reports and final acceptance notes are in `reports/`.

The final refinement limits SVG reveal masks to each branch's bounds. This preserves every branch and all illustration paths. Dense trees can still overlap heavily, and with zoom removed there is no way to look closer. No cap, sampling, grouping or dense-layout policy has been imposed.

The six-step implementation ends with local validation and a reviewable app. A public deployment has not been performed. Before a broader launch, validate on physical mobile devices and decide the dense-repository experience using the recorded evidence. Multiple server instances would also need coordinated caching and upstream request limits; the current cache and request sharing are process-local. The opening-screen demo, 3D and export/share features remain deferred.
