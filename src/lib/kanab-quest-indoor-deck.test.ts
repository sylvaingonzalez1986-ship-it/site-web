import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { KQ_CARDS, KQ_SITUATIONS, KQ_STAGES, buildKqScenarioPath, canPlayKqCard, playKqCard, previewKqResolution, rollKqDice, startKqGame, type KqGameState } from "@/lib/kanab-quest-game";
import { getKqCardGuide } from "@/lib/kanab-quest-card-guide";
import { getKqCardArtwork } from "@/lib/kanab-quest-artwork";

function stateFor(code: string, situationCode: string, dice: [number, number, number], seed = 42): KqGameState {
  const situation = KQ_SITUATIONS.find((item) => item.code === situationCode)!;
  const stageIndex = KQ_STAGES.indexOf(situation.stage);
  const base = startKqGame(seed, { deckCodes: [code], collectionCodes: [code], startingXp: 9 });
  return { ...base, stageIndex, situationCodes: base.situationCodes.map((item, i) => i === stageIndex ? situationCode : item), handCodes: [code], phase: "rolled", dice, revealedPest: situation.pest ?? null };
}

describe("Le Placard : deck indoor", () => {
  it("replaces soil accessories without removing collectible codes or changing rarity", () => {
    expect(KQ_CARDS).toHaveLength(32);
    const expected = { "BOTTE-013": "common", "BOTTE-018": "uncommon", "BOTTE-019": "common", "BOTTE-020": "uncommon", "BOTTE-021": "rare", "BOTTE-024": "common" };
    for (const [code, rarity] of Object.entries(expected)) {
      expect(KQ_CARDS.find((card) => card.code === code)?.rarity).toBe(rarity);
      const state = startKqGame(12, { deckCodes: [code, code], collectionCodes: [code, code] });
      expect(state.deckCodes).toEqual([code, code]);
    }
    expect(KQ_CARDS.map((card) => `${card.name} ${card.description}`).join(" ")).not.toMatch(/perlite|biochar|terreau|engrais|tensiomètre|pot en tissu|pH–EC/i);
  });

  it("gives every card a distinct effect, clear scope, timing and actual limit", () => {
    expect(new Set(KQ_CARDS.map((card) => card.effect)).size).toBe(KQ_CARDS.length);
    KQ_CARDS.forEach((card) => {
      const guide = getKqCardGuide(card);
      expect(guide.benefit).toBe(card.description);
      expect(guide.scope).not.toContain("undefined");
      expect(guide.timing).toMatch(/Avant|Après/);
      expect(guide.risk.length).toBeGreaterThan(20);
    });
  });

  it("keeps every card playable on at least one incident and die combination", () => {
    for (const card of KQ_CARDS) {
      const usable = KQ_SITUATIONS.some((situation) => [[1, 2, 3], [2, 4, 5], [1, 1, 4]].some((dice) => {
        const state = stateFor(card.code, situation.code, dice as [number, number, number]);
        if (card.timing === "before-roll") state.phase = "prepare";
        return canPlayKqCard(state, card).allowed;
      }));
      expect(usable, card.code).toBe(true);
    }
  });

  it("corrects only one timer die, prioritizes a Danger and refuses unrelated incidents", () => {
    expect(playKqCard(stateFor("BOTTE-019", "SIT-033", [1, 2, 5]), "BOTTE-019").dice).toEqual([2, 2, 5]);
    expect(playKqCard(stateFor("BOTTE-019", "SIT-033", [2, 3, 5]), "BOTTE-019").dice).toEqual([4, 3, 5]);
    const card = KQ_CARDS.find((item) => item.code === "BOTTE-019")!;
    expect(canPlayKqCard(stateFor(card.code, "SIT-001", [1, 2, 3]), card).allowed).toBe(false);
    expect(canPlayKqCard(stateFor(card.code, "SIT-033", [3, 4, 5]), card).allowed).toBe(false);
  });

  it("makes cleaning conditional: one Danger corrected, pressure relief only when triggered", () => {
    for (let seed = 0; seed < 150; seed++) {
      const state = { ...stateFor("BOTTE-020", "SIT-036", [1, 2, 3], seed), phase: "prepare" as const, pressure: 2 };
      const baseline = rollKqDice(state);
      const cleaned = rollKqDice(playKqCard(state, "BOTTE-020"));
      const triggered = baseline.dice!.includes(1);
      expect(cleaned.pressure).toBe(triggered ? 1 : 2);
      expect(cleaned.dice!.filter((die) => die === 1).length).toBe(baseline.dice!.filter((die) => die === 1).length - Number(triggered));
      expect(cleaned.xp).toBe(state.xp - 2);
    }
  });

  it("allows cross diagnosis only to finish two successes, for all 216 possible rolls", () => {
    const card = KQ_CARDS.find((item) => item.code === "BOTTE-021")!;
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let c = 1; c <= 6; c++) {
      const state = stateFor(card.code, "SIT-036", [a, b, c]);
      const eligible = state.dice!.filter((die) => die >= 4).length === 2 && state.dice!.some((die) => die === 2 || die === 3);
      expect(canPlayKqCard(state, card).allowed).toBe(eligible);
      if (eligible) {
        const next = playKqCard(state, card.code);
        expect(previewKqResolution(next)?.outcome).toBe("critical");
        expect(next.xp).toBe(state.xp - 2);
        expect(next.usedCards).toEqual([card.code]);
      }
    }
  });

  it("keeps the water rescue tradeoff capable of increasing the required successes", () => {
    const state = { ...stateFor("BOTTE-024", "SIT-016", [1, 4, 2]), pressure: 2 };
    const next = playKqCard(state, "BOTTE-024");
    expect(next.dice).toEqual([4, 4, 2]);
    expect(next.pressure).toBe(3);
    expect(previewKqResolution(next)?.outcome).toBe("fragile");
  });

  it("specializes Swirskii on thrips while preserving Persimilis for mites", () => {
    const card = KQ_CARDS.find((item) => item.code === "BOTTE-011")!;
    expect(card.xpCost).toBe(1);
    expect(canPlayKqCard(stateFor(card.code, "SIT-013", [2, 3, 5]), card).allowed).toBe(false);
    expect(playKqCard(stateFor(card.code, "SIT-014", [2, 3, 5]), card.code).dice).toEqual([5, 3, 5]);
  });

  it("visits every incident, including seven-item pools, and avoids recent events", () => {
    const counts = new Map<string, number>();
    for (let seed = 0; seed < 3000; seed++) for (const code of buildKqScenarioPath(seed)) counts.set(code, (counts.get(code) ?? 0) + 1);
    for (const situation of KQ_SITUATIONS) {
      const poolSize = KQ_SITUATIONS.filter((item) => item.stage === situation.stage).length;
      const expected = 3000 / poolSize;
      expect(counts.get(situation.code)!, situation.code).toBeGreaterThan(expected * 0.8);
      expect(counts.get(situation.code)!, situation.code).toBeLessThan(expected * 1.2);
    }
    const first = buildKqScenarioPath(13);
    expect(buildKqScenarioPath(13, first).some((code) => first.includes(code))).toBe(false);
    expect(buildKqScenarioPath(13)).toEqual(first);
  });

  it("synchronizes all 32 SQL definitions, images and rules without touching ownership", () => {
    const sql = readFileSync("supabase/migrations/20260913000600_kq_indoor_deck_redesign.sql", "utf8");
    const rows = JSON.parse(sql.split("$deck$")[1]);
    expect(rows).toHaveLength(KQ_CARDS.length);
    for (const card of KQ_CARDS) expect(rows.find((row: { code: string }) => row.code === card.code)).toMatchObject({
      name: card.name, description: card.description, image_url: getKqCardArtwork(card.code), effect: card.effect,
      category: card.category, timing: card.timing, xp_cost: card.xpCost, tags: card.tags, targets: card.targets ?? [],
      advantage: getKqCardGuide(card).benefit, drawback: getKqCardGuide(card).risk,
    });
    expect(sql).not.toMatch(/DELETE FROM|UPDATE public\.lottery_card_instances|SET rarity|SET is_active/i);
  });
});
