import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentCustomerSessionByBackend, playKqPlayerCard, hitRateLimit } = vi.hoisted(() => ({
  getCurrentCustomerSessionByBackend: vi.fn(),
  playKqPlayerCard: vi.fn(),
  hitRateLimit: vi.fn(),
}));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({ playKqPlayerCard }));
vi.mock("@/lib/security-rate-limit", () => ({
  getRequestIp: () => "127.0.0.1",
  hitRateLimit,
  logRateLimitRejection: vi.fn(),
}));

import { POST } from "@/app/api/arena/placard/runs/[runId]/cards/route";

const previousFlag = process.env.KQ_PLAYER_API_LIVE;
const customerId = "44444444-4444-4444-4444-444444444444";
const runId = "55555555-5555-5555-5555-555555555555";
const context = { params: Promise.resolve({ runId }) };
const request = (body: unknown) => new Request(`http://localhost/api/arena/placard/runs/${runId}/cards`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe("POST /api/arena/placard/runs/[runId]/cards", () => {
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

  it("cannot burn a card while the player API is dormant", async () => {
    process.env.KQ_PLAYER_API_LIVE = "false";
    expect((await POST(request({ cardCode: "BOTTE-004" }), context)).status).toBe(404);
    expect(playKqPlayerCard).not.toHaveBeenCalled();
  });

  it("burns through the atomic player operation scoped to the owner", async () => {
    playKqPlayerCard.mockResolvedValue({ state: { xp: 2 }, burnReceipt: { id: "burn-1" } });
    const response = await POST(request({ cardCode: "BOTTE-004" }), context);
    expect(response.status).toBe(200);
    expect(playKqPlayerCard).toHaveBeenCalledWith(customerId, runId, "BOTTE-004");
  });

  it("rejects a missing code without attempting a burn", async () => {
    expect((await POST(request({}), context)).status).toBe(400);
    expect(playKqPlayerCard).not.toHaveBeenCalled();
  });

  it("stops excessive actions before the atomic operation", async () => {
    hitRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 12 });
    const response = await POST(request({ cardCode: "BOTTE-004" }), context);
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("12");
    expect(playKqPlayerCard).not.toHaveBeenCalled();
  });

  it("hides unexpected Supabase details", async () => {
    playKqPlayerCard.mockRejectedValue(new Error("[supabase:kq_secret] hidden"));
    const response = await POST(request({ cardCode: "BOTTE-004" }), context);
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("kq_secret");
  });
});
