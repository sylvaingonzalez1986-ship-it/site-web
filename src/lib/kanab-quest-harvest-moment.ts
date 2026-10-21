import type { KqOfficialFlower } from "./kanab-quest-api";
import { getKqCampaignMemberState } from "./kanab-quest-campaign";
import { isKqCultureDead, type KqGameState } from "./kanab-quest-game";

export type KqHarvestMomentRow = {
  runId: string | null;
  varietyName: string;
  grams: number | null;
  quality: number | null;
  flowerId: string | null;
};

export type KqHarvestMoment = {
  outcome: "harvest" | "dead" | "empty" | "unknown";
  rows: KqHarvestMomentRow[];
  totalGrams: number | null;
  qualityRange: { min: number; max: number } | null;
  confirmedFlowers: number;
  harvestCount: number;
};

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const gramsOrUnknown = (value: unknown) => finite(value) && value >= 0 ? value : null;

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
    return {
      runId: ownRunId,
      varietyName: own?.varietyName ?? name,
      grams: dead ? 0 : gramsOrUnknown(own?.harvestGrams),
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
    ? Math.round(rows.reduce((sum, item) => sum + item.grams!, 0) * 10) / 10
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
    qualityRange,
    confirmedFlowers: rows.filter(item => item.flowerId !== null).length,
    harvestCount: harvests.length,
  };
}
