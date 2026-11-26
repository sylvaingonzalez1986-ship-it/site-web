"use client";

import Image from 'next/image';
import { createClientRequestKey } from '@/lib/client-request-key';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BookOpen, CalendarDays, Check, Circle, Clock, Crown, Diamond, LogOut, Square, Triangle, Trophy, Users, X } from 'lucide-react';
import { KQ_TOURNAMENT_QUESTION_MS, KQ_TOURNAMENT_STAGES, KQ_TOURNAMENT_VERSION, parseKqSchoolTournamentCommand, type KqTournamentChampion, type KqTournamentCommand, type KqTournamentIdentity, type KqTournamentPlayer, type KqTournamentRoom, type KqTournamentSnapshot } from '@/lib/kanab-quest-school-tournament';
import { KqQuizzShowScene } from './KqQuizzShowScene';
import { ChanvrierAvatar } from '../contest/ChanvrierAvatar';
import { HEMP_QUIZ_BANK_SIZE } from '@/lib/kanab-quest-hemp-quiz-meta';
import styles from './KqSchoolTournament.module.css';

type Props = { ownerId?: string; onEncyclopedia: () => void; onOpen: (module: string, passage: string) => void };
const endpoint = '/api/arena/placard/school/tournament';
const shapes = [Triangle, Diamond, Circle, Square];
const points = (value: number) => `${value.toLocaleString('fr-FR')} pts`;
const editionDate = (value: string) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(value));
const duration = (value: number) => `${(value / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} s`;
const storageKey = (owner: string) => `kq-school-tournament-pending:v1:${owner}`;
const PlayerAvatar = memo(ChanvrierAvatar, (previous, next) => previous.view === next.view && previous.className === next.className && JSON.stringify(previous.profile) === JSON.stringify(next.profile));
const profileOf = (player: KqTournamentIdentity) => player.avatar;
const isReplay = (player: KqTournamentPlayer) => player.isReplay;
const endReasons: Readonly<Record<string, string>> = {
  lobby_expired: 'Le salon a expiré avant le départ.',
  event_closed: 'Le dimanche est terminé. Ce salon n’avait pas encore démarré ; retrouve le tournoi dimanche prochain.',
  no_active_players: 'La partie s’est arrêtée : plus aucun participant n’était en jeu.',
  finalist_absent: 'Le finaliste n’était plus présent à la clôture. Le fauteuil n’a pas été attribué.',
  champion_timeout: 'Le défi du fauteuil a expiré avant son résultat.',
  champion_changed: 'Le titulaire du fauteuil a changé. Un nouveau salon permet de le défier.',
  already_champion: 'Le finaliste détient déjà le fauteuil.',
};

function restorePending(owner?: string): KqTournamentCommand | null {
  if (!owner) return null;
  try {
    const stored = JSON.parse(sessionStorage.getItem(storageKey(owner)) || 'null');
    if (stored?.ownerId !== owner || stored?.version !== KQ_TOURNAMENT_VERSION) return null;
    return parseKqSchoolTournamentCommand(stored.command);
  } catch { /* The tournament also works without browser storage. */ }
  return null;
}

function savePending(owner: string, command: KqTournamentCommand | null) {
  try {
    if (command) sessionStorage.setItem(storageKey(owner), JSON.stringify({ ownerId: owner, version: KQ_TOURNAMENT_VERSION, command }));
    else sessionStorage.removeItem(storageKey(owner));
  } catch { /* A failed write never submits an extra command. */ }
}

function Avatar({ player }: { player: KqTournamentIdentity }) {
  const [failed, setFailed] = useState(false);
  const profile = profileOf(player);
  return <span className={styles.avatar} aria-hidden>{profile ? <PlayerAvatar profile={profile} view="portrait"/> : player.avatarUrl && !failed
    ? <Image src={player.avatarUrl} alt="" width={64} height={64} unoptimized onError={() => setFailed(true)}/>
    : <span>{player.displayName.trim().slice(0, 2).toLocaleUpperCase('fr')}</span>}</span>;
}

function Contestants({ seats, room, ownerId, waiting, closed }: {
  seats: (KqTournamentPlayer | null)[]; room?: KqTournamentRoom | null; ownerId?: string; waiting: boolean; closed: boolean;
}) {
  return <ol className={styles.podiums} aria-label="Les quatre pupitres">{seats.map((player, index) => {
    const feedback = room?.status === 'reveal' ? room.reveal?.answers.find(answer => answer.userId === player?.userId) : undefined;
    let state = 'En jeu';
    if (room?.status === 'complete' || room?.status === 'cancelled') state = 'Parcours terminé';
    else if (!player?.isActive) state = 'Spectateur';
    else if (room?.status === 'lobby') state = player.ready ? 'Prêt' : 'En attente';
    else if (waiting) state = 'Prêt';
    else if (feedback) state = feedback.isCorrect ? 'Bonne réponse' : 'Réponse manquée';
    else if (room?.status === 'question') {
      if (player.answered) state = player.isReplay ? 'Performance rejouée' : 'Choix envoyé';
      else if (closed) state = 'Temps écoulé';
      else if (player.userId === ownerId) state = 'À toi de jouer';
      else state = player.isReplay ? 'Replay en cours' : 'Réfléchit…';
    }
    const own = Boolean(player && player.userId === ownerId);
    return <li key={index} className={styles.contestant} data-tournament-seat={index + 1} data-tournament-player={player?.userId} data-replay={player?.isReplay ?? false} data-bot={player?.isBot ?? false} data-eliminated={Boolean(player && !player.isActive)} data-own={own}>
      <span className={styles.seatNumber}><span className={styles.visuallyHidden}>Pupitre </span>{index + 1}</span>
      <div><strong>{player?.displayName ?? 'Place libre'}{own ? ' · toi' : ''}</strong>
        {player ? <>
          <span>{player.isBot ? 'Bot d’entraînement' : player.isReplay ? 'Replay' : player.connected ? 'En direct' : 'Hors connexion'}{player.isReplay && player.replayRecordedAt ? ` du ${new Date(player.replayRecordedAt).toLocaleDateString('fr-FR')}` : ''}</span>
          <span>{state}{feedback ? ` · +${points(feedback.awardedPoints)}` : ''}</span>
          {room?.status !== 'lobby' ? <small className={styles.podiumScore}>{points(player.isActive ? player.stageScore : player.score)} {player.isActive ? 'dans la manche' : 'au total'}</small> : null}
        </> : null}
      </div>
    </li>;
  })}</ol>;
}

function Champion({ champion, compact = false }: { champion: KqTournamentChampion | null; compact?: boolean }) {
  return <section className={`${styles.champion} ${compact ? styles.compactChampion : ''}`} aria-label="Score du champion">
    <Crown size={compact ? 27 : 36} aria-hidden/>
    {champion ? <><div className={styles.championIdentity}><Avatar player={champion}/><div><h3>{champion.displayName}</h3><span>Champion en titre · score enregistré</span></div></div>
      <p className={styles.benchmark}>{champion.score}<span> / 450 pts</span></p><p className={styles.small}>{champion.correctCount} / 3 réponses justes · {duration(champion.elapsedMs)}</p></>
      : <><h3>Le fauteuil est libre</h3><p>Le meilleur finaliste de la semaine sera désigné dimanche à minuit.</p></>}
  </section>;
}

function Path({ stage }: { stage?: number }) {
  return <ol className={styles.path} aria-label="Parcours du tournoi">{KQ_TOURNAMENT_STAGES.map(item => <li key={item.stage} aria-current={item.stage === stage ? 'step' : undefined} data-passed={stage !== undefined && item.stage < stage}>
    <span className={styles.pathNumber}>{item.entrants === 1 ? <Crown size={22} aria-hidden/> : item.entrants}</span><span><strong>{item.stage === 4 ? 'Le fauteuil' : `${item.entrants} joueurs`}</strong><small>3 questions</small></span>
  </li>)}</ol>;
}

function Standings({ room, ownerId }: { room: KqTournamentRoom; ownerId?: string }) {
  const players = [...room.players].sort((a, b) => Number(b.isActive) - Number(a.isActive) || b.score - a.score || a.seat - b.seat);
  return <section className={styles.standings} data-tournament-standings><h3>Les joueurs</h3><ul>{players.map(player => <li key={player.userId} data-own={player.userId === ownerId} data-eliminated={!player.isActive}>
    <Avatar player={player}/><div className={styles.playerName}><strong>{player.displayName}{player.userId === ownerId ? ' · toi' : ''}</strong><small>{player.isBot ? 'Bot · ' : isReplay(player) ? 'Replay · ' : ''}{!player.isActive ? 'Spectateur' : player.answered && room.status === 'question' ? isReplay(player) ? 'Performance rejouée' : 'Réponse enregistrée' : isReplay(player) ? 'Performance enregistrée' : !player.isBot && !player.connected ? 'Hors connexion' : 'En jeu'}</small></div>
    <div className={styles.playerPoints}>{player.isActive ? <strong>{points(player.stageScore)}<small>cette manche</small></strong> : null}<span>{points(player.score)}<small>au total</small></span></div>
  </li>)}</ul></section>;
}

/** Account changes remount the complete session, aborting requests and isolating pending commands. */
export function KqSchoolTournament(props: Props) {
  return <TournamentSession key={props.ownerId || 'guest'} {...props}/>;
}

function TournamentSession({ ownerId, onEncyclopedia, onOpen }: Props) {
  const [snapshot, setSnapshot] = useState<KqTournamentSnapshot | null>(null);
  const [pending, setPending] = useState<KqTournamentCommand | null>(() => restorePending(ownerId));
  const [loading, setLoading] = useState(Boolean(ownerId));
  const [busy, setBusy] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [commandError, setCommandError] = useState('');
  const [rejected, setRejected] = useState(false);
  const [animations, setAnimations] = useState(true);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [tick, setTick] = useState(0);
  const mounted = useRef(true), sequence = useRef(0);
  const request = useRef<{ controller: AbortController; kind: 'read' | 'write' } | null>(null);
  const latest = useRef<KqTournamentSnapshot | null>(null);
  const pendingRef = useRef(pending);
  const clock = useRef({ server: 0, client: 0 });
  const studio = useRef<HTMLDivElement>(null);
  const phaseFocus = useRef<HTMLDivElement>(null);
  const questionPanel = useRef<HTMLDivElement>(null);
  const questionHeading = useRef<HTMLHeadingElement>(null);
  const revealPanel = useRef<HTMLDivElement>(null);
  const leaveButton = useRef<HTMLButtonElement>(null);
  const stayButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirmLeave) stayButton.current?.focus();
  }, [confirmLeave]);

  function stayInRoom() {
    setConfirmLeave(false);
    leaveButton.current?.focus({ preventScroll: true });
  }

  const clearPending = useCallback(() => {
    pendingRef.current = null; setPending(null); setRejected(false); setCommandError('');
    if (ownerId) savePending(ownerId, null);
  }, [ownerId]);

  const accept = useCallback((value: KqTournamentSnapshot) => {
    if (value.ownerId !== ownerId || !Number.isFinite(Date.parse(value.serverNow))) throw new Error('Le compte a changé. Rouvre le tournoi avec le bon joueur.');
    clock.current = { server: Date.parse(value.serverNow), client: performance.now() };
    setTick(performance.now()); latest.current = value; setSnapshot(value);
    const command = pendingRef.current, room = value.room;
    const self = room?.players.find(player => player.userId === ownerId);
    // A read can confirm an action, but never sends or replays one.
    if (command && (
      (command.action === 'join' && self && room?.status !== 'complete' && room?.status !== 'cancelled') ||
      (command.action === 'leave' && (!room || room.id !== command.roomId || !self)) ||
      (command.action === 'ready' && room?.id === command.roomId && self?.ready === command.ready) ||
      ((command.action === 'fill_replays' || command.action === 'fill_opponents') && room?.id === command.roomId && room.players.length === 4) ||
      (command.action === 'answer' && room?.id === command.roomId && ((room.question?.id === command.questionId && room.ownAnswerId === command.optionId) || (room.reveal?.question.id === command.questionId && room.reveal.answers.some(answer => answer.userId === ownerId && answer.optionId === command.optionId))))
    )) clearPending();
  }, [ownerId, clearPending]);

  const load = useCallback(async () => {
    if (!ownerId || request.current || !mounted.current) return;
    const controller = new AbortController(), token = ++sequence.current;
    request.current = { controller, kind: 'read' };
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(endpoint, { cache: 'no-store', headers: { 'X-Kq-School-Owner': ownerId }, signal: controller.signal });
      const value = await response.json();
      if (!mounted.current || token !== sequence.current) return;
      if (!response.ok) throw new Error(value.error || 'Le tournoi est momentanément indisponible.');
      accept(value); setConnectionError('');
    } catch (cause) {
      if (mounted.current && token === sequence.current) setConnectionError(cause instanceof Error && cause.name !== 'AbortError' ? cause.message : 'Connexion interrompue. Le tournoi continue côté serveur.');
    } finally {
      clearTimeout(timeout);
      if (token === sequence.current) { request.current = null; if (mounted.current) setLoading(false); }
    }
  }, [ownerId, accept]);

  const stopRequests = useCallback(() => {
    mounted.current = false; sequence.current++; request.current?.controller.abort(); request.current = null;
  }, []);

  useEffect(() => {
    mounted.current = true; void load();
    return stopRequests;
  }, [load, stopRequests]);

  const room = snapshot?.room;
  const players = room?.players;
  const seats = useMemo(() => Array.from({ length: 4 }, (_, index) => players?.find(player => player.seat === index + 1) ?? null), [players]);
  const status = room?.status;
  const serverNow = clock.current.server + Math.max(0, tick - clock.current.client);
  const startsIn = room?.openedAt ? Math.max(0, Date.parse(room.openedAt) - serverNow) : 0;
  const questionOpen = status === 'question' && Boolean(room?.openedAt) && startsIn <= 0;
  useEffect(() => {
    if (!ownerId) return;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const schedule = () => {
      if (stopped) return;
      clearTimeout(timer);
      const current = latest.current?.room?.status;
      const delay = document.hidden || !current || current === 'complete' || current === 'cancelled' ? 15000 : 2000;
      timer = setTimeout(async () => { await load(); schedule(); }, delay);
    };
    const visibility = () => { clearTimeout(timer); if (!document.hidden) void load(); schedule(); };
    schedule(); document.addEventListener('visibilitychange', visibility);
    return () => { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', visibility); };
  }, [ownerId, load, status]);

  useEffect(() => {
    if (!ownerId) return;
    const timer = setInterval(() => { if (!document.hidden) setTick(performance.now()); }, status === 'question' ? 200 : 1000);
    return () => clearInterval(timer);
  }, [room?.id, status, ownerId]);

  const questionId = room?.question?.id || room?.reveal?.question.id;
  useEffect(() => {
    if (!status || status === 'lobby' || document.hidden) return;
    const panel = status === 'question' && questionOpen ? questionPanel.current : status === 'reveal' ? revealPanel.current : phaseFocus.current;
    const focusTarget = status === 'question' && questionOpen ? questionHeading.current : panel;
    const shellHeader = panel?.closest('[data-placard-view]')?.querySelector<HTMLElement>('#placard-content > header');
    if (!panel || !studio.current) return;
    const margin = (shellHeader?.getBoundingClientRect().height || 74) + 10;
    const firstAnswer = (panel.querySelector('[data-tournament-answer]') ?? panel.querySelector('h3'))?.getBoundingClientRect();
    const showSet = !firstAnswer || firstAnswer.bottom - studio.current.getBoundingClientRect().top <= window.innerHeight - margin;
    const anchor = showSet ? studio.current : panel;
    anchor.style.scrollMarginTop = `${margin}px`;
    focusTarget?.focus({ preventScroll: true });
    anchor.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [room?.id, status, questionId, questionOpen]);

  const submit = async (command: KqTournamentCommand) => {
    if (!ownerId || request.current?.kind === 'write' || (pendingRef.current && pendingRef.current.requestKey !== command.requestKey)) return;
    const currentRoom = latest.current?.room;
    if (command.action !== 'join' && currentRoom?.id !== command.roomId) { setCommandError('Cette action appartient à un autre salon. Actualise le tournoi.'); setRejected(true); return; }
    if (command.action === 'answer') {
      const currentTime = clock.current.server + Math.max(0, performance.now() - clock.current.client);
      if (currentRoom?.status !== 'question' || currentRoom.question?.id !== command.questionId || !currentRoom.openedAt || currentTime < Date.parse(currentRoom.openedAt) || !currentRoom.closesAt || currentTime >= Date.parse(currentRoom.closesAt)) return;
    }
    request.current?.controller.abort();
    const controller = new AbortController(), token = ++sequence.current;
    request.current = { controller, kind: 'write' };
    pendingRef.current = command; setPending(command); savePending(ownerId, command);
    setBusy(true); setCommandError(''); setRejected(false);
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(endpoint, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', 'X-Kq-School-Owner': ownerId }, body: JSON.stringify(command), signal: controller.signal });
      const value = await response.json();
      if (!mounted.current || token !== sequence.current) return;
      if (!response.ok) { setRejected(response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status)); throw new Error(value.error || 'Cette action n’a pas été confirmée.'); }
      accept(value); clearPending(); setConnectionError(''); setConfirmLeave(false);
    } catch (cause) {
      if (mounted.current && token === sequence.current) setCommandError(cause instanceof Error && cause.name !== 'AbortError' ? cause.message : 'Envoi interrompu. Ton choix est conservé, en attente de confirmation.');
    } finally {
      clearTimeout(timeout);
      if (token === sequence.current) { request.current = null; if (mounted.current) { setBusy(false); setLoading(false); } }
    }
  };

  const self = room?.players.find(player => player.userId === ownerId);
  const remaining = room?.closesAt ? Math.max(0, Date.parse(room.closesAt) - serverNow) : 0;
  const seconds = Math.ceil(remaining / 1000);
  const nextSeconds = room?.nextAt ? Math.max(0, Math.ceil((Date.parse(room.nextAt) - serverNow) / 1000)) : null;
  const activeQuestion = status === 'question';
  const reveal = status === 'reveal' ? room?.reveal : null;
  const question = activeQuestion ? room?.question : null;
  const terminal = status === 'complete' || status === 'cancelled';
  const titleHolder = snapshot?.champion?.userId === ownerId;
  const eventOpen = Boolean(snapshot?.event.isOpen && serverNow < Date.parse(snapshot.event.closesAt));
  const fillingSeconds = room?.autofillAt ? Math.max(0, Math.ceil((Date.parse(room.autofillAt) - serverNow) / 1000)) : null;
  const stage = KQ_TOURNAMENT_STAGES.find(item => item.stage === room?.stage);
  const selected = room?.ownAnswerId || (pending?.action === 'answer' && pending.questionId === question?.id ? pending.optionId : null);
  const pendingFits = Boolean(snapshot && pending && !rejected && (pending.action === 'join' ? (!room || terminal) && !titleHolder && eventOpen : room?.id === pending.roomId && (pending.action === 'answer' ? questionOpen && question?.id === pending.questionId && remaining > 0 : pending.action === 'ready' || pending.action === 'fill_replays' || pending.action === 'fill_opponents' ? status === 'lobby' : !terminal)));
  const activePlayers = room?.players.filter(player => player.isActive) || [];
  const finalist = room?.players.find(player => player.userId === room.winnerId) || (room?.stage === 4 && activePlayers.length === 1 ? activePlayers[0] : undefined);
  const ownFeedback = reveal?.answers.find(answer => answer.userId === ownerId);
  const humans = room?.players.filter(player => !player.isReplay && !player.isBot) || [];
  const weeklyResult = room?.reason === 'weekly_recorded';
  const titleDecided = weeklyResult || room?.titleWon || room?.reason === 'champion_defended';
  const leave = () => { if (room) void submit({ action: 'leave', requestKey: createClientRequestKey(), roomId: room.id }); };

  return <section className={styles.tournament} data-school-tournament data-tutorial-ready={!!snapshot && !loading && !connectionError} data-guide-school-answered={!commandError && !connectionError && room?.status === 'reveal' && room.reveal?.answers.some(answer => answer.userId === ownerId && answer.optionId !== null) || undefined} data-motion={animations ? 'on' : 'off'} aria-label="Tournoi du fauteuil">
    {connectionError ? <div className={styles.error} role="alert"><p>{connectionError}</p><button type="button" data-tournament-retry disabled={busy} onClick={() => void load()}>Actualiser la connexion</button></div> : null}
    {commandError ? <p className={styles.error} role="alert">{commandError}</p> : null}
    {pending ? <div className={styles.pending} role="status"><p>{busy ? 'Enregistrement en cours…' : !snapshot ? 'Vérification de ton action précédente…' : pendingFits ? 'Une action attend sa confirmation.' : 'Cette action n’est plus disponible dans l’état actuel du tournoi.'}</p>{!busy && snapshot ? pendingFits
      ? <button type="button" data-tournament-retry onClick={() => void submit(pending)}>Retrouver cette validation</button>
      : <button type="button" data-tournament-retry onClick={() => { clearPending(); void load(); }}>Retrouver le tournoi enregistré</button> : null}</div> : null}
    {!ownerId ? <p>Connecte-toi pour rejoindre le tournoi et retrouver ton classement.</p> : null}
    {loading && !snapshot ? <p role="status">Ouverture du tournoi…</p> : null}

    {!room || status === 'lobby' ? <header className={styles.intro}>
      <h2>Le tournoi du champion</h2>
      <p data-tournament-question-bank>{HEMP_QUIZ_BANK_SIZE} questions sur le cannabis récréatif et le CBD</p>
    </header> : null}
    <div ref={studio} className={styles.studio}>
      <div className={styles.set}><KqQuizzShowScene mode="tournament" seats={seats} motion={animations}/></div>
      <div className={styles.broadcast}>
        {snapshot && (!room || status === 'lobby') ? <div data-tournament-lobby>
          {room ? <section className={styles.lobby}><div className={styles.sectionTop}><h3>Le plateau se remplit</h3><span role="status">{room.players.length} / 4 participants · {humans.length} joueur{humans.length > 1 ? 's' : ''} en direct</span></div><div className={styles.matchmaking} data-tournament-matchmaking><Users size={26} aria-hidden/><div><strong>{fillingSeconds !== null && fillingSeconds > 0 ? 'Recherche de joueurs' : 'Préparation du plateau…'}</strong><p>Les places libres seront complétées automatiquement avec les replays de la semaine, puis des bots.</p></div>{fillingSeconds !== null && fillingSeconds > 0 ? <span className={styles.searchCountdown} role="timer" aria-label={"Remplissage automatique dans " + fillingSeconds + " secondes"}>{fillingSeconds} s</span> : null}</div><div className={styles.actions}><button type="button" data-tournament-leave disabled={busy || Boolean(pending)} onClick={leave}>Quitter le salon<LogOut size={17} aria-hidden/></button></div></section>
            : <div className={styles.join}>{titleHolder ? <p className={styles.holder}>Tu détiens le fauteuil. Ton score reste à battre cette semaine. Le meilleur challenger prendra le fauteuil dimanche à minuit s’il fait mieux que toi.</p> : eventOpen ? <><h3>Prendre un pupitre</h3><p>Quatre candidats, trois manches éliminatoires et une finale pour décrocher le fauteuil.</p><button type="button" className={styles.primary} data-tournament-join disabled={busy || Boolean(pending)} onClick={() => void submit({ action: 'join', requestKey: createClientRequestKey() })}>Participer au tournoi<ArrowRight size={20} aria-hidden/></button><p>3 questions par manche · 20 s par réponse</p></> : <p>Le plateau est en cours d’actualisation.</p>}</div>}
        </div> : null}
        {room && status !== 'lobby' ? <div ref={phaseFocus} tabIndex={-1} className={styles.phase} data-answering={activeQuestion}>
          {!terminal ? <header className={styles.roundHeader}><div><h2>{stage?.title || 'Le tournoi'}</h2><p>{room.stage === 4 ? 'Défi hors ligne contre un score enregistré' : `${activePlayers.length} joueur${activePlayers.length > 1 ? 's' : ''} en jeu`}</p></div><dl><div><dt>{self?.isActive ? 'Ta manche' : 'Ta dernière manche'}</dt><dd>{self ? points(self.stageScore) : '—'}</dd></div><div><dt>Ton total</dt><dd>{self ? points(self.score) : '—'}</dd></div></dl></header> : null}
          {self && !self.isActive && !terminal ? <p className={styles.spectator} role="status">Tu es éliminé. Tu peux suivre la suite comme spectateur.</p> : null}
          {room.stage === 4 && !terminal ? <><Champion champion={room.championTarget} compact/><p className={styles.small}>Reste dans le tournoi jusqu’au résultat pour prendre le fauteuil.</p></> : null}

          {question && !questionOpen ? <div className={styles.countdown} data-tournament-countdown><h3>La question arrive</h3><strong role="timer" aria-label={`Départ dans ${Math.ceil(startsIn / 1000)} secondes`}>{Math.ceil(startsIn / 1000)}</strong><p>Prépare-toi : 20 secondes pour répondre.</p></div> : null}
          {question && questionOpen ? <div ref={questionPanel} className={styles.questionPanel} data-tournament-question={question.id}>
            <div className={styles.questionMeta}><span>Question {room.questionNumber} / 3</span><span>{room.stage === 4 ? 'Niveau expert' : `Manche ${room.stage} / 3`}</span></div>
            <div className={styles.timer} data-expired={remaining <= 0}><div><Clock size={19} aria-hidden/><span>{remaining > 0 ? 'Temps pour répondre' : 'Temps écoulé'}</span><strong role="timer" aria-label={`${seconds} secondes restantes`}>{seconds} s</strong></div><div className={styles.timerTrack} aria-hidden><span style={{ width: `${Math.min(100, remaining / KQ_TOURNAMENT_QUESTION_MS * 100)}%` }}/></div></div>
            <h3 ref={questionHeading} tabIndex={-1} className={styles.prompt}>{question.prompt}</h3>
            <p className={styles.answerHint} role="status">{selected ? 'Ton choix est enregistré ou en cours de confirmation. La correction arrive à la clôture.' : !self?.isActive ? 'Observe les réponses. La correction sera dévoilée à la clôture.' : remaining <= 0 ? 'Les réponses sont fermées. En attente de la correction…' : 'Choisis une réponse. Ton choix est définitif.'}</p>
            <div className={styles.options} role="group" aria-label="Les quatre réponses">{question.options.map((option, index) => { const Shape = shapes[index] || Square; return <button key={option.id} type="button" className={styles.option} data-tournament-answer={option.id} data-tone={index + 1} data-selected={selected === option.id} aria-pressed={selected === option.id} disabled={busy || Boolean(pending) || !self?.isActive || Boolean(room.ownAnswerId) || Boolean(self?.answered) || remaining <= 0} onClick={() => void submit({ action: 'answer', requestKey: createClientRequestKey(), roomId: room.id, questionId: question.id, optionId: option.id })}><span className={styles.answerMarker} aria-hidden><Shape size={24}/><span>{index + 1}</span></span><span>{option.text}{selected === option.id ? <small>Ton choix</small> : null}</span></button>; })}</div>
          </div> : null}

          {reveal ? <div ref={revealPanel} tabIndex={-1} className={styles.reveal} data-tournament-reveal><div className={styles.verdict}><h3>{ownFeedback ? ownFeedback.isCorrect ? 'Bonne réponse !' : ownFeedback.optionId ? 'La bonne réponse était…' : 'Temps écoulé' : 'La correction'}</h3>{ownFeedback ? <strong>{points(ownFeedback.awardedPoints)}</strong> : null}</div><p className={styles.revealPrompt}>{reveal.question.prompt}</p><ul className={styles.options} aria-label="Correction des réponses">{reveal.question.options.map((option, index) => { const Shape = shapes[index] || Square, correct = option.id === reveal.correctOptionId, own = option.id === ownFeedback?.optionId; return <li key={option.id} className={styles.option} data-outcome={correct ? 'correct' : own ? 'incorrect' : 'unused'}><span className={styles.answerMarker} aria-hidden><Shape size={24}/><span>{index + 1}</span></span><span>{option.text}{correct || own ? <small>{correct ? <Check size={17} aria-hidden/> : <X size={17} aria-hidden/>}{correct ? 'Bonne réponse' : 'Ton choix'}</small> : null}</span></li>; })}</ul><p className={styles.explanation}>{reveal.explanation}</p><p className={styles.next} role="status">{nextSeconds ? `La suite dans ${nextSeconds} s` : 'Le serveur prépare la suite…'}</p><details><summary>Lire la fiche après cette question</summary><button type="button" onClick={() => onOpen(reveal.question.lessonId, reveal.question.sectionId)}><BookOpen size={17} aria-hidden/>Ouvrir l’encyclopédie</button><p className={styles.small}>Le tournoi continue pendant ta lecture.</p></details></div> : null}

          {status === 'stage_result' ? <section className={styles.stageResult} data-tournament-result><Trophy size={42} aria-hidden/><h3>{room.stage === 4 ? 'Le défi est terminé' : 'Manche terminée'}</h3><p>{room.stage === 4 ? 'Les trois réponses sont enregistrées. Ta finale est inscrite au classement de la semaine.' : self?.isActive ? room.stage === 3 ? 'Tu accèdes au défi du fauteuil.' : 'Tu passes à la manche suivante.' : 'Ton parcours s’arrête ici. Tu peux suivre les autres joueurs.'}</p><div className={styles.survivors}>{activePlayers.map(player => <div key={player.userId}><Avatar player={player}/><strong>{player.displayName}</strong><span>{points(player.stageScore)}</span></div>)}</div><p className={styles.next} role="status">{nextSeconds ? `${room.stage === 4 ? 'Le résultat' : 'La prochaine étape'} dans ${nextSeconds} s` : 'Préparation de la suite…'}</p></section> : null}

          {status === 'champion_wait' ? <section className={styles.stageResult}><Crown size={42} aria-hidden/><h3>Le fauteuil se prépare</h3><p>Un autre finaliste termine son défi. Ton salon attend son tour.</p><p className={styles.small} role="status">La disponibilité est vérifiée automatiquement. Reste dans le salon pour commencer.</p></section> : null}

          {status === 'complete' ? <section className={styles.result} data-tournament-result><Trophy size={40} aria-hidden/><h2>{weeklyResult ? 'Finale enregistrée !' : room.reason === 'bots_won' ? 'Les bots remportent cette partie' : room.reason === 'replay_won' ? 'Les replays remportent cette partie' : room.titleWon && finalist ? `${finalist.displayName} prend le fauteuil !` : room.reason === 'champion_defended' && room.championTarget ? `${room.championTarget.displayName} garde le fauteuil` : 'Tournoi terminé'}</h2>{finalist && titleDecided ? <div className={styles.finalComparison}><div><Avatar player={finalist}/><strong>{finalist.displayName}</strong><span>{finalist.stageScore} / 450 pts</span><small>{finalist.correctCount} / 3 réponses justes · {duration(finalist.stageElapsedMs)}</small></div>{room.championTarget ? <div><Avatar player={room.championTarget}/><strong>{room.championTarget.displayName}</strong><span>{room.championTarget.score} / 450 pts</span><small>{room.championTarget.correctCount} / 3 réponses justes · {duration(room.championTarget.elapsedMs)}</small></div> : null}</div> : null}<p>{weeklyResult ? 'Ton meilleur résultat de finale compte pour le titre de la semaine. Les points incluent déjà le bonus de rapidité ; le titre sera attribué à la clôture.' : room.reason === 'bots_won' ? 'Retente ta chance ! Les bots ne gagnent ni titre ni place au classement. Tes réponses restent enregistrées.' : room.reason === 'replay_won' ? 'Aucun joueur en direct n’accède au fauteuil. Aucun titre n’est attribué aux performances rejouées.' : titleDecided ? 'Le défi compare deux scores enregistrés sur trois questions de niveau expert, avec des questions différentes.' : endReasons[room.reason || ''] || 'Le tournoi est terminé.'}</p>{weeklyResult && room.resultEditionDate ? <p className={styles.small} data-tournament-result-edition>Clôture : {editionDate(room.resultEditionDate)} à minuit, heure de Paris.</p> : null}{titleHolder ? <p className={styles.holder}>Tu détiens le fauteuil. Ton score reste à défendre ; l’encyclopédie reste accessible.</p> : eventOpen ? <button type="button" className={styles.primary} data-tournament-join disabled={busy || Boolean(pending)} onClick={() => void submit({ action: 'join', requestKey: createClientRequestKey() })}>Rejouer<ArrowRight size={19} aria-hidden/></button> : <p>Prochain tournoi : {snapshot ? editionDate(snapshot.event.nextOpensAt) : 'dimanche'}.</p>}</section> : null}

          {status === 'cancelled' ? <section className={styles.result} data-tournament-result><h2>Tournoi interrompu</h2><p>{endReasons[room.reason || ''] || 'Ce salon ne peut plus continuer.'}</p>{titleHolder ? <p className={styles.holder}>Tu détiens le fauteuil. L’encyclopédie reste accessible.</p> : eventOpen ? <button type="button" className={styles.primary} data-tournament-join disabled={busy || Boolean(pending)} onClick={() => void submit({ action: 'join', requestKey: createClientRequestKey() })}>Rejouer</button> : <p>Le tournoi revient dimanche prochain.</p>}</section> : null}
        </div> : null}
      </div>
      {snapshot ? <Contestants room={room} ownerId={ownerId} seats={seats} waiting={activeQuestion && !questionOpen} closed={activeQuestion && remaining <= 0}/> : null}
    </div>

    {snapshot ? <Path stage={room && status !== 'lobby' ? room.stage : undefined}/> : null}
    {snapshot && (!room || status === 'lobby' || terminal) ? <section className={styles.eventCard} data-tournament-event data-open={eventOpen} aria-label="Attribution du prochain titre"><CalendarDays size={38} aria-hidden/><div><h3>{editionDate(snapshot.event.editionDate)}</h3><p>Clôture des finales dimanche à minuit · heure de Paris</p></div><strong role="status">Ouvert toute la semaine</strong></section> : null}
    {snapshot && (!room || status === 'lobby') ? <Champion champion={snapshot.champion} compact/> : null}
    {room && status !== 'lobby' ? <>
      <Standings room={room} ownerId={ownerId}/>
      {!terminal ? <div className={styles.leave}>
        <button type="button" ref={leaveButton} data-tournament-leave aria-expanded={confirmLeave}
          disabled={busy || Boolean(pending)} onClick={() => setConfirmLeave(value => !value)}>
          Quitter le tournoi<LogOut size={16} aria-hidden/>
        </button>
        {confirmLeave ? <div className={styles.confirm} role="group" aria-label="Confirmer le départ" aria-describedby="tournament-leave-effect"
          onKeyDown={event => {
            if (event.key === 'Escape' && !busy && !pending) {
              event.preventDefault();
              event.stopPropagation();
              stayInRoom();
            }
          }}>
          <p id="tournament-leave-effect">{self?.isActive ? 'Quitter te retire du tournoi en cours. Les autres joueurs peuvent continuer.' : 'Quitter arrête le suivi de ce salon.'}</p>
          <button type="button" ref={stayButton} disabled={busy || Boolean(pending)} onClick={stayInRoom}>Rester</button>
          <button type="button" disabled={busy || Boolean(pending)} onClick={leave}>Confirmer le départ</button>
        </div> : null}
      </div> : null}
    </> : null}

    {snapshot && (!room || status === 'lobby' || terminal) ? <section className={styles.leaderboard} data-tournament-weekly-ranking><h3>La course au fauteuil</h3><p className={styles.small}>Meilleure finale par joueur · points et rapidité · titre dimanche à minuit</p>{snapshot.weeklyLeaderboard.length ? <ol>{snapshot.weeklyLeaderboard.map(player => <li key={player.userId} data-own={player.userId === ownerId}><span className={styles.rank}>{player.rank}</span><Avatar player={player}/><div className={styles.playerName}><strong>{player.displayName}{player.userId === ownerId ? ' · toi' : ''}</strong><small>{player.correctCount} / 3 réponses justes · {duration(player.elapsedMs)}</small></div><div className={styles.rankingScore}><strong>{points(player.score)}</strong><small>sur 450 points</small></div></li>)}</ol> : <p>Aucune finale enregistrée cette semaine.</p>}</section> : null}

    {snapshot && (!room || status === 'lobby' || terminal) ? <section className={styles.leaderboard}><h3>Le palmarès</h3>{snapshot.leaderboard.length ? <ol>{snapshot.leaderboard.map(player => <li key={player.userId}><span className={styles.rank}>{player.rank}</span><Avatar player={player}/><div className={styles.playerName}><strong>{player.displayName}</strong><small>{player.tournaments} tournoi{player.tournaments > 1 ? 's' : ''} · {player.finals} finale{player.finals > 1 ? 's' : ''}</small></div><div className={styles.rankingScore}><strong>{player.titles} titre{player.titles > 1 ? 's' : ''}</strong><small>Meilleur score : {points(player.bestScore)}</small></div></li>)}</ol> : <p>Aucun résultat enregistré pour le moment.</p>}</section> : null}
    {!activeQuestion ? <div className={styles.footer}><button type="button" onClick={onEncyclopedia}><BookOpen size={18} aria-hidden/>Explorer l’encyclopédie</button><button type="button" className={styles.motionToggle} aria-label="Animations" aria-pressed={animations} onClick={() => setAnimations(value => !value)}>Animations {animations ? 'activées' : 'réduites'}</button></div> : <button type="button" className={styles.motionToggle} aria-label="Animations" aria-pressed={animations} onClick={() => setAnimations(value => !value)}>Animations {animations ? 'activées' : 'réduites'}</button>}
    <details className={styles.rules}><summary>Les règles et les départages</summary><p>Le tournoi est ouvert tous les jours. La semaine de compétition va du lundi à 0 h au dimanche à minuit, à l’heure de Paris. Un clic suffit : le plateau recherche des joueurs pendant quinze secondes, puis se complète automatiquement avec les replays de cette édition et des bots si nécessaire. Quatre joueurs présents démarrent sans attendre. Une partie continue normalement au changement de semaine. L’heure serveur de la dernière réponse de la finale détermine la semaine de ton résultat. Trois questions par manche : les trois meilleurs passent, puis les deux meilleurs, puis un finaliste.</p><p>Une réponse juste rapporte 100 points, avec jusqu’à 50 points de rapidité. Après 20 secondes, la réponse est fermée. Le score de manche repart de zéro ; le total reste affiché.</p><p>Les replays reproduisent la réussite et le rythme d’une ancienne session sur des questions différentes, de même niveau. Tes sessions terminées cette semaine peuvent aussi être rejouées avec ton personnage, sans ajouter de points à ton classement. Les anciennes éditions restent archivées ; une nouvelle finale est nécessaire pour figurer au classement de la nouvelle semaine. Une réponse historique donnée après 20 secondes ne rapporte aucun point dans ce format. Les bots ont leur propre personnage et des réponses simulées. Ni les bots ni les replays ne gagnent de titre ou de points au classement. Ton parcours complet de 12 questions pourra servir de replay ; une partie interrompue reste enregistrée, sans inventer les réponses manquantes.</p><p>À égalité dans une manche : nombre de réponses justes, puis temps cumulé, puis tirage au sort.</p><p>Le finaliste répond à trois questions de niveau expert et défie le score enregistré du champion, hors ligne. Le titre est attribué uniquement à minuit à la fin du dimanche. Seule ta meilleure finale de la semaine compte : points avec bonus de rapidité, puis bonnes réponses, puis temps cumulé. Entre deux challengers parfaitement à égalité, le premier résultat enregistré passe devant. Le meilleur challenger devient champion seulement s’il dépasse le score de référence du titulaire ; sinon le champion garde son fauteuil. Les deux séries ont le même niveau, mais des questions différentes ; le score à battre est fixé au début du défi. À égalité parfaite de score, de bonnes réponses et de temps, le champion garde le fauteuil.</p></details>
  </section>;
}
