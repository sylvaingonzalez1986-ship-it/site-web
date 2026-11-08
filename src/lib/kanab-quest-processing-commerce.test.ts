import { describe, expect, it } from "vitest";
import { quoteKqCommerce, type KqCommerceState, type KqCommerceStock } from "./kanab-quest-commerce";
import { getKqLotSummary } from "./kanab-quest-lot-summary";
import { createKqOperationsLesson, getKqOperationsStorage } from "./kanab-quest-operations-lesson";
import { createKqProcessingPlan } from "./kanab-quest-processing-profiles";
import type { KqProcessingJob } from "./kanab-quest-processing-work";

const now = "2026-11-08T12:00:00.000Z", flowerId = "11111111-1111-4111-8111-111111111111";
function fixture(status: KqProcessingJob["status"]) {
  const stored = structuredClone(getKqOperationsStorage(createKqOperationsLesson("warehouse")).lots[0].projection);
  const storage = { ...stored, serverNow: now, stage: "ready" as const, progressPercent: 100, qualityDelta: 0,
    readyAt: "2026-11-08T11:00:00Z", conditionScore: 8,
    capacity: { totalUnits: 10000, protectedUnits: 10000, overflowUnits: 0, reservedCapacityUnits: 10000,
      allocations: [], overflowDeadlineAt: null, overflowDue: false } };
  const plan = createKqProcessingPlan({ inputGrams: 1000, productGrams: 100, equipmentCodes: ["SIFT-TRAY"], levels: { "SIFT-TRAY": 10 } })!;
  const job: KqProcessingJob = { version: 1, flowerId, route: "dry-sift", inputGrams: 1000,
    completedGrams: status === "completed" || status === "passive" ? 1000 : 250, fundedGrams: 1000,
    remainingGrams: status === "completed" || status === "passive" ? 0 : 750, nominalHours: 1,
    remainingNominalHours: status === "completed" || status === "passive" ? 0 : .75,
    status, startedAt: "2026-11-08T11:00:00Z", readyAt: null,
    finalReadyAt: status === "passive" ? "2026-11-08T16:00:00Z" : null,
    delegated: false, actor: null, bookedHours: 1, activeHours: 1, remainingHours: 0, plan };
  const stock: KqCommerceStock = { id: "stock", flowerId, name: "Lot", route: "dry-sift", batchRoute: "dry-sift", juryScore: 8,
    initialUnits: 1000, remainingUnits: 1000, equivalentUnits: 10000, originalUnits: 10000, baseUnitCents: 180,
    repExact: 0, repRounded: 0, professionalUnits: 0, counted: false, storage,
    processingReadyAt: "9999-01-01T00:00:00Z", processingWork: job };
  const state: KqCommerceState = { revision: 1, cashCents: 100000, reputation: 1000, clients: 100, computerOwned: true,
    internetRenew: true, campaign: null, stocks: [stock], receipts: [], marketVolumes: {}, ownVolumes: {}, routeSales: {} };
  return { stock, state };
}

describe("processing state across lot summaries and sale quotes", () => {
  it.each([
    ["blocked", "Transformation en attente"], ["running", "Transformation en cours"], ["passive", "Séchage en cours"],
  ] as const)("shows confirmed %s work rather than the sentinel deadline", (status, stateLabel) => {
    const { stock, state } = fixture(status);
    const summary = getKqLotSummary({ kind: "product", stock });
    expect(summary.state).toBe(stateLabel);
    expect(summary.readyAt).toBe(status === "passive" ? "2026-11-08T16:00:00Z" : null);
    expect(summary.progress).toBe(status === "passive" ? 99 : 25);
    const offer = quoteKqCommerce(state, stock, "wholesale", "advised", 100, Date.parse(now));
    expect(offer.maxUnits).toBe(0);
    expect(offer.reason).toMatch(status === "blocked" ? /attente d’heures/ : /Transformation en cours/);
    expect(summary.next).not.toContain("9999");
  });

  it("releases a completed server job even if its older deadline still carries the waiting sentinel", () => {
    const { stock, state } = fixture("completed");
    expect(getKqLotSummary({ kind: "product", stock }).state).toMatch(/prêt à vendre/i);
    const offer = quoteKqCommerce(state, stock, "wholesale", "advised", 100, Date.parse(now));
    expect(offer.reason).toBeNull();
    expect(offer.maxUnits).toBeGreaterThan(0);
  });

  it("still honors ordinary legacy deadlines when no processing job exists", () => {
    const { stock, state } = fixture("completed");
    delete stock.processingWork;
    stock.processingReadyAt = "2026-11-08T12:10:00Z";
    expect(getKqLotSummary({ kind: "product", stock }).state).toMatch(/transformation en cours/i);
    expect(quoteKqCommerce(state, stock, "wholesale", "advised", 100, Date.parse(now)).maxUnits).toBe(0);
    stock.processingReadyAt = "2026-11-08T11:59:00Z";
    expect(getKqLotSummary({ kind: "product", stock }).state).toMatch(/prêt à vendre/i);
    expect(quoteKqCommerce(state, stock, "wholesale", "advised", 100, Date.parse(now)).reason).toBeNull();
  });
});
