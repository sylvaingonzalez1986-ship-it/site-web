import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ enabled: vi.fn(), pool: vi.fn(), session: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqPlayerRequestEnabled: mocks.enabled }));
vi.mock("@/lib/supabase/arena-customer-rewards-backend", () => ({ getArenaCustomerRewardPool: mocks.pool }));

import { GET } from "@/app/api/arena/rewards/route";

describe("GET /api/arena/rewards", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.session.mockResolvedValue(null);
  });

  it("returns the public customer reward projection", async () => {
    mocks.enabled.mockReturnValue(true);
    mocks.pool.mockResolvedValue({ seasonCode: "KQ-2026-S1", poolGrams: 100, surpriseReward: { estimatedGrams: 10 } });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ poolGrams: 100, surpriseReward: { estimatedGrams: 10 } });
    expect(response.headers.get("cache-control")).toContain("private, no-store");
    expect(mocks.session).toHaveBeenCalledWith("identity");
    expect(mocks.pool).toHaveBeenCalledWith({ viewerId: undefined });
  });

  it("passes the signed-in customer identity to the reward projection", async () => {
    mocks.enabled.mockReturnValue(true);
    mocks.session.mockResolvedValue({ customerId: "customer-123" });
    mocks.pool.mockResolvedValue({ poolGrams: 100 });
    expect((await GET()).status).toBe(200);
    expect(mocks.pool).toHaveBeenCalledWith({ viewerId: "customer-123" });
  });

  it("does not expose backend failures", async () => {
    mocks.enabled.mockReturnValue(true);
    mocks.pool.mockRejectedValue(new Error("private database detail"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("private database detail");
  });
});
