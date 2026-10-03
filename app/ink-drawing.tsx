"use client";

import { memo, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { Drawing, InkBranch } from "../lib/tree";
import { drawingTiming } from "../lib/drawing-timing";

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

export const InkDrawing = memo(function InkDrawing({ drawing, defaultBranch, onComplete }: { drawing: Drawing; defaultBranch: string; onComplete?: () => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const sceneRef = useRef<SVGGElement>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const [ready, setReady] = useState(false);
  const id = useId();
  const timing = drawingTiming(drawing.kind === "cactus" ? "cactus" : "pine", drawing.limbs.length);

  // Fit the drawing to 84% of the viewBox, centered on (400, 460), before the first paint.
  useLayoutEffect(() => {
    const scene = sceneRef.current!;
    const bounds = scene.getBBox();
    const scale = Math.min(680 * 0.84 / Math.max(bounds.width, 1), 780 * 0.84 / Math.max(bounds.height, 1));
    scene.setAttribute("transform", `translate(${400 - (bounds.x + bounds.width / 2) * scale},${460 - (bounds.y + bounds.height / 2) * scale}) scale(${scale})`);
  }, [drawing]);

  useEffect(() => {
    const svg = svgRef.current!;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animations: Animation[] = [];
    let disposed = false;
    let fallback: number | undefined;
    const complete = () => {
      if (disposed || svg.dataset.drawingState === "complete") return;
      svg.dataset.drawingState = "complete";
      for (const animation of animations) animation.cancel();
      setReady(true);
      onCompleteRef.current?.();
    };
    const onMotionChange = () => { if (motion.matches) complete(); };
    motion.addEventListener("change", onMotionChange);

    if (motion.matches || typeof svg.animate !== "function") {
      complete();
    } else {
      svg.dataset.drawingState = "drawing";
      const startTime = document.timeline.currentTime;
      let end = 0;
      for (const element of svg.querySelectorAll<SVGElement>("[data-draw-delay]")) {
        end = Math.max(end, Number(element.dataset.drawDelay) + Number(element.dataset.drawDuration));
        const animation = element.animate(
          [{ strokeDashoffset: 1, visibility: "visible" }, { strokeDashoffset: 0, visibility: "visible" }],
          { delay: Number(element.dataset.drawDelay), duration: Number(element.dataset.drawDuration), easing: "linear", fill: "forwards" },
        );
        // A shared clock keeps foliage behind its limb, even for dense specimens.
        if (typeof startTime === "number") animation.startTime = startTime;
        animations.push(animation);
      }
      void Promise.all(animations.map(animation => animation.finished)).then(complete, () => {
        // Cancellation on unmount is expected; a live failure falls back
        // to the complete illustration instead of leaving a partial drawing.
        if (!disposed) complete();
      });
      // `finished` only settles on a rendered frame; paused rendering would otherwise hold back the details.
      fallback = window.setTimeout(complete, end + 500);
    }

    return () => {
      disposed = true;
      window.clearTimeout(fallback);
      motion.removeEventListener("change", onMotionChange);
      for (const animation of animations) animation.cancel();
    };
  }, [drawing]);

  return <div className="tree-explorer">
    <svg ref={svgRef} className={`tree-illustration ${drawing.kind}`} data-drawing-state="pending" viewBox="60 70 680 780" role="img" aria-busy={!ready} aria-labelledby={`${id}-title ${id}-description`}>
    <title id={`${id}-title`}>{drawing.kind === "cactus" ? "Single upright cactus" : "Pine-inspired ink tree"}</title>
    <desc id={`${id}-description`}>{defaultBranch} is the {drawing.kind === "cactus" ? "cactus body" : `trunk, with ${drawing.limbs.length} primary limbs for the other branches`}. All dimensions are artistic choices.</desc>
    <g ref={sceneRef} className="drawing-content">
    {drawing.limbs.map((branch, index) => <Branch key={branch.name} branch={branch} maskId={`${id}-limb-${index}`} outline={timing.limbs[index].outline} foliage={timing.limbs[index].foliage} />)}
    {drawing.trunk && <Branch branch={drawing.trunk} trunk maskId={`${id}-trunk`} outline={timing.trunk} detail={timing.detail} foliage={timing.crown} />}
    <g className="ground draw-stroke" {...timingAttributes(timing.ground)}><Strokes d={drawing.ground} /></g>
    </g>
    </svg>
  </div>;
});
