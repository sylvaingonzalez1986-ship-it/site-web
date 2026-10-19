"use client";

import { useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Clock3, Swords, Trophy } from "lucide-react";
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

function BattleReceipt({ battle }: { battle: KqOfficialBattle }) {
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
      {cancelled ? <p className={styles.cancelledNotice}>Engagement annulé après 48 heures. Aucun verdict, aucun burn et aucun point : les deux Fleurs sont redevenues disponibles.</p> : <>
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

export function KqBattleHistory({ battles, pending, onRequestVerdict, onLoadRecent, loadingRecent = false, recentLoaded = false, recentError }: {
  battles: KqOfficialBattle[];
  pending: boolean;
  onRequestVerdict: (id: string) => void;
  onLoadRecent?: () => void;
  loadingRecent?: boolean;
  recentLoaded?: boolean;
  recentError?: string;
}) {
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

  return <section className={styles.history} data-kq-battle-history aria-label="Historique de mes combats">
    <div className={styles.heading}>
      <span className={styles.headingIcon}><Swords aria-hidden="true" /></span>
      <div><span className={styles.eyebrow}>Le carnet de l’Arène</span><h2>Mes derniers combats</h2><p>Jusqu’aux {KQ_BATTLE_HISTORY_LIMIT} derniers combats, {PAGE_SIZE} par page. Ouvre un résultat pour revoir le jury.</p></div>
    </div>

    {locked.length > 0 ? <div className={styles.pendingList}>
      <h3><Clock3 aria-hidden="true" /> {locked.length} duel{locked.length > 1 ? "s" : ""} en attente de verdict</h3>
      {locked.map(battle => <div key={battle.id} className={styles.pendingBattle} data-pending-battle data-battle-id={battle.id}>
        <div><strong>{battle.playerFlower.variety} <span>face à</span> {battle.opponentFlower.variety}</strong><p>Les deux Fleurs sont verrouillées. Le verdict les brûlera définitivement.</p></div>
        <button type="button" disabled={pending} onClick={() => onRequestVerdict(battle.id)}><Trophy aria-hidden="true" /> Demander le verdict</button>
      </div>)}
    </div> : null}

    {recent.length > 0 ? <>
      <div className={styles.overview}>
        <KqAllocationBar label="Résultats des combats jugés" emptyLabel="Aucun verdict dans cet historique." items={[
          { label: "Victoires", value: wins, displayValue: String(wins), tone: "teal" },
          { label: "Défaites", value: losses, displayValue: String(losses), tone: "red" },
        ]} />
        {judged.length > 0 ? <KqProgressMeter label="Taux de victoire" value={wins} max={judged.length}
          valueLabel={`${Math.round(wins / judged.length * 100)} %`} hint={`${wins} victoires sur ${judged.length} verdicts`} /> : null}
        <p>Bilan des {judged.length} combats jugés de cet historique · officiels et entraînements.</p>
      </div>
      <ol className={styles.list} start={offset + 1} key={`${historyKey}:${page}`} aria-label={`Combats ${offset + 1} à ${offset + visible.length}`}>
        {visible.map(battle => <li key={battle.id}><BattleReceipt battle={battle} /></li>)}
      </ol>
      <nav className={styles.pagination} aria-label="Pages de l’historique des combats">
        <button type="button" aria-label="Voir les combats plus récents" disabled={page === 0} onClick={() => setPagination({ historyKey, page: page - 1 })}><ChevronLeft aria-hidden="true" /></button>
        <p aria-live="polite" aria-atomic="true"><strong>{offset + 1}–{offset + visible.length} sur {recent.length}</strong><span>Page {page + 1} / {pageCount}</span></p>
        <button type="button" aria-label="Voir les combats plus anciens" disabled={page + 1 >= pageCount} onClick={() => setPagination({ historyKey, page: page + 1 })}><ChevronRight aria-hidden="true" /></button>
      </nav>
    </> : <div className={styles.empty}><Trophy aria-hidden="true" /><strong>Ton palmarès commence ici</strong><p>Tes résultats apparaîtront après ton premier verdict.</p></div>}
    {onLoadRecent && !recentLoaded ? <div className={styles.loadRecent}>
      {recentError ? <p role="alert">{recentError}</p> : null}
      <button type="button" disabled={loadingRecent} onClick={onLoadRecent}>
        {loadingRecent ? "Chargement des combats…" : recentError ? "Réessayer de charger les combats" : `Charger les ${KQ_BATTLE_HISTORY_LIMIT} derniers combats`}
      </button>
    </div> : null}
  </section>;
}
