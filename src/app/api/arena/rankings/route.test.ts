import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enabled: vi.fn(),
  leaderboard: vi.fn(),
  categoryLeaderboard: vi.fn(),
  session: vi.fn(),
}));

vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqPlayerRequestEnabled: mocks.enabled }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({
  getKqPublicArenaLeaderboard: mocks.leaderboard,
  getKqPublicArenaCategoryLeaderboard: mocks.categoryLeaderboard,
}));

import { GET } from "@/app/api/arena/rankings/route";
const request = (query = "") => new Request(`https://example.com/api/arena/rankings${query}`);

describe("GET /api/arena/rankings", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue(null); });

  it("stays unavailable while the player API is disabled", async () => {
    mocks.enabled.mockReturnValue(false);
    const response = await GET(request("?category=business"));
    expect(response.status).toBe(404);
    expect(mocks.leaderboard).not.toHaveBeenCalled();
    expect(mocks.categoryLeaderboard).not.toHaveBeenCalled();
  });

  it("returns only the public server projection", async () => {
    mocks.enabled.mockReturnValue(true);
    mocks.leaderboard.mockResolvedValue({ formulaVersion: "arena-v1", entries: [{ rank: 1, pseudo: "Maya", score: 700 }] });
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ formulaVersion: "arena-v1", entries: [{ rank: 1, pseudo: "Maya", score: 700 }] });
    expect(response.headers.get("cache-control")).toContain("private, no-store");
  });

  it.each(["tasting", "duels", "business"])("loads the independent %s ranking", async category => {
    mocks.enabled.mockReturnValue(true);
    const payload = { category, entries: [{ rank: 1, pseudo: "Maya", score: 150 }] };
    mocks.categoryLeaderboard.mockResolvedValue(payload);
    const response = await GET(request(`?category=${category}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(payload);
    expect(mocks.categoryLeaderboard).toHaveBeenCalledExactlyOnceWith(category, { offset: 0, limit: 50, viewerId: undefined, scope: "season" });
    expect(mocks.leaderboard).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toContain("private, no-store");
  });

  it("takes the viewer from the session and supports later pages and global tasting", async () => {
    mocks.enabled.mockReturnValue(true);
    mocks.session.mockResolvedValue({ customerId: "session-player" });
    mocks.categoryLeaderboard.mockResolvedValue({ entries: [] });
    expect((await GET(request("?category=tasting&scope=global&offset=100&limit=25&viewerId=forged"))).status).toBe(200);
    expect(mocks.categoryLeaderboard).toHaveBeenCalledWith("tasting", { offset: 100, limit: 25, scope: "global", viewerId: "session-player" });
  });

  it.each(["offset=-1", "offset=1.5", "offset=NaN", "limit=0", "limit=101", "scope=global", "scope=unknown"])("rejects invalid pagination %s", async query => {
    mocks.enabled.mockReturnValue(true);
    expect((await GET(request(`?${query}`))).status).toBe(400);
    expect(mocks.leaderboard).not.toHaveBeenCalled();
    expect(mocks.session).not.toHaveBeenCalled();
  });

  it("rejects unknown ranking categories before reading scores", async () => {
    mocks.enabled.mockReturnValue(true);
    const response = await GET(request("?category=unknown"));
    expect(response.status).toBe(400);
    expect(mocks.leaderboard).not.toHaveBeenCalled();
    expect(mocks.categoryLeaderboard).not.toHaveBeenCalled();
  });

  it("does not leak backend errors", async () => {
    mocks.enabled.mockReturnValue(true);
    mocks.leaderboard.mockRejectedValue(new Error("private database detail"));
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("private database detail");
  });

  it("reports a failed category without substituting general scores", async () => {
    mocks.enabled.mockReturnValue(true);
    mocks.categoryLeaderboard.mockRejectedValue(new Error("private category detail"));
    const response = await GET(request("?category=business"));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ entries: [], unavailable: true });
    expect(mocks.leaderboard).not.toHaveBeenCalled();
  });
});
