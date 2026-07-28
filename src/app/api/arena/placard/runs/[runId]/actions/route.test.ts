import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentCustomerSessionByBackend, applyKqPlayerRunAction, hitRateLimit } = vi.hoisted(() => ({
  getCurrentCustomerSessionByBackend: vi.fn(),
  applyKqPlayerRunAction: vi.fn(),
  hitRateLimit: vi.fn(),
}));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({ applyKqPlayerRunAction }));
vi.mock("@/lib/security-rate-limit", () => ({
  getRequestIp: () => "127.0.0.1",
  hitRateLimit,
  logRateLimitRejection: vi.fn(),
}));

import { POST } from "@/app/api/arena/placard/runs/[runId]/actions/route";

const previousFlag = process.env.KQ_PLAYER_API_LIVE;
const customerId = "66666666-6666-6666-6666-666666666666";
const runId = "77777777-7777-7777-7777-777777777777";
const context = { params: Promise.resolve({ runId }) };
const request = (body: unknown) => new Request(`http://localhost/api/arena/placard/runs/${runId}/actions`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe("POST /api/arena/placard/runs/[runId]/actions", () => {
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

  it("is inert while the player API is dormant", async () => {
    process.env.KQ_PLAYER_API_LIVE = "false";
    expect((await POST(request({ action: "roll" }), context)).status).toBe(404);
    expect(applyKqPlayerRunAction).not.toHaveBeenCalled();
  });

  it("applies a progression action only to the authenticated run owner", async () => {
    applyKqPlayerRunAction.mockResolvedValue({ state: { rolled: true }, persistedFlower: null });
    const response = await POST(request({ action: "roll" }), context);
    expect(response.status).toBe(200);
    expect(applyKqPlayerRunAction).toHaveBeenCalledWith(customerId, runId, "roll", undefined);
  });

  it("validates Heritage exchange indexes before mutation", async () => {
    expect((await POST(request({ action: "heritage-swap", handIndex: "x" }), context)).status).toBe(400);
    expect(applyKqPlayerRunAction).not.toHaveBeenCalled();
  });

  it("forwards valid Heritage exchange indexes", async () => {
    applyKqPlayerRunAction.mockResolvedValue({ state: {}, persistedFlower: null });
    await POST(request({ action: "heritage-swap", handIndex: 2, reserveIndex: 1 }), context);
    expect(applyKqPlayerRunAction).toHaveBeenCalledWith(
      customerId,
      runId,
      "heritage-swap",
      { handIndex: 2, reserveIndex: 1 },
    );
  });

  it("rate limits progression before reading or writing the run", async () => {
    hitRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 9 });
    const response = await POST(request({ action: "roll" }), context);
    expect(response.status).toBe(429);
    expect(applyKqPlayerRunAction).not.toHaveBeenCalled();
  });
});
