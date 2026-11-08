"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Gift, Swords, Trophy } from "lucide-react";
import { calculateKqPlacardScore } from "@/lib/kanab-quest-reputation";
import { KqBarChart, KqProgressMeter } from "./KqVisuals";
import { KqHelpDashboard, KqHelpGrid, KqHelpNote } from "./KqHelpDashboard";
import styles from "./KqSeasonBoard.module.css";

type Standing = { id: string; rank: number; name: string; placardScore: number; businessScore?: number | null; isPlayer: boolean };
const formatScore = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
export type KqSeasonBoardProps = {
  seasonCode?: string; rank: number | null; score: number; rating: number; seasonPoints: number; reputation: number;
  wins: number; losses: number; streak: number; arenaExperience: number; leaderboard: Standing[];
  businessScore?: number; updatedAt?: string | null; local?: boolean; onOpenArena?: () => void;
};

export function KqSeasonBoard({ seasonCode, rank, score, rating, seasonPoints, reputation, wins, losses, streak, arenaExperience, leaderboard, businessScore = 0, updatedAt, local = false, onOpenArena }: KqSeasonBoardProps) {
  const season = /^KQ-(\d{4})-S(\d+)$/.exec(seasonCode ?? "");
  const seriesProgress = streak % 3;
  const remainingWins = 3 - seriesProgress;
  const breakdown = calculateKqPlacardScore({ rating, seasonPoints, reputation, businessScore });
  const duelAction = <><Swords size={17} aria-hidden="true" />Engager une fleur<ArrowRight size={17} aria-hidden="true" /></>;
  return <section id="placard-saison" data-kq-season-board className={styles.board} aria-labelledby="placard-season-title">
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>{local ? "Simulation locale" : season ? `Saison ${season[2]} · ${season[1]}` : "Saison en cours"}</span><h2 id="placard-season-title">Le tableau<br /><em>du village.</em></h2><p>{local ? "Cet aperçu utilise des adversaires simulés." : "Débutants ou habitués, tous les chanvriers partagent ce classement. Fais-toi un nom avec tes cultures, tes duels et le développement de ton entreprise."}</p></div>
      <Image className={styles.art} src="/contest/mascot/arena-scene-classement-v2.png" alt="" width={360} height={240} sizes="(max-width: 650px) 110px, 240px" />
    </header>
    <div className={styles.body}>
      <div className={styles.player}>
        <div className={styles.sectionLabel}><Trophy size={16} aria-hidden="true" />Ma place dans la saison</div>
        <dl className={styles.stats}>
          <div><dt>Classement</dt><dd>{rank === null ? "—" : `#${rank}`}</dd><small>{rank === null ? "Un premier duel t’attend" : "Tous les joueurs réunis"}</small></div>
          <div><dt>Score Kanab Quest</dt><dd>{formatScore(score)}</dd><small>Dont +{formatScore(breakdown.businessBonus)} pour ton entreprise</small></div>
        </dl>
        <p className={styles.record}><Swords size={16} aria-hidden="true" /><strong>{wins} victoire{wins !== 1 ? "s" : ""}</strong><span>·</span>{losses} défaite{losses !== 1 ? "s" : ""}</p>
        <div className={styles.reward}>
          <Gift size={26} aria-hidden="true" /><div><strong>Le bonus des séries</strong><p>Encore {remainingWins} victoire{remainingWins !== 1 ? "s" : ""} d’affilée pour un pack Botte de 10 cartes.</p>
            <KqProgressMeter label="Vers le prochain pack de série" value={seriesProgress} max={3} valueLabel={`${seriesProgress} / 3 victoires`} tone="gold" />
            <small>Série actuelle : {streak}. Une défaite remet cette série à zéro.</small></div>
        </div>
        {!local ? <div className={styles.otherPath}><p>Une défaite ne retire pas tes XP métier. Les missions de culture, d’atelier et de commerce offrent aussi des récompenses.</p><Link prefetch={false} href="/arene/placard?view=missions">Choisir un objectif personnel<ArrowRight size={16} aria-hidden="true" /></Link></div> : null}
        {!local ? <div className={styles.play}>{onOpenArena ? <button type="button" onClick={onOpenArena}>{duelAction}</button> : <Link prefetch={false} href="/arene/placard?view=arena">{duelAction}</Link>}<p>Adversaire tiré au sort dans la file commune.</p></div> : null}
      </div>
      <div className={styles.leaders}>
        <div className={styles.sectionLabel}>En tête de Kanab Quest<span>Score</span></div>
        {leaderboard.length ? <ol>{leaderboard.map(entry => <li key={entry.id} data-player={entry.isPlayer}><b className={styles.place}>#{entry.rank}</b><span className={styles.identity}><span className={styles.name}>{entry.name}{entry.isPlayer ? <small>Toi</small> : null}</span><small>{Number.isFinite(entry.businessScore) ? `Entreprise ${formatScore(entry.businessScore!)} pts` : "Score d’entreprise non renseigné"}</small></span><strong>{formatScore(entry.placardScore)}</strong></li>)}</ol> : <p className={styles.empty}>Le classement n’est pas encore disponible.</p>}
        {!local ? <Link className={styles.fullRanking} prefetch={false} href="/arene?vue=classement">Voir tout le classement<ArrowRight size={15} aria-hidden="true" /></Link> : null}
        <p className={styles.openPool}><Swords size={18} aria-hidden="true" />La cote et la qualité de ta fleur ne limitent pas les adversaires que tu peux rencontrer.</p>
      </div>
    </div>
    <details className={styles.details}>
      <summary>Comprendre mon score et mes gains</summary>
      <div className={styles.detailsBody}>
        <KqHelpDashboard>
        <KqBarChart title="Les points qui composent ton score" items={[
          { label: "Cote de duel", value: breakdown.rating, displayValue: `${formatScore(breakdown.rating)} pts` },
          { label: "Bonus de saison", value: breakdown.seasonBonus, displayValue: `+${formatScore(breakdown.seasonBonus)} pts`, tone: "gold" },
          { label: "Bonus de réputation", value: breakdown.reputationBonus, displayValue: `+${formatScore(breakdown.reputationBonus)} pts`, tone: "ink" },
          { label: "Entreprise", value: breakdown.businessBonus, displayValue: `+${formatScore(breakdown.businessBonus)} pts` },
        ]} />
        <KqHelpGrid art="help-training" items={[
          { label: "Cote de duel", value: "Victoire ↑ · défaite ↓", detail: "Battre mieux coté rapporte davantage." },
          { label: `${formatScore(seasonPoints)} points de saison`, value: "+150 pts max.", art: "achievements" },
          { label: `${formatScore(reputation)} de réputation`, value: "+100 pts max.", detail: "Bonus progressif.", art: "help-social" },
        ]} />
        <KqHelpGrid art="help-culture" items={[
          { label: "Surface cultivée", value: "Moyenne sur 30 jours", detail: "Hors espaces vides, pauses, séchage et stockage." },
          { label: "Chiffre d’affaires", value: "Saison en cours", detail: "Ventes encaissées, hors taxes et annulations.", art: "help-accounts" },
          { label: "Réputation commerciale", value: "Valeur actuelle", art: "help-social" },
        ]} />
        <details><summary>Formule du score d’entreprise et égalités</summary>
          <KqHelpGrid art="help-accounts" items={[{ label: "Exemple de calcul", value: "90 points", detail: "50 m² de moyenne + 10 000 € de ventes + 600 de réputation. Progression dégressive, sans plafond." }]} />
          <KqHelpNote>Entreprise = 27 × log₂(1 + surface / 50) + 36 × log₂(1 + chiffre d’affaires / 10 000) + 27 × log₂(1 + réputation / 600).</KqHelpNote>
          <KqHelpNote>À score égal, dans l’ordre : meilleure réputation → meilleure cote → plus de victoires → moins de défaites → plus de points de saison.</KqHelpNote>
        </details>
        {score !== breakdown.score ? <p>Score calculé actuellement : <strong>{formatScore(breakdown.score)}</strong>. Le classement affiché repose sur sa dernière mise à jour.</p> : null}
        <KqHelpGrid art="help-training" items={[
          { label: "Parcours d’Arène", value: `${arenaExperience.toLocaleString("fr-FR")} EXP`, detail: "Non ajoutée directement au score." },
          { label: "Victoires consécutives", value: "3, 6, 9… → 1 pack", art: "collection" },
          { label: "Entraînements", value: "Cote et série inchangées" },
        ]} />
        {!local ? <KqHelpNote>File commune : priorité aux Fleurs qui attendent le plus longtemps, sans condition de division, cote ou qualité.</KqHelpNote> : null}
        {updatedAt ? <small>Classement mis à jour le {new Date(updatedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}.</small> : null}
        </KqHelpDashboard>
      </div>
    </details>
  </section>;
}
