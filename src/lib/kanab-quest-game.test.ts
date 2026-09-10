import { describe, expect, it } from "vitest";
import { createKqFlower } from "@/lib/kanab-quest-battle";
import {
  activateKqHeritage,
  canActivateKqHeritage,
  advanceKqStage,
  buildKqScenarioPath,
  canPlayKqCard,
  getKqHandCodes,
  getKqEffectNoticeKind,
  getKqHarvestBreakdown,
  getKqHarvestTier,
  getKqStageTarget,
  getKqRunProjection,
  getKqVisibleActionCards,
  getKqCardTradeoff,
  getKqCultureSystemProfile,
  getKqCultureSystemSituationStatus,
  getKqCultureSystemSummary,
  KQ_BUDDIES,
  KQ_CARDS,
  KQ_COLLECTIONS,
  KQ_CULTURE_SYSTEM_PROFILES,
  KQ_SITUATIONS,
  KQ_STAGES,
  playKqCard,
  previewKqResolution,
  redrawKqHand,
  resolveKqStage,
  rollKqDice,
  startKqGame,
  swapKqHeritageHandCard,
  type KqGameState,
} from "@/lib/kanab-quest-game";
import { getKqHeritageEffectTemplate, type KqHeritageEffect } from "@/lib/kanab-quest-heritage";

function startWithHeritageEffect(effect: KqHeritageEffect, seed = 700) {
  const template = getKqHeritageEffectTemplate(effect);
  return startKqGame(seed, {
    heritageCard: {
      code: "HERITAGE-900",
      name: template.name,
      timing: template.timing,
      effect: template.effect,
      description: template.description,
      producerName: "Producteur test",
    },
  });
}

describe("Kanab Quest dice prototype", () => {
  it("distinguishes applied effects from effects that found no valid die", () => {
    expect(getKqEffectNoticeKind("Transformation réussie : le dé neutre devient 4.")).toBe("applied");
    expect(getKqEffectNoticeKind("Transformation prête, mais aucun dé neutre : effet non déclenché.")).toBe("missed");
  });

  it("offers five readable situations at every production stage", () => {
    expect(KQ_SITUATIONS).toHaveLength(30);
    KQ_STAGES.forEach((stage) => {
      expect(KQ_SITUATIONS.filter((situation) => situation.stage === stage)).toHaveLength(5);
    });
  });

  it("makes every authored situation reachable through deterministic paths", () => {
    const reached = new Set(Array.from({ length: 25 }, (_, seed) => buildKqScenarioPath(seed)).flat());
    expect([...KQ_SITUATIONS.map((situation) => situation.code).filter((code) => !reached.has(code))]).toEqual([]);
  });

  it("rolls deterministically from a seed", () => {
    expect(rollKqDice(startKqGame(2026)).dice).toEqual(rollKqDice(startKqGame(2026)).dice);
  });

  it("starts with an active substrate burned from the collection", () => {
    const state = startKqGame(1);
    expect(state.playedThisStage).toContain("BOTTE-001");
    expect(state.usedCards).toContain("BOTTE-001");
  });

  it("keeps duplicate physical copies in the deck and spends them one by one", () => {
    let state = startKqGame(41, { deckCodes: ["BOTTE-001", "BOTTE-017", "BOTTE-017"], startingXp: 5 });
    expect(state.deckCodes.filter((code) => code === "BOTTE-017")).toHaveLength(2);

    state = playKqCard(state, "BOTTE-017");
    expect(state.usedCards.filter((code) => code === "BOTTE-017")).toHaveLength(1);

    state = { ...state, stageIndex: 1, phase: "prepare", preparationPlayed: false, revealedPest: null, playedThisStage: ["BOTTE-001"], handCodes: undefined };
    state = playKqCard(state, "BOTTE-017");
    expect(state.usedCards.filter((code) => code === "BOTTE-017")).toHaveLength(2);
    expect(canPlayKqCard({ ...state, preparationPlayed: false }, KQ_CARDS.find((card) => card.code === "BOTTE-017")!).allowed).toBe(false);
  });

  it("draws a deterministic five-card hand from an unlimited deck", () => {
    const state = startKqGame(77, { deckCodes: ["BOTTE-001", "BOTTE-003", "BOTTE-004", "BOTTE-005", "BOTTE-006", "BOTTE-013", "BOTTE-014", "BOTTE-015", "BOTTE-016", "BOTTE-017", "BOTTE-018", "BOTTE-024"] });
    expect(getKqHandCodes(state)).toHaveLength(5);
    expect(getKqHandCodes(state)).toEqual(getKqHandCodes(state));
    expect(getKqVisibleActionCards(state).map((card) => card.code).sort()).toEqual([...new Set(getKqHandCodes(state))].sort());
  });

  it("keeps the hand fixed after a card is burned and redraws only on the next stage", () => {
    let state = startKqGame(79, { deckCodes: ["BOTTE-001", "BOTTE-003", "BOTTE-004", "BOTTE-005", "BOTTE-006", "BOTTE-017", "BOTTE-018"], startingXp: 9 });
    const hand = getKqHandCodes(state);
    const playable = hand.map((code) => KQ_CARDS.find((card) => card.code === code)!).find((card) => canPlayKqCard(state, card).allowed)!;
    state = playKqCard(state, playable.code);
    expect(getKqHandCodes(state)).toEqual(hand);
    state = { ...state, phase: "resolved" };
    expect(getKqHandCodes(advanceKqStage(state))).not.toEqual(hand);
  });

  it("allows exactly one mulligan before any action in a culture", () => {
    const state = startKqGame(80, { deckCodes: ["BOTTE-001", "BOTTE-003", "BOTTE-004", "BOTTE-005", "BOTTE-006", "BOTTE-017", "BOTTE-018"] });
    const firstHand = getKqHandCodes(state);
    const redrawn = redrawKqHand(state);
    expect(getKqHandCodes(redrawn)).not.toEqual(firstHand);
    expect(redrawn.handRedrawsUsed).toBe(1);
    expect(redrawKqHand(redrawn)).toBe(redrawn);
  });

  it("blocks the mulligan after the dice have been rolled", () => {
    const rolled = rollKqDice(startKqGame(81));
    expect(redrawKqHand(rolled)).toBe(rolled);
  });

  it("returns unplayed cards to the rotation and removes a burned physical copy", () => {
    const base = startKqGame(78, { deckCodes: ["BOTTE-001", "BOTTE-003", "BOTTE-004", "BOTTE-005", "BOTTE-006", "BOTTE-017"] });
    const firstHand = getKqHandCodes(base);
    const burnedCode = firstHand[0];
    const nextStage = { ...base, stageIndex: 1, usedCards: [...base.usedCards, burnedCode], handCodes: undefined };
    expect(getKqHandCodes(nextStage).filter((code) => code === burnedCode)).toHaveLength(
      Math.max(0, base.deckCodes.filter((code) => code === burnedCode).length - 1),
    );
  });

  it("accepts a visible mission XP bonus without lowering card costs", () => {
    expect(startKqGame(1, { varietyCode: "HH2026-020", startingXp: 2 }).xp).toBe(2);
    expect(KQ_CARDS.find((card) => card.code === "BOTTE-022")?.xpCost).toBe(3);
  });

  it("starts from a selected Buddie and album-built deck", () => {
    const state = startKqGame(1, { varietyCode: "HH2026-005", deckCodes: ["BOTTE-001", "BOTTE-003", "BOTTE-006"] });
    expect(state.varietyName).toBe("ACDC");
    expect(state.deckCodes).toEqual(["BOTTE-001", "BOTTE-003", "BOTTE-006"]);
    expect(canPlayKqCard(state, KQ_CARDS.find((card) => card.code === "BOTTE-005")!).reason).toContain("pas dans le deck");
  });

  it("ties every Buddie advantage strictly to its rarity", () => {
    expect(KQ_BUDDIES).toHaveLength(52);
    const expectedAdvantages = { common: 0, silver: 1, gold: 2, epic: 3, legendary: 4 } as const;
    expect(KQ_BUDDIES.every((buddie) => buddie.advantageLevel === expectedAdvantages[buddie.rarity])).toBe(true);
    expect(KQ_BUDDIES.filter((buddie) => buddie.rarity === "common").every((buddie) => buddie.effect === "none")).toBe(true);
  });

  it("adds the visible Buddie advantage to the starting XP", () => {
    expect(startKqGame(1, { varietyCode: "HH2026-020" }).xp).toBe(1);
    expect(startKqGame(1, { varietyCode: "HH2026-010" }).xp).toBe(2);
    expect(startKqGame(1, { varietyCode: "HH2026-005" }).xp).toBe(3);
    expect(startKqGame(1, { varietyCode: "HH2026-002" }).xp).toBe(4);
    expect(startKqGame(1, { varietyCode: "HH2026-001" }).xp).toBe(5);
  });

  it("can complete a deterministic culture with every playable Buddie", () => {
    KQ_BUDDIES.forEach((buddie, index) => {
      let state = startKqGame(100 + index, { varietyCode: buddie.code });
      while (state.phase !== "complete") {
        if (state.phase === "prepare") state = rollKqDice(state);
        if (state.phase === "rolled") state = resolveKqStage(state);
        if (state.phase === "resolved") state = advanceKqStage(state);
      }
      expect(state.varietyCode).toBe(buddie.code);
      expect(state.history).toHaveLength(6);
    });
  });

  it("snapshots installed equipment and converts it into final quality and quantity", () => {
    const complete = (equipmentCodes: string[]) => {
      let game = startKqGame(212, { equipmentCodes });
      while (game.phase !== "complete") {
        if (game.phase === "prepare") game = rollKqDice(game);
        if (game.phase === "rolled") game = resolveKqStage(game);
        if (game.phase === "resolved") game = advanceKqStage(game);
      }
      return game;
    };
    const starter = complete(["TENT-080-STARTER", "LED-150-STARTER", "AIR-STARTER"]);
    const upgraded = complete(["TENT-120", "LED-300", "AIR-EC6"]);
    expect(upgraded.equipment?.codes).toEqual(["TENT-120", "LED-300", "AIR-EC6"]);
    expect(upgraded.equipment?.quantityPercent).toBe(70);
    expect(upgraded.quality).toBeGreaterThanOrEqual(starter.quality);
    expect(upgraded.harvestGrams).toBeGreaterThan(starter.harvestGrams ?? 0);
    expect(upgraded.effectNotices?.at(-1)).toContain("récolte estimée");
    expect(createKqFlower(upgraded).stats.regularity).toBeGreaterThan(createKqFlower(starter).stats.regularity);
  });

  it("projects the current harvest with the same quality and quantity formula as the final result", () => {
    const base = startKqGame(214, { equipmentCodes: ["TENT-120", "LED-300", "AIR-EC6"] });
    const state: KqGameState = {
      ...base,
      quality: 9,
      harvestLossPercent: 15,
      history: [
        { stage: "Germination", situation: "Test 1", dice: [4, 4, 4], total: 3, target: 2, outcome: "success", trait: "Stable" },
        { stage: "Enracinement", situation: "Test 2", dice: [6, 6, 6], total: 6, target: 2, outcome: "critical", trait: "Vigoureuse" },
        { stage: "Croissance", situation: "Test 3", dice: [4, 5, 6], total: 4, target: 3, outcome: "success", trait: "Dense" },
      ],
    };
    const projection = getKqRunProjection(state);

    expect(projection.successfulStages).toBe(3);
    expect(projection.remainingStages).toBe(3);
    expect(projection.equipmentQualityBonus).toBeGreaterThan(0);
    expect(projection.projectedQuality).toBe(state.quality + projection.equipmentQualityBonus);
    expect(projection.tier).toBe(getKqHarvestTier(projection.projectedQuality));
    expect(projection.harvestLossPercent).toBe(15);

    const final = advanceKqStage({ ...state, stageIndex: KQ_STAGES.length - 1, phase: "resolved" });
    expect(final.quality).toBe(projection.projectedQuality);
    expect(final.harvestGrams).toBe(projection.harvestGrams);
  });

  it("records an explicit reward receipt for every resolved stage", () => {
    const rolled: KqGameState = {
      ...startKqGame(216),
      phase: "rolled",
      dice: [4, 4, 5],
    };
    const resolved = resolveKqStage(rolled);
    const receipt = resolved.history.at(-1);

    expect(receipt?.qualityDelta).toBe(resolved.quality - rolled.quality);
    expect(receipt?.xpGain).toBe(resolved.xp - rolled.xp);
    expect(receipt?.harvestLossPercent).toBe((resolved.harvestLossPercent ?? 0) - (rolled.harvestLossPercent ?? 0));
  });

  it("shows the exact distance to every harvest tier", () => {
    const base = startKqGame(215);
    expect(getKqRunProjection(base)).toMatchObject({ tier: "Récolte artisanale", nextTier: "Belle pousse", qualityToNextTier: 6 });
    expect(getKqRunProjection({ ...base, quality: 6 })).toMatchObject({ tier: "Belle pousse", nextTier: "Qualité concours", qualityToNextTier: 4 });
    expect(getKqRunProjection({ ...base, quality: 10 })).toMatchObject({ tier: "Qualité concours", nextTier: "Fleur légendaire", qualityToNextTier: 4 });
    expect(getKqRunProjection({ ...base, quality: 14 })).toMatchObject({ tier: "Fleur légendaire", nextTier: null, qualityToNextTier: 0 });
  });

  it("explains the final quality and harvest as two exact equations", () => {
    let state = startKqGame(217, { equipmentCodes: ["TENT-120", "LED-300", "AIR-EC6"] });
    while (state.phase !== "complete") {
      if (state.phase === "prepare") state = rollKqDice(state);
      if (state.phase === "rolled") state = resolveKqStage(state);
      if (state.phase === "resolved") {
        if (state.stageIndex === KQ_STAGES.length - 1) state = { ...state, harvestLossPercent: 20 };
        state = advanceKqStage(state);
      }
    }
    const breakdown = getKqHarvestBreakdown(state);

    expect(breakdown.stageQuality + breakdown.equipmentQualityBonus).toBe(breakdown.finalQuality);
    expect(breakdown.finalQuality).toBe(state.quality);
    expect(breakdown.finalHarvestGrams).toBe(state.harvestGrams);
    expect(breakdown.finalHarvestGrams).toBe(Math.round(breakdown.grossHarvestGrams * 0.8 * 10) / 10);
    expect(breakdown.lostHarvestGrams).toBe(Math.round((breakdown.grossHarvestGrams - breakdown.finalHarvestGrams) * 10) / 10);
  });

  it("makes an oversized tent create visible starting pressure", () => {
    const state = startKqGame(213, { equipmentCodes: ["TENT-150", "LED-500"] });
    expect(state.pressure).toBe(2);
    expect(state.effectNotices?.some((notice) => notice.includes("Pression au départ"))).toBe(true);
  });

  it("gives each new incident response its own mechanic", () => {
    const effects = ["BOTTE-027", "BOTTE-028", "BOTTE-031", "BOTTE-034"]
      .map((code) => KQ_CARDS.find((card) => card.code === code)?.effect);
    expect(new Set(effects).size).toBe(4);
    expect(effects).toEqual(["compliance-clearance", "illegal-power", "bill-relief", "theft-guard"]);
  });

  it("does not ship two support cards with the same mechanical signature", () => {
    const signatures = KQ_CARDS.reduce<Map<string, string[]>>((groups, card) => {
      const signature = [
        card.effect,
        card.timing,
        card.xpCost,
        [...card.tags].sort().join(","),
        [...(card.targets ?? [])].sort().join(","),
      ].join("|");
      groups.set(signature, [...(groups.get(signature) ?? []), card.code]);
      return groups;
    }, new Map());
    const duplicates = [...signatures.entries()].filter(([, codes]) => codes.length > 1);
    expect(duplicates).toEqual([]);
  });

  it("does not let a same-rarity card strictly dominate another card", () => {
    const dominated = KQ_CARDS.flatMap((card) => KQ_CARDS.filter((candidate) => (
      candidate.code !== card.code
      && candidate.category === card.category
      && candidate.rarity === card.rarity
      && candidate.timing === card.timing
      && candidate.effect === card.effect
      && candidate.xpCost <= card.xpCost
      && card.tags.every((tag) => candidate.tags.includes(tag))
      && (card.targets ?? []).every((target) => candidate.targets?.includes(target))
      && (candidate.tags.length > card.tags.length || (candidate.targets?.length ?? 0) > (card.targets?.length ?? 0))
    )).map((candidate) => `${candidate.code}>${card.code}`));
    expect(dominated).toEqual([]);
  });

  it("gives the starter soil a conditional safety floor instead of a wider reroll", () => {
    let stabilized: KqGameState | null = null;
    for (let seed = 1; seed <= 500 && !stabilized; seed += 1) {
      const base = startKqGame(seed, { deckCodes: ["BOTTE-001"] });
      const rolled = rollKqDice({
        ...base,
        situationCodes: base.situationCodes.map((code, index) => index === 0 ? "SIT-001" : code),
      });
      if (rolled.effectNotices?.some((notice) => notice.includes("aucune réussite"))) stabilized = rolled;
    }
    expect(stabilized).not.toBeNull();
    expect(stabilized?.dice?.filter((die) => die >= 4)).toHaveLength(1);
  });

  it("never lets hydroponic control lower its neutral face", () => {
    const comparisons: Array<[number, number]> = [];
    for (let seed = 1; seed <= 120; seed += 1) {
      const base = startKqGame(seed, { deckCodes: ["BOTTE-007"] });
      const rolled = rollKqDice({
        ...base,
        situationCodes: base.situationCodes.map((code, index) => index === 0 ? "SIT-001" : code),
      });
      for (const notice of rolled.effectNotices ?? []) {
        const kept = notice.match(/relance (\d), la face neutre (\d) est conservée/);
        const improved = notice.match(/face neutre (\d) s’améliore en (\d)/);
        if (kept) comparisons.push([Number(kept[2]), Number(kept[2])]);
        if (improved) comparisons.push([Number(improved[1]), Number(improved[2])]);
      }
    }
    expect(comparisons.length).toBeGreaterThan(0);
    expect(comparisons.every(([before, after]) => after >= before)).toBe(true);
  });

  it("explains when a cultivation system is active, idle or exposed to an outage", () => {
    const base = startKqGame(121, { deckCodes: ["BOTTE-007"] });
    const matching = {
      ...base,
      situationCodes: base.situationCodes.map((code, index) => index === 0 ? "SIT-001" : code),
    };
    expect(getKqCultureSystemSituationStatus(matching)).toMatchObject({
      tone: "active",
      label: "Avantage actif",
    });
    expect(getKqCultureSystemSituationStatus({
      ...matching,
      situationCodes: matching.situationCodes.map((code, index) => index === 0 ? "SIT-007" : code),
    })).toMatchObject({
      tone: "neutral",
      label: "Effet en veille",
    });
    expect(getKqCultureSystemSituationStatus({ ...matching, powerOutage: true })).toMatchObject({
      tone: "danger",
      label: "Pompe arrêtée",
    });
  });

  it("suspends the hydroponic reroll while the pump has no power", () => {
    const base = startKqGame(122, { deckCodes: ["BOTTE-007"] });
    const rolled = rollKqDice({
      ...base,
      powerOutage: true,
      situationCodes: base.situationCodes.map((code, index) => index === 0 ? "SIT-001" : code),
    });
    expect(rolled.effectNotices?.some((notice) => notice.startsWith("Hydroponie :"))).toBe(false);
    expect(rolled.effectNotices?.some((notice) => notice.startsWith("Coupure de courant :"))).toBe(true);
  });

  it("makes Orius the pressure-relief specialist against thrips", () => {
    const base = startKqGame(23, { deckCodes: ["BOTTE-001"], startingXp: 5 });
    const state: KqGameState = {
      ...base,
      stageIndex: 2,
      situationCodes: base.situationCodes.map((code, index) => index === 2 ? "SIT-014" : code),
      phase: "rolled",
      dice: [1, 5, 6],
      pressure: 3,
      revealedPest: "thrips",
    };
    const relieved = playKqCard(state, "BOTTE-023");
    expect(relieved.dice).toEqual([4, 5, 6]);
    expect(relieved.pressure).toBe(2);
    expect(relieved.effectNotices?.at(-1)).toContain("Pression −1");
  });

  it("makes the fabric pot absorb one Danger in exchange for pressure", () => {
    let result: { baseline: KqGameState; protected: KqGameState } | null = null;
    for (let seed = 1; seed <= 500 && !result; seed += 1) {
      const base = startKqGame(seed, { deckCodes: ["BOTTE-001", "BOTTE-013"], startingXp: 4 });
      const prepared: KqGameState = {
        ...base,
        situationCodes: base.situationCodes.map((code, index) => index === 0 ? "SIT-001" : code),
        handCodes: ["BOTTE-013"],
      };
      const baseline = rollKqDice(prepared);
      if (!baseline.dice?.includes(1)) continue;
      result = { baseline, protected: rollKqDice(playKqCard(prepared, "BOTTE-013")) };
    }
    expect(result).not.toBeNull();
    expect(result?.protected.pressure).toBe((result?.baseline.pressure ?? 0) + 1);
    expect(result?.protected.dice?.filter((die) => die === 1)).toHaveLength(
      Math.max(0, (result?.baseline.dice?.filter((die) => die === 1).length ?? 0) - 1),
    );
    expect(result?.protected.effectNotices?.some((notice) => notice.includes("aération des racines"))).toBe(true);
  });

  it("lets living soil buffer a Danger without rerolling dice", () => {
    let result: { baseline: KqGameState; buffered: KqGameState } | null = null;
    for (let seed = 1; seed <= 500 && !result; seed += 1) {
      const baselineBase = startKqGame(seed, { deckCodes: ["BOTTE-008"] });
      const baseline = rollKqDice({
        ...baselineBase,
        situationCodes: baselineBase.situationCodes.map((code, index) => index === 0 ? "SIT-003" : code),
      });
      if (!baseline.dice?.includes(1)) continue;
      const livingBase = startKqGame(seed, { deckCodes: ["BOTTE-009"] });
      const buffered = rollKqDice({
        ...livingBase,
        situationCodes: livingBase.situationCodes.map((code, index) => index === 0 ? "SIT-003" : code),
      });
      result = { baseline, buffered };
    }
    expect(result).not.toBeNull();
    const expected = [...(result?.baseline.dice ?? [])];
    expected[expected.indexOf(1)] = 3;
    expect(result?.buffered.dice).toEqual(expected);
    expect(result?.buffered.effectNotices?.some((notice) => notice.includes("tampon biologique"))).toBe(true);
  });

  it("makes aeroponics powerful while doubling the outage penalty", () => {
    const base = startKqGame(41, { deckCodes: ["BOTTE-008"] });
    const rolled = rollKqDice({
      ...base,
      powerOutage: true,
      situationCodes: base.situationCodes.map((code, index) => index === 0 ? "SIT-001" : code),
    });
    expect(rolled.dice?.filter((die) => die === 1).length).toBeGreaterThanOrEqual(2);
    expect(rolled.effectNotices?.some((notice) => notice.includes("pompes aéroponiques"))).toBe(true);
  });

  it("uses organic fertilizer only to finish an already strong roll", () => {
    const base = startKqGame(42, { deckCodes: ["BOTTE-001", "BOTTE-021"], startingXp: 5 });
    const state: KqGameState = {
      ...base,
      phase: "rolled",
      dice: [4, 5, 3],
      handCodes: ["BOTTE-021"],
    };
    expect(playKqCard(state, "BOTTE-021").dice).toEqual([4, 5, 6]);
  });

  it("turns Papiers en règle into exactly three successes during the DDTM inspection", () => {
    const base = startKqGame(301, { deckCodes: ["BOTTE-001", "BOTTE-027"], startingXp: 6 });
    const prepared: KqGameState = {
      ...base,
      stageIndex: 3,
      situationCodes: base.situationCodes.map((code, index) => index === 3 ? "SIT-024" : code),
      handCodes: ["BOTTE-027"],
      playedThisStage: ["BOTTE-001"],
    };
    const rolled = rollKqDice(playKqCard(prepared, "BOTTE-027"));
    expect(rolled.dice).toEqual([4, 4, 4]);
    expect(previewKqResolution(rolled)?.outcome).toBe("critical");
  });

  it("lets an illegal hookup rescue the bill at the cost of pressure", () => {
    const base = startKqGame(302, { deckCodes: ["BOTTE-001", "BOTTE-028"], startingXp: 5 });
    const rolled: KqGameState = {
      ...base,
      stageIndex: 2,
      situationCodes: base.situationCodes.map((code, index) => index === 2 ? "SIT-021" : code),
      handCodes: ["BOTTE-028"],
      phase: "rolled",
      dice: [1, 2, 2],
      playedThisStage: ["BOTTE-001"],
    };
    const rescued = playKqCard(rolled, "BOTTE-028");
    expect(rescued.dice).toEqual([4, 4, 2]);
    expect(rescued.pressure).toBe(2);
    expect(resolveKqStage(rescued).powerOutage).toBe(false);
  });

  it("turns a failed electricity bill into a one-stage power outage", () => {
    const base = startKqGame(303);
    const bill: KqGameState = {
      ...base,
      stageIndex: 2,
      situationCodes: base.situationCodes.map((code, index) => index === 2 ? "SIT-021" : code),
      phase: "rolled",
      dice: [1, 2, 2],
      playedThisStage: ["BOTTE-001"],
    };
    const failed = resolveKqStage(bill);
    expect(failed.powerOutage).toBe(true);
    const nextRoll = rollKqDice(advanceKqStage(failed));
    expect(nextRoll.dice).toContain(1);
    expect(nextRoll.effectNotices?.some((notice) => notice.includes("Coupure de courant"))).toBe(true);
    expect(resolveKqStage(nextRoll).powerOutage).toBe(false);
  });

  it("uses solar backup or security equipment to block incident losses", () => {
    const solarBase = startKqGame(304, { equipmentCodes: ["SOLAR-BACKUP"] });
    const failedBill = resolveKqStage({
      ...solarBase,
      stageIndex: 2,
      situationCodes: solarBase.situationCodes.map((code, index) => index === 2 ? "SIT-021" : code),
      phase: "rolled",
      dice: [1, 2, 2],
      playedThisStage: ["BOTTE-001"],
    });
    expect(failedBill.powerOutage).toBe(false);
    expect(failedBill.effectNotices?.some((notice) => notice.includes("batterie prend le relais"))).toBe(true);

    const securityBase = startKqGame(305, { equipmentCodes: ["SECURITY-CAMERA"] });
    const theft = resolveKqStage({
      ...securityBase,
      stageIndex: 4,
      situationCodes: securityBase.situationCodes.map((code, index) => index === 4 ? "SIT-027" : code),
      phase: "rolled",
      dice: [1, 2, 2],
      playedThisStage: ["BOTTE-001"],
    });
    expect(theft.harvestLossPercent).toBe(0);
  });

  it("makes Gros molosse protect quantity without falsifying a failed jury outcome", () => {
    const base = startKqGame(306, { deckCodes: ["BOTTE-001", "BOTTE-034"], startingXp: 5 });
    const protectedFailure = resolveKqStage({
      ...base,
      stageIndex: 4,
      situationCodes: base.situationCodes.map((code, index) => index === 4 ? "SIT-027" : code),
      phase: "rolled",
      dice: [1, 2, 2],
      playedThisStage: ["BOTTE-001", "BOTTE-034"],
      usedCards: ["BOTTE-001", "BOTTE-034"],
    });
    expect(protectedFailure.lastOutcome).toBe("failure");
    expect(protectedFailure.harvestLossPercent).toBe(0);
    expect(protectedFailure.combos).toContain("Gardien du lot");
  });

  it("builds a stable scenario path and avoids the previous run", () => {
    const first = buildKqScenarioPath(42);
    const same = buildKqScenarioPath(42);
    const next = buildKqScenarioPath(84, first);
    expect(first).toEqual(same);
    expect(first).toHaveLength(KQ_STAGES.length);
    expect(next.every((code) => !first.includes(code))).toBe(true);
  });

  it("guarantees a compatible situation when a daily challenge requires one", () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const path = buildKqScenarioPath(seed, [], ["pest"]);
      expect(path.some((code) => KQ_SITUATIONS.find((situation) => situation.code === code)?.tags.includes("pest"))).toBe(true);
    }
  });

  it("chooses a pest covered by the remaining PBI collection", () => {
    (["aphids", "mites", "thrips"] as const).forEach((pest) => {
      for (let seed = 0; seed < 20; seed += 1) {
        const path = buildKqScenarioPath(seed, [], ["pest"], [pest]);
        const pestSituation = path.map((code) => KQ_SITUATIONS.find((situation) => situation.code === code)).find((situation) => situation?.pest);
        expect(pestSituation?.pest).toBe(pest);
      }
    });
  });

  it("shows only owned PBI compatible with the revealed pest", () => {
    const state = { ...startKqGame(1), revealedPest: "mites" as const };
    const visiblePbi = getKqVisibleActionCards(state).filter((card) => card.category === "pbi");
    expect(visiblePbi.length).toBeGreaterThan(0);
    expect(visiblePbi.every((card) => card.targets?.includes("mites"))).toBe(true);
    expect(visiblePbi.some((card) => card.targets?.includes("aphids") && !card.targets?.includes("mites"))).toBe(false);
  });

  it("exposes the complete 36-card set across all five families", () => {
    expect(KQ_CARDS).toHaveLength(36);
    expect(new Set(KQ_CARDS.map((card) => card.category)).size).toBe(5);
    expect(KQ_CARDS.every((card) => card.effect.length > 0)).toBe(true);
  });

  it("offers exactly four real cultivation systems", () => {
    const systems = KQ_CARDS.filter((card) => card.category === "substrate");
    expect(systems.map((card) => card.name)).toEqual([
      "Terreau horticole",
      "Hydroponie recirculante",
      "Aéroponie haute pression",
      "Sol vivant",
    ]);
    expect(KQ_CULTURE_SYSTEM_PROFILES.map((profile) => profile.cardCode)).toEqual(
      systems.map((card) => card.code),
    );
    expect(new Set(KQ_CULTURE_SYSTEM_PROFILES.map((profile) => profile.technique)).size).toBe(4);
    expect(KQ_CULTURE_SYSTEM_PROFILES.every((profile) => (
      profile.mastery.length > 0 && profile.electricity.length > 0
    ))).toBe(true);
    const tradeoffs = systems.map((card) => getKqCardTradeoff(card));
    expect(new Set(tradeoffs.map((tradeoff) => tradeoff.benefit)).size).toBe(4);
    expect(new Set(tradeoffs.map((tradeoff) => tradeoff.risk)).size).toBe(4);
    expect(getKqCultureSystemProfile("BOTTE-404")).toBeNull();
    expect(getKqCultureSystemSummary(["BOTTE-008", "BOTTE-017"])).toMatchObject({
      code: "BOTTE-008",
      name: "Aéroponie haute pression",
      technique: "Racines suspendues et brumisées",
      electricity: "Critique",
    });
    expect(getKqCultureSystemSummary(["BOTTE-017"])).toBeNull();
  });

  it("never lets any passive Substrate be replayed and burned as an active card", () => {
    const substrateCards = KQ_CARDS.filter((card) => card.timing === "passive");
    expect(substrateCards.length).toBeGreaterThan(0);
    substrateCards.forEach((card) => {
      const state = startKqGame(17, { deckCodes: [card.code, card.code, "BOTTE-017"] });
      const permission = canPlayKqCard(state, card);
      expect(permission.allowed, card.code).toBe(false);
      expect(permission.reason, card.code).toContain("déjà actif");
      expect(playKqCard(state, card.code), card.code).toBe(state);
    });
  });

  it("matches the complete support collection target", () => {
    expect(KQ_CARDS).toHaveLength(KQ_COLLECTIONS.support.alphaCards);
    expect(KQ_COLLECTIONS.support.totalCards).toBe(36);
    expect(KQ_COLLECTIONS.buddies.totalCards).toBe(52);
  });

  it("equips only one selected substrate", () => {
    const state = startKqGame(2, { varietyCode: "HH2026-005", deckCodes: ["BOTTE-007", "BOTTE-008", "BOTTE-017"] });
    expect(state.deckCodes).toEqual(["BOTTE-007", "BOTTE-017"]);
    expect(state.playedThisStage).toEqual(["BOTTE-007"]);
  });

  it("reveals a hidden pest with the loupe before opening compatible PBI collection cards", () => {
    const base = startKqGame(3, { deckCodes: ["BOTTE-001", "BOTTE-004"] });
    const pestStage: KqGameState = { ...base, stageIndex: 2, situationCodes: [base.situationCodes[0], base.situationCodes[1], "SIT-003", ...base.situationCodes.slice(3)], xp: 5 };
    const chrysope = KQ_CARDS.find((card) => card.code === "BOTTE-002")!;
    expect(canPlayKqCard(pestStage, chrysope).allowed).toBe(false);
    const inspected = playKqCard(pestStage, "BOTTE-004");
    expect(inspected.revealedPest).toBe("aphids");
    const rolled = rollKqDice(inspected);
    expect(canPlayKqCard(rolled, chrysope).allowed).toBe(true);
    const swirskii = KQ_CARDS.find((card) => card.code === "BOTTE-011")!;
    expect(canPlayKqCard(rolled, swirskii).reason).toContain("ne cible pas");
  });

  it("keeps PBI outside the deck and cannot rescue with an unowned auxiliary", () => {
    const base = startKqGame(3, { deckCodes: ["BOTTE-001", "BOTTE-002", "BOTTE-004"], collectionCodes: ["BOTTE-001", "BOTTE-004"] });
    expect(base.deckCodes).not.toContain("BOTTE-002");
    const pestStage: KqGameState = { ...base, stageIndex: 2, situationCodes: [base.situationCodes[0], base.situationCodes[1], "SIT-003", ...base.situationCodes.slice(3)], xp: 5 };
    const inspected = playKqCard(pestStage, "BOTTE-004");
    const rolled = rollKqDice(inspected);
    const chrysope = KQ_CARDS.find((card) => card.code === "BOTTE-002")!;
    expect(canPlayKqCard(rolled, chrysope).reason).toContain("pas dans ta collection");
  });

  it("exposes the agronomic pH–EC diagnostic card", () => {
    expect(KQ_CARDS.find((card) => card.code === "BOTTE-018")?.name).toBe("Testeur pH–EC");
  });

  it("rewards the Loupe plus compatible auxiliary combo", () => {
    const base = startKqGame(3, { deckCodes: ["BOTTE-001", "BOTTE-004"] });
    let state: KqGameState = { ...base, stageIndex: 2, situationCodes: [base.situationCodes[0], base.situationCodes[1], "SIT-003", ...base.situationCodes.slice(3)], xp: 5 };
    state = playKqCard(state, "BOTTE-004");
    state = rollKqDice(state);
    state = playKqCard(state, "BOTTE-002");
    state = resolveKqStage(state);
    expect(state.combos).toContain("PBI ciblée");
    expect(state.history.at(-1)?.combos).toContain("PBI ciblée");
  });

  it("keeps unassisted results distributed across wins and complications", () => {
    let qualityTotal = 0;
    let failures = 0;
    const runs = 300;
    for (let seed = 1; seed <= runs; seed += 1) {
      let state: KqGameState = startKqGame(seed);
      while (state.phase !== "complete") {
        if (state.phase === "prepare") state = rollKqDice(state);
        if (state.phase === "rolled") state = resolveKqStage(state);
        if (state.phase === "resolved") state = advanceKqStage(state);
      }
      qualityTotal += state.quality;
      failures += state.history.filter((entry) => entry.outcome === "failure").length;
    }
    const averageQuality = qualityTotal / runs;
    const failureRate = failures / (runs * KQ_STAGES.length);
    expect(averageQuality).toBeGreaterThan(2);
    expect(averageQuality).toBeLessThan(12);
    expect(failureRate).toBeGreaterThan(0.08);
    expect(failureRate).toBeLessThan(0.55);
  });

  it("enforces timing, tags and XP", () => {
    const state = startKqGame(1, { varietyCode: "HH2026-020" });
    const loupe = KQ_CARDS.find((card) => card.code === "BOTTE-004")!;
    const luck = KQ_CARDS.find((card) => card.code === "BOTTE-006")!;
    expect(canPlayKqCard(state, loupe).allowed).toBe(false);
    expect(canPlayKqCard(state, luck).reason).toContain("2 XP");
  });

  it("spends XP and consumes a compatible card", () => {
    const state = { ...startKqGame(1), xp: 3 };
    const next = playKqCard(state, "BOTTE-005");
    expect(next.xp).toBe(2);
    expect(next.preparationPlayed).toBe(true);
    expect(next.usedCards).toContain("BOTTE-005");
  });

  it("rerolls the lowest die after the roll", () => {
    const rolled: KqGameState = { ...rollKqDice(startKqGame(7)), xp: 3 };
    const next = playKqCard(rolled, "BOTTE-006");
    expect(next.rollNonce).toBe(rolled.rollNonce + 2);
    expect(next.usedCards).toContain("BOTTE-006");
    expect(next.dice?.filter((die) => rolled.dice?.includes(die)).length).toBeGreaterThanOrEqual(1);
  });

  it("resolves and advances all six stages without ending early", () => {
    let state: KqGameState = startKqGame(88);
    while (state.phase !== "complete") {
      if (state.phase === "prepare") state = rollKqDice(state);
      if (state.phase === "rolled") state = resolveKqStage(state);
      if (state.phase === "resolved") state = advanceKqStage(state);
    }
    expect(state.history).toHaveLength(KQ_STAGES.length);
    expect(state.traits).toHaveLength(KQ_STAGES.length);
    expect(getKqHarvestTier(state.quality).length).toBeGreaterThan(0);
  });

  it("previews a rolled result before final resolution", () => {
    const rolled = rollKqDice(startKqGame(42));
    const preview = previewKqResolution(rolled);
    expect(preview?.total).toBe(rolled.dice?.filter((die) => die >= 4).length);
  });

  it("rolls three dice whose faces stay between one and six", () => {
    const rolled = rollKqDice(startKqGame(19));
    expect(rolled.dice).toHaveLength(3);
    expect(rolled.dice?.every((die) => die >= 1 && die <= 6)).toBe(true);
  });

  it("shows the fourth die discarded by Main verte and confirms the effect", () => {
    let state = startKqGame(29, { deckCodes: ["BOTTE-001", "BOTTE-017"], startingXp: 5 });
    state = playKqCard(state, "BOTTE-017");
    state = rollKqDice(state);
    expect(state.dice).toHaveLength(3);
    expect(state.bonusDie).toBeGreaterThanOrEqual(1);
    expect(state.bonusDie).toBeLessThanOrEqual(6);
    expect(state.effectNotices?.some((notice) => notice.includes("4 dés lancés") && notice.includes("écarté"))).toBe(true);
  });

  it("records a visible before-and-after confirmation for the pH–EC reaction", () => {
    const base = startKqGame(30, { deckCodes: ["BOTTE-001", "BOTTE-018"], startingXp: 5 });
    const reacted = playKqCard({ ...base, phase: "rolled", dice: [3, 4, 5] }, "BOTTE-018");
    expect(reacted.dice).not.toEqual([3, 4, 5]);
    expect(reacted.effectNotices?.at(-1)).toContain("3 · 4 · 5 →");
  });

  it("turns a nominal success with an uncancelled Danger into a fragile result", () => {
    const state: KqGameState = { ...startKqGame(1), phase: "rolled", dice: [1, 4, 5] };
    expect(previewKqResolution(state)?.outcome).toBe("fragile");
  });

  it("raises the requirement when pressure reaches three", () => {
    const state: KqGameState = { ...startKqGame(1), stageIndex: 1, phase: "rolled", pressure: 3, dice: [4, 5, 2] };
    expect(previewKqResolution(state)?.target).toBe(3);
  });

  it("allows at most one preparation and one reaction per stage", () => {
    let state = { ...startKqGame(1, { deckCodes: ["BOTTE-001", "BOTTE-005", "BOTTE-017", "BOTTE-006", "BOTTE-018"] }), xp: 9 };
    state = playKqCard(state, "BOTTE-005");
    expect(canPlayKqCard(state, KQ_CARDS.find((card) => card.code === "BOTTE-017")!).allowed).toBe(false);
    state = rollKqDice(state);
    state = playKqCard(state, "BOTTE-006");
    const reactionLocked = { ...state, reactionPlayed: true };
    expect(canPlayKqCard(reactionLocked, KQ_CARDS.find((card) => card.code === "BOTTE-018")!).allowed).toBe(false);
  });

  it("prevents burning the moisture probe when there is no neutral die", () => {
    const base = startKqGame(1, { deckCodes: ["BOTTE-001", "BOTTE-030"] });
    const noNeutral: KqGameState = { ...base, stageIndex: 5, phase: "rolled", dice: [1, 4, 5], xp: 5 };
    const withNeutral: KqGameState = { ...noNeutral, dice: [3, 4, 5] };
    const probe = KQ_CARDS.find((card) => card.code === "BOTTE-030")!;
    expect(canPlayKqCard(noNeutral, probe).reason).toContain("2 ou 3");
    expect(canPlayKqCard(withNeutral, probe).allowed).toBe(true);
  });

  it("prevents wasting a PBI when every die is already successful", () => {
    const base = startKqGame(1, { deckCodes: ["BOTTE-001", "BOTTE-004"] });
    const state: KqGameState = { ...base, stageIndex: 2, situationCodes: [base.situationCodes[0], base.situationCodes[1], "SIT-003", ...base.situationCodes.slice(3)], phase: "rolled", revealedPest: "aphids", dice: [4, 5, 6], xp: 5 };
    const pbi = KQ_CARDS.find((card) => card.code === "BOTTE-002")!;
    expect(canPlayKqCard(state, pbi).reason).toContain("déjà des réussites");
  });

  it("only allows the inspection Loupe when a pest can actually be revealed", () => {
    const loupe = KQ_CARDS.find((card) => card.code === "BOTTE-004")!;
    const base = startKqGame(1, { deckCodes: ["BOTTE-001", "BOTTE-004"] });
    const flowerStage: KqGameState = { ...base, stageIndex: 3, situationCodes: [base.situationCodes[0], base.situationCodes[1], base.situationCodes[2], "SIT-004", ...base.situationCodes.slice(4)], xp: 5 };
    const pestStage: KqGameState = { ...base, stageIndex: 2, situationCodes: [base.situationCodes[0], base.situationCodes[1], "SIT-003", ...base.situationCodes.slice(3)], xp: 5 };
    expect(canPlayKqCard(flowerStage, loupe).allowed).toBe(false);
    expect(canPlayKqCard(pestStage, loupe).allowed).toBe(true);
  });

  it("explains both the benefit and the risk of burning a card", () => {
    KQ_CARDS.forEach((card) => {
      const tradeoff = getKqCardTradeoff(card);
      expect(tradeoff.benefit.length).toBeGreaterThan(15);
      expect(tradeoff.risk.length).toBeGreaterThan(15);
    });
  });

  it("converts sixes into extra XP sparks", () => {
    const state: KqGameState = { ...startKqGame(1), phase: "rolled", dice: [6, 6, 6] };
    expect(resolveKqStage(state).xp).toBe(state.xp + 6);
  });

  it("releases one pressure after a perfect three-success roll", () => {
    const state: KqGameState = { ...startKqGame(1), phase: "rolled", pressure: 3, dice: [4, 5, 6] };
    const resolved = resolveKqStage(state);
    expect(resolved.lastOutcome).toBe("critical");
    expect(resolved.pressure).toBe(2);
    expect(resolved.history.at(-1)?.pressureAfter).toBe(2);
  });

  it("applies permanent Heritage starting XP without burning a card", () => {
    const state = startKqGame(12, { varietyCode: "HH2026-020", heritageCode: "HERITAGE-002" });
    expect(state.xp).toBe(3);
    expect(state.heritageUsed).toBe(false);
    expect(state.usedCards).not.toContain("HERITAGE-002");
  });

  it("applies a dynamically generated producer Heritage", () => {
    const state = startKqGame(12, {
      varietyCode: "HH2026-020",
      heritageCard: {
        code: "HERITAGE-013",
        name: "Héritage de la Ferme des Collines",
        timing: "passive",
        effect: "starting-xp-two",
        description: "Commence chaque culture avec 2 XP supplémentaires.",
        producerName: "Ferme des Collines",
      },
    });
    expect(state.heritageCode).toBe("HERITAGE-013");
    expect(state.heritageEffect).toBe("starting-xp-two");
    expect(state.heritageProducerName).toBe("Ferme des Collines");
    expect(state.xp).toBe(3);
  });

  it("grants the reusable second redraw Heritage", () => {
    const started = startKqGame(12, { heritageCode: "HERITAGE-005" });
    const first = redrawKqHand(started);
    const second = redrawKqHand(first);
    const third = redrawKqHand(second);
    expect(third.handRedrawsUsed).toBe(3);
    expect(redrawKqHand(third)).toBe(third);
  });

  it("arms and consumes Signature du maître on a five-die roll", () => {
    const started = startKqGame(12, { heritageCode: "HERITAGE-012" });
    expect(canActivateKqHeritage(started).allowed).toBe(true);
    const armed = activateKqHeritage(started);
    expect(armed.heritageArmed).toBe(true);
    const rolled = rollKqDice(armed);
    expect(rolled.heritageUsed).toBe(true);
    expect(rolled.heritageArmed).toBe(false);
    expect(rolled.bonusDie).not.toBeNull();
    expect(rolled.effectNotices?.some((notice) => notice.includes("5 dés lancés"))).toBe(true);
  });

  it("only consumes Floraison maîtrisée when its neutral die can change", () => {
    const base = startKqGame(12, { heritageCode: "HERITAGE-009" });
    const state: KqGameState = { ...base, stageIndex: 3, phase: "rolled", dice: [2, 3, 5] };
    const activated = activateKqHeritage(state);
    expect(activated.dice).toEqual([4, 4, 5]);
    expect(activated.heritageUsed).toBe(true);
  });

  it("lets Main prévoyante exchange three reserve cards without burning them", () => {
    const supportCodes = KQ_CARDS.filter((card) => card.category !== "substrate" && card.category !== "pbi").slice(0, 8).map((card) => card.code);
    const started = startKqGame(44, { heritageCode: "HERITAGE-003", deckCodes: ["BOTTE-001", ...supportCodes] });
    expect(started.handCodes).toHaveLength(5);
    expect(started.heritageReserveCodes).toHaveLength(3);
    const outgoing = started.handCodes![0];
    const incoming = started.heritageReserveCodes![0];
    const swapped = swapKqHeritageHandCard(started, 0, 0);
    expect(swapped.handCodes![0]).toBe(incoming);
    expect(swapped.heritageReserveCodes![0]).toBe(outgoing);
    expect(swapped.usedCards).toEqual(started.usedCards);
    expect(rollKqDice(swapped).heritageReserveCodes).toBeUndefined();
  });

  it("consumes Racines solides on the first Enracinement Danger", () => {
    let protectedRoll: KqGameState | null = null;
    for (let seed = 1; seed <= 100 && !protectedRoll; seed += 1) {
      const base = startKqGame(seed, { heritageCode: "HERITAGE-001" });
      const rolled = rollKqDice({ ...base, stageIndex: 1 });
      if (rolled.heritageUsed) protectedRoll = rolled;
    }
    expect(protectedRoll).not.toBeNull();
    expect(protectedRoll?.heritageUsed).toBe(true);
    expect(protectedRoll?.dice).toContain(6);
    expect(protectedRoll?.effectNotices?.some((notice) => notice.includes("Danger devient une Étincelle"))).toBe(true);
  });

  it("does not consume Racines solides when another protection covers every Danger", () => {
    let protectedByEquipment: KqGameState | null = null;
    for (let seed = 1; seed <= 200 && !protectedByEquipment; seed += 1) {
      const base = startKqGame(seed, { heritageCode: "HERITAGE-001", deckCodes: ["BOTTE-001", "BOTTE-024"] });
      const rolled = rollKqDice({
        ...base,
        stageIndex: 1,
        situationCodes: [base.situationCodes[0], "SIT-008", ...base.situationCodes.slice(2)],
        playedThisStage: [...base.playedThisStage, "BOTTE-024"],
      });
      if (rolled.dice?.filter((die) => die === 1).length === 1) protectedByEquipment = rolled;
    }
    expect(protectedByEquipment).not.toBeNull();
    expect(protectedByEquipment?.cancelledDangers).toBe(1);
    expect(protectedByEquipment?.heritageUsed).toBe(false);
  });

  it("turns the first climate Danger into a Spark with Climat stable", () => {
    let protectedRoll: KqGameState | null = null;
    for (let seed = 1; seed <= 200 && !protectedRoll; seed += 1) {
      const base = startKqGame(seed, { heritageCode: "HERITAGE-004" });
      const rolled = rollKqDice({ ...base, situationCodes: ["SIT-007", ...base.situationCodes.slice(1)] });
      if (rolled.heritageUsed) protectedRoll = rolled;
    }
    expect(protectedRoll).not.toBeNull();
    expect(protectedRoll?.dice).toContain(6);
    expect(previewKqResolution(protectedRoll!)?.sparks).toBeGreaterThanOrEqual(1);
  });

  it("turns the first failure into Fragile with Reprise vigoureuse", () => {
    const base = startKqGame(8, { heritageCode: "HERITAGE-006" });
    const failed = resolveKqStage({ ...base, phase: "rolled", dice: [1, 1, 1] });
    expect(failed.lastOutcome).toBe("fragile");
    expect(failed.quality).toBe(base.quality + 1);
    expect(failed.xp).toBe(base.xp + 1);
    expect(failed.heritageUsed).toBe(true);
    const failedAgain = resolveKqStage({ ...failed, phase: "rolled", dice: [1, 1, 1] });
    expect(failedAgain.xp).toBe(failed.xp + 1);
  });

  it("turns a neutral die into a Spark with Instinct du cultivateur", () => {
    const base = startKqGame(9, { heritageCode: "HERITAGE-007" });
    const state: KqGameState = { ...base, phase: "rolled", dice: [2, 4, 5] };
    const activated = activateKqHeritage(state);
    expect(activated.heritageUsed).toBe(true);
    expect(activated.rollNonce).toBe(state.rollNonce);
    expect(activated.dice).toEqual([6, 4, 5]);
  });

  it("reveals a real pest for free with Bouclier biologique", () => {
    const base = startKqGame(10, { heritageCode: "HERITAGE-008" });
    const state: KqGameState = {
      ...base,
      stageIndex: 2,
      situationCodes: [base.situationCodes[0], base.situationCodes[1], "SIT-003", ...base.situationCodes.slice(3)],
    };
    const activated = activateKqHeritage(state);
    expect(activated.revealedPest).toBe("aphids");
    expect(activated.heritageUsed).toBe(true);
    expect(activated.xp).toBe(state.xp + 2);
  });

  it("turns the lowest die into a Spark only during Affinage patient", () => {
    const base = startKqGame(11, { heritageCode: "HERITAGE-010" });
    const state: KqGameState = {
      ...base,
      stageIndex: KQ_STAGES.length - 1,
      phase: "rolled",
      dice: [1, 4, 5],
    };
    const activated = activateKqHeritage(state);
    expect(activated.heritageUsed).toBe(true);
    expect(activated.rollNonce).toBe(state.rollNonce);
    expect(activated.dice).toEqual([6, 4, 5]);
  });

  it("turns every Danger into a success with Héritage de la canopée", () => {
    const base = startKqGame(13, { heritageCode: "HERITAGE-011" });
    const state: KqGameState = { ...base, phase: "rolled", dice: [1, 1, 4] };
    const activated = activateKqHeritage(state);
    expect(activated.dice).toEqual([4, 4, 4]);
    expect(activated.cancelledDangers).toBe(0);
    expect(previewKqResolution(activated)?.dangers).toBe(0);
    expect(activated.heritageUsed).toBe(true);
  });

  it("prevents wasting Héritage de la canopée without an uncovered Danger", () => {
    const base = startKqGame(13, { heritageCode: "HERITAGE-011" });
    const safeRoll: KqGameState = { ...base, phase: "rolled", dice: [4, 5, 6] };
    expect(canActivateKqHeritage(safeRoll)).toEqual({
      allowed: false,
      reason: "Aucun Danger non protégé à transformer.",
    });
    expect(activateKqHeritage(safeRoll)).toBe(safeRoll);
    const alreadyProtected: KqGameState = { ...base, phase: "rolled", dice: [1, 4, 5], cancelledDangers: 1 };
    expect(canActivateKqHeritage(alreadyProtected).allowed).toBe(false);
  });

  it("applies the four new stage-specific active Heritages only in their window", () => {
    const germination = activateKqHeritage({
      ...startWithHeritageEffect("germination-lowest-to-strong"),
      phase: "rolled",
      dice: [1, 3, 6],
    });
    expect(germination.dice).toEqual([5, 3, 6]);

    const rootingBase = startWithHeritageEffect("rooting-pressure-reset");
    const rooting = activateKqHeritage({ ...rootingBase, stageIndex: 1, phase: "rolled", dice: [2, 4, 5], pressure: 3 });
    expect(rooting.pressure).toBe(0);
    expect(rooting.dice).toEqual([2, 4, 5]);

    const growthBase = startWithHeritageEffect("growth-danger-reroll");
    const growthState: KqGameState = { ...growthBase, stageIndex: 2, phase: "rolled", dice: [1, 4, 5] };
    const growth = activateKqHeritage(growthState);
    expect(growth.rollNonce).toBe(growthState.rollNonce + 1);
    expect(growth.heritageUsed).toBe(true);

    const floweringBase = startWithHeritageEffect("flower-success-to-spark");
    const flowering = activateKqHeritage({ ...floweringBase, stageIndex: 3, phase: "rolled", dice: [4, 2, 3] });
    expect(flowering.dice).toEqual([6, 2, 3]);
    expect(canActivateKqHeritage({ ...floweringBase, stageIndex: 2, phase: "rolled", dice: [4, 2, 3] }).allowed).toBe(false);
  });

  it("protects harvest and upgrades only a Fragile final affinage", () => {
    const guardBase = startWithHeritageEffect("harvest-theft-shield");
    const guarded = resolveKqStage({
      ...guardBase,
      stageIndex: 4,
      situationCodes: guardBase.situationCodes.map((code, index) => index === 4 ? "SIT-027" : code),
      phase: "rolled",
      dice: [1, 2, 2],
    });
    expect(guarded.lastOutcome).toBe("failure");
    expect(guarded.harvestLossPercent).toBe(0);

    const dryingBase = startWithHeritageEffect("drying-fragile-to-success");
    const dryingState: KqGameState = {
      ...dryingBase,
      stageIndex: 5,
      situationCodes: dryingBase.situationCodes.map((code, index) => index === 5 ? "SIT-029" : code),
      phase: "rolled",
      dice: [4, 2, 2],
    };
    expect(previewKqResolution(dryingState)?.outcome).toBe("fragile");
    const recovered = resolveKqStage(dryingState);
    expect(recovered.lastOutcome).toBe("success");
    expect(recovered.heritageUsed).toBe(true);
  });

  it("keeps the new passive quality and progression powers mechanically distinct", () => {
    const firstSuccessBase = startWithHeritageEffect("first-success-xp-two");
    const firstSuccess = resolveKqStage({
      ...firstSuccessBase,
      situationCodes: ["SIT-007", ...firstSuccessBase.situationCodes.slice(1)],
      phase: "rolled",
      dice: [4, 5, 2],
    });
    expect(firstSuccess.xp - firstSuccessBase.xp).toBe(4);

    const criticalBase = startWithHeritageEffect("critical-quality-boost");
    const critical = resolveKqStage({ ...criticalBase, phase: "rolled", dice: [4, 5, 6] });
    expect(critical.quality - criticalBase.quality).toBe(4);

    const fragileBase = startWithHeritageEffect("fragile-quality-boost");
    const fragileState: KqGameState = {
      ...fragileBase,
      stageIndex: 5,
      situationCodes: fragileBase.situationCodes.map((code, index) => index === 5 ? "SIT-029" : code),
      phase: "rolled",
      dice: [4, 2, 2],
    };
    const fragile = resolveKqStage(fragileState);
    expect(fragile.lastOutcome).toBe("fragile");
    expect(fragile.quality - fragileBase.quality).toBe(2);

    const calm = startWithHeritageEffect("calm-target-relief");
    const tenseEquivalent = { ...calm, heritageEffect: undefined };
    expect(getKqStageTarget(calm)).toBe(Math.max(1, getKqStageTarget(tenseEquivalent) - 1));
  });

  it("uses the new automatic Danger and Pressure protections exactly once", () => {
    let shielded: KqGameState | null = null;
    for (let seed = 1; seed <= 200 && !shielded; seed += 1) {
      const rolled = rollKqDice(startWithHeritageEffect("first-danger-shield", seed));
      if (rolled.heritageUsed) shielded = rolled;
    }
    expect(shielded).not.toBeNull();
    expect(shielded?.cancelledDangers).toBeGreaterThanOrEqual(1);

    const reliefBase = startWithHeritageEffect("spark-pressure-relief");
    const relieved = resolveKqStage({ ...reliefBase, phase: "rolled", pressure: 3, dice: [6, 2, 2] });
    expect(relieved.pressure).toBe(1);
    expect(relieved.heritageUsed).toBe(true);
    expect(relieved.effectNotices?.some((notice) => notice.includes("Pression de 2"))).toBe(true);
  });
});
