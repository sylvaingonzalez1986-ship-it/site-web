"use client";

import Image from "next/image";
import Link from "@/components/navigation/NavigationLink";
import { ArrowRight, ChevronDown, Gift, ShoppingBag, Sparkles, Star, Swords, Trophy } from "lucide-react";
import type { ReactNode } from "react";
import { AppDialog } from "@/components/ui/AppDialog";
import type { KqOfficialBattle } from "@/lib/kanab-quest-api";
import { getKqJuryTakeaway, type KqJuryAnalysisInput } from "@/lib/kanab-quest-jury-analysis";
import styles from "./KqBattleVerdictDialog.module.css";

type Props = {
  battleId?: string;
  kind: "official" | "training";
  winner: "player" | "opponent";
  subtitle: string;
  rounds: KqOfficialBattle["rounds"];
  experience: number;
  challengePoints: number;
  challenges: string[];
  cardCount: number;
  rewardCard?: { name: string; description: string; imageUrl: string } | null;
  rank?: { rating: number; seasonPoints: number; wins: number; losses: number } | null;
  trainingProgress?: string;
  receipt: string;
  playerStats?: KqJuryAnalysisInput["playerStats"];
  opponentStats?: KqJuryAnalysisInput["opponentStats"];
  onPrepare?: () => void;
  prepareHref?: string;
  prepareLabel?: string;
  continuation?: ReactNode;
  onOpenLot?: () => void;
  children: ReactNode;
  onClose: () => void;
};

export function KqBattleVerdictDialog({ battleId, kind, winner, subtitle, rounds, experience, challengePoints, challenges, cardCount, rewardCard, rank, trainingProgress, receipt, playerStats, opponentStats, onPrepare, prepareHref, prepareLabel = "Préparer ma prochaine culture", continuation, onOpenLot, children, onClose }: Props) {
  const won = winner === "player";
  const titleId = kind === "training" ? "bot-result-title" : "official-result-title";
  const playerScore = rounds.filter(round => round.winner === "player").length;
  const opponentScore = rounds.filter(round => round.winner === "opponent").length;
  const takeaway = getKqJuryTakeaway({ rounds, playerStats, opponentStats });
  return <AppDialog open onClose={onClose} title="Verdict du jury" closeLabel="Fermer le verdict" labelledBy={titleId}
    className={styles.dialog} bodyClassName={styles.body}
    dialogProps={{ "data-verdict-result": true, "data-battle-id": battleId, "data-victory": won || undefined }}
    footer={<div className={styles.nextActions}>
      {onOpenLot ? <button type="button" className={styles.continue} data-verdict-open-lot onClick={onOpenLot}><ShoppingBag size={18} aria-hidden="true" />Voir ce lot dans Commerce<ArrowRight size={18} aria-hidden="true" /></button> : null}
      {onPrepare ? <button type="button" className={onOpenLot ? styles.secondary : styles.continue} data-verdict-prepare onClick={onPrepare}>{prepareLabel}</button>
        : prepareHref ? <Link className={onOpenLot ? styles.secondary : styles.continue} data-verdict-prepare href={prepareHref} prefetch={false}>{prepareLabel}</Link>
          : !onOpenLot ? <button type="button" className={styles.continue} onClick={onClose}>Continuer</button> : null}
    </div>}>
    <div className={styles.hero} data-won={won}>
      <span className={styles.emblem}>{won ? <Trophy aria-hidden="true" /> : <Swords aria-hidden="true" />}</span>
      <div><span className={styles.eyebrow}>{kind === "training" ? `Entraînement${trainingProgress ? ` · ${trainingProgress}` : ""}` : "Duel officiel"}</span><h2 id={titleId}>{won ? "Victoire !" : "Défaite"}</h2></div>
      <strong className={styles.score} aria-label={`${playerScore} manches gagnées, ${opponentScore} perdues`}>{playerScore}<span>–</span>{opponentScore}</strong>
    </div>
    <p className={styles.matchup}>{subtitle}</p>
    <dl className={styles.gains} aria-label="Gains de ce combat">
      <div><dt><Sparkles size={15} aria-hidden="true" />EXP d’Arène</dt><dd>+{experience.toLocaleString("fr-FR")}</dd></div>
      <div><dt><Star size={15} aria-hidden="true" />Points de défis</dt><dd>+{challengePoints.toLocaleString("fr-FR")}</dd></div>
      <div data-reward={cardCount > 0 || undefined}><dt><Gift size={15} aria-hidden="true" />Cartes gagnées</dt><dd>{cardCount}</dd></div>
    </dl>
    {cardCount > 0 && <p className={styles.reward}>{rewardCard ? rewardCard.name : `Booster Botte du Chanvrier · ${cardCount} cartes`}</p>}
    {continuation ? <div className={styles.continuation} data-verdict-continuation>{continuation}</div> : null}
    {takeaway && <section className={styles.takeaway} data-verdict-takeaway={takeaway.kind} aria-label="Repère pour la prochaine culture">
      <h3>{takeaway.title}</h3><p>{takeaway.explanation}</p>
    </section>}
    {rank && <dl className={styles.rank} aria-label="Classement après ce duel">
      <div><dt>Cote</dt><dd>{rank.rating.toLocaleString("fr-FR")}</dd></div>
      <div><dt>Points saison</dt><dd>{rank.seasonPoints.toLocaleString("fr-FR")}</dd></div>
      <div><dt>Victoires / défaites</dt><dd>{rank.wins} / {rank.losses}</dd></div>
    </dl>}
    <details className={styles.details} data-verdict-analysis>
      <summary><span>Manches et analyse du jury</span><ChevronDown size={18} aria-hidden="true" /></summary>
      <div className={styles.analysis}>
        <div className={styles.rounds} aria-label="Scores des manches">
          <div className={styles.roundLabels}><span>Manche</span><span>Toi</span><span>Adverse</span></div>
          {rounds.map(round => <div key={round.code} data-won={round.winner === "player"}><strong>{round.label}</strong><b>{round.playerScore}</b><b>{round.opponentScore}</b><p>{round.explanation}</p></div>)}
        </div>
        {children}
      </div>
    </details>
    {(rewardCard || challenges.length > 0) && <details className={styles.details} data-verdict-rewards>
      <summary><span>Détail des récompenses</span><ChevronDown size={18} aria-hidden="true" /></summary>
      <div className={styles.rewardDetails}>
        {challenges.length > 0 && <div><h3>Défis réussis</h3><ul>{challenges.map((title, index) => <li key={`${index}-${title}`}>{title}</li>)}</ul><p>{challengePoints > 0 ? `+${challengePoints} points de défis` : "Récompenses de ces défis déjà encaissées."}</p></div>}
        {rewardCard && <div className={styles.card}><Image src={rewardCard.imageUrl} alt={`Carte ${rewardCard.name}`} width={100} height={150} sizes="100px" /><div><h3>{rewardCard.name}</h3><p>Ajoutée à ton inventaire.</p><p>{rewardCard.description}</p></div></div>}
      </div>
    </details>}
    <p className={styles.receipt}>{kind === "training" ? "Ta Fleur a été brûlée." : "Les deux Fleurs ont été brûlées."}<br />{receipt}</p>
  </AppDialog>;
}
