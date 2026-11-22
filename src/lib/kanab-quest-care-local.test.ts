import { describe, expect, it, vi } from "vitest";
import { buyKqLocalCare, loadKqLocalCare, getKqLocalCareSnapshot, recoverKqLocalCare, applyKqLocalCare } from "./kanab-quest-care-local";
import { advanceKqStage, resolveKqStage, startKqGame } from "./kanab-quest-game";
import { createKqCareState, KQ_BASIC_CARE_PRICE_CENTS, KQ_CARE_PRODUCTS, type KqCareProblem } from "./kanab-quest-care";
import { encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";
import { createLocalKqRepository } from "./kanab-quest-repository";
import { KQ_STARTING_CASH_CENTS } from "./kanab-quest-equipment";
import supplies from "./kanab-quest-warehouse-retail-supplies.json";
import { createKqWarehouseStarter, getKqWarehouseQuote, getKqWarehouseRunSnapshot } from "./kanab-quest-warehouse";

function memory() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
const problem = (code: string): KqCareProblem => ({ code, severity: 2, status: "confirmed", trend: "stable", appearedAt: 0, variant: 0 });
describe("local care transactions", () => {
  it.each(["CARE-APHIDIUS", "CARE-VERMICOMPOST", "CARE-ORGANIC-FEED", "CARE-COMPOST-TEA", "CARE-SEAWEED"])("keeps %s coverage per square metre, opens an old passage only when needed and replays on its original cell", code => {
    const storage = memory();
    const starter = createKqWarehouseStarter();
    const plan = getKqWarehouseQuote({ ...starter, zones: [{ ...starter.zones[0], width: 3 }] }, starter).nextState;
    const game = startKqGame(31, { warehouse: getKqWarehouseRunSnapshot(plan) });
    const first = { zoneId: "starter", x: 0, y: 0 }, second = { ...first, x: 1 };
    game.care!.problems = [{ ...problem("APHIDS"), plants: [first, second].map(target => ({ ...target, slot: 0, severity: 2 })) }];
    storage.setItem("kanab-quest-care-simulation-v1", JSON.stringify({ cashCents: 8000, inventory: { [code]: 1 }, areaInventory: { [code]: 1 } }));
    const row = () => getKqLocalCareSnapshot(storage, game).inventory.find(item => item.productCode === code);
    expect(row()).toMatchObject({ quantity: 4, legacyQuantity: 1, areaQuantity: 1 });
    expect(() => applyKqLocalCare(storage, game, code)).toThrow();
    expect(() => applyKqLocalCare(storage, game, code, { ...first, x: 3 })).toThrow();
    expect(row()?.quantity).toBe(4);
    const interrupted = { ...storage, setItem(key: string, value: string) {
      if (key === "kanab-quest-care-simulation-v1") throw new Error("disk full");
      storage.setItem(key, value);
    } };
    expect(() => applyKqLocalCare(interrupted, game, code, first)).toThrow("disk full");
    const afterFirst = applyKqLocalCare(storage, game, code, first);
    expect(row()).toMatchObject({ quantity: 3, legacyQuantity: 1, areaQuantity: 0 });
    expect(() => applyKqLocalCare(storage, game, code, second)).toThrow("suivi local a changé");
    const afterSecond = applyKqLocalCare(storage, afterFirst, code, second);
    expect(afterSecond.care?.applications.map(item => item.target)).toEqual([first, second]);
    expect(row()).toMatchObject({ quantity: 2, legacyQuantity: 0, areaQuantity: 2 });
    expect(applyKqLocalCare(storage, game, code, first)).toEqual(afterSecond);
    expect(() => applyKqLocalCare(storage, afterSecond, code, second)).toThrow();
    expect(parseKqGameSave(storage.getItem("kanab-quest-dice-prototype-v7"))).toEqual(afterSecond);
    expect(loadKqLocalCare(storage).cashCents).toBe(8000);
    expect(row()?.quantity).toBe(2);
  });
  it("rejects using a small new reserve over a larger culture, while preserving old complete charges", () => {
    const storage = memory();
    const large = startKqGame(101, { productionUnits: 3, equipmentCodes: ["TENT-080-STARTER"] });
    large.care!.problems = [problem("HEAT")];
    buyKqLocalCare(storage, "CARE-SEAWEED");
    expect(getKqLocalCareSnapshot(storage, large).inventory.find(item => item.productCode === "CARE-SEAWEED")?.quantity).toBe(0);
    expect(() => applyKqLocalCare(storage, large, "CARE-SEAWEED")).toThrow("surface cultivée");
    expect(loadKqLocalCare(storage).areaInventory?.["CARE-SEAWEED"]).toBe(1);
    const legacy = memory();
    legacy.setItem("kanab-quest-care-simulation-v1", JSON.stringify({ cashCents: 5000, inventory: { "CARE-SEAWEED": 1 } }));
    applyKqLocalCare(legacy, large, "CARE-SEAWEED");
    expect(loadKqLocalCare(legacy)).toEqual({ cashCents: 5000, inventory: { "CARE-SEAWEED": 0 } });
  });
  it("buys enough coverage for one full passage and scales basic care with the frozen culture", () => {
    const storage = memory();
    const large = startKqGame(101, { productionUnits: 3, equipmentCodes: ["TENT-080-STARTER"] });
    buyKqLocalCare(storage, "CARE-SEAWEED", large);
    const quote = getKqLocalCareSnapshot(storage, large);
    const passage = 3 * supplies["CARE-SEAWEED"].unitPriceCents;
    expect(quote.catalog.find(item => item.code === "CARE-SEAWEED")?.priceCents).toBe(passage);
    expect(quote.inventory.find(item => item.productCode === "CARE-SEAWEED")?.quantity).toBe(1);
    expect(quote.areaM2).toBeNull();
    applyKqLocalCare(storage, large);
    expect(loadKqLocalCare(storage).cashCents).toBe(KQ_STARTING_CASH_CENTS - passage - 3 * KQ_BASIC_CARE_PRICE_CENTS);
  });
  it("starts with empty stock, charges purchases, consumes once and persists the same state", async () => {
    const storage = memory();
    expect(loadKqLocalCare(storage)).toEqual({ cashCents: 200_000, inventory: {} });
    buyKqLocalCare(storage, "CARE-SEAWEED");
    expect(loadKqLocalCare(storage).cashCents).toBe(KQ_STARTING_CASH_CENTS - supplies["CARE-SEAWEED"].unitPriceCents);
    const game = applyKqLocalCare(storage, startKqGame(101), "CARE-SEAWEED");
    expect(loadKqLocalCare(storage).areaInventory?.["CARE-SEAWEED"]).toBe(0);
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
    expect(loadKqLocalCare(storage).areaInventory?.["CARE-SEAWEED"]).toBe(0);
    expect(parseKqGameSave(storage.getItem("kanab-quest-dice-prototype-v7"))?.care?.applications).toHaveLength(1);
  });
  it("rejects the wrong auxiliary before consuming its stock and charges basic care separately", () => {
    const storage = memory();
    buyKqLocalCare(storage, "CARE-PHYTOSEIULUS");
    const game = startKqGame(101);
    game.care!.problems = [{ code: "APHIDS", severity: 1, status: "confirmed", trend: "stable", appearedAt: 0, variant: 0 }];
    expect(() => applyKqLocalCare(storage, game, "CARE-PHYTOSEIULUS")).toThrow();
    expect(loadKqLocalCare(storage).areaInventory?.["CARE-PHYTOSEIULUS"]).toBe(1);
    expect(applyKqLocalCare(storage, game).care?.lastBasicCareStage).toBe(0);
    expect(loadKqLocalCare(storage).cashCents).toBe(KQ_STARTING_CASH_CENTS - supplies["CARE-PHYTOSEIULUS"].unitPriceCents - KQ_BASIC_CARE_PRICE_CENTS);
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
    expect(loadKqLocalCare(storage).cashCents).toBe(KQ_STARTING_CASH_CENTS - 2 * KQ_BASIC_CARE_PRICE_CENTS);
    const next = advanceKqStage(prepared);
    expect(next.stageIndex).toBe(1);
    expect(() => applyKqLocalCare(storage, next)).toThrow("déjà activé");
    expect(loadKqLocalCare(storage).cashCents).toBe(KQ_STARTING_CASH_CENTS - 2 * KQ_BASIC_CARE_PRICE_CENTS);
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
    expect(loadKqLocalCare(storage).cashCents).toBe(KQ_STARTING_CASH_CENTS - KQ_BASIC_CARE_PRICE_CENTS);
    expect(applyKqLocalCare(storage, game)).toEqual(recovered);
    recoverKqLocalCare(storage);
    expect(loadKqLocalCare(storage).cashCents).toBe(KQ_STARTING_CASH_CENTS - KQ_BASIC_CARE_PRICE_CENTS);
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
    expect(loadKqLocalCare(storage).cashCents).toBe(KQ_STARTING_CASH_CENTS - 2 * KQ_BASIC_CARE_PRICE_CENTS);
  });
  it.each(KQ_CARE_PRODUCTS.filter(product => product.kind === "pbi"))("buys and consumes exactly one $name charge, even after a retry", async product => {
    const storage = memory();
    buyKqLocalCare(storage, product.code);
    buyKqLocalCare(storage, product.code);
    const game = startKqGame(31);
    game.care!.problems = [problem(product.targets[0].toUpperCase())];
    const applied = applyKqLocalCare(storage, game, product.code);
    expect(loadKqLocalCare(storage)).toEqual({ cashCents: KQ_STARTING_CASH_CENTS - 2 * product.priceCents, inventory: {}, areaInventory: { [product.code]: 1 } });
    expect((await createLocalKqRepository(storage).loadSession()).game).toEqual(applied);
    expect(() => applyKqLocalCare(storage, applied, product.code)).toThrow();
    expect(loadKqLocalCare(storage).areaInventory?.[product.code]).toBe(1);
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
