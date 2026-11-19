"use client";

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Crown, RefreshCw } from 'lucide-react';
import type { KqTournamentIdentity, KqTournamentSnapshot } from '@/lib/kanab-quest-school-tournament';
import { getKqStaffReconnectHref } from '@/lib/kanab-quest-staff-reauth';
import { ChanvrierAvatar } from '../contest/ChanvrierAvatar';
import { KqChapterHeading } from './KqChapterHeading';
import { KqQuizzShowScene } from './KqQuizzShowScene';
import { KqProgressMeter } from './KqVisuals';
import styles from './KqSchoolRankings.module.css';

type Props = { ownerId?: string; onTournament: () => void };
const endpoint = '/api/arena/placard/school/tournament';
const points = (value: number) => `${value.toLocaleString('fr-FR')} pts`;
const duration = (value: number) => `${(value / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} s`;
const editionDate = (value: string) => new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris', day: 'numeric', month: 'long', year: 'numeric',
}).format(new Date(value));
const dateTime = (value: string) => new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
}).format(new Date(value));

function Avatar({ player }: { player: KqTournamentIdentity }) {
  const [failed, setFailed] = useState(false);
  return <span className={styles.avatar} aria-hidden="true">
    {player.avatar ? <ChanvrierAvatar profile={player.avatar} view="portrait" />
      : player.avatarUrl && !failed ? <Image src={player.avatarUrl} alt="" width={48} height={48} unoptimized onError={() => setFailed(true)} />
        : player.displayName.trim().slice(0, 2).toLocaleUpperCase('fr')}
  </span>;
}

/** Isolate fetched results when the connected account changes. This page only reads standings. */
export function KqSchoolRankings(props: Props) {
  return <RankingsSession key={props.ownerId || 'guest'} {...props} />;
}

function RankingsSession({ ownerId, onTournament }: Props) {
  const [snapshot, setSnapshot] = useState<KqTournamentSnapshot | null>(null);
  const [loading, setLoading] = useState(Boolean(ownerId));
  const [error, setError] = useState('');
  const [authProblem, setAuthProblem] = useState<'expired' | 'owner-changed' | null>(null);
  const request = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!ownerId) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError('');
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(endpoint, {
        method: 'GET', cache: 'no-store', headers: { 'X-Kq-School-Owner': ownerId }, signal: controller.signal,
      });
      const value = await response.json();
      if (request.current !== controller) return;
      if (response.status === 401) {
        setSnapshot(null);
        setAuthProblem('expired');
        throw new Error('Ta session a expiré. Reconnecte-toi pour consulter le classement.');
      }
      if (!response.ok) throw new Error(value.error || 'Le classement est momentanément indisponible.');
      if (value.ownerId !== ownerId) {
        setSnapshot(null);
        setAuthProblem('owner-changed');
        throw new Error('Le compte connecté a changé. Recharge la page pour retrouver le bon joueur.');
      }
      if (!Number.isFinite(Date.parse(value.serverNow))) throw new Error('Le classement reçu est incomplet. Réessaie dans un instant.');
      setSnapshot(value as KqTournamentSnapshot);
      setAuthProblem(null);
    } catch (cause) {
      if (request.current === controller) setError(cause instanceof Error && cause.name !== 'AbortError'
        ? cause.message : 'Connexion interrompue. Réessaie pour actualiser le classement.');
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) {
        request.current = null;
        setLoading(false);
      }
    }
  }, [ownerId]);

  useEffect(() => {
    void load();
    return () => { request.current?.abort(); request.current = null; };
  }, [load]);

  const ownResult = snapshot?.weeklyLeaderboard.find(player => player.userId === ownerId);
  const champion = snapshot?.champion;
  const reconnect = () => window.location.assign(getKqStaffReconnectHref(window.location));

  return <section className={styles.rankings} data-school-rankings data-tutorial-observation={snapshot && !error && !loading ? "school-ranking" : undefined} aria-label="Classement de QuizzShow">
    <div className={styles.opening}>
      <KqQuizzShowScene mode="ranking" />
      <div>
        <KqChapterHeading title="Classement">
          {snapshot ? <p>Édition du <time dateTime={snapshot.event.editionDate}>{editionDate(snapshot.event.editionDate)}</time>.</p>
            : <p>Les finales de la semaine et les titres remportés.</p>}
        </KqChapterHeading>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={onTournament}>Tournoi <ArrowRight size={18} aria-hidden="true" /></button>
          {ownerId ? <button type="button" onClick={() => void load()} disabled={loading} data-school-ranking-refresh>
            <RefreshCw size={17} aria-hidden="true" />Actualiser
          </button> : null}
        </div>
      </div>
    </div>

    {!ownerId ? <div className={styles.notice}>
      <p>Connecte-toi pour consulter le classement et retrouver tes résultats.</p>
      <button type="button" onClick={reconnect}>Se reconnecter</button>
    </div> : null}
    {error ? <div className={styles.error} role="alert">
      <p>{error}</p>
      {snapshot ? <p className={styles.small}>Les derniers résultats reçus restent affichés ci-dessous.</p> : null}
      {authProblem === 'expired' ? <button type="button" onClick={reconnect}>Se reconnecter et reprendre</button>
        : authProblem === 'owner-changed' ? <button type="button" onClick={() => window.location.reload()}>Recharger la page</button>
          : <button type="button" disabled={loading} onClick={() => void load()}>Réessayer</button>}
    </div> : null}
    {loading ? <p className={styles.small} role="status">{snapshot ? 'Actualisation du classement…' : 'Chargement du classement…'}</p> : null}

    {snapshot ? <>
      <div className={styles.highlights}>
        <section className={`${styles.panel} ${styles.champion}`} aria-labelledby="school-ranking-champion">
          <h3 id="school-ranking-champion"><Crown size={25} aria-hidden="true" />Le fauteuil</h3>
          {champion ? <>
            <div className={styles.identity}><Avatar key={champion.userId} player={champion} /><div>
              <strong>{champion.displayName}{champion.userId === ownerId ? ' · toi' : ''}</strong>
              <span>Champion en titre</span>
            </div></div>
            <KqProgressMeter label="Score à battre" value={champion.score} max={450} valueLabel={`${points(champion.score)} / 450`} tone="gold" />
            <p className={styles.small}>{champion.correctCount} / 3 réponses justes · {duration(champion.elapsedMs)}</p>
          </> : <p>Le fauteuil est libre. Aucun champion n’a encore été désigné.</p>}
        </section>
        <section className={styles.panel} aria-labelledby="school-ranking-own">
          <h3 id="school-ranking-own">Ta semaine</h3>
          {ownResult ? <>
            <p className={styles.ownRank}>N° {ownResult.rank}<span>au classement affiché</span></p>
            <KqProgressMeter label="Ta meilleure finale" value={ownResult.score} max={450} valueLabel={`${points(ownResult.score)} / 450`} />
            <p className={styles.small}>{ownResult.correctCount} / 3 réponses justes · {duration(ownResult.elapsedMs)}</p>
          </> : <p>Ton résultat ne figure pas dans le classement affiché. Retrouve le tournoi pour jouer une finale.</p>}
        </section>
      </div>

      <section className={styles.register} aria-labelledby="school-weekly-ranking-title" data-school-weekly-ranking>
        <h3 id="school-weekly-ranking-title">Cette semaine</h3>
        <p className={styles.small}>Meilleure finale par joueur · score sur 450 points</p>
        <p className={styles.small}>Attribution du titre : <time dateTime={snapshot.event.awardAt}>{dateTime(snapshot.event.awardAt)}</time>, heure de Paris.</p>
        {snapshot.weeklyLeaderboard.length ? <ol className={styles.rows}>
          {snapshot.weeklyLeaderboard.map(player => <li key={player.userId} data-own={player.userId === ownerId}>
            <span className={styles.rank} aria-label={`Rang ${player.rank}`}>{player.rank}</span>
            <Avatar player={player} />
            <div className={styles.playerName}><strong>{player.displayName}{player.userId === ownerId ? ' · toi' : ''}</strong>
              <small>{player.correctCount} / 3 réponses justes · {duration(player.elapsedMs)}</small>
            </div>
            <strong className={styles.score}>{points(player.score)}</strong>
          </li>)}
        </ol> : <p>Aucune finale enregistrée cette semaine.</p>}
      </section>

      <section className={styles.register} aria-labelledby="school-palmares-title" data-school-palmares>
        <h3 id="school-palmares-title">Palmarès</h3>
        {snapshot.leaderboard.length ? <ol className={styles.rows}>
          {snapshot.leaderboard.map(player => <li key={player.userId} data-own={player.userId === ownerId}>
            <span className={styles.rank} aria-label={`Rang ${player.rank}`}>{player.rank}</span>
            <Avatar player={player} />
            <div className={styles.playerName}><strong>{player.displayName}{player.userId === ownerId ? ' · toi' : ''}</strong>
              <small>{player.tournaments} tournoi{player.tournaments > 1 ? 's' : ''} · {player.finals} finale{player.finals > 1 ? 's' : ''}</small>
            </div>
            <div className={styles.score}><strong>{player.titles} titre{player.titles > 1 ? 's' : ''}</strong>
              <small>Meilleur score : {points(player.bestScore)}</small>
            </div>
          </li>)}
        </ol> : <p>Aucun résultat enregistré pour le moment.</p>}
      </section>

      <details className={styles.rules}>
        <summary>Lire le classement</summary>
        <p>Chaque classement affiche jusqu’à 50 joueurs. Seule la meilleure finale de la semaine de chaque joueur compte dans la course au fauteuil.</p>
        <p>Les points incluent le bonus de rapidité. Les égalités sont départagées par le nombre de réponses justes, puis le temps cumulé, puis le premier résultat enregistré.</p>
        <p>À la clôture, le meilleur challenger devient champion s’il dépasse le résultat du titulaire. À égalité parfaite de points, de réponses justes et de temps, le champion garde le fauteuil. Les bots et les replays ne gagnent ni titre ni place au classement.</p>
      </details>
      <p className={styles.updated}>Résultats reçus le <time dateTime={snapshot.serverNow}>{dateTime(snapshot.serverNow)}</time>, heure de Paris.</p>
    </> : null}
  </section>;
}
