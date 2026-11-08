import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./admin", () => ({ createSupabaseServiceClient: () => ({ rpc: mocks.rpc }) }));
import { getKqStaffArchive, getKqStaffSnapshot } from "./kanab-quest-staff-backend";
import { KQ_STAFF_CANDIDATES } from "../kanab-quest-staff";

const user = "11111111-1111-4111-8111-111111111111", employeeId = "33333333-3333-4333-8333-333333333333";
const at = "2026-11-07T10:00:00.123456+00:00";
const contract = { ...KQ_STAFF_CANDIDATES[0], id: employeeId, contract: "seasonal", reason: "harvest", leave: [], weeklyHours: 35, status: "ended", finalPaid: true, hiredAt: "2026-11-01T00:00:00Z", endsAt: at, grossEarnedCents: 10000 };
const payroll = { id: `${employeeId}:end`, employeeId, dueAt: at, grossCents: 1000, employerCents: 400, indemnityCents: 200, totalCents: 1600, paidCents: 1600 };
const task = { id: "task-1", employeeId, kind: "training", skill: "culture", hours: 2, startedAt: "2026-11-01T00:00:00Z", completesAt: at, status: "completed", trainingCostCents: 7000, outcome: "+120 XP en culture." };
beforeEach(() => { vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ data: { items: [], nextCursor: null }, error: null }); });

describe("staff durable archive reader", () => {
  it("reads only the archive RPC and preserves precise cursor values", async () => {
    mocks.rpc.mockResolvedValue({ data: { items: [contract], nextCursor: { at, id: employeeId } }, error: null });
    const result = await getKqStaffArchive(user, { afterAt: at, afterId: employeeId });
    expect(result.items).toEqual([contract]); expect(result.nextCursor?.at).toBe(at);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_staff_archive", { p_user_id: user, p_kind: "contract", p_employee_id: null, p_cursor: { at, id: employeeId } });
  });
  it.each([["payroll", payroll], ["task", task]] as const)("reads %s for the requested archived contract", async (kind, item) => {
    mocks.rpc.mockResolvedValue({ data: { items: [item], nextCursor: null }, error: null });
    expect((await getKqStaffArchive(user, { kind, employeeId })).items).toEqual([item]);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_staff_archive", { p_user_id: user, p_kind: kind, p_employee_id: employeeId, p_cursor: null });
  });
  it.each([
    { kind: "constructor" }, { kind: "payroll" }, { kind: "task", employeeId: "forged" }, { kind: "contract", employeeId },
    { afterAt: at }, { afterId: "task-1" }, { afterAt: "invalid", afterId: "task-1" }, { afterAt: at, afterId: "x".repeat(201) },
    { afterAt: at, afterId: "bad\nvalue" }, { kind: "" },
  ])("rejects invalid input before RPC: %j", async query => {
    await expect(getKqStaffArchive(user, query)).rejects.toThrow("archives est invalide"); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects a malformed owner without database access", async () => {
    await expect(getKqStaffArchive("forged")).rejects.toThrow("Identifiant"); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([
    ["contract", { ...contract, status: "active" }], ["contract", { ...contract, hourlyCents: -1 }], ["contract", { ...contract, id: "invalid" }],
    ["payroll", { ...payroll, employeeId: user }], ["payroll", { ...payroll, paidCents: 0 }], ["payroll", { ...payroll, totalCents: 1, paidCents: 1 }],
    ["task", { ...task, employeeId: user }], ["task", { ...task, status: "running" }], ["task", { ...task, skill: "invalid" }],
  ])("fails closed for inconsistent %s evidence", async (kind, item) => {
    mocks.rpc.mockResolvedValue({ data: { items: [item], nextCursor: null }, error: null });
    await expect(getKqStaffArchive(user, { kind: kind as string, ...(kind === "contract" ? {} : { employeeId }) })).rejects.toThrow("invalid_archive");
  });
  it("distinguishes an empty owner-scoped page from an unavailable archive", async () => {
    await expect(getKqStaffArchive(user, { kind: "payroll", employeeId })).resolves.toEqual({ items: [], nextCursor: null });
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "function unavailable" } });
    await expect(getKqStaffArchive(user)).rejects.toThrow("staff_migration_required");
  });
  it("accepts a historical contract with no recorded end date", async () => {
    mocks.rpc.mockResolvedValue({ data: { items: [{ ...contract, endsAt: null }], nextCursor: null }, error: null });
    expect((await getKqStaffArchive(user)).items).toHaveLength(1);
  });
  it("rejects missing cursor data and unbounded pages", async () => {
    mocks.rpc.mockResolvedValue({ data: { items: [contract] }, error: null });
    await expect(getKqStaffArchive(user)).rejects.toThrow("invalid_archive");
    mocks.rpc.mockResolvedValue({ data: { items: Array(21).fill(contract), nextCursor: null }, error: null });
    await expect(getKqStaffArchive(user)).rejects.toThrow("invalid_archive");
  });
  it("preserves migration capability without inventing a zero count for legacy farms", async () => {
    const raw = { state: null, revision: 0, serverNow: at, cashCents: 100000, context: { businessStartedAt: at, reputation: 0, instagramFollowers: 0, shopPartners: 0, activeRuns: [], processingBatches: [], supplierInvoices: [] } };
    mocks.rpc.mockResolvedValue({ data: raw, error: null });
    expect((await getKqStaffSnapshot(user)).archiveCount).toBeUndefined();
    mocks.rpc.mockResolvedValue({ data: { ...raw, archiveCount: 40 }, error: null });
    expect((await getKqStaffSnapshot(user)).archiveCount).toBe(40);
    mocks.rpc.mockResolvedValue({ data: { ...raw, archiveCount: -1 }, error: null });
    await expect(getKqStaffSnapshot(user)).rejects.toThrow("invalid_snapshot");
  });
});
