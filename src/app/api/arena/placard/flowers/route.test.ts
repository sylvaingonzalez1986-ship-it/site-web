import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentCustomerSessionByBackend, getKqPlayerFlowers } = vi.hoisted(() => ({
  getCurrentCustomerSessionByBackend: vi.fn(),
  getKqPlayerFlowers: vi.fn(),
}));

vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({ getKqPlayerFlowers }));

import { GET } from "@/app/api/arena/placard/flowers/route";

const previousFlag = process.env.KQ_PLAYER_API_LIVE;
const customerId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("GET /api/arena/placard/flowers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KQ_PLAYER_API_LIVE = "true";
    getCurrentCustomerSessionByBackend.mockResolvedValue({
      customerId,
      customer: { email: "player@example.test" },
    });
  });

  afterAll(() => {
    if (previousFlag === undefined) delete process.env.KQ_PLAYER_API_LIVE;
    else process.env.KQ_PLAYER_API_LIVE = previousFlag;
  });

  it("stays unavailable while player access is dormant", async () => {
    process.env.KQ_PLAYER_API_LIVE = "false";
    expect((await GET()).status).toBe(404);
    expect(getKqPlayerFlowers).not.toHaveBeenCalled();
  });

  it("requires a customer session", async () => {
    getCurrentCustomerSessionByBackend.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(getKqPlayerFlowers).not.toHaveBeenCalled();
  });

  it("returns only the authenticated player's Flower reserve", async () => {
    getKqPlayerFlowers.mockResolvedValue([{ id: "flower-1", status: "available" }]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({
      flowers: [{ id: "flower-1", status: "available" }],
    });
    expect(getKqPlayerFlowers).toHaveBeenCalledWith(customerId);
  });

  it("does not expose backend failure details", async () => {
    getKqPlayerFlowers.mockRejectedValue(new Error("[supabase:secret] private detail"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
  });
});
