import { Check, Dice5, Shield, Star } from "lucide-react";
import type { CSSProperties } from "react";
import { getKqCardGuide, getKqCardRole, getKqCardRarityLabel, KQ_CARD_ROLES } from "@/lib/kanab-quest-card-guide";
import type { KqSupportCard } from "@/lib/kanab-quest-game";
import { KqHelpDashboard, KqHelpGrid } from "./KqHelpDashboard";
import { KqPrintedArt, type KqPrintedArtKind } from "./KqPrintedArt";
import help from "./KqCardEffectGuide.module.css";
import styles from "./KanabQuestDicePrototype.module.css";

const ROLE_ICONS = { check: Check, dice: Dice5, shield: Shield, star: Star };
const ROLE_ART: Record<keyof typeof KQ_CARD_ROLES, KqPrintedArtKind> = { protection: "help-care", dice: "collection", quality: "help-quality", success: "help-culture" };

export function KqCardRoleLegend() {
  return <div className={`${styles.cardRoleLegend} ${help.legend}`} aria-label="Utilité des cartes Botte du Chanvrier">
    {Object.entries(KQ_CARD_ROLES).map(([key, role]) => {
      return <span key={key} style={{ "--card-role": role.color } as CSSProperties}><KqPrintedArt kind={ROLE_ART[key as keyof typeof KQ_CARD_ROLES]} className={help.art} sizes="104px" />{role.label}</span>;
    })}
  </div>;
}

export function KqCardEffectGuide({ card, illustrated = false }: { card: KqSupportCard; illustrated?: boolean }) {
  const guide = getKqCardGuide(card);
  const role = getKqCardRole(card);
  const roleArt = ROLE_ART[role.key as keyof typeof ROLE_ART] ?? "collection";
  const Icon = ROLE_ICONS[role.icon];
  if (illustrated) return <div data-card-role={role.key}><KqHelpDashboard>
    <p>{role.label} · {getKqCardRarityLabel(card.rarity)}</p>
    <KqHelpGrid art={roleArt} items={[
      { label: "À jouer", value: `${guide.timing} · ${card.xpCost} XP`, art: "help-time" },
      { label: "Situations", value: guide.scope, detail: guide.examples.length ? <>{guide.examples.slice(0, 3).join(" · ")}{guide.examples.length > 3 ? ` · ${guide.examples.length - 3} autres incidents` : ""}</> : undefined, art: "help-culture" },
      { label: "Effet", value: guide.benefit, art: roleArt },
      { label: "Limite", value: guide.risk, art: "help-plan" },
    ]} />
  </KqHelpDashboard></div>;
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
