import assert from "node:assert/strict";
import { test } from "node:test";
import { canMountTree, canSubmit, initialFlow, reduceFlow, type Flow, type FlowEvent } from "../lib/reveal-flow.ts";
import type { RepositoryResult } from "../lib/repository-url.ts";

const result = (name: string): RepositoryResult => ({ repository: { id: name.length, name, defaultBranch: "main", branches: ["main", "dev"] }, fetchedAt: "2026-10-01T00:00:00.000Z", cached: false });
const run = (...events: FlowEvent[]) => events.reduce<Flow>(reduceFlow, initialFlow);
const loadedName = (flow: Flow) => flow.phase.status === "ready" ? flow.phase.result.repository.name : null;

test("the tree mounts only after both the fade and the response, in either order", () => {
  const responseFirst = [reduceFlow(initialFlow, { type: "submit", request: 1, reducedMotion: false })];
  responseFirst.push(reduceFlow(responseFirst[0], { type: "loaded", request: 1, result: result("a/fast") }));
  responseFirst.push(reduceFlow(responseFirst[1], { type: "fadeEnd" }));
  assert.deepEqual(responseFirst.map(canMountTree), [false, false, true]);
  assert.equal(responseFirst[1].view, "leaving");

  const fadeFirst = [reduceFlow(initialFlow, { type: "submit", request: 1, reducedMotion: false })];
  fadeFirst.push(reduceFlow(fadeFirst[0], { type: "fadeEnd" }));
  fadeFirst.push(reduceFlow(fadeFirst[1], { type: "loaded", request: 1, result: result("a/slow") }));
  assert.deepEqual(fadeFirst.map(canMountTree), [false, false, true]);
  assert.equal(fadeFirst[1].view, "stage");
  assert.equal(fadeFirst[1].phase.status, "loading");
});

test("reduced motion skips the fade but still waits for the response", () => {
  const submitted = run({ type: "submit", request: 1, reducedMotion: true });
  assert.equal(submitted.view, "stage");
  assert.equal(canMountTree(submitted), false);
  assert.equal(canMountTree(reduceFlow(submitted, { type: "loaded", request: 1, result: result("a/still") })), true);
});

test("submissions are ignored while leaving, loading or showing a result", () => {
  const leaving = run({ type: "submit", request: 1, reducedMotion: false });
  assert.equal(canSubmit(leaving), false);
  assert.deepEqual(reduceFlow(leaving, { type: "submit", request: 2, reducedMotion: false }), leaving);
  assert.deepEqual(reduceFlow(leaving, { type: "invalid", message: "no" }), leaving);
  const shown = run({ type: "submit", request: 1, reducedMotion: false }, { type: "fadeEnd" }, { type: "loaded", request: 1, result: result("a/b") });
  assert.equal(canSubmit(shown), false);
  assert.equal(canSubmit(run({ type: "invalid", message: "no" })), true);
});

test("a late response after Back cannot restore a result", () => {
  for (const late of [{ type: "loaded", request: 1, result: result("a/late") }, { type: "failed", request: 1, message: "late failure" }] as FlowEvent[]) {
    const afterBack = run({ type: "submit", request: 1, reducedMotion: false }, { type: "fadeEnd" }, { type: "back" }, late);
    assert.deepEqual(afterBack, initialFlow);
  }
});

test("only the newest request can settle after resubmitting", () => {
  const flow = run(
    { type: "submit", request: 1, reducedMotion: false },
    { type: "back" },
    { type: "submit", request: 2, reducedMotion: false },
    { type: "loaded", request: 1, result: result("a/stale") },
    { type: "fadeEnd" },
  );
  assert.equal(flow.phase.status, "loading");
  const settled = reduceFlow(reduceFlow(flow, { type: "loaded", request: 2, result: result("a/fresh") }), { type: "failed", request: 2, message: "duplicate" });
  assert.equal(loadedName(settled), "a/fresh");
  assert.equal(canMountTree(settled), true);
});

test("a failure during the fade or the loading stage returns home with its message", () => {
  for (const events of [[], [{ type: "fadeEnd" }]] as FlowEvent[][]) {
    const flow = run({ type: "submit", request: 1, reducedMotion: false }, ...events, { type: "failed", request: 1, message: "Not found", retryAt: "2026-10-02T00:00:00.000Z" });
    assert.deepEqual(flow, { view: "home", phase: { status: "error", message: "Not found", retryAt: "2026-10-02T00:00:00.000Z" }, request: null });
    assert.equal(reduceFlow(flow, { type: "fadeEnd" }).view, "home");
    assert.equal(canSubmit(flow), true);
  }
});
