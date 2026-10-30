import { ArrowRight } from "lucide-react";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import type { KqMarketQuote } from "@/lib/kanab-quest-market";
import styles from "./KqPreparationSummary.module.css";

export type KqPreparationReview = { quote: KqMarketQuote; costCents: number };
const grams = (value: number) => `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} g`;

/** The same quoted quantities and cost stay visible before and during confirmation. */
export function KqPreparationSummary({ quote, costCents }: KqPreparationReview) {
  const transformed = quote.family === "hash" || quote.family === "rosin";
  const duration = quote.processingDurationSeconds;
  return <div className={styles.summary} data-preparation-summary>
    <dl className={styles.quantities}>
      {transformed ? <><div><dt>Fleurs utilisées</dt><dd>{grams(quote.processedInputGrams)}</dd></div><ArrowRight aria-hidden="true" size={20} /></> : null}
      <div><dt>{transformed ? "Produit prévu" : quote.route === "raw" ? "Fleurs entières" : "Biomasse"}</dt><dd>{grams(quote.productGrams)}</dd></div>
    </dl>
    {quote.remainderGrams > 0 ? <p className={styles.remainder}>{grams(quote.remainderGrams)} {quote.remainderDestination === "biomass" ? "de biomasse" : quote.remainderDestination === "raw" ? "de fleurs" : "de reste à affecter"} conservés séparément.</p> : null}
    <dl className={styles.terms}>
      <div><dt>Coût prévu</dt><dd>{formatKqCash(costCents)}<small>{costCents > 0 ? "Débité à la confirmation" : "Sans frais de préparation"}</small></dd></div>
      <div><dt>Temps de travail</dt><dd>{!transformed ? "Sans passage en atelier" : duration === undefined || !Number.isFinite(duration) || duration < 0 ? "Durée à confirmer" : duration > 0 ? `${Math.ceil(duration / 60).toLocaleString("fr-FR")} min réelles` : "Sans attente annoncée"}
        {transformed && duration !== undefined && duration > 0 ? <small>Hors attente des lots déjà en atelier</small> : null}</dd></div>
    </dl>
  </div>;
}
