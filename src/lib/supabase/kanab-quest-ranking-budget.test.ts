import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: () => mocks }));
vi.mock("@/lib/arena-shared-cache", () => ({ cacheArenaSharedRead: (_key: string, loader: () => unknown) => loader }));
import { getKqArenaLeaderboardInternal, getKqPlayerProgress, getKqPublicLeaderboard, mapKqPlayerCoreSnapshot } from "./kanab-quest-backend";

const userId = "00000000-0000-4000-8000-000000000001";
const generatedAt = "2026-10-11T08:45:13.234Z";
const profile = {
  season_code: "KQ-2026-S1", rating: 1100, season_points: 20, wins: 4, losses: 2,
  streak: 1, burned_flowers: 6, arena_experience: 31, updated_at: "2026-10-11T08:45:50Z",
};

function readResult(data: unknown, error: { message: string } | null = null) {
  const result = Promise.resolve({ data, error });
  const builder = {
    select: vi.fn(() => builder), eq: vi.fn(() => builder), in: vi.fn(() => builder), order: vi.fn(() => builder),
    limit: vi.fn(() => builder), maybeSingle: vi.fn(() => result),
    then: result.then.bind(result),
  };
  return builder;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({ data: { score: 0, production: 0, sales: 0, companyValue: 0, productionAreaM2: 0, companyValueCents: 0 }, error: null });
});

describe("Arena budget ranking reads", () => {
  it("preserves unknown business scores through the public ranking without changing actual zeroes or the official total", async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === "kq_seasons") return readResult({ season_code: "KQ-2026-S1" });
      if (table === "contest_profiles" || table === "arena_chanvrier_profiles") return readResult([]);
      throw new Error(`Unexpected table ${table}`);
    });
    const values = [undefined, null, 0, "0", 426.5, "81.25", "", "unknown"];
    mocks.rpc.mockResolvedValue({ error: null, data: { generated_at: generatedAt,
      leaderboard: values.map((businessScore, index) => ({
        userId: `player-${index}`, rank: index + 1, rating: 1000, seasonPoints: 20,
        reputation: 400, placardScore: 1305, ...(businessScore !== undefined ? { businessScore } : {}),
      })),
    } });
    const result = await getKqPublicLeaderboard();
    expect(result.entries.map(entry => entry.businessScore)).toEqual([null, null, 0, 0, 426.5, 81.25, null, null]);
    expect(result.entries.every(entry => entry.placardScore === 1305)).toBe(true);
    expect(result.generatedAt).toBe(generatedAt);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_get_daily_leaderboard", { p_season_code: "KQ-2026-S1" });
  });

  it("reads cached rank while preserving current score and durable claims without calling a refresh RPC", async () => {
    mocks.rpc.mockResolvedValue({ data: { score: 120, production: 30, sales: 60, companyValue: 30, productionAreaM2: 25, companyValueCents: 250_000 }, error: null });
    const snapshots = readResult({ leaderboard: [{ userId, rank: 8, placardScore: 999 }], generated_at: generatedAt });
    mocks.from.mockImplementation((table: string) => {
      if (table === "kq_rank_profiles") return readResult(profile);
      if (table === "kq_leaderboard_snapshots") return snapshots;
      if (table === "kq_equipment_wallets") return readResult({ reputation: 400 });
      if (table === "kq_daily_challenge_claims") return readResult([{ challenge_day: "2026-10-11", challenge_code: "clean-sweep" }]);
      throw new Error(`Unexpected table ${table}`);
    });
    await expect(getKqPlayerProgress(userId)).resolves.toMatchObject({
      rank: 8, rating: 1100, seasonPoints: 20, reputation: 400, placardScore: 1305, businessScore: 120,
      leaderboardGeneratedAt: generatedAt, claimedChallengeCodes: ["2026-10-11:clean-sweep"],
    });
    expect(snapshots.eq).toHaveBeenCalledWith("season_code", profile.season_code);
    expect(snapshots.limit).toHaveBeenCalledWith(1);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("kq_business_development_score", { p_user_id: userId });
  });

  it("permits a new player's profile before any ranking snapshot has been generated", async () => {
    mocks.from.mockImplementation((table: string) => readResult(
      table === "kq_rank_profiles" ? profile : table === "kq_daily_challenge_claims" ? [] : null,
    ));
    await expect(getKqPlayerProgress(userId)).resolves.toMatchObject({
      rank: null, reputation: 0, placardScore: 1105, leaderboardGeneratedAt: null,
    });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("kq_business_development_score", { p_user_id: userId });
  });

  it("exposes the same score, reputation and timestamp through consolidated bootstrap", () => {
    expect(mapKqPlayerCoreSnapshot({ progress: {
      seasonCode: profile.season_code, rank: 8, rating: 1100, seasonPoints: 20,
      reputation: 400, placardScore: 1305, businessScore: 120, wins: 4, losses: 2, streak: 1,
      burnedFlowers: 6, arenaExperience: 31, updatedAt: profile.updated_at,
      leaderboardGeneratedAt: generatedAt,
    } }, [], ["2026-10-11:clean-sweep"]).progress).toMatchObject({
      rank: 8, rating: 1100, seasonPoints: 20, reputation: 400, placardScore: 1305, businessScore: 120,
      leaderboardGeneratedAt: generatedAt, claimedChallengeCodes: ["2026-10-11:clean-sweep"],
    });
  });

  it("includes development when reconstructing a missing composite score", () => {
    expect(mapKqPlayerCoreSnapshot({ progress: {
      seasonCode: profile.season_code, rating: 1100, seasonPoints: 20,
      reputation: 400, businessScore: 120, wins: 4, losses: 2,
    } }, []).progress).toMatchObject({ placardScore: 1305, businessScore: 120 });
  });

  it("fails explicitly if the authoritative business score cannot be read", async () => {
    mocks.from.mockImplementation((table: string) => readResult(table === "kq_rank_profiles" ? profile : null));
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "business unavailable" } });
    await expect(getKqPlayerProgress(userId)).rejects.toThrow("kq_business_development_score");
  });

  it("requests a shared snapshot ordinarily and an explicitly fresh snapshot for finalization", async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table !== "kq_seasons") throw new Error(`Unexpected table ${table}`);
      return readResult({ season_code: "KQ-2026-S1" });
    });
    mocks.rpc.mockResolvedValue({ error: null, data: {
      contest_season_code: "CARNET-1", generated_at: generatedAt,
      leaderboard: [{ userId, rank: 1, pseudo: "Carnet", score: 445, notebookScore: 300,
        placardScore: 25, businessScore: 120, approvedReviewCount: 1, rating: 1000, wins: 1, losses: 0 }],
    } });
    await expect(getKqArenaLeaderboardInternal()).resolves.toMatchObject({
      seasonCode: "KQ-2026-S1", contestSeasonCode: "CARNET-1", generatedAt,
      formulaVersion: "arena-v3-tasting-first", entries: [{ userId, rank: 1, score: 445, businessScore: 120 }],
    });
    expect(mocks.rpc).toHaveBeenLastCalledWith("rpc_kq_get_arena_leaderboard", {
      p_season_code: "KQ-2026-S1", p_force_refresh: false,
    });
    await getKqArenaLeaderboardInternal({ forceRefresh: true });
    expect(mocks.rpc).toHaveBeenLastCalledWith("rpc_kq_get_arena_leaderboard", {
      p_season_code: "KQ-2026-S1", p_force_refresh: true,
    });
    expect(mocks.from.mock.calls.every(([table]) => table === "kq_seasons")).toBe(true);
  });
});
