import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentCustomerSessionByBackend, finalizeKqPlayerBattle, hitRateLimit } = vi.hoisted(() => ({
  getCurrentCustomerSessionByBackend: vi.fn(),
  finalizeKqPlayerBattle: vi.fn(),
  hitRateLimit: vi.fn(),
}));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({ finalizeKqPlayerBattle }));
vi.mock("@/lib/security-rate-limit", () => ({
  getRequestIp: () => "127.0.0.1",
  hitRateLimit,
  logRateLimitRejection: vi.fn(),
}));

import { POST } from "@/app/api/arena/placard/battles/[battleId]/verdict/route";

const previousFlag = process.env.KQ_PLAYER_API_LIVE;
const customerId = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const battleId = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
const context = { params: Promise.resolve({ battleId }) };
const request = new Request(`http://localhost/api/arena/placard/battles/${battleId}/verdict`, { method: "POST" });

describe("POST /api/arena/placard/battles/[battleId]/verdict", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KQ_PLAYER_API_LIVE = "true";
    getCurrentCustomerSessionByBackend.mockResolvedValue({
      customerId,
      customer: { email: "player@example.test" },
    });
    hitRateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  });
  afterAll(() => {
    if (previousFlag === undefined) delete process.env.KQ_PLAYER_API_LIVE;
    else process.env.KQ_PLAYER_API_LIVE = previousFlag;
  });

  it("cannot burn either Flower while the player API is dormant", async () => {
    process.env.KQ_PLAYER_API_LIVE = "false";
    expect((await POST(request, context)).status).toBe(404);
    expect(finalizeKqPlayerBattle).not.toHaveBeenCalled();
  });

  it("requests the trusted verdict for a participating customer", async () => {
    finalizeKqPlayerBattle.mockResolvedValue({
      battleId,
      status: "verdict",
      winner: "player",
      replayed: false,
    });
    const response = await POST(request, context);
    expect(response.status).toBe(200);
    expect(finalizeKqPlayerBattle).toHaveBeenCalledWith(customerId, battleId);
  });

  it("returns an idempotent replay like a normal verdict", async () => {
    finalizeKqPlayerBattle.mockResolvedValue({
      battleId,
      status: "verdict",
      winner: "opponent",
      replayed: true,
    });
    const response = await POST(request, context);
    expect(response.status).toBe(200);
    expect((await response.json()).replayed).toBe(true);
  });

  it("rate limits repeated verdict attempts before the transaction", async () => {
    hitRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 25 });
    expect((await POST(request, context)).status).toBe(429);
    expect(finalizeKqPlayerBattle).not.toHaveBeenCalled();
  });
});
