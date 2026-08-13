import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enabled: vi.fn(),
  leaderboard: vi.fn(),
}));

vi.mock("@/lib/kanab-quest-player-access", () => ({ isKqPlayerApiEnabled: mocks.enabled }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({ getKqPublicArenaLeaderboard: mocks.leaderboard }));

import { GET } from "@/app/api/arena/rankings/route";

describe("GET /api/arena/rankings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stays unavailable while the player API is disabled", async () => {
    mocks.enabled.mockReturnValue(false);
    const response = await GET();
    expect(response.status).toBe(404);
    expect(mocks.leaderboard).not.toHaveBeenCalled();
  });

  it("returns only the public server projection", async () => {
    mocks.enabled.mockReturnValue(true);
    mocks.leaderboard.mockResolvedValue({ formulaVersion: "arena-v1", entries: [{ rank: 1, pseudo: "Maya", score: 700 }] });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ formulaVersion: "arena-v1", entries: [{ rank: 1, pseudo: "Maya", score: 700 }] });
    expect(response.headers.get("cache-control")).toContain("s-maxage=60");
  });

  it("does not leak backend errors", async () => {
    mocks.enabled.mockReturnValue(true);
    mocks.leaderboard.mockRejectedValue(new Error("private database detail"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("private database detail");
  });
});
