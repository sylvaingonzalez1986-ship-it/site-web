import { describe, expect, it } from "vitest";
import { KQ_CARDS, KQ_RETIRED_SUBSTRATE_CODES, advanceKqStage, getKqCultureSystemSummary, resolveKqStage, rollKqDice, startKqGame } from "@/lib/kanab-quest-game";
import { encodeKqSave, parseKqGameSave } from "@/lib/kanab-quest-persistence";
import { buildKqCollectionDeck, sanitizeKqDeckSelection } from "@/lib/kanab-quest-economy";
import { createLocalKqRepository, KQ_LOCAL_KEYS } from "@/lib/kanab-quest-repository";

describe("Living soil as the common indoor environment", () => {
  it("finishes all six stages with no card or startup burn", () => {
    let state = startKqGame(730, { deckCodes: [], collectionCodes: [] });
    while (state.phase !== "complete") {
      state = advanceKqStage(resolveKqStage(rollKqDice(state)));
      expect(state.usedCards).toEqual([]);
      expect(state.deckCodes).toEqual([]);
      expect(parseKqGameSave(encodeKqSave(state))).toEqual(state);
    }
    expect(state.history).toHaveLength(6);
    expect(getKqCultureSystemSummary(state.deckCodes).name).toBe("Sol vivant");
  });

  it.each(KQ_RETIRED_SUBSTRATE_CODES)("restores a legacy %s save without losing progress or support copies", (code) => {
    const base = resolveKqStage(rollKqDice(startKqGame(731, { deckCodes: ["BOTTE-017", "BOTTE-017"] })));
    const legacy = { ...base, deckCodes: [code, ...base.deckCodes], usedCards: [code], playedThisStage: [code], collectionCodes: [code, ...base.collectionCodes] };
    const restored = parseKqGameSave(encodeKqSave(legacy));
    expect(restored).not.toBeNull();
    expect(restored?.history).toEqual(base.history);
    expect(restored?.quality).toBe(base.quality);
    expect(restored?.deckCodes).toEqual(["BOTTE-017", "BOTTE-017"]);
    expect(restored?.usedCards).toEqual([]);
    expect(restored?.playedThisStage).toEqual([]);
    expect(restored?.collectionCodes).not.toContain(code);
    expect(advanceKqStage(restored!).stageIndex).toBe(1);
  });

  it("excludes retired inventory from all deck-building paths", () => {
    const inventory = Object.fromEntries([...KQ_RETIRED_SUBSTRATE_CODES, "BOTTE-017"].map((code) => [code, 2]));
    expect(KQ_CARDS.some((card) => card.category === "substrate")).toBe(false);
    expect(buildKqCollectionDeck(inventory, "all-copies")).toEqual(["BOTTE-017", "BOTTE-017"]);
    expect(sanitizeKqDeckSelection([...KQ_RETIRED_SUBSTRATE_CODES, "BOTTE-017"], inventory)).toEqual(["BOTTE-017"]);
  });

  it("restores an old favorite without its retired culture choice", async () => {
    const data = new Map<string, string>();
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
    storage.setItem(KQ_LOCAL_KEYS.favoriteDeck, JSON.stringify({ buddieCode: "HH2026-005", substrateCode: "BOTTE-008", supportCodes: ["BOTTE-017", "BOTTE-017"] }));
    expect((await createLocalKqRepository(storage).loadSession()).favoriteDeck).toEqual({ buddieCode: "HH2026-005", supportCodes: ["BOTTE-017", "BOTTE-017"] });
  });
});
