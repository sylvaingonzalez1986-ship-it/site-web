import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./admin", () => ({ createSupabaseServiceClient: () => ({ rpc: mocks.rpc }) }));
import { applyKqStaffCommand, createKqStaffState, getKqStaffMonthlyCost, KQ_STAFF_CANDIDATES, type KqStaffRawSnapshot } from "@/lib/kanab-quest-staff";
import { KQ_GAME_MONTH_MS } from "@/lib/kanab-quest-business";
import { getKqStaffRehireOffer, handleKqStaffAction } from "./kanab-quest-staff-backend";

const user = "11111111-1111-4111-8111-111111111111", key = "22222222-2222-4222-8222-222222222222", sourceId = "33333333-3333-4333-8333-333333333333";
const start = "2026-11-02T00:00:00.000Z", candidate = KQ_STAFF_CANDIDATES[0];
function empty(): KqStaffRawSnapshot {
  return { state: createKqStaffState(start), revision: 0, serverNow: start, cashCents: 10_000_000,
    context: { businessStartedAt: start, reputation: 100, instagramFollowers: 500, shopPartners: 0, activeRuns: [], processingBatches: [], supplierInvoices: [], contractLifecycleVersion: 1, contractCooldowns: {} } };
}
function hired() {
  return applyKqStaffCommand(empty(), { action: "hire", candidateCode: candidate.code, contract: "cdd", weeklyHours: 35, durationMonths: 3, reason: "temporary-increase", expectedMonthlyCostCents: getKqStaffMonthlyCost(candidate, 35).totalCents }, sourceId).state;
}
function former() {
  const person = hired().employees[0];
  return { ...person, status: "ended" as const, finalPaid: true, skills: { culture: 1234, processing: 8100, communication: 99, sales: 401, administration: 432 }, workDays: { "90": { usedHours: 7, extraHours: 1 } } };
}
beforeEach(() => vi.clearAllMocks());

describe("contract commands use settled server evidence", () => {
  it("persists earned XP before extending a contract, without renewing pay or leave", async () => {
    let current: KqStaffRawSnapshot = { ...empty(), state: hired(), serverNow: new Date(Date.parse(start) + 3_600_000).toISOString() };
    current.state!.tasks.push({ id: "training", employeeId: sourceId, kind: "training", skill: "processing", hours: 2, skillLevel: 1, startedAt: start, completesAt: new Date(Date.parse(start) + 1_200_000).toISOString(), day: 1, status: "running", trainingCostCents: 7000 });
    const priorXp = current.state!.employees[0].skills.processing;
    mocks.rpc.mockImplementation(async (name, args) => {
      if (name === "rpc_kq_staff_receipt") return { data: null, error: null };
      if (name === "rpc_kq_staff_snapshot") return { data: structuredClone(current), error: null };
      expect(name).toBe("rpc_kq_staff_commit");
      if (args.p_command.action === "renew-contract") expect(current.state!.employees[0].skills.processing).toBeGreaterThan(priorXp);
      current = { ...current, revision: current.revision + 1, state: structuredClone(args.p_state) };
      return { data: structuredClone(current), error: null };
    });
    const initial = current.state!.employees[0];
    const result = await handleKqStaffAction(user, { action: "renew-contract", employeeId: sourceId, months: 3, expectedEndsAt: initial.endsAt, expectedMonthlyCostCents: getKqStaffMonthlyCost(initial, 35).totalCents, requestKey: key });
    expect(mocks.rpc.mock.calls.filter(([name]) => name === "rpc_kq_staff_commit").map(([, args]) => args.p_command.action)).toEqual(["settle", "renew-contract"]);
    expect(result.state.employees[0].endsAt).toBe(new Date(Date.parse(start) + 6 * KQ_GAME_MONTH_MS).toISOString());
    expect(result.state.employees[0].hiredAt).toBe(initial.hiredAt);
    expect(result.state.employees[0].nextPayrollAt).toBe(initial.nextPayrollAt);
    expect(result.cashCents).toBe(empty().cashCents);
  });
  it("copies persisted former skills and work history, ignoring forged request data", async () => {
    const source = former();
    let current = { ...empty(), serverNow: source.endsAt! };
    mocks.rpc.mockImplementation(async (name, args) => {
      if (name === "rpc_kq_staff_receipt") return { data: null, error: null };
      if (name === "rpc_kq_staff_snapshot") return { data: structuredClone(current), error: null };
      if (name === "rpc_kq_staff_contract_source") { expect(args).toEqual({ p_user_id: user, p_contract_id: sourceId }); return { data: structuredClone(source), error: null }; }
      expect(name).toBe("rpc_kq_staff_commit");
      current = { ...current, revision: current.revision + 1, state: structuredClone(args.p_state) };
      return { data: structuredClone(current), error: null };
    });
    const result = await handleKqStaffAction(user, { action: "rehire", sourceContractId: sourceId, contract: "cdi", weeklyHours: 35, durationMonths: 0, reason: "permanent", expectedMonthlyCostCents: getKqStaffMonthlyCost(source, 35).totalCents, requestKey: key, skills: { culture: 99999 }, hourlyCents: 1 });
    const person = result.state.employees[0];
    expect(person.id).not.toBe(sourceId); expect(person.personId).toBe(sourceId); expect(person.previousContractId).toBe(sourceId);
    expect(person.skills).toEqual(source.skills); expect(person.hourlyCents).toBe(source.hourlyCents);
    expect(person.workDays).toEqual(source.workDays); expect(person.leave).toEqual([]); expect(person.weeklyPlan?.enabled).not.toBe(true);
  });
  it("returns an already recorded confirmation before asking for a now unavailable source", async () => {
    const current = empty();
    mocks.rpc.mockResolvedValue({ data: current, error: null });
    await handleKqStaffAction(user, { action: "rehire", sourceContractId: sourceId, contract: "cdi", weeklyHours: 35, durationMonths: 0, reason: "permanent", expectedMonthlyCostCents: getKqStaffMonthlyCost(candidate, 35).totalCents, requestKey: key });
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(["rpc_kq_staff_receipt"]);
  });
  it("recovers a concurrently recorded rehire when its source becomes unavailable", async () => {
    const source = former();
    const command = { action: "rehire" as const, sourceContractId: sourceId, contract: "cdi" as const, weeklyHours: 35, durationMonths: 0, reason: "permanent" as const, expectedMonthlyCostCents: getKqStaffMonthlyCost(source, 35).totalCents };
    const current = empty();
    const priorCommit = { ...current, serverNow: source.endsAt!, revision: 1, state: applyKqStaffCommand({ ...current, serverNow: source.endsAt!, context: { ...current.context, rehireSource: source } }, command, "44444444-4444-4444-8444-444444444444").state };
    let lookups = 0;
    mocks.rpc.mockImplementation(async name => {
      if (name === "rpc_kq_staff_receipt") return { data: ++lookups === 1 ? null : priorCommit, error: null };
      if (name === "rpc_kq_staff_snapshot") return { data: current, error: null };
      expect(name).toBe("rpc_kq_staff_contract_source");
      return { data: null, error: { message: "staff_contract_unavailable" } };
    });
    const result = await handleKqStaffAction(user, { ...command, requestKey: key });
    expect(result.state).toEqual(priorCommit.state);
    expect(mocks.rpc.mock.calls.filter(([name]) => name === "rpc_kq_staff_receipt")).toHaveLength(2);
    expect(mocks.rpc.mock.calls.some(([name]) => name === "rpc_kq_staff_commit")).toBe(false);
  });
  it("does not expose a source from an unavailable or different account", async () => {
    mocks.rpc.mockImplementation(async name => name === "rpc_kq_staff_snapshot" ? { data: empty(), error: null } : { data: null, error: { message: "staff_contract_unavailable" } });
    await expect(getKqStaffRehireOffer(user, sourceId)).rejects.toThrow(/contrat/i);
    expect(mocks.rpc).toHaveBeenCalledWith("rpc_kq_staff_contract_source", { p_user_id: user, p_contract_id: sourceId });
  });
});
