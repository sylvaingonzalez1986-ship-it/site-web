import { describe, expect, it } from "vitest";
import {
  advanceKqStage,
  canRedrawKqHand,
  canSwapKqHeritageHandCard,
  getKqHandCodes,
  KQ_ACTIVE_CARDS,
  redrawKqHand,
  resolveKqStage,
  rollKqDice,
  startKqGame,
  swapKqHeritageHandCard,
  type KqGameState,
} from "./kanab-quest-game";

const supportCodes = KQ_ACTIVE_CARDS.filter(card => card.category !== "substrate" && card.category !== "pbi")
  .slice(0, 15).map(card => card.code);
const opening = () => startKqGame(44, { deckCodes: supportCodes, heritageCode: "HERITAGE-003" });
const physicalCopies = (state: KqGameState) => [...getKqHandCodes(state), ...state.heritageReserveCodes ?? []].sort();
const nextStage = (state: KqGameState) => advanceKqStage(resolveKqStage({ ...rollKqDice(state), dice: [6, 6, 6] }));

describe("opening hand exchange permission", () => {
  it("allows arranging an opening reserve before either position is selected", () => {
    const state = opening();
    const before = structuredClone(state);
    expect(canSwapKqHeritageHandCard(state)).toMatchObject({ allowed: true });
    expect(canSwapKqHeritageHandCard(state, 9, 2)).toMatchObject({ allowed: true });
    expect(state).toEqual(before);
  });

  it("recognizes a producer Heritage by its effect rather than its card code", () => {
    const state = startKqGame(44, {
      deckCodes: supportCodes,
      heritageCard: {
        code: "HERITAGE-900", name: "Réserve du producteur", timing: "once-per-run",
        effect: "opening-hand-reserve", description: "Compose une main dans la réserve de départ.",
      },
    });
    expect(canSwapKqHeritageHandCard(state, 9, 2).allowed).toBe(true);
    expect(swapKqHeritageHandCard(state, 9, 2).effectNotices?.at(-1)).toContain("Réserve du producteur");
  });

  it.each<Partial<KqGameState>>([
    { heritageCode: undefined, heritageEffect: undefined },
    { heritageEffect: "two-extra-redraws" },
    { stageIndex: 1 },
    { phase: "rolled" },
    { phase: "resolved" },
    { phase: "complete" },
    { heritageUsed: true },
    { preparationPlayed: true },
    { handCodes: [] },
    { heritageReserveCodes: [] },
    { heritageReserveCodes: undefined },
  ])("rejects a closed or missing reserve: %j", changes => {
    const state = { ...opening(), ...changes };
    expect(canSwapKqHeritageHandCard(state).allowed).toBe(false);
    expect(canSwapKqHeritageHandCard(state).reason.length).toBeGreaterThan(0);
    expect(canSwapKqHeritageHandCard(state, 0, 0).allowed).toBe(false);
    expect(swapKqHeritageHandCard(state, 0, 0)).toBe(state);
  });

  it.each<[number | undefined, number | undefined]>([
    [0, undefined], [undefined, 0], [-1, 0], [0, -1], [10, 0], [0, 3],
    [1.5, 0], [0, 1.5], [Number.NaN, 0], [0, Number.POSITIVE_INFINITY],
  ])("requires two valid positions when a selection is supplied: %s / %s", (handIndex, reserveIndex) => {
    const state = opening();
    expect(canSwapKqHeritageHandCard(state, handIndex, reserveIndex).allowed).toBe(false);
    expect(swapKqHeritageHandCard(state, handIndex as number, reserveIndex as number)).toBe(state);
  });

  it("keeps the mutation unavailable when both required positions are missing", () => {
    const state = opening();
    expect(swapKqHeritageHandCard(state, undefined as unknown as number, undefined as unknown as number)).toBe(state);
  });

  it("does not require XP or a currently playable incoming card to arrange the hand", () => {
    const state = { ...opening(), xp: 0 };
    expect(canSwapKqHeritageHandCard(state, 0, 0).allowed).toBe(true);
    const swapped = swapKqHeritageHandCard(state, 0, 0);
    expect(swapped.handCodes?.[0]).toBe(state.heritageReserveCodes?.[0]);
    expect(swapped.xp).toBe(0);
  });
});

describe("hand adjustment costs and copies", () => {
  it("can exchange repeatedly without burning copies, spending XP or using a redraw", () => {
    const original = opening();
    const before = structuredClone(original);
    let state = original;
    for (const [handIndex, reserveIndex] of [[9, 2], [4, 0], [0, 1], [9, 0], [3, 2]]) {
      const outgoing = getKqHandCodes(state)[handIndex];
      const incoming = state.heritageReserveCodes![reserveIndex];
      state = swapKqHeritageHandCard(state, handIndex, reserveIndex);
      expect(state.handCodes?.[handIndex]).toBe(incoming);
      expect(state.heritageReserveCodes?.[reserveIndex]).toBe(outgoing);
      expect(physicalCopies(state)).toEqual(physicalCopies(original));
      expect(state.handCodes).toHaveLength(10);
      expect(state.heritageReserveCodes).toHaveLength(3);
      expect(state.deckCodes).toEqual(original.deckCodes);
      expect(state.collectionCodes).toEqual(original.collectionCodes);
      expect(state.usedCards).toEqual(original.usedCards);
      expect(state.playedThisStage).toEqual(original.playedThisStage);
      expect(state.xp).toBe(original.xp);
      expect(state.handRedrawsUsed).toBe(original.handRedrawsUsed);
      expect(state.heritageUsed).toBe(false);
    }
    expect(original).toEqual(before);
  });

  it("retains identical physical copies and permits swapping matching card codes", () => {
    const state = startKqGame(44, { deckCodes: Array(13).fill("BOTTE-005"), heritageCode: "HERITAGE-003" });
    expect(canSwapKqHeritageHandCard(state, 9, 2).allowed).toBe(true);
    const swapped = swapKqHeritageHandCard(state, 9, 2);
    expect(swapped).not.toBe(state);
    expect(swapped.handCodes).toEqual(state.handCodes);
    expect(swapped.heritageReserveCodes).toEqual(state.heritageReserveCodes);
    expect(physicalCopies(swapped)).toHaveLength(13);
    expect(swapped.usedCards).toEqual([]);
    expect(swapped.xp).toBe(state.xp);
  });

  it("returns both arrays to their initial arrangement when the same positions are exchanged twice", () => {
    const state = opening();
    const restored = swapKqHeritageHandCard(swapKqHeritageHandCard(state, 9, 2), 9, 2);
    expect(restored.handCodes).toEqual(state.handCodes);
    expect(restored.heritageReserveCodes).toEqual(state.heritageReserveCodes);
    expect(restored.handRedrawsUsed).toBe(0);
  });

  it("closes the reserve on the first roll and never reopens it at the next stage", () => {
    const state = swapKqHeritageHandCard(opening(), 0, 0);
    const rolled = rollKqDice(state);
    expect(rolled.heritageReserveCodes).toBeUndefined();
    expect(rolled.heritageUsed).toBe(true);
    expect(rolled.handCodes).toEqual(state.handCodes);
    expect(canSwapKqHeritageHandCard(rolled).allowed).toBe(false);
    expect(canSwapKqHeritageHandCard(nextStage(state)).allowed).toBe(false);
  });

  it("ends reserve selection when redrawing without burning its cards or spending XP", () => {
    const state = opening();
    const redrawn = redrawKqHand(state);
    expect(redrawn.heritageReserveCodes).toBeUndefined();
    expect(canSwapKqHeritageHandCard(redrawn).allowed).toBe(false);
    expect(redrawn.handCodes).toHaveLength(10);
    expect(redrawn.handCodes?.every(code => state.deckCodes.includes(code))).toBe(true);
    expect(redrawn.xp).toBe(state.xp);
    expect(redrawn.usedCards).toEqual(state.usedCards);
    expect(redrawn.deckCodes).toEqual(state.deckCodes);
    expect(redrawn.collectionCodes).toEqual(state.collectionCodes);
    expect(redrawn.handRedrawsUsed).toBe(1);
  });

  it("preserves the reserve and its allowance when the remaining copies cannot produce a different hand", () => {
    const state = startKqGame(44, { deckCodes: Array(13).fill("BOTTE-005"), heritageCode: "HERITAGE-003" });
    expect(canRedrawKqHand(state)).toMatchObject({ allowed: false, remaining: 1 });
    expect(redrawKqHand(state)).toBe(state);
    expect(canSwapKqHeritageHandCard(state).allowed).toBe(true);
  });

  it("keeps the single redraw quota spent across subsequent stages", () => {
    const redrawn = redrawKqHand(opening());
    const advanced = nextStage(redrawn);
    expect(advanced.stageIndex).toBe(1);
    expect(canRedrawKqHand(advanced)).toMatchObject({ allowed: false, remaining: 0 });
    expect(redrawKqHand(advanced)).toBe(advanced);
  });

  it("allows the three Second regard redraws to be spread across stages", () => {
    let state = startKqGame(44, { deckCodes: supportCodes, heritageCode: "HERITAGE-005" });
    for (let used = 1; used <= 3; used++) {
      expect(canRedrawKqHand(state)).toMatchObject({ allowed: true, remaining: 4 - used });
      state = redrawKqHand(state);
      expect(state.handRedrawsUsed).toBe(used);
      state = nextStage(state);
    }
    expect(canRedrawKqHand(state)).toMatchObject({ allowed: false, remaining: 0 });
    expect(redrawKqHand(state)).toBe(state);
  });
});
