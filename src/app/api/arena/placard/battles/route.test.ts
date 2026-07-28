import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentCustomerSessionByBackend, getKqPlayerBattles, lockKqPlayerBattle, hitRateLimit } = vi.hoisted(() => ({
  getCurrentCustomerSessionByBackend: vi.fn(),
  getKqPlayerBattles: vi.fn(),
  lockKqPlayerBattle: vi.fn(),
  hitRateLimit: vi.fn(),
}));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({ getKqPlayerBattles, lockKqPlayerBattle }));
vi.mock("@/lib/security-rate-limit", () => ({
  getRequestIp: () => "127.0.0.1",
  hitRateLimit,
  logRateLimitRejection: vi.fn(),
}));

import { GET, POST } from "@/app/api/arena/placard/battles/route";

const previousFlag = process.env.KQ_PLAYER_API_LIVE;
const customerId = "88888888-8888-8888-8888-888888888888";
const flowerId = "99999999-9999-9999-9999-999999999999";
const rivalFlowerId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const request = (body: unknown) => new Request("http://localhost/api/arena/placard/battles", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe("POST /api/arena/placard/battles", () => {
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

  it("cannot lock Flowers while the player API is dormant", async () => {
    process.env.KQ_PLAYER_API_LIVE = "false";
    expect((await POST(request({ flowerId, rivalFlowerId }))).status).toBe(404);
    expect(lockKqPlayerBattle).not.toHaveBeenCalled();
  });

  it("lists only the authenticated player's official duels", async () => {
    getKqPlayerBattles.mockResolvedValue([{ id: "battle-1" }]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(getKqPlayerBattles).toHaveBeenCalledWith(customerId, 12);
  });

  it("locks a ranked duel for the authenticated Flower owner", async () => {
    lockKqPlayerBattle.mockResolvedValue({ battleId: "battle-1", status: "locked" });
    const response = await POST(request({ flowerId, rivalFlowerId }));
    expect(response.status).toBe(201);
    expect(lockKqPlayerBattle).toHaveBeenCalledWith(customerId, flowerId, rivalFlowerId);
  });

  it("rejects incomplete and excessive requests before locking", async () => {
    expect((await POST(request({ flowerId }))).status).toBe(400);
    hitRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 30 });
    expect((await POST(request({ flowerId, rivalFlowerId }))).status).toBe(429);
    expect(lockKqPlayerBattle).not.toHaveBeenCalled();
  });
});
