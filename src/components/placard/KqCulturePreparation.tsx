"use client";

import { ArrowRight, Check, ChevronDown, Dices, Layers3, Leaf, SlidersHorizontal, Sparkles, Undo2 } from "lucide-react";
import { KqCardRoleLegend } from "./KqCardEffectGuide";
import styles from "./KqCulturePreparation.module.css";

export function KqCulturePreparation({ cardCount, note, disabled, disabledReason, busy, onEditDeck, onStart }: {
  cardCount: number; note: string; disabled: boolean; busy: boolean;
  disabledReason?: string;
  onEditDeck: () => void; onStart: () => void;
}) {
  return <section className={styles.preparation} aria-labelledby="culture-preparation-title" data-culture-preparation>
    <div className={styles.intro}>
      <div className={styles.deckStamp} aria-hidden="true"><Layers3 /><b>{cardCount}</b><span>CARTE{cardCount > 1 ? "S" : ""}</span></div>
      <div className={styles.heading}><span>DERNIERS PRÉPARATIFS</span><h2 id="culture-preparation-title">À toi de jouer.</h2><p>{cardCount > 0 ? "Tes cartes sont prêtes. Joue-les au bon moment pour aider ta culture." : "Tu pars sans carte La Botte. Tu peux en ajouter ou tenter ta chance avec les dés."}</p></div>
      <button type="button" className={styles.edit} disabled={busy} onClick={onEditDeck}><SlidersHorizontal size={16} />Ajuster mon deck</button>
    </div>
    <ol className={styles.steps} aria-label="Le déroulement d’un tour">
      <li><span className={styles.stepNumber}>01</span><Leaf aria-hidden="true" /><div><small>AVANT LES DÉS</small><strong>Prépare le terrain</strong><p>Joue une carte de préparation si tu en as besoin.</p></div></li>
      <li><span className={styles.stepNumber}>02</span><Dices aria-hidden="true" /><div><small>LE LANCER</small><strong>Tente ta chance</strong><p>Lance les dés pour résoudre l’incident.</p></div></li>
      <li><span className={styles.stepNumber}>03</span><Undo2 aria-hidden="true" /><div><small>APRÈS LES DÉS</small><strong>À toi de réagir</strong><p>Une carte de réaction peut changer la donne.</p></div></li>
    </ol>
    <details className={styles.reference}>
      <summary><Dices size={17} /><span>Les dés et les cartes : les repères utiles</span><ChevronDown size={17} /></summary>
      <div className={styles.referenceContent}>
        <div className={styles.diceKey}><span data-outcome="danger"><b>1</b>Danger</span><span><b>2–3</b>Neutre</span><span data-outcome="success"><b>4–6</b>Réussite</span><small><Sparkles size={15} />Chaque 6 rapporte +1 XP au verdict.</small></div>
        <p>Chaque couleur indique l’utilité d’une carte.</p><KqCardRoleLegend />
      </div>
    </details>
    <footer className={styles.launch}>
      <div className={styles.reassurance}><Check size={20} aria-hidden="true" /><div><strong>{cardCount === 0 ? "Départ sans carte La Botte" : `${cardCount} carte${cardCount > 1 ? "s" : ""} dans ton deck`}</strong><p>{note}</p>{disabled && !busy ? <p className={styles.warning}>{disabledReason || "Choisis un Buddie que tu possèdes pour commencer."}</p> : null}</div></div>
      <button type="button" className={styles.start} disabled={disabled || busy} aria-busy={busy} onClick={onStart}>{busy ? "Action en cours…" : "Lancer ma culture"}<ArrowRight size={21} /></button>
    </footer>
  </section>;
}
