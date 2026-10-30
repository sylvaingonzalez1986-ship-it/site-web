import type { ReactNode } from "react";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import type { KqWarehouseQuote, KqWarehouseState } from "@/lib/kanab-quest-warehouse";
import { getKqWarehousePlanChanges, getKqWarehousePlanPayment } from "@/lib/kanab-quest-warehouse-plan-review";
import styles from "./KqWarehousePlanQuote.module.css";

type Props = {
  previousState: KqWarehouseState;
  draftState: KqWarehouseState;
  quote: KqWarehouseQuote | null;
  cashCents: number;
  migrationCreditCents: number;
  children?: ReactNode;
  aside?: ReactNode;
  compact?: boolean;
};

const statusLabels = { added: "À ajouter", changed: "À modifier", removed: "À retirer" } as const;
const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

export function KqWarehousePlanQuote({ previousState, draftState, quote, cashCents, migrationCreditCents, children, aside, compact = false }: Props) {
  const payment = getKqWarehousePlanPayment(quote, cashCents, migrationCreditCents);
  const changes = getKqWarehousePlanChanges(previousState, draftState);
  return <section className={`${styles.sheet} ${compact ? styles.compact : ""}`} aria-label="Devis du plan" data-warehouse-plan-quote>
    <div className={styles.heading}><h3>Devis du plan</h3><p>{changes.zoneChanges.length > 0 ? `${changes.zoneChanges.length} zone${changes.zoneChanges.length > 1 ? "s concernées" : " concernée"} · toutes les modifications non enregistrées.` : "Toutes les modifications non enregistrées."}</p></div>
    <dl className={styles.payment}>
      <div className={styles.payable}><dt>À payer maintenant</dt><dd data-warehouse-plan-payable-cents={payment.payableCents ?? undefined}>{payment.payableCents === null ? "À calculer" : formatKqCash(payment.payableCents)}</dd></div>
      <div><dt>Trésorerie après</dt><dd>{payment.cashAfterCents === null ? payment.shortfallCents ? "Fonds insuffisants" : "À calculer" : formatKqCash(payment.cashAfterCents)}</dd></div>
    </dl>
    {!!payment.shortfallCents && <p className={styles.shortfall} role="status" data-warehouse-plan-shortfall-cents={payment.shortfallCents}>Il manque <strong>{formatKqCash(payment.shortfallCents)}</strong>. Trésorerie disponible : {formatKqCash(cashCents)}.</p>}
    {!quote && <p className={styles.note}>Le montant sera disponible dès que le plan sera valide.</p>}
    {!!payment.creditUsedCents && <p className={styles.note}>{formatKqCash(payment.creditUsedCents)} de crédit de reprise déjà déduits.</p>}
    <details className={styles.details} data-warehouse-plan-quote-details data-warehouse-quote-details>
      <summary>Modifications et détail du prix</summary>
      <div className={styles.detailBody}>
        {changes.zoneChanges.length > 0 && <ul className={styles.changes} aria-label="Zones concernées">{changes.zoneChanges.map(change => <li key={change.id} data-warehouse-plan-zone-change={change.id} data-change-status={change.status}>
          <div><strong>{change.label} · {change.kind}</strong><span>{statusLabels[change.status]}</span></div>
          {change.previousLabel && <p>{change.previousLabel} dans le plan enregistré.</p>}
          {change.status === "removed" && <p>Numéro du plan enregistré.</p>}
          <p>{change.details.join(" · ")}</p>
        </li>)}</ul>}
        {changes.otherChanges.map(change => <p key={change} className={styles.note}>{change}</p>)}
        {!changes.zoneChanges.length && !changes.otherChanges.length && <p className={styles.note}>Aucune modification de zone ou de matériel.</p>}
        {quote && <>
          <dl className={styles.invoice}>
            <div><dt>Matériel neuf</dt><dd>{formatKqCash(quote.equipmentCostCents)}</dd></div>
            <div><dt>Aménagement <small>{number(quote.addedAreaM2)} m² supplémentaires</small></dt><dd>{formatKqCash(quote.preparationCostCents)}</dd></div>
            <div><dt>Pose</dt><dd>{formatKqCash(quote.installationCostCents)}</dd></div>
            <div className={styles.total}><dt>Total des modifications</dt><dd data-warehouse-plan-total-cents={quote.totalCostCents}>{formatKqCash(quote.totalCostCents)}</dd></div>
            {!!payment.creditUsedCents && <div><dt>Crédit de reprise</dt><dd data-warehouse-plan-credit-cents={payment.creditUsedCents}>− {formatKqCash(payment.creditUsedCents)}</dd></div>}
          </dl>
          {quote.purchases.length + quote.optionPurchases.length > 0 ? <div className={styles.purchases}><h4>Achats neufs du plan</h4><ul>{quote.purchases.map(line => <li key={line.code}><span>{number(line.quantity)} × {line.device.name}</span><strong>{formatKqCash(line.totalCents)}</strong></li>)}{quote.optionPurchases.map(line => <li key={line.code}><span>{number(line.quantity)} m² · {line.option.name}</span><strong>{formatKqCash(line.totalCents)}</strong></li>)}</ul></div> : <p className={styles.note}>Aucun matériel neuf à acheter.</p>}
          <p className={styles.note}>La réserve est réutilisée avant tout achat. Les charges de culture sont facturées séparément.</p>
        </>}
      </div>
    </details>
    {aside && <div className={styles.aside}>{aside}</div>}
    {children && <div className={styles.actions}>{children}</div>}
  </section>;
}
