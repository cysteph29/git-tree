import assert from "node:assert/strict";
import { test } from "node:test";
import { boundsForPoints, distanceToSegment, pickBranch, type HitBranch } from "../lib/hit-testing.ts";

const horizontal = (name: string, y: number): HitBranch => ({ name, points: [{ x: 0, y }, { x: 100, y }], filled: false });

test("targets the nearest branch with order-independent ties and limited hysteresis", () => {
  const branches = [horizontal("a", 0), horizontal("b", 10)];
  assert.equal(pickBranch(branches, { x: 50, y: 5 }, 1, "mouse", null), "a");
  assert.equal(pickBranch([...branches].reverse(), { x: 50, y: 5 }, 1, "mouse", null), "a");
  assert.equal(pickBranch(branches, { x: 50, y: 5.5 }, 1, "mouse", "a"), "a");
  assert.equal(pickBranch(branches, { x: 50, y: 8 }, 1, "mouse", "a"), "b");
  assert.equal(pickBranch(branches, { x: 50, y: 40 }, 1, "mouse", "b"), null);
});

test("hit tolerance stays in screen pixels across zoom levels and expands for touch", () => {
  const branch = [horizontal("limb", 0)];
  assert.equal(pickBranch(branch, { x: 50, y: 10 }, 1, "mouse", null), "limb");
  assert.equal(pickBranch(branch, { x: 50, y: 3 }, 8, "mouse", null), "limb");
  assert.equal(pickBranch(branch, { x: 50, y: 4 }, 8, "mouse", null), null);
  assert.equal(pickBranch(branch, { x: 50, y: 19 }, 1, "mouse", null), null);
  assert.equal(pickBranch(branch, { x: 50, y: 19 }, 1, "touch", null), "limb");
  assert.equal(pickBranch(branch, { x: 50, y: 40 }, 1, "touch", null), null);
  assert.equal(pickBranch(branch, { x: 50, y: 0 }, 0, "mouse", null), null);
});

test("the cactus body is targetable in its interior, without selecting distant decoration", () => {
  const cactus: HitBranch = { name: "develop", filled: true, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 200 }, { x: 0, y: 200 }, { x: 0, y: 0 }] };
  assert.equal(pickBranch([cactus], { x: 50, y: 100 }, 8, "mouse", null), "develop");
  assert.equal(pickBranch([cactus], { x: 130, y: 100 }, 1, "mouse", null), null);
  assert.equal(distanceToSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 }), 5);
  assert.equal(distanceToSegment({ x: 12, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }), 2);
});

test("nearby ink corridors retain the nearest centerline instead of alphabetical preference", () => {
  const branches = [horizontal("a-farther", 0), horizontal("z-nearer", 1)];
  assert.equal(pickBranch(branches, { x: 50, y: 1 }, 1, "mouse", null), "z-nearer");
  assert.equal(pickBranch([...branches].reverse(), { x: 50, y: 1 }, 1, "mouse", null), "z-nearer");
});

test("bounding-box pruning preserves picking at different scales, corridor edges and current targets", () => {
  const branches = [horizontal("a", 0), horizontal("b", 10), horizontal("c", 20)];
  const bounded = branches.map(branch => ({ ...branch, bounds: boundsForPoints(branch.points) }));
  for (const scale of [.1, 1, 8]) for (const pointer of ["mouse", "touch"] as const) {
    for (const x of [-30, -9, 0, 50, 100, 109, 130]) for (const y of [-30, 0, 5, 10, 18, 40]) {
      for (const current of [null, "a", "b"]) assert.equal(pickBranch(bounded, { x, y }, scale, pointer, current), pickBranch(branches, { x, y }, scale, pointer, current));
    }
  }
});
