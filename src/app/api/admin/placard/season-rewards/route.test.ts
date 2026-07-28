import { beforeEach, describe, expect, it, vi } from "vitest";

const { getValidatedAdminContext, getKqAdminSeasonRewardPreview, distributeKqSeasonRewards } = vi.hoisted(() => ({
  getValidatedAdminContext: vi.fn(),
  getKqAdminSeasonRewardPreview: vi.fn(),
  distributeKqSeasonRewards: vi.fn(),
}));

vi.mock("@/lib/admin-guard", () => ({ getValidatedAdminContext }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({ getKqAdminSeasonRewardPreview }));
vi.mock("@/lib/supabase/kanab-quest-season-rewards-backend", () => ({ distributeKqSeasonRewards }));

import { GET, POST } from "@/app/api/admin/placard/season-rewards/route";

describe("GET /api/admin/placard/season-rewards", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses unauthenticated season previews", async () => {
    getValidatedAdminContext.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(getKqAdminSeasonRewardPreview).not.toHaveBeenCalled();
  });

  it("returns a private dormant preview without writing grants", async () => {
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    getKqAdminSeasonRewardPreview.mockResolvedValue({
      rewardsLive: false,
      eligiblePlayers: 4,
      alreadyGranted: 0,
      pendingGrants: 4,
      grants: [],
    });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect((await response.json()).rewardsLive).toBe(false);
    expect(getKqAdminSeasonRewardPreview).toHaveBeenCalledTimes(1);
  });

  it("does not expose backend failures as successful previews", async () => {
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    getKqAdminSeasonRewardPreview.mockRejectedValue(new Error("Snapshot indisponible."));
    const response = await GET();
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("Snapshot");
  });

  it("refuses unauthenticated distribution attempts", async () => {
    getValidatedAdminContext.mockResolvedValue(null);
    expect((await POST()).status).toBe(401);
    expect(distributeKqSeasonRewards).not.toHaveBeenCalled();
  });

  it("keeps the protected distribution command dormant", async () => {
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    distributeKqSeasonRewards.mockResolvedValue({
      live: false, eligiblePlayers: 0, granted: 0, alreadyGranted: 0,
    });
    const response = await POST();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toMatchObject({ live: false, granted: 0 });
    expect(distributeKqSeasonRewards).toHaveBeenCalledWith("KQ-2026-S1");
  });
});
