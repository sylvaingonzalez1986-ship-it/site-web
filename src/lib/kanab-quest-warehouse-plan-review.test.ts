import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KqWarehousePlanQuote } from "../components/placard/KqWarehousePlanQuote";
import { KQ_BUDDIES } from "./kanab-quest-game";
import { createKqWarehouseEmpty, createKqWarehouseStarter, getKqWarehouseQuote, type KqWarehouseQuote, type KqWarehouseState } from "./kanab-quest-warehouse";
import { proposeFirstWarehousePlan } from "./kanab-quest-warehouse-first-plan";
import { getKqWarehousePlanChanges, getKqWarehousePlanCultureBudget, getKqWarehousePlanPayment } from "./kanab-quest-warehouse-plan-review";

const fixture = () => {
  const starter = createKqWarehouseStarter();
  return { ...starter, zones: [
    { ...starter.zones[0], width: 2, height: 2 },
    { ...starter.zones[0], id: "second", x: 4, width: 2, height: 2 },
  ] };
};

describe("warehouse plan review", () => {
  it("reconciles Loïc’s first plan and reserve to the cent before Buddie assignment", () => {
    const empty = createKqWarehouseEmpty();
    const quote = getKqWarehouseQuote(proposeFirstWarehousePlan(empty)!, empty);
    const payment = getKqWarehousePlanPayment(quote, 100000, 0);
    const budget = getKqWarehousePlanCultureBudget(quote.nextState);
    expect(payment).toMatchObject({ payableCents: 78674, cashAfterCents: 21326 });
    expect(budget).toEqual({ lotCount: 1, energyCostCents: 6000, consumablesCostCents: 2360,
      committedCents: 8360, analysisCents: 4500, reserveCents: 12860 });
    expect(payment.cashAfterCents! - budget.reserveCents).toBe(8466);
  });

  it("reserves analyses by active lot and excludes a zone reserved to production", () => {
    const starter = createKqWarehouseStarter();
    const [zone] = starter.zones;
    const plan = { ...starter, zones: [zone, { ...zone, id: "second", x: 2 }, { ...zone, id: "third", x: 4 }, { ...zone, id: "paused", x: 6, active: false }] };
    expect(getKqWarehousePlanCultureBudget(plan)).toMatchObject({ lotCount: 3, analysisCents: 13500 });
    expect(getKqWarehousePlanCultureBudget(plan, "third")).toMatchObject({ lotCount: 2, analysisCents: 9000 });
  });

  it("compares an extension at unchanged sale revenue before testing a gain hypothesis", () => {
    const empty = createKqWarehouseEmpty();
    const installed = getKqWarehouseQuote(proposeFirstWarehousePlan(empty)!, empty).nextState;
    const draft = { ...installed, zones: [...installed.zones, { ...installed.zones[0], id: "extension", x: 6 }] };
    const quote = getKqWarehouseQuote(draft, installed);
    const html = renderToStaticMarkup(createElement(KqWarehousePlanQuote, { previousState: installed, draftState: draft, quote,
      cashCents: 500000, migrationCreditCents: 0, cultureBudget: getKqWarehousePlanCultureBudget(quote.nextState),
      installedCultureBudget: getKqWarehousePlanCultureBudget(installed), potentialGrams: { installed: 189.375, proposed: 378.75 } }));
    expect(html).toContain("Comparer avec le plan installé");
    expect(html).toContain('data-investment-same-sale-margin-cents="-12860"');
    expect(html).toContain("Amortissement à calculer");
  });
  it("describes partition creation, removal, moves, lengths and rotations without changing prices", () => {
    const starter = createKqWarehouseStarter();
    const added: KqWarehouseState = { ...starter, partitions: [{ id: "wall", x: 2, y: 2, axis: "x", length: 1 }] };
    expect(getKqWarehousePlanChanges(starter, added).otherChanges).toEqual(["Paroi 1 ajoutée : 1 m, horizontale"]);
    const changed: KqWarehouseState = { ...added, partitions: [{ id: "wall", x: 3, y: 4, axis: "y", length: 2 }] };
    expect(getKqWarehousePlanChanges(added, changed).otherChanges).toEqual([
      "Paroi 1 : longueur 1 → 2 m", "Paroi 1 tournée : horizontale → verticale", "Paroi 1 déplacée",
    ]);
    expect(getKqWarehousePlanChanges(changed, { ...changed, partitions: [] }).otherChanges).toEqual(["Paroi 1 retirée : 2 m"]);
    expect(getKqWarehousePlanChanges(added, starter).otherChanges).toEqual([]);
    expect(getKqWarehouseQuote(added, starter).totalCostCents).toBe(0);
  });
  it("retains the unknown price of an invalid plan rather than displaying a free installation", () => {
    expect(getKqWarehousePlanPayment(null, 10000, 5000)).toEqual({
      totalCents: null, creditUsedCents: null, payableCents: null,
      cashAfterCents: null, shortfallCents: null, affordable: false,
    });
  });

  it("uses the supplied quote total and deducts a partial credit exactly once", () => {
    const previous = createKqWarehouseStarter();
    const quote = { ...getKqWarehouseQuote(previous, previous), totalCostCents: 37835 };
    expect(getKqWarehousePlanPayment(quote, 50000, 10000)).toEqual({
      totalCents: 37835, creditUsedCents: 10000, payableCents: 27835,
      cashAfterCents: 22165, shortfallCents: 0, affordable: true,
    });
  });

  it("caps the used credit at the quote total and preserves cash when no debit remains", () => {
    const previous = createKqWarehouseStarter();
    const quote = { ...getKqWarehouseQuote(previous, previous), totalCostCents: 37835 };
    expect(getKqWarehousePlanPayment(quote, 5000, 50000)).toMatchObject({
      creditUsedCents: 37835, payableCents: 0, cashAfterCents: 5000, affordable: true,
    });
  });

  it("does not present negative cash as a possible after-payment balance", () => {
    const previous = createKqWarehouseStarter();
    const quote = { ...getKqWarehouseQuote(previous, previous), totalCostCents: 37835 };
    expect(getKqWarehousePlanPayment(quote, 5000, 10000)).toMatchObject({
      payableCents: 27835, cashAfterCents: null, shortfallCents: 22835, affordable: false,
    });
  });

  it("shows a genuinely free plan as free without manufacturing any purchase", () => {
    const previous = createKqWarehouseStarter();
    const quote = getKqWarehouseQuote(previous, previous);
    expect(getKqWarehousePlanPayment(quote, 5000, 10000)).toMatchObject({
      totalCents: 0, creditUsedCents: 0, payableCents: 0, cashAfterCents: 5000, affordable: true,
    });
  });

  it("includes every changed zone when equipment and a Buddie are selected in different places", () => {
    const previous = fixture();
    const draft = { ...previous, zones: previous.zones.map((zone, index) => index === 0
      ? { ...zone, lightingCode: "SIM-LIGHT-02" }
      : { ...zone, buddieCode: KQ_BUDDIES[0].code }) };
    const untouched = JSON.stringify({ previous, draft });
    const result = getKqWarehousePlanChanges(previous, draft);
    expect(result.zoneChanges).toHaveLength(2);
    expect(result.zoneChanges[0]).toMatchObject({ id: previous.zones[0].id, label: "Zone 01", status: "changed" });
    expect(result.zoneChanges[0].details[0]).toMatch(/^Éclairage :/);
    expect(result.zoneChanges[1]).toMatchObject({ id: "second", label: "Zone 02", details: [`Buddie : ${KQ_BUDDIES[0].name}`] });
    expect(JSON.stringify({ previous, draft })).toBe(untouched);
  });

  it("recognizes a Buddie-only change without inventing a material change", () => {
    const previous = fixture();
    const draft = { ...previous, zones: previous.zones.map((zone, index) => index === 0 ? { ...zone, buddieCode: "BUD-UNKNOWN" } : zone) };
    const result = getKqWarehousePlanChanges(previous, draft);
    expect(result.zoneChanges).toHaveLength(1);
    expect(result.zoneChanges[0].details).toEqual(["Buddie : Buddie sélectionné"]);
    expect(result.otherChanges).toEqual([]);
  });

  it("distinguishes adding a zone from removing an older zone with the same visible number", () => {
    const previous = fixture();
    const draft = { ...previous, zones: [{ ...previous.zones[1], active: false }, { ...previous.zones[0], id: "new-zone", x: 8 }] };
    expect(getKqWarehousePlanChanges(previous, draft).zoneChanges).toEqual([
      { id: "second", label: "Zone 01", previousLabel: "Zone 02", kind: "Culture", status: "changed", details: ["Inactive à la prochaine culture"] },
      { id: "new-zone", label: "Zone 02", kind: "Culture", status: "added", details: ["4 m²", expect.stringMatching(/^Éclairage :/), expect.stringMatching(/^Extraction :/)] },
      { id: previous.zones[0].id, label: "Zone 01", kind: "Culture", status: "removed", details: ["Matériel conservé en réserve"] },
    ]);
  });

  it("keeps the before and after dimensions even when a rotation preserves surface area", () => {
    const previous = { ...fixture(), zones: [{ ...fixture().zones[0], width: 2, height: 3 }] };
    const draft = { ...previous, zones: [{ ...previous.zones[0], width: 3, height: 2 }] };
    expect(getKqWarehousePlanChanges(previous, draft).zoneChanges[0].details).toEqual(["Dimensions : 2 × 3 m → 3 × 2 m"]);
  });

  it("includes storage equipment and climate changes outside the culture zones", () => {
    const base = fixture();
    const previous: KqWarehouseState = { ...base, serviceZones: [{ id: "storage", name: "Stockage", x: 8, y: 0, width: 2, height: 2, kind: "storage", deviceCode: "OLD" }], storageClimateCode: "SIM-STORAGE-CLIMATE-01" };
    const draft: KqWarehouseState = { ...previous, serviceZones: previous.serviceZones!.map(zone => ({ ...zone, deviceCode: "NEW" })), storageClimateCode: undefined };
    expect(getKqWarehousePlanChanges(previous, draft)).toMatchObject({
      zoneChanges: [{ id: "storage", label: "Zone 03", kind: "Stockage", status: "changed", details: ["Matériel : Matériel sélectionné"] }],
      otherChanges: ["Climatisation du stockage : Aucune"],
    });
  });

  it("does not mistake reordered module and inventory lists for new decisions", () => {
    const base = fixture();
    const previous = { ...base, zones: [{ ...base.zones[0], optionCodes: ["SIM-WATER-01", "SIM-SUBSTRATE-01"] }] };
    const draft = { ...previous, equipment: [...previous.equipment].reverse(), zones: [{ ...previous.zones[0], optionCodes: [...previous.zones[0].optionCodes].reverse() }] };
    expect(getKqWarehousePlanChanges(previous, draft)).toEqual({ zoneChanges: [], otherChanges: [] });
  });

  it("does not recalculate or mutate a quoted total when its itemized numbers differ", () => {
    const previous = fixture();
    const quote = { totalCostCents: 12345, equipmentCostCents: 500, preparationCostCents: 200, installationCostCents: 75 } as KqWarehouseQuote;
    const before = JSON.stringify(quote);
    expect(getKqWarehousePlanPayment(quote, 12345, 0).payableCents).toBe(12345);
    expect(JSON.stringify(quote)).toBe(before);
    expect(getKqWarehousePlanChanges(previous, previous)).toEqual({ zoneChanges: [], otherChanges: [] });
  });
});
