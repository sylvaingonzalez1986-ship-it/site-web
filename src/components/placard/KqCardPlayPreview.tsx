import type { KqCardPlayPreview as CardPlayPreview, KqCardPlayResult } from "@/lib/kanab-quest-card-preview";
import { KQ_OUTCOME_LABELS } from "@/lib/kanab-quest-outcome-artwork";
import { KqBarChart } from "./KqVisuals";
import styles from "./KqCardPlayPreview.module.css";

function Result({ label, result }: { label: string; result: KqCardPlayResult }) {
  return <article data-preview-result={label === "Sans la carte" ? "before" : "after"}>
    <span>{label}</span><strong>{KQ_OUTCOME_LABELS[result.outcome]}</strong>
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
    <div className={styles.results}><Result label="Sans la carte" result={before} /><Result label="Avec la carte" result={after} /></div>
    {before.health !== null && after.health !== null ? <KqBarChart title="Santé au bilan" items={[
      { label: "Sans la carte", value: before.health, displayValue: `${before.health} /100`, tone: "ink" },
      { label: "Avec la carte", value: after.health, displayValue: `${after.health} /100`, tone: after.health < before.health ? "red" : after.health > before.health ? "teal" : "ink" },
    ]} /> : null}
    <details><summary>Qualité, XP et pression</summary>
      <table><thead><tr><th scope="col">Repère</th><th scope="col">Sans</th><th scope="col">Avec</th></tr></thead><tbody>
        <tr><th scope="row">Qualité</th><td>{before.quality} pts</td><td>{after.quality} pts</td></tr>
        <tr><th scope="row">XP après le choix</th><td>{before.xpAfterPlay} XP</td><td>{after.xpAfterPlay} XP</td></tr>
        <tr><th scope="row">XP après validation</th><td>{before.xpAfterValidation} XP</td><td>{after.xpAfterValidation} XP</td></tr>
        <tr><th scope="row">Pression</th><td>{before.pressure} /4</td><td>{after.pressure} /4</td></tr>
      </tbody></table>
    </details>
  </section>;
}
