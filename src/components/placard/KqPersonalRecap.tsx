import Image from "next/image";
import { BookOpen, FlaskConical, Heart, Leaf } from "lucide-react";
import { getKqStageDisplayName, KQ_STAGES, type KqGameState } from "@/lib/kanab-quest-game";
import { getKqPersonalCultureSummary, getKqPersonalJurySummary } from "@/lib/kanab-quest-player-feedback";
import { getKqCultureAnalysis, type KqCultureCardAdvice } from "@/lib/kanab-quest-culture-analysis";
import { getKqJuryAnalysis } from "@/lib/kanab-quest-jury-analysis";
import { getKqCardArtwork } from "@/lib/kanab-quest-artwork";
import { getKqOutcomeArtwork, KQ_OUTCOME_ARTWORK, KQ_OUTCOME_LABELS } from "@/lib/kanab-quest-outcome-artwork";
import { getKqCultureStory } from "@/lib/kanab-quest-culture-story";
import { getKqCannabinoidReport } from "@/lib/kanab-quest-care";
import { getKqCareProductArtwork } from "@/lib/kanab-quest-care-artwork";
import { KqCannabinoidReport } from "./KqCannabinoidReport";
import Link from "@/components/navigation/NavigationLink";
import styles from "./KqPersonalRecap.module.css";

const score = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const signedContribution = (value: number) => `${value > 0 ? "+" : ""}${value.toLocaleString("fr-FR", { maximumFractionDigits: 3 })}`;

function CultureAdvice({ advice }: { advice: KqCultureCardAdvice }) {
  const artwork = getKqCardArtwork(advice.code);
  const comparison = advice.exactEffect;
  const qualityGain = comparison ? comparison.after.qualityDelta - comparison.before.qualityDelta : 0;
  return <article className={styles.cardAdvice} data-recap-card={advice.code} data-advice-basis={advice.basis}>
    {artwork ? <Image src={artwork} alt={`Carte ${advice.name}`} width={64} height={96} sizes="64px" /> : <div aria-hidden="true" />}
    <div>
      <small className={styles.eyebrow}>{advice.basis === "verified-position" ? "Une autre option à cette étape" : "À prévoir pour la prochaine culture"}</small>
      <h4>{advice.name}</h4>
      <small>{getKqStageDisplayName(advice.stage)} · {advice.timing === "before-roll" ? "Avant les dés" : "Après les dés"} · {advice.xpCost} XP</small>
      {comparison ? <>
        <p className={styles.cardEffect}>{KQ_OUTCOME_LABELS[comparison.before.outcome]} → {KQ_OUTCOME_LABELS[comparison.after.outcome]}</p>
        {comparison.before.cultureDead && !comparison.after.cultureDead ? <p className={styles.cardEffect}>Cette étape n’aurait pas arrêté la culture. La suite reste inconnue.</p> : null}
        <p>{qualityGain > 0 ? `${qualityGain} point${qualityGain > 1 ? "s" : ""} de qualité de plus sur ce lancer.`
          : comparison.before.harvestLossPercent > comparison.after.harvestLossPercent ? "Cette carte aurait limité les pertes de récolte."
            : comparison.before.pressureAfter > comparison.after.pressureAfter ? "Cette carte aurait réduit la pression à cette étape."
              : `Solde d’XP : ${signedContribution(comparison.xpBalanceDelta)} par rapport à ta partie.`}</p>
        <p className={styles.note}>Avec une copie en stock ; calcul sur tes dés.</p>
      </> : <p className={styles.cardEffect}>{advice.effect}</p>}
      <details className={styles.disclosure} data-recap-card-details>
        <summary>Conditions et calcul</summary>
        <p>{advice.condition}</p>
        {comparison ? <>
        <p>Qualité : {signedContribution(comparison.before.qualityDelta)} → {signedContribution(comparison.after.qualityDelta)}.<br />
          XP après coût et gain : {comparison.xpBalanceDelta === 0 ? "solde identique" : `${signedContribution(comparison.xpBalanceDelta)} par rapport à ta partie`}.
          {comparison.before.pressureAfter !== comparison.after.pressureAfter ? <><br />Pression finale : {comparison.before.pressureAfter} → {comparison.after.pressureAfter}.</> : null}
          {comparison.before.harvestLossPercent !== comparison.after.harvestLossPercent ? <><br />Perte de récolte : {comparison.before.harvestLossPercent} % → {comparison.after.harvestLossPercent} %.</> : null}
        </p>
        <p>{advice.effect}</p>
        </> : null}
        <p className={styles.note}>{advice.availability}</p>
      </details>
    </div>
  </article>;
}

export function KqCultureRecap({ state }: { state: KqGameState }) {
  const summary = getKqPersonalCultureSummary(state);
  const analysis = getKqCultureAnalysis(state);
  if (!summary || !analysis) return null;
  const story = getKqCultureStory(state, analysis);
  const portrait = getKqOutcomeArtwork(state);
  const care = state.rulesVersion === 3 ? state.care : undefined;
  const report = care && !state.cultureDead ? getKqCannabinoidReport(state) : null;
  const percent = (value: number) => `${value.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} %`;
  return <section className={`${styles.recap} ${styles.cultureRecap}`} data-culture-personal-recap data-analysis-coverage={analysis.coverage} aria-label="Bilan de ta culture">
    <header className={styles.storyHeader}>
      <div className={styles.storyOpening}>
        <small className={styles.bookLabel}><BookOpen size={15} aria-hidden="true" />Le carnet de Sylvain</small>
        <h3>{story.title}</h3>
        <p className={styles.variety}>{state.varietyName} · {state.cultureDead ? "Culture interrompue" : "Culture terminée"}</p>
        <p className={styles.storySummary}>{story.summary}</p>
        <div className={styles.resultRibbon}>
          <span><b>{summary.successful}/{summary.stages}</b> opérations réussies</span>
          {summary.critical > 0 ? <span><b>{summary.critical}</b> {summary.critical > 1 ? "réussites exceptionnelles" : "réussite exceptionnelle"}</span> : null}
        </div>
      </div>
      {portrait ? <Image className={styles.sylvainPortrait} src={portrait.src} alt={portrait.alt} width={208} height={208} sizes="(max-width: 600px) 88px, 208px" data-recap-sylvain /> : null}
    </header>
    <div className={styles.storyBody}>
      <div className={styles.moments} data-culture-analysis>
        {story.moments.map((moment, index) => {
          const step = moment.stageIndex === undefined ? undefined : analysis.stages.find(stage => stage.index === moment.stageIndex);
          const artwork = step ? KQ_OUTCOME_ARTWORK[KQ_STAGES[step.index]]?.[step.outcome] : undefined;
          return <article className={styles.moment} key={`${moment.kind}-${index}`} data-tone={moment.kind}>
            {artwork ? <Image src={artwork.src} alt={artwork.alt} width={72} height={72} sizes="72px" /> : null}
            <div><small className={styles.eyebrow}>{moment.kind === "success" ? "Le point fort" : moment.kind === "setback" ? "Le passage délicat" : "Le suivi de ta culture"}</small><h4>{moment.title}</h4><p>{moment.text}</p></div>
          </article>;
        })}
      </div>
      {care && report ? <section className={styles.harvestProfile} aria-label="Comprendre la qualité de ta récolte">
        <div className={styles.sectionHeading}><h4>Ce que tu retrouves dans ta récolte</h4><small>Indices du jeu</small></div>
        <div className={styles.profileGrid}>
          <div className={styles.profileStat}><Heart size={18} aria-hidden="true" /><h5>Santé à la récolte</h5><b>{score(care.vitality)}<small>/100</small></b><meter min={0} max={100} value={care.vitality} aria-label="Santé à la récolte" /><p>Le bilan des problèmes rencontrés et du suivi apporté à la plante.</p></div>
          <div className={styles.profileStat}><Leaf size={18} aria-hidden="true" /><h5>Arômes & terpènes</h5><b>{score(care.terpenes)}<small>/99</small></b><meter min={0} max={99} value={care.terpenes} aria-label="Arômes et terpènes" /><p>Les terpènes contribuent aux arômes. Tes résultats en floraison, récolte et séchage comptent ici.</p></div>
          <div className={styles.profileStat} data-recap-cannabinoid-score><FlaskConical size={18} aria-hidden="true" /><h5>Potentiel cannabinoïde</h5><b>{score(care.cannabinoidExpression)}<small>/99</small></b><meter min={0} max={99} value={care.cannabinoidExpression} aria-label="Potentiel cannabinoïde" /><p>La part du potentiel de ta variété exprimée puis conservée. <strong>{score(care.cannabinoidExpression)}/99 ne veut pas dire {score(care.cannabinoidExpression)} % de CBD ou de THC.</strong></p></div>
        </div>
        <details className={styles.disclosure} data-recap-cannabinoids>
          <summary>Comprendre ce score et voir mes taux simulés</summary>
          <p>La variété fixe un potentiel fictif. Dans cette partie, la floraison et la récolte développent son expression ; le séchage la conserve ou la dégrade. <strong>99/99 correspond au potentiel pleinement exprimé dans le jeu.</strong></p>
          {care.history.some(event => event.kind === "resolution" && event.stageIndex >= 3 && event.cannabinoidDelta !== undefined) ? <ul className={styles.explanationList} aria-label="Évolution du potentiel dans cette partie">{care.history.filter(event => event.kind === "resolution" && event.stageIndex >= 3 && event.cannabinoidDelta !== undefined).map(event => {
            const outcome = state.history[event.stageIndex]?.outcome;
            const delta = event.cannabinoidDelta!;
            return <li key={event.stageIndex}><strong>{getKqStageDisplayName(KQ_STAGES[event.stageIndex])}</strong>{outcome ? ` · ${KQ_OUTCOME_LABELS[outcome].toLowerCase()}` : ""} : {delta > 0 ? `le potentiel a progressé de ${delta} points.` : delta < 0 ? `${Math.abs(delta)} points de potentiel perdus.` : event.stageIndex >= 5 ? "le potentiel a été conservé au séchage." : "le score n’a pas progressé à cette étape."}</li>;
          })}</ul> : null}
          <dl className={styles.cannabinoidRates}>{(["cbd", "cbg", "thc"] as const).map(family => <div key={family}><dt>{family.toUpperCase()} total simulé</dt><dd>{percent(report.totals[family])}</dd></div>)}</dl>
          <p className={styles.note}>Ces teneurs sont fictives. Chaque total réunit les formes acide et neutre avec leur correction de masse ; il ne s’ajoute pas à ces formes.</p>
          <KqCannabinoidReport report={report} />
        </details>
      </section> : null}
      {story.care.length ? <details className={styles.disclosure} data-recap-care>
        <summary>Les intrants et PBI que tu as utilisés · {care?.applications.length ?? story.care.length}</summary>
        <div className={styles.careReceipts}>{story.care.map(item => {
          const artwork = getKqCareProductArtwork(item.code);
          return <article key={item.code}>{artwork ? <Image src={artwork.src} alt={artwork.alt} width={64} height={64} sizes="64px" /> : null}<div><h4>{item.name} <small>× {item.count}</small></h4><p>{item.stages.join(" · ")}</p><p>{item.detail}</p></div></article>;
        })}</div>
      </details> : care ? <p className={styles.noInputs}>Aucun intrant ni PBI utilisé pendant cette culture.</p> : null}
      <details className={`${styles.disclosure} ${styles.journeyDisclosure}`} data-culture-analysis-details>
        <summary><div><strong>Revoir les {story.stages.length} étapes</strong><small>Les situations, tes choix et leurs conséquences</small></div></summary>
        <ol className={styles.journey}>
          {story.stages.map(stage => {
            const evidence = analysis.stages.find(item => item.index === stage.index)!;
            const artwork = KQ_OUTCOME_ARTWORK[KQ_STAGES[stage.index]]?.[stage.outcome];
            return <li key={stage.index} data-analysis-stage={stage.index} data-tone={stage.tone}>
              <div className={styles.episodeHeading}>{artwork ? <Image src={artwork.src} alt={artwork.alt} width={84} height={84} sizes="(max-width: 480px) 64px, 84px" /> : null}<div><small>ÉTAPE {stage.index + 1}</small><h4>{getKqStageDisplayName(stage.stage)}</h4><b className={styles.outcome}>{stage.outcomeLabel}</b></div></div>
              <div className={styles.episodeBody}><p className={styles.situation}>{stage.situation}</p><p>{stage.summary}</p>
                {stage.effects.length ? <ul className={styles.explanationList}>{stage.effects.map((effect, index) => <li key={index}>{effect}</li>)}</ul> : null}
                {stage.careActions.length ? <div className={styles.episodeCare}><h5>Tes interventions</h5>{stage.careActions.map((action, index) => <p key={index}>{action}</p>)}</div> : null}
                {evidence.playedCards.length ? <p><strong>Cartes jouées :</strong> {evidence.playedCards.map(card => card.name).join(" · ")}.</p> : null}
                <details className={styles.disclosure} data-recap-calculations><summary>Dés et calculs de cette étape</summary><ul className={styles.explanationList}>{evidence.evidence.map((fact, index) => <li key={index}>{fact}</li>)}</ul></details>
              </div>
            </li>;
          })}
        </ol>
        {story.notes.length ? <div data-analysis-legacy>{story.notes.map((note, index) => <p key={index} className={styles.note}>{note}</p>)}</div> : null}
      </details>
      {analysis.advice.length ? <section className={styles.nextCulture} aria-label="Cartes à considérer pour une prochaine culture"><div className={styles.sectionHeading}><h4>Une piste pour la prochaine</h4><small>À partir de tes dés</small></div><CultureAdvice advice={analysis.advice[0]} />
        {analysis.advice.length > 1 ? <details className={styles.disclosure}><summary>Voir une autre possibilité</summary><CultureAdvice advice={analysis.advice[1]} /></details> : null}
      </section> : null}
    </div>
  </section>;
}

export function KqJuryRecap({ rounds, playerStats, opponentStats, onPrepare, prepareHref, prepareLabel = "Préparer ma prochaine culture" }: {
  rounds: Parameters<typeof getKqPersonalJurySummary>[0];
  playerStats?: Record<string, number | undefined>;
  opponentStats?: Record<string, number | undefined>;
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
