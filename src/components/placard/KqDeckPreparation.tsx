import { getKqDeckPreparation, type KqDeckPreparationInput } from "@/lib/kanab-quest-deck-preparation";
import { getKqStageDisplayName } from "@/lib/kanab-quest-game";
import { KqProgressMeter } from "./KqVisuals";
import styles from "./KqDeckPreparation.module.css";

export function KqDeckPreparation({ deckCodes, inventory, startingXp, loading = false, error = "" }: KqDeckPreparationInput & {
  loading?: boolean;
  error?: string;
}) {
  const deck = getKqDeckPreparation({ deckCodes, inventory, startingXp });
  const stockKnown = inventory !== null;
  return <section className={styles.preparation} data-deck-preparation aria-label="Bilan des cartes choisies">
    <dl className={styles.numbers}>
      <div><dt>Copies choisies</dt><dd data-deck-copies>{deck.copies}<small>{deck.references} référence{deck.references > 1 ? "s" : ""}</small></dd></div>
      <div><dt>Première main</dt><dd data-deck-opening-hand>{!stockKnown || deck.missingCopies ? "À vérifier" : deck.openingHandSize}<small>sur {deck.handCapacity} maximum</small></dd></div>
      <div><dt>XP au départ</dt><dd data-deck-starting-xp>{startingXp === null ? "À vérifier" : `${startingXp} XP`}<small>{startingXp === null ? "Bonus non confirmés" : "Partagés entre tes cartes"}</small></dd></div>
    </dl>
    <div className={styles.reading} aria-live="polite">
      {!stockKnown ? <p data-deck-stock-status>{error ? "Stock indisponible : les copies choisies restent à vérifier." : loading ? "Vérification des copies disponibles…" : "Stock non vérifié."}</p>
        : deck.missingCopies ? <p className={styles.warning} data-deck-stock-status>{deck.missingCopies} copie{deck.missingCopies > 1 ? "s" : ""} manquante{deck.missingCopies > 1 ? "s" : ""}. Ajuste ta sélection avant de commencer.</p> : null}
      <p data-deck-cost-summary>{!deck.copies ? "Tu peux cultiver sans carte de soutien."
        : startingXp === null ? "Les coûts restent visibles sur les cartes. Leur accessibilité sera précisée une fois les bonus confirmés."
          : !stockKnown ? "Les coûts restent visibles sur les cartes. Leur accessibilité sera précisée après vérification du stock."
            : <><strong>{deck.affordableCopies} copie{deck.affordableCopies !== 1 ? "s" : ""}</strong> coûte{deck.affordableCopies === 1 ? "" : "nt"} au plus {startingXp} XP chacune. {deck.expensiveCopies ? `${deck.expensiveCopies} demande${deck.expensiveCopies === 1 ? "" : "nt"} plus d’XP.` : null}</>}</p>
      {deck.copies > 0 ? <p className={styles.hint}>Coûts pris individuellement : les XP sont partagés. Il faut aussi le bon incident et le bon moment.</p> : null}
      {deck.copies > deck.handCapacity && stockKnown && !deck.missingCopies ? <p className={styles.hint}>Première main : {deck.handCapacity} copies tirées parmi les {deck.copies} choisies.</p> : null}
    </div>
    <details className={styles.details} data-deck-compatibility>
      <summary><strong>Compatibilités · 6 étapes</strong><span>{deck.coverage.compatibleCount} / {deck.coverage.total} incidents</span></summary>
      <p>{stockKnown ? "Parmi tes copies disponibles, au moins une carte correspond à ces incidents." : "Compatibilité de la sélection ; le stock reste à vérifier."} Ce ne sont pas des probabilités de tirage ni des garanties de réussite.</p>
      <div className={styles.stages}>{deck.coverage.byStage.map(item => <KqProgressMeter key={item.stage} label={getKqStageDisplayName(item.stage)}
        value={item.compatibleCount} max={item.total} valueLabel={`${item.compatibleCount} / ${item.total} incidents`} tone={item.compatibleCount ? "teal" : "ink"} />)}</div>
      <p>{deck.beforeRollCopies} copie{deck.beforeRollCopies > 1 ? "s" : ""} avant les dés · {deck.afterRollCopies} après les dés dans la sélection. Une préparation et une réaction maximum par étape.</p>
      <p>Les cartes jouées sont consommées. Les copies non jouées restent dans ton album.</p>
    </details>
  </section>;
}
