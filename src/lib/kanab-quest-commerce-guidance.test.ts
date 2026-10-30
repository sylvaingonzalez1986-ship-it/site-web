import { describe, expect, it } from "vitest";
import { createKqOperationsLesson, getKqOperationsCommerce, getKqOperationsStorage, applyKqOperationsRequest } from "./kanab-quest-operations-lesson";
import { getKqCommercePackagedStock, getKqCommerceWaitingHarvest, hasKqCommerceProfessionalLot, isKqCommerceWaitingStorage } from "./kanab-quest-commerce-guidance";

describe("Commerce next steps use actual available stock", () => {
  it("offers professional circuits before purchasing a computer or opening a website", () => {
    const data = getKqOperationsCommerce(createKqOperationsLesson("market"));
    data.computerOwned = false;
    data.online!.site.createdAt = null;
    data.online!.site.active = false;
    const before = structuredClone(data);
    expect(hasKqCommerceProfessionalLot(data)).toBe(true);
    expect(data).toEqual(before);
  });
  it("does not promise a professional sale while the only prepared lot is processing", () => {
    const state = createKqOperationsLesson("market");
    const raw = getKqOperationsCommerce(state).rawLots[0];
    const prepared = applyKqOperationsRequest(state, { path: "/api/arena/placard/commerce", method: "POST", body: { action: "prepare", flowerId: raw.flowerId, route: "raw", expectedCostCents: raw.options.find(option => option.route === "raw")!.market!.processingCostCents } });
    const data = getKqOperationsCommerce(prepared.state);
    data.stocks[0].processingReadyAt = new Date(state.trial.clock + 60_000).toISOString();
    expect(hasKqCommerceProfessionalLot(data, state.trial.clock)).toBe(false);
    data.stocks[0].processingReadyAt = null;
    expect(hasKqCommerceProfessionalLot(data, state.trial.clock)).toBe(true);
  });
  it("keeps missing packet information unknown instead of declaring zero stock", () => {
    const data = getKqOperationsCommerce(createKqOperationsLesson("market"));
    expect(getKqCommercePackagedStock(data)).toEqual({ packets: 0, grams: 0 });
    delete data.online;
    expect(getKqCommercePackagedStock(data)).toBeNull();
  });
  it("does not send packaged post-jury harvests back through the jury", () => {
    const storage = getKqOperationsStorage(createKqOperationsLesson("market"));
    storage.lots[0].flowerStatus = "burned";
    storage.lots[0].projection.capacity!.overflowUnits = 0;
    expect(getKqCommerceWaitingHarvest(storage)).toBeNull();
    storage.lots[0].flowerStatus = "available";
    expect(getKqCommerceWaitingHarvest(storage)?.lot.flowerId).toBe(storage.lots[0].flowerId);
  });
  it("prioritizes the exact unprotected harvest without mutating its quantity or deadline", () => {
    const storage = getKqOperationsStorage(createKqOperationsLesson("market"));
    const ready = storage.lots[0];
    ready.flowerStatus = "available";
    ready.projection.stage = "ready";
    ready.projection.capacity!.overflowUnits = 0;
    const urgent = structuredClone(ready);
    urgent.flowerId = "exposed-harvest";
    urgent.projection.capacity!.overflowUnits = 230;
    storage.lots.push(urgent);
    const before = structuredClone(storage);
    expect(getKqCommerceWaitingHarvest(storage)).toMatchObject({ kind: "overflow", lot: { flowerId: "exposed-harvest" } });
    expect(storage).toEqual(before);
  });
  it("accepts missing capacity as unknown but rejects incomplete identities and projections", () => {
    const storage = getKqOperationsStorage(createKqOperationsLesson("market"));
    storage.lots[0].flowerStatus = "available";
    storage.lots[0].projection.stage = "ready";
    delete storage.lots[0].projection.capacity;
    expect(isKqCommerceWaitingStorage(storage)).toBe(true);
    expect(getKqCommerceWaitingHarvest(storage)?.kind).toBe("refresh");
    expect(isKqCommerceWaitingStorage({ ...storage, lots: [{}] })).toBe(false);
    expect(isKqCommerceWaitingStorage({ ...storage, serverNow: "unknown" })).toBe(false);
  });
});
