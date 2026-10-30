import { afterEach, describe, expect, it, vi } from "vitest";
import type { KqOfficialFlower, KqStorageSnapshot } from "./kanab-quest-api";
import type { KqCommerceRawLot, KqCommerceStock } from "./kanab-quest-commerce";
import { getKqHarvestRows } from "./kanab-quest-harvests";
import { getKqLotSummary } from "./kanab-quest-lot-summary";
import { createKqOperationsLesson, getKqOperationsStorage } from "./kanab-quest-operations-lesson";

const now = "2026-10-29T16:00:00Z";
const harvestedAt = "2026-10-29T08:00:00Z";
const snapshot = getKqOperationsStorage(createKqOperationsLesson("warehouse"));
function storageLot(status = "burned"): KqStorageSnapshot["lots"][number] {
  const base = structuredClone(snapshot.lots[0]);
  return { ...base, flowerId: "shared-harvest", varietyName: "Même variété", harvestGrams: 900, flowerStatus: status,
    projection: { ...base.projection, harvestedAt, serverNow: now, stage: "ready", progressPercent: 100,
      readyAt: "2026-10-29T14:00:00Z", conditionScore: 7.2, qualityDelta: 0.4,
      capacity: { totalUnits: 625, protectedUnits: 625, overflowUnits: 0, reservedCapacityUnits: 1000,
        allocations: [], overflowDeadlineAt: null, overflowDue: false } } };
}
function flower(): KqOfficialFlower {
  return { id: "shared-harvest", runId: "run", varietyCode: "variety", varietyName: "Même variété", quality: 70,
    traits: [], combos: [], stats: {}, status: "available", createdAt: harvestedAt, queuedAt: null, lockedAt: null, burnedAt: null };
}
function rawLot(): KqCommerceRawLot {
  const lot = storageLot();
  return { flowerId: lot.flowerId, varietyName: lot.varietyName, harvestGrams: 62.5, juryScore: 6.8, options: [], storage: lot.projection };
}
function product(): KqCommerceStock {
  return { id: "product-hash", flowerId: "shared-harvest", name: "Même variété", route: "dry-sift", batchRoute: "dry-sift",
    juryScore: 6.8, initialUnits: 120, remainingUnits: 84, equivalentUnits: 600, originalUnits: 9000,
    baseUnitCents: 300, repExact: 0, repRounded: 0, professionalUnits: 0, counted: false, storage: storageLot().projection };
}
const isSaleReady = (state: string) => /prêt.*vendre/i.test(state);

afterEach(() => vi.useRealTimers());

describe("one lot identity across the harvest, storage and commerce contexts", () => {
  it("keeps the storage snapshot authoritative when the flower source is older", () => {
    const lot = storageLot();
    const row = getKqHarvestRows([flower()], { ...snapshot, lots: [lot] })[0];
    const harvest = getKqLotSummary({ kind: "harvest", row });
    const storage = getKqLotSummary({ kind: "storage", lot });
    const commerce = getKqLotSummary({ kind: "raw", lot: rawLot() });
    expect(harvest).toEqual(storage);
    expect([harvest, storage, commerce].map(item => [item.flowerId, item.name, item.harvestedAt]))
      .toEqual(Array.from({ length: 3 }, () => [lot.flowerId, lot.varietyName, harvestedAt]));
    expect(harvest.quality.label).not.toMatch(/estimée/);
    expect(harvest.quality.value).toBe(7.2);
  });

  it("separates original harvest, remaining flower equivalents and real product grams", () => {
    const lot = storageLot(), stock = product(), before = structuredClone({ lot, stock });
    const bulk = getKqLotSummary({ kind: "storage", lot });
    const raw = getKqLotSummary({ kind: "raw", lot: rawLot() });
    const prepared = getKqLotSummary({ kind: "product", stock });
    expect(bulk.quantity).toMatchObject({ grams: 62.5, equivalent: true });
    expect(raw.quantity).toMatchObject({ grams: 62.5, equivalent: false });
    expect(prepared.quantity).toMatchObject({ grams: 8.4, equivalent: false });
    expect({ lot, stock }).toEqual(before);
  });

  it("identifies two prepared products from one harvest without merging their volumes", () => {
    const hash = product(), flowers: KqCommerceStock = { ...product(), id: "product-flowers", route: "raw", remainingUnits: 200 };
    const cards = [hash, flowers].map(stock => getKqLotSummary({ kind: "product", stock }));
    expect(cards.map(card => card.flowerId)).toEqual(["shared-harvest", "shared-harvest"]);
    expect(new Set(cards.map(card => card.productId)).size).toBe(2);
    expect(cards.map(card => card.quantity.grams)).toEqual([8.4, 20]);
    expect(cards[0].productName).not.toBe(cards[1].productName);
  });

  it("does not manufacture grams or a ten-point score from a flower-only response", () => {
    const official = flower();
    const card = getKqLotSummary({ kind: "harvest", row: { id: official.id, name: official.varietyName, state: "storage", flower: official } });
    expect(card.quantity.grams).toBeNull();
    expect(card.exposedGrams).toBeNull();
    expect(card.quality).toMatchObject({ value: 70, unit: "points" });
    expect(card.harvestedAt).toBe(official.createdAt);
    expect(isSaleReady(card.state)).toBe(false);
  });
});

describe("the summary does not promise an unavailable next action", () => {
  it.each(["available", "queued", "locked"])("keeps a mature %s flower before the sale phase, including a row sorted by overflow", status => {
    const lot = storageLot(status);
    lot.projection.capacity!.overflowUnits = 25;
    const card = getKqLotSummary({ kind: "harvest", row: { id: lot.flowerId, name: lot.varietyName, state: "overflow", lot } });
    expect(isSaleReady(card.state)).toBe(false);
    expect(card.quality.label).toMatch(/estimée/);
    expect(card.exposedGrams).toBe(2.5);
    if (status === "queued") expect(card.state).toMatch(/adversaire/i);
    if (status === "locked") expect(card.state).toMatch(/duel/i);
    expect(card.next).not.toMatch(/offre du grossiste|circuit pour|reprise/);
  });

  it("does not infer a verdict or an estimated pre-jury grade from an unknown flower status", () => {
    const lot = storageLot("unexpected");
    const ready = getKqLotSummary({ kind: "storage", lot });
    expect(isSaleReady(ready.state)).toBe(false);
    expect(ready.quality.label).not.toMatch(/estimée|commerciale|actuelle/);
    lot.projection.stage = "curing";
    const curing = getKqLotSummary({ kind: "storage", lot });
    expect(curing.next).toMatch(/jury.*vérifier/);
    expect(curing.next).not.toMatch(/jury vient ensuite|reprise/);
  });

  it("shows the known unprotected surplus before suggesting a commercial circuit", () => {
    const stock = product();
    stock.storage!.capacity!.overflowUnits = 25;
    const card = getKqLotSummary({ kind: "product", stock });
    expect(card.exposedGrams).toBe(2.5);
    expect(card.state).toMatch(/ranger/i);
    expect(isSaleReady(card.state)).toBe(false);
  });

  it("uses server maturity without advancing an unfinished lot using the device clock", () => {
    vi.useFakeTimers(); vi.setSystemTime("2099-01-01T00:00:00Z");
    const lot = storageLot("available");
    lot.projection.stage = "curing";
    lot.projection.progressPercent = 100;
    const card = getKqLotSummary({ kind: "storage", lot });
    expect(card.state).toMatch(/affinage en cours/i);
    expect(card.progress).toBeLessThan(100);
    expect(isSaleReady(card.state)).toBe(false);
  });

  it("gives workshop processing precedence over mature storage and releases it only with server evidence", () => {
    const stock = product();
    stock.processingReadyAt = "2026-10-29T16:10:00Z";
    expect(getKqLotSummary({ kind: "product", stock }).state).toMatch(/transformation en cours/i);
    stock.storage!.serverNow = "2026-10-29T16:11:00Z";
    expect(isSaleReady(getKqLotSummary({ kind: "product", stock }).state)).toBe(true);
    stock.storage!.serverNow = "unknown";
    expect(getKqLotSummary({ kind: "product", stock }).state).toMatch(/vérifier/);
    stock.processingReadyAt = "invalid-date";
    const missing = getKqLotSummary({ kind: "product", stock });
    expect(missing.readyAt).toBeNull();
    expect(isSaleReady(missing.state)).toBe(false);
  });

  it("preserves unknown quantities and distinguishes a real zero from a sold harvest", () => {
    const lot = storageLot();
    delete lot.projection.capacity;
    const missing = getKqLotSummary({ kind: "storage", lot });
    expect(missing.quantity.grams).toBeNull();
    expect(missing.exposedGrams).toBeNull();
    expect(isSaleReady(missing.state)).toBe(false);
    const stock = product();
    stock.remainingUnits = 0;
    const packedOrSold = getKqLotSummary({ kind: "product", stock });
    expect(packedOrSold.quantity.grams).toBe(0);
    expect(isSaleReady(packedOrSold.state)).toBe(false);
    expect(packedOrSold.state).not.toMatch(/vendu/i);
    stock.remainingUnits = NaN;
    const invalid = getKqLotSummary({ kind: "product", stock });
    expect(invalid.quantity.grams).toBeNull();
    expect(isSaleReady(invalid.state)).toBe(false);
  });
});

describe("quality and historical data", () => {
  it("uses the current projection for raw flowers and the canonical product grade, keeping the jury note separate", () => {
    const raw = getKqLotSummary({ kind: "raw", lot: rawLot() });
    const stock = product();
    stock.storage!.conditionScore = 4.2;
    stock.storage!.qualityDelta = -0.3;
    const prepared = getKqLotSummary({ kind: "product", stock });
    expect(raw.quality.value).toBe(7.2);
    expect(prepared.quality.value).toBe(6.5);
    expect(raw.juryScore).toBe(6.8);
    expect(prepared.juryScore).toBe(6.8);
  });

  it("keeps a legacy stock useful without inventing its harvest date or a verified sale status", () => {
    const stock = product();
    delete stock.storage;
    const card = getKqLotSummary({ kind: "product", stock });
    expect(card.quantity.grams).toBe(8.4);
    expect(card.quality.value).toBe(6.8);
    expect(card.harvestedAt).toBeNull();
    expect(card.exposedGrams).toBeNull();
    expect(isSaleReady(card.state)).toBe(false);
  });

  it("rejects invalid dates, out-of-scale grades and nonfinite storage deltas instead of displaying made-up values", () => {
    const lot = storageLot();
    lot.projection.harvestedAt = "invalid-date";
    lot.projection.conditionScore = 70;
    const card = getKqLotSummary({ kind: "storage", lot });
    expect(card.harvestedAt).toBeNull();
    expect(card.quality.value).toBeNull();
    const stock = product();
    stock.storage!.qualityDelta = Infinity;
    expect(getKqLotSummary({ kind: "product", stock }).quality.value).toBeNull();
  });
});
