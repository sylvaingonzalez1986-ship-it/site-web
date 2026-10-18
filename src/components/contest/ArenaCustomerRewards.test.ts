import { createElement, type AnchorHTMLAttributes } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ARENA_FORMULA_VERSION } from "@/lib/arena-ranking";
import { ArenaCustomerRewardPot, type ArenaCustomerRewardPool } from "./ArenaCustomerRewards";

vi.mock("@/components/navigation/NavigationLink", () => ({ default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => createElement("a", props) }));

const pool: ArenaCustomerRewardPool = {
  seasonCode: "S1", status: "active", rankingFormulaVersion: ARENA_FORMULA_VERSION,
  contributionRateBps: 100, poolGrams: 100, wholePoolGrams: 100, carriedGrams: 0, currentWeekGrams: 10,
  weeklyDice: { startsOn: null, endsOn: null, rollCount: 0, average: null, rateBps: 100, eligibleFlowerGrams: 1000, contributionGrams: 10 },
  startsAt: null, endsAt: null, updatedAt: "2026-10-18T10:00:00Z", minimumHumanBattles: 3,
  minimumTastedFlowers: 1, eligiblePlayers: 2,
  milestone: { previousGrams: 0, nextGrams: 200, progressPercent: 50 },
  topRewards: [], surpriseReward: { shareBps: 1000, estimatedGrams: 10, eligiblePlayers: 1, oneChancePerCustomer: true },
};
const render = (overrides: Partial<ArenaCustomerRewardPool> = {}) => renderToStaticMarkup(createElement(ArenaCustomerRewardPot, {
  rankingId: "ranking", rewardPool: { ...pool, ...overrides }, onRewardPoolChange: () => undefined,
  loading: false, unavailable: false, viewerPseudo: "Camille",
}));

describe("customer reward eligibility and tied prizes", () => {
  it("shows an eligible tasting-only player's reward without requiring duels", () => {
    const html = render({ viewer: { rank: 1, battles: 0, tastedFlowerCount: 1, eligible: true, estimatedGrams: 27, grant: null } });
    expect(html).toContain("estimation 27 g");
    expect(html).toContain("1 fleur(s) dégustée(s) · 0 duel(s) humain(s)");
    expect(html).toContain("1 fleur achetée avec un avis validé ou 3 duels humains minimum");
    expect(html).not.toContain("duels requis terminés");
    expect(html).not.toContain("duel(s) humain(s) pour devenir éligible");
  });

  it("offers both eligibility paths to an unqualified v3 player", () => {
    const html = render({ viewer: { rank: 8, battles: 1, tastedFlowerCount: 0, eligible: false, estimatedGrams: null, grant: null } });
    expect(html).toContain("Fais valider un avis sur une fleur achetée ou termine encore 2 duel(s) humain(s)");
    expect(html).not.toContain("Tu occupes la place récompensée");
  });

  it("opens the surprise draw to eligible tasters outside the Top 10", () => {
    const html = render({ viewer: { rank: 25, battles: 0, tastedFlowerCount: 1, eligible: true, estimatedGrams: null, grant: null } });
    expect(html).toContain("Tu as une chance dans La Fleur Surprise");
  });

  it("explains combined tied slots and each eligible player's actual estimate", () => {
    const html = render({ topRewards: [
      { entryKey: "first", leaderboardRank: 1, rewardRank: 1, pseudo: "Camille", shareBps: 2250, estimatedGrams: 23, tiedPlayers: 2, occupiedThroughRank: 2 },
      { entryKey: "second", leaderboardRank: 1, rewardRank: 1, pseudo: "Lou", shareBps: 2250, estimatedGrams: 22, tiedPlayers: 2, occupiedThroughRank: 2 },
    ] });
    expect(html).toContain("Places #1 à #2 · 2 ex æquo");
    expect(html).toContain("Camille : ≈ 23 g · Lou : ≈ 22 g");
    expect(html).toContain("≈ 45 g");
    expect(html).toContain("elle ne revient pas aux autres");
  });

  it("preserves the three-duel wording and actual grant for historical seasons", () => {
    const legacy = render({ rankingFormulaVersion: undefined, viewer: { rank: 1, battles: 1, estimatedGrams: null, grant: null } });
    expect(legacy).toContain("2 duel(s) officiel(s) à terminer");
    expect(legacy).toContain("1/3 duels requis terminés");
    expect(legacy).not.toContain("1 fleur achetée avec un avis validé");
    const settled = render({ status: "settled", rankingFormulaVersion: undefined, viewer: { rank: 1, battles: 3, estimatedGrams: 27, grant: { grams: 12, kind: "ranking" } } });
    expect(settled).toContain("Tu as remporté 12 g de fleurs");
    expect(settled).not.toContain("estimation 27 g");
  });
});
