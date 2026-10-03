import { useId } from "react";
import type { Repository } from "../../lib/tree";

// A static SVG material/silhouette study, deliberately separate from the production generator.
type Point = { x: number; y: number };
type Curve = [Point, Point, Point, Point];
type Mark = { name: string; body: string; scratches: string; twigs: string; petals: string[]; centers: string };
const xy = (p: Point) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
function random(seed: string) {
  let n = 2166136261;
  for (const c of seed) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return () => { n ^= n << 13; n ^= n >>> 17; n ^= n << 5; return (n >>> 0) / 4294967296; };
}
function at(c: Curve, t: number): Point {
  const u = 1 - t;
  const bend = Math.sin(t * Math.PI * 4) * Math.sin(t * Math.PI) * Math.abs(c[3].y - c[0].y) * .045;
  return { x: u ** 3 * c[0].x + 3 * u * u * t * c[1].x + 3 * u * t * t * c[2].x + t ** 3 * c[3].x + bend, y: u ** 3 * c[0].y + 3 * u * u * t * c[1].y + 3 * u * t * t * c[2].y + t ** 3 * c[3].y };
}
function ribbon(c: Curve, width: number, seed: number) {
  const left: Point[] = [], right: Point[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, p = at(c, t), a = at(c, Math.max(0, t - .01)), b = at(c, Math.min(1, t + .01));
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const w = (width * (1 - t) ** 1.35 + .18) * (1 + .16 * Math.sin(t * 35 + seed) + .06 * Math.sin(t * 97));
    const nx = -(b.y - a.y) / length, ny = (b.x - a.x) / length;
    left.push({ x: p.x + nx * w, y: p.y + ny * w }); right.push({ x: p.x - nx * w, y: p.y - ny * w });
  }
  return `M${left.map(xy).join("L")}L${right.reverse().map(xy).join("L")}Z`;
}
function blossom(x: number, y: number, radius: number, r: () => number) {
  let d = "";
  const rotation = r() * Math.PI;
  for (let i = 0; i < 5; i++) {
    const angle = rotation + i * Math.PI * 2 / 5, reach = radius * (.72 + r() * .45);
    const tip = { x: x + Math.cos(angle) * reach, y: y + Math.sin(angle) * reach };
    const a = { x: x + Math.cos(angle - .62) * reach * .8, y: y + Math.sin(angle - .62) * reach * .8 };
    const b = { x: x + Math.cos(angle + .65) * reach * .9, y: y + Math.sin(angle + .65) * reach * .9 };
    d += `M${x.toFixed(2)},${y.toFixed(2)}Q${xy(a)} ${xy(tip)}Q${xy(b)} ${x.toFixed(2)},${y.toFixed(2)}Z`;
  }
  return d;
}
const trunk: Curve = [{ x: 286, y: 610 }, { x: 235, y: 433 }, { x: 371, y: 336 }, { x: 324, y: 114 }];

export function studyMarks(repo: Repository, rich: boolean): Mark[] {
  const names = [...new Set(repo.branches)].sort().filter(name => name !== repo.defaultBranch);
  const count = names.length;
  return names.map((name, index) => {
    const r = random(`blossom-study:${repo.id}:${name}`);
    const progress = count === 1 ? .5 : index / (count - 1);
    const t = .29 + progress * .58 + (r() - .5) * .065;
    const start = at(trunk, t);
    const side = index % 3 === 0 ? -1 : 1;
    const reach = (146 + Math.sin(progress * Math.PI) * 35 - progress * 42) * (.75 + r() * .45);
    const end = { x: start.x + side * reach, y: start.y - 52 - r() * 89 };
    const c: Curve = [start, { x: start.x + side * reach * .32, y: start.y + 16 - r() * 44 }, { x: end.x - side * reach * .4, y: end.y + 60 }, end];
    let body = ribbon(c, (5.4 - progress * 3.2) * Math.max(.2, 1 / (1 + count / 90)), r() * 8);
    let scratches = "", twigs = "", centers = "";
    const petals = ["", "", ""];
    const clusters = Math.max(1, Math.round((rich ? 10 : 6) / (1 + count / 48)));
    for (let k = 0; k < clusters; k++) {
      const root = at(c, .32 + k / clusters * .64);
      const tip = { x: root.x + side * (9 + r() * 24), y: root.y - 13 - r() * 34 };
      const twig: Curve = [root, { x: root.x + side * 10, y: root.y - 4 }, { x: tip.x - side * 6, y: tip.y + 13 }, tip];
      twigs += ribbon(twig, .65 + r() * .55, r() * 9);
      const flowers = rich ? 4 : 2;
      for (let f = 0; f < flowers; f++) {
        const x = tip.x + (r() - .5) * 26, y = tip.y + (r() - .5) * 24;
        const radius = (rich ? 5.4 : 4.3) * (.65 + r() * .8);
        petals[(k + f) % 3] += blossom(x, y, radius, r);
        centers += `M${(x - .7).toFixed(2)},${y.toFixed(2)}l1.3,.6m-.8,-1.4l.3,1.8`;
      }
      const p = at(c, .15 + k / clusters * .5);
      scratches += `M${xy(p)}l${(side * (4 + r() * 7)).toFixed(2)},-${(1 + r() * 3).toFixed(2)} `;
    }
    return { name, body, scratches, twigs, petals, centers };
  });
}

export function FlowerStudy({ repository, rich = false, closeup = false }: { repository: Repository; rich?: boolean; closeup?: boolean }) {
  const id = useId();
  const marks = studyMarks(repository, rich);
  return <svg viewBox={closeup ? "310 190 235 210" : "40 35 550 620"} role="img" aria-labelledby={`${id}-title`} data-study-tree={rich ? "rich" : "quiet"}>
    <title id={`${id}-title`}>{`${rich ? "Full bloom" : "Quiet blossom"}: flowering-tree study with ${repository.branches.length} repository branches${closeup ? ", brushwork detail" : ""}`}</title>
    <defs>
      <filter id={`${id}-edge`} x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".12" numOctaves="2" seed="8" result="grain"/><feDisplacementMap in="SourceGraphic" in2="grain" scale=".65" xChannelSelector="R" yChannelSelector="G"/></filter>
    </defs>
    <g filter={`url(#${id}-edge)`}>
      <g fill="#30302a">
        {marks.map(mark => <g key={mark.name} data-study-branch={mark.name}><path d={mark.body}/><path d={mark.twigs} opacity=".82"/></g>)}
        <path data-study-branch={repository.defaultBranch} d={ribbon(trunk, 13, 2)} />
        <path d="M274 594Q272 611 251 616L280 610L299 614L287 599Z"/>
      </g>
      <g fill="none" stroke="#e9dfca" strokeWidth=".7" opacity=".55">
        <path d={[.025, .12, .24, .37, .49, .7].map(t => `M${xy(at(trunk, t))}L${[1, 2, 3, 4].map(i => xy(at(trunk, t + i * .016))).join("L")}`).join(" ")}/>
        {marks.map(mark => <path key={mark.name} d={mark.scratches}/>)}
      </g>
      {marks.map(mark => <g key={mark.name}>
        {mark.petals.map((d, index) => <path key={index} d={d} fill={["#a44f50", "#c47d7f", "#d7a09a"][index]} opacity={rich ? [.8, .72, .72][index] : [.76, .64, .61][index]}/>)}
        <path d={mark.centers} fill="none" stroke="#663a35" strokeWidth=".5" opacity=".8"/>
      </g>)}
    </g>
    {!closeup && <path d="M247 617q25-3 42 0m9 0 25 1m-48 5 9-1" fill="none" stroke="#706b5d" strokeWidth=".6" opacity=".5"/>}
  </svg>;
}
