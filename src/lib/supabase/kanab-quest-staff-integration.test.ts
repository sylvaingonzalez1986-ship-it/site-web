import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), market: vi.fn(), storage: vi.fn() }));
vi.mock("./admin", () => ({ createSupabaseServiceClient: () => ({ rpc: db.rpc, from: db.from }) }));
vi.mock("./kanab-quest-market-backend", () => ({ getKqMarketSnapshot: db.market }));
vi.mock("./kanab-quest-storage-backend", async original => ({
  ...await original<typeof import("./kanab-quest-storage-backend")>(), getKqStorageRecords: db.storage,
}));
// Staff settlement and its game engine are intentionally real. Only database
// boundaries and unrelated market/storage readers are replaced by this fixture.
import { applyKqPlayerRunAction, enqueueKqPlayerRandomBattle, finalizeKqPlayerBotBattle, getKqPlayerCoreSnapshot, getKqPlayerRunsSnapshot } from "./kanab-quest-backend";
import { applyKqPlayerCare } from "./kanab-quest-care-backend";
import { handleKqCommerceAction } from "./kanab-quest-commerce-backend";
import { getKqSocial } from "./kanab-quest-social-backend";
import { getKqTreasurySnapshot } from "./kanab-quest-treasury-backend";
import { applyKqStaffCommand, getKqStaffMonthlyCost, KQ_STAFF_CANDIDATES, type KqStaffRawSnapshot, type KqStaffSkill } from "../kanab-quest-staff";
import { startKqGame } from "../kanab-quest-game";
import { createKqSocialSnapshot } from "../kanab-quest-social";

const user = "11111111-1111-4111-8111-111111111111", runId = "22222222-2222-4222-8222-222222222222";
const flowerId = "33333333-3333-4333-8333-333333333333", employeeId = "44444444-4444-4444-8444-444444444444";
const key = "55555555-5555-4555-8555-555555555555", startedAt = "2026-11-02T00:00:00.000Z";
let raw: KqStaffRawSnapshot, game: ReturnType<typeof startKqGame>, social: ReturnType<typeof createKqSocialSnapshot>;
let events: string[];

function readyTask(kind: KqStaffSkill) {
  const candidate = KQ_STAFF_CANDIDATES.find(row => row.code === (kind === "communication" ? "ines" : kind === "processing" ? "nora" : "anna"))!;
  const hired = applyKqStaffCommand(raw, { action: "hire", candidateCode: candidate.code, contract: "cdi", weeklyHours: 35,
    durationMonths: 0, reason: "permanent", expectedMonthlyCostCents: getKqStaffMonthlyCost(candidate, 35).totalCents }, employeeId);
  const assigned = applyKqStaffCommand({ ...raw, state: hired.state }, { action: "assign", employeeId, kind, hours: 1,
    ...(kind === "culture" ? { targetId: runId } : kind === "processing" ? { targetId: flowerId } : {}) }, key);
  raw = { ...raw, state: assigned.state, revision: 2, serverNow: assigned.state.tasks[0].completesAt };
  social = createKqSocialSnapshot(Date.parse(raw.serverNow), 0);
}

beforeEach(() => {
  vi.clearAllMocks(); events = []; game = startKqGame(31); game.care!.vitality = 70;
  raw = { state: null, revision: 0, serverNow: startedAt, cashCents: 1_000_000,
    context: { businessStartedAt: startedAt, reputation: 0, instagramFollowers: 0, shopPartners: 0,
      activeRuns: [{ id: runId, name: "Culture" }], supplierInvoices: [],
      processingBatches: [{ id: flowerId, flowerId, name: "Lot", startedAt, readyAt: "2026-11-02T04:00:00.000Z" }] } };
  social = createKqSocialSnapshot(Date.parse(startedAt), 0);
  db.from.mockImplementation((table: string) => {
    const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
      maybeSingle: async () => {
        events.push(`${table}:read`);
        return { data: { state: game, status: "active", updated_at: "2026-11-02T00:15:00.000Z" }, error: null };
      },
      then: (resolve: (value: unknown) => unknown) => {
        events.push(`${table}:list`);
        return Promise.resolve({ data: [], error: null }).then(resolve);
      },
    };
    return chain;
  });
  db.market.mockImplementation(async () => { events.push("market:read"); return { lots: [] }; });
  db.storage.mockResolvedValue({ serverNow: startedAt, lots: [] });
  db.rpc.mockImplementation(async (name, args) => {
    events.push(name);
    if (name === "rpc_kq_staff_snapshot") return { data: structuredClone(raw), error: null };
    if (name === "rpc_kq_staff_commit") {
      for (const effect of args.p_effects) {
        if (effect.kind === "culture") game.care!.vitality += effect.vitalityDelta;
        if (effect.kind === "communication") {
          social.platforms.instagram.followers += effect.instagramFollowers;
          social.socialFollowers += effect.instagramFollowers;
          social.audienceFollowers += effect.instagramFollowers;
        }
      }
      raw = { ...raw, state: args.p_state, revision: raw.revision + 1 };
      return { data: structuredClone(raw), error: null };
    }
    if (name === "rpc_kq_update_run_state" || name === "rpc_kq_roll_culture_step") return { data: { state: args.p_next_state }, error: null };
    if (name === "rpc_kq_care_intervention_receipt") return { data: null, error: null };
    if (name === "rpc_kq_social_v2_read") return { data: { state: social, reputation: 0, cashCents: 10000, replayed: false }, error: null };
    if (name === "rpc_kq_social_culture") return { data: { runs: [], lots: [] }, error: null };
    if (name === "rpc_kq_player_core_snapshot") return { data: null, error: { message: "fixture_core_unavailable" } };
    return { data: { success: true }, error: null };
  });
});

describe("staff completion before game operations", () => {
  it("commits earned culture help before reading and advancing the actual game state", async () => {
    readyTask("culture");
    const result = await applyKqPlayerRunAction(user, runId, "roll");
    expect(result.state.care!.vitality).toBeGreaterThan(70);
    expect(events).toEqual(["rpc_kq_staff_snapshot", "rpc_kq_staff_commit", "kq_runs:read", "rpc_kq_roll_culture_step"]);
    expect(raw.state!.tasks[0].status).toBe("completed");
  });

  it("finishes processing help before reading a preparation offer and committing it", async () => {
    readyTask("processing");
    await handleKqCommerceAction(user, { action: "prepare", flowerId, route: "hash", expectedCostCents: 300, requestKey: key });
    expect(events).toEqual(["rpc_kq_staff_snapshot", "rpc_kq_staff_commit", "market:read", "rpc_kq_commerce_command"]);
    const staffCommit = db.rpc.mock.calls.find(([name]) => name === "rpc_kq_staff_commit")!;
    expect(staffCommit[1].p_effects).toContainEqual(expect.objectContaining({ kind: "processing", flowerId, secondsSaved: expect.any(Number) }));
  });

  it("exposes completed communication in the next real social snapshot", async () => {
    readyTask("communication");
    const result = await getKqSocial(user);
    expect(result.platforms.instagram.followers).toBeGreaterThan(0);
    expect(events.slice(0, 3)).toEqual(["rpc_kq_staff_snapshot", "rpc_kq_staff_commit", "rpc_kq_social_v2_read"]);
  });

  it("accrues overdue payroll before reading Finances without automatically paying cash", async () => {
    readyTask("culture");
    raw.serverNow = new Date(Date.parse(startedAt) + 120 * 60 * 60 * 1000).toISOString();
    await expect(getKqTreasurySnapshot(user, { period: "current", offset: 0, limit: 25 })).rejects.toThrow("Incomplete accounting schema");
    expect(events).toEqual(["rpc_kq_staff_snapshot", "rpc_kq_staff_commit", "rpc_kq_treasury_snapshot"]);
    const committed = db.rpc.mock.calls.find(([name]) => name === "rpc_kq_staff_commit")![1];
    expect(committed.p_state.payroll).toContainEqual(expect.objectContaining({ paidCents: 0, totalCents: expect.any(Number) }));
    expect(committed.p_debit_cents).toBe(0);
  });

  it("keeps care receipt replay before any staff settlement or culture eligibility", async () => {
    const result = { replayed: true, state: { phase: "complete" } };
    db.rpc.mockResolvedValue({ data: result, error: null });
    expect(await applyKqPlayerCare({ userId: user, runId, requestKey: key, productCode: "CARE-SEAWEED" })).toEqual(result);
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_care_intervention_receipt", {
      p_user_id: user, p_run_id: runId, p_request_key: key, p_product_code: "CARE-SEAWEED",
    });
    expect(db.from).not.toHaveBeenCalled();
  });

  it("settles the run list before its first read", async () => {
    readyTask("culture");
    expect(await getKqPlayerRunsSnapshot(user)).toEqual({ activeRun: null, activeRuns: [] });
    expect(events).toEqual(["rpc_kq_staff_snapshot", "rpc_kq_staff_commit", "kq_runs:list"]);
  });

  it("settles core once before fan-out, without another read in its run sub-snapshot", async () => {
    readyTask("culture");
    await expect(getKqPlayerCoreSnapshot(user)).rejects.toThrow("fixture_core_unavailable");
    expect(events.slice(0, 3)).toEqual(["rpc_kq_staff_snapshot", "rpc_kq_staff_commit", "rpc_kq_player_core_snapshot"]);
    expect(events.filter(event => event === "rpc_kq_staff_snapshot")).toHaveLength(1);
  });

  it.each([
    ["training", finalizeKqPlayerBotBattle, "rpc_kq_prepare_flower_jury"],
    ["random", enqueueKqPlayerRandomBattle, "rpc_kq_enqueue_random_battle"],
  ] as const)("settles staff before the %s jury and explains its remaining trim gate", async (_label, enterJury, rpc) => {
    readyTask("culture");
    const normalRpc = db.rpc.getMockImplementation()!;
    db.rpc.mockImplementation(async (name, args) => {
      if (name !== rpc) return normalRpc(name, args);
      events.push(name);
      return { data: null, error: { message: "staff_trim_required" } };
    });
    await expect(enterJury(user, flowerId)).rejects.toThrow(/Termine le trim.*dans l’Atelier/);
    expect(events).toEqual(["rpc_kq_staff_snapshot", "rpc_kq_staff_commit", rpc]);
  });

  it("rejects invalid identities and malformed commerce requests before settlement", async () => {
    await expect(applyKqPlayerRunAction("bad", runId, "roll")).rejects.toThrow();
    await expect(getKqPlayerRunsSnapshot("bad")).rejects.toThrow();
    await expect(getKqSocial("bad")).rejects.toThrow();
    await expect(handleKqCommerceAction(user, { action: "sell", requestKey: key, quoteId: "bad", expectedPayoutCents: 100 })).rejects.toThrow();
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("does not advance gameplay past a failed staff settlement", async () => {
    db.rpc.mockResolvedValue({ data: null, error: { message: "staff_changed" } });
    await expect(applyKqPlayerRunAction(user, runId, "roll")).rejects.toThrow("planning");
    expect(db.from).not.toHaveBeenCalled();
  });
});
