import { describe, expect, it } from "vitest";
import { canApplyKqCareProduct, createKqCareState, KQ_CARE_PRODUCTS, type KqCareProblem } from "./kanab-quest-care";
import { startKqGame, type KqGameState } from "./kanab-quest-game";
import { getKqCareActionAvailability, getKqCareAvailabilityScope, getKqCareReserveProducts, parseKqCareReserveSnapshot } from "./kanab-quest-care-reserve";
import { getKqLocalCareSnapshot, type KqCareStorage } from "./kanab-quest-care-local";

function withProblems(...codes: string[]): KqGameState {
  const problems: KqCareProblem[] = codes.map(code => ({ code, severity: 2, status: "confirmed", trend: "stable", appearedAt: 0, variant: 0 }));
  return { ...startKqGame(12), care: { ...createKqCareState(), problems } };
}

describe("care products for observed problems", () => {
  it("returns no targeted products for an absent or healthy culture", () => {
    expect(getKqCareReserveProducts()).toEqual([]);
    expect(getKqCareReserveProducts(withProblems())).toEqual([]);
    expect(getKqCareReserveProducts({ ...withProblems(), care: undefined })).toEqual([]);
    expect(canApplyKqCareProduct(withProblems(), "CARE-SEAWEED").allowed).toBe(true);
  });

  it("retains a matching product even when heat prevents its use", () => {
    const state = withProblems("MITES", "HEAT");
    expect(canApplyKqCareProduct(state, "CARE-PHYTOSEIULUS").allowed).toBe(false);
    expect(getKqCareReserveProducts(state).map(row => ({ code: row.product.code, problems: row.problemLabels }))).toEqual([
      { code: "CARE-SEAWEED", problems: ["Stress thermique"] },
      { code: "CARE-PHYTOSEIULUS", problems: ["Foyer de tétranyques"] },
    ]);
  });

  it("deduplicates products and names across problems while preserving catalogue order", () => {
    const state = withProblems("THRIPS", "APHIDS", "APHIDS");
    const before = structuredClone(state);
    const rows = getKqCareReserveProducts(state);
    expect(rows.map(row => row.product.code)).toEqual([
      "CARE-APHIDIUS", "CARE-SWIRSKII", "CARE-ORIUS", "CARE-CHRYSOPERLA", "CARE-COCCINELLA",
    ]);
    expect(rows.find(row => row.product.code === "CARE-CHRYSOPERLA")?.problemLabels).toEqual(["Foyer de thrips", "Foyer de pucerons"]);
    expect(state).toEqual(before);
  });

  it("does not turn an unknown problem into a recommendation", () => {
    expect(getKqCareReserveProducts(withProblems("UNKNOWN"))).toEqual([]);
    expect(getKqCareReserveProducts(withProblems("UNKNOWN", "ROOTS")).map(row => row.product.code)).toEqual(["CARE-COMPOST-TEA"]);
  });

  it("leaves timing and ongoing-intervention restrictions to the game permissions", () => {
    const state = { ...withProblems("APHIDS"), stageIndex: 3, phase: "resolved" as const };
    expect(canApplyKqCareProduct(state, "CARE-APHIDIUS").allowed).toBe(false);
    expect(getKqCareReserveProducts(state).map(row => row.product.code)).toContain("CARE-APHIDIUS");
    state.care!.interventions.push({ productCode: "CARE-APHIDIUS", stageIndex: 2, remainingSteps: 1, status: "active" });
    expect(getKqCareReserveProducts(state).map(row => row.product.code)).toContain("CARE-APHIDIUS");
  });
});

const snapshot = () => ({
  cashCents: 2300,
  inventory: [{ productCode: "CARE-SEAWEED", quantity: 2 }],
  catalog: KQ_CARE_PRODUCTS,
});

describe("verified care reserve snapshots", () => {
  it("keeps the server stock and offered prices without using catalogue reference amounts", () => {
    const input = { ...snapshot(), catalog: [{ code: "CARE-SEAWEED", priceCents: 1350 }] };
    const before = structuredClone(input);
    expect(parseKqCareReserveSnapshot(input)).toEqual({ cashCents: 2300, inventory: { "CARE-SEAWEED": 2 }, prices: { "CARE-SEAWEED": 1350 } });
    expect(input).toEqual(before);
  });

  it("preserves genuine zero cash, stock and price", () => {
    expect(parseKqCareReserveSnapshot({ cashCents: 0, inventory: [{ productCode: "CARE-SEAWEED", quantity: 0 }], catalog: [{ code: "CARE-SEAWEED", priceCents: 0 }] }))
      .toEqual({ cashCents: 0, inventory: { "CARE-SEAWEED": 0 }, prices: { "CARE-SEAWEED": 0 } });
  });

  it("allows a verified empty inventory while leaving absent prices unknown", () => {
    expect(parseKqCareReserveSnapshot({ cashCents: 0, inventory: [], catalog: [] }))
      .toEqual({ cashCents: 0, inventory: {}, prices: {} });
    const parsed = parseKqCareReserveSnapshot({ ...snapshot(), catalog: [{ code: "CARE-SEAWEED" }] });
    expect(parsed?.inventory["CARE-SEAWEED"]).toBe(2);
    expect(parsed?.prices["CARE-SEAWEED"]).toBeUndefined();
    expect(parsed?.prices["CARE-APHIDIUS"]).toBeUndefined();
  });

  it.each([null, undefined, {}, { cashCents: 0 }, { ...snapshot(), inventory: null }, { ...snapshot(), inventory: {} }, { ...snapshot(), catalog: undefined }])(
    "rejects incomplete data instead of establishing an empty reserve (%j)", value => {
      expect(parseKqCareReserveSnapshot(value)).toBeNull();
    },
  );

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "2300", null])("rejects invalid cash or quantities (%j)", value => {
    expect(parseKqCareReserveSnapshot({ ...snapshot(), cashCents: value })).toBeNull();
    expect(parseKqCareReserveSnapshot({ ...snapshot(), inventory: [{ productCode: "CARE-SEAWEED", quantity: value }] })).toBeNull();
  });

  it("rejects ambiguous duplicate inventory rows instead of summing or overwriting", () => {
    expect(parseKqCareReserveSnapshot({ ...snapshot(), inventory: [{ productCode: "CARE-SEAWEED", quantity: 2 }, { productCode: "CARE-SEAWEED", quantity: 3 }] })).toBeNull();
  });

  it("rejects unknown inventory or catalogue product codes", () => {
    expect(parseKqCareReserveSnapshot({ ...snapshot(), inventory: [{ productCode: "UNKNOWN", quantity: 2 }] })).toBeNull();
    expect(parseKqCareReserveSnapshot({ ...snapshot(), catalog: [{ code: "UNKNOWN", priceCents: 1200 }] })).toBeNull();
  });

  it("rejects duplicate offered prices, even if the first is absent", () => {
    expect(parseKqCareReserveSnapshot({ ...snapshot(), catalog: [{ code: "CARE-SEAWEED" }, { code: "CARE-SEAWEED", priceCents: 1200 }] })).toBeNull();
  });

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "1200", null])("rejects malformed offered prices (%j)", priceCents => {
    expect(parseKqCareReserveSnapshot({ ...snapshot(), catalog: [{ code: "CARE-SEAWEED", priceCents }] })).toBeNull();
  });

  it.each([-1, 0.5, NaN, Infinity, "500", null])("rejects malformed maintenance quotes (%j)", basicCarePriceCents => {
    expect(parseKqCareReserveSnapshot({ ...snapshot(), basicCarePriceCents })).toBeNull();
  });
});

describe("verified available care actions", () => {
  const reserve = () => parseKqCareReserveSnapshot({ ...snapshot(), basicCarePriceCents: 500,
    inventory: [
      { productCode: "CARE-COMPOST-TEA", quantity: 9 }, { productCode: "CARE-SEAWEED", quantity: 4 },
      { productCode: "CARE-APHIDIUS", quantity: 3 }, { productCode: "CARE-SWIRSKII", quantity: 8 },
      { productCode: "CARE-ORGANIC-FEED", quantity: 5 }, { productCode: "CARE-PHYTOSEIULUS", quantity: 2 },
    ] })!;
  const culture = () => withProblems("APHIDS", "SALTS", "HEAT", "MITES");

  it("counts usable product types and one quoted maintenance, excluding incompatible stock", () => {
    const wallet = reserve(), state = culture(), before = structuredClone([wallet, state]);
    expect(getKqCareActionAvailability(wallet, state)).toMatchObject({
      total: 4, products: 3, basic: 1, usable: { input: 2, pbi: 1, context: 2 },
    });
    expect([wallet, state]).toEqual(before);
  });

  it("does not turn unknown inventory into zero or missing maintenance prices into a quote", () => {
    expect(getKqCareActionAvailability(null, culture())).toBeNull();
    const wallet = reserve();
    delete wallet.basicCarePriceCents;
    expect(getKqCareActionAvailability(wallet, culture())).toMatchObject({ total: 3, basic: 0 });
  });

  it("uses offered prices, exact cash and per-product affordability without inflating care totals", () => {
    const wallet = { ...reserve(), cashCents: 499, inventory: {}, prices: { "CARE-SEAWEED": 499, "CARE-APHIDIUS": 500 } };
    expect(getKqCareActionAvailability(wallet, culture())).toMatchObject({ total: 0, basic: 0, affordable: { input: 1, pbi: 0 } });
    expect(getKqCareActionAvailability({ ...wallet, cashCents: 500 }, culture())).toMatchObject({ total: 1, affordable: { input: 1, pbi: 1 } });
    expect(getKqCareActionAvailability(wallet)).toMatchObject({ total: 0, products: 0, affordable: { input: 1, pbi: 0 } });
  });

  it("recounts application and maintenance restrictions immediately", () => {
    const state = culture();
    state.care!.lastBasicCareStage = 0;
    state.care!.applications.push({ productCode: "CARE-VERMICOMPOST", stageIndex: 0 });
    expect(getKqCareActionAvailability(reserve(), state)).toMatchObject({ total: 1, products: 1, basic: 0 });
    state.care!.interventions.push({ productCode: "CARE-COCCINELLA", stageIndex: 0, remainingSteps: 1, status: "active" });
    expect(getKqCareActionAvailability(reserve(), state)).toMatchObject({ total: 0, products: 0, basic: 0 });
  });

  it("respects the next intervention window and closed cultures", () => {
    expect(getKqCareActionAvailability(reserve(), { ...culture(), stageIndex: 3, phase: "resolved" })).toMatchObject({ total: 3, products: 2 });
    expect(getKqCareActionAvailability(reserve(), { ...culture(), stageIndex: 4, phase: "resolved" })).toMatchObject({ total: 0 });
    expect(getKqCareActionAvailability(reserve(), { ...culture(), phase: "complete" })).toMatchObject({ total: 0 });
    expect(getKqCareActionAvailability(reserve(), { ...culture(), rulesVersion: 2 })).toMatchObject({ total: 0 });
  });

  it("counts only full-area passages, preserving historical full charges", () => {
    const state = culture();
    if (!state.equipment) throw new Error("The surface fixture requires a frozen equipment profile.");
    state.equipment.productionUnits = 10;
    const storage: KqCareStorage = { getItem: key => key === "kanab-quest-care-simulation-v1"
      ? JSON.stringify({ cashCents: 0, inventory: { "CARE-COMPOST-TEA": 1 }, areaInventory: { "CARE-SEAWEED": 9, "CARE-APHIDIUS": 20 } }) : null,
      setItem: () => undefined, removeItem: () => undefined };
    const wallet = parseKqCareReserveSnapshot(getKqLocalCareSnapshot(storage, state));
    expect(wallet?.inventory).toMatchObject({ "CARE-COMPOST-TEA": 1, "CARE-SEAWEED": 0, "CARE-APHIDIUS": 2 });
    expect(getKqCareActionAvailability(wallet, state)).toMatchObject({ total: 2, products: 2 });
  });

  it("ties an availability result to its run, phase, care state and surface", () => {
    const state = culture(), scope = getKqCareAvailabilityScope(state, "run-1");
    if (!state.equipment) throw new Error("The surface fixture requires a frozen equipment profile.");
    expect(getKqCareAvailabilityScope(structuredClone(state), "run-1")).toBe(scope);
    expect(getKqCareAvailabilityScope(state, "run-2")).not.toBe(scope);
    expect(getKqCareAvailabilityScope({ ...state, phase: "resolved" }, "run-1")).not.toBe(scope);
    expect(getKqCareAvailabilityScope({ ...state, equipment: { ...state.equipment, productionUnits: 10 } }, "run-1")).not.toBe(scope);
    state.care!.applications.push({ productCode: "CARE-SEAWEED", stageIndex: 0 });
    expect(getKqCareAvailabilityScope(state, "run-1")).not.toBe(scope);
  });

  it("supports a historical culture with no equipment profile", () => {
    const state: KqGameState = { ...culture(), equipment: undefined };
    const scope = getKqCareAvailabilityScope(state, "historical-run");
    expect(scope).toEqual(getKqCareAvailabilityScope(structuredClone(state), "historical-run"));
    expect(getKqCareActionAvailability(reserve(), state)).toMatchObject({ total: 4, products: 3, basic: 1 });
  });
});
