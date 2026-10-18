"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { useState } from "react";
import { BookOpen, Check, DoorOpen, Flower2, KeyRound, Map, Package, Pause, ReceiptText, RotateCcw, Settings, ShoppingBag, Sprout, Trophy, Undo2 } from "lucide-react";
import { AppDialog } from "@/components/ui/AppDialog";
import { ARENA_RELEVE_CHAPTERS, ARENA_RELEVE_LETTER, ARENA_RELEVE_SCENES, type ArenaReleveChapter } from "@/lib/arena-releve";
import styles from "./ArenaReleveJournal.module.css";

type JournalPanel = "notebook" | "journey" | "options";

type ArenaReleveJournalProps = {
  chapter: ArenaReleveChapter;
  chapterIndex: number;
  completed: boolean;
  onPause: () => void;
  onRestartChapter: () => void;
  onRestartAll: () => void;
};

const CHAPTER_ICONS = [KeyRound, DoorOpen, Flower2, Sprout, Sprout, Trophy, Package, ShoppingBag, ReceiptText];

function JournalOptions({ onPause, onRestartChapter, onRestartAll }: Pick<ArenaReleveJournalProps, "onPause" | "onRestartChapter" | "onRestartAll">) {
  return <div className={styles.options}>
    <button type="button" onClick={onPause}><Pause size={23} aria-hidden="true" /><span><strong>Reprendre plus tard</strong><small>Retrouver ma partie ici.</small></span></button>
    <button type="button" onClick={onRestartChapter}><Undo2 size={23} aria-hidden="true" /><span><strong>Reprendre ce chapitre</strong><small>Revenir au début de cette étape.</small></span></button>
    <button type="button" onClick={onRestartAll}><RotateCcw size={23} aria-hidden="true" /><span><strong>Recommencer l’histoire</strong><small>Retourner devant la ferme.</small></span></button>
  </div>;
}

/** Keeps reading and restart controls out of the playable scene. */
export function ArenaReleveJournal({ chapter, chapterIndex, completed, onPause, onRestartChapter, onRestartAll }: ArenaReleveJournalProps) {
  const [panel, setPanel] = useState<JournalPanel | null>(null);
  const replaceOptions = (action: () => void) => {
    // Batch both state updates so the confirmation replaces this history entry.
    // Dialog navigation is for leaving the game and would dismiss every parent.
    setPanel(null);
    action();
  };
  const title = panel === "notebook" ? "Le carnet de Sylvain" : panel === "journey" ? "Ton parcours" : "Options de la partie";
  return <>
    <div className={styles.tools} role="group" aria-label="Carnet de l’aventure" data-releve-journal-toolbar>
      <button type="button" aria-label="Ouvrir le carnet de Sylvain" title="Carnet" aria-haspopup="dialog" data-releve-journal="carnet" onClick={() => setPanel("notebook")}><BookOpen size={18} aria-hidden="true" /><span>Carnet</span></button>
      <button type="button" aria-label="Voir mon parcours" title="Parcours" aria-haspopup="dialog" data-releve-journal="parcours" onClick={() => setPanel("journey")}><Map size={18} aria-hidden="true" /><span>Parcours</span></button>
      <button type="button" aria-label="Ouvrir les options de la partie" title="Options" aria-haspopup="dialog" data-releve-journal="options" onClick={() => setPanel("options")}><Settings size={18} aria-hidden="true" /><span>Options</span></button>
    </div>
    {panel ? createPortal(<AppDialog open onClose={() => setPanel(null)} title={title} closeLabel={`Fermer : ${title}`} className={styles.dialog} bodyClassName={styles.body} dialogProps={{ "data-releve-journal-panel": panel }}>
      {panel === "notebook" ? <article className={styles.notebook}>
        <div className={styles.scene}><Image src={ARENA_RELEVE_SCENES[chapter.scene]} alt="Sylvain accompagne cette étape de l’aventure." width={900} height={600} sizes="(max-width:700px) 92vw, 700px" /><span>Chapitre {chapterIndex + 1}</span></div>
        <div className={styles.notes}><h2>{chapter.title}</h2><p className={styles.coach}>{chapter.coach}</p><details><summary>Le conseil de Sylvain</summary><p>{chapter.hint}</p><p>{chapter.rationale}</p></details>
          {chapter.stage === "arrival" ? <details className={styles.letter}><summary><BookOpen size={17} aria-hidden="true" />La lettre de Grand-père</summary>{ARENA_RELEVE_LETTER.map(line => <p key={line}>{line}</p>)}</details> : null}
        </div>
      </article> : null}
      {panel === "journey" ? <ol className={styles.journey} aria-label="Les neuf chapitres de La relève">{ARENA_RELEVE_CHAPTERS.map((item, index) => {
        const done = index < chapterIndex || completed;
        const active = index === chapterIndex && !completed;
        const Icon = CHAPTER_ICONS[index];
        return <li key={item.id} aria-current={active ? "step" : undefined} data-done={done}>
          <div className={styles.thumbnail}><Image src={ARENA_RELEVE_SCENES[item.scene]} alt="" width={360} height={240} sizes="(max-width:700px) 42vw, 220px" /><span className={styles.number}>{done ? <Check size={17} aria-label="Terminé" /> : index + 1}</span><span className={styles.chapterIcon}><Icon size={24} aria-hidden="true" /></span></div>
          <div className={styles.caption}><strong>{item.title}</strong><span>{done ? "Accompli" : active ? "Tu es ici" : "À découvrir"}</span></div>
        </li>;
      })}</ol> : null}
      {panel === "options" ? <JournalOptions onPause={() => replaceOptions(onPause)} onRestartChapter={() => replaceOptions(onRestartChapter)} onRestartAll={() => replaceOptions(onRestartAll)} /> : null}
    </AppDialog>, document.body) : null}
  </>;
}
