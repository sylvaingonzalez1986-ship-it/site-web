import { beforeEach, describe, expect, it, vi } from "vitest";

const { getValidatedAdminContext, getKqAdminHeritageSnapshot, craftKqAdminHeritageCard } = vi.hoisted(() => ({
  getValidatedAdminContext: vi.fn(),
  getKqAdminHeritageSnapshot: vi.fn(),
  craftKqAdminHeritageCard: vi.fn(),
}));

vi.mock("@/lib/admin-guard", () => ({ getValidatedAdminContext }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({ getKqAdminHeritageSnapshot, craftKqAdminHeritageCard }));

import { GET, POST } from "@/app/api/admin/placard/heritage/route";

describe("GET /api/admin/placard/heritage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses unauthenticated access", async () => {
    getValidatedAdminContext.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it("returns the dormant admin collection without public caching", async () => {
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    getKqAdminHeritageSnapshot.mockResolvedValue({
      collectionActive: false,
      totalPulls: 0,
      pullsWithoutRare: 0,
      cards: [],
      draws: [],
    });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(getKqAdminHeritageSnapshot).toHaveBeenCalledWith("admin@example.test");
  });

  it("keeps crafting behind the authenticated admin route", async () => {
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    craftKqAdminHeritageCard.mockResolvedValue({ fragmentBalance: 4 });
    const response = await POST(new Request("http://localhost/api/admin/placard/heritage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cardCode: "HERITAGE-001" }),
    }));
    expect(response.status).toBe(201);
    expect(craftKqAdminHeritageCard).toHaveBeenCalledWith("admin@example.test", "HERITAGE-001");
  });
});
