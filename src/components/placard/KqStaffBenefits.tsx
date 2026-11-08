import type { getKqStaffBenefitPreview } from "@/lib/kanab-quest-staff-benefits";
import { KqPrintedArt, type KqPrintedArtKind } from "./KqPrintedArt";
import styles from "./KqStaffBenefits.module.css";

type Preview = ReturnType<typeof getKqStaffBenefitPreview>;
const art: Record<string, KqPrintedArtKind> = { culture: "help-culture", processing: "help-workshop", trim: "help-workshop", communication: "help-social", sales: "help-travel", administration: "help-accounts", training: "help-training", countryside: "help-travel" };
const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

/** The same predictions appear before review and in the confirmation. Never an outcome. */
export function getKqStaffBenefitRows(preview: Preview): Array<[string, string]> {
  return [...preview.metrics.map((metric): [string, string] => [`Prévision · ${metric.label}`, `${number(metric.value)} ${metric.unit}`]), ...(preview.notes[0] ? [["Conditions de la prévision", preview.notes[0]] as [string, string]] : [])];
}

export function KqStaffBenefits({ preview, compact = false }: { preview: Preview; compact?: boolean }) {
  return <section className={styles.preview} data-staff-benefit-preview={preview.kind} data-compact={compact || undefined} aria-label="Bénéfice prévu">
    <div className={styles.heading}><KqPrintedArt kind={art[preview.kind] ?? "help-team"} sizes="64px" /><div><strong>Bénéfice prévu</strong><span>Selon les compétences actuelles · niveau {preview.skillLevel}</span></div></div>
    <dl className={styles.metrics}>{preview.metrics.map(metric => <div key={metric.label}><dt>{metric.label}</dt><dd>{number(metric.value)} <span>{metric.unit}</span></dd></div>)}</dl>
    {preview.notes[0] ? <p className={styles.scope}>{preview.notes[0]}</p> : null}
    {preview.notes.length > 1 ? <details data-staff-benefit-details><summary>Règles du calcul</summary><ul>{preview.notes.slice(1).map(note => <li key={note}>{note}</li>)}</ul></details> : null}
  </section>;
}
