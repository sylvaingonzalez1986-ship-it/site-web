import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), progress: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/supabase/kanab-quest-producer-rewards-backend", () => ({
  getKqProducerRewardProgressForCustomer: mocks.progress,
}));

import { GET } from "@/app/api/contest/producer-rewards/route";

describe("GET /api/contest/producer-rewards", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not expose another player's progress", async () => {
    mocks.session.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(mocks.progress).not.toHaveBeenCalled();
  });

  it("uses only the authenticated customer id", async () => {
    mocks.session.mockResolvedValue({ customerId: "customer-1", customer: {} });
    mocks.progress.mockResolvedValue([{ campaignId: "campaign-1" }]);
    const response = await GET();
    expect(mocks.progress).toHaveBeenCalledWith("customer-1");
    expect(await response.json()).toEqual({ campaigns: [{ campaignId: "campaign-1" }] });
  });

  it("hides infrastructure failures", async () => {
    mocks.session.mockResolvedValue({ customerId: "customer-1", customer: {} });
    mocks.progress.mockRejectedValue(new Error("private table detail"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("private table detail");
  });
});
