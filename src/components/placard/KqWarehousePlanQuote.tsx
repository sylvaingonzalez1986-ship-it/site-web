import type { ReactNode } from "react";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { KQ_LAB_ANALYSIS_CENTS, KQ_VAT_PERCENT, type KqCultureBudget } from "@/lib/kanab-quest-business";
import type { KqWarehouseQuote, KqWarehouseState } from "@/lib/kanab-quest-warehouse";
import { getKqWarehousePlanChanges, getKqWarehousePlanPayment } from "@/lib/kanab-quest-warehouse-plan-review";
import { KQ_WAREHOUSE_STATIONS, isKqWarehouseStationCode } from "@/lib/kanab-quest-warehouse-stations";
import { KqInvestmentPayback } from "./KqInvestmentPayback";
import { KqBarChart } from "./KqVisuals";
import styles from "./KqWarehousePlanQuote.module.css";

type Props = {
  previousState: KqWarehouseState;
  draftState: KqWarehouseState;
  quote: KqWarehouseQuote | null;
  cashCents: number;
  migrationCreditCents: number;
  cultureBudget?: KqCultureBudget;
  installedCultureBudget?: KqCultureBudget;
  potentialGrams?: { installed: number; proposed: number };
  children?: ReactNode;
  aside?: ReactNode;
  compact?: boolean;
};

const statusLabels = { added: "À ajouter", changed: "À modifier", removed: "À retirer" } as const;
const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

export function KqWarehousePlanQuote({ previousState, draftState, quote, cashCents, migrationCreditCents, cultureBudget, installedCultureBudget, potentialGrams, children, aside, compact = false }: Props) {
  const payment = getKqWarehousePlanPayment(quote, cashCents, migrationCreditCents);
  const changes = getKqWarehousePlanChanges(previousState, draftState);
  const addingAirlock = draftState.stationPlacements?.some(item => item.code === "SIM-HYGIENE-03")
    && !previousState.stationPlacements?.some(item => item.code === "SIM-HYGIENE-03");
  const recurringDifference = cultureBudget && installedCultureBudget ? cultureBudget.reserveCents - installedCultureBudget.reserveCents : null;
  const compare = !compact && payment.payableCents !== null && payment.payableCents > 0 && cultureBudget && installedCultureBudget
    && installedCultureBudget.lotCount > 0 && cultureBudget.lotCount > 0 && potentialGrams && recurringDifference !== null;
  return <section className={`${styles.sheet} ${compact ? styles.compact : ""}`} aria-label="Devis du plan" data-warehouse-plan-quote>
    <div className={styles.heading}><h3>Devis du plan</h3><p>{changes.zoneChanges.length > 0 ? `${changes.zoneChanges.length} zone${changes.zoneChanges.length > 1 ? "s concernées" : " concernée"} · toutes les modifications non enregistrées.` : "Toutes les modifications non enregistrées."}</p></div>
    {addingAirlock && <p className={styles.note}>Sas d’entretien à installer à la porte sud · pose comprise.</p>}
    <dl className={styles.payment}>
      <div className={styles.payable}><dt>À payer maintenant</dt><dd data-warehouse-plan-payable-cents={payment.payableCents ?? undefined}>{payment.payableCents === null ? "À calculer" : formatKqCash(payment.payableCents)}</dd></div>
      <div><dt>En caisse après travaux</dt><dd data-warehouse-plan-cash-after-cents={payment.cashAfterCents ?? undefined}>{payment.cashAfterCents === null ? payment.shortfallCents ? "Fonds insuffisants" : "À calculer" : formatKqCash(payment.cashAfterCents)}</dd></div>
    </dl>
    {!!payment.shortfallCents && <p className={styles.shortfall} role="status" data-warehouse-plan-shortfall-cents={payment.shortfallCents}>Il manque <strong>{formatKqCash(payment.shortfallCents)}</strong>. Trésorerie disponible : {formatKqCash(cashCents)}.</p>}
    {!quote && <p className={styles.note}>Le montant sera disponible dès que le plan sera valide.</p>}
    {!!payment.creditUsedCents && <p className={styles.note}>{formatKqCash(payment.creditUsedCents)} de crédit de reprise déjà déduits.</p>}
    {quote && cultureBudget && cultureBudget.lotCount > 0 && <dl className={styles.reserve} aria-label="Budget du prochain cycle">
      <div><dt>Énergie et fournitures</dt><dd data-warehouse-plan-operating-cost-cents={cultureBudget.committedCents}>{formatKqCash(cultureBudget.committedCents)}</dd></div>
      <div><dt>{cultureBudget.lotCount === 1 ? "Analyse éventuelle à la récolte" : "Analyses éventuelles à la récolte"}{cultureBudget.lotCount > 1 && <small>{cultureBudget.lotCount} × {formatKqCash(KQ_LAB_ANALYSIS_CENTS)} par lot</small>}</dt><dd data-warehouse-plan-analysis-cents={cultureBudget.analysisCents}>{formatKqCash(cultureBudget.analysisCents)}</dd></div>
      {payment.cashAfterCents !== null && <div className={styles.total}><dt>Disponible après réserve complète</dt><dd data-warehouse-plan-cash-after-reserve-cents={payment.cashAfterCents - cultureBudget.reserveCents}>{formatKqCash(payment.cashAfterCents - cultureBudget.reserveCents)}</dd></div>}
    </dl>}
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
          {quote.purchases.length + quote.optionPurchases.length > 0 ? <div className={styles.purchases}><h4>Achats neufs du plan</h4><ul>{quote.purchases.map(line => <li key={line.code}><span>{number(line.quantity)} × {line.device.name}</span><strong>{formatKqCash(line.totalCents)}</strong></li>)}{quote.optionPurchases.map(line => <li key={line.code}><span>{number(line.quantity)} {line.unit ? "×" : "m² ·"} {line.unit === "station" && isKqWarehouseStationCode(line.code) ? KQ_WAREHOUSE_STATIONS[line.code].name : line.option.name}</span><strong>{formatKqCash(line.totalCents)}</strong></li>)}</ul></div> : <p className={styles.note}>Aucun matériel neuf à acheter.</p>}
          <p className={styles.note}>La réserve de matériel est réutilisée avant tout achat.</p>
          {cultureBudget && cultureBudget.lotCount > 0 && <><dl className={styles.invoice}>
            <div><dt>Électricité <small>Facturée à la récolte ou si la culture meurt.</small></dt><dd>{formatKqCash(cultureBudget.energyCostCents)}</dd></div>
            <div><dt>Fournitures <small>Engagées au semis, à régler sous 5 jours réels.</small></dt><dd>{formatKqCash(cultureBudget.consumablesCostCents)}</dd></div>
          </dl><p className={styles.note}>Analyse si cette zone va à la récolte et produit un lot, à régler sous 5 jours réels. Les soins facultatifs se paient séparément. À la vente, la TVA de jeu est de {KQ_VAT_PERCENT} % du prix HT et les frais suivent le canal choisi.</p></>}
        </>}
      </div>
    </details>
    {compare && <details className={styles.details} data-warehouse-investment>
      <summary>Comparer avec le plan installé</summary>
      <div className={styles.detailBody}>
        <KqBarChart title="Potentiel matériel par cycle" items={[
          { label: "Garder le plan", value: potentialGrams.installed, displayValue: `${number(potentialGrams.installed)} g` },
          { label: "Installer le devis", value: potentialGrams.proposed, displayValue: `${number(potentialGrams.proposed)} g`, tone: "gold" },
        ]} />
        <dl className={styles.invoice}>
          <div><dt>Travaux à payer</dt><dd>{formatKqCash(payment.payableCents!)}</dd></div>
          <div><dt>Charges par cycle complet</dt><dd>{formatKqCash(installedCultureBudget.reserveCents)} → {formatKqCash(cultureBudget.reserveCents)}</dd></div>
          <div><dt>Écart de marge à recette nette égale</dt><dd data-investment-same-sale-margin-cents={-recurringDifference}>{recurringDifference < 0 ? "+" : ""}{formatKqCash(-recurringDifference)}</dd></div>
          <div><dt>Travail libéré en culture</dt><dd>0 h de jeu à étapes égales</dd></div>
        </dl>
        <p className={styles.note}>Les étapes de culture sont communes aux zones. Les lots supplémentaires demandent leur propre trim et leur mise en vente.</p>
        <KqInvestmentPayback investmentCents={payment.payableCents!} extraCostCents={recurringDifference} unit="cycle" />
      </div>
    </details>}
    {aside && <div className={styles.aside}>{aside}</div>}
    {children && <div className={styles.actions}>{children}</div>}
  </section>;
}
