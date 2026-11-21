import { KqHelpDashboard, KqHelpGrid } from "./KqHelpDashboard";
import type { KqProcessingPlan, KqProcessingWorkQuote } from "@/lib/kanab-quest-processing-work";
import { isKqProcessingWorkQuote } from "@/lib/kanab-quest-processing-work";
import { KqProgressMeter } from "./KqVisuals";
import styles from "./KqPreparationSummary.module.css";

const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const hours = (value: number) => `${number(value)} h de jeu`;
const realTime = (value: number) => `${number(value * 10)} min réelles`;

/** Server quantities are kept identical in the preview and confirmation. */
export function KqProcessingWorkSummary({ plan, quote: suppliedQuote }: { plan: KqProcessingPlan; quote?: KqProcessingWorkQuote }) {
  const candidate = suppliedQuote ?? plan.quote;
  const quote = isKqProcessingWorkQuote(candidate) ? candidate : undefined;
  const effectiveRate = quote && plan.nominalHours > 0 ? plan.inputGrams / plan.nominalHours * quote.efficiency : undefined;
  return <div className={styles.summary} data-processing-work-summary data-work-source={quote?.source ?? "unavailable"}>
    <dl className={styles.terms}>
      <div><dt>Cadence effective estimée</dt><dd>{effectiveRate === undefined ? "À confirmer" : `${number(effectiveRate)} g de fleurs/h de jeu`}<small>Toutes les étapes et la compétence comprises</small></dd></div>
      {quote ? <>
        <div><dt>Qui travaille</dt><dd>{quote.employee?.name ?? (quote.source === "player" ? "Toi" : "Travail en attente")}{quote.employee ? <small>Niveau {quote.employee.level} · {hours(quote.employee.remainingHours)} disponibles avant confirmation</small> : null}</dd></div>
        <div><dt>Heures réservées maintenant</dt><dd>{hours(quote.bookedHours)}<small>Arrondies à la demi-heure</small><small>Travail actif couvert : {hours(quote.activeHours)} · {realTime(quote.activeHours)} estimées</small></dd></div>
        <div><dt>Tes heures consommées</dt><dd>{quote.source === "player" ? hours(quote.bookedHours) : "0 h"}{quote.employee ? <small>Prélevées sur la réserve de {quote.employee.name}</small> : null}</dd></div>
      </> : <div><dt>Heures et personne</dt><dd>Devis indisponible<small>Actualise le lot avant de confirmer.</small></dd></div>}
      <div><dt>Attente autonome en fin de lot</dt><dd>{hours(plan.passiveHours)}<small>{plan.passiveHours > 0 ? `${realTime(plan.passiveHours)} estimées · aucune heure de travail consommée` : "Aucune attente autonome prévue"}</small></dd></div>
      {plan.machines.map(machine => machine.handling && <div key={machine.code}><dt>Chargement estimé · {machine.handling.charges} {machine.handling.charges === 1 ? "charge" : "charges"}</dt>
        <dd>{realTime(machine.handling.baseHours)}{machine.handling.hours < machine.handling.baseHours && <> → {realTime(machine.handling.hours)}<small>Durées au poste, avant et avec le chariot</small></>}</dd>
      </div>)}
    </dl>
    {quote && quote.fundedGrams > 0 ? <KqProgressMeter label="Volume couvert par cette réservation" value={quote.fundedGrams} max={quote.inputGrams} valueLabel={`${number(quote.fundedGrams)} g / ${number(quote.inputGrams)} g`} hint="Vente après la fin complète du lot." /> : null}
    {quote?.blockedReason ? <p role="status" className={styles.remainder}>{quote.blockedReason}</p> : null}
    {quote?.employee ? <p className={styles.remainder}>À la fin du travail réservé, tu peux choisir qui prend la suite. Tes heures restent intactes tant que tu ne choisis pas ton personnage.</p> : null}
    <details className={styles.sources} data-processing-rates><summary>Cadences de jeu</summary><KqHelpDashboard>
      <p>1 h de jeu correspond à 10 min réelles.</p>
      {plan.machines.map(machine => <section key={machine.code}>
        <h4>{machine.name}</h4>
        <KqHelpGrid art="help-workshop" items={[
          { label: "Cadence de jeu estimée", value: machine.gramsPerHour === null ? "Attente autonome" : `${number(machine.gramsPerHour)} g/h de jeu`, art: "help-time" },
          { label: "Matière", value: machine.material, art: "harvest" },
        ]} />
      </section>)}
    </KqHelpDashboard></details>
  </div>;
}
