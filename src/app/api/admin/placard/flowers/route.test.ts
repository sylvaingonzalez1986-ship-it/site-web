import { beforeEach, describe, expect, it, vi } from "vitest";

const { getValidatedAdminContext, getKqAdminFlowers } = vi.hoisted(() => ({
  getValidatedAdminContext: vi.fn(),
  getKqAdminFlowers: vi.fn(),
}));
vi.mock("@/lib/admin-guard", () => ({ getValidatedAdminContext }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({ getKqAdminFlowers }));

import { GET } from "@/app/api/admin/placard/flowers/route";

describe("GET /api/admin/placard/flowers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("protects the private flower reserve", async () => {
    getValidatedAdminContext.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(getKqAdminFlowers).not.toHaveBeenCalled();
  });

  it("returns official flowers without caching", async () => {
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    getKqAdminFlowers.mockResolvedValue([{ id: "flower-1", status: "available" }]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(getKqAdminFlowers).toHaveBeenCalledWith("admin@example.test");
  });
});
