import { describe, expect, it } from "vitest";
import { canApplyKqCareProduct, createKqCareState, KQ_CARE_PRODUCTS, type KqCareProblem } from "./kanab-quest-care";
import { startKqGame, type KqGameState } from "./kanab-quest-game";
import { getKqCareReserveProducts, parseKqCareReserveSnapshot } from "./kanab-quest-care-reserve";

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
});
