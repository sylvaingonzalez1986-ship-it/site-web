import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ enabled: vi.fn(), pool: vi.fn() }));
vi.mock("@/lib/kanab-quest-player-access", () => ({ isKqPlayerApiEnabled: mocks.enabled }));
vi.mock("@/lib/supabase/arena-customer-rewards-backend", () => ({ getArenaCustomerRewardPool: mocks.pool }));

import { GET } from "@/app/api/arena/rewards/route";

describe("GET /api/arena/rewards", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the public customer reward projection", async () => {
    mocks.enabled.mockReturnValue(true);
    mocks.pool.mockResolvedValue({ seasonCode: "KQ-2026-S1", poolGrams: 100, surpriseReward: { estimatedGrams: 10 } });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ poolGrams: 100, surpriseReward: { estimatedGrams: 10 } });
    expect(response.headers.get("cache-control")).toContain("s-maxage=300");
  });

  it("does not expose backend failures", async () => {
    mocks.enabled.mockReturnValue(true);
    mocks.pool.mockRejectedValue(new Error("private database detail"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("private database detail");
  });
});
