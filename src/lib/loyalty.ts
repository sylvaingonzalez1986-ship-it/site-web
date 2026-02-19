import type { CmsOrder } from "@/types/store";
import type { LoyaltyBadge, LoyaltySummary } from "@/types/loyalty";

const LOYALTY_BADGE_DEFINITIONS: Array<{
  id: LoyaltyBadge["id"];
  label: string;
  description: string;
  minPoints: number;
}> = [
  {
    id: "decouverte",
    label: "Bronze",
    description: "Entree dans le programme fidelite.",
    minPoints: 250,
  },
  {
    id: "explorateur",
    label: "Argent",
    description: "Tu passes au niveau client regulier.",
    minPoints: 500,
  },
  {
    id: "connaisseur",
    label: "Or",
    description: "Un niveau premium bien etabli.",
    minPoints: 1000,
  },
  {
    id: "ambassadeur",
    label: "Platine",
    description: "Tu fais partie des meilleurs clients.",
    minPoints: 1250,
  },
  {
    id: "legende",
    label: "Diamant",
    description: "Le sommet du programme fidelite.",
    minPoints: 1500,
  },
];

function isOrderEligibleForPoints(order: CmsOrder): boolean {
  if (order.status === "cancelled") {
    return false;
  }

  return order.paymentState === "paid" || order.paymentState === "not_configured";
}

function toBadge(points: number, definition: (typeof LOYALTY_BADGE_DEFINITIONS)[number]): LoyaltyBadge {
  return {
    id: definition.id,
    label: definition.label,
    description: definition.description,
    minPoints: definition.minPoints,
    unlocked: points >= definition.minPoints,
  };
}

export function buildLoyaltySummary(orders: CmsOrder[]): LoyaltySummary {
  const eligibleOrders = orders.filter(isOrderEligibleForPoints);
  const totalEligibleSpend = Number(
    eligibleOrders.reduce((acc, order) => acc + order.totalAmount, 0).toFixed(2),
  );

  // Regle metier: 1 euro depense = 1 point.
  const points = Math.floor(totalEligibleSpend);

  const badges = LOYALTY_BADGE_DEFINITIONS.map((definition) => toBadge(points, definition));
  const highestUnlockedBadge = [...badges].reverse().find((badge) => badge.unlocked) ?? null;
  const currentBadge = highestUnlockedBadge ?? badges[0];
  const nextBadge = badges.find((badge) => badge.minPoints > points) ?? null;
  const pointsToNextBadge = nextBadge ? Math.max(nextBadge.minPoints - points, 0) : 0;

  const progressToNextBadge = (() => {
    if (!nextBadge) {
      return 100;
    }

    const progressStart = highestUnlockedBadge?.minPoints ?? 0;
    const span = nextBadge.minPoints - progressStart;
    if (span <= 0) {
      return 100;
    }

    return Math.max(
      0,
      Math.min(100, Math.round(((points - progressStart) / span) * 100)),
    );
  })();

  return {
    points,
    totalEligibleSpend,
    eligibleOrdersCount: eligibleOrders.length,
    currentBadge,
    nextBadge,
    pointsToNextBadge,
    progressToNextBadge,
    badges,
  };
}

export function buildLoyaltySummaryWithBonus(
  orders: CmsOrder[],
  bonusPoints: number,
): LoyaltySummary {
  const base = buildLoyaltySummary(orders);
  const safeBonus = Number.isFinite(bonusPoints) ? Math.round(bonusPoints) : 0;
  const totalPoints = Math.max(0, base.points + safeBonus);

  const badges = LOYALTY_BADGE_DEFINITIONS.map((definition) =>
    toBadge(totalPoints, definition),
  );
  const highestUnlockedBadge = [...badges].reverse().find((badge) => badge.unlocked) ?? null;
  const currentBadge = highestUnlockedBadge ?? badges[0];
  const nextBadge = badges.find((badge) => badge.minPoints > totalPoints) ?? null;
  const pointsToNextBadge = nextBadge ? Math.max(nextBadge.minPoints - totalPoints, 0) : 0;

  const progressToNextBadge = (() => {
    if (!nextBadge) {
      return 100;
    }

    const progressStart = highestUnlockedBadge?.minPoints ?? 0;
    const span = nextBadge.minPoints - progressStart;
    if (span <= 0) {
      return 100;
    }

    return Math.max(
      0,
      Math.min(100, Math.round(((totalPoints - progressStart) / span) * 100)),
    );
  })();

  return {
    ...base,
    points: totalPoints,
    currentBadge,
    nextBadge,
    pointsToNextBadge,
    progressToNextBadge,
    badges,
  };
}

export function buildEmptyLoyaltySummary(): LoyaltySummary {
  return buildLoyaltySummary([]);
}
