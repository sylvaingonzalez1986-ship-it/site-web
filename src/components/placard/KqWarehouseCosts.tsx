import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { KQ_LAB_ANALYSIS_CENTS, type KqCultureBudget } from "@/lib/kanab-quest-business";
import {
  KQ_WAREHOUSE_SIMULATION,
  type KqWarehouseQuote,
} from "@/lib/kanab-quest-warehouse";
import { getKqWarehousePlanPayment } from "@/lib/kanab-quest-warehouse-plan-review";
import { WarehouseBars, WarehouseStackedBar } from "./KqWarehouseCharts";
import styles from "./KqWarehouseCosts.module.css";

type Props = {
  budget?: KqCultureBudget;
  quote: KqWarehouseQuote | null;
  dirty: boolean;
  migrationCreditCents: number;
};

const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

export function KqWarehouseCosts({ budget, quote, dirty, migrationCreditCents }: Props) {
  const availableCredit = Math.max(0, migrationCreditCents);
  const { creditUsedCents, payableCents } = getKqWarehousePlanPayment(quote, 0, availableCredit);

  return (
    <div className={styles.grid}>
      <section className={styles.panel} aria-label="Charges de culture">
        <div className={styles.heading}>
          <h4>Charges par cycle</h4>
          <span>{dirty ? "Aperçu du plan modifié" : "Estimation du plan actuel"}</span>
        </div>
        {budget && budget.lotCount > 0 ? <>
          <div className={styles.total} data-warehouse-operating-cost-cents={budget.committedCents}>
            <strong>{formatKqCash(budget.reserveCents)}</strong>
            <span>à prévoir pour {budget.lotCount} {budget.lotCount === 1 ? "zone de culture" : "zones de culture"}</span>
          </div>
          <WarehouseStackedBar
          label="Répartition de la réserve par cycle"
          segments={[
            {
              id: "energy",
              label: "Électricité",
              value: budget.energyCostCents,
              displayValue: formatKqCash(budget.energyCostCents),
              note: "Facturée à la récolte ou si la culture meurt",
              tone: "amber",
            },
            {
              id: "supplies",
              label: "Fournitures",
              value: budget.consumablesCostCents,
              displayValue: formatKqCash(budget.consumablesCostCents),
              note: "Engagées au semis · règlement sous 5 jours réels",
              tone: "green",
            },
            {
              id: "analysis",
              label: "Analyses éventuelles",
              value: budget.analysisCents,
              displayValue: formatKqCash(budget.analysisCents),
              note: `${formatKqCash(KQ_LAB_ANALYSIS_CENTS)} par lot terminé · règlement sous 5 jours réels`,
              tone: "blue",
            },
          ]}
        />
          <p className={styles.note}>Énergie et fournitures · {formatKqCash(budget.committedCents)}. Soins facultatifs et retenues à la vente en supplément.</p>
        </> : <p className={styles.note}>Active et équipe une zone disponible pour calculer ses charges.</p>}
      </section>

      <section className={styles.panel} aria-label={dirty ? "Coût des modifications" : "Tarifs d’aménagement"}>
        <div className={styles.heading}>
          <h4>{dirty ? "Ce plan à installer" : "Aménager l’entrepôt"}</h4>
          <span>{dirty ? "Achat ponctuel" : "Tarifs de simulation"}</span>
        </div>
        {dirty && quote ? (
          <>
            <WarehouseBars
              label="Détail du coût des modifications"
              rows={[
                {
                  id: "equipment",
                  label: "Matériel neuf",
                  value: quote.equipmentCostCents,
                  displayValue: formatKqCash(quote.equipmentCostCents),
                  note: quote.optionEquipmentCostCents > 0 ? `Dont ${formatKqCash(quote.optionEquipmentCostCents)} de modules` : undefined,
                  tone: "green",
                },
                {
                  id: "preparation",
                  label: "Aménagement",
                  value: quote.preparationCostCents,
                  displayValue: formatKqCash(quote.preparationCostCents),
                  note: `${number(quote.addedAreaM2)} m² à aménager`,
                  tone: "blue",
                },
                {
                  id: "installation",
                  label: "Pose",
                  value: quote.installationCostCents,
                  displayValue: formatKqCash(quote.installationCostCents),
                  note: `${KQ_WAREHOUSE_SIMULATION.installationPercent} % du matériel à installer`,
                  tone: "amber",
                },
              ]}
            />
            <dl className={styles.invoice}>
              <div><dt>Total des modifications</dt><dd>{formatKqCash(quote.totalCostCents)}</dd></div>
              {!!creditUsedCents && <div><dt>Crédit de reprise utilisé</dt><dd>− {formatKqCash(creditUsedCents)}</dd></div>}
              {payableCents !== null && <div className={styles.payable} data-warehouse-draft-payable-cents={payableCents}><dt>À payer maintenant</dt><dd>{formatKqCash(payableCents)}</dd></div>}
            </dl>
          </>
        ) : (
          <>
            {dirty && <p className={styles.note}>Le devis sera disponible dès que le plan sera valide.</p>}
            <dl className={styles.rates}>
              <div><dt>Aménagement</dt><dd>{formatKqCash(KQ_WAREHOUSE_SIMULATION.preparationCentsPerM2)}<small>/m² ajouté</small></dd></div>
              <div><dt>Pose</dt><dd>{KQ_WAREHOUSE_SIMULATION.installationPercent} %<small>du matériel à installer</small></dd></div>
            </dl>
            {availableCredit > 0 && (
              <div className={styles.credit}>
                <span>Crédit de reprise disponible</span>
                <strong>{formatKqCash(availableCredit)}</strong>
                <small>Déduit avant tout prélèvement.</small>
              </div>
            )}
          </>
        )}
        <p className={styles.note}>Le matériel en réserve est réutilisé avant tout nouvel achat.</p>
      </section>
    </div>
  );
}
