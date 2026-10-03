import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture, generateDrawing } from "../lib/tree.ts";
import { drawingTiming } from "../lib/drawing-timing.ts";

test("all fixtures preserve a one-to-one mapping, including the stress specimens", () => {
  for (const count of [0, 1, 2, 10, 100, 1000]) {
    const repo = fixture(count);
    const drawing = generateDrawing(repo);
    assert.equal(drawing.kind, count === 0 ? "empty" : count === 1 ? "cactus" : "flowering");
    assert.equal(drawing.limbs.length, Math.max(0, count - 1));
    assert.deepEqual([...(drawing.trunk ? [drawing.trunk.name] : []), ...drawing.limbs.map(branch => branch.name)].sort(), [...repo.branches].sort());
    assert.ok(!JSON.stringify(drawing).match(/NaN|Infinity/));
  }
});

test("input ordering, duplicates, display name and commit metadata do not change geometry", () => {
  const repo = fixture(100);
  const original = generateDrawing(repo);
  assert.deepEqual(generateDrawing({ ...repo, branches: [...repo.branches].reverse() }), original);
  assert.deepEqual(generateDrawing({ ...repo, branches: [...repo.branches, repo.branches[0]] }), original);
  assert.deepEqual(generateDrawing({ ...repo, name: "renamed / repository" }), original);
  const updated = { ...repo, commit: "another-commit" };
  assert.deepEqual(generateDrawing(updated), original);
  assert.deepEqual(generateDrawing(repo), original);
  assert.notDeepEqual(generateDrawing({ ...repo, id: 12345 }), original);
});

test("a missing default branch is rejected rather than inventing a trunk", () => {
  assert.throws(() => generateDrawing({ ...fixture(2), defaultBranch: "missing" }), /default branch is missing/);
});

test("painted outlines and reveal strokes fit inside bounded masks", () => {
  const points = (path: string) => [...path.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map(match => ({ x: Number(match[1]), y: Number(match[2]) }));
  for (const count of [2, 10, 100, 1000]) {
    const drawing = generateDrawing(fixture(count));
    for (const branch of [drawing.trunk!, ...drawing.limbs]) {
      const bounds = branch.revealBounds!;
      const radius = branch.revealWidth! / 2;
      assert.ok(radius > 0);
      for (const p of points(branch.outline)) {
        assert.ok(p.x >= bounds.x && p.x <= bounds.x + bounds.width);
        assert.ok(p.y >= bounds.y && p.y <= bounds.y + bounds.height);
      }
      // Straight segments interpolate between these samples, so endpoints bound the whole reveal.
      for (const p of points(branch.reveal!)) {
        assert.ok(p.x - radius >= bounds.x && p.x + radius <= bounds.x + bounds.width);
        assert.ok(p.y - radius >= bounds.y && p.y + radius <= bounds.y + bounds.height);
      }
      assert.ok(bounds.width * bounds.height < 800 * 900 / 5);
    }
  }
});

test("drawing reveals each attachment before its limb, and each limb before its foliage", () => {
  for (const count of [2, 10, 100, 1000]) {
    const timing = drawingTiming("flowering", count - 1);
    const trunkEnd = timing.trunk.delay + timing.trunk.duration;
    const crownEnd = timing.crown.delay + timing.crown.duration;
    assert.ok(timing.crown.delay >= trunkEnd);
    assert.equal(timing.limbs.length, count - 1);
    for (const limb of timing.limbs) {
      assert.ok(limb.outline.delay >= crownEnd);
      assert.ok(limb.foliage.delay >= limb.outline.delay + limb.outline.duration);
      assert.ok(limb.foliage.delay + limb.foliage.duration <= 5000);
    }
  }
  const cactus = drawingTiming("cactus", 0);
  assert.equal(cactus.limbs.length, 0);
  assert.ok(cactus.detail.delay >= cactus.trunk.delay + cactus.trunk.duration);
  assert.ok(cactus.crown.delay >= cactus.detail.delay + cactus.detail.duration);
  assert.ok(cactus.crown.delay + cactus.crown.duration <= 2000);
});
