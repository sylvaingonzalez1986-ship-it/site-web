import { Crown, Gem, Leaf, ShieldCheck, Sprout } from "lucide-react";
import type { LoyaltyBadgeId } from "@/types/loyalty";
import { BadgeEmblem, type BadgeTone } from "@/components/badges/BadgeEmblem";

const BADGES = {
  decouverte: { icon: Sprout, tone: "bronze", rank: 1 },
  explorateur: { icon: Leaf, tone: "silver", rank: 2 },
  connaisseur: { icon: ShieldCheck, tone: "gold", rank: 3 },
  ambassadeur: { icon: Crown, tone: "platinum", rank: 4 },
  legende: { icon: Gem, tone: "diamond", rank: 5 },
} satisfies Record<LoyaltyBadgeId, { icon: typeof Sprout; tone: BadgeTone; rank: number }>;

export function LoyaltyBadgeIllustration({ badgeId, unlocked, size = "sm" }: {
  badgeId: LoyaltyBadgeId; unlocked: boolean; size?: "xs" | "sm" | "md";
}) {
  return <BadgeEmblem {...BADGES[badgeId]} unlocked={unlocked} size={size} />;
}
