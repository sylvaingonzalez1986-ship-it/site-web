import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), shop: vi.fn(), energy: vi.fn() }));
vi.mock("./admin", () => ({ createSupabaseServiceClient: () => ({ rpc: mocks.rpc, from: mocks.from }) }));
vi.mock("./kanab-quest-equipment-backend", () => ({ getKqEquipmentShopSnapshot: mocks.shop }));
vi.mock("./kanab-quest-energy-backend", () => ({ getKqEnergySummary: mocks.energy }));
import { getKqMarketSnapshot } from "./kanab-quest-market-backend";
import { startKqGame } from "../kanab-quest-game";
import { KQ_STARTING_EQUIPMENT_CODES } from "../kanab-quest-equipment";

type Row = Record<string, unknown>;
const user = "11111111-1111-4111-8111-111111111111";
let rows: Record<string, Row[]>;
let bytes: number;
let lotColumns: string[];
function response(data: unknown) { bytes += Buffer.byteLength(JSON.stringify(data)); return { data, error: null }; }

beforeEach(() => {
  vi.clearAllMocks(); bytes = 0; lotColumns = [];
  const flowers = Array.from({ length: 4 }, (_, index) => ({
    id: `flower-${index}`, run_id: `run-${index}`, owner_id: user, status: "burned", variety_code: "BUDDIE-001",
    variety_name: "Fleur", quality: 7, battle_stats: { aroma: 7, resin: 7 }, burned_at: "2026-09-13T12:00:00Z",
  }));
  rows = { kq_flowers: flowers, kq_runs: flowers.map((flower, i) => ({ id: flower.run_id, state: startKqGame(i + 100) })), kq_market_lots: [] };
  mocks.shop.mockResolvedValue({ cashCents: 100000, reputation: 20, routeMasteries: [], ownedCodes: [...KQ_STARTING_EQUIPMENT_CODES], equippedCodes: [...KQ_STARTING_EQUIPMENT_CODES], levels: {}, routePlan: null });
  mocks.energy.mockResolvedValue({ outstandingCents: 0 });
  mocks.rpc.mockImplementation(async (name: string, input: Row) => {
    if (name === "rpc_kq_market_pulse") return response({ recentSales: {}, marketVolumes: {} });
    if (name !== "rpc_kq_prepare_market_lot") throw new Error(`Unexpected RPC ${name}`);
    const lot = { owner_id: input.p_user_id, flower_id: input.p_flower_id, harvest_grams: input.p_harvest_grams,
      jury_score: input.p_jury_score, quality_band: input.p_quality_band, equipment_codes: input.p_equipment_codes,
      options: input.p_options, status: "ready", selected_route: null, payout_cents: null, reputation_gain: null, settled_at: null };
    rows.kq_market_lots = rows.kq_market_lots.filter(row => row.flower_id !== lot.flower_id).concat(lot);
    return response(lot);
  });
  mocks.from.mockImplementation((table: string) => {
    let columns = "*", limit = Infinity;
    const filters: Array<(row: Row) => boolean> = [];
    const query = {
      select(value: string) { columns = value; if (table === "kq_market_lots") lotColumns.push(value); return query; },
      eq(key: string, value: unknown) { filters.push(row => row[key] === value); return query; },
      in(key: string, values: unknown[]) { filters.push(row => values.includes(row[key])); return query; },
      gt() { return query; }, order() { return query; }, returns() { return query; },
      limit(value: number) { limit = value; return query; },
      then(resolve: (value: unknown) => unknown) {
        const data = (rows[table] ?? []).filter(row => filters.every(filter => filter(row))).slice(0, limit)
          .map(row => columns === "*" ? row : Object.fromEntries(columns.split(",").map(key => [key, row[key]])));
        return Promise.resolve({ ...response(data), count: 0 }).then(resolve);
      },
    };
    return query;
  });
});

describe("market browsing egress and transactional boundaries", () => {
  it("keeps the same offers while cutting measured fixture response bytes by more than half", async () => {
    const persisted = await getKqMarketSnapshot(user);
    const before = bytes;
    expect(mocks.rpc.mock.calls.filter(([name]) => name === "rpc_kq_prepare_market_lot")).toHaveLength(4);
    mocks.rpc.mockClear(); bytes = 0; lotColumns = [];
    const preview = await getKqMarketSnapshot(user, undefined, { previewOnly: true });
    expect(preview.lots).toEqual(persisted.lots);
    expect(mocks.rpc.mock.calls.some(([name]) => name === "rpc_kq_prepare_market_lot")).toBe(false);
    expect(lotColumns.every(columns => !columns.split(",").includes("options"))).toBe(true);
    expect(bytes).toBeLessThan(before / 2);
    console.info(`Market fixture: ${before} -> ${bytes} response bytes (${Math.round((1 - bytes / before) * 100)}% reduction)`);
  });
  it("can preview a new lot without creating it, and persists only the lot being prepared", async () => {
    const preview = await getKqMarketSnapshot(user, ["flower-1"], { previewOnly: true });
    expect(preview.lots).toHaveLength(1);
    expect(rows.kq_market_lots).toHaveLength(0);
    await getKqMarketSnapshot(user, ["flower-1"]);
    expect(rows.kq_market_lots.map(row => row.flower_id)).toEqual(["flower-1"]);
  });
  it("uses currently installed equipment even when a previous lot snapshot exists", async () => {
    await getKqMarketSnapshot(user, ["flower-1"]);
    const equipment = await mocks.shop();
    mocks.shop.mockResolvedValue({ ...equipment, equippedCodes: [] });
    mocks.rpc.mockClear();
    const preview = await getKqMarketSnapshot(user, ["flower-1"], { previewOnly: true });
    expect(preview.lots[0].equipmentCodes).toEqual([]);
    expect(mocks.rpc.mock.calls.some(([name]) => name === "rpc_kq_prepare_market_lot")).toBe(false);
    const persisted = await getKqMarketSnapshot(user, ["flower-1"]);
    expect(preview.lots).toEqual(persisted.lots);
  });
  it("cannot preview another player's flower and preserves sold status on a concurrent sale", async () => {
    rows.kq_flowers[0].owner_id = "another-account";
    expect((await getKqMarketSnapshot(user, ["flower-0"], { previewOnly: true })).lots).toHaveLength(0);
    await getKqMarketSnapshot(user, ["flower-1"]);
    rows.kq_market_lots[0].status = "sold";
    const preview = await getKqMarketSnapshot(user, ["flower-1"], { previewOnly: true });
    expect(preview.lots[0].status).toBe("sold");
  });
});
