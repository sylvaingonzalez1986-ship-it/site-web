import { beforeEach, describe, expect, it, vi } from "vitest";
const { getValidatedAdminContext, awardKqHeritagePurchaseBatch } = vi.hoisted(() => ({
  getValidatedAdminContext: vi.fn(), awardKqHeritagePurchaseBatch: vi.fn(),
}));
vi.mock("@/lib/admin-guard", () => ({ getValidatedAdminContext }));
vi.mock("@/lib/supabase/kanab-quest-heritage-purchase-backend", () => ({ awardKqHeritagePurchaseBatch }));
import { POST } from "@/app/api/admin/placard/heritage/retro/route";

const request = (body: unknown) => new Request("http://localhost/api/admin/placard/heritage/retro", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});

describe("POST /api/admin/placard/heritage/retro", () => {
  beforeEach(() => vi.clearAllMocks());
  it("refuses unauthenticated batches", async () => {
    getValidatedAdminContext.mockResolvedValue(null);
    expect((await POST(request({ cursor: 0 }))).status).toBe(401);
    expect(awardKqHeritagePurchaseBatch).not.toHaveBeenCalled();
  });
  it("rejects an invalid cursor", async () => {
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    expect((await POST(request({ cursor: 1.5 }))).status).toBe(400);
    expect(awardKqHeritagePurchaseBatch).not.toHaveBeenCalled();
  });
  it("runs one private dormant batch", async () => {
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    awardKqHeritagePurchaseBatch.mockResolvedValue({
      live: false, processedItems: 0, eligibleUnits: 0, awarded: 0, alreadyAwarded: 0, nextCursor: null,
    });
    const response = await POST(request({ cursor: 250 }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(awardKqHeritagePurchaseBatch).toHaveBeenCalledWith(250);
  });
});
