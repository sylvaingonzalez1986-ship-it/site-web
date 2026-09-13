import { Bug, Check, Dice5, Search, Shield, Star } from "lucide-react";
import type { CSSProperties } from "react";
import { getKqCardGuide, getKqCardRole, KQ_CARD_ROLES } from "@/lib/kanab-quest-card-guide";
import type { KqSupportCard } from "@/lib/kanab-quest-game";
import styles from "./KanabQuestDicePrototype.module.css";

const ROLE_ICONS = { bug: Bug, check: Check, dice: Dice5, search: Search, shield: Shield, star: Star };

export function KqCardRoleLegend() {
  return <div className={styles.cardRoleLegend} aria-label="Utilité des cartes La Botte">
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
    <span className={styles.cardTiming}>{guide.timing} · {card.xpCost} XP</span>
    <span className={styles.cardScope}>{guide.scope}</span>
    <span className={styles.cardBenefit}><b>Effet</b>{guide.benefit}</span>
    <span className={styles.cardLimit}><b>Limite</b>{guide.risk}</span>
  </span>;
}
