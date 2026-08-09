import { describe, expect, it } from "vitest";
import {
  activateKqHeritage,
  canActivateKqHeritage,
  advanceKqStage,
  buildKqScenarioPath,
  canPlayKqCard,
  getKqHandCodes,
  getKqEffectNoticeKind,
  getKqHarvestTier,
  getKqVisibleActionCards,
  getKqCardTradeoff,
  KQ_BUDDIES,
  KQ_CARDS,
  KQ_COLLECTIONS,
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
    expect(startKqGame(1, { startingXp: 2 }).xp).toBe(2);
    expect(KQ_CARDS.find((card) => card.code === "BOTTE-022")?.xpCost).toBe(3);
  });

  it("starts from a selected Buddie and album-built deck", () => {
    const state = startKqGame(1, { varietyCode: "HH2026-005", deckCodes: ["BOTTE-001", "BOTTE-003", "BOTTE-006"] });
    expect(state.varietyName).toBe("ACDC");
    expect(state.deckCodes).toEqual(["BOTTE-001", "BOTTE-003", "BOTTE-006"]);
    expect(canPlayKqCard(state, KQ_CARDS.find((card) => card.code === "BOTTE-005")!).reason).toContain("pas dans le deck");
  });

  it("defines every playable Buddie through a reusable gameplay effect", () => {
    expect(KQ_BUDDIES).toHaveLength(52);
    expect(KQ_BUDDIES.every((buddie) => buddie.effect.length > 0)).toBe(true);
    expect(new Set(KQ_BUDDIES.map((buddie) => buddie.effect))).toHaveLength(3);
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

  it("uses the generic Coup de pouce name", () => {
    expect(KQ_CARDS.find((card) => card.code === "BOTTE-018")?.name).toBe("Coup de pouce");
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
    const state = startKqGame(1);
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

  it("records a visible before-and-after confirmation for a reaction card", () => {
    const base = startKqGame(30, { deckCodes: ["BOTTE-001", "BOTTE-018"], startingXp: 5 });
    const reacted = playKqCard({ ...base, phase: "rolled", dice: [3, 4, 5] }, "BOTTE-018");
    expect(reacted.dice).toEqual([4, 4, 5]);
    expect(reacted.effectNotices?.at(-1)).toContain("3 · 4 · 5 → 4 · 4 · 5");
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
    expect(canPlayKqCard(state, KQ_CARDS.find((card) => card.code === "BOTTE-018")!).allowed).toBe(false);
  });

  it("prevents burning a conditional reaction when it would have no effect", () => {
    const base = startKqGame(1, { deckCodes: ["BOTTE-001", "BOTTE-018"] });
    const noThree: KqGameState = { ...base, phase: "rolled", dice: [2, 4, 5], xp: 5 };
    const withThree: KqGameState = { ...noThree, dice: [3, 4, 5] };
    const boost = KQ_CARDS.find((card) => card.code === "BOTTE-018")!;
    expect(canPlayKqCard(noThree, boost).reason).toContain("affichant 3");
    expect(canPlayKqCard(withThree, boost).allowed).toBe(true);
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
    const state = startKqGame(12, { heritageCode: "HERITAGE-002" });
    expect(state.xp).toBe(3);
    expect(state.heritageUsed).toBe(false);
    expect(state.usedCards).not.toContain("HERITAGE-002");
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
});
