"use client";

import { memo, useEffect, useId, useRef, useState } from "react";
import type { Drawing, InkBranch } from "../lib/tree";
import { drawingTiming } from "../lib/drawing-timing";
import { useTreeExplorer, type Inspection } from "./use-tree-explorer";

type Timing = { delay: number; duration: number };
const timingAttributes = ({ delay, duration }: Timing) => ({ "data-draw-delay": delay, "data-draw-duration": duration });

// Each disconnected pen stroke needs its own normalized length. Animate their
// parent as one group, rather than creating an Animation for every needle.
function Strokes({ d }: { d: string }) {
  return d.split(/(?=M)/).filter(part => part.trim()).map((part, index) => <path key={index} d={part} pathLength={1} />);
}

function Branch({ branch, trunk, maskId, outline, foliage, detail }: {
  branch: InkBranch;
  trunk?: boolean;
  maskId: string;
  outline: Timing;
  foliage: Timing;
  detail?: Timing;
}) {
  return <g data-branch={branch.name} className={trunk ? "ink-branch ink-trunk" : "ink-branch"}>
    <path d={trunk ? branch.outline : branch.reveal} className="hit-centerline" fill="none" stroke="none" aria-hidden="true" />
    {branch.reveal ? <>
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" {...branch.revealBounds} style={{ maskType: "alpha" }}>
          <path d={branch.reveal} pathLength={1} fill="none" stroke="white" strokeWidth={trunk ? 66 : 14} strokeLinecap="round" className="draw-stroke" {...timingAttributes(outline)} />
        </mask>
      </defs>
      <g className="ink-core" mask={`url(#${maskId})`}>
        <path d={branch.outline} className="branch-outline" />
        <path d={branch.detail} className="branch-detail" />
      </g>
    </> : <>
      <path d={branch.outline} pathLength={1} className="branch-outline draw-stroke" {...timingAttributes(outline)} />
      <g className="branch-detail draw-stroke" {...timingAttributes(detail!)}><Strokes d={branch.detail} /></g>
    </>}
    <g className="branch-foliage draw-stroke" {...timingAttributes(foliage)}><Strokes d={branch.foliage} /></g>
  </g>;
}

export const InkDrawing = memo(function InkDrawing({ drawing, defaultBranch, onInspect }: { drawing: Drawing; defaultBranch: string; onInspect: (inspection: Inspection) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const sceneRef = useRef<SVGGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const id = useId();
  const timing = drawingTiming(drawing.kind === "cactus" ? "cactus" : "pine", drawing.limbs.length);
  useTreeExplorer(svgRef, sceneRef, wrapperRef, drawing, onInspect);

  useEffect(() => {
    const svg = svgRef.current!;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animations: Animation[] = [];
    let disposed = false;
    const complete = () => {
      if (disposed) return;
      svg.dataset.drawingState = "complete";
      for (const animation of animations) animation.cancel();
      setReady(true);
    };
    const onMotionChange = () => { if (motion.matches) complete(); };
    motion.addEventListener("change", onMotionChange);

    if (motion.matches || typeof svg.animate !== "function") {
      complete();
    } else {
      svg.dataset.drawingState = "drawing";
      const startTime = document.timeline.currentTime;
      for (const element of svg.querySelectorAll<SVGElement>("[data-draw-delay]")) {
        const animation = element.animate(
          [{ strokeDashoffset: 1, visibility: "visible" }, { strokeDashoffset: 0, visibility: "visible" }],
          { delay: Number(element.dataset.drawDelay), duration: Number(element.dataset.drawDuration), easing: "linear", fill: "forwards" },
        );
        // A shared clock keeps foliage behind its limb, even for dense specimens.
        if (typeof startTime === "number") animation.startTime = startTime;
        animations.push(animation);
      }
      void Promise.all(animations.map(animation => animation.finished)).then(complete, () => {
        // Cancellation on replay/unmount is expected; a live failure falls back
        // to the complete illustration instead of leaving a partial drawing.
        if (!disposed) complete();
      });
    }

    return () => {
      disposed = true;
      motion.removeEventListener("change", onMotionChange);
      for (const animation of animations) animation.cancel();
    };
  }, [drawing]);

  return <div className="tree-explorer" ref={wrapperRef}>
    <div className="viewport-controls" role="group" aria-label="Tree view controls"><button type="button" data-viewport-action="out" aria-label="Zoom out" disabled={!ready}>−</button><span className="zoom-value" aria-hidden="true">100%</span><button type="button" data-viewport-action="in" aria-label="Zoom in" disabled={!ready}>+</button><button type="button" data-viewport-action="fit" disabled={!ready}>Fit tree</button></div>
    <svg ref={svgRef} className={`tree-illustration explorable ${drawing.kind}`} data-drawing-state="pending" viewBox="60 70 680 780" role="group" aria-busy={!ready} tabIndex={ready ? 0 : -1} aria-label="Explore repository branches" aria-describedby={`${id}-description ${id}-instructions`}>
    <title id={`${id}-title`}>{drawing.kind === "cactus" ? "Single upright cactus" : "Pine-inspired ink tree"}</title>
    <desc id={`${id}-description`}>{defaultBranch} is the {drawing.kind === "cactus" ? "cactus body" : `trunk, with ${drawing.limbs.length} primary limbs for the other branches`}. All dimensions are artistic choices.</desc>
    <g ref={sceneRef} className="drawing-content">
    {drawing.limbs.map((branch, index) => <Branch key={branch.name} branch={branch} maskId={`${id}-limb-${index}`} outline={timing.limbs[index].outline} foliage={timing.limbs[index].foliage} />)}
    {drawing.trunk && <Branch branch={drawing.trunk} trunk maskId={`${id}-trunk`} outline={timing.trunk} detail={timing.detail} foliage={timing.crown} />}
    <g className="ground draw-stroke" {...timingAttributes(timing.ground)}><Strokes d={drawing.ground} /></g>
    </g>
    </svg>
    <p id={`${id}-instructions`} className="sr-only">Arrow keys inspect branches. Shift and arrow keys pan. Plus and minus zoom. Home fits the tree. Escape clears inspection. Tab leaves the tree.</p>
    <p className="viewport-hint" role="status">{ready ? <>Drag to move <span>·</span> Scroll or pinch to zoom</> : "Drawing your branches…"}</p>
  </div>;
});
