import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: () => mocks }));
vi.mock("@/lib/arena-shared-cache", () => ({ cacheArenaSharedRead: (_key: string, loader: () => unknown) => loader }));
import { getKqArenaLeaderboardInternal, getKqPlayerProgress, mapKqPlayerCoreSnapshot } from "./kanab-quest-backend";

const userId = "00000000-0000-4000-8000-000000000001";
const generatedAt = "2026-10-11T08:45:13.234Z";
const profile = {
  season_code: "KQ-2026-S1", rating: 1100, season_points: 20, wins: 4, losses: 2,
  streak: 1, burned_flowers: 6, arena_experience: 31, updated_at: "2026-10-11T08:45:50Z",
};

function readResult(data: unknown, error: { message: string } | null = null) {
  const result = Promise.resolve({ data, error });
  const builder = {
    select: vi.fn(() => builder), eq: vi.fn(() => builder), order: vi.fn(() => builder),
    limit: vi.fn(() => builder), maybeSingle: vi.fn(() => result),
    then: result.then.bind(result),
  };
  return builder;
}

beforeEach(() => vi.clearAllMocks());

describe("Arena budget ranking reads", () => {
  it("reads cached rank while preserving current score and durable claims without calling a refresh RPC", async () => {
    const snapshots = readResult({ leaderboard: [{ userId, rank: 8, placardScore: 999 }], generated_at: generatedAt });
    mocks.from.mockImplementation((table: string) => {
      if (table === "kq_rank_profiles") return readResult(profile);
      if (table === "kq_leaderboard_snapshots") return snapshots;
      if (table === "kq_equipment_wallets") return readResult({ reputation: 400 });
      if (table === "kq_daily_challenge_claims") return readResult([{ challenge_day: "2026-10-11", challenge_code: "clean-sweep" }]);
      throw new Error(`Unexpected table ${table}`);
    });
    await expect(getKqPlayerProgress(userId)).resolves.toMatchObject({
      rank: 8, rating: 1100, seasonPoints: 20, reputation: 400, placardScore: 1185,
      leaderboardGeneratedAt: generatedAt, claimedChallengeCodes: ["2026-10-11:clean-sweep"],
    });
    expect(snapshots.eq).toHaveBeenCalledWith("season_code", profile.season_code);
    expect(snapshots.limit).toHaveBeenCalledWith(1);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("permits a new player's profile before any ranking snapshot has been generated", async () => {
    mocks.from.mockImplementation((table: string) => readResult(
      table === "kq_rank_profiles" ? profile : table === "kq_daily_challenge_claims" ? [] : null,
    ));
    await expect(getKqPlayerProgress(userId)).resolves.toMatchObject({
      rank: null, reputation: 0, placardScore: 1105, leaderboardGeneratedAt: null,
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("exposes the same score, reputation and timestamp through consolidated bootstrap", () => {
    expect(mapKqPlayerCoreSnapshot({ progress: {
      seasonCode: profile.season_code, rank: 8, rating: 1100, seasonPoints: 20,
      reputation: 400, placardScore: 1185, wins: 4, losses: 2, streak: 1,
      burnedFlowers: 6, arenaExperience: 31, updatedAt: profile.updated_at,
      leaderboardGeneratedAt: generatedAt,
    } }, [], ["2026-10-11:clean-sweep"]).progress).toMatchObject({
      rank: 8, rating: 1100, seasonPoints: 20, reputation: 400, placardScore: 1185,
      leaderboardGeneratedAt: generatedAt, claimedChallengeCodes: ["2026-10-11:clean-sweep"],
    });
  });

  it("requests a shared snapshot ordinarily and an explicitly fresh snapshot for finalization", async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table !== "kq_seasons") throw new Error(`Unexpected table ${table}`);
      return readResult({ season_code: "KQ-2026-S1" });
    });
    mocks.rpc.mockResolvedValue({ error: null, data: {
      contest_season_code: "CARNET-1", generated_at: generatedAt,
      leaderboard: [{ userId, rank: 1, pseudo: "Carnet", score: 325, notebookScore: 300,
        placardScore: 25, approvedReviewCount: 1, rating: 1000, wins: 1, losses: 0 }],
    } });
    await expect(getKqArenaLeaderboardInternal()).resolves.toMatchObject({
      seasonCode: "KQ-2026-S1", contestSeasonCode: "CARNET-1", generatedAt,
      entries: [{ userId, rank: 1, score: 325 }],
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
