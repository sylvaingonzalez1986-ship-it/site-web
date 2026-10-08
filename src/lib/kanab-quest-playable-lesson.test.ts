import { describe, expect, it, vi } from "vitest";
import { createKqFlower, createKqOpponent, lockKqBattle, resolveKqBattle } from "./kanab-quest-battle";
import { advanceKqStage, isKqCultureDead, KQ_BUDDIES, resolveKqStage, rollKqDice } from "./kanab-quest-game";
import { encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";
import { createLocalKqRepository, KQ_LOCAL_KEYS } from "./kanab-quest-repository";
import { createKqLessonStorage, createKqPlayableLesson, assistKqPlayableLesson, getKqPlayableLessonProgress, kqPlayableLessonPrefix, KQ_PLAYABLE_ASSISTANCE_NOTICE } from "./kanab-quest-playable-lesson";

function memoryStorage() {
  const map = new Map<string, string>();
  return { map, getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); }, removeItem: (key: string) => { map.delete(key); } };
}
const lesson = (id: "cards" | "culture" | "jury") => createKqPlayableLesson(id, createKqLessonStorage("test", id), vi.fn());

describe("real game screens in isolated playable lessons", () => {
  it("gives valid prerequisites without crediting the selected exercise", () => {
    for (const id of ["cards", "culture", "jury"] as const) {
      const port = lesson(id);
      expect(parseKqGameSave(encodeKqSave(port.initialGame))).toEqual(port.initialGame);
      expect(getKqPlayableLessonProgress(id, { game: port.initialGame, battle: null, setupOpen: port.setupOpen, revealedRounds: 0 }).complete).toBe(false);
    }
    expect(lesson("cards").setupOpen).toBe(true);
    expect(lesson("culture").initialGame.history).toHaveLength(0);
    expect(lesson("jury").initialGame.history).toHaveLength(6);
  });

  it("starts the selected Buddie, cards, Heritage and energy through the actual engine", () => {
    const game = lesson("cards").startGame({ varietyCode: KQ_BUDDIES[1].code, deckCodes: ["BOTTE-003"], heritageCode: "HERITAGE-007", energyMode: "eco", firstCultureRescue: true });
    expect(game.varietyCode).toBe(KQ_BUDDIES[1].code);
    expect(game.deckCodes).toEqual(["BOTTE-003"]);
    expect(game.heritageCode).toBe("HERITAGE-007");
    expect(game.energy?.mode).toBe("eco");
    expect(game.firstCultureRescue).toBeUndefined();
    expect(game.startedAt).toBe("2026-09-16T12:00:00.000Z");
    expect(parseKqGameSave(encodeKqSave(game))).toEqual(game);
  });

  it("keeps saves, journals and preferences apart from account and earlier tutorials", async () => {
    const backing = memoryStorage();
    backing.setItem(KQ_LOCAL_KEYS.game, "official snapshot");
    backing.setItem("kq-workshop-v1:test:culture", "old workshop");
    const storage = createKqLessonStorage("test", "culture", backing);
    const port = createKqPlayableLesson("culture", storage, vi.fn());
    const played = assistKqPlayableLesson(rollKqDice(port.initialGame));
    await port.repository.saveGame(played);
    storage.setItem("kq-dice-direct-result", "1");
    storage.setItem("setup-open", "0");
    expect(backing.getItem(KQ_LOCAL_KEYS.game)).toBe("official snapshot");
    expect(backing.getItem("kq-workshop-v1:test:culture")).toBe("old workshop");
    expect(backing.getItem("kq-dice-direct-result")).toBeNull();
    const resumed = createLocalKqRepository(createKqLessonStorage("test", "culture", backing));
    expect((await resumed.loadSession()).game).toEqual(played);
    expect((await createLocalKqRepository(createKqLessonStorage("test", "jury", backing)).loadSession()).game).toBeNull();
    expect((await createLocalKqRepository(createKqLessonStorage("other", "culture", backing)).loadSession()).game).toBeNull();
    expect([...backing.map.keys()].filter(key => key.startsWith(kqPlayableLessonPrefix("test", "culture")))).toHaveLength(3);
  });

  it("continues in memory when browser storage is unavailable", async () => {
    const blocked = () => { throw new Error("Storage blocked"); };
    const storage = createKqLessonStorage("private", "culture", { getItem: blocked, setItem: blocked, removeItem: blocked });
    const port = createKqPlayableLesson("culture", storage, vi.fn());
    await port.repository.saveGame(port.initialGame);
    expect((await port.repository.loadSession()).game).toEqual(port.initialGame);
    storage.removeItem(KQ_LOCAL_KEYS.game);
    expect((await port.repository.loadSession()).game).toBeNull();
  });

  it("leaves the first zero untouched then visibly assists only a fatal second zero", () => {
    const initial = lesson("culture").initialGame;
    const zero = { ...rollKqDice(initial), dice: [1, 2, 3] as [number, number, number], bonusDie: null };
    expect(assistKqPlayableLesson(zero)).toBe(zero);
    const first = advanceKqStage(resolveKqStage(zero));
    const second = { ...rollKqDice(first), dice: [1, 2, 3] as [number, number, number], bonusDie: null };
    const assisted = assistKqPlayableLesson(second);
    expect(assisted.dice).toEqual([1, 2, 4]);
    expect(second.dice).toEqual([1, 2, 3]);
    expect(assisted.effectNotices).toContain(KQ_PLAYABLE_ASSISTANCE_NOTICE);
    expect(isKqCultureDead(resolveKqStage(second))).toBe(true);
    expect(isKqCultureDead(resolveKqStage(assisted))).toBe(false);
    expect(assistKqPlayableLesson(assisted)).toBe(assisted);
    expect(assisted.quality).toBe(second.quality);
    expect(assisted.xp).toBe(second.xp);
  });

  it("lets the player perform all eighteen culture actions and earn the resulting harvest", () => {
    let game = lesson("culture").initialGame;
    for (let stage = 0; stage < 6; stage++) {
      expect(game.stageIndex).toBe(stage);
      expect(game.phase).toBe("prepare");
      game = assistKqPlayableLesson(rollKqDice(game));
      expect(game.phase).toBe("rolled");
      game = resolveKqStage(game);
      expect(isKqCultureDead(game)).toBe(false);
      game = advanceKqStage(game);
    }
    expect(game.phase).toBe("complete");
    expect(game.harvestGrams).toBeGreaterThan(0);
    expect(getKqPlayableLessonProgress("culture", { game, battle: null, setupOpen: false, revealedRounds: 0 }).complete).toBe(true);
    expect(parseKqGameSave(encodeKqSave(game))).toEqual(game);
  });

  it("requires a real duel verdict and all three visible rounds to complete jury", () => {
    const game = lesson("jury").initialGame;
    const battle = lockKqBattle(createKqFlower(game), createKqOpponent(3), game.seed);
    expect(getKqPlayableLessonProgress("jury", { game, battle, setupOpen: false, revealedRounds: 0 }).complete).toBe(false);
    const verdict = resolveKqBattle(battle, game.seed);
    for (const revealedRounds of [0, 1, 2]) {
      expect(getKqPlayableLessonProgress("jury", { game, battle: verdict, setupOpen: false, revealedRounds }).complete).toBe(false);
    }
    expect(getKqPlayableLessonProgress("jury", { game, battle: verdict, setupOpen: false, revealedRounds: 3 }).complete).toBe(true);
  });
});
