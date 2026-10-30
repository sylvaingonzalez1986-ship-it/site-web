import type { ReactNode } from "react";
import { getKqLotSummary, type KqLotSummarySource } from "@/lib/kanab-quest-lot-summary";
import { KqProgressMeter } from "./KqVisuals";
import styles from "./KqLotSummary.module.css";

const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const dateLabel = (value: string) => new Date(value).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** A shared, unframed lot sheet. Screen-specific decisions stay beside their own costs. */
export function KqLotSummary({ source, level = 3, artwork, selected = false, compact = false, children }: {
  source: KqLotSummarySource; level?: 3 | 4; artwork?: ReactNode; selected?: boolean; compact?: boolean; children?: ReactNode;
}) {
  const lot = getKqLotSummary(source);
  const Heading = level === 4 ? "h4" : "h3";
  const details = <>
    {compact ? <p className={styles.reference}>Lot {lot.flowerId.slice(0, 8)}{lot.productId ? ` · produit ${lot.productId.slice(0, 8)}` : ""}{lot.harvestedAt ? <> · récolté le <time dateTime={lot.harvestedAt}>{dateLabel(lot.harvestedAt)}</time></> : " · date de récolte à confirmer"}</p> : null}
    <p className={styles.next}>{lot.next}</p>
    {children ? <div className={styles.actions}>{children}</div> : null}
    {lot.juryScore !== undefined ? compact ? <p className={styles.next}>Note du jury : {number(lot.juryScore)} / 10 au verdict. La conservation peut faire évoluer la qualité actuelle.</p> : <details className={styles.details}><summary>Note du jury</summary><p>{number(lot.juryScore)} / 10 au verdict. La conservation peut faire évoluer la qualité actuelle.</p></details> : null}
  </>;
  return <div className={styles.sheet} data-lot-summary={lot.flowerId}>
    <header className={styles.identity}>
      {artwork ? <div className={styles.artwork} aria-hidden="true">{artwork}</div> : null}
      <div><Heading>{lot.name}</Heading>{!compact ? <p className={styles.reference}>Lot {lot.flowerId.slice(0, 8)}{lot.harvestedAt ? <> · récolté le <time dateTime={lot.harvestedAt}>{dateLabel(lot.harvestedAt)}</time></> : " · date de récolte à confirmer"}</p> : null}
        {lot.productName ? <p className={styles.product}>{lot.productName}{lot.productId ? ` · produit ${lot.productId.slice(0, 8)}` : ""}</p> : null}
        {selected ? <span className={styles.selected}>Lot sélectionné</span> : null}
      </div>
    </header>
    <div className={styles.state} data-lot-state data-curing-status>{lot.state}</div>
    <dl className={styles.facts} data-harvest-facts>
      <div><dt>{lot.quantity.label}</dt><dd>{lot.quantity.grams === null ? "À confirmer" : <>{number(lot.quantity.grams)} g{lot.quantity.equivalent ? <small>équivalent fleurs</small> : null}</>}</dd></div>
      <div data-lot-quality><dt>{lot.quality.label}</dt><dd>{lot.quality.value === null ? "À confirmer" : <>{number(lot.quality.value)} <span>{lot.quality.unit}</span></>}</dd></div>
    </dl>
    {lot.quantity.equivalent ? <p className={styles.scope}>Hors paquets déjà emballés dans Commerce.</p> : null}
    {lot.progress !== null ? <div className={styles.progress} data-curing-progress><KqProgressMeter label="Affinage" value={lot.progress} max={100} valueLabel={`${Math.floor(lot.progress)} %`} /></div> : null}
    {lot.readyAt ? <p className={styles.timing}>{source.kind === "product" && source.stock.processingReadyAt === lot.readyAt ? "Fin de préparation" : "Fin d’affinage"} le <time dateTime={lot.readyAt}>{dateLabel(lot.readyAt)}</time></p> : null}
    {lot.exposedGrams !== null && lot.exposedGrams > 0 ? <p className={styles.warning}>{number(lot.exposedGrams)} g équivalent fleurs sans contenant · à ranger.</p> : null}
    {compact ? <details className={styles.details}><summary>Détails du lot et stockage</summary>{details}</details> : details}
  </div>;
}
