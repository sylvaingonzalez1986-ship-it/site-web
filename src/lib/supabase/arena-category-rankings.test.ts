import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), avatars: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: () => mocks }));
vi.mock("@/lib/arena-shared-cache", () => ({ cacheArenaSharedRead: (_key: string, loader: () => unknown) => loader }));
vi.mock("./arena-ranking-avatars", () => ({ getArenaRankingAvatars: mocks.avatars }));
import { getKqPublicArenaCategoryLeaderboard, getKqPublicArenaLeaderboard } from "./kanab-quest-backend";
import { arenaPublicPlayerKey } from "@/lib/arena-public-player-key";

const userId = "00000000-0000-4000-8000-000000000001";
const generatedAt = "2026-10-18T08:00:00Z";

beforeEach(() => {
  vi.clearAllMocks();
  const seasonQuery = {
    select: vi.fn(() => seasonQuery),
    eq: vi.fn(() => seasonQuery),
    maybeSingle: vi.fn().mockResolvedValue({ data: { season_code: "KQ-2026-S1" }, error: null }),
  };
  mocks.from.mockReturnValue(seasonQuery);
  mocks.avatars.mockResolvedValue(new Map());
});

describe("independent public Arena rankings", () => {
  it.each(["tasting", "duels", "business"] as const)("uses the complete %s ranking and only returns public fields", async category => {
    const avatar = { gender: "masculine", clothing: "overalls", skin: "light" };
    mocks.avatars.mockResolvedValue(new Map([[userId, avatar]]));
    mocks.rpc.mockResolvedValue({ error: null, data: {
      generatedAt,
      leaderboard: [{ userId, rank: 1, pseudo: "Maya", score: 180, rating: 1100, wins: 8, losses: 2,
        cashCents: 999_999, companyValueCents: 888_888 }],
    } });
    const result = await getKqPublicArenaCategoryLeaderboard(category);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_get_arena_category_leaderboard", {
      p_season_code: "KQ-2026-S1", p_category: category,
    });
    expect(mocks.avatars).toHaveBeenCalledExactlyOnceWith([userId]);
    expect(result).toMatchObject({
      seasonCode: "KQ-2026-S1", category, generatedAt, formulaVersion: "arena-v3-tasting-first",
      totalPlayers: 1, nextOffset: null, viewerEntry: null,
      entries: [{ entryKey: arenaPublicPlayerKey(userId), rank: 1, pseudo: "Maya", avatar, score: 180, rating: 1100, wins: 8, losses: 2 }],
    });
    expect(JSON.stringify(result)).not.toContain(userId);
    expect(JSON.stringify(result)).not.toMatch(/cashCents|companyValueCents/);
  });

  it("paginates the whole ranking and returns the authenticated viewer outside the page", async () => {
    const leaderboard = Array.from({ length: 186 }, (_, i) => ({ userId: `player-${i}`, rank: i + 1, pseudo: "Anonyme", score: 500 - i }));
    mocks.rpc.mockResolvedValue({ error: null, data: { generated_at: generatedAt, leaderboard } });
    const result = await getKqPublicArenaLeaderboard({ offset: 100, limit: 50, viewerId: "player-185" });
    expect(result).toMatchObject({ totalPlayers: 186, nextOffset: 150, viewerEntry: { rank: 186, entryKey: arenaPublicPlayerKey("player-185") } });
    expect(result.entries).toHaveLength(50);
    expect(result.entries[0].rank).toBe(101);
    expect(mocks.avatars).toHaveBeenCalledWith([...leaderboard.slice(100, 150).map(entry => entry.userId), "player-185"]);
    expect(new Set(result.entries.map(entry => entry.entryKey)).size).toBe(50);
    expect(JSON.stringify(result)).not.toContain("player-");
    const lastPage = await getKqPublicArenaLeaderboard({ offset: 150, limit: 50 });
    expect(lastPage.entries).toHaveLength(36);
    expect(lastPage.nextOffset).toBeNull();
    expect(lastPage.viewerEntry).toBeNull();
  });

  it("reads global tasting across seasons without treating it as the current-season ranking", async () => {
    mocks.rpc.mockResolvedValue({ error: null, data: { generatedAt, leaderboard: [] } });
    await getKqPublicArenaCategoryLeaderboard("tasting", { scope: "global" });
    expect(mocks.rpc).toHaveBeenCalledWith("rpc_kq_get_arena_category_leaderboard", { p_season_code: "KQ-2026-S1", p_category: "tasting-global" });
  });

  it("surfaces category failures without falling back to a truncated composite ranking", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "category unavailable" } });
    await expect(getKqPublicArenaCategoryLeaderboard("business")).rejects.toThrow("rpc_kq_get_arena_category_leaderboard");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.avatars).not.toHaveBeenCalled();
  });
});
