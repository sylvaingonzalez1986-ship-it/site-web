import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: () => mocks }));
import { getArenaIntroductionState } from "./arena-introduction-backend";

const userId = "00000000-0000-4000-8000-000000000001";
type Result = { data: unknown[] | null; error: { code: string } | null };
const rows = new Map<string, Result>();
const queries = new Map<string, ReturnType<typeof query>>();

function query(result: Result) {
  const builder = {
    select: vi.fn(() => builder), eq: vi.fn(() => builder), in: vi.fn(() => builder),
    gt: vi.fn(() => builder), limit: vi.fn(() => builder), abortSignal: vi.fn(async () => result),
  };
  return builder;
}

beforeEach(() => {
  vi.clearAllMocks();
  rows.clear();
  queries.clear();
  mocks.from.mockImplementation((table: string) => {
    if (!["arena_journey_progress", "kq_runs", "kq_player_equipment"].includes(table)) throw new Error(`Unexpected read: ${table}`);
    const builder = query(rows.get(table) ?? { data: [], error: null });
    queries.set(table, builder);
    return builder;
  });
});

describe("first game introduction eligibility", () => {
  it("introduces an account without prior game activity using bounded private reads only", async () => {
    await expect(getArenaIntroductionState(userId)).resolves.toBe("new");
    expect([...queries.keys()]).toEqual(["arena_journey_progress", "kq_runs", "kq_player_equipment"]);
    for (const builder of queries.values()) {
      expect(builder.eq).toHaveBeenCalledWith("user_id", userId);
      expect(builder.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
    }
    expect(queries.get("arena_journey_progress")?.in).toHaveBeenCalledWith("version", [1, 2]);
    expect(queries.get("arena_journey_progress")?.limit).toHaveBeenCalledWith(2);
    expect(queries.get("kq_runs")?.limit).toHaveBeenCalledWith(1);
    expect(queries.get("kq_player_equipment")?.gt).toHaveBeenCalledWith("purchase_price_cents", 0);
    expect(queries.get("kq_player_equipment")?.limit).toHaveBeenCalledWith(1);
  });

  it.each(["active", "completed", "skipped"])("preserves a previously %s introduction without bootstrapping player state", async status => {
    rows.set("arena_journey_progress", { data: [{ version: 2, status }], error: null });
    await expect(getArenaIntroductionState(userId)).resolves.toBe("seen");
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith("arena_journey_progress");
  });

  it("preserves the first historical edition even alongside a new second edition", async () => {
    rows.set("arena_journey_progress", { data: [{ version: 1, status: "completed" }, { version: 2, status: "new" }], error: null });
    await expect(getArenaIntroductionState(userId)).resolves.toBe("seen");
  });

  it.each(["kq_runs", "kq_player_equipment"])("leaves veterans with %s activity in their live game", async table => {
    rows.set(table, { data: [{ id: "existing-activity" }], error: null });
    await expect(getArenaIntroductionState(userId)).resolves.toBe("seen");
  });

  it("does not treat a saved new preference or reward-only wallet as prior gameplay", async () => {
    rows.set("arena_journey_progress", { data: [{ version: 2, status: "new" }], error: null });
    await expect(getArenaIntroductionState(userId)).resolves.toBe("new");
    expect(mocks.from).not.toHaveBeenCalledWith("kq_equipment_wallets");
  });

  it.each(["arena_journey_progress", "kq_runs", "kq_player_equipment"])("reports uncertainty when %s cannot be read", async table => {
    rows.set(table, { data: null, error: { code: "42501" } });
    await expect(getArenaIntroductionState(userId)).resolves.toBe("unavailable");
  });

  it("still recognizes a veteran when the preference table is unavailable", async () => {
    rows.set("arena_journey_progress", { data: null, error: { code: "42P01" } });
    rows.set("kq_runs", { data: [{ id: "previous-run" }], error: null });
    await expect(getArenaIntroductionState(userId)).resolves.toBe("seen");
  });

  it("does not fail the game page when the database client or request fails", async () => {
    mocks.from.mockImplementation(() => { throw new Error("Private database detail"); });
    await expect(getArenaIntroductionState(userId)).resolves.toBe("unavailable");
  });
});
