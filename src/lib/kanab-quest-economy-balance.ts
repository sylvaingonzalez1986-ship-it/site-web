import {
  isKqEquipmentSuperseded,
  KQ_EQUIPMENT_CATALOG,
  KQ_STARTING_EQUIPMENT_CODES,
} from "@/lib/kanab-quest-equipment";
import {
  getKqRouteExpertiseBonusReputation,
  KQ_MARKET_ROUTE_CODES,
  KQ_MARKET_ROUTES,
  KQ_ROUTE_EXPERTISE_TIERS,
  quoteKqMarketRoutes,
  type KqMarketQuote,
  type KqMarketRouteCode,
} from "@/lib/kanab-quest-market";

export const KQ_MARKET_ROUTE_MINIMUM_LOADOUTS = {
  biomass: [],
  raw: [],
  "dry-sift": ["SIFT-TRAY"],
  "static-sift": ["SIFT-TRAY", "STATIC-PLASMA"],
  "ice-water-hash": ["WASHER-25L"],
  "rosin-trial": ["PRESS-0600"],
  "rosin-selection": ["PRESS-0600"],
  "rosin-premium": ["PRESS-0600"],
  "rosin-signature": ["PRESS-0600"],
  "hash-signature": ["WASHER-25L", "AUTO-SIEVE", "FREEZE-DRYER"],
} as const satisfies Record<KqMarketRouteCode, readonly string[]>;

export type KqEconomyBalanceStatus =
  | "baseline"
  | "unavailable"
  | "dominated"
  | "too-fast"
  | "balanced"
  | "slow"
  | "excessive";

export type KqEconomyRouteProjection = {
  route: KqMarketRouteCode;
  name: string;
  minimumJuryScore: number;
  available: boolean;
  blockedReason: string | null;
  equipmentCodes: string[];
  equipmentNames: string[];
  acquisitionCostCents: number;
  payoutCents: number;
  reputationGain: number;
  expertiseBonusReputation: number;
  totalReputationGain: number;
  comparisonDeltaCents: number;
  paybackHarvests: number | null;
  targetPaybackMin: number;
  targetPaybackMax: number;
  status: KqEconomyBalanceStatus;
};

export const KQ_PLAYER_PAYBACK_REFERENCE = {
  juryScore: 8.8,
  harvestGrams: 100,
} as const;

export function getKqEquipmentInvestmentProgress(input: {
  investmentCents: number;
  cashCents: number;
}) {
  const targetCents = Math.max(0, Math.round(input.investmentCents));
  const availableCents = Math.min(targetCents, Math.max(0, Math.round(input.cashCents)));
  const remainingCents = Math.max(0, targetCents - availableCents);
  return {
    targetCents,
    availableCents,
    remainingCents,
    affordable: remainingCents === 0,
    progressPercent: targetCents === 0 ? 100 : Math.round(availableCents / targetCents * 100),
  };
}

export function getKqEquipmentSaleFundingProjection(input: {
  investmentCents: number;
  cashBeforeCents: number;
  payoutCents: number;
}) {
  const payoutCents = Math.max(0, Math.round(input.payoutCents));
  const before = getKqEquipmentInvestmentProgress({
    investmentCents: input.investmentCents,
    cashCents: input.cashBeforeCents,
  });
  const after = getKqEquipmentInvestmentProgress({
    investmentCents: input.investmentCents,
    cashCents: Math.max(0, input.cashBeforeCents) + payoutCents,
  });
  return {
    before,
    after,
    contributionCents: Math.max(0, before.remainingCents - after.remainingCents),
    newlyAffordable: !before.affordable && after.affordable,
    comparableSalesRemaining: after.remainingCents === 0
      ? 0
      : payoutCents > 0
        ? Math.ceil(after.remainingCents / payoutCents)
        : null,
  };
}

const roundTenth = (value: number) => Math.round(value * 10) / 10;

function getEquipment(code: string) {
  return KQ_EQUIPMENT_CATALOG.find((equipment) => equipment.code === code) ?? null;
}

function getProjectionStatus(input: {
  route: KqMarketRouteCode;
  available: boolean;
  comparisonDeltaCents: number;
  paybackHarvests: number | null;
}): KqEconomyBalanceStatus {
  const targetPaybackMax = ["static-sift", "rosin-signature", "hash-signature"].includes(input.route) ? 36 : 18;
  if (input.route === "biomass" || input.route === "raw") return "baseline";
  if (!input.available) return "unavailable";
  if (input.comparisonDeltaCents <= 0 || input.paybackHarvests === null) return "dominated";
  if (input.paybackHarvests < 3) return "too-fast";
  if (input.paybackHarvests <= targetPaybackMax) return "balanced";
  if (input.paybackHarvests <= targetPaybackMax * 2.5) return "slow";
  return "excessive";
}

function getQuote(input: {
  route: KqMarketRouteCode;
  juryScore: number;
  harvestGrams: number;
  equipmentCodes: string[];
  equipmentLevels?: Record<string, number>;
}): KqMarketQuote {
  const quote = quoteKqMarketRoutes({
    juryScore: input.juryScore,
    harvestGrams: input.harvestGrams,
    equipmentCodes: input.equipmentCodes,
    equipmentLevels: input.equipmentLevels,
  }).find((option) => option.route === input.route);
  if (!quote) throw new Error(`Voie de marché inconnue : ${input.route}`);
  return quote;
}

export function buildKqEconomyBalanceReport(input: {
  juryScore: number;
  harvestGrams: number;
  routeSaleCount?: number;
}) {
  const juryScore = roundTenth(Math.max(0, Math.min(10, input.juryScore)));
  const harvestGrams = roundTenth(Math.max(0, Math.min(500, input.harvestGrams)));
  const parsedRouteSaleCount = Number(input.routeSaleCount ?? 1);
  const routeSaleCount = Number.isFinite(parsedRouteSaleCount)
    ? Math.max(1, Math.min(100, Math.trunc(parsedRouteSaleCount)))
    : 1;
  const starterCodes = [...KQ_STARTING_EQUIPMENT_CODES];
  const baselineQuotes = quoteKqMarketRoutes({
    juryScore,
    harvestGrams,
    equipmentCodes: starterCodes,
  });
  const rawBaseline = baselineQuotes.find((quote) => quote.route === "raw");
  const biomassBaseline = baselineQuotes.find((quote) => quote.route === "biomass");
  if (!rawBaseline || !biomassBaseline) throw new Error("Les voies de référence du marché sont absentes.");
  const baseline = rawBaseline.available ? rawBaseline : biomassBaseline;

  const projections: KqEconomyRouteProjection[] = KQ_MARKET_ROUTE_CODES.map((route) => {
    const equipmentCodes = [...KQ_MARKET_ROUTE_MINIMUM_LOADOUTS[route]];
    const quote = getQuote({
      route,
      juryScore,
      harvestGrams,
      equipmentCodes: [...starterCodes, ...equipmentCodes],
    });
    const equipment = equipmentCodes
      .map(getEquipment)
      .filter((item): item is NonNullable<typeof item> => item !== null);
    const acquisitionCostCents = equipment.reduce((total, item) => total + item.priceCents, 0);
    const comparisonDeltaCents = quote.payoutCents - baseline.payoutCents;
    const paybackHarvests = acquisitionCostCents > 0 && comparisonDeltaCents > 0
      ? roundTenth(acquisitionCostCents / comparisonDeltaCents)
      : null;
    const targetPaybackMax = ["static-sift", "rosin-signature", "hash-signature"].includes(route) ? 36 : 18;
    const expertiseBonusReputation = getKqRouteExpertiseBonusReputation(route, routeSaleCount, quote.reputationGain);
    return {
      route,
      name: quote.name,
      minimumJuryScore: quote.minimumJuryScore,
      available: quote.available,
      blockedReason: quote.blockedReason,
      equipmentCodes,
      equipmentNames: equipment.map((item) => item.name),
      acquisitionCostCents,
      payoutCents: quote.payoutCents,
      reputationGain: quote.reputationGain,
      expertiseBonusReputation,
      totalReputationGain: quote.reputationGain + expertiseBonusReputation,
      comparisonDeltaCents,
      paybackHarvests,
      targetPaybackMin: 3,
      targetPaybackMax,
      status: getProjectionStatus({
        route,
        available: quote.available,
        comparisonDeltaCents,
        paybackHarvests,
      }),
    };
  });

  const priceAnchors = KQ_EQUIPMENT_CATALOG
    .filter((equipment) => equipment.purchasable)
    .map((equipment) => {
      const gamePriceUsd = equipment.priceCents / 100;
      const referencePriceUsd = equipment.realWorldAnchor.referencePriceCents / 100;
      return {
        code: equipment.code,
        name: equipment.name,
        gamePriceUsd,
        referencePriceUsd,
        seller: equipment.realWorldAnchor.seller,
        sourceUrl: equipment.realWorldAnchor.sourceUrl,
        productLabel: equipment.realWorldAnchor.label,
        priceKind: equipment.realWorldAnchor.priceKind,
        observedPriceCents: equipment.realWorldAnchor.observedPriceCents ?? null,
        checkedAt: equipment.realWorldAnchor.checkedAt,
        deviationPercent: referencePriceUsd > 0
          ? roundTenth((gamePriceUsd - referencePriceUsd) / referencePriceUsd * 100)
          : 0,
      };
    });

  const expertiseMilestones = KQ_ROUTE_EXPERTISE_TIERS.flatMap((tier) => {
    const bonusReputation = getKqRouteExpertiseBonusReputation("dry-sift", tier.minimumSales);
    return bonusReputation > 0 ? [{
      code: tier.code,
      name: tier.name,
      saleCount: tier.minimumSales,
      bonusReputation,
    }] : [];
  });

  return {
    juryScore,
    harvestGrams,
    routeSaleCount,
    baselineRoute: baseline.route,
    baselineName: baseline.name,
    baselinePayoutCents: baseline.payoutCents,
    projections,
    signals: {
      dominated: projections.filter((projection) => projection.status === "dominated").length,
      tooFast: projections.filter((projection) => projection.status === "too-fast").length,
      balanced: projections.filter((projection) => projection.status === "balanced").length,
      slowOrExcessive: projections.filter((projection) => projection.status === "slow" || projection.status === "excessive").length,
    },
    expertise: {
      saleCount: routeSaleCount,
      activeBonusReputation: Math.max(0, ...projections.map((projection) => projection.expertiseBonusReputation)),
      milestones: expertiseMilestones,
    },
    priceAnchors: {
      checkedAt: priceAnchors.map((anchor) => anchor.checkedAt).sort().at(-1) ?? null,
      alignedCount: priceAnchors.filter((anchor) => Math.abs(anchor.deviationPercent) <= 10).length,
      totalCount: priceAnchors.length,
      items: priceAnchors,
    },
  };
}

export function getKqEquipmentPaybackScenarios(
  equipmentCode: string,
  input: { ownedCodes?: string[]; cartCodes?: string[]; levels?: Record<string, number> } = {},
) {
  const report = buildKqEconomyBalanceReport(KQ_PLAYER_PAYBACK_REFERENCE);
  const owned = new Set(input.ownedCodes ?? []);
  const cart = new Set(input.cartCodes ?? []);
  const selectedEquipment = getEquipment(equipmentCode);
  if (
    !selectedEquipment
    || selectedEquipment.unlocks.length === 0
    || isKqEquipmentSuperseded(equipmentCode, input.ownedCodes ?? [])
  ) return [];

  return report.projections
    .filter((projection) => {
      const route = KQ_MARKET_ROUTES.find((item) => item.code === projection.route);
      return route?.requiredUnlocks.some((unlock) => selectedEquipment.unlocks.includes(unlock));
    })
    .flatMap((projection) => {
      const route = KQ_MARKET_ROUTES.find((item) => item.code === projection.route);
      if (!route) return [];
      const canonical = new Set(projection.equipmentCodes);
      const candidates = KQ_EQUIPMENT_CATALOG.filter((equipment) => (
        owned.has(equipment.code)
        || cart.has(equipment.code)
        || equipment.code === equipmentCode
        || canonical.has(equipment.code)
      ));
      const projectedEquipmentCodes = [...new Set(route.requiredUnlocks.flatMap((unlock) => {
        const selected = candidates
          .filter((equipment) => equipment.unlocks.includes(unlock))
          .sort((left, right) => {
            const priority = (code: string) => owned.has(code)
              ? code === equipmentCode ? 0 : 1
              : code === equipmentCode
                ? 0
                : cart.has(code)
                  ? 2
                  : 3;
            return priority(left.code) - priority(right.code)
              || (right.effects.processingPrecision ?? 0) - (left.effects.processingPrecision ?? 0)
              || left.priceCents - right.priceCents
              || left.code.localeCompare(right.code);
          })[0];
        return selected ? [selected.code] : [];
      }))];

      // Une machine déjà remplacée par un modèle supérieur ne doit pas revendiquer
      // la rentabilité de ce modèle dans sa propre fiche.
      if (!projectedEquipmentCodes.includes(equipmentCode)) return [];

      const quote = getQuote({
        equipmentLevels: input.levels,
        route: projection.route,
        juryScore: report.juryScore,
        harvestGrams: report.harvestGrams,
        equipmentCodes: [...new Set([
          ...KQ_STARTING_EQUIPMENT_CODES,
          ...(input.ownedCodes ?? []),
          ...projectedEquipmentCodes,
        ])],
      });
      const remainingEquipmentCodes = projectedEquipmentCodes.filter((code) => !owned.has(code));
      const cartEquipmentCodes = remainingEquipmentCodes.filter((code) => cart.has(code));
      const missingAfterCartCodes = remainingEquipmentCodes.filter((code) => !cart.has(code));
      const cost = (codes: string[]) => codes.reduce(
        (total, code) => total + (getEquipment(code)?.priceCents ?? 0),
        0,
      );
      const remainingInvestmentCents = cost(remainingEquipmentCodes);
      const comparisonDeltaCents = quote.payoutCents - report.baselinePayoutCents;
      const personalizedPaybackHarvests = comparisonDeltaCents > 0
        ? remainingInvestmentCents === 0
          ? 0
          : roundTenth(remainingInvestmentCents / comparisonDeltaCents)
        : null;
      if (!quote.available || personalizedPaybackHarvests === null) return [];

      return [{
        ...projection,
        payoutCents: quote.payoutCents,
        reputationGain: quote.reputationGain,
        comparisonDeltaCents,
        projectedEquipmentCodes,
        projectedEquipmentNames: projectedEquipmentCodes.flatMap((code) => {
          const equipment = getEquipment(code);
          return equipment ? [equipment.name] : [];
        }),
        remainingEquipmentCodes,
        remainingEquipmentNames: remainingEquipmentCodes.flatMap((code) => {
          const equipment = getEquipment(code);
          return equipment ? [equipment.name] : [];
        }),
        remainingInvestmentCents,
        cartEquipmentCodes,
        cartInvestmentCents: cost(cartEquipmentCodes),
        missingAfterCartCodes,
        missingAfterCartNames: missingAfterCartCodes.flatMap((code) => {
          const equipment = getEquipment(code);
          return equipment ? [equipment.name] : [];
        }),
        missingAfterCartCents: cost(missingAfterCartCodes),
        personalizedPaybackHarvests,
      }];
    });
}
