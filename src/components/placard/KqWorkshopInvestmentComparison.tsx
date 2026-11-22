import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { getKqWorkshopInvestmentComparison } from "@/lib/kanab-quest-investment";
import { KqInvestmentPayback } from "./KqInvestmentPayback";
import { KqBarChart } from "./KqVisuals";
import styles from "./KqInvestmentPayback.module.css";

const hours = (value: number) => value > 0 && value < .001 ? "moins de 0,001 h de jeu" : `${value.toLocaleString("fr-FR", { maximumFractionDigits: 3 })} h de jeu`;

export function KqWorkshopInvestmentComparison({ code, level, targetLevel, priceCents }: {
  code: string; level: number; targetLevel: number; priceCents: number;
}) {
  const comparison = getKqWorkshopInvestmentComparison(code, level, targetLevel);
  if (!comparison) return null;
  return <details className={styles.comparison} data-machine-investment={code} data-machine-investment-price-cents={priceCents}>
    <summary>Comparer avec la machine actuelle</summary>
    <KqBarChart title={`Travail estimé au poste · ${comparison.grams} g (${comparison.material})`} items={[
      { label: `Garder le niveau ${level}`, value: comparison.currentHours, displayValue: hours(comparison.currentHours) },
      { label: `Passer au niveau ${targetLevel}`, value: comparison.targetHours, displayValue: hours(comparison.targetHours), tone: "gold" },
    ]} />
    <dl className={styles.workshopRows}>
      <div><dt>Surcoût à payer</dt><dd>{formatKqCash(priceCents)}</dd></div>
      <div><dt>Travail libéré par lot</dt><dd data-machine-saved-hours={comparison.savedHours}>{hours(comparison.savedHours)}</dd></div>
      {comparison.passiveHours > 0 && <div><dt>Attente autonome dans les deux cas</dt><dd>{hours(comparison.passiveHours)}</dd></div>}
    </dl>
    <p>Estimation avant les compétences de la personne au poste. Renseigne le gain net que tu attends pour calculer l’amortissement.</p>
    <KqInvestmentPayback investmentCents={priceCents} unit="lot" />
  </details>;
}
