"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Gift, Swords, Trophy } from "lucide-react";
import { calculateKqPlacardScore } from "@/lib/kanab-quest-reputation";
import styles from "./KqSeasonBoard.module.css";

type Standing = { id: string; rank: number; name: string; placardScore: number; isPlayer: boolean };
export type KqSeasonBoardProps = {
  seasonCode?: string; rank: number | null; score: number; rating: number; seasonPoints: number; reputation: number;
  wins: number; losses: number; streak: number; arenaExperience: number; leaderboard: Standing[];
  updatedAt?: string | null; local?: boolean; onOpenArena?: () => void;
};

export function KqSeasonBoard({ seasonCode, rank, score, rating, seasonPoints, reputation, wins, losses, streak, arenaExperience, leaderboard, updatedAt, local = false, onOpenArena }: KqSeasonBoardProps) {
  const season = /^KQ-(\d{4})-S(\d+)$/.exec(seasonCode ?? "");
  const seriesProgress = streak % 3;
  const remainingWins = 3 - seriesProgress;
  const breakdown = calculateKqPlacardScore({ rating, seasonPoints, reputation });
  const duelAction = <><Swords size={17} aria-hidden="true" />Engager une fleur<ArrowRight size={17} aria-hidden="true" /></>;
  return <section id="placard-saison" data-kq-season-board className={styles.board} aria-labelledby="placard-season-title">
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>{local ? "Simulation locale" : season ? `Saison ${season[2]} · ${season[1]}` : "Saison en cours"}</span><h2 id="placard-season-title">Un seul classement.<br /><em>Tous les chanvriers.</em></h2><p>{local ? "Cet aperçu utilise des adversaires simulés." : "Débutants ou habitués, tout le monde peut se rencontrer. Fais grimper ton Score Placard en cultivant et en jouant tes duels."}</p></div>
      <Image className={styles.art} src="/contest/mascot/arena-scene-classement-v2.png" alt="" width={360} height={240} sizes="(max-width: 650px) 110px, 240px" />
    </header>
    <div className={styles.body}>
      <div className={styles.player}>
        <div className={styles.sectionLabel}><Trophy size={16} aria-hidden="true" />Ma place dans la saison</div>
        <dl className={styles.stats}>
          <div><dt>Classement</dt><dd>{rank === null ? "—" : `#${rank}`}</dd><small>{rank === null ? "Un premier duel t’attend" : "Tous les joueurs réunis"}</small></div>
          <div><dt>Score Placard</dt><dd>{score.toLocaleString("fr-FR")}</dd><small>Le score qui te classe</small></div>
        </dl>
        <p className={styles.record}><Swords size={16} aria-hidden="true" /><strong>{wins} victoire{wins !== 1 ? "s" : ""}</strong><span>·</span>{losses} défaite{losses !== 1 ? "s" : ""}</p>
        <div className={styles.reward}>
          <Gift size={26} aria-hidden="true" /><div><strong>Ton prochain pack La Botte</strong><p>Encore {remainingWins} victoire{remainingWins !== 1 ? "s" : ""} d’affilée pour un pack de 10 cartes.</p><div className={styles.steps} aria-label={`${seriesProgress} victoire sur 3 vers le prochain pack`}>{[0, 1, 2].map(n => <i key={n} data-won={n < seriesProgress} />)}</div><small>Série actuelle : {streak} · Une défaite remet la série à zéro.</small></div>
        </div>
        {!local ? <div className={styles.play}>{onOpenArena ? <button type="button" onClick={onOpenArena}>{duelAction}</button> : <Link prefetch={false} href="/arene/placard?view=arena">{duelAction}</Link>}<p>Adversaire tiré au sort dans la file commune.</p></div> : null}
      </div>
      <div className={styles.leaders}>
        <div className={styles.sectionLabel}>En tête du Placard<span>Score</span></div>
        {leaderboard.length ? <ol>{leaderboard.map(entry => <li key={entry.id} data-player={entry.isPlayer}><b className={styles.place}>#{entry.rank}</b><span className={styles.name}>{entry.name}{entry.isPlayer ? <small>Toi</small> : null}</span><strong>{entry.placardScore.toLocaleString("fr-FR")}</strong></li>)}</ol> : <p className={styles.empty}>Le classement n’est pas encore disponible.</p>}
        {!local ? <Link className={styles.fullRanking} prefetch={false} href="/arene?vue=classement">Voir tout le classement<ArrowRight size={15} aria-hidden="true" /></Link> : null}
        <p className={styles.openPool}><Swords size={18} aria-hidden="true" />La cote et la qualité de ta fleur ne limitent pas les adversaires que tu peux rencontrer.</p>
      </div>
    </div>
    <details className={styles.details}>
      <summary>Comprendre mon score et mes gains</summary>
      <div className={styles.detailsBody}>
        <p>Ton <strong>Score Placard</strong> additionne les résultats de tes duels, ta progression de saison et ta réputation.</p>
        <dl className={styles.breakdown}><div><dt>Cote de duel</dt><dd>{breakdown.rating}</dd><small>Elle monte avec les victoires et baisse avec les défaites. Battre un adversaire mieux coté rapporte davantage.</small></div><div><dt>Bonus de saison</dt><dd>+{breakdown.seasonBonus}</dd><small>{seasonPoints} points de saison · Bonus plafonné à 150.</small></div><div><dt>Bonus de réputation</dt><dd>+{breakdown.reputationBonus}</dd><small>{reputation} de réputation · Bonus progressif, plafonné à 100.</small></div></dl>
        {score !== breakdown.score ? <p>Score calculé actuellement : <strong>{breakdown.score}</strong>. Le classement affiché repose sur sa dernière mise à jour.</p> : null}
        <p><strong>{arenaExperience.toLocaleString("fr-FR")} EXP d’Arène</strong> gagnée. L’EXP suit ton parcours ; elle n’est pas ajoutée directement au Score Placard.</p>
        <p>Un pack bonus récompense chaque palier de trois victoires consécutives : 3, 6, 9… Les entraînements contre les bots ne modifient ni ta cote ni ta série.</p>
        {!local ? <p>Les joueurs partagent la même file. Le tirage privilégie les fleurs qui attendent depuis le plus longtemps, sans condition de division, de cote ou de qualité.</p> : null}
        {updatedAt ? <small>Classement mis à jour le {new Date(updatedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}.</small> : null}
      </div>
    </details>
  </section>;
}
