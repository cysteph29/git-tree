import { boundsForPoints, type Bounds, type Point } from "./bounds.ts";

export type Repository = {
  id: number;
  name: string;
  defaultBranch: string;
  branches: string[];
};

export type InkBranch = { name: string; outline: string; detail: string; foliage: string; reveal?: string; revealBounds?: Bounds };
export type Drawing = {
  kind: "empty" | "cactus" | "pine";
  trunk: InkBranch | null;
  limbs: InkBranch[];
  ground: string;
};

const VERSION = "ink-study-1";
const point = (p: Point) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
const order = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

function random(seed: string) {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++) state = Math.imul(state ^ seed.charCodeAt(i), 16777619);
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function curve(a: Point, b: Point, c: Point, d: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u ** 3 * a.x + 3 * u ** 2 * t * b.x + 3 * u * t ** 2 * c.x + t ** 3 * d.x,
    y: u ** 3 * a.y + 3 * u ** 2 * t * b.y + 3 * u * t ** 2 * c.y + t ** 3 * d.y,
  };
}

export function fixture(count: number): Repository {
  const names = ["feature/quiet-mornings", "fix/loose-ends", "release/autumn", "docs/field-notes", "experiment/slow-growth", "feature/new-leaves", "chore/pruning", "fix/deep-roots", "release/spring"];
  return {
    id: 314159,
    name: "fieldnotes / evergreen",
    defaultBranch: "develop",
    branches: count === 0 ? [] : ["develop", ...Array.from({ length: count - 1 }, (_, i) => names[i] ?? `study/branch-${String(i + 1).padStart(4, "0")}`)],
  };
}

export function generateDrawing(repository: Repository): Drawing {
  const names = [...new Set(repository.branches)].sort(order);
  if (!names.length) return { kind: "empty", trunk: null, limbs: [], ground: "" };
  if (!names.includes(repository.defaultBranch)) throw new Error("The default branch is missing from the branch data.");
  const seed = `${VERSION}:${repository.id}:${repository.defaultBranch}`;
  const rand = random(seed);
  const ground = "M 337,798 Q 357,795 378,799 M 389,800 Q 414,796 439,799 M 453,797 L 468,798 M 355,806 L 365,805 M 426,807 L 447,806";

  if (names.length === 1) {
    const lean = (rand() - 0.5) * 12;
    let spines = "";
    for (let i = 0; i < 17; i++) {
      const y = 376 + i * 23 + rand() * 7;
      const x = 346 + lean * (1 - (y - 376) / 420);
      spines += `M ${x},${y} l -${5 + rand() * 5},-${6 + rand() * 5} M ${454 + lean},${y - 5} l ${4 + rand() * 5},-${7 + rand() * 5} `;
    }
    return {
      kind: "cactus", ground, limbs: [],
      trunk: {
        name: repository.defaultBranch,
        outline: `M 354,795 C 345,728 348,661 345,579 C 342,501 340,430 ${346 + lean},369 C ${350 + lean},298 ${443 + lean},300 ${451 + lean},368 C ${459 + lean},455 454,529 456,615 C 459,691 451,749 451,795`,
        detail: `M 370,790 C 362,665 373,520 ${369 + lean},384 Q ${370 + lean},343 ${386 + lean},336 M 398,792 C 405,669 390,504 ${398 + lean},350 M 432,791 C 440,648 428,521 ${432 + lean},387 Q ${432 + lean},353 ${419 + lean},341 M 382,770 l 1,-18 M 416,458 l -1,23 M 382,561 l 1,16`,
        foliage: spines,
      },
    };
  }

  const tipX = 399 + rand() * 12;
  const trunkX = (y: number) => 400 + Math.sin((800 - y) / 210) * 5 + (tipX - 400) * (800 - y) / 700;
  const trunkEdge = Array.from({ length: 65 }, (_, i) => {
    const t = i / 64;
    const y = 795 - t * 691;
    return { x: trunkX(y), y, width: 8.5 * (1 - t) ** 1.4 + 0.25 };
  });
  const trunkOutline = `M ${trunkEdge.map(p => point({ x: p.x - p.width, y: p.y })).join(" L ")} L ${[...trunkEdge].reverse().map(p => point({ x: p.x + p.width, y: p.y })).join(" L ")} M 391,795 Q 383,801 378,800 M 409,795 Q 417,801 426,798`;
  const crownX = trunkX(104);
  let bark = "";
  for (let i = 0; i < 26; i++) {
    const y = 780 - i * 22 + rand() * 10;
    const x = trunkX(y) + (rand() - 0.5) * 4;
    bark += `M ${x},${y} q ${rand() - 0.5},-${5 + rand() * 4} ${rand() - 0.5},-${10 + rand() * 10} `;
  }
  const trunk: InkBranch = {
    name: repository.defaultBranch,
    revealBounds: boundsForPoints(trunkEdge, 34),
    reveal: `M ${trunkEdge.map(p => point(p)).join(" L ")}`,
    outline: trunkOutline,
    detail: bark,
    foliage: `M ${crownX},106 l -4,20 M ${trunkX(116)},116 l 7,13 M ${trunkX(134)},134 l -7,15`,
  };
  const branches = names.filter(name => name !== repository.defaultBranch);
  const limbs = branches.map((name, index): InkBranch => {
    const r = random(`${seed}:${name}`);
    const side = index % 2 === 0 ? -1 : 1;
    const progress = branches.length === 1 ? 0.35 : index / (branches.length - 1);
    const y = branches.length === 1 ? 560 : 698 - progress * 515 + (r() - 0.5) * Math.min(24, 180 / branches.length);
    const length = (275 - progress * 205) * (0.83 + r() * 0.28);
    const start = { x: trunkX(y), y };
    const end = { x: start.x + side * length, y: y - 20 - r() * 48 };
    const control1 = { x: start.x + side * length * 0.29, y: y + 20 + r() * 18 };
    const control2 = { x: start.x + side * length * 0.73, y: end.y + 35 + r() * 17 };
    const width = 1.4 + (1 - progress) * 2.5;
    const outline = `M ${point(start)} C ${point(control1)} ${point(control2)} ${point(end)} C ${point({ x: control2.x, y: control2.y + width * 0.35 })} ${point({ x: control1.x, y: control1.y + width })} ${point({ x: start.x, y: start.y + width })}`;
    let foliage = "";
    let detail = "";
    // Decoration tapers with density; every data-bearing limb remains present.
    const clusters = Math.max(1, Math.round((5 + length / 40) / (1 + branches.length / 65)));
    for (let i = 0; i < clusters; i++) {
      const t = 0.28 + (i + r() * 0.5) / clusters * 0.70;
      const root = curve(start, control1, control2, end, t);
      const next = curve(start, control1, control2, end, Math.min(t + 0.02, 1));
      const angle = Math.atan2(next.y - root.y, next.x - root.x);
      const needleLength = (11 + r() * 15) * (0.65 + progress * 0.2);
      for (let j = 0; j < 5; j++) {
        const needleAngle = angle + (j - 2) * 0.54 + (r() - 0.5) * 0.16;
        const reach = needleLength * (0.7 + r() * 0.4);
        const tip = { x: root.x + Math.cos(needleAngle) * reach, y: root.y + Math.sin(needleAngle) * reach };
        foliage += `M ${point(root)} Q ${point({ x: (root.x + tip.x) / 2 + (r() - 0.5) * 3, y: (root.y + tip.y) / 2 - 1.5 })} ${point(tip)} `;
      }
      if (i % 3 === 0) {
        const mark = curve(start, control1, control2, end, Math.max(0, t - 0.08));
        detail += `M ${point(mark)} l ${side * 4},2 `;
      }
    }
    return { name, outline, detail, foliage, reveal: `M ${point(start)} C ${point(control1)} ${point(control2)} ${point(end)}`, revealBounds: boundsForPoints([start, control1, control2, end], 8) };
  });
  return { kind: "pine", trunk, limbs, ground };
}
