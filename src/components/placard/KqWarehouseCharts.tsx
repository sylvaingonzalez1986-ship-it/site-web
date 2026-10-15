import styles from "./KqWarehouseCharts.module.css";

export type WarehouseChartRow = {
  id: string;
  label: string;
  value: number;
  displayValue: string;
  note?: string;
  tone?: "green" | "amber" | "blue" | "slate" | "danger";
};

const quantity = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;

export function WarehouseBars({ label, rows, max }: { label: string; rows: WarehouseChartRow[]; max?: number }) {
  const ceiling = Math.max(quantity(max ?? 0), ...rows.map(row => quantity(row.value)), 0);
  return <dl className={styles.bars} aria-label={label}>
    {rows.map(row => <div className={styles.row} key={row.id} data-tone={row.tone ?? "green"}>
      <dt>{row.label}</dt>
      <dd><strong>{row.displayValue}</strong></dd>
      <dd className={styles.track} aria-hidden="true"><span style={{ width: `${ceiling ? quantity(row.value) / ceiling * 100 : 0}%` }} /></dd>
      {row.note && <dd className={styles.note}>{row.note}</dd>}
    </div>)}
  </dl>;
}

export function WarehouseStackedBar({ label, segments }: { label: string; segments: WarehouseChartRow[] }) {
  const total = segments.reduce((sum, segment) => sum + quantity(segment.value), 0);
  return <div className={styles.stacked} role="group" aria-label={label}>
    <div className={styles.stackTrack} aria-hidden="true">{segments.filter(segment => quantity(segment.value) > 0).map(segment => <span key={segment.id} data-tone={segment.tone ?? "green"} style={{ width: `${total ? quantity(segment.value) / total * 100 : 0}%` }} />)}</div>
    <dl className={styles.legend}>{segments.map(segment => <div key={segment.id} data-tone={segment.tone ?? "green"}>
      <dt><i aria-hidden="true" />{segment.label}</dt>
      <dd><strong>{segment.displayValue}</strong><span>{total ? Math.round(quantity(segment.value) / total * 100) : 0} %</span></dd>
      {segment.note && <dd className={styles.note}>{segment.note}</dd>}
    </div>)}</dl>
  </div>;
}
