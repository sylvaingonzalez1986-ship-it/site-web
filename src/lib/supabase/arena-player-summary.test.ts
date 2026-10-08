import { beforeEach, describe, expect, it, vi } from "vitest";
const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: () => ({ from }) }));
import { getArenaPlayerSummary } from "./arena-player-summary";

const userId = "11111111-1111-4111-8111-111111111111";
type Row = Record<string, string | number>;
type Filter = { method: "eq" | "neq" | "gt"; column: string; value: unknown };
let rows: Record<string, Row[]>;
let failure: string | null;
let emptySecondPage: boolean;
let calls: { table: string; selected: string; options: { count?: string; head?: boolean }; filters: Filter[]; range?: [number, number] }[];
const flower = (id: string, status = "burned", owner_id = userId): Row => ({ id, owner_id, status });
const lot = (flower_id: string, status: string, owner_id = userId): Row => ({ flower_id, owner_id, status });
const stock = (id: string, flower_id: string, remaining_units: number, user_id = userId): Row => ({ id, flower_id, remaining_units, user_id });

beforeEach(() => {
  vi.clearAllMocks(); failure = null; emptySecondPage = false; calls = [];
  rows = {
    kq_runs: [{ id: "run", user_id: userId, status: "active" }, { id: "foreign-run", user_id: "other", status: "active" }],
    kq_flowers: [flower("new-harvest"), flower("ready-harvest"), flower("processed"), flower("sold"), flower("exhausted"), flower("to-judge", "available"), flower("foreign", "burned", "other")],
    kq_market_lots: [lot("ready-harvest", "ready"), lot("processed", "stocked"), lot("sold", "sold"), lot("exhausted", "stocked"), lot("foreign", "ready", "other")],
    kq_commerce_stock: [stock("product", "processed", 100), stock("leftovers", "processed", 20), stock("empty", "exhausted", 0), stock("already-sold", "sold", 0), stock("foreign-stock", "foreign", 300, "other")],
    kq_support_booster_entitlements: [{ id: "pack", user_id: userId, status: "available" }, { id: "opened", user_id: userId, status: "opened" }],
    lottery_tickets: [{ id: "ticket", user_id: userId, status: "available" }, { id: "foreign-ticket", user_id: "other", status: "available" }],
  };
  from.mockImplementation((table: string) => {
    const call: typeof calls[number] = { table, selected: "", options: {}, filters: [] };
    calls.push(call);
    let order = "";
    const query = {
      select: (selected: string, options = {}) => { call.selected = selected; call.options = options; return query; },
      eq: (column: string, value: unknown) => { call.filters.push({ method: "eq", column, value }); return query; },
      neq: (column: string, value: unknown) => { call.filters.push({ method: "neq", column, value }); return query; },
      gt: (column: string, value: unknown) => { call.filters.push({ method: "gt", column, value }); return query; },
      order: (column: string) => { order = column; return query; },
      range: (start: number, end: number) => { call.range = [start, end]; return query; },
      then: (resolve: (value: unknown) => unknown) => {
        const matches = (rows[table] ?? []).filter(row => call.filters.every(filter => filter.method === "eq" ? row[filter.column] === filter.value : filter.method === "neq" ? row[filter.column] !== filter.value : Number(row[filter.column]) > Number(filter.value)))
          .sort((left, right) => String(left[order]).localeCompare(String(right[order])));
        const data = call.options.head ? null : emptySecondPage && call.range?.[0] ? [] : call.range ? matches.slice(call.range[0], call.range[1] + 1) : matches;
        return Promise.resolve({ data, count: matches.length, error: table === failure ? { message: "private database detail" } : null }).then(resolve);
      },
    };
    return query;
  });
});
describe("read-only personal Arena summary", () => {
  it("includes unpersisted harvests, ready lots and partially sold products once per harvest", async () => {
    expect(await getArenaPlayerSummary(userId)).toEqual({ activeRun: true, readyLotCount: 3, availableFlowerCount: 1, supportPackCount: 1, buddiePackCount: 1 });
    for (const call of calls) {
      expect(call.options.count).toBe("exact");
      expect(call.filters).toContainEqual({ method: "eq", column: ["kq_flowers", "kq_market_lots"].includes(call.table) ? "owner_id" : "user_id", value: userId });
      expect(call.selected.split(",")).toEqual([call.table === "kq_market_lots" || call.table === "kq_commerce_stock" ? "flower_id" : "id"]);
    }
  });
  it("does not double count a harvest when raw and processed reads overlap preparation", async () => {
    rows.kq_commerce_stock.push(stock("overlapping-stock", "ready-harvest", 50));
    expect((await getArenaPlayerSummary(userId)).readyLotCount).toBe(3);
  });
  it("excludes fully sold harvests and prepared lots with no remaining units", async () => {
    rows.kq_flowers = [flower("sold"), flower("exhausted"), flower("to-judge", "available")];
    rows.kq_commerce_stock = rows.kq_commerce_stock.filter(row => row.flower_id !== "processed");
    expect((await getArenaPlayerSummary(userId)).readyLotCount).toBe(0);
  });
  it("paginates each identifier source and deduplicates products across page boundaries", async () => {
    const ids = Array.from({ length: 1001 }, (_, index) => `harvest-${String(index).padStart(4, "0")}`);
    rows.kq_flowers = ids.map(id => flower(id));
    rows.kq_market_lots = ids.slice(0, 700).map(id => lot(id, "stocked"));
    rows.kq_commerce_stock = ids.slice(0, 500).flatMap((id, index) => [stock(`a-${index}`, id, 1), stock(`b-${index}`, id, 1)]);
    rows.kq_commerce_stock.push(stock("last", ids[600], 1));
    expect((await getArenaPlayerSummary(userId)).readyLotCount).toBe(802); // 301 raw harvests + 501 distinct stocks.
    expect(calls.filter(call => call.table === "kq_flowers" && !call.options.head)).toHaveLength(3);
    expect(calls.filter(call => call.table === "kq_market_lots")).toHaveLength(2);
    expect(calls.filter(call => call.table === "kq_commerce_stock")).toHaveLength(3);
  });
  it("rejects invalid identities before accessing any relation", async () => {
    await expect(getArenaPlayerSummary("other-user")).rejects.toThrow("Compte invalide");
    expect(from).not.toHaveBeenCalled();
  });
  it.each(["kq_runs", "kq_flowers", "kq_market_lots", "kq_commerce_stock"])("does not present a failed %s read as an empty account", async table => {
    failure = table;
    await expect(getArenaPlayerSummary(userId)).rejects.toThrow("Résumé de l’Arène indisponible");
  });
  it("stops with an error instead of looping when a counted page unexpectedly disappears", async () => {
    rows.kq_flowers = Array.from({ length: 501 }, (_, index) => flower(`harvest-${index}`));
    emptySecondPage = true;
    await expect(getArenaPlayerSummary(userId)).rejects.toThrow("Résumé de l’Arène indisponible");
    expect(calls.filter(call => call.table === "kq_flowers" && !call.options.head)).toHaveLength(2);
  });
});
