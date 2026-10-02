"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type FormEvent } from "react";
import { generateDrawing } from "../lib/tree";
import { parseRepositoryUrl } from "../lib/repository-url";
import { canMountTree, canSubmit, initialFlow, reduceFlow } from "../lib/reveal-flow";
import { InkDrawing } from "./ink-drawing";
import type { Inspection } from "./use-tree-explorer";

const FADE_FALLBACK_MS = 400;

function Sprig({ className = "" }: { className?: string }) {
  return <svg className={className} width="28" height="36" viewBox="0 0 28 36" fill="none" aria-hidden="true"><path d="M14 33C13 23 16 14 14 3M14 25C8 25 5 20 4 16C10 16 13 20 14 25ZM15 19C21 17 24 13 24 9C18 10 15 14 15 19ZM14 12C9 11 7 7 8 3C12 5 14 8 14 12Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [flow, dispatch] = useReducer(reduceFlow, initialFlow);
  const { phase, view } = flow;
  const [replay, setReplay] = useState(0);
  const [inspection, setInspection] = useState<Inspection>(null);
  const [drawn, setDrawn] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const pending = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  const fadeTimer = useRef<number | undefined>(undefined);
  const focusInput = useRef(false);
  const result = phase.status === "ready" ? phase.result : null;
  const repository = result?.repository;
  const drawing = useMemo(() => repository ? generateDrawing(repository) : null, [repository]);
  const count = repository?.branches.length ?? 0;
  const loading = phase.status === "loading";
  const detailsShown = drawn || drawing?.kind === "empty";
  const showDetails = useCallback(() => setDrawn(true), []);

  useEffect(() => () => { pending.current?.abort(); pending.current = null; window.clearTimeout(fadeTimer.current); }, []);
  useEffect(() => {
    if (phase.status === "error" || (phase.status === "input" && focusInput.current)) {
      if (focusInput.current) window.scrollTo(0, 0);
      inputRef.current?.focus({ preventScroll: true });
      focusInput.current = false;
    }
  }, [phase]);
  useEffect(() => { if (view === "stage") backRef.current?.focus({ preventScroll: true }); }, [view]);
  useEffect(() => { if (view !== "leaving") window.clearTimeout(fadeTimer.current); }, [view]);

  function finishLeaving() {
    window.clearTimeout(fadeTimer.current);
    dispatch({ type: "fadeEnd" });
  }

  function goHome() {
    pending.current?.abort();
    pending.current = null;
    setInspection(null);
    setReplay(0);
    setDrawn(false);
    focusInput.current = true;
    dispatch({ type: "back" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !canSubmit(flow)) return;
    try { parseRepositoryUrl(url); } catch (error) {
      dispatch({ type: "invalid", message: error instanceof Error ? error.message : "Enter a valid GitHub repository URL." });
      return;
    }
    const controller = new AbortController();
    const request = ++requestId.current;
    pending.current = controller;
    setDrawn(false);
    setReplay(0);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    dispatch({ type: "submit", request, reducedMotion });
    if (!reducedMotion) fadeTimer.current = window.setTimeout(finishLeaving, FADE_FALLBACK_MS);
    const timeout = window.setTimeout(() => controller.abort(), 35_000);
    try {
      const response = await fetch(`/api/repository?${new URLSearchParams({ url })}`, { signal: controller.signal, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        dispatch({ type: "failed", request, message: typeof data.error?.message === "string" ? data.error.message : "The repository couldn’t be loaded. Please try again.", retryAt: typeof data.error?.retryAt === "string" ? data.error.retryAt : undefined });
        return;
      }
      const repo = data.repository;
      if (!repo || !Number.isSafeInteger(repo.id) || typeof repo.name !== "string" || typeof repo.defaultBranch !== "string" || !Array.isArray(repo.branches) || repo.branches.some((name: unknown) => typeof name !== "string" || !name) || (repo.branches.length && !repo.branches.includes(repo.defaultBranch)) || typeof data.fetchedAt !== "string" || !Number.isFinite(Date.parse(data.fetchedAt))) throw new Error("Incomplete response");
      dispatch({ type: "loaded", request, result: data });
    } catch {
      dispatch({ type: "failed", request, message: controller.signal.aborted ? "Loading all branches took too long. Please try again." : "Couldn’t load the repository. Check your connection and try again." });
    } finally {
      window.clearTimeout(timeout);
      if (pending.current === controller) pending.current = null;
    }
  }

  const branches = `${count.toLocaleString("en-US")} ${count === 1 ? "branch" : "branches"}`;
  const status = <p className="sr-only" role="status">{loading ? "Loading the repository and all of its branches." : !repository ? "" : !count ? `${repository.name} has no branches. Details are below.` : detailsShown ? `${repository.name} drawn with ${branches}. Details are below the tree.` : `Drawing ${repository.name}, ${branches}.`}</p>;

  if (view !== "stage") return <>{status}<main className="home">
    <form className={`home-entry${view === "leaving" ? " is-leaving" : ""}`} inert={view === "leaving"} onSubmit={submit} noValidate aria-busy={loading} onTransitionEnd={event => { if (event.target === event.currentTarget && event.propertyName === "opacity") finishLeaving(); }}>
      <h1 className="home-title">What does your repo look like</h1>
      <label className="sr-only" htmlFor="repository-url">GitHub repository URL</label>
      <input ref={inputRef} className="home-input" id="repository-url" type="text" inputMode="url" enterKeyHint="go" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={2048} value={url} readOnly={loading} aria-invalid={phase.status === "error"} aria-describedby={phase.status === "error" ? "repository-error repository-hint" : "repository-hint"} placeholder="https://github.com/owner/repository" onChange={event => setUrl(event.target.value)} />
      <div className="home-message">{phase.status === "error" ? <p id="repository-error" className="entry-error" role="alert">{phase.message}{phase.retryAt && Number.isFinite(Date.parse(phase.retryAt)) && <> Try after {new Date(phase.retryAt).toLocaleString(undefined, { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" })}.</>}</p> : null}</div>
      <p className="sr-only" id="repository-hint">Public repositories only. Press Enter to draw.</p>
    </form>
  </main></>;

  return <>{status}<main className="result">
    <section className="result-stage" aria-label="Repository illustration" aria-busy={!detailsShown}>
      <button ref={backRef} className="back-button" type="button" onClick={goHome}><span aria-hidden="true">←</span> Back</button>
      {!canMountTree(flow) || !repository ? <p className="stage-status" aria-hidden="true">Gathering branches…</p> : drawing!.kind === "empty" ? <div className="empty-state"><Sprig /><h2>Not yet rooted.</h2><p>This repository has no branches.<br />There’s nothing to draw just yet.</p></div> : <>
        <InkDrawing key={`${repository.id}:${replay}`} drawing={drawing!} defaultBranch={repository.defaultBranch} onInspect={setInspection} onComplete={showDetails} />
        <button className="replay-button" onClick={() => setReplay(value => value + 1)}><span aria-hidden="true">↻</span> Replay drawing</button>
      </>}
    </section>

    {repository && <section className="result-details" aria-label="Repository details" data-revealed={detailsShown} inert={!detailsShown}>
      <h2 className="details-title">{repository.name.split("/").pop()}</h2>
      <p className="details-name">{repository.name}</p>
      <dl className="facts"><div><dt>Total branches</dt><dd>{count.toLocaleString("en-US")}</dd></div><div><dt>Default branch</dt><dd>{count ? repository.defaultBranch : "—"}</dd></div><div><dt>Primary limbs</dt><dd>{Math.max(0, count - 1).toLocaleString("en-US")}</dd></div></dl>
      {count > 0 && <div className="branch-inspector"><p className="eyebrow">{inspection ? inspection.name === repository.defaultBranch ? "DEFAULT BRANCH" : "GIT BRANCH" : "A CLOSER LOOK"}</p><div className="branch-inspector-content">{inspection ? <p className="inspected-name">{inspection.name}</p> : <p className="inspection-idle">Hover or tap a branch to see its name.</p>}</div><p className="inspection-keyboard">Keyboard: focus the tree, then use arrow keys.</p></div>}
      <p className="sr-only" aria-live="polite" aria-atomic="true">{inspection?.source === "keyboard" ? `${inspection.name}${inspection.name === repository.defaultBranch ? ", default branch" : ", branch"}` : ""}</p>
      <p className="provenance">Branches fetched {new Date(result!.fetchedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}{result!.cached ? " · From a recent saved result" : " · Fresh from GitHub"}</p>
    </section>}
  </main></>;
}
