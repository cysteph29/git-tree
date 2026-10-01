"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { generateDrawing } from "../lib/tree";
import { parseRepositoryUrl, type RepositoryResult } from "../lib/repository-url";
import { InkDrawing } from "./ink-drawing";
import type { Inspection } from "./use-tree-explorer";

type Phase = { status: "input" | "loading" } | { status: "error"; message: string; retryAt?: string } | { status: "ready"; result: RepositoryResult };

function Sprig({ className = "" }: { className?: string }) {
  return <svg className={className} width="28" height="36" viewBox="0 0 28 36" fill="none" aria-hidden="true"><path d="M14 33C13 23 16 14 14 3M14 25C8 25 5 20 4 16C10 16 13 20 14 25ZM15 19C21 17 24 13 24 9C18 10 15 14 15 19ZM14 12C9 11 7 7 8 3C12 5 14 8 14 12Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>({ status: "input" });
  const [replay, setReplay] = useState(0);
  const [inspection, setInspection] = useState<Inspection>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pending = useRef<AbortController | null>(null);
  const focusInput = useRef(false);
  const result = phase.status === "ready" ? phase.result : null;
  const repository = result?.repository;
  const drawing = useMemo(() => repository ? generateDrawing(repository) : null, [repository]);
  const count = repository?.branches.length ?? 0;
  const loading = phase.status === "loading";

  useEffect(() => () => { pending.current?.abort(); pending.current = null; }, []);
  useEffect(() => {
    if (phase.status === "error" || (phase.status === "input" && focusInput.current)) {
      inputRef.current?.focus();
      focusInput.current = false;
    }
  }, [phase]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    try { parseRepositoryUrl(url); } catch (error) {
      setPhase({ status: "error", message: error instanceof Error ? error.message : "Enter a valid GitHub repository URL." });
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    setPhase({ status: "loading" });
    const timeout = window.setTimeout(() => controller.abort(), 35_000);
    try {
      const response = await fetch(`/api/repository?${new URLSearchParams({ url })}`, { signal: controller.signal, cache: "no-store" });
      const data = await response.json();
      if (pending.current !== controller) return;
      if (!response.ok) {
        setPhase({ status: "error", message: typeof data.error?.message === "string" ? data.error.message : "The repository couldn’t be loaded. Please try again.", retryAt: typeof data.error?.retryAt === "string" ? data.error.retryAt : undefined });
        return;
      }
      const repo = data.repository;
      if (!repo || !Number.isSafeInteger(repo.id) || typeof repo.name !== "string" || typeof repo.defaultBranch !== "string" || !Array.isArray(repo.branches) || repo.branches.some((name: unknown) => typeof name !== "string" || !name) || (repo.branches.length && !repo.branches.includes(repo.defaultBranch)) || typeof data.fetchedAt !== "string" || !Number.isFinite(Date.parse(data.fetchedAt))) throw new Error("Incomplete response");
      setReplay(0);
      setPhase({ status: "ready", result: data });
    } catch {
      if (pending.current === controller) setPhase({ status: "error", message: controller.signal.aborted ? "Loading all branches took too long. Please try again." : "Couldn’t load the repository. Check your connection and try again." });
    } finally {
      window.clearTimeout(timeout);
      if (pending.current === controller) pending.current = null;
    }
  }

  return <main>
    <header className="site-header">
      <a className="wordmark" href="/" aria-label="GitHub Tree home"><Sprig /> GitHub Tree<span className="wordmark-dot">.</span></a>
      <span className="edition"><span className="status-dot" /> An experiment in growing code</span>
    </header>

    <section className="intro" aria-labelledby="page-title">
      <div><p className="eyebrow">A STUDY IN BRANCHES</p><h1 id="page-title">A repository,<br /><em>rooted in ink.</em></h1></div>
      <div className="intro-copy"><p>Every repository has a shape.<br /> A trunk, a few branches, a life of its own.</p><p className="muted">A little botanical interpretation of the things we build.</p></div>
    </section>

    <section className="repository-entry" aria-label="Choose a repository">
      {repository ? <div className="repository-summary"><div><p className="eyebrow">ROOTED IN GITHUB</p><p className="chosen-repository">{repository.name}</p></div><button className="another-button" onClick={() => { focusInput.current = true; setPhase({ status: "input" }); }}>Another repository <span aria-hidden="true">↗</span></button></div> : <form onSubmit={submit} noValidate aria-busy={loading}>
        <label className="eyebrow" htmlFor="repository-url">PLANT A REPOSITORY</label>
        <div className="repository-input-row"><input ref={inputRef} id="repository-url" type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={2048} value={url} disabled={loading} aria-invalid={phase.status === "error"} aria-describedby={phase.status === "error" ? "repository-error repository-hint" : "repository-hint"} placeholder="https://github.com/owner/repository" onChange={event => setUrl(event.target.value)} /><button className="draw-button" type="submit" disabled={loading}>{loading ? "Gathering branches…" : <>Draw repository <span aria-hidden="true">↗</span></>}</button></div>
        <p className="entry-hint" id="repository-hint">Public repositories only. No sign-in needed. Repository, branch, and file URLs are welcome.</p>
        {phase.status === "error" && <p id="repository-error" className="entry-error" role="alert">{phase.message}{phase.retryAt && Number.isFinite(Date.parse(phase.retryAt)) && <> Try after {new Date(phase.retryAt).toLocaleString(undefined, { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" })}.</>}</p>}
      </form>}
    </section>

    <p className="sr-only" role="status">{loading ? "Loading repository metadata and all branch pages." : repository ? `${repository.name} loaded with ${count} ${count === 1 ? "branch" : "branches"}.` : ""}</p>
    <section className="study" aria-label="Repository illustration" aria-busy={loading}>
      <div className="study-toolbar"><span className="eyebrow">THE SPECIMEN TABLE</span><div className="study-actions"><button className="replay-button" disabled={!count || loading} onClick={() => setReplay(value => value + 1)}><span aria-hidden="true">↻</span> Replay drawing</button></div></div>
      <div className="study-body">
        <div className={`drawing-area ${!drawing || drawing.kind === "empty" ? "is-empty" : ""}`}>
          <span className="plate-label">FIG. 01</span>
          <span className="plate-axis" aria-hidden="true">—</span>
          {!drawing ? <div className="empty-state"><Sprig /><h2>{loading ? "Finding its shape…" : "A place to take root."}</h2><p>{loading ? <>Gathering the repository and every branch.<br />The drawing begins when they’re all here.</> : <>Bring a public repository.<br />See what grows from its branches.</>}</p></div> : drawing.kind === "empty" ? <div className="empty-state"><Sprig /><h2>Not yet rooted.</h2><p>This repository has no branches.<br />There’s nothing to draw just yet.</p></div> : <InkDrawing key={`${repository!.id}:${replay}`} drawing={drawing} defaultBranch={repository!.defaultBranch} onInspect={setInspection} />}
          <div className="plate-caption"><span>{drawing?.kind === "cactus" ? "Solitary growth" : drawing?.kind === "empty" ? "An unwritten beginning" : drawing ? "An evergreen, interpreted" : "Every branch, a beginning"}</span><span className="caption-rule" /><span className="plate-caption-sub">INK ON A DIGITAL PAGE</span></div>
        </div>

        <aside className="specimen-notes" aria-label="Specimen details">
          <p className="eyebrow">{repository ? "YOUR SPECIMEN" : "FIELD NOTES"} <span className="small-rule" /></p>
          <h2>{repository?.name.split("/").pop() ?? "unplanted"}<span>.</span></h2><p className="repo-name">{repository?.name ?? "A little room for something new"}</p>
          <p className="sample-label">{repository ? "Public GitHub repository" : loading ? "Gathering every branch" : "Awaiting a repository"}</p>
          {count > 0 && <div className={`branch-inspector ${inspection ? "has-branch" : ""}`}><p className="eyebrow">{inspection ? inspection.name === repository?.defaultBranch ? "DEFAULT BRANCH" : "GIT BRANCH" : "A CLOSER LOOK"}</p><div className="branch-inspector-content">{inspection ? <p className="inspected-name">{inspection.name}</p> : <p className="inspection-idle">Hover or tap a branch.<br />Its name will appear here.</p>}</div><p className="inspection-keyboard">Keyboard: focus the tree, then use arrow keys.</p></div>}
          <p className="sr-only" aria-live="polite" aria-atomic="true">{inspection?.source === "keyboard" ? `${inspection.name}${inspection.name === repository?.defaultBranch ? ", default branch" : ", branch"}` : ""}</p>
          <dl className="facts"><div><dt>Total branches</dt><dd>{repository ? count.toLocaleString("en-US") : "—"}</dd></div><div><dt>{drawing?.kind === "cactus" ? "Cactus body" : "Trunk"}</dt><dd>{count ? repository!.defaultBranch : "—"}</dd></div><div><dt>Primary limbs</dt><dd>{repository ? Math.max(0, count - 1).toLocaleString("en-US") : "—"}</dd></div></dl>
          <div className="field-note"><p className="eyebrow">FIELD NOTE</p><p>{!repository ? "The default branch becomes a trunk. Each of the others finds its own place as a limb." : count === 0 ? "No branches, no plant. An empty repository is given a little space to begin." : count === 1 ? "One branch stands on its own. An upright cactus, with no arms and nothing invented." : count === 2 ? "A single limb reaches from the trunk. Sparse growth has a quiet character all its own." : count >= 100 ? "A crowded canopy. Every branch is here. Zoom in or use the arrow keys to explore overlapping limbs." : "The default branch takes root. Each of the others becomes a limb, finding its own place along the trunk."}</p></div>
          <p className="mapping-note">Shape is a matter of composition.<br />It doesn’t measure activity or importance.</p>
          <div className="notes-foot"><span aria-hidden="true">✳</span><p>Same repository.<br />Same branches. Same drawing.</p></div>
        </aside>
      </div>

      {result && <div className="repository-provenance"><span className="eyebrow">EVERY BRANCH ACCOUNTED FOR</span><p>Branches fetched {new Date(result.fetchedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}{result.cached ? " · From a recent saved result" : " · Fresh from GitHub"}</p></div>}
    </section>

    <footer><p><span className="footer-marker">↳</span> A little less diagram. A little more nature.</p><span>PUBLIC REPOSITORIES <span className="footer-slash">/</span> REAL BRANCHES, DRAWN IN INK</span></footer>
  </main>;
}
