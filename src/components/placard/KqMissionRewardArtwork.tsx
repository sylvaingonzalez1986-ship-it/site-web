import Image from "next/image";
import { Coins, Sparkles } from "lucide-react";
import { getKqCardArtwork } from "@/lib/kanab-quest-artwork";
import { getBuddieArtwork } from "@/lib/buddie-artwork";
import type { KqMissionReward } from "@/lib/kanab-quest-missions";
import { KqPrintedArt } from "./KqPrintedArt";
import styles from "./KqMissionCenter.module.css";

export function KqMissionRewardArtwork({ reward, large = false }: { reward: KqMissionReward; large?: boolean }) {
  if (reward.kind === "cash") return <span className={styles.rewardIcon}><Coins size={large ? 34 : 28} aria-hidden="true" /></span>;
  if (reward.kind === "buddie") {
    const artwork = reward.code ? getBuddieArtwork(reward.code) : "";
    return artwork ? <Image src={artwork} alt="" width={large ? 92 : 64} height={large ? 92 : 64} />
      : <KqPrintedArt kind="collection" />;
  }
  const artwork = reward.kind === "card" ? getKqCardArtwork(reward.code) : "/placard/shop-item-packs-v2.webp";
  return artwork ? <Image src={artwork} alt="" width={large ? 64 : 52} height={reward.kind === "card" ? (large ? 96 : 78) : (large ? 64 : 52)} />
    : <span className={styles.rewardIcon}><Sparkles size={28} aria-hidden="true" /></span>;
}
