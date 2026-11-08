import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./admin", () => ({ createSupabaseServiceClient: () => ({ rpc: mocks.rpc }) }));
import { applyKqStaffCommand, createKqStaffState, getKqStaffMonthlyCost, KQ_STAFF_CANDIDATES, parseKqStaffCommand, type KqStaffCommand, type KqStaffRawSnapshot } from "@/lib/kanab-quest-staff";
import { KQ_GAME_DAY_MS } from "@/lib/kanab-quest-business";
import { getKqStaffSnapshot, handleKqStaffAction, settleKqStaffIfAvailable } from "./kanab-quest-staff-backend";

const user = "11111111-1111-4111-8111-111111111111", key = "22222222-2222-4222-8222-222222222222";
const now = "2026-11-02T00:00:00.000Z";
const raw = () => ({ state: null, revision: 0, serverNow: now, cashCents: 1_000_000, context: { businessStartedAt: now, reputation: 100, instagramFollowers: 500, shopPartners: 0, activeRuns: [], processingBatches: [], supplierInvoices: [] } });
const hire = () => ({ requestKey: key, action: "hire", candidateCode: "anna", contract: "cdi", weeklyHours: 35, durationMonths: 0, reason: "permanent", expectedMonthlyCostCents: getKqStaffMonthlyCost(KQ_STAFF_CANDIDATES[0], 35).totalCents });
const day16 = new Date(Date.parse(now) + 15 * KQ_GAME_DAY_MS).toISOString();
const hired = () => applyKqStaffCommand(raw(), parseKqStaffCommand(hire()), "33333333-3333-4333-8333-333333333333").state;
const benefits = () => ({ trackedSince: now, lastBenefitAt: null, lastAdministration: null, supplierSavingsCents: 0, supplierBaseCents: 0, supplierNetCents: 0,
  discountedInvoices: 0, followersGained: 0, partnersGained: 0, invoicesPaidCount: 0, invoicesPaidCents: 0,
  payrollPaidCount: 0, payrollPaidCents: 0, cultureHoursDelegated: 0, processingHoursDelegated: 0, processingSecondsSaved: 0, trimGrams: 0 });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockImplementation(async (name, args) => name === "rpc_kq_staff_receipt" ? { data: null, error: null } : name === "rpc_kq_staff_commit" ? { data: { ...raw(), revision: 1, state: args.p_state }, error: null } : { data: raw(), error: null });
});
describe("staff server authority", () => {
  it.each([false, true])("settles authorized weekly departures before pausing, with no second debit under contention (%s)", async contended => {
    const employeeId = hired().employees[0].id;
    const days = [[], [{ kind: "training" as const, skill: "processing" as const, hours: 2 }], [], [], []];
    let current: KqStaffRawSnapshot = { ...raw(), state: hired(), archiveCount: 0, context: { ...raw().context, weeklyPlanVersion: 1 } };
    current.state = applyKqStaffCommand(current, { action: "set-weekly-plan", employeeId, enabled: true, days, expectedWeeklyCostCents: 7000 }, "plan").state;
    current.serverNow = new Date(Date.parse(now) + KQ_GAME_DAY_MS * (1 + 3 / 24)).toISOString();
    let race = contended;
    const receipts = new Map<string, KqStaffCommand>();
    mocks.rpc.mockImplementation(async (name, args) => {
      if (name === "rpc_kq_staff_receipt") return { data: receipts.has(args.p_request_key) ? structuredClone(current) : null, error: null };
      if (name === "rpc_kq_staff_snapshot") return { data: structuredClone(current), error: null };
      expect(name).toBe("rpc_kq_staff_commit");
      expect(args.p_expected_revision).toBe(current.revision);
      current = { ...current, state: structuredClone(args.p_state), cashCents: current.cashCents - args.p_debit_cents, revision: current.revision + 1 };
      if (race) { race = false; return { data: null, error: { message: "staff_changed" } }; }
      receipts.set(args.p_request_key, args.p_command);
      return { data: structuredClone(current), error: null };
    });
    const command = { action: "set-weekly-plan", requestKey: key, employeeId, enabled: false, days, expectedWeeklyCostCents: 7000 };
    const paused = await handleKqStaffAction(user, command);
    expect(paused.state.employees[0].weeklyPlan?.enabled).toBe(false);
    expect(paused.state.tasks).toHaveLength(1);
    expect(paused.state.tasks[0]).toMatchObject({ status: "completed", weeklyCostCents: 7000, hours: 2 });
    expect(paused.state.employees[0].skills.processing).toBe(150);
    expect(paused.cashCents).toBe(raw().cashCents - 7000);
    const commits = mocks.rpc.mock.calls.filter(([name]) => name === "rpc_kq_staff_commit");
    expect(commits.map(([, args]) => [args.p_command.action, args.p_debit_cents])).toEqual([["settle", 7000], ["set-weekly-plan", 0]]);
    expect(commits[0][1].p_request_key).not.toBe(key);
    const beforeReplay = structuredClone(current);
    await handleKqStaffAction(user, command);
    await getKqStaffSnapshot(user);
    expect(current).toEqual(beforeReplay);
  });
  it("keeps catch-up training charges outside the explicitly confirmed payroll amount", async () => {
    const member = hired().employees[0];
    const days = [[], [{ kind: "training" as const, skill: "processing" as const, hours: 2 }], [], [], []];
    let current: KqStaffRawSnapshot = { ...raw(), state: hired(), archiveCount: 0, context: { ...raw().context, weeklyPlanVersion: 1 } };
    current.state = applyKqStaffCommand(current, { action: "set-weekly-plan", employeeId: member.id, enabled: true, days, expectedWeeklyCostCents: 7000 }, "plan").state;
    current.serverNow = member.nextPayrollAt;
    mocks.rpc.mockImplementation(async (name, args) => {
      if (name === "rpc_kq_staff_receipt") return { data: null, error: null };
      if (name === "rpc_kq_staff_snapshot") return { data: structuredClone(current), error: null };
      expect(args.p_expected_revision).toBe(current.revision);
      current = { ...current, state: structuredClone(args.p_state), cashCents: current.cashCents - args.p_debit_cents, revision: current.revision + 1 };
      return { data: structuredClone(current), error: null };
    });
    const salary = getKqStaffMonthlyCost(member, member.weeklyHours).totalCents;
    const result = await handleKqStaffAction(user, { action: "payroll", expectedCents: salary, requestKey: key });
    const commits = mocks.rpc.mock.calls.filter(([name]) => name === "rpc_kq_staff_commit");
    expect(commits.map(([, args]) => [args.p_command.action, args.p_debit_cents])).toEqual([["settle", 35000], ["payroll", salary]]);
    expect(result.outstandingCents).toBe(0);
    expect(result.cashCents).toBe(raw().cashCents - 35000 - salary);
  });
  it("reads empty farms without creating a financial command", async () => {
    const result = await getKqStaffSnapshot(user);
    expect(result.candidates).toHaveLength(11); expect(result.state.employees).toHaveLength(0);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_staff_snapshot", { p_user_id: user });
  });
  it("builds the persisted contract on the server and strips invented effects and salaries", async () => {
    const result = await handleKqStaffAction(user, { ...hire(), userId: key, state: { employees: [] }, hourlyCents: 1, effects: [{ kind: "sales", shopPartners: 999 }], debitCents: -1000 });
    expect(result.state.employees[0]).toMatchObject({ code: "anna", hourlyCents: 1231, weeklyHours: 35 });
    expect(mocks.rpc.mock.calls[2]).toEqual(["rpc_kq_staff_commit", expect.objectContaining({ p_user_id: user, p_debit_cents: 0, p_effects: [], p_request_key: key, p_command: { ...hire(), requestKey: undefined } })]);
  });
  it("returns an existing receipt before eligibility and never executes the hire twice", async () => {
    const state = createKqStaffState(now);
    mocks.rpc.mockResolvedValueOnce({ data: { ...raw(), state, revision: 3, replayed: true }, error: null });
    expect((await handleKqStaffAction(user, hire())).revision).toBe(3);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("rejects the previous recruitment offer at day 16 without committing or trusting a client clock", async () => {
    mocks.rpc.mockImplementation(async name => {
      if (name === "rpc_kq_staff_receipt") return { data: null, error: null };
      if (name === "rpc_kq_staff_snapshot") return { data: { ...raw(), serverNow: day16 }, error: null };
      throw new Error(`Unexpected RPC: ${name}`);
    });
    await expect(handleKqStaffAction(user, { ...hire(), serverNow: now })).rejects.toThrow(/candidat/i);
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(["rpc_kq_staff_receipt", "rpc_kq_staff_snapshot", "rpc_kq_staff_receipt"]);
    expect(mocks.rpc.mock.calls[2][1]).toEqual({ p_user_id: user, p_request_key: key, p_command: parseKqStaffCommand(hire()) });
  });
  it("replays a successful hire after recruitment rotates and projects the current offers", async () => {
    const state = hired();
    mocks.rpc.mockResolvedValueOnce({ data: { ...raw(), serverNow: day16, state, revision: 3, replayed: true }, error: null });
    const result = await handleKqStaffAction(user, hire());
    expect(result.state.employees).toEqual(state.employees);
    expect(result.state.employees).toHaveLength(1);
    expect(result.recruitment).toMatchObject({ cycle: 1, startDay: 16, nextDay: 31 });
    expect(result.candidates.some(candidate => candidate.code === "staff-1-anna")).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_staff_receipt", { p_user_id: user, p_request_key: key, p_command: parseKqStaffCommand(hire()) });
  });
  it("rechecks offer eligibility when a revision retry crosses the recruitment boundary", async () => {
    let reads = 0;
    mocks.rpc.mockImplementation(async name => {
      if (name === "rpc_kq_staff_receipt") return { data: null, error: null };
      if (name === "rpc_kq_staff_snapshot") {
        reads += 1;
        return { data: { ...raw(), revision: reads - 1, serverNow: reads === 1 ? new Date(Date.parse(day16) - 1).toISOString() : day16 }, error: null };
      }
      return { data: null, error: { message: "staff_changed" } };
    });
    await expect(handleKqStaffAction(user, hire())).rejects.toThrow(/candidat/i);
    expect(reads).toBe(2);
    const commits = mocks.rpc.mock.calls.filter(([name]) => name === "rpc_kq_staff_commit");
    expect(commits).toHaveLength(1);
    expect(commits[0][1]).toMatchObject({ p_expected_revision: 0, p_request_key: key, p_command: parseKqStaffCommand(hire()) });
    expect(commits[0][1].p_state.employees[0].hiredAt).toBe(new Date(Date.parse(day16) - 1).toISOString());
  });
  it("returns a receipt committed concurrently after the first lookup and before eligibility", async () => {
    const state = hired();
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { ...raw(), state, revision: 1 }, error: null })
      .mockResolvedValueOnce({ data: { ...raw(), state, revision: 1, replayed: true }, error: null });
    const result = await handleKqStaffAction(user, hire());
    expect(result.state.employees).toEqual(state.employees);
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(["rpc_kq_staff_receipt", "rpc_kq_staff_snapshot", "rpc_kq_staff_receipt"]);
    expect(mocks.rpc.mock.calls[2][1]).toEqual(mocks.rpc.mock.calls[0][1]);
  });
  it.each([
    ["staff_request_mismatch", "Cette confirmation a déjà servi à une autre opération."],
    ["database unavailable", "[supabase:staff] database unavailable"],
  ])("propagates %s from the receipt recheck instead of hiding it behind eligibility", async (message, expected) => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { ...raw(), state: hired(), revision: 1 }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message } });
    await expect(handleKqStaffAction(user, hire())).rejects.toThrow(expected);
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(["rpc_kq_staff_receipt", "rpc_kq_staff_snapshot", "rpc_kq_staff_receipt"]);
  });
  it("retries revision contention with the same receipt key and server employee id", async () => {
    let attempts = 0;
    mocks.rpc.mockImplementation(async (name, args) => {
      if (name === "rpc_kq_staff_receipt") return { data: null, error: null };
      if (name === "rpc_kq_staff_snapshot") return { data: { ...raw(), revision: attempts }, error: null };
      return ++attempts === 1 ? { data: null, error: { message: "staff_changed" } } : { data: { ...raw(), state: args.p_state, revision: 2 }, error: null };
    });
    await handleKqStaffAction(user, hire());
    const commits = mocks.rpc.mock.calls.filter(([name]) => name === "rpc_kq_staff_commit");
    expect(commits).toHaveLength(2);
    expect(commits[0][1].p_state.employees[0].id).toBe(commits[1][1].p_state.employees[0].id);
    expect(commits.map(call => call[1].p_request_key)).toEqual([key, key]);
  });
  it("recomputes personal hours on the new server day with the same confirmation and task id", async () => {
    let attempts = 0;
    mocks.rpc.mockImplementation(async (name, args) => {
      if (name === "rpc_kq_staff_receipt") return { data: null, error: null };
      if (name === "rpc_kq_staff_snapshot") return { data: { ...raw(), serverNow: new Date(Date.parse(now) + attempts * KQ_GAME_DAY_MS).toISOString() }, error: null };
      return ++attempts === 1 ? { data: null, error: { message: "player_work_changed" } } : { data: { ...raw(), state: args.p_state, serverNow: new Date(Date.parse(now) + KQ_GAME_DAY_MS).toISOString(), revision: 1 }, error: null };
    });
    const result = await handleKqStaffAction(user, { action: "player-assign", kind: "countryside", department: "29", hours: 12, expectedCostCents: 4000, requestKey: key });
    const commits = mocks.rpc.mock.calls.filter(([name]) => name === "rpc_kq_staff_commit");
    expect(commits).toHaveLength(2);
    expect(commits[0][1].p_state.tasks[0].id).toBe(commits[1][1].p_state.tasks[0].id);
    expect(commits.map(call => call[1].p_request_key)).toEqual([key, key]);
    expect(result.state.playerWorkDays).toEqual({ "2": { usedHours: 12 } });
    expect(result.calendar.day).toBe(2);
  });
  it("rechecks shared hours after another game action wins the revision race", async () => {
    let reads = 0;
    mocks.rpc.mockImplementation(async name => {
      if (name === "rpc_kq_staff_receipt") return { data: null, error: null };
      if (name === "rpc_kq_staff_snapshot") {
        const state = createKqStaffState(now); state.playerWorkDays["1"] = { usedHours: ++reads === 1 ? 10 : 11.5 };
        return { data: { ...raw(), state, revision: reads }, error: null };
      }
      return { data: null, error: { message: "staff_changed" } };
    });
    await expect(handleKqStaffAction(user, { action: "player-assign", kind: "sales", cityId: "brest", hours: 2, expectedCostCents: 6000, requestKey: key })).rejects.toThrow(/12 h/);
    expect(mocks.rpc.mock.calls.filter(([name]) => name === "rpc_kq_staff_commit")).toHaveLength(1);
    expect(reads).toBe(2);
  });
  it("settles repeated prospects beyond 100 partners and replays their receipts without paying or granting twice", async () => {
    let current: KqStaffRawSnapshot = { ...raw(), state: hired(), context: { ...raw().context, shopPartners: 125 } };
    current.state!.prospecting.rennes = 100;
    const receipts = new Map<string, KqStaffCommand>();
    mocks.rpc.mockImplementation(async (name, args) => {
      if (name === "rpc_kq_staff_receipt") {
        if (!receipts.has(args.p_request_key)) return { data: null, error: null };
        expect(args.p_command).toEqual(receipts.get(args.p_request_key));
        return { data: { ...structuredClone(current), replayed: true }, error: null };
      }
      if (name === "rpc_kq_staff_snapshot") return { data: structuredClone(current), error: null };
      expect(name).toBe("rpc_kq_staff_commit");
      expect(args.p_expected_revision).toBe(current.revision);
      current = { ...current, state: args.p_state, cashCents: current.cashCents - args.p_debit_cents, revision: current.revision + 1 };
      for (const effect of args.p_effects) if (effect.kind === "sales") current.context.shopPartners += effect.shopPartners;
      receipts.set(args.p_request_key, args.p_command);
      return { data: structuredClone(current), error: null };
    });
    const command = { requestKey: key, action: "assign", employeeId: current.state!.employees[0].id, kind: "sales", hours: 2, cityId: "rennes", expectedCostCents: 4500 };
    await handleKqStaffAction(user, command);
    await handleKqStaffAction(user, command);
    expect(current.state!.tasks).toHaveLength(1);
    expect(current.cashCents).toBe(raw().cashCents - 4500);
    await handleKqStaffAction(user, { ...command, requestKey: "44444444-4444-4444-8444-444444444444" });
    for (const task of current.state!.tasks) task.successChance = 100;
    current.serverNow = new Date(Math.max(...current.state!.tasks.map(task => Date.parse(task.completesAt)))).toISOString();
    const settled = await getKqStaffSnapshot(user);
    expect(settled.context.shopPartners).toBe(127);
    expect(settled.state.prospecting.rennes).toBe(102);
    expect(settled.state.tasks.every(task => task.status === "completed")).toBe(true);
    const beforeReplay = structuredClone(current);
    await getKqStaffSnapshot(user);
    const replayed = await handleKqStaffAction(user, command);
    expect(current).toEqual(beforeReplay);
    expect(replayed.context.shopPartners).toBe(127);
    expect(current.cashCents).toBe(raw().cashCents - 9000);
    const commits = mocks.rpc.mock.calls.filter(([name]) => name === "rpc_kq_staff_commit");
    expect(commits).toHaveLength(3);
    expect(commits[2][1]).toMatchObject({ p_command: { action: "settle" }, p_debit_cents: 0, p_effects: [{ kind: "sales", shopPartners: 1, reputation: 5 }, { kind: "sales", shopPartners: 1, reputation: 5 }] });
  });
  it("does not swallow unavailable data or financial failures", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "staff_cash" } });
    await expect(handleKqStaffAction(user, hire())).rejects.toThrow("Trésorerie insuffisante");
    await expect(settleKqStaffIfAvailable(user)).rejects.toThrow("Trésorerie insuffisante");
  });
  it("recomputes partial shared trim after a concurrent settlement without crediting the same grams twice", async () => {
    const current: KqStaffRawSnapshot = { ...raw(), archiveCount: 0, context: { ...raw().context, trimQueueVersion: 2,
      trimLots: [{ flowerId: key, name: "Chanvre", requiredWork: 6, completedWork: 0, totalGrams: 1000, completedGrams: 0, createdAt: now, mode: null, completedAt: null }] } };
    current.state = applyKqStaffCommand(current, { action: "trim", employeeId: null, hours: 1, mode: "manual", expectedCostCents: 0 }, "player-shift").state;
    current.serverNow = new Date(Date.parse(now) + KQ_GAME_DAY_MS / 48).toISOString();
    let commits = 0;
    mocks.rpc.mockImplementation(async (name, args) => {
      if (name === "rpc_kq_staff_snapshot") return { data: structuredClone(current), error: null };
      expect(name).toBe("rpc_kq_staff_commit");
      if (++commits === 1) {
        const earlier = new Date(Date.parse(now) + KQ_GAME_DAY_MS / 96).toISOString();
        const concurrent = applyKqStaffCommand({ ...current, serverNow: earlier }, { action: "settle" }, "other-read");
        current.state = concurrent.state; current.revision++;
        current.context.trimLots![0].completedGrams = 15;
        current.context.trimLots![0].mode = "manual";
        return { data: null, error: { message: "staff_changed" } };
      }
      expect(args.p_expected_revision).toBe(current.revision);
      expect(args.p_effects).toEqual([{ kind: "trim-work", unit: "g", flowerId: key, mode: "manual", work: 15, qualityDelta: 1 }]);
      current.state = args.p_state; current.revision++;
      current.context.trimLots![0].completedGrams! += 15;
      return { data: structuredClone(current), error: null };
    });
    const settled = await getKqStaffSnapshot(user);
    expect(settled.state.tasks[0]).toMatchObject({ trimGrams: 30, status: "running" });
    expect(settled.context.trimLots![0].completedGrams).toBe(30);
    expect(settled.state.playerWorkDays).toEqual({ "1": { usedHours: 1 } });
    await getKqStaffSnapshot(user);
    expect(commits).toBe(2);
  });

  it("replays a shared trim confirmation without a flower choice or a second hour reservation", async () => {
    let current: KqStaffRawSnapshot = { ...raw(), context: { ...raw().context, trimQueueVersion: 2,
      trimLots: [{ flowerId: key, name: "Chanvre", requiredWork: 6, completedWork: 0, totalGrams: 60, completedGrams: 0, createdAt: now, mode: null, completedAt: null }] } };
    let saved: KqStaffCommand | null = null;
    mocks.rpc.mockImplementation(async (name, args) => {
      if (name === "rpc_kq_staff_receipt") {
        if (saved) expect(args.p_command).toEqual(saved);
        return { data: saved ? structuredClone(current) : null, error: null };
      }
      if (name === "rpc_kq_staff_snapshot") return { data: structuredClone(current), error: null };
      saved = args.p_command;
      expect(saved).not.toHaveProperty("flowerId");
      current = { ...current, state: args.p_state, revision: 1 };
      return { data: structuredClone(current), error: null };
    });
    const input = { action: "trim", employeeId: null, mode: "manual", hours: 1, expectedCostCents: 0, requestKey: key };
    await handleKqStaffAction(user, input);
    const replay = await handleKqStaffAction(user, input);
    expect(replay.state.tasks).toHaveLength(1);
    expect(replay.state.playerWorkDays).toEqual({ "1": { usedHours: 1 } });
    expect(mocks.rpc.mock.calls.filter(([name]) => name === "rpc_kq_staff_commit")).toHaveLength(1);
  });
  it("keeps legacy farms accessible before deployment but the staff desk fails closed", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "rpc_kq_staff_snapshot missing" } });
    await expect(getKqStaffSnapshot(user)).rejects.toThrow("staff_migration_required");
    await expect(settleKqStaffIfAvailable(user)).resolves.toBeUndefined();
  });
  it("rejects malformed identities and commands without database calls", async () => {
    await expect(handleKqStaffAction("bad", hire())).rejects.toThrow();
    await expect(handleKqStaffAction(user, { ...hire(), requestKey: "bad" })).rejects.toThrow();
    await expect(handleKqStaffAction(user, { ...hire(), contract: "constructor" })).rejects.toThrow();
    await expect(handleKqStaffAction(user, { ...hire(), weeklyHours: "35" })).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects incomplete authoritative state instead of inventing finances", async () => {
    mocks.rpc.mockResolvedValue({ data: { state: null, revision: 1 }, error: null });
    await expect(getKqStaffSnapshot(user)).rejects.toThrow("invalid_snapshot");
  });
  it("keeps measured benefits from the server, including known zero results", async () => {
    const measured = { ...benefits(), supplierBaseCents: 22000, supplierNetCents: 20680, supplierSavingsCents: 1320, discountedInvoices: 1, cultureHoursDelegated: .5, lastBenefitAt: now };
    mocks.rpc.mockResolvedValue({ data: { ...raw(), context: { ...raw().context, staffBenefitsVersion: 1 }, benefits: measured }, error: null });
    expect((await getKqStaffSnapshot(user)).benefits).toEqual(measured);
  });
  it.each([
    undefined,
    { ...benefits(), supplierSavingsCents: 100 },
    { ...benefits(), cultureHoursDelegated: -1 },
    { ...benefits(), partnersGained: .5 },
    { ...benefits(), trackedSince: "unknown" },
  ])("rejects missing or inconsistent measured benefits (%j)", async measured => {
    mocks.rpc.mockResolvedValue({ data: { ...raw(), context: { ...raw().context, staffBenefitsVersion: 1 }, benefits: measured }, error: null });
    await expect(getKqStaffSnapshot(user)).rejects.toThrow("invalid_snapshot");
  });
  it("persists only confirmed delegation rules with the server timestamp and no immediate debit", async () => {
    const state = hired();
    const current = { ...raw(), state, benefits: benefits(), context: { ...raw().context, staffBenefitsVersion: 1 as const } };
    mocks.rpc.mockImplementation(async (name, args) => name === "rpc_kq_staff_receipt" ? { data: null, error: null }
      : name === "rpc_kq_staff_commit" ? { data: { ...current, state: args.p_state, revision: 1 }, error: null }
        : { data: current, error: null });
    const command = { action: "set-administration-rules", employeeId: state.employees[0].id, enabled: true, paySuppliers: true,
      payPayroll: false, maxDailyCents: 100000, cashReserveCents: 200000, supplierDueDays: 1 };
    const result = await handleKqStaffAction(user, { ...command, requestKey: key, updatedAt: "2020-01-01", state: { payroll: [] }, debitCents: 999 });
    expect(result.state.administrationRules).toEqual({ ...command, action: undefined, updatedAt: now });
    const committed = mocks.rpc.mock.calls.find(([name]) => name === "rpc_kq_staff_commit")![1];
    expect(committed).toMatchObject({ p_command: command, p_debit_cents: 0, p_effects: [] });
    expect(committed.p_command).not.toHaveProperty("updatedAt");
  });
});
