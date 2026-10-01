"use client";

import { useEffect, type RefObject } from "react";
import { select } from "d3-selection";
import { zoom, zoomIdentity, zoomTransform, type D3ZoomEvent } from "d3-zoom";
import type { Drawing } from "../lib/tree";
import { boundsForPoints, pickBranch, type HitBranch } from "../lib/hit-testing";

export type Inspection = { name: string; source: "pointer" | "touch" | "keyboard" } | null;

export function useTreeExplorer(svgRef: RefObject<SVGSVGElement | null>, sceneRef: RefObject<SVGGElement | null>, wrapperRef: RefObject<HTMLDivElement | null>, drawing: Drawing, onInspect: (inspection: Inspection) => void) {
  useEffect(() => {
    const svg = svgRef.current!;
    const scene = sceneRef.current!;
    const wrapper = wrapperRef.current!;
    const selection = select<SVGSVGElement, unknown>(svg);
    const models: (HitBranch & { element: SVGGElement })[] = [];
    const geometry = new Map([drawing.trunk!, ...drawing.limbs].map(branch => [branch.name, branch]));
    for (const element of scene.querySelectorAll<SVGGElement>("[data-branch]")) {
      const path = element.querySelector<SVGPathElement>(".hit-centerline")!;
      const storedPoints = geometry.get(element.dataset.branch!)?.hitPoints;
      const length = storedPoints ? 0 : path.getTotalLength();
      const points = storedPoints ?? Array.from({ length: 65 }, (_, i) => {
        const point = path.getPointAtLength(length * i / 64);
        return { x: point.x, y: point.y };
      });
      models.push({ name: element.dataset.branch!, points, bounds: boundsForPoints(points), filled: element.classList.contains("ink-trunk"), element });
    }
    const byName = new Map(models.map(model => [model.name, model]));
    const branchOrder = [drawing.trunk!.name, ...drawing.limbs.map(branch => branch.name)];
    let active: Inspection = null;
    const ready = () => svg.dataset.drawingState === "complete";
    const inspect = (name: string | null, source: NonNullable<Inspection>["source"]) => {
      if (active?.name === name && active?.source === source) return;
      if (!active && name === null) return;
      if (active) byName.get(active.name)?.element.classList.remove("is-inspected");
      active = name ? { name, source } : null;
      if (active) byName.get(active.name)?.element.classList.add("is-inspected");
      svg.dataset.inspectedBranch = name ?? "";
      svg.dataset.inspectionSource = name ? source : "";
      onInspect(active);
    };

    const bounds = scene.getBBox();
    const fitScale = Math.min(680 * 0.84 / Math.max(bounds.width, 1), 780 * 0.84 / Math.max(bounds.height, 1));
    const fit = zoomIdentity.translate(400 - (bounds.x + bounds.width / 2) * fitScale, 460 - (bounds.y + bounds.height / 2) * fitScale).scale(fitScale);
    const behavior = zoom<SVGSVGElement, unknown>()
      .extent([[60, 70], [740, 850]])
      .scaleExtent([fitScale * 0.5, fitScale * 8])
      .duration(0)
      .touchable(() => true)
      .filter(event => ready() && !event.button && event.type !== "dblclick" && (!event.ctrlKey || event.type === "wheel"))
      .on("start", (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        if (event.sourceEvent) {
          inspect(null, "pointer");
          if (event.sourceEvent.type !== "wheel") svg.dataset.panning = "true";
        }
      })
      .on("zoom", (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        scene.setAttribute("transform", event.transform.toString());
        const percent = Math.round(event.transform.k / fitScale * 100);
        wrapper.querySelector(".zoom-value")!.textContent = `${percent}%`;
        svg.dataset.zoom = String(percent);
      })
      .on("end", () => { delete svg.dataset.panning; });
    selection.call(behavior).on("dblclick.zoom", null).call(behavior.transform, fit);

    const hit = (event: PointerEvent) => {
      const matrix = scene.getScreenCTM();
      if (!matrix) return null;
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
      return pickBranch(models, point, Math.hypot(matrix.a, matrix.b), event.pointerType === "mouse" ? "mouse" : "touch", active?.name ?? null);
    };
    const pointers = new Map<number, { x: number; y: number; moved: boolean }>();
    const down = (event: PointerEvent) => {
      if (!ready()) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, moved: pointers.size > 0 });
      if (pointers.size > 1) for (const pointer of pointers.values()) pointer.moved = true;
    };
    const move = (event: PointerEvent) => {
      if (!ready()) return;
      const pointer = pointers.get(event.pointerId);
      if (pointer && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 6) pointer.moved = true;
      if (pointers.size || event.buttons) return;
      if (event.pointerType === "mouse") inspect(hit(event), "pointer");
    };
    const up = (event: PointerEvent) => {
      const pointer = pointers.get(event.pointerId);
      pointers.delete(event.pointerId);
      if (!ready() || !pointer || pointer.moved || pointers.size) return;
      const rect = svg.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
      inspect(hit(event), event.pointerType === "mouse" ? "pointer" : "touch");
    };
    const cancel = (event: PointerEvent) => { pointers.delete(event.pointerId); inspect(null, "pointer"); };
    const leave = (event: PointerEvent) => { if (event.pointerType === "mouse" && active?.source === "pointer") inspect(null, "pointer"); };

    const ensureVisible = (name: string) => {
      const model = byName.get(name)!;
      const point = model.points[Math.floor(model.points.length * 0.6)];
      const matrix = scene.getScreenCTM();
      const rootMatrix = svg.getScreenCTM();
      if (!matrix || !rootMatrix) return;
      const screen = new DOMPoint(point.x, point.y).matrixTransform(matrix);
      const rect = svg.getBoundingClientRect();
      const x = Math.max(rect.left + 48, Math.min(rect.right - 48, screen.x)) - screen.x;
      const y = Math.max(rect.top + 48, Math.min(rect.bottom - 48, screen.y)) - screen.y;
      if (x || y) {
        const current = zoomTransform(svg);
        const units = Math.hypot(rootMatrix.a, rootMatrix.b);
        selection.call(behavior.transform, zoomIdentity.translate(current.x + x / units, current.y + y / units).scale(current.k));
      }
    };
    const changeZoom = (factor: number) => { if (ready()) selection.call(behavior.scaleBy, factor); };
    const reset = () => { if (ready()) { selection.call(behavior.transform, fit); inspect(null, "pointer"); } };
    const keydown = (event: KeyboardEvent) => {
      if (!ready()) return;
      const key = event.key;
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "Escape", "+", "=", "-", "0"].includes(key)) return;
      event.preventDefault();
      if (key === "Escape") { inspect(null, "keyboard"); return; }
      if (key === "Home" || key === "0") { reset(); return; }
      if (key === "+" || key === "=") { changeZoom(1.4); return; }
      if (key === "-") { changeZoom(1 / 1.4); return; }
      if (event.shiftKey && key.startsWith("Arrow")) {
        const current = zoomTransform(svg);
        const matrix = svg.getScreenCTM()!;
        const distance = 70 / Math.hypot(matrix.a, matrix.b) / current.k;
        selection.call(behavior.translateBy, key === "ArrowLeft" ? distance : key === "ArrowRight" ? -distance : 0, key === "ArrowUp" ? distance : key === "ArrowDown" ? -distance : 0);
        inspect(null, "keyboard");
        return;
      }
      const current = active ? branchOrder.indexOf(active.name) : -1;
      const direction = key === "ArrowUp" || key === "ArrowLeft" ? -1 : 1;
      const index = key === "End" ? branchOrder.length - 1 : current === -1 ? (direction === 1 ? 0 : branchOrder.length - 1) : (current + direction + branchOrder.length) % branchOrder.length;
      inspect(branchOrder[index], "keyboard");
      ensureVisible(branchOrder[index]);
    };
    const focus = () => { if (ready() && svg.matches(":focus-visible")) inspect(branchOrder[0], "keyboard"); };
    const blur = () => { if (active?.source === "keyboard") inspect(null, "keyboard"); };
    const controls = wrapper.querySelectorAll<HTMLButtonElement>("[data-viewport-action]");
    const controlClick = (event: Event) => {
      const action = (event.currentTarget as HTMLButtonElement).dataset.viewportAction;
      if (action === "fit") reset();
      else changeZoom(action === "in" ? 1.4 : 1 / 1.4);
    };
    svg.addEventListener("pointerdown", down);
    svg.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    svg.addEventListener("pointerleave", leave);
    svg.addEventListener("keydown", keydown);
    svg.addEventListener("focus", focus);
    svg.addEventListener("blur", blur);
    controls.forEach(control => control.addEventListener("click", controlClick));
    return () => {
      selection.on(".zoom", null);
      svg.removeEventListener("pointerdown", down);
      svg.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      svg.removeEventListener("pointerleave", leave);
      svg.removeEventListener("keydown", keydown);
      svg.removeEventListener("focus", focus);
      svg.removeEventListener("blur", blur);
      controls.forEach(control => control.removeEventListener("click", controlClick));
      inspect(null, "pointer");
    };
  }, [svgRef, sceneRef, wrapperRef, drawing, onInspect]);
}
