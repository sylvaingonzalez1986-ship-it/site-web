import type { ReactNode } from "react";
import { ChevronDown, ListFilter } from "lucide-react";
import { KqProgressMeter } from "./KqVisuals";
import styles from "./KqAlbumTools.module.css";

export function KqAlbumSummary({ label, owned, total, quantity, quantityLabel }: {
  label: string;
  owned: number | null;
  total: number;
  quantity: number | null;
  quantityLabel: string;
}) {
  return <section className={styles.summary} aria-label="État de la collection">
    {owned !== null && total > 0
      ? <KqProgressMeter label={label} value={owned} max={total} />
      : <div className={styles.quantity}><span>{label}</span><strong>{owned ?? "Indisponible"}</strong></div>}
    <div className={styles.quantity}><span>{quantityLabel}</span><strong>{quantity ?? "Indisponible"}</strong></div>
  </section>;
}

export function KqAlbumSearch({ children, active, matches }: {
  children: ReactNode;
  active: boolean;
  matches: number | null;
}) {
  return <details className={styles.searchTools}>
    <summary><ListFilter size={18} aria-hidden /><span>Rechercher et filtrer</span>
      {active && matches !== null ? <span className={styles.count} role="status">{matches} résultat{matches > 1 ? "s" : ""}</span> : null}
      <ChevronDown size={16} aria-hidden />
    </summary>
    <div className={styles.fields}>{children}</div>
  </details>;
}
