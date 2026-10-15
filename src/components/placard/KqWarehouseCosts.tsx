import { formatKqCash } from "@/lib/kanab-quest-equipment";
import {
  KQ_WAREHOUSE_SIMULATION,
  type KqWarehouseQuote,
  type KqWarehouseSummary,
} from "@/lib/kanab-quest-warehouse";
import { WarehouseBars, WarehouseStackedBar } from "./KqWarehouseCharts";
import styles from "./KqWarehouseCosts.module.css";

type Props = {
  summary: KqWarehouseSummary;
  quote: KqWarehouseQuote | null;
  dirty: boolean;
  migrationCreditCents: number;
};

const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

export function KqWarehouseCosts({ summary, quote, dirty, migrationCreditCents }: Props) {
  const availableCredit = Math.max(0, migrationCreditCents);
  const creditUsed = Math.min(availableCredit, quote?.totalCostCents ?? 0);
  const payable = Math.max(0, (quote?.totalCostCents ?? 0) - creditUsed);

  return (
    <div className={styles.grid}>
      <section className={styles.panel} aria-label="Charges de culture">
        <div className={styles.heading}>
          <h4>Charges par cycle</h4>
          <span>{dirty ? "Aperçu du plan modifié" : "Estimation du plan actuel"}</span>
        </div>
        <div className={styles.total} data-warehouse-operating-cost-cents={summary.operatingCostCents}>
          <strong>{formatKqCash(summary.operatingCostCents)}</strong>
          <span>pour {number(summary.activeAreaM2)} m² de culture actifs</span>
        </div>
        {summary.activeAreaM2 === 0 && <p className={styles.note}>Active une zone de culture pour estimer ses charges.</p>}
        <WarehouseStackedBar
          label="Répartition des charges par cycle"
          segments={[
            {
              id: "energy",
              label: "Électricité",
              value: summary.energyCostCents,
              displayValue: formatKqCash(summary.energyCostCents),
              note: `${number(summary.energyKwh)} kWh · règlement en fin de culture`,
              tone: "amber",
            },
            {
              id: "supplies",
              label: "Fournitures",
              value: summary.consumablesCostCents,
              displayValue: formatKqCash(summary.consumablesCostCents),
              note: "Facturées à 30 jours de jeu, soit 5 jours réels",
              tone: "green",
            },
          ]}
        />
        <p className={styles.note}>Électricité : {formatKqCash(KQ_WAREHOUSE_SIMULATION.electricityCentsPerKwh)}/kWh. Montants et durées de simulation.</p>
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
                  note: `${KQ_WAREHOUSE_SIMULATION.installationPercent} % du matériel acheté`,
                  tone: "amber",
                },
              ]}
            />
            <dl className={styles.invoice}>
              <div><dt>Total des modifications</dt><dd>{formatKqCash(quote.totalCostCents)}</dd></div>
              {creditUsed > 0 && <div><dt>Crédit de reprise utilisé</dt><dd>− {formatKqCash(creditUsed)}</dd></div>}
              <div className={styles.payable} data-warehouse-draft-payable-cents={payable}><dt>À payer</dt><dd>{formatKqCash(payable)}</dd></div>
            </dl>
          </>
        ) : (
          <>
            {dirty && <p className={styles.note}>Le devis sera disponible dès que le plan sera valide.</p>}
            <dl className={styles.rates}>
              <div><dt>Aménagement</dt><dd>{formatKqCash(KQ_WAREHOUSE_SIMULATION.preparationCentsPerM2)}<small>/m² ajouté</small></dd></div>
              <div><dt>Pose</dt><dd>{KQ_WAREHOUSE_SIMULATION.installationPercent} %<small>du matériel acheté</small></dd></div>
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
