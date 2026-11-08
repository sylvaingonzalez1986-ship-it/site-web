import { KQ_OUTCOME_LABELS } from "@/lib/kanab-quest-outcome-artwork";
import type { KqTurnPreview as TurnPreview } from "@/lib/kanab-quest-turn-preview";
import styles from "./KqTurnPreview.module.css";
import { KqHelpDashboard, KqHelpGrid, KqHelpNote } from "./KqHelpDashboard";

const signed = (value: number) => `${value > 0 ? "+" : ""}${value}`;

export function KqTurnPreview({ preview }: { preview: TurnPreview }) {
  const health = preview.health;
  return <section className={styles.preview} data-turn-preview data-outcome={preview.outcome}
    data-danger={preview.dead || undefined} aria-label="Si tu valides maintenant">
    <header><span>Si tu valides maintenant</span><strong>{KQ_OUTCOME_LABELS[preview.outcome]}</strong></header>
    {health ? <div className={styles.health}><span>Santé au bilan</span><strong>{health.before} → {health.after}<small> /100</small></strong></div> : null}
    {preview.dead ? <p className={styles.warning}><strong>La culture sera perdue, sans récolte.</strong></p>
      : preview.rescued ? <p className={styles.warning}>Ton secours de première culture sera utilisé{health ? " : la santé sera rétablie à 15/100" : " pour continuer"}. Les pertes déjà subies resteront.</p> : null}
    {preview.heritage?.changesOutcome ? <p className={styles.explanation}><strong>{preview.heritage.name}</strong> transformera le résultat des dés en réussite.</p>
      : preview.dangerBlocksSuccess ? <p className={styles.explanation}>Le nombre de réussites suffit, mais {preview.dangers === 1 ? "le Danger non protégé rend" : "les Dangers non protégés rendent"} le résultat fragile.</p> : null}
    <details className={styles.details}>
      <summary>Qualité, XP et pression</summary>
      <KqHelpDashboard><KqHelpGrid art="help-quality" items={[
        { label: "Qualité", value: `${signed(preview.qualityDelta)} point${Math.abs(preview.qualityDelta) !== 1 ? "s" : ""}` },
        { label: "XP gagnés", value: `${signed(preview.xpGain)} XP`, detail: `Total : ${preview.xpAfter} XP`, art: "help-training" },
        { label: "Pression", value: `${preview.pressure.before} → ${preview.pressure.after} /4`, art: "help-care" },
      ]} />
      {preview.heritage && !preview.heritage.changesOutcome ? <p>{preview.heritage.name} se déclenchera à ce bilan.</p> : null}
      <KqHelpNote>Aperçu avec tes dés, cartes et soins actuels. Une nouvelle action peut le changer.</KqHelpNote></KqHelpDashboard>
    </details>
  </section>;
}
