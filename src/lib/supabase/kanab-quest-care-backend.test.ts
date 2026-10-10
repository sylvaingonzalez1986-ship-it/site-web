import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), maybeSingle: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: () => ({ rpc: mocks.rpc, from: mocks.from }) }));
import { applyKqPlayerCare, getKqCareShopSnapshot, purchaseKqCareProduct } from "./kanab-quest-care-backend";
import { advanceKqStage, resolveKqStage, startKqGame } from "@/lib/kanab-quest-game";
import { applyKqCareProduct, createKqCareState, KQ_BASIC_CARE_PRICE_CENTS, performKqBasicCare, type KqCareProblem } from "@/lib/kanab-quest-care";
import { encodeKqSave, parseKqGameSave } from "@/lib/kanab-quest-persistence";
const userId = "00000000-0000-4000-8000-000000000001", runId = "00000000-0000-4000-8000-000000000002", requestKey = "00000000-0000-4000-8000-000000000003";
const input = { userId, runId, requestKey, productCode: "CARE-SEAWEED" };
const problem = (code: string): KqCareProblem => ({ code, severity: 2, status: "confirmed", trend: "stable", appearedAt: 0, variant: 0 });

describe("server-authoritative care transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: mocks.maybeSingle };
    mocks.from.mockReturnValue(chain);
    mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "rpc_kq_care_intervention_receipt" ? null : { replayed: false }, error: null }));
    mocks.maybeSingle.mockResolvedValue({ data: { state: startKqGame(31), status: "active", updated_at: "2026-10-10T10:00:00.123456+00:00" }, error: null });
  });
  it("computes the next state from the persisted run and preserves its exact version", async () => {
    await applyKqPlayerCare(input);
    const state = startKqGame(31);
    expect(mocks.rpc).toHaveBeenLastCalledWith("rpc_kq_apply_care", {
      p_user_id: userId, p_run_id: runId, p_product_code: "CARE-SEAWEED", p_request_key: requestKey,
      p_expected_updated_at: "2026-10-10T10:00:00.123456+00:00", p_next_state: applyKqCareProduct(state, "CARE-SEAWEED"),
    });
  });
  it("checks a retry receipt before eligibility so completed runs can be retried", async () => {
    const savedReceipt = { state: { phase: "complete" }, inventory: [], replayed: true };
    mocks.rpc.mockResolvedValue({ data: savedReceipt, error: null });
    expect(await applyKqPlayerCare(input)).toEqual(savedReceipt);
    expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("does not apply against a stale browser version", async () => {
    await expect(applyKqPlayerCare({ ...input, expectedUpdatedAt: "older" })).rejects.toThrow("La culture a évolué");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("rejects legacy runs and unavailable products before any stock write", async () => {
    const legacy = { ...startKqGame(31), rulesVersion: 2, care: undefined };
    mocks.maybeSingle.mockResolvedValue({ data: { state: legacy, status: "active", updated_at: "version" }, error: null });
    await expect(applyKqPlayerCare(input)).rejects.toThrow("anciennes règles");
    await expect(purchaseKqCareProduct({ userId, requestKey, productCode: "FORGED", quantity: 1 })).rejects.toThrow("Produit ou quantité");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("never supplies a client price to SQL and validates integral quantities", async () => {
    await purchaseKqCareProduct({ userId, requestKey, productCode: "CARE-SEAWEED", quantity: 2 });
    expect(mocks.rpc).toHaveBeenLastCalledWith("rpc_kq_purchase_care", { p_user_id: userId, p_product_code: "CARE-SEAWEED", p_quantity: 2, p_request_key: requestKey });
    for (const quantity of [0, -1, 1.5, 21, Number.NaN]) await expect(purchaseKqCareProduct({ userId, requestKey, productCode: "CARE-SEAWEED", quantity })).rejects.toThrow("Produit ou quantité");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("requires the displayed basic-care quote before requesting an atomic debit", async () => {
    const state = startKqGame(31);
    const result = { state: performKqBasicCare(state), inventory: [], cashCents: 9500, chargedCents: KQ_BASIC_CARE_PRICE_CENTS, replayed: false };
    mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "rpc_kq_care_intervention_receipt" ? null : result, error: null }));
    expect(await applyKqPlayerCare({ userId, runId, requestKey, action: "basic", basicPriceCents: KQ_BASIC_CARE_PRICE_CENTS })).toEqual(result);
    expect(mocks.rpc).toHaveBeenLastCalledWith("rpc_kq_apply_care", {
      p_user_id: userId, p_run_id: runId, p_product_code: null, p_request_key: requestKey,
      p_expected_updated_at: "2026-10-10T10:00:00.123456+00:00", p_next_state: performKqBasicCare(state),
      p_basic_price_cents: KQ_BASIC_CARE_PRICE_CENTS,
    });
  });
  it.each([undefined, 0, 499, 501, Number.NaN])("rejects an old free button or a changed quote (%s) without state changes", async basicPriceCents => {
    await expect(applyKqPlayerCare({ userId, runId, requestKey, action: "basic", basicPriceCents })).rejects.toThrow("prix de l’entretien a changé");
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("preserves the recorded charge on a replay even without today's price", async () => {
    const savedReceipt = { state: { phase: "complete" }, inventory: [], cashCents: 8500, chargedCents: 0, replayed: true };
    mocks.rpc.mockResolvedValue({ data: savedReceipt, error: null });
    expect(await applyKqPlayerCare({ userId, runId, requestKey, action: "basic" })).toEqual(savedReceipt);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("propagates insufficient funds from SQL without reporting the uncommitted state", async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === "rpc_kq_care_intervention_receipt"
      ? { data: null, error: null } : { data: null, error: { message: "kq_care_basic_insufficient_cash" } });
    await expect(applyKqPlayerCare({ userId, runId, requestKey, action: "basic", basicPriceCents: KQ_BASIC_CARE_PRICE_CENTS })).rejects.toThrow("Trésorerie insuffisante pour cet entretien");
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });
  it("does not invent a price quote when the database has not been migrated", async () => {
    const snapshot = { cashCents: 10000, inventory: [] };
    mocks.rpc.mockResolvedValue({ data: snapshot, error: null });
    expect(await getKqCareShopSnapshot(userId)).not.toHaveProperty("basicCarePriceCents");
    mocks.rpc.mockResolvedValue({ data: { ...snapshot, basicCarePriceCents: KQ_BASIC_CARE_PRICE_CENTS }, error: null });
    expect(await getKqCareShopSnapshot(userId)).toHaveProperty("basicCarePriceCents", KQ_BASIC_CARE_PRICE_CENTS);
  });
  it.each(["harvest", "flowering-resolved", "heat"])("refuses %s interventions before the stock mutation RPC", async reason => {
    let state = startKqGame(31);
    if (reason !== "heat") {
      for (let stage = 0; stage < 3; stage++) state = advanceKqStage(resolveKqStage({ ...state, phase: "rolled", dice: [6, 6, 6] }));
      state = resolveKqStage({ ...state, phase: "rolled", dice: [6, 6, 6] });
      if (reason === "harvest") state = advanceKqStage(state);
    }
    state.care = createKqCareState();
    state.care.problems = [problem("MITES"), ...(reason === "heat" ? [problem("HEAT")] : [])];
    expect(parseKqGameSave(encodeKqSave(state))).toEqual(state);
    mocks.maybeSingle.mockResolvedValue({ data: { state, status: "active", updated_at: "version" }, error: null });
    await expect(applyKqPlayerCare({ ...input, productCode: "CARE-PHYTOSEIULUS" })).rejects.toThrow(reason === "heat" ? /thermique|chaleur|chaud/i : /récolte|deux bilans|tard/i);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("rpc_kq_care_intervention_receipt", {
      p_user_id: userId, p_run_id: runId, p_request_key: requestKey, p_product_code: "CARE-PHYTOSEIULUS",
    });
    expect(mocks.rpc.mock.calls.some(([name]) => name === "rpc_kq_apply_care")).toBe(false);
  });
});
