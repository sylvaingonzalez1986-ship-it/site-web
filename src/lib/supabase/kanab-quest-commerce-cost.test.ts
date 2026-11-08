import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./kanab-quest-staff-backend", () => ({ settleKqStaffIfAvailable: vi.fn().mockResolvedValue(undefined) }));
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), market: vi.fn(), energy: vi.fn() }));
vi.mock("./admin", () => ({ createSupabaseServiceClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("./kanab-quest-market-backend", () => ({ getKqMarketSnapshot: mocks.market }));
vi.mock("./kanab-quest-energy-backend", () => ({ getKqEnergySummary: mocks.energy }));
import { getKqCommerceSnapshot, handleKqCommerceAction } from "./kanab-quest-commerce-backend";
import { createKqBusinessPreview } from "../kanab-quest-business";
import { settleKqStaffIfAvailable } from "./kanab-quest-staff-backend";
import type { KqProcessingWorkQuote } from "../kanab-quest-processing-work";
const user = "11111111-1111-4111-8111-111111111111", flower = "22222222-2222-4222-8222-222222222222";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({ data: { rawFlowerIds: [flower], cashCents: 8500, stocks: [], business: createKqBusinessPreview(Date.parse("2026-09-21T12:00:00Z")) }, error: null });
  mocks.market.mockResolvedValue({ lots: [{ flowerId: flower, status: "ready" }] });
  mocks.energy.mockResolvedValue({ outstandingCents: 200 });
});
describe("commerce cost boundaries", () => {
  it("opens the account once and only previews raw lots when browsing", async () => {
    const result = await getKqCommerceSnapshot(user);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.market).toHaveBeenCalledWith(user, [flower], { previewOnly: true });
    expect(result.cashCents).toBe(8500);
    expect(result.rawLots).toHaveLength(1);
  });
  it("does not load raw lots for the computer shop", async () => {
    await getKqCommerceSnapshot(user, true);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.market).not.toHaveBeenCalled();
  });
  it("still authors a fresh stored quote before a prepare command", async () => {
    await handleKqCommerceAction(user, { action: "prepare", flowerId: flower, route: "raw", expectedCostCents: 0, requestKey: user });
    expect(mocks.market).toHaveBeenCalledWith(user, [flower]);
    expect(mocks.market.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[0]);
    expect(mocks.rpc).toHaveBeenCalledWith("rpc_kq_commerce_command", expect.objectContaining({ p_user_id: user, p_action: "prepare" }));
  });
});

describe("processing command ownership and client whitelist", () => {
  const requestKey = "33333333-3333-4333-8333-333333333333", token = "c".repeat(32);
  const injected = { userId: "other-player", ownerId: "other-player", plan: { nominalHours: 0 }, profileVersion: 99,
    actor: { id: "invented" }, employeeId: "invented", inputGrams: 999999, efficiency: 100, bookedHours: 0, readyAt: "past" };
  const workQuote: KqProcessingWorkQuote = { version: 1, flowerId: flower, token, inputGrams: 100, source: "player", employee: null,
    efficiency: 1, playerRemainingHours: 12, bookedHours: .5, activeHours: .5, nominalHours: .5, remainingNominalHours: 1,
    fundedGrams: 50, passiveHours: 0, startedAt: "2026-11-08T12:00:00Z", readyAt: "2026-11-08T12:05:00Z", blockedReason: null };

  it("rebuilds preparation with the selected actor and keeps that actor in the atomic request", async () => {
    await handleKqCommerceAction(user, { action: "prepare", flowerId: flower, route: "rosin-trial", expectedCostCents: 0, expectedWork: token, actorId: "player", requestKey });
    expect(mocks.market).toHaveBeenCalledExactlyOnceWith(user, [flower], { processingActorId: "player" });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_commerce_command", { p_user_id: user, p_action: "prepare", p_request_key: requestKey,
      p_payload: { flowerId: flower, route: "rosin-trial", expectedCostCents: 0, expectedWork: token, actorId: "player" } });
  });

  it("quotes an unprepared lot from its server plan and preserves the actor-specific availability", async () => {
    const selected = { ...workQuote, actorChoiceVersion: 1, actorId: "player", actors: [{ id: "player", name: "Toi", employee: null, remainingHours: 12, available: true, reason: null }] };
    const preparation = { route: "rosin-trial", available: true, processingWork: { quote: selected } };
    mocks.market.mockResolvedValue({ lots: [{ flowerId: flower, status: "ready", options: [preparation] }] });
    expect(await handleKqCommerceAction(user, { action: "processing-quote", flowerId: flower, route: "rosin-trial", actorId: "player", ...injected })).toEqual({ quote: selected, preparation });
    expect(mocks.market).toHaveBeenCalledExactlyOnceWith(user, [flower], { previewOnly: true, processingActorId: "player" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([null, "", " ", "a".repeat(129), 123])("rejects malformed actor %s without settlement or mutation", async actorId => {
    await expect(handleKqCommerceAction(user, { action: "processing-work", flowerId: flower, expectedWork: token, actorId, requestKey })).rejects.toThrow(/Choix de personne invalide/);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(settleKqStaffIfAvailable).not.toHaveBeenCalled();
  });

  it("requires an authoritative token before explicit preparation", async () => {
    await expect(handleKqCommerceAction(user, { action: "prepare", flowerId: flower, route: "raw", expectedCostCents: 0, actorId: "player", requestKey })).rejects.toThrow(/Devis de travail invalide/);
    expect(mocks.market).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("forwards only approved prepare fields and preserves the optional legacy no-token path", async () => {
    await handleKqCommerceAction(user, { action: "prepare", flowerId: flower, route: "rosin-trial", expectedCostCents: 1234, expectedWork: token, requestKey, ...injected });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_commerce_command", {
      p_user_id: user, p_action: "prepare", p_request_key: requestKey,
      p_payload: { flowerId: flower, route: "rosin-trial", expectedCostCents: 1234, expectedWork: token },
    });
    mocks.rpc.mockClear();
    await handleKqCommerceAction(user, { action: "prepare", flowerId: flower, route: "raw", expectedCostCents: 0, requestKey });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_commerce_command", {
      p_user_id: user, p_action: "prepare", p_request_key: requestKey,
      p_payload: { flowerId: flower, route: "raw", expectedCostCents: 0 },
    });
  });

  it("preserves owner, token and request key on resume and returns SQL replay receipts without starting a replacement quote", async () => {
    const receipt = { flowerId: flower, replayed: true, bookedHours: .5 };
    mocks.rpc.mockResolvedValue({ data: receipt, error: null });
    const command = { action: "processing-work", flowerId: flower, expectedWork: token, requestKey, ...injected };
    expect(await handleKqCommerceAction(user, command)).toEqual(receipt);
    expect(await handleKqCommerceAction(user, command)).toEqual(receipt);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    for (const call of mocks.rpc.mock.calls) expect(call).toEqual(["rpc_kq_commerce_command", {
      p_user_id: user, p_action: "processing-work", p_payload: { flowerId: flower, expectedWork: token }, p_request_key: requestKey,
    }]);
    expect(mocks.market).not.toHaveBeenCalled();
  });

  it("settles authorized staff work before quoting an existing job and ignores all client profile and actor fields", async () => {
    mocks.rpc.mockResolvedValue({ data: workQuote, error: null });
    expect(await handleKqCommerceAction(user, { action: "processing-quote", flowerId: flower, ...injected })).toEqual({ quote: workQuote });
    expect(settleKqStaffIfAvailable).toHaveBeenCalledExactlyOnceWith(user);
    expect(vi.mocked(settleKqStaffIfAvailable).mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[0]);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_processing_work_quote", { p_user_id: user, p_flower_id: flower, p_work: null });
    expect(mocks.market).not.toHaveBeenCalled();
  });

  it.each([undefined, null, "", "a".repeat(31), "a".repeat(33), "A".repeat(32), "g".repeat(32), 123])("rejects invalid resume token %s before any command or staff settlement", async expectedWork => {
    await expect(handleKqCommerceAction(user, { action: "processing-work", flowerId: flower, expectedWork, requestKey })).rejects.toThrow(/Devis de travail invalide/);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(settleKqStaffIfAvailable).not.toHaveBeenCalled();
  });

  it.each([null, "", "a".repeat(31), "A".repeat(32), 123])("rejects a supplied invalid prepare token %s rather than silently choosing legacy mode", async expectedWork => {
    await expect(handleKqCommerceAction(user, { action: "prepare", flowerId: flower, route: "raw", expectedCostCents: 0, expectedWork, requestKey })).rejects.toThrow(/Devis de travail invalide/);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.market).not.toHaveBeenCalled();
  });

  it.each(["flowerId", "requestKey"])("requires a valid %s for resume", async field => {
    await expect(handleKqCommerceAction(user, { action: "processing-work", flowerId: flower, expectedWork: token, requestKey, [field]: "invalid" })).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["processing_work_changed", /ont changé/], ["processing_work_exhausted", /heures Transformation sont épuisées/],
    ["processing_work_pending", /tranche de transformation en cours/], ["processing_work_unavailable", /plus disponible/],
  ])("keeps %s errors actionable without silently resuming", async (code, message) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: code } });
    await expect(handleKqCommerceAction(user, { action: "processing-work", flowerId: flower, expectedWork: token, requestKey })).rejects.toThrow(message);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.market).not.toHaveBeenCalled();
  });
});
