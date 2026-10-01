"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { InkDrawing } from "../ink-drawing";
import { fixture, generateDrawing, type Drawing } from "../../lib/tree";
import type { Inspection } from "../use-tree-explorer";
import "./performance-lab.css";

const frame = () => new Promise<number>(resolve => requestAnimationFrame(resolve));
const round = (n: number) => Math.round(n * 100) / 100;
const p95 = (values: number[]) => [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * .95) - 1)] ?? 0;
const fingerprint = (svg: SVGSVGElement) => [...svg.querySelectorAll("path")].map(path => path.getAttribute("d")).join("|");
type Row = { branches: number; layoutMs: number; firstFrameMs: number; readyMs: number; svgNodes: number; drawFrameP95Ms: number; drawFramesOver33Ms: number; longTasks: number | null; longestTaskMs: number | null; pointerHandlerP95Ms: number; panFrameP95Ms: number; zoomFrameP95Ms: number; targetMatches: number; targetProbes: number; allBranchesPresent: boolean; geometryStable: boolean; zoomBoundsCorrect: boolean; animationsAfterCompletion: number; tabStayedVisible: boolean; canvasStayedInView: boolean; viewportStayedStable: boolean };

export function PerformanceLab() {
  const host = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  const [specimen, setSpecimen] = useState<{ drawing: Drawing; key: number } | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [inspection, setInspection] = useState<Inspection>(null);
  const [width, setWidth] = useState<"desktop" | "narrow">("desktop");
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Ready to measure.");
  const [environment, setEnvironment] = useState<Record<string, unknown>>({});
  const inspect = useCallback((value: Inspection) => setInspection(value), []);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  async function run() {
    if (running) return;
    setRunning(true); setRows([]);
    let stayedVisible = document.visibilityState === "visible";
    const visibility = () => { if (document.visibilityState !== "visible") stayedVisible = false; };
    document.addEventListener("visibilitychange", visibility);
    setEnvironment({ measuredAt: new Date().toISOString(), userAgent: navigator.userAgent, devicePixelRatio, hardwareConcurrency: navigator.hardwareConcurrency, viewport: `${innerWidth}×${innerHeight}`, canvas: width, build: process.env.NODE_ENV, reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches, note: "Synthetic pointer/keyboard input, 30 targeting probes. Narrow canvas uses this desktop's hardware; it is not a physical mobile-device test." });
    try {
      for (const count of [1, 2, 10, 100, 1000]) {
        if (!alive.current) break;
        setStatus(`Measuring ${count.toLocaleString()} branches…`);
        setSpecimen(null); setInspection(null);
        await frame();
        let canvasStayedInView = true;
        const initialViewport = `${innerWidth},${innerHeight},${devicePixelRatio}`;
        const checkCanvas = () => {
          const rect = host.current?.querySelector("svg")?.getBoundingClientRect();
          if (rect && (rect.top < 0 || rect.left < 0 || rect.bottom > innerHeight || rect.right > innerWidth)) canvasStayedInView = false;
        };
        const gaps: number[] = [], tasks: number[] = [];
        let previous = performance.now(), firstFrameMs: number | null = null, sampling = true, raf = 0;
        const started = performance.now();
        const tick = (now: number) => {
          checkCanvas();
          if (firstFrameMs === null) firstFrameMs = performance.now() - started;
          else gaps.push(now - previous);
          previous = now;
          if (sampling && alive.current) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        const supportsTasks = PerformanceObserver.supportedEntryTypes.includes("longtask");
        const observer = supportsTasks ? new PerformanceObserver(list => tasks.push(...list.getEntries().map(entry => entry.duration))) : null;
        observer?.observe({ type: "longtask" });
        const layoutStart = performance.now();
        const drawing = generateDrawing(fixture(count));
        const layoutMs = performance.now() - layoutStart;
        setSpecimen({ drawing, key: count });
        try {
          await new Promise<void>((resolve, reject) => {
            const watch = new MutationObserver(() => {
              if (host.current?.querySelector("svg[data-drawing-state='complete']")) { clearTimeout(timeout); watch.disconnect(); resolve(); }
            });
            const timeout = setTimeout(() => { watch.disconnect(); reject(new Error(`Drawing ${count} did not finish within 20 seconds.`)); }, 20_000);
            watch.observe(host.current!, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-drawing-state"] });
          });
          await frame(); await frame();
        } finally {
          sampling = false; cancelAnimationFrame(raf); observer?.disconnect();
        }
        const readyMs = performance.now() - started;
        const svg = host.current!.querySelector<SVGSVGElement>(".tree-illustration")!;
        const scene = svg.querySelector<SVGGElement>(".drawing-content")!;
        const geometry = fingerprint(svg);
        const pointerTimes: number[] = [];
        const targets = [...svg.querySelectorAll<SVGGElement>("[data-branch]")];
        let matches = 0;
        for (let i = 0; i < 30; i++) {
          const target = targets[Math.floor(i * targets.length / 30)];
          const path = target.querySelector<SVGPathElement>(".hit-centerline")!;
          const local = path.getPointAtLength(path.getTotalLength() * .65);
          const point = new DOMPoint(local.x, local.y).matrixTransform(scene.getScreenCTM()!);
          svg.dispatchEvent(new PointerEvent("pointerleave", { pointerType: "mouse" }));
          const begin = performance.now();
          svg.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerType: "mouse", clientX: point.x, clientY: point.y }));
          pointerTimes.push(performance.now() - begin);
          if (svg.dataset.inspectedBranch === target.dataset.branch) matches++;
          await frame();
          checkCanvas();
        }
        const panFrames: number[] = [], zoomFrames: number[] = [];
        let last = await frame();
        for (let i = 0; i < 12; i++) {
          svg.dispatchEvent(new KeyboardEvent("keydown", { key: i % 2 ? "ArrowLeft" : "ArrowRight", shiftKey: true, bubbles: true, cancelable: true }));
          const next = await frame(); checkCanvas(); panFrames.push(next - last); last = next;
        }
        for (let i = 0; i < 8; i++) {
          svg.dispatchEvent(new KeyboardEvent("keydown", { key: i % 2 ? "-" : "+", bubbles: true, cancelable: true }));
          const next = await frame(); checkCanvas(); zoomFrames.push(next - last); last = next;
        }
        for (let i = 0; i < 12; i++) svg.dispatchEvent(new KeyboardEvent("keydown", { key: "+", cancelable: true }));
        const upper = Number(svg.dataset.zoom);
        for (let i = 0; i < 20; i++) svg.dispatchEvent(new KeyboardEvent("keydown", { key: "-", cancelable: true }));
        const lower = Number(svg.dataset.zoom);
        svg.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", cancelable: true }));
        const row: Row = {
          branches: count, layoutMs: round(layoutMs), firstFrameMs: round(firstFrameMs ?? 0), readyMs: round(readyMs), svgNodes: svg.querySelectorAll("*").length,
          drawFrameP95Ms: round(p95(gaps)), drawFramesOver33Ms: gaps.filter(gap => gap > 33.4).length, longTasks: supportsTasks ? tasks.length : null, longestTaskMs: supportsTasks ? round(Math.max(0, ...tasks)) : null,
          pointerHandlerP95Ms: round(p95(pointerTimes)), panFrameP95Ms: round(p95(panFrames)), zoomFrameP95Ms: round(p95(zoomFrames)), targetMatches: matches, targetProbes: 30,
          allBranchesPresent: targets.length === count, geometryStable: fingerprint(svg) === geometry, zoomBoundsCorrect: upper === 800 && lower === 50 && Number(svg.dataset.zoom) === 100,
          animationsAfterCompletion: svg.getAnimations({ subtree: true }).length, tabStayedVisible: stayedVisible && document.visibilityState === "visible", canvasStayedInView, viewportStayedStable: initialViewport === `${innerWidth},${innerHeight},${devicePixelRatio}`,
        };
        setRows(previous => [...previous, row]);
      }
      setStatus("Measurements complete. Results below include limitations and environment.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Measurement failed."); }
    finally { document.removeEventListener("visibilitychange", visibility); if (alive.current) setRunning(false); }
  }

  return <main className="performance-lab">
    <div className="lab-heading"><div><p className="eyebrow">LOCAL PERFORMANCE LAB</p><h1>Measure before changing.</h1></div><a href="/">Back to GitHub Tree ↗</a></div>
    <p>Exercises the real SVG renderer and interaction code with 1, 2, 10, 100, and 1,000 branches. Keep this tab visible. No GitHub requests are made.</p>
    <div className="lab-actions"><label>Canvas <select value={width} disabled={running} onChange={event => setWidth(event.target.value as "desktop" | "narrow")}><option value="desktop">Desktop</option><option value="narrow">Narrow (390 px)</option></select></label><button className="draw-button" disabled={running} onClick={run}>Run measurements</button><span role="status">{status}</span></div>
    <div className="lab-workbench"><div ref={host} className={`lab-stage ${width}`}>{specimen && <InkDrawing key={specimen.key} drawing={specimen.drawing} defaultBranch="develop" onInspect={inspect} />}</div><aside className="lab-inspector"><p className="eyebrow">INSPECTED BRANCH</p><p>{inspection?.name ?? "No branch inspected"}</p><p className="eyebrow">{specimen ? `${specimen.drawing.limbs.length + 1} TOTAL BRANCHES` : "CONTROLLED FIXTURES"}</p></aside></div>
    <div className="lab-results"><table><thead><tr><th>Branches</th><th>SVG nodes</th><th>First rAF</th><th>Draw frame p95</th><th>Pointer p95</th><th>Pan p95</th><th>Zoom p95</th><th>Targets</th></tr></thead><tbody>{rows.map(row => <tr key={row.branches}><td>{row.branches}</td><td>{row.svgNodes}</td><td>{row.firstFrameMs} ms</td><td>{row.drawFrameP95Ms} ms</td><td>{row.pointerHandlerP95Ms} ms</td><td>{row.panFrameP95Ms} ms</td><td>{row.zoomFrameP95Ms} ms</td><td>{row.targetMatches}/{row.targetProbes}</td></tr>)}</tbody></table></div>
    <p>First rAF is the first animation-frame callback, not a paint measurement. Pointer p95 measures synchronous handler cost with synthetic input, not end-to-end human input latency. Frame intervals include rendering and other activity on this computer. Target matches probe exact centerlines; they are not a usability score. Discard runs whose visibility, canvas-in-view, or stable-viewport flags are false.</p>
    <details open><summary>Raw results</summary><pre id="performance-results">{JSON.stringify({ environment, rows }, null, 2)}</pre></details>
  </main>;
}
