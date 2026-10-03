import { boundsForPoints, type Point } from "./bounds.ts";
import type { Drawing, InkBranch, Repository } from "./tree.ts";

type Curve = [Point, Point, Point, Point];
const point = (p: Point) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
const line = (points: Point[]) => `M ${points.map(point).join(" L ")}`;

function random(seed: string) {
  let n = 2166136261;
  for (const c of seed) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return () => { n ^= n << 13; n ^= n >>> 17; n ^= n << 5; return (n >>> 0) / 4294967296; };
}

// The same tapered, gently broken contour language as the approved Full bloom study.
function at(c: Curve, t: number): Point {
  const u = 1 - t;
  const bend = Math.sin(t * Math.PI * 4) * Math.sin(t * Math.PI) * Math.abs(c[3].y - c[0].y) * .045;
  return {
    x: u ** 3 * c[0].x + 3 * u * u * t * c[1].x + 3 * u * t * t * c[2].x + t ** 3 * c[3].x + bend,
    y: u ** 3 * c[0].y + 3 * u * u * t * c[1].y + 3 * u * t * t * c[2].y + t ** 3 * c[3].y,
  };
}

function brush(c: Curve, width: number, seed: number) {
  const left: Point[] = [], right: Point[] = [], centers: Point[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, p = at(c, t), a = at(c, Math.max(0, t - .01)), b = at(c, Math.min(1, t + .01));
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const w = (width * (1 - t) ** 1.35 + .18) * (1 + .16 * Math.sin(t * 35 + seed) + .06 * Math.sin(t * 97));
    const nx = -(b.y - a.y) / length, ny = (b.x - a.x) / length;
    left.push({ x: p.x + nx * w, y: p.y + ny * w });
    right.push({ x: p.x - nx * w, y: p.y - ny * w });
    centers.push(p);
  }
  const edges = [...left, ...right.reverse()];
  return { outline: `${line(edges)} Z`, reveal: line(centers), edges, centers };
}

function scratches(c: Curve, positions: number[]) {
  return positions.map(t => line(Array.from({ length: 5 }, (_, i) => at(c, t + i * .016)))).join(" ");
}

function blossom(x: number, y: number, radius: number, r: () => number) {
  let d = "";
  const rotation = r() * Math.PI;
  for (let i = 0; i < 5; i++) {
    const angle = rotation + i * Math.PI * 2 / 5, reach = radius * (.72 + r() * .45);
    const tip = { x: x + Math.cos(angle) * reach, y: y + Math.sin(angle) * reach };
    const a = { x: x + Math.cos(angle - .62) * reach * .8, y: y + Math.sin(angle - .62) * reach * .8 };
    const b = { x: x + Math.cos(angle + .65) * reach * .9, y: y + Math.sin(angle + .65) * reach * .9 };
    d += `M${point({ x, y })}Q${point(a)} ${point(tip)}Q${point(b)} ${point({ x, y })}Z`;
  }
  return d;
}

export function generateBrushTree(repository: Repository, names: string[]): Drawing {
  const seed = `flowering-ink-1:${repository.id}:${repository.defaultBranch}`;
  const rand = random(seed);
  const lean = (rand() - .5) * 22;
  const stem: Curve = [{ x: 286, y: 610 }, { x: 235 + lean, y: 433 }, { x: 371 + lean, y: 336 }, { x: 324 + lean, y: 114 }];
  const trunkMark = brush(stem, 13, 2);
  const trunk: InkBranch = {
    name: repository.defaultBranch, outline: trunkMark.outline,
    detail: scratches(stem, [.025, .12, .24, .37, .49, .7]), foliage: "",
    reveal: trunkMark.reveal, revealWidth: 34,
    revealBounds: boundsForPoints([...trunkMark.edges, ...trunkMark.centers], 18),
  };
  const branches = names.filter(name => name !== repository.defaultBranch);
  const limbs = branches.map((name, index): InkBranch => {
    const r = random(`${seed}:${name}`);
    const progress = branches.length === 1 ? .5 : index / (branches.length - 1);
    const start = at(stem, .29 + progress * .58 + (r() - .5) * .065);
    const side = index % 3 === 0 ? -1 : 1;
    const reach = (146 + Math.sin(progress * Math.PI) * 35 - progress * 42) * (.75 + r() * .45);
    const end = { x: start.x + side * reach, y: start.y - 52 - r() * 89 };
    const c: Curve = [start, { x: start.x + side * reach * .32, y: start.y + 16 - r() * 44 }, { x: end.x - side * reach * .4, y: end.y + 60 }, end];
    const width = (5.4 - progress * 3.2) * Math.max(.2, 1 / (1 + branches.length / 90));
    const main = brush(c, width, r() * 8);
    const marks = [main];
    // Pigment has its own seed: adding color never shifts the approved branch geometry.
    const pigment = random(`full-bloom-1:${seed}:${name}`);
    const petals = ["", "", ""];
    let centers = "";
    // Only decorative twig density decreases. Every repository limb is retained.
    const clusters = Math.max(1, Math.round(10 / (1 + branches.length / 48)));
    for (let k = 0; k < clusters; k++) {
      const root = at(c, .32 + k / clusters * .64);
      const tip = { x: root.x + side * (9 + r() * 24), y: root.y - 13 - r() * 34 };
      marks.push(brush([root, { x: root.x + side * 10, y: root.y - 4 }, { x: tip.x - side * 6, y: tip.y + 13 }, tip], .65 + r() * .55, r() * 9));
      const flowers = Math.max(1, Math.round(4 / (1 + branches.length / 160)));
      for (let f = 0; f < flowers; f++) {
        const x = tip.x + (pigment() - .5) * 26, y = tip.y + (pigment() - .5) * 24;
        petals[(k + f) % 3] += blossom(x, y, 5.4 * (.65 + pigment() * .8), pigment);
        centers += `M${point({ x: x - .7, y })}l1.3,.6m-.8,-1.4l.3,1.8 `;
      }
    }
    const revealWidth = Math.ceil(Math.max(width, 1.2) * 2.5 + 2);
    return {
      name, outline: marks.map(mark => mark.outline).join(" "),
      detail: scratches(c, [.12, .3, .5]), foliage: "",
      blossoms: { petals, centers },
      reveal: marks.map(mark => mark.reveal).join(" "), revealWidth,
      revealBounds: boundsForPoints(marks.flatMap(mark => [...mark.edges, ...mark.centers]), revealWidth / 2 + 1),
    };
  });
  return { kind: "flowering", trunk, limbs, ground: "M247,617q25,-3 42,0 M298,617l25,1 M275,623l9,-1" };
}
