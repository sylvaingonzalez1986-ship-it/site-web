import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { finalizeKqPlayerBotBattle, getCurrentCustomerSessionByBackend, hitRateLimit } = vi.hoisted(() => ({
  finalizeKqPlayerBotBattle: vi.fn(),
  getCurrentCustomerSessionByBackend: vi.fn(),
  hitRateLimit: vi.fn(),
}));

vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({ finalizeKqPlayerBotBattle }));
vi.mock("@/lib/security-rate-limit", () => ({
  getRequestIp: () => "127.0.0.1",
  hitRateLimit,
  logRateLimitRejection: vi.fn(),
}));

import { POST } from "@/app/api/arena/placard/bot-battles/route";

const previousFlag = process.env.KQ_PLAYER_API_LIVE;
const customerId = "88888888-8888-8888-8888-888888888888";
const flowerId = "99999999-9999-9999-9999-999999999999";

function request(body: unknown) {
  return new Request("http://localhost/api/arena/placard/bot-battles", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/arena/placard/bot-battles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KQ_PLAYER_API_LIVE = "true";
    getCurrentCustomerSessionByBackend.mockResolvedValue({
      customerId,
      customer: { email: "player@example.test" },
    });
    hitRateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
    finalizeKqPlayerBotBattle.mockResolvedValue({ battleId: "battle-1" });
  });

  afterAll(() => {
    if (previousFlag === undefined) delete process.env.KQ_PLAYER_API_LIVE;
    else process.env.KQ_PLAYER_API_LIVE = previousFlag;
  });

  it("draws the training opponent server-side and ignores any requested bot", async () => {
    const response = await POST(request({ flowerId, botCode: "bot-maya" }));
    expect(response.status).toBe(201);
    expect(finalizeKqPlayerBotBattle).toHaveBeenCalledWith(customerId, flowerId);
  });

  it("rejects a missing Flower before drawing an opponent", async () => {
    const response = await POST(request({ botCode: "bot-maya" }));
    expect(response.status).toBe(400);
    expect(finalizeKqPlayerBotBattle).not.toHaveBeenCalled();
  });
});
