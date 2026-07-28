import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
const { getCurrentCustomerSessionByBackend, getKqPlayerProgress } = vi.hoisted(() => ({
  getCurrentCustomerSessionByBackend: vi.fn(), getKqPlayerProgress: vi.fn(),
}));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({ getKqPlayerProgress }));
import { GET } from "@/app/api/arena/placard/me/route";
const previousFlag = process.env.KQ_PLAYER_API_LIVE;

describe("GET /api/arena/placard/me", () => {
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
  });
  it("requires an authenticated customer", async () => {
    getCurrentCustomerSessionByBackend.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });
  it("returns only the current player's progression", async () => {
    getCurrentCustomerSessionByBackend.mockResolvedValue({ customerId: "11111111-1111-1111-1111-111111111111" });
    getKqPlayerProgress.mockResolvedValue({ rank: 2, rating: 1012, league: "Pousse" });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
