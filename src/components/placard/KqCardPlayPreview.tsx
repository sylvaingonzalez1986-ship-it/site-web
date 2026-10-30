import { ChevronDown } from "lucide-react";
import type { KqCardPlayPreview as CardPlayPreview, KqCardPlayResult } from "@/lib/kanab-quest-card-preview";
import { KQ_OUTCOME_LABELS } from "@/lib/kanab-quest-outcome-artwork";
import { KqProgressMeter } from "./KqVisuals";
import styles from "./KqCardPlayPreview.module.css";

function Result({ label, result, healthBefore }: { label: string; result: KqCardPlayResult; healthBefore: number | null }) {
  return <article data-preview-result={label === "Sans la carte" ? "before" : "after"}>
    <span>{label}</span><strong>{KQ_OUTCOME_LABELS[result.outcome]}</strong>
    {result.health !== null ? <KqProgressMeter label="Santé au bilan" value={result.health} max={100} valueLabel={`${result.health} /100`}
      tone={label === "Sans la carte" || healthBefore === null || result.health === healthBefore ? "ink" : result.health < healthBefore ? "red" : "teal"} /> : null}
    {result.dead ? <small>Culture perdue, sans récolte.</small> : result.rescued ? <small>Secours de première culture utilisé.</small> : null}
    {result.heritage ? <small>{result.heritage.name} se déclenchera.</small> : null}
  </article>;
}

export function KqCardPlayPreview({ preview }: { preview: CardPlayPreview }) {
  if (preview.kind !== "deterministic") return <p className={styles.description} data-card-play-preview={preview.kind}>{preview.description}</p>;
  const { before, after } = preview;
  return <section className={styles.preview} data-card-play-preview="deterministic" aria-label="Comparer avant de jouer la carte">
    <h3>Si tu valides ensuite</h3>
    <p>Avec les dés affichés et les soins déjà activés.</p>
    <div className={styles.results}><Result label="Sans la carte" result={before} healthBefore={before.health} /><Result label="Avec la carte" result={after} healthBefore={before.health} /></div>
    <details><summary>Qualité, XP et pression<ChevronDown size={16} aria-hidden="true" /></summary>
      <table><thead><tr><th scope="col">Repère</th><th scope="col">Sans</th><th scope="col">Avec</th></tr></thead><tbody>
        <tr><th scope="row">Qualité</th><td>{before.quality} pts</td><td>{after.quality} pts</td></tr>
        <tr><th scope="row">XP après le choix</th><td>{before.xpAfterPlay} XP</td><td>{after.xpAfterPlay} XP</td></tr>
        <tr><th scope="row">XP après validation</th><td>{before.xpAfterValidation} XP</td><td>{after.xpAfterValidation} XP</td></tr>
        <tr><th scope="row">Pression</th><td>{before.pressure} /4</td><td>{after.pressure} /4</td></tr>
      </tbody></table>
    </details>
  </section>;
}
