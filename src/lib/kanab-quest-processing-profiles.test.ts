import { describe, expect, it } from "vitest";
import { createKqProcessingPlan, getKqProcessingMachineReference } from "./kanab-quest-processing-profiles";

describe("processing profiles retain manufacturer material distinctions", () => {
  it("derives the washer ceiling from dry material rather than fresh frozen mass", () => {
    const reference = getKqProcessingMachineReference("WASHER-25L", 10)!;
    expect(reference).toMatchObject({ basis: "input", material: "fleurs sèches", gramsPerHour: 1050, estimated: true });
    expect(reference.specification).toContain("2 100 g de matière sèche");
    expect(reference.note).toContain("aucun gramme frais n’est assimilé à un gramme sec");
    const plan = createKqProcessingPlan({ inputGrams: 2100, productGrams: 210, equipmentCodes: ["WASHER-25L"], levels: { "WASHER-25L": 10 } })!;
    expect(plan.nominalHours).toBe(2);
    expect(plan.machines[0].quantityGrams).toBe(2100);
  });

  it("uses the static separator's 500 g/h finished output, never its starting flower mass", () => {
    const plan = createKqProcessingPlan({ inputGrams: 5000, productGrams: 500, equipmentCodes: ["STATIC-PLASMA"], levels: { "STATIC-PLASMA": 10 } })!;
    expect(plan.nominalHours).toBe(1);
    expect(plan.machines[0]).toMatchObject({ basis: "output", material: "produit fini prévu", quantityGrams: 500, gramsPerHour: 500, hours: 1 });
    expect(plan.machines[0].specification).toContain("500 g de produit fini");
  });

  it("does not reuse hash press loads as flower loads", () => {
    const small = getKqProcessingMachineReference("PRESS-0600", 1)!;
    const large = getKqProcessingMachineReference("PRESS-0600", 10)!;
    expect(small).toMatchObject({ basis: "input", material: "fleurs sèches", estimated: true });
    expect(small.specification).toContain("5 à 10 g de fleurs");
    expect(large.specification).toContain("15 à 25 g de fleurs");
    expect(large.note).toContain("charges de hash par cycle ne sont pas utilisées");
    expect(small.specification).toContain("aucune cadence horaire publiée");
  });

  it.each([
    ["SIFT-TRAY", 1000], ["WASHER-25L", 1050], ["AUTO-SIEVE", 2100], ["STATIC-PLASMA", 500], ["PRESS-0600", 250],
  ])("keeps levels 1–10 monotonic and below the reference ceiling for %s", (code, ceiling) => {
    const rates = Array.from({ length: 10 }, (_, index) => getKqProcessingMachineReference(String(code), index + 1)!.gramsPerHour!);
    expect(rates.every(rate => rate > 0 && rate <= Number(ceiling))).toBe(true);
    expect(rates).toEqual([...rates].sort((a, b) => a - b));
    expect(rates[9]).toBe(ceiling);
  });

  it.each([0, -1, 11, 2.5, NaN, Infinity])("does not use invalid equipment level %s to exceed the machine ceiling", level => {
    expect(getKqProcessingMachineReference("WASHER-25L", level)).toEqual(getKqProcessingMachineReference("WASHER-25L", 1));
  });

  it("doubles serial processing time when both the input and planned output double", () => {
    const source = { inputGrams: 1000, productGrams: 100, equipmentCodes: ["SIFT-TRAY", "STATIC-PLASMA", "PRESS-0600"], levels: { "SIFT-TRAY": 10, "STATIC-PLASMA": 10, "PRESS-0600": 10 } };
    const single = createKqProcessingPlan(source)!;
    const doubled = createKqProcessingPlan({ ...source, inputGrams: 2000, productGrams: 200 })!;
    expect(doubled.nominalHours).toBeCloseTo(single.nominalHours * 2, 5);
    expect(doubled.machines.map(row => row.hours)).toEqual(single.machines.map(row => row.hours * 2));
    expect(single.nominalHours).toBeCloseTo(single.machines.reduce((sum, row) => sum + row.hours, 0), 5);
  });

  it("counts dryer waiting separately from handling labor and explicitly describes its wet mass estimate", () => {
    const first = createKqProcessingPlan({ inputGrams: 10000, productGrams: 1000, equipmentCodes: ["FREEZE-DRYER"] })!;
    const doubled = createKqProcessingPlan({ inputGrams: 20000, productGrams: 2000, equipmentCodes: ["FREEZE-DRYER"] })!;
    expect(first).toMatchObject({ nominalHours: .5, passiveHours: 24, estimated: true });
    expect(first.machines[0]).toMatchObject({ basis: "passive", material: "charge humide simulée", quantityGrams: 4000, gramsPerHour: null, hours: 24 });
    expect(first.machines[0].note).toContain("quatre fois le produit fini prévu");
    expect(first.machines[0].note).toContain("hypothèse de jeu, pas une donnée constructeur");
    expect(first.machines[0].specification).toContain("durée non publiée");
    expect(doubled).toMatchObject({ nominalHours: 1, passiveHours: 48 });
    expect(first.machines[0].quantityGrams).not.toBe(first.inputGrams);
  });

  it("does not duplicate a stage or disguise legacy family estimates as old manufacturer specifications", () => {
    const simple = createKqProcessingPlan({ inputGrams: 1000, productGrams: 100, equipmentCodes: ["SIFT-TRAY"] });
    const repeated = createKqProcessingPlan({ inputGrams: 1000, productGrams: 100, equipmentCodes: ["SIFT-TRAY", "SIFT-TRAY"] });
    expect(repeated).toEqual(simple);
    for (const code of ["WASHER-75G", "TSS-225", "PRESS-2T", "PRESS-10T", "PRESS-20T"]) {
      const reference = getKqProcessingMachineReference(code, 10)!;
      expect(reference.estimated).toBe(true);
      expect(reference.note).toContain("sans attribuer ces chiffres à son ancien fabricant");
    }
  });

  it("labels every simulated stage and retains a source and its limitations", () => {
    const plan = createKqProcessingPlan({ inputGrams: 5000, productGrams: 500, equipmentCodes: ["SIFT-TRAY", "WASHER-25L", "AUTO-SIEVE", "STATIC-PLASMA", "PRESS-0600", "FREEZE-DRYER"] })!;
    expect(plan).toMatchObject({ version: 1, profileVersion: 1, estimated: true });
    expect(plan.sources).toHaveLength(plan.machines.length);
    for (const machine of plan.machines) {
      expect(machine.estimated).toBe(true);
      expect(machine.note.length).toBeGreaterThan(30);
      expect(machine.sourceUrl).toMatch(/^https:\/\//);
      expect(plan.sources).toContainEqual({ label: machine.model, url: machine.sourceUrl });
    }
  });

  it.each([0, -1, NaN, Infinity, 1_000_001])("rejects invalid input or output mass %s instead of fabricating missing data", grams => {
    expect(createKqProcessingPlan({ inputGrams: grams, productGrams: 1, equipmentCodes: ["SIFT-TRAY"] })).toBeNull();
    expect(createKqProcessingPlan({ inputGrams: 10, productGrams: grams, equipmentCodes: ["SIFT-TRAY"] })).toBeNull();
  });

  it("rejects missing and unknown processing equipment", () => {
    expect(createKqProcessingPlan({ inputGrams: 10, productGrams: 1, equipmentCodes: [] })).toBeNull();
    expect(createKqProcessingPlan({ inputGrams: 10, productGrams: 1, equipmentCodes: ["SIFT-TRAY", "invented"] })).toBeNull();
  });

  it("rejects a planned extract heavier than its source material", () => {
    expect(createKqProcessingPlan({ inputGrams: 100, productGrams: 101, equipmentCodes: ["STATIC-PLASMA"] })).toBeNull();
  });
});
