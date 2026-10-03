"use client";

import { useMemo, useState } from "react";
import { fixture, generateDrawing } from "../../lib/tree";
import { InkDrawing } from "../ink-drawing";
import { FlowerStudy } from "./flower-study";
import s from "./study.module.css";

const colors = [["Paper", "#F2EBDD"], ["Ink", "#30302A"], ["Carmine", "#A44F50"], ["Rose", "#C47D7F"], ["Petal", "#D7A09A"]];

export function AestheticStudy() {
  const [count, setCount] = useState(10);
  const [rich, setRich] = useState(false);
  const repository = useMemo(() => fixture(count), [count]);
  const drawing = useMemo(() => generateDrawing(repository), [repository]);
  return <main className={s.study}>
    <header className={s.header}><a href="/">← Back to the project</a><span>ART DIRECTION / STUDY 01</span></header>
    <section className={s.intro}>
      <p className={s.kicker}>PAPER · INK · BLOSSOM</p>
      <h1>A study in flowering branches.</h1>
      <p>Warm paper, twisting ink, a little color. Two expressions of the same tree.</p>
    </section>
    <div className={s.toolbar}><p>Compare the amount of blossom and the space between it.</p><label>Specimen <select value={count} onChange={event => setCount(Number(event.target.value))}><option value={2}>2 branches · sparse</option><option value={10}>10 branches · ordinary</option><option value={47}>47 branches · fuller</option><option value={100}>100 branches · crowded</option><option value={1000}>1,000 branches · stress study</option></select></label></div>
    <section className={s.comparison} aria-label="Compare flowering-tree treatments">
      {[false, true].map(full => <article key={String(full)} className={s.variant}>
        <div className={s.caption}><div><span>{full ? "B" : "A"}</span><h2>{full ? "Full bloom" : "Quiet blossom"}</h2></div><p>{full ? "More pigment. Fuller clusters." : "Fewer flowers. More exposed paper."}</p></div>
        <div className={`${s.paper} ${s.painting}`}><FlowerStudy repository={repository} rich={full}/><div className={s.specimenCaption}><h3>evergreen</h3><p>fieldnotes / evergreen</p><div><span>{count.toLocaleString()} branches</span><span>develop</span></div></div></div>
      </article>)}
    </section>
    {count >= 100 && <p className={s.densityNote}>At this density, branches overlap heavily. Every branch is still present; only decorative blossom detail decreases. This is an honest stress study, not a finished solution for crowded repositories.</p>}
    <section className={s.section}>
      <div className={s.sectionHeading}><div><p className={s.kicker}>LOOK CLOSER</p><h2>The mark and the material.</h2></div><div className={s.toggle} aria-label="Treatment for the detail and phone studies"><button aria-pressed={!rich} onClick={() => setRich(false)}>A · Quiet</button><button aria-pressed={rich} onClick={() => setRich(true)}>B · Full</button></div></div>
      <div className={s.materialGrid}>
        <figure className={`${s.paper} ${s.detail}`}><FlowerStudy repository={fixture(10)} rich={rich} closeup/><figcaption>Tapered ink, broken highlights, overlapping petals.</figcaption></figure>
        <div className={s.palette}><h3>A warm, limited palette.</h3><p>Paper carries the composition. Charcoal gives it structure. Red and pink collect at the tips.</p><div className={s.swatches}>{colors.map(([name, color]) => <div key={name}><span style={{ background: color }}/><b>{name}</b><small>{color}</small></div>)}</div><p className={s.small}>Fine grain belongs to the paper. Text stays clean and sharp. The exact texture strength is open for review.</p></div>
      </div>
    </section>
    <section className={s.section}>
      <div className={s.sectionHeading}><div><p className={s.kicker}>IN CONTEXT</p><h2>Room for the tree. Room to read.</h2></div><p>Type, input, and a phone-sized result.</p></div>
      <div className={s.contextGrid}>
        <div className={`${s.paper} ${s.entry}`}><p className={s.kicker}>GITHUB TREE</p><h3>What does your<br/><em>repo look like?</em></h3><label htmlFor="study-url">A public GitHub repository</label><input id="study-url" placeholder="https://github.com/owner/repository" aria-describedby="study-input-note"/><p id="study-input-note">Input appearance study · no submission</p></div>
        <div className={s.phoneWrap}><div className={`${s.paper} ${s.phone}`}><span className={s.phoneBack}>← Back</span><FlowerStudy repository={repository} rich={rich}/><div className={s.phoneDetails}><h3>evergreen</h3><p>fieldnotes / evergreen</p><dl><div><dt>Total branches</dt><dd>{count.toLocaleString()}</dd></div><div><dt>Default branch</dt><dd>develop</dd></div></dl></div></div><p>{rich ? "B · Full bloom" : "A · Quiet blossom"} / phone composition</p></div>
      </div>
    </section>
    <section className={s.section}>
      <div className={s.sectionHeading}><div><p className={s.kicker}>POINTS OF REFERENCE</p><h2>Where we are coming from.</h2></div></div>
      <div className={s.referenceGrid}>
        <article><div className={s.current}><InkDrawing key={count} drawing={drawing} defaultBranch="develop"/></div><h3>Current drawing · {count.toLocaleString()} branches</h3><p>The same repository fixture, rendered by the current app. This updates as the approved study is implemented.</p></article>
        <article><div className={`${s.paper} ${s.current}`}><InkDrawing drawing={generateDrawing(fixture(1))} defaultBranch="develop"/></div><h3>One branch · existing cactus</h3><p>Kept as the starting rule. Its painted treatment is still to be resolved; choosing the flowering direction has not replaced it with a sapling.</p></article>
      </div>
    </section>
    <footer className={s.footer}><p>For this review: A or B? Look at blossom density, branch shape, paper texture, and the phone composition.</p><span>Static visual studies · the main app is unchanged</span></footer>
  </main>;
}
