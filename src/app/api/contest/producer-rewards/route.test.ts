import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), progress: vi.fn(), claim: vi.fn(), completion: vi.fn(), purchase: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/supabase/kanab-quest-producer-rewards-backend", () => ({
  getKqProducerRewardProgressForCustomer: mocks.progress,
  claimKqProducerHeritageForCustomer: mocks.claim,
  claimKqProducerCompletionForCustomer: mocks.completion,
  claimKqProducerPurchaseBuddieForCustomer: mocks.purchase,
}));

import { GET, POST } from "@/app/api/contest/producer-rewards/route";

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

  it("claims only for the authenticated customer and returns refreshed progress", async () => {
    mocks.session.mockResolvedValue({ customerId: "customer-1", customer: {} });
    mocks.claim.mockResolvedValue({ cardCode: "HERITAGE-001", alreadyGranted: false });
    mocks.progress.mockResolvedValue([{
      campaignId: "11111111-1111-1111-1111-111111111111",
      entries: [{ entryId: "flower-1" }],
      heritageGranted: true,
    }]);
    const response = await POST(new Request("http://localhost/api/contest/producer-rewards", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        campaignId: "11111111-1111-1111-1111-111111111111",
        entryId: "flower-1",
        customerId: "attacker-controlled",
      }),
    }));
    expect(response.status).toBe(200);
    expect(mocks.claim).toHaveBeenCalledWith({
      customerId: "customer-1",
      campaignId: "11111111-1111-1111-1111-111111111111",
      entryId: "flower-1",
    });
    expect((await response.json()).campaign.heritageGranted).toBe(true);
  });

  it("refuses an unauthenticated claim", async () => {
    mocks.session.mockResolvedValue(null);
    const response = await POST(new Request("http://localhost/api/contest/producer-rewards", {
      method: "POST",
      body: JSON.stringify({ campaignId: "campaign-1", entryId: "flower-1" }),
    }));
    expect(response.status).toBe(401);
    expect(mocks.claim).not.toHaveBeenCalled();
  });
  it.each(["completion", "purchase-buddie"])("authorizes %s only for the session and producer", async (action) => {
    mocks.session.mockResolvedValue({ customerId: "customer-1" });
    const claim = action === "completion" ? mocks.completion : mocks.purchase;
    claim.mockResolvedValue({ producerId: "p1", alreadyGranted: false });
    mocks.progress.mockResolvedValue([{ producerId: "p1", entries: [], completionReward: { granted: true } }]);
    const response = await POST(new Request("http://localhost/api/contest/producer-rewards", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, producerId: "p1", customerId: "forged", eligible: true, cashCents: 999999, cardCode: "HH2026-001" }),
    }));
    expect(response.status).toBe(200);
    expect(claim).toHaveBeenCalledWith({ customerId: "customer-1", producerId: "p1" });
    expect(mocks.claim).not.toHaveBeenCalled();
    expect((await response.json()).campaign.producerId).toBe("p1");
  });

  it("rejects unknown actions before any reward write", async () => {
    mocks.session.mockResolvedValue({ customerId: "customer-1" });
    const response = await POST(new Request("http://localhost/api/contest/producer-rewards", {
      method: "POST", body: JSON.stringify({ action: "grant-cash", producerId: "p1" }),
    }));
    expect(response.status).toBe(400);
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.completion).not.toHaveBeenCalled();
    expect(mocks.purchase).not.toHaveBeenCalled();
  });

  it("does not trust client eligibility when the purchase RPC rejects", async () => {
    mocks.session.mockResolvedValue({ customerId: "customer-1" });
    mocks.purchase.mockRejectedValue(new Error("Achat incomplet."));
    const response = await POST(new Request("http://localhost/api/contest/producer-rewards", {
      method: "POST", body: JSON.stringify({ action: "purchase-buddie", producerId: "p1", eligible: true }),
    }));
    expect(response.status).toBe(409);
    expect(mocks.progress).not.toHaveBeenCalled();
  });

});
