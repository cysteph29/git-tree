import type { Bounds } from "./bounds.ts";
import { generateBrushTree } from "./brush-tree.ts";

export type Repository = {
  id: number;
  name: string;
  defaultBranch: string;
  branches: string[];
};

export type InkBranch = { name: string; outline: string; detail: string; foliage: string; reveal?: string; revealBounds?: Bounds; revealWidth?: number; blossoms?: { petals: string[]; centers: string } };
export type Drawing = {
  kind: "empty" | "cactus" | "flowering";
  trunk: InkBranch | null;
  limbs: InkBranch[];
  ground: string;
};

const VERSION = "ink-study-1";
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

  return generateBrushTree(repository, names);
}
