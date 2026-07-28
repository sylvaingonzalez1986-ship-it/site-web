import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCurrentCustomerSessionByBackend,
  getKqPlayerActiveRun,
  startKqPlayerRun,
  hitRateLimit,
  logRateLimitRejection,
} = vi.hoisted(() => ({
  getCurrentCustomerSessionByBackend: vi.fn(),
  getKqPlayerActiveRun: vi.fn(),
  startKqPlayerRun: vi.fn(),
  hitRateLimit: vi.fn(),
  logRateLimitRejection: vi.fn(),
}));

vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({ getKqPlayerActiveRun, startKqPlayerRun }));
vi.mock("@/lib/security-rate-limit", () => ({
  getRequestIp: () => "127.0.0.1",
  hitRateLimit,
  logRateLimitRejection,
}));

import { GET, POST } from "@/app/api/arena/placard/runs/route";

const previousFlag = process.env.KQ_PLAYER_API_LIVE;
const customerId = "33333333-3333-3333-3333-333333333333";
const request = (body: unknown) => new Request("http://localhost/api/arena/placard/runs", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe("POST /api/arena/placard/runs", () => {
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

  it("cannot burn a substrate while the player API is dormant", async () => {
    process.env.KQ_PLAYER_API_LIVE = "false";
    expect((await POST(request({}))).status).toBe(404);
    expect(startKqPlayerRun).not.toHaveBeenCalled();
  });

  it("resumes only the authenticated player's active culture", async () => {
    getKqPlayerActiveRun.mockResolvedValue({ runId: "run-1" });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(getKqPlayerActiveRun).toHaveBeenCalledWith(customerId);
  });

  it("requires authentication before parsing or mutating", async () => {
    getCurrentCustomerSessionByBackend.mockResolvedValue(null);
    expect((await POST(request({}))).status).toBe(401);
    expect(startKqPlayerRun).not.toHaveBeenCalled();
  });

  it("starts the atomic run for the authenticated owner only", async () => {
    startKqPlayerRun.mockResolvedValue({ runId: "run-1", burnReceipt: { id: "burn-1" } });
    const payload = {
      buddieCode: "HH2026-003",
      deckCodes: ["BOTTE-001", "BOTTE-003"],
      cultureTokens: 2,
      heritageCode: "HERITAGE-005",
    };
    const response = await POST(request(payload));
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(startKqPlayerRun).toHaveBeenCalledWith(customerId, payload);
  });

  it("rate limits repeated burn attempts per customer and IP", async () => {
    hitRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 42 });
    const response = await POST(request({}));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("42");
    expect(startKqPlayerRun).not.toHaveBeenCalled();
    expect(logRateLimitRejection).toHaveBeenCalled();
  });

  it("does not expose unexpected Supabase errors", async () => {
    startKqPlayerRun.mockRejectedValue(new Error("[supabase:secret_table] private detail"));
    const response = await POST(request({
      buddieCode: "HH2026-003",
      deckCodes: ["BOTTE-001", "BOTTE-003"],
    }));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("secret_table");
  });
});
