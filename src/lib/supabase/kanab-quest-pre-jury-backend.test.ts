import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyKqStorageToJury, createKqStorageLot } from "../kanab-quest-storage";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), storage: vi.fn() }));
vi.mock("./admin", () => ({ createSupabaseServiceClient: () => ({ rpc: mocks.rpc, from: mocks.from }) }));
vi.mock("./kanab-quest-storage-backend", async importOriginal => ({
  ...await importOriginal<typeof import("./kanab-quest-storage-backend")>(), getKqStorageRecords: mocks.storage,
}));
import { finalizeKqPlayerBotBattle, enqueueKqPlayerRandomBattle, getKqPlayerFlowers, getKqPlayerCoreSnapshot } from "./kanab-quest-backend";
import { getKqJuryReadiness } from "./kanab-quest-jury-readiness";

const userId = "11111111-1111-4111-8111-111111111111", flowerId = "22222222-2222-4222-8222-222222222222";
beforeEach(() => vi.resetAllMocks());
describe("pre-jury server flow", () => {
  it("rejects an early bot evaluation before reading or calculating battle rounds", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "kq_curing_required" } });
    await expect(finalizeKqPlayerBotBattle(userId, flowerId)).rejects.toThrow("Attends sa fin");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_prepare_flower_jury", { p_user_id: userId, p_flower_id: flowerId });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("explains the database gate for the human queue too", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "kq_curing_required" } });
    await expect(enqueueKqPlayerRandomBattle(userId, flowerId)).rejects.toThrow("avant de passer le jury");
  });
  it("projects a harvest using database time even when the application clock is later", async () => {
    const at = "2026-10-29T10:00:00.000Z";
    mocks.storage.mockResolvedValue({ serverNow: at, lots: [{ flowerId, juryScore: null,
      state: createKqStorageLot({ flowerId, harvestedAt: at, baseline: { varietyCode: "HH2026-001", juryScore: 6, aroma: 75,
        care: { terpenes: 75, cannabinoidExpression: 75, cannabinoidConversion: 0, cannabinoidOxidation: 0 } } }),
    }] });
    mocks.from.mockImplementation((table: string) => {
      const result = { data: table === "kq_flowers" ? [{ id: flowerId, status: "available", variety_name: "Test", quality: 70 }] : [], error: null };
      const query = { select: () => query, eq: () => query, in: () => query, order: () => query, limit: () => query,
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) };
      return query;
    });
    expect((await getKqPlayerFlowers(userId))[0]).toMatchObject({ id: flowerId, storage: { stage: "curing", serverNow: at, readyAt: "2026-10-29T16:00:00.000Z" } });
  });
  it("accepts only explicit database readiness counts", async () => {
    mocks.rpc.mockResolvedValue({ data: { availableFlowerCount: 2, curingFlowerCount: 3 }, error: null });
    expect(await getKqJuryReadiness(userId)).toEqual({ availableFlowerCount: 2, curingFlowerCount: 3 });
    mocks.rpc.mockResolvedValue({ data: { availableFlowerCount: 2 }, error: null });
    await expect(getKqJuryReadiness(userId)).rejects.toThrow("indisponible");
  });
  it.each(["flowers", "core"] as const)("previews acquired curing stats in the %s response without writing or awarding them twice", async endpoint => {
    const harvestedAt = "2026-10-29T04:00:00.000Z", serverNow = "2026-10-29T10:00:00.000Z";
    const rawStats = { appearance: 60, aroma: 60, vigor: 60, mastery: 60, regularity: 60, cannabinoids: 60 };
    const lot = createKqStorageLot({ flowerId, harvestedAt, preJury: true,
      baseline: { varietyCode: "HH2026-001", juryScore: 6, aroma: 60,
        care: { terpenes: 60, cannabinoidExpression: 60, cannabinoidConversion: 0, cannabinoidOxidation: 0 } },
      capacity: { totalUnits: 500, allocations: [{ containerCode: "GLASS-1L", quantity: 1, storedUnits: 500 }], automaticOverflowSale: false, overflowDeadlineAt: null },
      postHarvest: { dryingQualityBonus: .35, storageQualityBonus: .3, climateQualityBonus: .25, aromaRateFactor: 60, chemistryRateFactor: 60 },
    });
    const flowerRow = { id: flowerId, status: "available", variety_name: "Test", varietyName: "Test", quality: 12,
      battle_stats: rawStats, stats: rawStats };
    mocks.from.mockImplementation((table: string) => {
      const result = { data: table === "kq_flowers" ? [flowerRow] : [], error: null };
      const query = { select: () => query, eq: () => query, in: () => query, order: () => query, limit: () => query,
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) };
      return query;
    });
    mocks.rpc.mockResolvedValue({ data: { flowers: [flowerRow] }, error: null });
    const storage = { serverNow, lots: [{ flowerId, juryScore: null, state: lot }] };
    mocks.storage.mockResolvedValue(storage);
    const read = async () => endpoint === "flowers" ? getKqPlayerFlowers(userId) : (await getKqPlayerCoreSnapshot(userId)).flowers;
    const original = structuredClone(storage);
    const result = (await read())[0];
    expect(result.stats).toEqual({ appearance: 69, aroma: 69, vigor: 69, mastery: 69, regularity: 69, cannabinoids: 69 });
    expect(result.storage?.stage).toBe("ready");
    expect(storage).toEqual(original);
    expect(flowerRow.battle_stats).toEqual(rawStats);
    expect(mocks.rpc.mock.calls.every(([name]) => name === "rpc_kq_player_core_snapshot")).toBe(true);

    const prepared = applyKqStorageToJury(lot, rawStats, Date.parse(serverNow));
    flowerRow.battle_stats = prepared.stats as typeof rawStats;
    flowerRow.stats = prepared.stats as typeof rawStats;
    storage.lots[0].state = prepared.lot;
    storage.serverNow = "2026-10-29T12:00:00.000Z";
    expect((await read())[0].stats).toEqual(prepared.stats);

    // Readiness follows the database clock, regardless of the app clock.
    storage.lots[0].state = lot;
    storage.serverNow = "2026-10-29T09:59:59.999Z";
    flowerRow.battle_stats = rawStats; flowerRow.stats = rawStats;
    expect((await read())[0].stats).toEqual(rawStats);
    storage.serverNow = serverNow;
    delete lot.preJury;
    expect((await read())[0].stats).toEqual(rawStats);
  });
});
