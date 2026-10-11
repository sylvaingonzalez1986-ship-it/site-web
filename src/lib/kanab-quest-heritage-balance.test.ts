import { describe, expect, it } from "vitest";
import {
  activateKqHeritage,
  advanceKqStage,
  canActivateKqHeritage,
  getKqStageTarget,
  previewKqResolution,
  resolveKqStage,
  rollKqDice,
  startKqGame,
  type KqGameState,
} from "@/lib/kanab-quest-game";
import { KQ_HERITAGE_EFFECT_TEMPLATES, getKqHeritageEffectTemplate, type KqHeritageEffect } from "@/lib/kanab-quest-heritage";

function withHeritage(effect: KqHeritageEffect, seed = 42, rulesVersion: 2 | 3 = 3) {
  return startKqGame(seed, {
    rulesVersion,
    heritageCard: { ...getKqHeritageEffectTemplate(effect), code: "HERITAGE-TEST" },
  });
}

const outcomes = { failure: 0, fragile: 1, success: 2, critical: 3 };
const diceTriples = Array.from({ length: 216 }, (_, index) => [
  Math.floor(index / 36) + 1, Math.floor(index / 6) % 6 + 1, index % 6 + 1,
] as [number, number, number]);

describe("Heritage benefits without cultivation penalties", () => {
  it.each(KQ_HERITAGE_EFFECT_TEMPLATES)("guarantees useful starting XP for $effect in both rules versions", (template) => {
    for (const rulesVersion of [2, 3] as const) {
      const baseline = startKqGame(42, { rulesVersion });
      const equipped = withHeritage(template.effect, 42, rulesVersion);
      const bonus = template.effect === "starting-xp-two" ? 4 : 2;
      expect(equipped.xp).toBe(baseline.xp + bonus);
      expect(equipped.pressure).toBe(baseline.pressure);
      expect(equipped.quality).toBe(baseline.quality);
      expect(equipped.care).toEqual(baseline.care);
      expect(equipped.effectNotices).toContain(`${template.name} : +${bonus} XP au départ.`);
      expect(equipped.heritageUsed).toBe(false);
    }
  });

  it.each([
    ["neutral-to-spark", 0],
    ["flower-neutrals-to-success", 3],
    ["drying-lowest-to-spark", 5],
    ["dangers-to-success", 0],
    ["germination-lowest-to-strong", 0],
    ["rooting-pressure-reset", 1],
    ["growth-danger-reroll", 2],
    ["flower-success-to-spark", 3],
    ["flower-lowest-plus-three", 3],
  ] as const)("never worsens dice, protection, pressure or outcome when activating %s", (effect, stageIndex) => {
    const base = withHeritage(effect);
    for (const dice of diceTriples) {
      for (const cancelledDangers of [0, 1, 2]) {
        const state: KqGameState = { ...base, phase: "rolled", stageIndex, dice, cancelledDangers, pressure: 2 };
        const before = previewKqResolution(state)!;
        const activated = activateKqHeritage(state);
        const after = previewKqResolution(activated)!;
        expect(after.total).toBeGreaterThanOrEqual(before.total);
        expect(after.sparks).toBeGreaterThanOrEqual(before.sparks);
        expect(after.dangers).toBeLessThanOrEqual(before.dangers);
        expect(outcomes[after.outcome]).toBeGreaterThanOrEqual(outcomes[before.outcome]);
        expect(activated.pressure).toBeLessThanOrEqual(state.pressure);
        expect(activated.cancelledDangers).toBe(cancelledDangers);
        expect(activated.xp).toBe(state.xp);
        for (let index = 0; index < 3; index += 1) expect(activated.dice![index]).toBeGreaterThanOrEqual(dice[index]);
        if (activated !== state) {
          expect(activated.dice!.some((die, index) => die > dice[index]) || activated.pressure < state.pressure).toBe(true);
          expect(activated.heritageUsed).toBe(true);
          expect(activateKqHeritage(activated)).toBe(activated);
        } else {
          expect(state.heritageUsed).toBe(false);
        }
      }
    }
  });

  it("keeps perfect germination dice and the unused power intact", () => {
    for (const dice of [[6, 6, 6], [5, 6, 5]] as [number, number, number][]) {
      const state: KqGameState = { ...withHeritage("germination-lowest-to-strong"), phase: "rolled", dice };
      expect(canActivateKqHeritage(state).allowed).toBe(false);
      expect(activateKqHeritage(state)).toBe(state);
    }
  });

  it("makes rooting useful at zero pressure without reducing already successful dice", () => {
    const state: KqGameState = { ...withHeritage("rooting-pressure-reset"), stageIndex: 1, phase: "rolled", dice: [2, 5, 6], pressure: 0 };
    expect(activateKqHeritage(state)).toMatchObject({ pressure: 0, dice: [4, 5, 6], heritageUsed: true });
    const perfect: KqGameState = { ...state, dice: [6, 6, 6] };
    expect(activateKqHeritage(perfect)).toBe(perfect);
  });

  it("guarantees a successful growth reroll across different seeds", () => {
    for (let seed = 1; seed <= 216; seed += 1) {
      const state: KqGameState = { ...withHeritage("growth-danger-reroll", seed), stageIndex: 2, phase: "rolled", dice: [1, 4, 6] };
      const activated = activateKqHeritage(state);
      expect(activated.dice![0]).toBeGreaterThanOrEqual(4);
      expect(activated.dice!.slice(1)).toEqual([4, 6]);
      expect(previewKqResolution(activated)?.outcome).toBe("critical");
    }
  });

  it("provides pest XP even without a pest and cannot grant it twice", () => {
    const state = withHeritage("free-pest-mastery");
    const activated = activateKqHeritage({ ...state, situationCodes: ["SIT-007", ...state.situationCodes.slice(1)] });
    expect(activated.revealedPest).toBeNull();
    expect(activated.xp).toBe(state.xp + 2);
    expect(activateKqHeritage(activated)).toBe(activated);
  });

  it.each([
    ["root-danger-to-spark", 1],
    ["climate-danger-to-spark", 5],
    ["first-danger-shield", 0],
  ] as const)("improves automatic %s without consuming it on a perfect roll", (effect, stageIndex) => {
    let improved = 0;
    let perfect = 0;
    for (let seed = 1; seed <= 500; seed += 1) {
      const state = { ...withHeritage(effect, seed), stageIndex };
      const baseline = rollKqDice({ ...state, heritageCode: undefined });
      const rolled = rollKqDice(state);
      const before = previewKqResolution(baseline)!;
      const after = previewKqResolution(rolled)!;
      expect(after.total).toBeGreaterThanOrEqual(before.total);
      expect(after.sparks).toBeGreaterThanOrEqual(before.sparks);
      expect(after.dangers).toBeLessThanOrEqual(before.dangers);
      if (rolled.heritageUsed) improved += 1;
      if (baseline.dice?.every((die) => die === 6)) {
        perfect += 1;
        expect(rolled.heritageUsed).toBe(false);
        expect(rolled.dice).toEqual(baseline.dice);
      }
    }
    expect(improved).toBeGreaterThan(0);
    expect(perfect).toBeGreaterThan(0);
  });

  it("keeps the best three of five at least as good as the same ordinary roll", () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const state = withHeritage("five-keep-three", seed);
      const ordinary = rollKqDice(state).dice!.toSorted((a, b) => b - a);
      const improved = rollKqDice(activateKqHeritage(state)).dice!;
      expect(improved.every((die, index) => die >= ordinary[index])).toBe(true);
    }
  });

  it("rescues complete drying failure without changing already successful outcomes", () => {
    const state: KqGameState = { ...withHeritage("drying-fragile-to-success"), stageIndex: 5, phase: "rolled", dice: [1, 2, 3] };
    expect(resolveKqStage(state)).toMatchObject({ lastOutcome: "success", quality: 2, heritageUsed: true });
    expect(resolveKqStage({ ...state, dice: [4, 5, 6] })).toMatchObject({ lastOutcome: "critical", heritageUsed: false });
  });

  it("turns recovery into actual vitality, aroma and harvest benefits in current cultivation rules", () => {
    const base = withHeritage("failure-to-fragile");
    const state: KqGameState = {
      ...base, phase: "rolled", stageIndex: 3, dice: [1, 2, 3],
      situationCodes: base.situationCodes.map((code, index) => index === 3 ? "SIT-004" : code),
      care: { ...base.care!, vitality: 55, terpenes: 60 },
    };
    const ordinary = resolveKqStage({ ...state, heritageCode: undefined });
    const recovered = resolveKqStage(state);
    expect(recovered.lastOutcome).toBe("success");
    expect(recovered.care!.vitality).toBeGreaterThan(ordinary.care!.vitality);
    expect(recovered.care!.terpenes).toBeGreaterThan(ordinary.care!.terpenes);
    expect(recovered.care!.yieldLossPercent).toBeLessThan(ordinary.care!.yieldLossPercent);
    expect(recovered.xp).toBeGreaterThan(ordinary.xp);
    expect(recovered.quality).toBeGreaterThan(ordinary.quality);
  });

  it("rewards ordinary success as well as critical success and keeps granting XP later", () => {
    const state: KqGameState = { ...withHeritage("first-success-xp-two"), phase: "rolled", dice: [4, 5, 6] };
    const first = resolveKqStage(state);
    expect(first.history.at(-1)?.xpGain).toBe(7);
    const second = resolveKqStage({ ...advanceKqStage(first), phase: "rolled", dice: [4, 5, 6] });
    expect(second.history.at(-1)?.xpGain).toBe(5);
    const jury: KqGameState = { ...withHeritage("critical-quality-boost"), situationCodes: ["SIT-007", ...state.situationCodes.slice(1)], phase: "rolled", dice: [4, 5, 2] };
    expect(resolveKqStage(jury).quality).toBe(3);
    const fragile: KqGameState = { ...withHeritage("fragile-quality-boost"), phase: "rolled", dice: [1, 2, 3] };
    expect(resolveKqStage(fragile).quality).toBe(0);
  });

  it("grants harvest quality even without a theft incident", () => {
    const state: KqGameState = { ...withHeritage("harvest-theft-shield"), stageIndex: 4, phase: "rolled", dice: [4, 5, 6] };
    const ordinary = resolveKqStage({ ...state, heritageCode: undefined });
    expect(resolveKqStage(state).quality).toBe(ordinary.quality + 1);
  });

  it("keeps Culture originelle effective at pressure 0, 1 and 2 without changing higher pressure", () => {
    const base = withHeritage("calm-target-relief");
    for (let pressure = 0; pressure <= 4; pressure += 1) {
      const state = { ...base, pressure, situationCodes: ["SIT-007", ...base.situationCodes.slice(1)] };
      const ordinaryTarget = getKqStageTarget({ ...state, heritageCode: undefined });
      expect(getKqStageTarget(state)).toBe(pressure <= 2 ? Math.max(1, ordinaryTarget - 1) : ordinaryTarget);
    }
  });
});
