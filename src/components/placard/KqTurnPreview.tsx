import { KQ_OUTCOME_LABELS } from "@/lib/kanab-quest-outcome-artwork";
import type { KqTurnPreview as TurnPreview } from "@/lib/kanab-quest-turn-preview";
import styles from "./KqTurnPreview.module.css";

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
      <dl>
        <div><dt>Qualité</dt><dd>{signed(preview.qualityDelta)} point{Math.abs(preview.qualityDelta) !== 1 ? "s" : ""}</dd></div>
        <div><dt>XP gagnés</dt><dd>{signed(preview.xpGain)} XP · total {preview.xpAfter}</dd></div>
        <div><dt>Pression</dt><dd>{preview.pressure.before} → {preview.pressure.after} /4</dd></div>
      </dl>
      {preview.heritage && !preview.heritage.changesOutcome ? <p>{preview.heritage.name} se déclenchera à ce bilan.</p> : null}
      <p>Avec tes dés, tes cartes et les soins déjà activés. Une nouvelle action peut changer cet aperçu.</p>
    </details>
  </section>;
}
