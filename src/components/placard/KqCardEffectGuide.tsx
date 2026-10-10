import { Check, Dice5, Shield, Star } from "lucide-react";
import type { CSSProperties } from "react";
import { getKqCardGuide, getKqCardRole, getKqCardRarityLabel, KQ_CARD_ROLES } from "@/lib/kanab-quest-card-guide";
import type { KqSupportCard } from "@/lib/kanab-quest-game";
import styles from "./KanabQuestDicePrototype.module.css";

const ROLE_ICONS = { check: Check, dice: Dice5, shield: Shield, star: Star };

export function KqCardRoleLegend() {
  return <div className={styles.cardRoleLegend} aria-label="Utilité des cartes Botte du Chanvrier">
    {Object.entries(KQ_CARD_ROLES).map(([key, role]) => {
      const Icon = ROLE_ICONS[role.icon];
      return <span key={key} style={{ "--card-role": role.color } as CSSProperties}><Icon size={15} aria-hidden="true" />{role.label}</span>;
    })}
  </div>;
}

export function KqCardEffectGuide({ card }: { card: KqSupportCard }) {
  const guide = getKqCardGuide(card);
  const role = getKqCardRole(card);
  const Icon = ROLE_ICONS[role.icon];
  return <span className={styles.cardEffectGuide} data-card-role={role.key} style={{ "--card-role": role.color } as CSSProperties}>
    <span className={styles.cardRole}><Icon size={16} aria-hidden="true" />{role.label}</span>
    <span className={styles.cardRarity} data-rarity={card.rarity}>{getKqCardRarityLabel(card.rarity)}</span>
    <span className={styles.cardTiming}>{guide.timing} · {card.xpCost} XP</span>
    <span className={styles.cardScope}>{guide.scope}</span>
    {guide.examples.length ? <span className={styles.cardSituations}><b>Situations adaptées</b>{guide.examples.slice(0, 3).join(" · ")}{guide.examples.length > 3 ? ` · ${guide.examples.length - 3} autres incidents` : ""}</span> : null}
    <span className={styles.cardBenefit}><b>Effet</b>{guide.benefit}</span>
    <span className={styles.cardLimit}><b>Limite</b>{guide.risk}</span>
  </span>;
}
