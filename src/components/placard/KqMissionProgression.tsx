"use client";

import { Check, Gift, LockKeyhole } from "lucide-react";
import { getKqMissionRewardLabel } from "@/lib/kanab-quest-missions";
import type { KqLevelReward, KqMissionProgression as Progression } from "@/lib/kanab-quest-mission-progression";
import { KqProgressMeter } from "./KqVisuals";
import { KqMissionRewardArtwork } from "./KqMissionRewardArtwork";
import { KqPrintedArt } from "./KqPrintedArt";
import styles from "./KqMissionProgression.module.css";

export function KqMissionProgression({ progression, disabled, stale, busy, onClaim, onOpenPack }: {
  progression: Progression; disabled: boolean; stale: boolean; busy: string | null;
  onClaim: (reward: KqLevelReward) => void;
  onOpenPack: (reward: KqLevelReward) => void;
}) {
  const rewards = [...progression.rewards].sort((a, b) => a.level - b.level);
  const pending = rewards.find(reward => !reward.claimed && reward.claimable && reward.rewardAvailable)
    ?? rewards.find(reward => !reward.claimed);
  const renderReward = (reward: KqLevelReward) => <article key={reward.code} data-level-reward={reward.level}
    data-ready={reward.claimable && !reward.claimed || undefined} className={styles.reward}>
    <KqMissionRewardArtwork reward={reward.reward} large />
    <div><h3>Niveau {reward.level}</h3><strong>{getKqMissionRewardLabel(reward.reward)}</strong>
      <small>{reward.requiredXp.toLocaleString("fr-FR")} XP au total</small>
      {reward.claimed ? <span className={styles.status}><Check size={16} aria-hidden="true" />Récompense reçue</span>
        : !reward.claimable ? <span className={styles.status}><LockKeyhole size={16} aria-hidden="true" />{Math.max(0, reward.requiredXp - progression.totalXp).toLocaleString("fr-FR")} XP restantes</span>
        : !reward.rewardAvailable ? <span className={styles.status}>Débloquée · récompense temporairement indisponible</span> : null}
    </div>
    {reward.claimed && reward.packAvailable && reward.entitlementId ? <button type="button" disabled={disabled}
      data-level-pack={reward.code} onClick={() => onOpenPack(reward)}>Ouvrir mon pack</button>
      : reward.claimable && !reward.claimed ? <button type="button" disabled={disabled || !reward.rewardAvailable}
        data-level-claim={reward.code} onClick={() => onClaim(reward)}><Gift size={17} aria-hidden="true" />
        {busy === reward.code ? "Récupération…" : "Récupérer"}</button> : null}
  </article>;
  return <section className={styles.progression} aria-label="Ton niveau de défis" data-mission-progression>
    <div className={styles.hero}>
      <div className={styles.level}><span>Niveau</span><strong>{progression.level}</strong><small>sur 20</small></div>
      <div className={styles.experience}><h2>Ton expérience</h2>
        {progression.nextLevelXp === null ? <p className={styles.maximum}>Niveau maximum atteint</p> : <KqProgressMeter
          label={`Vers le niveau ${progression.level + 1}`} value={progression.levelXp} max={progression.nextLevelXp}
          valueLabel={`${progression.levelXp.toLocaleString("fr-FR")} / ${progression.nextLevelXp.toLocaleString("fr-FR")} XP`} tone="gold" />}
        <p><strong>{progression.totalXp.toLocaleString("fr-FR")} XP</strong> gagnées · progression permanente{stale ? " · Dernier état connu" : ""}</p>
        <small>L’XP est reçue avec les récompenses des défis.</small>
      </div>
      <KqPrintedArt kind="mission-levels" className={styles.scene} sizes="(max-width: 650px) 210px, 240px" />
    </div>
    {pending ? <div className={styles.next}><h2>{pending.claimable ? "Ta récompense de niveau" : "Prochain palier"}</h2>{renderReward(pending)}</div>
      : <p>Toutes les récompenses de niveau sont récupérées.</p>}
    <details className={styles.ladder}><summary>Les récompenses des 20 niveaux · {rewards.filter(reward => reward.claimed).length} / {rewards.length} reçues</summary>
      <p>Chaque palier garantit la récompense affichée. L’argent gagné rejoint la caisse du jeu.</p>
      <div className={styles.rewards}>{rewards.map(renderReward)}</div>
    </details>
  </section>;
}
