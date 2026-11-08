import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("./admin", () => ({ createSupabaseServiceClient: () => ({ rpc: mocks.rpc }) }));
import { createKqProcessingPlan } from "../kanab-quest-processing-profiles";
import type { KqProcessingJob, KqProcessingWorkQuote } from "../kanab-quest-processing-work";
import { getKqProcessingJobs, getKqProcessingWorkQuote } from "./kanab-quest-processing-work-backend";

const user = "11111111-1111-4111-8111-111111111111", flower = "22222222-2222-4222-8222-222222222222";
function quote(): KqProcessingWorkQuote {
  return { version: 1, flowerId: flower, token: "b".repeat(32), inputGrams: 1200, source: "player", employee: null,
    efficiency: .8, playerRemainingHours: 12, bookedHours: 2, activeHours: 2, nominalHours: 1.6,
    remainingNominalHours: 5, fundedGrams: 384, passiveHours: 0,
    startedAt: "2026-11-08T12:00:00.000Z", readyAt: "2026-11-08T12:20:00.000Z", blockedReason: null };
}
function job(): KqProcessingJob {
  return { version: 1, flowerId: flower, route: "dry-sift", inputGrams: 1200, completedGrams: 0,
    fundedGrams: 384, remainingGrams: 1200, nominalHours: 5, remainingNominalHours: 5, status: "running",
    startedAt: "2026-11-08T12:00:00.000Z", readyAt: "2026-11-08T12:20:00.000Z", finalReadyAt: null,
    delegated: false, actor: null, bookedHours: 2, activeHours: 2, remainingHours: 0,
    plan: createKqProcessingPlan({ inputGrams: 1200, productGrams: 120, equipmentCodes: ["SIFT-TRAY"] })! };
}

beforeEach(() => { vi.clearAllMocks(); });

describe("processing jobs feature negotiation", () => {
  it("forwards the authenticated owner and retains the confirmed jobs", async () => {
    const data = { version: 1, jobs: [job()] };
    mocks.rpc.mockResolvedValue({ data, error: null });
    expect(await getKqProcessingJobs(user)).toEqual(data);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_processing_work_jobs", { p_user_id: user });
  });

  it.each([
    { code: "PGRST202", message: "not in schema cache" },
    { code: "42883", message: "function public.rpc_kq_processing_work_jobs(uuid) does not exist" },
  ])("supports a missing optional capability without swallowing other failures (%s)", async error => {
    mocks.rpc.mockResolvedValue({ data: null, error });
    expect(await getKqProcessingJobs(user)).toBeNull();
  });

  it.each([null, undefined])("preserves an older null snapshot (%s)", async data => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    expect(await getKqProcessingJobs(user)).toBeNull();
  });

  it("does not turn database permission failures into legacy mode", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "permission denied for processing jobs" } });
    await expect(getKqProcessingJobs(user)).rejects.toThrow(/permission denied/);
  });

  it.each([{ version: 2, jobs: [] }, { version: 1, jobs: {} }, { version: 1, jobs: [null] }])("rejects malformed snapshots %s", async data => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    await expect(getKqProcessingJobs(user)).rejects.toThrow(/invalid jobs snapshot/);
  });
});

describe("authoritative processing work quote adapter", () => {
  it("forwards an explicit actor and rejects a response that silently changes it", async () => {
    const selected = { ...quote(), actorChoiceVersion: 1, actorId: "player", actors: [{ id: "player", name: "Toi", employee: null, remainingHours: 12, available: true, reason: null }] };
    mocks.rpc.mockResolvedValue({ data: selected, error: null });
    expect(await getKqProcessingWorkQuote(user, flower, null, "player")).toEqual(selected);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_processing_work_quote", { p_user_id: user, p_flower_id: flower, p_work: null, p_actor_id: "player" });
    mocks.rpc.mockResolvedValue({ data: { ...selected, actorId: "auto" }, error: null });
    await expect(getKqProcessingWorkQuote(user, flower, null, "player")).rejects.toThrow(/invalid work quote/);
  });

  it.each(["", " ", "a".repeat(129), "worker/other"])("rejects an invalid actor %s before any RPC", async actorId => {
    await expect(getKqProcessingWorkQuote(user, flower, null, actorId)).rejects.toThrow(/Choix de personne invalide/);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("quotes an existing job for the authenticated owner without accepting a replacement plan", async () => {
    mocks.rpc.mockResolvedValue({ data: quote(), error: null });
    expect(await getKqProcessingWorkQuote(user, flower)).toEqual(quote());
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_processing_work_quote", { p_user_id: user, p_flower_id: flower, p_work: null });
  });

  it("removes a prior quote token from a server-created plan and leaves the caller object intact", async () => {
    const plan = createKqProcessingPlan({ inputGrams: 1200, productGrams: 120, equipmentCodes: ["SIFT-TRAY"] })!;
    plan.quote = quote();
    const before = structuredClone(plan);
    mocks.rpc.mockResolvedValue({ data: quote(), error: null });
    await getKqProcessingWorkQuote(user, flower, plan);
    const payload = mocks.rpc.mock.calls[0][1];
    expect(payload).toMatchObject({ p_user_id: user, p_flower_id: flower, p_work: { profileVersion: 1, inputGrams: 1200 } });
    expect(payload.p_work.quote).toBeUndefined();
    expect(plan).toEqual(before);
  });

  it.each([null, { ...quote(), token: "untrusted" }, { ...quote(), efficiency: 2 }])("rejects invalid work quote data %s", async data => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    await expect(getKqProcessingWorkQuote(user, flower)).rejects.toThrow(/invalid work quote/);
  });

  it("preserves a server rejection instead of fabricating available hours", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "processing_work_unavailable" } });
    await expect(getKqProcessingWorkQuote(user, flower)).rejects.toThrow(/processing_work_unavailable/);
  });

  it("rejects a well-formed quote returned for a different flower", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...quote(), flowerId: "33333333-3333-4333-8333-333333333333" }, error: null });
    await expect(getKqProcessingWorkQuote(user, flower)).rejects.toThrow(/invalid work quote/);
  });
});
