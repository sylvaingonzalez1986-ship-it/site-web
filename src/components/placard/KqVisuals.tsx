import type { CSSProperties } from "react";
import styles from "./KqVisuals.module.css";

export type KqVisualTone = "teal" | "gold" | "red" | "ink";
export type KqVisualItem = { label: string; value: number; displayValue: string; tone?: KqVisualTone };
const finite = (value: number) => Number.isFinite(value) ? value : 0;
const percentStyle = (value: number): CSSProperties => ({ "--visual-fill": `${Math.max(0, Math.min(100, value))}%` } as CSSProperties);

/** A real capacity or goal, with its exact value always readable outside the graphic. */
export function KqProgressMeter({ label, value, max, valueLabel, hint, tone = "teal" }: {
  label: string; value: number; max: number; valueLabel?: string; hint?: string; tone?: KqVisualTone;
}) {
  const limit = Math.max(0, finite(max));
  const current = Math.max(0, finite(value));
  const text = valueLabel ?? `${current.toLocaleString("fr-FR")} / ${limit.toLocaleString("fr-FR")}`;
  return <div className={styles.progress} data-tone={tone}>
    <div className={styles.labels}><span>{label}</span><strong>{text}</strong></div>
    <div className={styles.track} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={limit || 1}
      aria-valuenow={Math.min(current, limit)} aria-valuetext={text} style={percentStyle(limit > 0 ? current / limit * 100 : 0)}>
      <span />
    </div>
    {hint ? <small className={styles.hint}>{hint}</small> : null}
  </div>;
}

/** Comparable values share one scale. Signed series keep zero at the centre. */
export function KqBarChart({ title, items, emptyLabel = "Aucune donnée pour le moment." }: {
  title: string; items: KqVisualItem[]; emptyLabel?: string;
}) {
  const max = Math.max(0, ...items.map(item => Math.abs(finite(item.value))));
  const signed = items.some(item => item.value < 0);
  return <figure className={styles.chart}>
    <figcaption>{title}</figcaption>
    {items.length ? <ul className={styles.bars}>{items.map((item, index) => <li key={`${item.label}-${index}`} data-tone={item.tone ?? (item.value < 0 ? "red" : "teal")}>
      <div className={styles.labels}><span>{item.label}</span><strong>{item.displayValue}</strong></div>
      <div className={styles.barTrack} data-signed={signed || undefined} data-negative={item.value < 0 || undefined} aria-hidden="true">
        <span style={{ width: `${max > 0 ? Math.abs(finite(item.value)) / max * (signed ? 50 : 100) : 0}%` }} />
      </div>
    </li>)}</ul> : <p className={styles.hint}>{emptyLabel}</p>}
  </figure>;
}

/** Parts of one total; no fabricated proportions when the total is zero. */
export function KqAllocationBar({ label, items, emptyLabel = "Aucun montant à répartir." }: {
  label: string; items: KqVisualItem[]; emptyLabel?: string;
}) {
  const total = items.reduce((sum, item) => sum + Math.max(0, finite(item.value)), 0);
  const tones: KqVisualTone[] = ["teal", "gold", "ink", "red"];
  return <figure className={styles.chart}>
    <figcaption>{label}</figcaption>
    <div className={styles.allocation} aria-hidden="true">{items.map((item, index) => <span key={`${item.label}-${index}`}
      data-tone={item.tone ?? tones[index % tones.length]} style={{ width: `${total > 0 ? Math.max(0, finite(item.value)) / total * 100 : 0}%` }} />)}</div>
    {total === 0 ? <p className={styles.hint}>{emptyLabel}</p> : null}
    <ul className={styles.legend}>{items.map((item, index) => <li key={`${item.label}-${index}`} data-tone={item.tone ?? tones[index % tones.length]}>
      <span><i aria-hidden="true" />{item.label}</span><strong>{item.displayValue}</strong>
    </li>)}</ul>
  </figure>;
}
