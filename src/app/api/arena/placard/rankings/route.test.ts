import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
const { getKqPublicLeaderboard } = vi.hoisted(() => ({ getKqPublicLeaderboard: vi.fn() }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({ getKqPublicLeaderboard }));
import { GET } from "@/app/api/arena/placard/rankings/route";
const previousFlag = process.env.KQ_PLAYER_API_LIVE;

describe("GET /api/arena/placard/rankings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KQ_PLAYER_API_LIVE = "true";
  });
  afterAll(() => {
    if (previousFlag === undefined) delete process.env.KQ_PLAYER_API_LIVE;
    else process.env.KQ_PLAYER_API_LIVE = previousFlag;
  });
  it("stays hidden while player access is dormant", async () => {
    process.env.KQ_PLAYER_API_LIVE = "false";
    expect((await GET()).status).toBe(404);
    expect(getKqPublicLeaderboard).not.toHaveBeenCalled();
  });
  it("serves the daily snapshot through a 24-hour shared cache", async () => {
    getKqPublicLeaderboard.mockResolvedValue({ seasonCode: "KQ-2026-S1", entries: [{ rank: 1 }] });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("s-maxage=86400");
    expect(response.headers.get("cache-control")).toContain("stale-while-revalidate=604800");
  });
  it("returns a short-lived empty fallback without leaking errors", async () => {
    getKqPublicLeaderboard.mockRejectedValue(new Error("private database detail"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ entries: [], unavailable: true });
  });
});
