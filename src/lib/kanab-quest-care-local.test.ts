import { describe, expect, it, vi } from "vitest";
import { buyKqLocalCare, loadKqLocalCare, recoverKqLocalCare, applyKqLocalCare } from "./kanab-quest-care-local";
import { advanceKqStage, resolveKqStage, startKqGame } from "./kanab-quest-game";
import { createKqCareState, KQ_BASIC_CARE_PRICE_CENTS, KQ_CARE_PRODUCTS, type KqCareProblem } from "./kanab-quest-care";
import { encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";
import { createLocalKqRepository } from "./kanab-quest-repository";

function memory() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
const problem = (code: string): KqCareProblem => ({ code, severity: 2, status: "confirmed", trend: "stable", appearedAt: 0, variant: 0 });
describe("local care transactions", () => {
  it("starts with empty stock, charges purchases, consumes once and persists the same state", async () => {
    const storage = memory();
    expect(loadKqLocalCare(storage).inventory).toEqual({});
    buyKqLocalCare(storage, "CARE-SEAWEED");
    expect(loadKqLocalCare(storage).cashCents).toBe(33800);
    const game = applyKqLocalCare(storage, startKqGame(101), "CARE-SEAWEED");
    expect(loadKqLocalCare(storage).inventory["CARE-SEAWEED"]).toBe(0);
    expect((await createLocalKqRepository(storage).loadSession()).game).toEqual(game);
    expect(() => applyKqLocalCare(storage, game, "CARE-SEAWEED")).toThrow();
  });
  it("recovers an interrupted stock write without duplicating the care action", () => {
    const storage = memory();
    buyKqLocalCare(storage, "CARE-SEAWEED");
    let fail = true;
    const interrupted = { ...storage, setItem(key: string, value: string) { if (key === "kanab-quest-care-simulation-v1" && fail) { fail = false; throw new Error("disk full"); } storage.setItem(key, value); } };
    expect(() => applyKqLocalCare(interrupted, startKqGame(101), "CARE-SEAWEED")).toThrow("disk full");
    recoverKqLocalCare(storage);
    recoverKqLocalCare(storage);
    expect(loadKqLocalCare(storage).inventory["CARE-SEAWEED"]).toBe(0);
    expect(parseKqGameSave(storage.getItem("kanab-quest-dice-prototype-v7"))?.care?.applications).toHaveLength(1);
  });
  it("rejects the wrong auxiliary before consuming its stock and charges basic care separately", () => {
    const storage = memory();
    buyKqLocalCare(storage, "CARE-PHYTOSEIULUS");
    const game = startKqGame(101);
    game.care!.problems = [{ code: "APHIDS", severity: 1, status: "confirmed", trend: "stable", appearedAt: 0, variant: 0 }];
    expect(() => applyKqLocalCare(storage, game, "CARE-PHYTOSEIULUS")).toThrow();
    expect(loadKqLocalCare(storage).inventory["CARE-PHYTOSEIULUS"]).toBe(1);
    expect(applyKqLocalCare(storage, game).care?.lastBasicCareStage).toBe(0);
    expect(loadKqLocalCare(storage).cashCents).toBe(33600 - KQ_BASIC_CARE_PRICE_CENTS);
  });
  it("charges the exact basic-care price once and retains all stock", () => {
    const storage = memory();
    storage.setItem("kanab-quest-care-simulation-v1", JSON.stringify({ cashCents: KQ_BASIC_CARE_PRICE_CENTS, inventory: { "CARE-SEAWEED": 2 } }));
    const before = startKqGame(101);
    const after = applyKqLocalCare(storage, before);
    expect(loadKqLocalCare(storage)).toEqual({ cashCents: 0, inventory: { "CARE-SEAWEED": 2 } });
    expect(after.care!.lastBasicCareStage).toBe(0);
    expect(after.care!.vitality).toBe(before.care!.vitality);
    expect(after.care!.history.filter(event => event.kind === "intervention")).toHaveLength(1);
    expect(parseKqGameSave(storage.getItem("kanab-quest-dice-prototype-v7"))).toEqual(after);
    expect(() => applyKqLocalCare(storage, after)).toThrow("déjà activé");
    // An old React snapshot, unlike a second deliberate activation, is a retry.
    const writes = vi.spyOn(storage, "setItem");
    expect(applyKqLocalCare(storage, before)).toEqual(after);
    expect(writes).not.toHaveBeenCalled();
    expect(loadKqLocalCare(storage).cashCents).toBe(0);
  });
  it("rejects insufficient funds before changing the game, wallet or journal", () => {
    const storage = memory();
    const game = startKqGame(101);
    storage.setItem("kanab-quest-care-simulation-v1", JSON.stringify({ cashCents: KQ_BASIC_CARE_PRICE_CENTS - 1, inventory: {} }));
    storage.setItem("kanab-quest-dice-prototype-v7", encodeKqSave(game));
    const writes = vi.spyOn(storage, "setItem");
    expect(() => applyKqLocalCare(storage, game)).toThrow("insuffisante");
    expect(writes).not.toHaveBeenCalled();
    expect(parseKqGameSave(storage.getItem("kanab-quest-dice-prototype-v7"))).toEqual(game);
    expect(loadKqLocalCare(storage).cashCents).toBe(KQ_BASIC_CARE_PRICE_CENTS - 1);
    expect(storage.getItem("kanab-quest-care-journal-v1")).toBeNull();
  });
  it("charges again for the next operation, including care activated after the previous result", () => {
    const storage = memory();
    const first = applyKqLocalCare(storage, startKqGame(101));
    const result = resolveKqStage({ ...first, phase: "rolled", dice: [6, 6, 6] });
    expect(result.phase).toBe("resolved");
    const prepared = applyKqLocalCare(storage, result);
    expect(prepared.care!.lastBasicCareStage).toBe(1);
    expect(loadKqLocalCare(storage).cashCents).toBe(35000 - 2 * KQ_BASIC_CARE_PRICE_CENTS);
    const next = advanceKqStage(prepared);
    expect(next.stageIndex).toBe(1);
    expect(() => applyKqLocalCare(storage, next)).toThrow("déjà activé");
    expect(loadKqLocalCare(storage).cashCents).toBe(35000 - 2 * KQ_BASIC_CARE_PRICE_CENTS);
  });
  it.each(["journal", "game", "wallet", "cleanup"])("recovers a paid basic-care transaction interrupted at %s, without charging a retry", failure => {
    const storage = memory();
    const game = startKqGame(101);
    let fail = true;
    const interrupted = {
      ...storage,
      setItem(key: string, value: string) {
        if (fail && ((failure === "journal" && key === "kanab-quest-care-journal-v1")
          || (failure === "game" && key === "kanab-quest-dice-prototype-v7")
          || (failure === "wallet" && key === "kanab-quest-care-simulation-v1"))) {
          fail = false; throw new Error("disk full");
        }
        storage.setItem(key, value);
      },
      removeItem(key: string) {
        if (fail && failure === "cleanup" && key === "kanab-quest-care-journal-v1") {
          fail = false; throw new Error("disk full");
        }
        storage.removeItem(key);
      },
    };
    expect(() => applyKqLocalCare(interrupted, game)).toThrow("disk full");
    const recovered = applyKqLocalCare(storage, game);
    expect(recovered.care!.lastBasicCareStage).toBe(0);
    expect(recovered.care!.history.filter(event => event.kind === "intervention")).toHaveLength(1);
    expect(loadKqLocalCare(storage).cashCents).toBe(35000 - KQ_BASIC_CARE_PRICE_CENTS);
    expect(applyKqLocalCare(storage, game)).toEqual(recovered);
    recoverKqLocalCare(storage);
    expect(loadKqLocalCare(storage).cashCents).toBe(35000 - KQ_BASIC_CARE_PRICE_CENTS);
    expect(storage.getItem("kanab-quest-care-journal-v1")).toBeNull();
  });
  it("refuses another action from stale care without discarding a paid product", () => {
    const storage = memory();
    buyKqLocalCare(storage, "CARE-SEAWEED");
    const game = startKqGame(101);
    const current = applyKqLocalCare(storage, game, "CARE-SEAWEED");
    const wallet = loadKqLocalCare(storage);
    expect(() => applyKqLocalCare(storage, game)).toThrow("suivi local a changé");
    expect(loadKqLocalCare(storage)).toEqual(wallet);
    expect(parseKqGameSave(storage.getItem("kanab-quest-dice-prototype-v7"))).toEqual(current);
    expect(applyKqLocalCare(storage, game, "CARE-SEAWEED")).toEqual(current);
  });
  it("charges a new dated culture even when its seed is reused", () => {
    const storage = memory();
    applyKqLocalCare(storage, startKqGame(101, { startedAt: "2026-10-10T12:00:00.000Z" }));
    const next = applyKqLocalCare(storage, startKqGame(101, { startedAt: "2026-10-10T13:00:00.000Z" }));
    expect(next.startedAt).toBe("2026-10-10T13:00:00.000Z");
    expect(loadKqLocalCare(storage).cashCents).toBe(35000 - 2 * KQ_BASIC_CARE_PRICE_CENTS);
  });
  it.each(KQ_CARE_PRODUCTS.filter(product => product.kind === "pbi"))("buys and consumes exactly one $name charge, even after a retry", async product => {
    const storage = memory();
    buyKqLocalCare(storage, product.code);
    buyKqLocalCare(storage, product.code);
    const game = startKqGame(31);
    game.care!.problems = [problem(product.targets[0].toUpperCase())];
    const applied = applyKqLocalCare(storage, game, product.code);
    expect(loadKqLocalCare(storage)).toEqual({ cashCents: 35000 - 2 * product.priceCents, inventory: { [product.code]: 1 } });
    expect((await createLocalKqRepository(storage).loadSession()).game).toEqual(applied);
    expect(() => applyKqLocalCare(storage, applied, product.code)).toThrow();
    expect(loadKqLocalCare(storage).inventory[product.code]).toBe(1);
    expect(applied.care!.applications).toHaveLength(1);
  });
  it.each(["late", "heat"])("preserves stock, wallet and saved game when the auxiliary is refused for %s", reason => {
    const storage = memory();
    buyKqLocalCare(storage, "CARE-PHYTOSEIULUS");
    let game = startKqGame(31);
    if (reason === "late") {
      for (let stage = 0; stage < 4; stage++) game = advanceKqStage(resolveKqStage({ ...game, phase: "rolled", dice: [6, 6, 6] }));
    }
    game.care = createKqCareState();
    game.care.problems = [problem("MITES"), ...(reason === "heat" ? [problem("HEAT")] : [])];
    const original = JSON.stringify(game);
    const wallet = loadKqLocalCare(storage);
    const writes = vi.spyOn(storage, "setItem");
    expect(() => applyKqLocalCare(storage, game, "CARE-PHYTOSEIULUS")).toThrow();
    expect(writes).not.toHaveBeenCalled();
    expect(loadKqLocalCare(storage)).toEqual(wallet);
    expect(JSON.stringify(game)).toBe(original);
    expect(storage.getItem("kanab-quest-dice-prototype-v7")).toBeNull();
  });
});
