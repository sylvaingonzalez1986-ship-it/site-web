import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCurrentCustomerSessionByBackend,
  getKqPlayerActiveRun,
  getKqPlayerFlowers,
  getKqPlayerBattles,
  getKqPlayerProgress,
} = vi.hoisted(() => ({
  getCurrentCustomerSessionByBackend: vi.fn(),
  getKqPlayerActiveRun: vi.fn(),
  getKqPlayerFlowers: vi.fn(),
  getKqPlayerBattles: vi.fn(),
  getKqPlayerProgress: vi.fn(),
}));

vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({
  getKqPlayerActiveRun,
  getKqPlayerFlowers,
  getKqPlayerBattles,
  getKqPlayerProgress,
}));

import { GET } from "@/app/api/arena/placard/session/route";

const previousFlag = process.env.KQ_PLAYER_API_LIVE;
const customerId = "11111111-1111-1111-1111-111111111111";

describe("GET /api/arena/placard/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KQ_PLAYER_API_LIVE = "true";
  });

  afterAll(() => {
    if (previousFlag === undefined) delete process.env.KQ_PLAYER_API_LIVE;
    else process.env.KQ_PLAYER_API_LIVE = previousFlag;
  });

  it("stays undiscoverable while the customer launch flag is closed", async () => {
    process.env.KQ_PLAYER_API_LIVE = "false";
    expect((await GET()).status).toBe(404);
    expect(getCurrentCustomerSessionByBackend).not.toHaveBeenCalled();
  });

  it("requires an authenticated customer after activation", async () => {
    getCurrentCustomerSessionByBackend.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(getKqPlayerActiveRun).not.toHaveBeenCalled();
  });

  it("scopes every session read to the authenticated customer id", async () => {
    getCurrentCustomerSessionByBackend.mockResolvedValue({ customerId });
    getKqPlayerActiveRun.mockResolvedValue({ runId: "run-1" });
    getKqPlayerFlowers.mockResolvedValue([{ id: "flower-1" }]);
    getKqPlayerBattles.mockResolvedValue([{ id: "battle-1" }]);
    getKqPlayerProgress.mockResolvedValue({ rank: 4, rating: 1010 });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(getKqPlayerActiveRun).toHaveBeenCalledWith(customerId);
    expect(getKqPlayerFlowers).toHaveBeenCalledWith(customerId);
    expect(getKqPlayerBattles).toHaveBeenCalledWith(customerId, 12);
    expect(getKqPlayerProgress).toHaveBeenCalledWith(customerId);
    expect(await response.json()).toMatchObject({
      activeRun: { runId: "run-1" },
      flowers: [{ id: "flower-1" }],
      battles: [{ id: "battle-1" }],
      progress: { rank: 4, rating: 1010 },
    });
  });

  it("keeps healthy private sections without exposing backend errors", async () => {
    getCurrentCustomerSessionByBackend.mockResolvedValue({ customerId });
    getKqPlayerActiveRun.mockRejectedValue(new Error("secret database detail"));
    getKqPlayerFlowers.mockResolvedValue([]);
    getKqPlayerBattles.mockResolvedValue([]);
    getKqPlayerProgress.mockResolvedValue(null);
    const response = await GET();
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.warnings).toEqual(["Culture indisponible."]);
    expect(JSON.stringify(payload)).not.toContain("secret database detail");
  });
});
