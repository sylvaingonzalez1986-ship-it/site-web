import { describe, expect, it } from "vitest";
import { getKqJuryReadiness, getKqTrimHref, getKqTrimPresentation } from "./kanab-quest-jury-readiness";
import { getKqHarvestActions, getKqHarvestRows } from "./kanab-quest-harvests";
import { getKqLotSummary } from "./kanab-quest-lot-summary";
import { createKqOperationsLesson, getKqOperationsStorage } from "./kanab-quest-operations-lesson";
import type { KqOfficialFlower, KqStorageSnapshot } from "./kanab-quest-api";
import type { KqFlowerTrim } from "./kanab-quest-flower-trim";

const ready: KqFlowerTrim = { status: "ready", totalGrams: null, completedGrams: null };
function snapshot(trim?: KqFlowerTrim): KqStorageSnapshot {
  const value = getKqOperationsStorage(createKqOperationsLesson("warehouse"));
  const lot = value.lots[0];
  return { ...value, lots: [{ ...lot, flowerStatus: "available", trim, projection: { ...lot.projection, stage: "ready", capacity: { ...lot.projection.capacity!, overflowUnits: 0 } } }] };
}
function flower(trim?: KqFlowerTrim): KqOfficialFlower {
  const lot = snapshot(trim).lots[0];
  return { id: lot.flowerId, runId: "run", varietyCode: "variety", varietyName: lot.varietyName, quality: 70, traits: [], combos: [], stats: {}, status: "available", createdAt: lot.projection.harvestedAt, queuedAt: null, lockedAt: null, burnedAt: null, storage: lot.projection, trim };
}

describe("confirmed trim and curing before jury", () => {
  it.each([
    undefined,
    { status: "unknown", totalGrams: null, completedGrams: null },
    { status: "required", totalGrams: 100, completedGrams: 0 },
    { status: "in-progress", totalGrams: 100, completedGrams: 35 },
    { status: "ready", totalGrams: 100, completedGrams: 99 },
  ] as Array<KqFlowerTrim | undefined>)("does not promise jury when trim is %o", trim => {
    const value = snapshot(trim), row = getKqHarvestRows([flower(ready)], value)[0];
    expect(getKqJuryReadiness(flower(trim)).ready).toBe(false);
    expect(row.state).toMatch(/^trim/);
    expect(getKqHarvestActions(row).map(action => action.destination)).toEqual(["trim", "storage"]);
    const summary = getKqLotSummary({ kind: "harvest", row });
    expect(summary.state).not.toBe("Prêt pour le jury");
    expect(summary.next).toContain("Affinage terminé");
  });
  it.each([ready, { status: "ready", totalGrams: 100, completedGrams: 100 } satisfies KqFlowerTrim])("accepts confirmed completion or no remaining requirement", trim => {
    expect(getKqJuryReadiness(flower(trim)).ready).toBe(true);
    const row = getKqHarvestRows([], snapshot(trim))[0];
    expect(row.state).toBe("jury");
    expect(getKqHarvestActions(row).map(action => action.destination)).toEqual(["arena", "storage"]);
    expect(getKqLotSummary({ kind: "harvest", row }).state).toBe("Prêt pour le jury");
  });
  it("allows trim during curing without promoting the flower to the jury", () => {
    const value = snapshot({ status: "required", totalGrams: 100, completedGrams: 0 });
    value.lots[0].projection.stage = "curing";
    const row = getKqHarvestRows([], value)[0];
    expect(row.state).toBe("curing");
    expect(getKqHarvestActions(row)[0]).toMatchObject({ destination: "trim" });
    expect(getKqLotSummary({ kind: "harvest", row }).next).toContain("pendant l’affinage");
    expect(getKqJuryReadiness({ ...flower(ready), storage: value.lots[0].projection }).ready).toBe(false);
  });
  it("keeps storage exposure first and does not announce progress as active work", () => {
    const value = snapshot({ status: "in-progress", totalGrams: 100, completedGrams: 35 });
    value.lots[0].projection.capacity!.overflowUnits = 10;
    const row = getKqHarvestRows([], value)[0];
    expect(row.state).toBe("overflow");
    expect(getKqHarvestActions(row).map(action => action.destination)).toEqual(["storage", "trim"]);
    expect(getKqTrimPresentation(row.lot?.trim)).toMatchObject({ label: "Trim partiel", description: expect.stringContaining("35 g sur 100 g confirmés") });
    expect(getKqTrimPresentation(row.lot?.trim).description).not.toContain("en cours");
  });
  it.each(["queued", "locked", "burned"] as const)("never offers new jury entry to a %s flower", status => {
    expect(getKqJuryReadiness({ ...flower(ready), status }).ready).toBe(false);
    const value = snapshot(); value.lots[0].flowerStatus = status;
    expect(getKqHarvestActions(getKqHarvestRows([], value)[0]).some(action => action.destination === "trim")).toBe(false);
  });
  it("preserves the exact homonymous lot and return context in the trim link", () => {
    const query = new URL(getKqTrimHref("lot A/&", "harvests", "storage"), "https://fixture.invalid").searchParams;
    expect(Object.fromEntries(query)).toEqual({ view: "workshop", section: "processing", workshop: "trim", flower: "lot A/&", from: "harvests", fromFlower: "lot A/&", fromSection: "storage" });
  });
});
