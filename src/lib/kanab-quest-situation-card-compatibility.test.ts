import { describe, expect, it } from "vitest";
import { buildKqScenarioPath, canPlayKqCard, KQ_CARDS, KQ_SITUATIONS, KQ_STAGES, playKqCard, rollKqDice, startKqGame } from "./kanab-quest-game";

function ready(situationCode: string, cardCode: string) {
  const situation = KQ_SITUATIONS.find(item => item.code === situationCode)!;
  const stageIndex = KQ_STAGES.indexOf(situation.stage);
  const initial = startKqGame(42, { deckCodes: [cardCode] });
  return { ...initial, stageIndex, xp: 10, handCodes: [cardCode], situationCodes: initial.situationCodes.map((code, index) => index === stageIndex ? situationCode : code) };
}

describe("situation-specific card compatibility", () => {
  it("reserves the guaranteed paperwork success for the DDTM inspection", () => {
    const card = KQ_CARDS.find(item => item.code === "BOTTE-027")!;
    const labels = ready("SIT-048", card.code);
    expect(canPlayKqCard(labels, card).allowed).toBe(false);
    expect(playKqCard(labels, card.code)).toBe(labels);
    const inspection = ready("SIT-024", card.code);
    expect(canPlayKqCard(inspection, card).allowed).toBe(true);
    expect(rollKqDice(playKqCard(inspection, card.code)).dice).toEqual([4, 4, 4]);
    const sorting = KQ_CARDS.find(item => item.code === "BOTTE-035")!;
    expect(canPlayKqCard({ ...ready("SIT-048", sorting.code), phase: "rolled", dice: [1, 2, 4] }, sorting).allowed).toBe(true);
  });

  it("does not prescribe shade to a seedling that lacks light", () => {
    const card = KQ_CARDS.find(item => item.code === "BOTTE-013")!;
    const dim = ready("SIT-039", card.code);
    expect(canPlayKqCard(dim, card).allowed).toBe(false);
    expect(playKqCard(dim, card.code)).toBe(dim);
    expect(canPlayKqCard(ready("SIT-031", card.code), card).allowed).toBe(true);
  });

  it.each(["BOTTE-015", "BOTTE-029"])("does not solve unwanted pollen with %s", cardCode => {
    const card = KQ_CARDS.find(item => item.code === cardCode)!;
    const pollen = ready("SIT-046", card.code);
    expect(canPlayKqCard(pollen, card).allowed).toBe(false);
    expect(playKqCard(pollen, card.code)).toBe(pollen);
    expect(canPlayKqCard(ready("SIT-010", card.code), card).allowed).toBe(true);
  });

  it("retains general observation and luck options for the newly restricted situations", () => {
    const luck = KQ_CARDS.find(item => item.code === "BOTTE-017")!;
    for (const situation of ["SIT-039", "SIT-046", "SIT-048"]) {
      expect(canPlayKqCard(ready(situation, luck.code), luck).allowed).toBe(true);
    }
  });
});

describe("mission constraints and independent domicile theft", () => {
  it("keeps the theft decision even when compliance could move to the harvest stage", () => {
    const harvest = KQ_STAGES.indexOf("Récolte");
    const history = KQ_SITUATIONS.map(situation => situation.code);
    for (let seed = 0; seed < 1000; seed++) for (const domicile of ["home", "external"] as const) {
      const ordinary = buildKqScenarioPath(seed, history, [], [], domicile);
      const mission = buildKqScenarioPath(seed, history, ["energy", "pest", "compliance"], ["mites"], domicile);
      expect(mission[harvest] === "SIT-027").toBe(ordinary[harvest] === "SIT-027");
      const situations = mission.map(code => KQ_SITUATIONS.find(situation => situation.code === code)!);
      for (const tag of ["energy", "pest", "compliance"] as const) expect(situations.some(situation => situation.tags.includes(tag))).toBe(true);
      expect(situations.some(situation => situation.pest === "mites")).toBe(true);
    }
  });

  it("allows an explicit security mission to require the theft event", () => {
    const harvest = KQ_STAGES.indexOf("Récolte");
    for (let seed = 0; seed < 40; seed++) {
      expect(buildKqScenarioPath(seed, [], ["security"], [], "external")[harvest]).toBe("SIT-027");
    }
  });
});