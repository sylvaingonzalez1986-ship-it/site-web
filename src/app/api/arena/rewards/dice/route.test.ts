import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enabled: vi.fn(),
  session: vi.fn(),
  state: vi.fn(),
  roll: vi.fn(),
  rateLimit: vi.fn(),
  logRejection: vi.fn(),
}));

vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqPlayerRequestEnabled: mocks.enabled }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/security-rate-limit", () => ({
  getRequestIp: () => "127.0.0.1",
  hitRateLimit: mocks.rateLimit,
  logRateLimitRejection: mocks.logRejection,
}));
vi.mock("@/lib/supabase/arena-customer-rewards-backend", () => ({
  getArenaCustomerRewardDiceState: mocks.state,
  rollArenaCustomerRewardDice: mocks.roll,
}));

import { GET, POST } from "@/app/api/arena/rewards/dice/route";

const request = () => new Request("http://localhost/api/arena/rewards/dice", { method: "POST" });

describe("Arena weekly reward dice API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled.mockReturnValue(true);
    mocks.session.mockResolvedValue({ customerId: "player-1", customer: { email: "player@example.test" } });
    mocks.rateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
    mocks.state.mockResolvedValue({ eligible: true, viewerRoll: null });
    mocks.roll.mockResolvedValue({ viewerRoll: 5, alreadyRolled: false, pool: { contributionRateBps: 1_000 } });
  });

  it("keeps the personal roll private", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.roll).not.toHaveBeenCalled();
  });

  it("returns the current player's weekly roll state", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ eligible: true, viewerRoll: null });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("rolls once through the authenticated backend", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ viewerRoll: 5, pool: { contributionRateBps: 1_000 } });
    expect(mocks.roll).toHaveBeenCalledWith("player-1");
  });

  it("rate-limits repeated attempts", async () => {
    mocks.rateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 });
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(mocks.roll).not.toHaveBeenCalled();
  });
});
