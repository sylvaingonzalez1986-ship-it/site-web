import { beforeEach, describe, expect, it, vi } from "vitest";

const { getValidatedAdminContext, getKqAdminCollectionSnapshot } = vi.hoisted(() => ({
  getValidatedAdminContext: vi.fn(),
  getKqAdminCollectionSnapshot: vi.fn(),
}));

vi.mock("@/lib/admin-guard", () => ({ getValidatedAdminContext }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({ getKqAdminCollectionSnapshot }));

import { GET } from "@/app/api/admin/placard/collection/route";

describe("GET /api/admin/placard/collection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses requests without an admin session", async () => {
    getValidatedAdminContext.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(getKqAdminCollectionSnapshot).not.toHaveBeenCalled();
  });

  it("returns the private collection snapshot without caching", async () => {
    getValidatedAdminContext.mockResolvedValue({ customerId: "admin", email: "admin@example.test" });
    getKqAdminCollectionSnapshot.mockResolvedValue({
      collectionActive: false,
      ownerFound: true,
      inventory: { "BOTTE-001": 2 },
      cards: [],
    });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(getKqAdminCollectionSnapshot).toHaveBeenCalledWith("admin@example.test");
  });
});
