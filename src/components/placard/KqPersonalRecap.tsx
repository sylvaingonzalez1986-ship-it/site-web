import Image from "next/image";
import type { KqGameState } from "@/lib/kanab-quest-game";
import { getKqPersonalCultureSummary, getKqPersonalJurySummary } from "@/lib/kanab-quest-player-feedback";
import { getKqCultureAnalysis, type KqCultureCardAdvice } from "@/lib/kanab-quest-culture-analysis";
import { getKqJuryAnalysis } from "@/lib/kanab-quest-jury-analysis";
import { getKqCardArtwork } from "@/lib/kanab-quest-artwork";
import { KQ_OUTCOME_LABELS } from "@/lib/kanab-quest-outcome-artwork";
import Link from "@/components/navigation/NavigationLink";
import styles from "./KqPersonalRecap.module.css";

const score = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const signedContribution = (value: number) => `${value > 0 ? "+" : ""}${value.toLocaleString("fr-FR", { maximumFractionDigits: 3 })}`;

function CultureAdvice({ advice }: { advice: KqCultureCardAdvice }) {
  const artwork = getKqCardArtwork(advice.code);
  const comparison = advice.exactEffect;
  return <article className={styles.cardAdvice} data-recap-card={advice.code} data-advice-basis={advice.basis}>
    {artwork ? <Image src={artwork} alt={`Carte ${advice.name}`} width={64} height={96} sizes="64px" /> : <div aria-hidden="true" />}
    <div>
      <small className={styles.eyebrow}>{advice.basis === "verified-position" ? "Une autre option à cette étape" : "À prévoir pour la prochaine culture"}</small>
      <h4>{advice.name}</h4>
      <small>{advice.stage} · {advice.timing === "before-roll" ? "Avant les dés" : "Après les dés"} · {advice.xpCost} XP</small>
      {comparison ? <>
        <p className={styles.cardEffect}>{KQ_OUTCOME_LABELS[comparison.before.outcome]} → {KQ_OUTCOME_LABELS[comparison.after.outcome]}</p>
        {comparison.before.cultureDead && !comparison.after.cultureDead ? <p className={styles.cardEffect}>Cette étape n’aurait pas arrêté la culture. La suite reste inconnue.</p> : null}
        <p>Qualité : {signedContribution(comparison.before.qualityDelta)} → {signedContribution(comparison.after.qualityDelta)}.<br />
          XP après coût et gain : {comparison.xpBalanceDelta === 0 ? "solde identique" : `${signedContribution(comparison.xpBalanceDelta)} par rapport à ta partie`}.
          {comparison.before.pressureAfter !== comparison.after.pressureAfter ? <><br />Pression finale : {comparison.before.pressureAfter} → {comparison.after.pressureAfter}.</> : null}
          {comparison.before.harvestLossPercent !== comparison.after.harvestLossPercent ? <><br />Perte de récolte : {comparison.before.harvestLossPercent} % → {comparison.after.harvestLossPercent} %.</> : null}
        </p>
        <p className={styles.note}>Calcul sur les dés de cette étape, sous réserve d’une copie en stock.</p>
      </> : <p className={styles.cardEffect}>{advice.effect}</p>}
      <details className={styles.disclosure} data-recap-card-details>
        <summary>Conditions et explication</summary>
        <p>{advice.condition}</p>
        {comparison ? <p>{advice.effect}</p> : null}
        <p className={styles.note}>{advice.availability}</p>
      </details>
    </div>
  </article>;
}

export function KqCultureRecap({ state }: { state: KqGameState }) {
  const summary = getKqPersonalCultureSummary(state);
  const analysis = getKqCultureAnalysis(state);
  if (!summary || !analysis) return null;
  return <section className={styles.recap} data-culture-personal-recap data-analysis-coverage={analysis.coverage} aria-label="Bilan de ta culture">
    <h3>Ton parcours de culture</h3>
    <dl className={styles.metrics}>
      <div><dt>Étapes réussies</dt><dd>{summary.successful}/{summary.stages}</dd></div>
      <div><dt>Dont critiques</dt><dd>{summary.critical}</dd></div>
      <div><dt>Étapes à zéro</dt><dd>{summary.zero}</dd></div>
    </dl>
    <div className={styles.highlight} data-culture-analysis>
      <small className={styles.eyebrow}>Ce qui a pesé sur ta partie</small>
      <h4>{analysis.headline}</h4>
      <ul>{analysis.evidence.map((fact, index) => <li key={index}>{fact}</li>)}</ul>
    </div>
    {analysis.advice.length ? <div className={styles.cardList} aria-label="Cartes à considérer pour une prochaine culture">
      <CultureAdvice advice={analysis.advice[0]} />
    </div> : null}
    <details className={styles.disclosure} data-culture-analysis-details>
      <summary>Comprendre mes étapes</summary>
      {analysis.advice.slice(1, 2).map(advice => <CultureAdvice key={`${advice.code}-${advice.stageIndex}`} advice={advice} />)}
      <ol className={styles.stages}>
        {analysis.stages.map(stage => <li key={stage.index} data-analysis-stage={stage.index}>
          <strong>{stage.index + 1}. {stage.stage} · {KQ_OUTCOME_LABELS[stage.outcome]}</strong>
          <p>{stage.situation}</p>
          {stage.playedCards.length ? <p>Cartes jouées : {stage.playedCards.map(card => card.name).join(" · ")}.</p> : null}
          {stage.evidence.length ? <ul className={styles.explanationList}>{stage.evidence.map((fact, index) => <li key={index}>{fact}</li>)}</ul> : null}
        </li>)}
      </ol>
      {analysis.coverage !== "detailed" ? <p className={styles.note} data-analysis-legacy>Certains choix de cette partie n’ont pas été enregistrés. Les conseils correspondants servent à préparer une prochaine culture ; ils ne prouvent pas qu’une carte était jouable à ce moment-là.</p> : null}
    </details>
  </section>;
}

export function KqJuryRecap({ rounds, playerStats, opponentStats, onPrepare, prepareHref, prepareLabel = "Préparer ma prochaine culture" }: {
  rounds: Parameters<typeof getKqPersonalJurySummary>[0];
  playerStats?: Record<string, number>;
  opponentStats?: Record<string, number>;
  onPrepare?: () => void;
  prepareHref?: string;
  prepareLabel?: string;
}) {
  const summary = getKqPersonalJurySummary(rounds);
  const analysis = getKqJuryAnalysis({ rounds, playerStats, opponentStats });
  if (!summary || !analysis) return null;
  const closest = summary.closest;
  const mainAdvice = analysis.recommendations[0];
  const strongestWin = rounds.filter(round => round.winner === "player" && round.playerScore > round.opponentScore)
    .sort((left, right) => (right.playerScore - right.opponentScore) - (left.playerScore - left.opponentScore))[0];
  return <section className={styles.recap} data-jury-personal-recap aria-label="Ton bilan personnel du jury">
    <h3>Ce que le jury a retenu</h3>
    <div data-jury-analysis>
      <small className={styles.eyebrow}>{analysis.wins} manche{analysis.wins === 1 ? "" : "s"} remportée{analysis.wins === 1 ? "" : "s"} sur 3</small>
      <h4>{analysis.title}</h4>
      <p>{analysis.summary}</p>
      <p>{analysis.focus.reason}</p>
      {strongestWin ? <p><strong>Ton point d’appui : {strongestWin.label}.</strong> {score(strongestWin.playerScore - strongestWin.opponentScore)} point{strongestWin.playerScore - strongestWin.opponentScore > 1 ? "s" : ""} d’avance sur cette manche.</p> : null}
      {mainAdvice ? <div className={styles.highlight}>
        <small className={styles.eyebrow}>Pour ta prochaine culture</small>
        <h4>{mainAdvice.title}</h4>
        <p>{mainAdvice.explanation}</p>
      </div> : null}
    </div>
    <details className={styles.disclosure} data-jury-analysis-details>
      <summary>Comprendre les critères du jury</summary>
      {analysis.focus.criteria.length ? <dl className={styles.criteria}>
        {analysis.focus.criteria.map(criterion => <div key={criterion.stat}>
          <dt>{criterion.label} · {criterion.weightPercent} % de la note de base</dt>
          {criterion.playerValue !== null ? <dd>Ta Fleur : {score(criterion.playerValue)}{criterion.opponentValue !== null ? ` · Adversaire : ${score(criterion.opponentValue)}` : ""}</dd> : null}
          {criterion.weightedGap !== null ? <dd>Contribution à l’écart : {signedContribution(criterion.weightedGap)} point{Math.abs(criterion.weightedGap) > 1 ? "s" : ""}.</dd> : null}
        </div>)}
      </dl> : null}
      <ul className={styles.explanationList}>{analysis.facts.map((fact, index) => <li key={index}>{fact}</li>)}</ul>
      {analysis.recommendations.slice(1).map(advice => <p key={advice.stat}><strong>{advice.title}</strong> {advice.explanation}</p>)}
      <p data-jury-closest-round><strong>Manche la plus serrée : {closest.label}.</strong> {summary.margin === 0
      ? `Notes à égalité (${score(closest.playerScore)}), manche attribuée ${closest.winner === "player" ? "à ta Fleur" : "à l’adversaire"} par le jury.`
      : `${score(Math.abs(summary.margin))} point${Math.abs(summary.margin) > 1 ? "s" : ""} ${summary.margin > 0 ? "d’avance" : "de retard"} (${score(closest.playerScore)} contre ${score(closest.opponentScore)}).`}</p>
      {analysis.limits.map((limit, index) => <p className={styles.note} key={index}>{limit}</p>)}
    </details>
    {onPrepare ? <button className={styles.action} type="button" data-recap-prepare onClick={onPrepare}>{prepareLabel}</button>
      : prepareHref ? <Link className={styles.action} data-recap-prepare href={prepareHref} prefetch={false}>{prepareLabel}</Link> : null}
  </section>;
}
