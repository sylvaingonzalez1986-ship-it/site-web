import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), snapshot: vi.fn(), configure: vi.fn() }));
vi.mock("@/lib/admin-guard", () => ({ getValidatedAdminContext: mocks.admin }));
vi.mock("@/lib/supabase/kanab-quest-producer-rewards-backend", () => ({
  getKqProducerRewardAdminSnapshot: mocks.snapshot,
  configureKqProducerRewardCampaign: mocks.configure,
}));

import { GET, POST } from "@/app/api/admin/placard/producer-rewards/route";

describe("admin producer reward campaigns", () => {
  beforeEach(() => vi.clearAllMocks());

  it("protects the producer list", async () => {
    mocks.admin.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(mocks.snapshot).not.toHaveBeenCalled();
  });

  it("rejects malformed configurations before persistence", async () => {
    mocks.admin.mockResolvedValue({ email: "admin@example.test" });
    const response = await POST(new Request("http://localhost/api/admin/placard/producer-rewards", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ producerId: "p1", entryIds: [] }),
    }));
    expect(response.status).toBe(400);
    expect(mocks.configure).not.toHaveBeenCalled();
  });

  it("never exposes configuration errors", async () => {
    mocks.admin.mockResolvedValue({ email: "admin@example.test" });
    mocks.configure.mockRejectedValue(new Error("private constraint detail"));
    const response = await POST(new Request("http://localhost/api/admin/placard/producer-rewards", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ producerId: "p1", heritageCode: "HERITAGE-001", entryIds: ["entry-1"], activate: false }),
    }));
    expect(response.status).toBe(409);
    expect(JSON.stringify(await response.json())).not.toContain("private constraint detail");
  });
});
