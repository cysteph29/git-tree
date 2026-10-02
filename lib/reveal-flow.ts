import type { RepositoryResult } from "./repository-url.ts";

export type Phase = { status: "input" | "loading" } | { status: "error"; message: string; retryAt?: string } | { status: "ready"; result: RepositoryResult };
export type View = "home" | "leaving" | "stage";
export type Flow = { view: View; phase: Phase; request: number | null };
export type FlowEvent =
  | { type: "invalid"; message: string }
  | { type: "submit"; request: number; reducedMotion: boolean }
  | { type: "fadeEnd" }
  | { type: "loaded"; request: number; result: RepositoryResult }
  | { type: "failed"; request: number; message: string; retryAt?: string }
  | { type: "back" };

export const initialFlow: Flow = { view: "home", phase: { status: "input" }, request: null };

export const canSubmit = (flow: Flow) => flow.view === "home" && flow.phase.status !== "loading";
export const canMountTree = (flow: Flow) => flow.view === "stage" && flow.phase.status === "ready";

// Network and animation timing arrive independently; only the active request may change the result.
export function reduceFlow(flow: Flow, event: FlowEvent): Flow {
  switch (event.type) {
    case "invalid":
      return canSubmit(flow) ? { ...flow, phase: { status: "error", message: event.message } } : flow;
    case "submit":
      return canSubmit(flow) ? { view: event.reducedMotion ? "stage" : "leaving", phase: { status: "loading" }, request: event.request } : flow;
    case "fadeEnd":
      return flow.view === "leaving" ? { ...flow, view: "stage" } : flow;
    case "loaded":
      return event.request === flow.request && flow.phase.status === "loading" ? { ...flow, phase: { status: "ready", result: event.result } } : flow;
    case "failed":
      return event.request === flow.request && flow.phase.status === "loading" ? { view: "home", phase: { status: "error", message: event.message, retryAt: event.retryAt }, request: null } : flow;
    case "back":
      return initialFlow;
  }
}
