'use client';

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowRight, Check, Dices, X } from 'lucide-react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useArenaLearningStorage } from './ArenaLearningStorage';
import { createArenaQuickTrialSession, getQuickTrialContainers, getQuickTrialStepLabel, QUICK_TRIAL_BUDDIES, type ArenaQuickTrialAction } from '@/lib/arena-quick-trial';
import { canPlayKqCard, getKqSituation, getKqStageTarget, KQ_STAGES, previewKqResolution } from '@/lib/kanab-quest-game';
import { KQ_FIRST_CULTURE_SUPPORT } from '@/lib/kanab-quest-first-culture';
import { getKqJuryScoreFromRounds, KQ_MARKET_ROUTES } from '@/lib/kanab-quest-market';
import { getKqStorageContainer, projectKqStorageLot } from '@/lib/kanab-quest-storage';
import { getReleveCommerceSnapshot } from '@/lib/kanab-quest-releve-commerce';
import { KQ_CHANNELS, quoteKqCommerce } from '@/lib/kanab-quest-commerce';
import { KqChapterHeading } from '../placard/KqChapterHeading';
import { KqProgressMeter } from '../placard/KqVisuals';
import styles from './ArenaQuickTrial.module.css';

const grams = (value: number) => `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} g`;
const money = (cents: number) => (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

export function ArenaQuickTrial({ onClose, onOpenQuarter, onContinueLearning, onReady }: {
  onClose: () => void; onOpenQuarter: () => void; onContinueLearning: () => void; onReady?: () => void;
}) {
  const storage = useArenaLearningStorage();
  const session = useMemo(() => createArenaQuickTrialSession(storage), [storage]);
  const { state, warning, error } = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getServerSnapshot);
  const [exit, setExit] = useState(false);
  const [saleGrams, setSaleGrams] = useState('10');
  const dialog = useRef<HTMLDialogElement>(null), content = useRef<HTMLDivElement>(null), heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId(), descriptionId = useId();
  const notified = useRef(false);
  const game = state.game, complete = state.step === 'complete', leaving = exit || complete;
  const commerce = state.commerce ? getReleveCommerceSnapshot(state.commerce) : null;
  const receipt = commerce?.receipts.at(-1);
  const stock = commerce?.stocks.find(item => item.remainingUnits > 0);
  const requestedUnits = Math.round(Number(saleGrams) * 10);
  const validQuantity = Number.isSafeInteger(requestedUnits) && requestedUnits > 0 && requestedUnits <= (stock?.remainingUnits ?? 0)
    && Math.abs(Number(saleGrams) * 10 - requestedUnits) < 0.000001;
  const remaining = commerce?.stocks.length ? commerce.stocks.reduce((sum, item) => sum + item.remainingUnits / 10, 0) : game?.harvestGrams ?? 0;
  const projection = state.storage ? projectKqStorageLot(state.storage, state.clock) : null;
  const stepLabel = getQuickTrialStepLabel(state);
  const phase = ['variety', 'culture'].includes(state.step) ? 0 : ['storage', 'curing'].includes(state.step) ? 1 : ['jury', 'verdict'].includes(state.step) ? 2 : complete ? 4 : 3;
  const art = phase === 0 ? 'culture' : phase === 1 ? 'warehouse' : phase === 2 ? 'harvest' : 'commerce';
  const play = (action: ArenaQuickTrialAction) => session.play(action);
  useBodyScrollLock(true);

  useEffect(() => {
    const element = dialog.current, previous = document.activeElement;
    if (element && !element.open) element.showModal();
    return () => { element?.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => { if (!notified.current) { notified.current = true; onReady?.(); } }, [onReady]);
  useEffect(() => { content.current?.scrollTo({ top: 0 }); heading.current?.focus({ preventScroll: true }); }, [state.step, game?.phase, game?.stageIndex, leaving]);

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} aria-describedby={descriptionId}
    data-quick-trial={state.step} data-quick-culture-phase={game?.phase} data-quick-culture-stage={game?.stageIndex}
    onCancel={event => { event.preventDefault(); setExit(true); }}>
    <header className={styles.top}><strong>Première récolte accompagnée</strong><button type="button" aria-label="Faire une pause ou quitter l’essai" onClick={() => setExit(true)}><X size={20} aria-hidden="true" /></button></header>
    <div className={styles.content} ref={content}>
      <p id={descriptionId} className={styles.notice}>Essai fictif · aucun achat ni gain sur ton compte.</p>
      {warning ? <p className={styles.warning} role="status">{warning}</p> : null}
      {error ? <p className={styles.warning} role="alert">{error}</p> : null}
      <KqChapterHeading compact art={leaving ? 'quarter' : art} title={leaving ? complete ? 'Ta première vente est réussie' : 'Quitter l’essai ?' : state.step === 'culture' && game ? KQ_STAGES[game.stageIndex] : stepLabel} titleId={titleId} />
      <h3 className={styles.focusHeading} ref={heading} tabIndex={-1}>{leaving ? 'Ton bilan d’essai' : `Étape ${Math.min(phase + 1, 4)} sur 4 · ${['Culture', 'Rangement et affinage', 'Jury', 'Première vente'][Math.min(phase, 3)]}`}</h3>

      {leaving ? <section data-quick-exit>
        <dl className={styles.numbers}>
          <div><dt>Recette nette fictive</dt><dd>{money(receipt?.netPayoutCents ?? 0)}</dd></div>
          <div><dt>Stock fictif restant</dt><dd>{grams(remaining)}</dd></div>
        </dl>
        <p><strong>Rien n’est transféré à ta partie :</strong> récolte, contenants prêtés, cartes utilisées et recette restent dans cet essai.</p>
        <p>Dans ta vraie partie, l’affinage dure <strong>6 heures réelles après la récolte, avant le jury</strong>. L’horloge accélérée appartient uniquement à l’essai.</p>
        {!complete ? <p>Reprise : {stepLabel}. {warning ? 'La sauvegarde de cette progression n’est pas garantie.' : 'Ta progression est enregistrée pour ce compte, dans ce navigateur.'}</p> : <p>Le Quartier te montrera ton propre inventaire et ta prochaine action. La Relève reste disponible pour apprendre les autres systèmes.</p>}
        <div className={styles.actions}>
          {!complete ? <button type="button" className={styles.primary} data-quick-resume onClick={() => setExit(false)}>Reprendre mon essai</button> : null}
          <button type="button" className={complete ? styles.primary : undefined} data-quick-quarter onClick={onOpenQuarter}>Rejoindre le Quartier <ArrowRight size={18} aria-hidden="true" /></button>
          <button type="button" data-quick-learn onClick={onContinueLearning}>Continuer à apprendre</button>
          <button type="button" data-quick-pause onClick={onClose}>{complete ? 'Revenir aux choix' : 'Faire une pause'}</button>
        </div>
      </section> : <>
        {state.step === 'variety' ? <section>
          <p>L’installation et une carte de soutien sont prêtes. Culture et analyse sont prêtées. Choisis une variété pour démarrer.</p>
          <div className={styles.choices}>{QUICK_TRIAL_BUDDIES.map(buddie => <button key={buddie.code} type="button" data-quick-variety={buddie.code} onClick={() => play({ type: 'start', varietyCode: buddie.code })}><strong>{buddie.name}</strong><span>{buddie.advantageLevel} XP de départ en plus · carte Or</span><span>Commencer cette culture <ArrowRight size={18} aria-hidden="true" /></span></button>)}</div>
          <p className={styles.secondary}>Scénario préparé : les lancers permettent une récolte. Dans la vraie partie, les situations et les résultats varient.</p>
        </section> : null}

        {state.step === 'culture' && game ? <section>
          <KqProgressMeter label="Étapes de culture" value={game.history.length} max={6} valueLabel={`${game.history.length} / 6 terminées`} />
          <h4>{game.varietyName}</h4>
          {game.phase === 'prepare' ? <><p>{getKqSituation(game).story}</p><p><strong>{getKqStageTarget(game)} réussite{getKqStageTarget(game) > 1 ? 's demandées' : ' demandée'}.</strong> Chaque dé de 4 à 6 compte pour une réussite.</p></> : null}
          {game.dice ? <div className={styles.dice} role="group" aria-label="Résultat des dés">{game.dice.map((die, index) => <div key={index} data-success={die >= 4}><strong>{die}</strong><span>{die === 6 ? 'Réussite + XP' : die >= 4 ? 'Réussite' : die === 1 ? 'Danger' : 'Neutre'}</span></div>)}</div> : null}
          <div className={styles.stats}><span>Qualité de culture : <strong>{game.quality} points</strong></span><span><strong>{game.xp} XP</strong> disponibles</span></div>
          {game.phase === 'prepare' ? <button type="button" className={styles.primary} data-quick-action="roll" onClick={() => play({ type: 'culture', action: 'roll' })}><Dices size={19} aria-hidden="true" /> Lancer les dés</button> : null}
          {game.phase === 'rolled' ? <>
            <p role="status"><strong>{previewKqResolution(game)?.total} réussites sur {getKqStageTarget(game)} demandée{getKqStageTarget(game) > 1 ? 's' : ''}.</strong> {game.reactionPlayed ? 'Ta carte a amélioré ce résultat.' : 'Cette étape est réussie.'}</p>
            {canPlayKqCard(game, KQ_FIRST_CULTURE_SUPPORT).allowed ? <div className={styles.support}><h4>{KQ_FIRST_CULTURE_SUPPORT.name} · 1 carte</h4><p><strong>{KQ_FIRST_CULTURE_SUPPORT.xpCost} XP</strong> : le dé neutre devient un 6, pour une réussite exceptionnelle. La carte est consommée.</p><button type="button" data-quick-action="support" onClick={() => play({ type: 'culture', action: 'support' })}>Améliorer mon lancer · {KQ_FIRST_CULTURE_SUPPORT.xpCost} XP</button></div> : null}
            <button type="button" className={styles.primary} data-quick-action="resolve" onClick={() => play({ type: 'culture', action: 'resolve' })}>{game.reactionPlayed ? 'Valider mon résultat' : 'Garder ce résultat'}</button>
          </> : null}
          {game.phase === 'resolved' ? <><p role="status"><strong>+{game.history.at(-1)?.qualityDelta} points de qualité · +{game.history.at(-1)?.xpGain} XP.</strong> Ces résultats déterminent ta récolte.</p><button type="button" className={styles.primary} data-quick-action="next" onClick={() => play({ type: 'culture', action: 'next' })}>{game.stageIndex === 5 ? 'Découvrir ma récolte' : 'Étape de culture suivante'} <ArrowRight size={18} aria-hidden="true" /></button></> : null}
        </section> : null}

        {state.step === 'storage' && game ? <section>
          <dl className={styles.numbers}><div><dt>{game.varietyName}</dt><dd>{grams(game.harvestGrams!)}</dd></div><div><dt>Qualité estimée avant jury</dt><dd>{projection?.conditionScore.toLocaleString('fr-FR')} / 10</dd></div></dl>
          <p><strong>Ce lot est sans contenant.</strong> Choisis où le ranger ; chaque contenant reste réservé à cette variété.</p>
          <div className={styles.choices}>{getQuickTrialContainers(state).map(container => <button key={container.code} type="button" data-quick-container={container.code} onClick={() => play({ type: 'store', containerCode: container.code as 'GLASS-3L' | 'BOVEDA-1L' })}><strong>{container.name}</strong><span>{container.quantity} contenants prêtés · {grams(container.capacityUnits / 10)} chacun</span><span>{container.code === 'BOVEDA-1L' ? 'Régulateur pour ralentir davantage les pertes.' : 'Protection standard, moins de bocaux à occuper.'}</span><span>Ranger {grams(game.harvestGrams!)} · gratuit dans cet essai</span></button>)}</div>
        </section> : null}

        {state.step === 'curing' ? <section>
          <p><Check size={18} aria-hidden="true" /> <strong>{grams((projection?.capacity?.protectedUnits ?? 0) / 10)} rangés</strong> dans {state.storage?.capacity?.allocations[0].quantity} × {getKqStorageContainer(state.storage!.capacity!.allocations[0].containerCode)?.name}.</p>
          <KqProgressMeter label="Affinage avant le jury" value={0} max={6} valueLabel="6 heures restantes" />
          <p>Le lot est protégé : tu peux attendre sans intervenir. Dans ta partie, cette attente dure <strong>6 heures réelles après la récolte</strong>.</p>
          <p>Pour apprendre la suite maintenant, fais avancer uniquement l’horloge fictive.</p>
          <button type="button" className={styles.primary} data-quick-action="mature" onClick={() => play({ type: 'mature' })}>Avancer les 6 heures fictives</button>
        </section> : null}

        {state.step === 'jury' ? <section>
          <p><strong>Affinage terminé dans cet essai.</strong> Le jury peut maintenant évaluer ta Fleur d’Arène.</p>
          <p>Présenter la Fleur la consomme : elle ne pourra plus participer à un duel. <strong>Les {grams(game!.harvestGrams!)} de stock récolté sont conservés pour la vente.</strong></p>
          <button type="button" className={styles.primary} data-quick-action="jury" onClick={() => play({ type: 'jury' })}>Présenter la Fleur et découvrir le verdict</button>
        </section> : null}

        {state.step === 'verdict' && state.battle ? <section>
          <dl className={styles.numbers}><div><dt>Note du jury</dt><dd>{getKqJuryScoreFromRounds(state.battle.rounds).toLocaleString('fr-FR')} / 10</dd></div><div><dt>Stock conservé</dt><dd>{grams(game!.harvestGrams!)}</dd></div></dl>
          <p>La Fleur d’Arène est consommée. Le lot conserve cette note de référence, puis sa qualité évolue avec sa conservation.</p>
          <details><summary>Voir les trois manches</summary><ul>{state.battle.rounds.map((round, index) => <li key={index}>Manche {index + 1} : {round.playerScore.toLocaleString('fr-FR')} / 100</li>)}</ul></details>
          <button type="button" className={styles.primary} data-quick-action="open-market" onClick={() => play({ type: 'open-market' })}>Préparer ma première vente</button>
        </section> : null}

        {state.step === 'prepare' && commerce ? <section>
          <p>Choisis ce que tu proposes aux acheteurs. La préparation engage tout ce lot ; elle ne le vend pas.</p>
          <div className={styles.choices}>{commerce.rawLots[0]?.options.filter(option => option.available || option.route === 'raw').map(option => <button type="button" key={option.route} disabled={!option.available} data-quick-route={option.route} onClick={() => play({ type: 'prepare', route: option.route })}><strong>{KQ_MARKET_ROUTES.find(route => route.code === option.route)?.name}</strong><span>{option.available ? `${grams(option.productGrams)} · préparation ${money(option.market?.processingCostCents ?? 0)}` : option.blockedReason}</span><span>Préparer ce produit</span></button>)}</div>
          <p className={styles.secondary}>Les transformations avec machines et la vente en ligne se découvrent dans La Relève complète.</p>
        </section> : null}

        {state.step === 'sale' && commerce && stock ? <section>
          <p><strong>{grams(stock.remainingUnits / 10)} disponibles.</strong> Choisis la quantité et le circuit. Le prix est fixé par l’acheteur professionnel.</p>
          <label className={styles.quantity}>Quantité proposée (g)<input type="number" min="0.1" step="0.1" max={stock.remainingUnits / 10} value={saleGrams} onChange={event => setSaleGrams(event.target.value)} data-quick-quantity /></label>
          <div className={styles.choices}>{(['wholesale', 'cbd-shop'] as const).map(channel => {
            const offer = quoteKqCommerce(commerce, stock, channel, 'advised', validQuantity ? requestedUnits : undefined, state.clock);
            return <button type="button" key={channel} disabled={!validQuantity || !!offer.reason || offer.units <= 0} data-quick-channel={channel} onClick={() => play({ type: 'quote', channel, units: requestedUnits })}><strong>{KQ_CHANNELS[channel].name}</strong><span>{offer.reason ?? `${grams(offer.units / 10)} achetés · recette TTC ${money(offer.payoutCents)}`}</span><span>{offer.reason ? 'Conditions non remplies dans cet essai' : 'Voir le montant net avant de confirmer'}</span></button>;
          })}</div>
          {!validQuantity ? <p role="alert">Choisis de 0,1 g à {grams(stock.remainingUnits / 10)}, par pas de 0,1 g.</p> : null}
        </section> : null}

        {state.step === 'confirm' && state.offer ? <section data-quick-sale-confirm>
          <p><strong>{KQ_CHANNELS[state.offer.offer.channel].name} · {grams(state.offer.offer.units / 10)}.</strong> Confirme cette vente fictive.</p>
          <dl className={styles.breakdown}><div><dt>Recette TTC</dt><dd>{money(state.offer.offer.payoutCents)}</dd></div><div><dt>TVA réservée</dt><dd>{money(state.offer.vatCents)}</dd></div><div><dt>Recette nette fictive</dt><dd><strong>{money(state.offer.netPayoutCents)}</strong></dd></div></dl>
          <p>Culture et analyse sont prêtées dans cet essai : aucune facture à retenir. Dans ta partie, les factures dues peuvent réduire le montant net.</p>
          <div className={styles.actions}><button type="button" className={styles.primary} data-quick-action="sell" onClick={() => play({ type: 'sell' })}>Confirmer la vente fictive · {money(state.offer.netPayoutCents)} nets</button><button type="button" data-quick-action="cancel-sale" onClick={() => { setSaleGrams(String(state.offer!.offer.units / 10)); play({ type: 'cancel-sale' }); }}>Modifier mon choix</button></div>
        </section> : null}
      </>}
    </div>
  </dialog>;
}
