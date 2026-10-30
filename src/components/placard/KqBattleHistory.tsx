"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, Clock3, Swords, Trophy } from "lucide-react";
import type { KqOfficialBattle } from "@/lib/kanab-quest-api";
import { KQ_BATTLE_HISTORY_LIMIT } from "@/lib/kanab-quest-battle-history-policy";
import { KQ_REWARD_BALANCE } from "@/lib/kanab-quest-reward-balance";
import { KqJuryRecap } from "./KqPersonalRecap";
import { KqAllocationBar, KqBarChart, KqProgressMeter } from "./KqVisuals";
import styles from "./KqBattleHistory.module.css";

const PAGE_SIZE = 5;
const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

function battleDate(battle: KqOfficialBattle) {
  const value = battle.verdictAt ?? battle.lockedAt;
  const date = new Date(value);
  return { value, label: dateFormat.format(date), time: timeFormat.format(date) };
}

function BattleReceipt({ battle, onOpenLot }: { battle: KqOfficialBattle; onOpenLot?: (flowerId: string) => void }) {
  const cancelled = battle.status === "cancelled";
  const won = battle.winner === "player";
  const playerWins = battle.rounds.filter(round => round.winner === "player").length;
  const opponentWins = battle.rounds.filter(round => round.winner === "opponent").length;
  const date = battleDate(battle);
  const experience = battle.experienceAwarded ?? (battle.opponentType === "bot" ? KQ_REWARD_BALANCE.training.arenaExperience.min : 0);

  return <details
    className={styles.receipt}
    data-status={battle.status}
    data-result={cancelled ? "cancelled" : won ? "won" : "lost"}
    data-archived-jury-recap={cancelled ? undefined : true}
    data-battle-id={battle.id}
    tabIndex={-1}
  >
    <summary className={styles.receiptSummary}>
      <span className={styles.result}>
        <span>{cancelled ? "Expiré" : won ? "Victoire" : "Défaite"}</span>
        <strong aria-label={cancelled ? "Sans verdict" : `${playerWins} manches gagnées, ${opponentWins} perdues`}>
          {cancelled ? "—" : `${playerWins}–${opponentWins}`}
        </strong>
      </span>
      <span className={styles.matchup}>
        <small>{battle.opponentType === "bot" ? "Entraînement" : "Duel officiel"}</small>
        <strong>{battle.playerFlower.variety}</strong>
        <span>face à {battle.opponentFlower.variety}</span>
      </span>
      <span className={styles.metadata}>
        <time dateTime={date.value}>{date.label}<span> · {date.time}</span></time>
        <span>{cancelled ? "Aucun point · aucune Fleur brûlée" : `+${experience.toLocaleString("fr-FR")} EXP d’Arène`}</span>
      </span>
      <ChevronDown className={styles.expandIcon} aria-hidden="true" />
    </summary>
    <div className={styles.receiptBody}>
      {cancelled ? <p className={styles.cancelledNotice}>Engagement annulé après 48 heures. Aucun verdict, aucune Fleur consommée et aucun point : les deux Fleurs sont redevenues disponibles.</p> : <>
        <div className={styles.lotContinuation}><p>Le stock a été conservé au verdict. Consulte Commerce pour vérifier ce qu’il reste de ce lot.</p>{onOpenLot ? <button type="button" data-battle-open-lot={battle.playerFlower.id} onClick={() => onOpenLot(battle.playerFlower.id)}>Voir ce lot dans Commerce <ArrowRight size={16} aria-hidden="true" /></button> : null}</div>
        <div className={styles.rounds} aria-label="Scores des manches">
          {battle.rounds.map(round => <div key={round.code} data-won={round.winner === "player" || undefined}>
            <KqBarChart title={round.label} items={[
              { label: "Ta Fleur", value: round.playerScore, displayValue: String(round.playerScore), tone: "teal" },
              { label: "Adversaire", value: round.opponentScore, displayValue: String(round.opponentScore), tone: "gold" },
            ]} />
            <small>{round.winner === "player" ? "Manche gagnée" : "Manche perdue"}</small>
          </div>)}
        </div>
        <p className={styles.burnNotice}>{battle.opponentType === "bot" ? "Ta Fleur brûlée" : "Deux Fleurs brûlées"} · +{experience.toLocaleString("fr-FR")} EXP d’Arène</p>
        <KqJuryRecap rounds={battle.rounds} playerStats={battle.playerFlower.stats} opponentStats={battle.opponentFlower.stats} />
      </>}
    </div>
  </details>;
}

export function KqBattleHistory({ battles, pending, onRequestVerdict, onLoadRecent, loadingRecent = false, recentLoaded = false, recentError, initialBattleId, onOpenLot }: {
  battles: KqOfficialBattle[];
  pending: boolean;
  onRequestVerdict: (id: string) => void;
  onLoadRecent?: () => void;
  loadingRecent?: boolean;
  recentLoaded?: boolean;
  recentError?: string;
  initialBattleId?: string;
  onOpenLot?: (flowerId: string) => void;
}) {
  const root = useRef<HTMLElement>(null);
  const focusedBattle = useRef<string | null>(null);
  const requestedBattle = useRef(initialBattleId);
  const sorted = [...battles].sort((left, right) =>
    Date.parse(right.verdictAt ?? right.lockedAt) - Date.parse(left.verdictAt ?? left.lockedAt)
    || right.id.localeCompare(left.id));
  const locked = sorted.filter(battle => battle.status === "locked");
  const recent = sorted.filter(battle => battle.status !== "locked").slice(0, KQ_BATTLE_HISTORY_LIMIT);
  const judged = recent.filter(battle => battle.status === "verdict");
  const wins = judged.filter(battle => battle.winner === "player").length;
  const losses = judged.filter(battle => battle.winner === "opponent").length;
  const historyKey = recent.map(battle => `${battle.id}:${battle.status}`).join("|");
  const [pagination, setPagination] = useState({ historyKey, page: 0 });
  const pageCount = Math.max(1, Math.ceil(recent.length / PAGE_SIZE));
  const page = pagination.historyKey === historyKey ? Math.min(pagination.page, pageCount - 1) : 0;
  const offset = page * PAGE_SIZE;
  const visible = recent.slice(offset, offset + PAGE_SIZE);
  const targetIndex = recent.findIndex(battle => battle.id === initialBattleId);
  useEffect(() => {
    if (requestedBattle.current !== initialBattleId) { requestedBattle.current = initialBattleId; focusedBattle.current = null; }
    if (!initialBattleId || focusedBattle.current === initialBattleId) return;
    const frame = requestAnimationFrame(() => {
      if (targetIndex >= 0 && Math.floor(targetIndex / PAGE_SIZE) !== page) {
        setPagination({ historyKey, page: Math.floor(targetIndex / PAGE_SIZE) });
        return;
      }
      const target = Array.from(root.current?.querySelectorAll<HTMLElement>("[data-battle-id]") ?? []).find(node => node.dataset.battleId === initialBattleId);
      if (!target) return;
      if (target instanceof HTMLDetailsElement) target.open = true;
      focusedBattle.current = initialBattleId;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "start", behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [initialBattleId, targetIndex, page, historyKey, battles]);

  return <section ref={root} className={styles.history} data-kq-battle-history aria-label="Mes duels">
    <div className={styles.heading}>
      <span className={styles.headingIcon}><Swords aria-hidden="true" /></span>
      <div><h2>Mes duels</h2><p>Retrouve les verdicts et le lot de chaque duel.</p></div>
    </div>

    {locked.length > 0 ? <div className={styles.pendingList}>
      <h3><Clock3 aria-hidden="true" /> {locked.length} duel{locked.length > 1 ? "s" : ""} en attente de verdict</h3>
      {locked.map(battle => <div key={battle.id} className={styles.pendingBattle} data-pending-battle data-battle-id={battle.id} tabIndex={-1}>
        <div><strong>{battle.playerFlower.variety} <span>face à</span> {battle.opponentFlower.variety}</strong><p>Le verdict consomme les deux Fleurs d’Arène. Ton stock récolté est conservé pour la vente.</p></div>
        <button type="button" disabled={pending} onClick={() => onRequestVerdict(battle.id)}><Trophy aria-hidden="true" /> Demander le verdict</button>
      </div>)}
    </div> : null}

    {recent.length > 0 ? <>
      <ol className={styles.list} start={offset + 1} key={`${historyKey}:${page}`} aria-label={`Combats ${offset + 1} à ${offset + visible.length}`}>
        {visible.map(battle => <li key={battle.id}><BattleReceipt battle={battle} onOpenLot={onOpenLot} /></li>)}
      </ol>
      <details className={styles.overview} data-battle-statistics><summary>Bilan des duels chargés</summary>
        <KqAllocationBar label="Résultats des combats jugés" emptyLabel="Aucun verdict dans cet historique." items={[
          { label: "Victoires", value: wins, displayValue: String(wins), tone: "teal" },
          { label: "Défaites", value: losses, displayValue: String(losses), tone: "red" },
        ]} />
        {judged.length > 0 ? <KqProgressMeter label="Taux de victoire" value={wins} max={judged.length}
          valueLabel={`${Math.round(wins / judged.length * 100)} %`} hint={`${wins} victoires sur ${judged.length} verdicts`} /> : null}
        <p>Bilan des {judged.length} combats jugés de cet historique · officiels et entraînements.</p>
      </details>
      <nav className={styles.pagination} aria-label="Pages de l’historique des combats">
        <button type="button" aria-label="Voir les combats plus récents" disabled={page === 0} onClick={() => setPagination({ historyKey, page: page - 1 })}><ChevronLeft aria-hidden="true" /></button>
        <p aria-live="polite" aria-atomic="true"><strong>{offset + 1}–{offset + visible.length} sur {recent.length}</strong><span>Page {page + 1} / {pageCount}</span></p>
        <button type="button" aria-label="Voir les combats plus anciens" disabled={page + 1 >= pageCount} onClick={() => setPagination({ historyKey, page: page + 1 })}><ChevronRight aria-hidden="true" /></button>
      </nav>
    </> : <div className={styles.empty}><Trophy aria-hidden="true" /><strong>{recentLoaded ? "Aucun résultat récent" : "Résultats précédents"}</strong><p>{recentLoaded ? "Aucun duel terminé dans l’historique chargé." : "Charge les derniers duels pour retrouver leurs résultats."}</p></div>}
    {onLoadRecent && !recentLoaded ? <div className={styles.loadRecent}>
      {recentError ? <p role="alert">{recentError}</p> : null}
      <button type="button" disabled={loadingRecent} onClick={onLoadRecent}>
        {loadingRecent ? "Chargement des combats…" : recentError ? "Réessayer de charger les combats" : `Charger les ${KQ_BATTLE_HISTORY_LIMIT} derniers combats`}
      </button>
    </div> : null}
  </section>;
}
