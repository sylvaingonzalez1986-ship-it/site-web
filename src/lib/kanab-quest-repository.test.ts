import { describe, expect, it } from "vitest";
import { createKqOpponent, createKqFlower, lockKqBattle, resolveKqBattle } from "@/lib/kanab-quest-battle";
import { advanceKqStage, resolveKqStage, rollKqDice, startKqGame, type KqGameState } from "@/lib/kanab-quest-game";
import { createLocalKqRepository, KQ_LOCAL_KEYS } from "@/lib/kanab-quest-repository";
import { createKqRankProfile } from "@/lib/kanab-quest-ranking";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    values,
  };
}

function completedGame() {
  let game: KqGameState = startKqGame(72);
  while (game.phase !== "complete") {
    if (game.phase === "prepare") game = rollKqDice(game);
    if (game.phase === "rolled") game = resolveKqStage(game);
    if (game.phase === "resolved") game = advanceKqStage(game);
  }
  return game;
}

describe("Kanab Quest local repository", () => {
  it("round-trips the complete local session", async () => {
    const storage = memoryStorage();
    const repository = createLocalKqRepository(storage);
    const game = completedGame();
    const battle = lockKqBattle(createKqFlower(game), createKqOpponent(72), 72);
    const ranking = createKqRankProfile();
    await repository.saveGame(game);
    await repository.saveBattle(battle);
    await repository.saveRanking(ranking);
    expect(await repository.loadSession()).toEqual({ game, battle, battleHistory: [], ranking, inventory: null, burnHistory: [], favoriteDeck: null, onboardingSeen: false });
  });

  it("removes only the active battle receipt when requested", async () => {
    const storage = memoryStorage();
    const repository = createLocalKqRepository(storage);
    await repository.saveGame(startKqGame(1));
    await repository.saveBattle(null);
    expect(storage.values.has(KQ_LOCAL_KEYS.game)).toBe(true);
    expect(storage.values.has(KQ_LOCAL_KEYS.battle)).toBe(false);
  });

  it("ignores corrupted records without losing valid ones", async () => {
    const storage = memoryStorage();
    storage.setItem(KQ_LOCAL_KEYS.game, "broken");
    const repository = createLocalKqRepository(storage);
    const ranking = createKqRankProfile();
    await repository.saveRanking(ranking);
    expect(await repository.loadSession()).toEqual({ game: null, battle: null, battleHistory: [], ranking, inventory: null, burnHistory: [], favoriteDeck: null, onboardingSeen: false });
  });

  it("persists remaining collectible copies, including zero", async () => {
    const storage = memoryStorage();
    const repository = createLocalKqRepository(storage);
    await repository.saveInventory({ "BOTTE-001": 2, "BOTTE-004": 0 });
    expect((await repository.loadSession()).inventory).toEqual({ "BOTTE-001": 2, "BOTTE-004": 0 });
  });

  it("persists and removes a validated favorite deck", async () => {
    const storage = memoryStorage();
    const repository = createLocalKqRepository(storage);
    const favorite = { buddieCode: "HH2026-005", substrateCode: "BOTTE-001", supportCodes: ["BOTTE-003", "BOTTE-003", "BOTTE-004"] };
    await repository.saveFavoriteDeck(favorite);
    expect((await repository.loadSession()).favoriteDeck).toEqual(favorite);
    await repository.saveFavoriteDeck(null);
    expect((await repository.loadSession()).favoriteDeck).toBeNull();
  });

  it("ignores a favorite deck containing a PBI", async () => {
    const storage = memoryStorage();
    storage.setItem(KQ_LOCAL_KEYS.favoriteDeck, JSON.stringify({ buddieCode: "HH2026-005", substrateCode: "BOTTE-001", supportCodes: ["BOTTE-002"] }));
    expect((await createLocalKqRepository(storage).loadSession()).favoriteDeck).toBeNull();
  });

  it("persists the onboarding preference independently", async () => {
    const storage = memoryStorage();
    const repository = createLocalKqRepository(storage);
    await repository.saveOnboardingSeen(true);
    expect((await repository.loadSession()).onboardingSeen).toBe(true);
    await repository.saveOnboardingSeen(false);
    expect((await repository.loadSession()).onboardingSeen).toBe(false);
  });

  it("recovers a burn transaction from its journal", async () => {
    const storage = memoryStorage();
    const repository = createLocalKqRepository(storage);
    const game = startKqGame(5);
    const inventory = { "BOTTE-001": 0, "BOTTE-004": 2 };
    const receipt = { id: "burn-1", cardCode: "BOTTE-001", runSeed: 5, stageIndex: 0, useKind: "substrate", burnedAt: new Date(0).toISOString() } as const;
    storage.setItem(KQ_LOCAL_KEYS.burnJournal, JSON.stringify({ game: JSON.parse(JSON.stringify({ version: 1, payload: game })), inventory, receipt }));
    expect(await repository.loadSession()).toMatchObject({ game, inventory });
    expect(storage.values.has(KQ_LOCAL_KEYS.burnJournal)).toBe(false);
    expect((await repository.loadSession()).inventory).toEqual(inventory);
    expect((await repository.loadSession()).burnHistory).toEqual([receipt]);
  });

  it("keeps burned battle receipts after the active battle is cleared", async () => {
    const storage = memoryStorage();
    const repository = createLocalKqRepository(storage);
    const game = completedGame();
    const verdict = resolveKqBattle(lockKqBattle(createKqFlower(game), createKqOpponent(9), 9), 9);
    await repository.saveBattle(verdict);
    await repository.saveBattle(null);
    const session = await repository.loadSession();
    expect(session.battle).toBeNull();
    expect(session.battleHistory.map((battle) => battle.id)).toEqual([verdict.id]);
  });

  it("persists a verdict, its receipt and ranking as one logical transaction", async () => {
    const storage = memoryStorage();
    const repository = createLocalKqRepository(storage);
    const game = completedGame();
    const verdict = resolveKqBattle(lockKqBattle(createKqFlower(game), createKqOpponent(18), 18), 18);
    const ranking = { ...createKqRankProfile(), wins: 1, processedBattleIds: [verdict.id] };
    await repository.saveVerdictTransaction(verdict, ranking);
    expect(await repository.loadSession()).toMatchObject({ battle: verdict, ranking, battleHistory: [verdict] });
    expect(storage.values.has(KQ_LOCAL_KEYS.verdictJournal)).toBe(false);
  });

  it("recovers streak-booster inventory from an interrupted verdict transaction", async () => {
    const storage = memoryStorage();
    const repository = createLocalKqRepository(storage);
    const game = completedGame();
    const verdict = resolveKqBattle(lockKqBattle(createKqFlower(game), createKqOpponent(27), 27), 27);
    const ranking = { ...createKqRankProfile(), wins: 3, streak: 3, processedBattleIds: [verdict.id], claimedArenaRewardKeys: ["streak-3-3"], lastArenaRewardCards: ["BOTTE-001", "BOTTE-002", "BOTTE-003"] };
    const inventory = { "BOTTE-001": 2, "BOTTE-002": 1, "BOTTE-003": 1 };
    storage.setItem(KQ_LOCAL_KEYS.verdictJournal, JSON.stringify({
      battle: { version: 1, payload: verdict },
      ranking: { version: 1, payload: ranking },
      inventory,
    }));
    const recovered = await repository.loadSession();
    expect(recovered).toMatchObject({ battle: verdict, ranking, inventory });
    expect(storage.values.has(KQ_LOCAL_KEYS.verdictJournal)).toBe(false);
    expect((await repository.loadSession()).inventory).toEqual(inventory);
  });
});
