import type { KqOfficialFlower } from "./kanab-quest-api";
import { getKqCampaignMemberState } from "./kanab-quest-campaign";
import { applyKqBuddieYield } from "./kanab-quest-buddie-cultivation";
import { getKqHarvestBreakdown, isKqCultureDead, type KqGameState } from "./kanab-quest-game";

type YieldAdjustment = { label: string; grams: number };

export type KqHarvestMomentRow = {
  runId: string | null;
  varietyName: string;
  grams: number | null;
  potentialGrams: number | null;
  adjustments: YieldAdjustment[];
  quality: number | null;
  flowerId: string | null;
};

export type KqHarvestMoment = {
  outcome: "harvest" | "dead" | "empty" | "unknown";
  rows: KqHarvestMomentRow[];
  totalGrams: number | null;
  potentialGrams: number | null;
  qualityRange: { min: number; max: number } | null;
  confirmedFlowers: number;
  harvestCount: number;
};

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const gramsOrUnknown = (value: unknown) => finite(value) && value >= 0 ? value : null;
const roundGrams = (value: number) => Math.round(value * 10) / 10;

function warehouseAdjustments(state: KqGameState, potential: number, grams: number): YieldAdjustment[] {
  if (!state.history.length) return [];
  const breakdown = getKqHarvestBreakdown(state);
  const beforeGenetics = roundGrams(breakdown.grossHarvestGrams - breakdown.lostHarvestGrams);
  if (applyKqBuddieYield(beforeGenetics, state.cultivationProfile) !== grams) return [];
  return [
    { label: "Résultats des étapes et préparations", grams: roundGrams(breakdown.grossHarvestGrams - potential) },
    { label: "Santé et incidents", grams: -breakdown.lostHarvestGrams },
    { label: "Génétique du Buddie", grams: roundGrams(grams - beforeGenetics) },
  ].filter(adjustment => adjustment.grams !== 0);
}

/**
 * A terminal result, never a forecast. Campaign grams come from each member's
 * frozen equipment and common decision journal; quality points are not added.
 * Only an exact run match may confirm that an official Fleur was recorded.
 */
export function getKqHarvestMoment(
  state: KqGameState,
  flowers: readonly KqOfficialFlower[] = [],
  runId?: string | null,
): KqHarvestMoment | null {
  if (state.phase !== "complete") return null;
  const dead = isKqCultureDead(state);
  const row = (own: KqGameState | null, ownRunId: string | null, name: string): KqHarvestMomentRow => {
    const flower = !dead && ownRunId ? flowers.find(item => item.runId === ownRunId) : undefined;
    const grams = dead ? 0 : gramsOrUnknown(own?.harvestGrams);
    const potentialGrams = gramsOrUnknown(own?.warehouse?.estimatedHarvestGrams);
    return {
      runId: ownRunId,
      varietyName: own?.varietyName ?? name,
      grams,
      potentialGrams,
      adjustments: !dead && own && grams !== null && potentialGrams !== null ? warehouseAdjustments(own, potentialGrams, grams) : [],
      quality: dead ? null : finite(flower?.quality) ? flower.quality : finite(own?.quality) ? own.quality : null,
      flowerId: flower?.id ?? null,
    };
  };
  const rows = state.campaign
    ? state.campaign.members.map(member => {
      // A malformed historical member must not become a fabricated zero.
      try {
        return row(getKqCampaignMemberState(state, member), member.runId, member.buddieCode);
      } catch {
        return row(null, member.runId, member.buddieCode);
      }
    })
    : [row(state, runId ?? null, state.varietyName)];
  const totalGrams = rows.length > 0 && rows.every(item => item.grams !== null)
    ? roundGrams(rows.reduce((sum, item) => sum + item.grams!, 0))
    : null;
  const potentialGrams = rows.length > 0 && rows.every(item => item.potentialGrams !== null)
    ? roundGrams(rows.reduce((sum, item) => sum + item.potentialGrams!, 0))
    : null;
  const harvests = rows.filter(item => item.grams !== null && item.grams > 0);
  const qualities = harvests.map(item => item.quality);
  const qualityRange = totalGrams !== null && qualities.length > 0 && qualities.every(finite)
    ? { min: Math.min(...qualities), max: Math.max(...qualities) }
    : null;
  return {
    outcome: dead ? "dead" : harvests.length > 0 ? "harvest" : totalGrams === 0 ? "empty" : "unknown",
    rows,
    totalGrams,
    potentialGrams,
    qualityRange,
    confirmedFlowers: rows.filter(item => item.flowerId !== null).length,
    harvestCount: harvests.length,
  };
}
