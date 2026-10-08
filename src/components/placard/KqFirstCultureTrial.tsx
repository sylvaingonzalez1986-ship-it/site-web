"use client";

import Image from 'next/image';
import { useEffect, useId, useReducer, useRef } from 'react';
import { ArrowRight, Check, Dices, Leaf, RotateCcw, Sparkles, X } from 'lucide-react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import {
  canPlayKqCard,
  getKqHarvestTier,
  getKqSituation,
  getKqStageTarget,
  KQ_STAGES,
  previewKqResolution,
  type KqGameState,
} from '@/lib/kanab-quest-game';
import {
  createKqFirstCulture,
  firstCultureStorageKey,
  KQ_FIRST_CULTURE_SUPPORT,
  KQ_FIRST_CULTURE_VERSION,
  reduceKqFirstCulture,
  restoreKqFirstCulture,
  type KqFirstCultureAction,
} from '@/lib/kanab-quest-first-culture';
import { getKqOutcomeArtwork, KQ_OUTCOME_LABELS } from '@/lib/kanab-quest-outcome-artwork';
import { getKqSituationArtwork } from '@/lib/kanab-quest-situation-artwork';
import styles from './KqFirstCultureTrial.module.css';

type Session = { game: KqGameState; actions: KqFirstCultureAction[]; scope: string | null };
type Action =
  | { type: 'restore'; value: unknown; scope: string }
  | { type: 'play'; action: KqFirstCultureAction }
  | { type: 'restart' };

function reducer(session: Session, action: Action): Session {
  if (action.type === 'restore') return { ...restoreKqFirstCulture(action.value), scope: action.scope };
  if (action.type === 'restart') return { game: createKqFirstCulture(), actions: [], scope: session.scope };
  const game = reduceKqFirstCulture(session.game, action.action);
  return game === session.game ? session : { ...session, game, actions: [...session.actions, action.action] };
}

const GUIDANCE = [
  'Tout est prêt. Lance les dés pour réveiller ta première pousse.',
  'Ta pousse prend racine. Chaque étape réussie améliore ta future récolte.',
  'La plante grandit. Observe la situation, puis découvre ton lancer.',
  'Les fleurs apparaissent. Si tu as conservé ta carte, elle peut encore t’aider.',
  'C’est le moment de récolter. Encore un lancer pour soigner ce moment.',
  'Dernière étape : préserver les arômes avant de découvrir ta récolte.',
];

export function KqFirstCultureTrial({ storageKey, onClose, onContinue, continueLabel }: {
  storageKey: string;
  onClose: () => void;
  onContinue: () => void;
  continueLabel: string;
}) {
  const [session, dispatch] = useReducer(reducer, undefined, () => ({
    game: createKqFirstCulture(), actions: [], scope: null,
  }));
  const dialogRef = useRef<HTMLDialogElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const explanationId = useId();
  const game = session.game;
  const complete = game.phase === 'complete';
  const ready = session.scope === storageKey;
  const situation = getKqSituation(game);
  const outcomeArtwork = getKqOutcomeArtwork(game);
  const artwork = outcomeArtwork ?? getKqSituationArtwork(situation.code);
  const prediction = previewKqResolution(game);
  const lastResult = game.history.at(-1);
  const canSupport = game.phase === 'rolled' && canPlayKqCard(game, KQ_FIRST_CULTURE_SUPPORT).allowed;
  const usedSupport = game.usedCards.includes(KQ_FIRST_CULTURE_SUPPORT.code);
  const action: KqFirstCultureAction | 'continue' = complete ? 'continue'
    : game.phase === 'prepare' ? 'roll' : game.phase === 'rolled' ? 'resolve' : 'next';
  const actionLabel = complete ? continueLabel
    : game.phase === 'prepare' ? 'Lancer les dés'
      : game.phase === 'rolled' ? (game.reactionPlayed ? 'Valider ma réussite' : 'Garder ce résultat')
        : game.stageIndex === 5 ? 'Découvrir ma récolte' : 'Étape suivante';

  useBodyScrollLock(true);

  useEffect(() => {
    let value: unknown = null;
    try {
      const saved = window.sessionStorage.getItem(firstCultureStorageKey(storageKey));
      if (saved) value = JSON.parse(saved);
    } catch { /* Storage can be unavailable; the learning run still works. */ }
    dispatch({ type: 'restore', value, scope: storageKey });
  }, [storageKey]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.sessionStorage.setItem(firstCultureStorageKey(storageKey), JSON.stringify({
        version: KQ_FIRST_CULTURE_VERSION, actions: session.actions,
      }));
    } catch { /* No account data or network fallback is needed. */ }
  }, [ready, session.actions, storageKey]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    contentRef.current?.scrollTo({ top: 0 });
    actionRef.current?.focus({ preventScroll: true });
  }, [ready, game.stageIndex, game.phase]);

  return <dialog
    ref={dialogRef}
    className={styles.dialog}
    aria-labelledby={titleId}
    aria-describedby={explanationId}
    data-arena-first-culture
    data-first-culture-step={game.stageIndex}
    data-first-culture-phase={game.phase}
    onCancel={event => { event.preventDefault(); onClose(); }}
  >
    <header className={styles.header}>
      <div>
        <span className={styles.eyebrow}>LE PLACARD · PREMIERS PAS</span>
        <h2 id={titleId}>{complete ? 'Ta première récolte !' : 'Ta première culture'}</h2>
      </div>
      <button type="button" className={styles.close} aria-label="Fermer l’essai" onClick={onClose}><X size={21} aria-hidden="true" /></button>
    </header>

    <div className={styles.content} ref={contentRef}>
      <p className={styles.demo} id={explanationId}>Essai préparé : les lancers assurent une récolte. Matériel et gains fictifs.</p>
      {!complete ? <>
        <div className={styles.progress} aria-label={`Étape ${game.stageIndex + 1} sur 6 : ${KQ_STAGES[game.stageIndex]}`}>
          {KQ_STAGES.map((stage, index) => <span key={stage} data-reached={index <= game.stageIndex} aria-hidden="true" />)}
        </div>
        <div className={styles.stageHeading}>
          <h3>{KQ_STAGES[game.stageIndex]}</h3><span>{game.stageIndex + 1} / 6</span>
        </div>
        <div className={styles.scene}>
          {artwork ? <Image key={artwork.src} src={artwork.src} alt={artwork.alt} width={200} height={200} sizes="(max-width: 420px) 92px, 140px" loading="eager" /> : null}
          <div>
            <span className={styles.eyebrow}>{game.phase === 'resolved' ? 'ÇA POUSSE !' : 'TA SITUATION'}</span>
            <h4>{game.phase === 'resolved' ? lastResult?.trait : situation.name}</h4>
            <p>{game.phase === 'resolved' ? KQ_OUTCOME_LABELS[lastResult!.outcome] : situation.story}</p>
          </div>
        </div>

        {game.phase === 'prepare' ? <>
          <p className={styles.guidance}>{GUIDANCE[game.stageIndex]}</p>
          {game.stageIndex === 0 ? <p className={styles.loan}><Check size={16} aria-hidden="true" /> Chanvrier d’essai · Buddie et installation prêts</p> : null}
          <div className={styles.rule}><Dices size={21} aria-hidden="true" /><p><strong>{getKqStageTarget(game)} réussite{getKqStageTarget(game) > 1 ? 's' : ''} demandée{getKqStageTarget(game) > 1 ? 's' : ''}</strong><br />4, 5 ou 6 = une réussite. Le 6 rapporte aussi 1 XP.</p></div>
        </> : null}

        {game.dice ? <div className={styles.dice} role="group" aria-label="Résultat des trois dés">
          {game.dice.map((value, index) => <div className={styles.die} data-success={value >= 4} key={index}>
            <strong>{value}</strong><span>{value === 6 ? 'Étincelle' : value >= 4 ? 'Réussite' : value === 1 ? 'Danger' : 'Neutre'}</span>
          </div>)}
        </div> : null}

        <div className={styles.feedback} role="status" aria-live="polite" aria-atomic="true">
          {game.phase === 'rolled' && prediction ? <p><strong>{prediction.total} réussite{prediction.total > 1 ? 's' : ''} sur {prediction.target} demandée{prediction.target > 1 ? 's' : ''}.</strong> {game.reactionPlayed ? 'Ta carte transforme ce lancer en réussite exceptionnelle !' : prediction.outcome === 'critical' ? 'Trois réussites : un lancer exceptionnel !' : 'Tu peux déjà valider cette étape.'}</p> : null}
          {game.phase === 'resolved' && lastResult ? <p><strong>+{lastResult.qualityDelta} qualité · +{lastResult.xpGain} XP</strong><br />{game.stageIndex === 5 ? 'Ton lot est prêt. Découvre le résultat de tes six étapes.' : 'Ta plante avance. Ces gains suivent ta culture jusqu’à la récolte.'}</p> : null}
        </div>

        {canSupport ? <section className={styles.support} aria-label="Un petit choix tactique">
          <span className={styles.eyebrow}>À TOI DE CHOISIR</span>
          <h4>{KQ_FIRST_CULTURE_SUPPORT.name} <span>· 1 carte prêtée</span></h4>
          <p>Dépense 2 XP pour transformer le dé neutre en 6 : une réussite exceptionnelle et de meilleurs gains. {game.stageIndex === 5 ? 'Tu peux aussi valider ce dernier lancer tel quel.' : 'Tu peux aussi garder ta carte pour plus tard.'}</p>
          <button type="button" data-first-culture-action="support" onClick={() => dispatch({ type: 'play', action: 'support' })}><Sparkles size={17} aria-hidden="true" /> Améliorer mon lancer · 2 XP</button>
        </section> : null}
        {game.phase === 'rolled' && !canSupport && !usedSupport ? <p className={styles.hint}>Ce lancer est déjà excellent. Ta carte reste disponible pour une prochaine étape.</p> : null}
        <div className={styles.stats}><span>Qualité <strong>{game.quality}</strong></span><span>XP disponibles <strong>{game.xp}</strong></span></div>
      </> : <section className={styles.harvest}>
        {artwork ? <Image src={artwork.src} alt={artwork.alt} width={200} height={200} sizes="160px" loading="eager" /> : <Leaf size={64} aria-hidden="true" />}
        <span className={styles.eyebrow}>BUDDIE D’ESSAI · {getKqHarvestTier(game.quality)}</span>
        <h3>{(game.harvestGrams ?? 0).toLocaleString('fr-FR')} g <span>récoltés</span></h3>
        <p className={styles.harvestScore}>6 étapes accomplies · {game.quality} de qualité</p>
        <p>De la première pousse aux arômes préservés, tu as mené ta culture jusqu’au bout.</p>
        <p>La suite se joue avec ta collection, tes choix et les surprises des vraies parties. Tu choisiras ta spécialité en créant ton personnage.</p>
        <p className={styles.hint}>Cette récolte d’entraînement reste dans l’essai.</p>
        <button type="button" className={styles.restart} onClick={() => dispatch({ type: 'restart' })}><RotateCcw size={16} aria-hidden="true" /> Rejouer l’essai</button>
      </section>}
    </div>

    <footer className={styles.footer}>
      <button ref={actionRef} type="button" className={styles.primary} data-first-culture-action={action} disabled={!ready} onClick={() => {
        if (action === 'continue') onContinue();
        else dispatch({ type: 'play', action });
      }}>
        {action === 'roll' ? <Dices size={20} aria-hidden="true" /> : null}
        {actionLabel}
        {action !== 'roll' ? <ArrowRight size={19} aria-hidden="true" /> : null}
      </button>
      <span>{complete ? 'À toi d’écrire la suite.' : 'Prends ton temps, cet essai est fait pour découvrir.'}</span>
    </footer>
  </dialog>;
}
