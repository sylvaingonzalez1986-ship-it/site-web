import { describe, expect, it } from "vitest";
import { KQ_CARDS, KQ_BUDDIES, KQ_SITUATIONS, startKqGame, rollKqDice, resolveKqStage, advanceKqStage, canPlayKqCard, playKqCard, getKqHandCodes, type KqGameState } from "./kanab-quest-game";
import { KQ_EQUIPMENT_CATALOG, formatKqCash } from "./kanab-quest-equipment";
import { quoteKqMarketRoutes } from "./kanab-quest-market";
import { getKqRouteProgressionReason, selectKqMarketOffer, type KqMarketContext } from "./kanab-quest-market-demand";
import { buildKqRecommendedDeck } from "./kanab-quest-economy";
import { encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";

const equipmentCodes = KQ_EQUIPMENT_CATALOG.map((item) => item.code);
const context: KqMarketContext = { reputation: 0, routeSales: {}, recentSales: {}, marketVolumes: {}, window: 0 };
const quotes = (score = 7, marketContext = context) => quoteKqMarketRoutes({ juryScore: score, harvestGrams: 120, equipmentCodes, marketContext });

describe("Living market and differentiated cards", () => {
  it("keeps distinct support effects and restores XP bonuses by Buddie rarity", () => {
    expect(new Set(KQ_CARDS.map((card) => card.effect)).size).toBe(KQ_CARDS.length);
    expect(new Set(KQ_BUDDIES.map((card) => card.ability)).size).toBe(5);
    for (const card of KQ_BUDDIES) {
      expect(startKqGame(1, { varietyCode: card.code }).xp).toBe(1 + card.advantageLevel);
      expect(card.ability).not.toContain("?");
    }
    for (const card of KQ_CARDS) expect(card.description).not.toContain("?");
  });

  it("does not apply stage talents, including when resuming a version 2 save", () => {
    for (let stageIndex = 0; stageIndex < 6; stageIndex++) {
      const baseline = { ...startKqGame(321, { varietyCode: "HH2026-020" }), stageIndex, xp: 4, pressure: 2 };
      const expected = rollKqDice(baseline);
      for (const buddie of KQ_BUDDIES) {
        const rolled = rollKqDice({ ...baseline, rulesVersion: 2, varietyCode: buddie.code });
        expect(rolled.dice).toEqual(expected.dice);
        expect(rolled.pressure).toBe(expected.pressure);
        expect(rolled.cancelledDangers).toBe(expected.cancelledDangers);
        expect(rolled.xp).toBe(expected.xp);
        const resolved = resolveKqStage(rolled);
        expect(resolved.quality).toBe(resolveKqStage(expected).quality);
        expect(resolved.xp).toBe(resolveKqStage(expected).xp);
      }
    }
  });

  it("uses euros consistently", () => {
    expect(formatKqCash(12345)).toContain("123,45");
    expect(formatKqCash(12345)).toContain("€");
    expect(formatKqCash(35000)).not.toContain("$");
  });

  it("needs reputation AND completed sales to move upmarket", () => {
    expect(getKqRouteProgressionReason("rosin-trial", context)).toBeNull();
    expect(getKqRouteProgressionReason("rosin-signature", { ...context, reputation: 1000 })).not.toBeNull();
    expect(getKqRouteProgressionReason("rosin-signature", { ...context, routeSales: { "rosin-trial": 100 } })).not.toBeNull();
    expect(getKqRouteProgressionReason("rosin-signature", { ...context, reputation: 85, routeSales: { "rosin-trial": 12 } })).toBeNull();
    expect(quotes(10).find((quote) => quote.route === "rosin-signature")?.available).toBe(false);
  });

  it("requires machine levels even for an experienced producer and recommends a varied owned deck", () => {
    const marketContext = { ...context, reputation: 200, routeSales: { "rosin-trial": 12 } };
    const quote = (level: number) => quoteKqMarketRoutes({ juryScore: 9, harvestGrams: 120, equipmentCodes, equipmentLevels: { "PRESS-0600": level }, marketContext }).find((q) => q.route === "rosin-signature")!;
    expect(quote(1).available).toBe(false);
    expect(quote(1).market!.progressionReason).toContain("niveau 1/9");
    expect(quote(9).available).toBe(true);
    const inventory = Object.fromEntries(KQ_CARDS.map((card) => [card.code, 1]));
    const deck = buildKqRecommendedDeck("none", inventory, [], "HH2026-020").support;
    expect(deck).toHaveLength(6);
    expect(new Set(deck).size).toBe(6);
    const cards = deck.map((code) => KQ_CARDS.find((card) => card.code === code)!);
    expect(new Set(cards.flatMap((card) => card.tags)).size).toBeGreaterThanOrEqual(5);
    expect(new Set(cards.map((card) => card.timing)).size).toBe(2);
  });

  it("makes weak or oversupplied flowers harder to sell and offers a discounted exit", () => {
    const saturated = quotes(5.8, { ...context, recentSales: { raw: 8 }, marketVolumes: { raw: 20 }, window: 2 }).find((quote) => quote.route === "raw")!;
    expect(saturated.market!.offers[1].accepted).toBe(false);
    expect(saturated.market!.offers[0].accepted).toBe(true);
    expect(saturated.market!.offers[0].payoutCents).toBeLessThan(saturated.market!.offers[1].payoutCents);
    const popular = quotes(9, { ...context, reputation: 100 }).find((quote) => quote.route === "raw")!;
    expect(popular.market!.offers[2].accepted).toBe(true);
    expect(popular.market!.offers[1].message).toContain("arrachent");
  });

  it("changes actual transformed offers with reputation, quality, and saturation", () => {
    const route = (score: number, c: KqMarketContext) => quotes(score, c).find((quote) => quote.route === "dry-sift")!;
    const unknown = route(8, context);
    const trusted = route(8, { ...context, reputation: 100 });
    expect(trusted.payoutCents).toBeGreaterThan(unknown.payoutCents);
    expect(route(9, context).payoutCents).toBeGreaterThan(route(6.2, context).payoutCents);
    expect(route(8, { ...context, recentSales: { "dry-sift": 5 } }).payoutCents).toBeLessThan(unknown.payoutCents);
    expect(trusted.market!.processingCostCents).toBeGreaterThan(0);
    expect(selectKqMarketOffer(trusted, "premium").payoutCents).toBe(trusted.market!.offers[2].payoutCents);
  });

  it("never traps a player, produces invalid money, or charges an unaccepted offer across a full quality, reputation and trend matrix", () => {
    for (let window = 0; window < 6; window++) for (let score = 0; score <= 10; score += 0.5) for (const reputation of [0, 10, 50, 150]) {
      const offers = quotes(score, { ...context, window, reputation, recentSales: { raw: 10, "dry-sift": 10 } });
      expect(offers.find((q) => q.route === "biomass")?.market?.offers[0].accepted).toBe(true);
      for (const quote of offers) for (const offer of quote.market!.offers) {
        expect(Number.isSafeInteger(offer.payoutCents)).toBe(true);
        expect(offer.payoutCents).toBeGreaterThanOrEqual(0);
        if (!quote.available) expect(offer.accepted).toBe(false);
      }
    }
  });

  it("preserves all 52 Buddies through complete deterministic, playable and saveable runs", () => {
    for (const buddie of KQ_BUDDIES) for (let seed = 1; seed <= 16; seed++) {
      let state = startKqGame(seed, { varietyCode: buddie.code, deckCodes: KQ_CARDS.filter((card) => card.category !== "pbi").map((card) => card.code) });
      for (let stage = 0; stage < 6; stage++) {
        const preparation = getKqHandCodes(state).map((code) => KQ_CARDS.find((card) => card.code === code)!).find((card) => canPlayKqCard(state, card).allowed);
        if (preparation) state = playKqCard(state, preparation.code);
        state = rollKqDice(state);
        const reaction = KQ_CARDS.find((card) => canPlayKqCard(state, card).allowed);
        if (reaction) state = playKqCard(state, reaction.code);
        state = resolveKqStage(state);
        expect(state.xp).toBeGreaterThanOrEqual(0);
        expect(state.pressure).toBeLessThanOrEqual(4);
        expect(parseKqGameSave(encodeKqSave(state))).not.toBeNull();
        state = advanceKqStage(state);
      }
      expect(state.phase).toBe("complete");
      expect(parseKqGameSave(encodeKqSave(state))).not.toBeNull();
    }
  });

  it("makes the water rescue a costly reaction and the mite card a different protection", () => {
    const base = startKqGame(4, { deckCodes: ["BOTTE-024"], varietyCode: "HH2026-020" });
    const water = KQ_SITUATIONS.find((s) => s.tags.includes("water"))!;
    const state: KqGameState = { ...base, phase: "rolled", xp: 4, pressure: 1, dice: [1, 1, 5], situationCodes: [water.code, ...base.situationCodes.slice(1)] };
    const rescued = playKqCard(state, "BOTTE-024");
    expect(rescued.dice).toEqual([4, 1, 5]);
    expect(rescued.pressure).toBe(2);
    expect(rescued.xp).toBe(3);
    const mites = KQ_SITUATIONS.find((s) => s.pest === "mites")!;
    const protectedState = playKqCard({ ...state, revealedPest: "mites", situationCodes: [mites.code, ...state.situationCodes.slice(1)] }, "BOTTE-022");
    expect(protectedState.dice).toEqual([4, 1, 5]);
    expect(protectedState.cancelledDangers).toBe(1);
    expect(protectedState.pressure).toBe(1);
  });
});
