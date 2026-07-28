import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getValidatedAdminContext,
  getKqAdminCollectionSnapshot,
  getKqAdminHeritageSnapshot,
  getKqAdminLaunchReadinessFromSnapshots,
  getKqAdminNotebookRewardPreview,
  getKqAdminSeasonRewardPreview,
  getKqAdminSeasonRolloverPreview,
} = vi.hoisted(() => ({
  getValidatedAdminContext: vi.fn(),
  getKqAdminCollectionSnapshot: vi.fn(),
  getKqAdminHeritageSnapshot: vi.fn(),
  getKqAdminLaunchReadinessFromSnapshots: vi.fn(),
  getKqAdminNotebookRewardPreview: vi.fn(),
  getKqAdminSeasonRewardPreview: vi.fn(),
  getKqAdminSeasonRolloverPreview: vi.fn(),
}));

vi.mock("@/lib/admin-guard", () => ({ getValidatedAdminContext }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({
  getKqAdminCollectionSnapshot,
  getKqAdminHeritageSnapshot,
  getKqAdminLaunchReadinessFromSnapshots,
  getKqAdminNotebookRewardPreview,
  getKqAdminSeasonRewardPreview,
  getKqAdminSeasonRolloverPreview,
}));

import { GET } from "@/app/api/admin/placard/bootstrap/route";

describe("GET /api/admin/placard/bootstrap", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses unauthenticated bootstrap requests", async () => {
    getValidatedAdminContext.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(getKqAdminCollectionSnapshot).not.toHaveBeenCalled();
  });

  it("aggregates six initial reads into one private response", async () => {
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    getKqAdminLaunchReadinessFromSnapshots.mockResolvedValue({ safelyDormant: true });
    getKqAdminSeasonRewardPreview.mockResolvedValue({ rewardsLive: false });
    getKqAdminHeritageSnapshot.mockResolvedValue({ collectionActive: false });
    getKqAdminCollectionSnapshot.mockResolvedValue({ ownerFound: true });
    getKqAdminNotebookRewardPreview.mockResolvedValue({ rewardsLive: false, pendingBadges: 2 });
    getKqAdminSeasonRolloverPreview.mockResolvedValue({ ready: false, blockers: ["Planifier S2"] });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({
      readiness: { safelyDormant: true },
      seasonRewards: { rewardsLive: false },
      heritage: { collectionActive: false },
      collection: { ownerFound: true },
      notebookRewards: { rewardsLive: false, pendingBadges: 2 },
      seasonRollover: { ready: false, blockers: ["Planifier S2"] },
      warnings: [],
    });
    expect(getKqAdminLaunchReadinessFromSnapshots).toHaveBeenCalledWith(
      { collectionActive: false },
      { ownerFound: true },
    );
    expect(getKqAdminHeritageSnapshot).toHaveBeenCalledWith("admin@example.test");
    expect(getKqAdminCollectionSnapshot).toHaveBeenCalledWith("admin@example.test");
    expect(getKqAdminNotebookRewardPreview).toHaveBeenCalledWith("admin@example.test");
  });

  it("keeps healthy sections when one optional read fails", async () => {
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    getKqAdminLaunchReadinessFromSnapshots.mockResolvedValue({ safelyDormant: true });
    getKqAdminSeasonRewardPreview.mockRejectedValue(new Error("Saison indisponible."));
    getKqAdminHeritageSnapshot.mockResolvedValue({ collectionActive: false });
    getKqAdminCollectionSnapshot.mockResolvedValue({ ownerFound: true });
    getKqAdminNotebookRewardPreview.mockResolvedValue({ rewardsLive: false });
    getKqAdminSeasonRolloverPreview.mockResolvedValue({ ready: false });
    const response = await GET();
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.seasonRewards).toBeNull();
    expect(payload.collection).toEqual({ ownerFound: true });
    expect(payload.warnings).toEqual(["Saison : Saison indisponible."]);
  });

  it("returns an unavailable status when every bootstrap section fails", async () => {
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    getKqAdminLaunchReadinessFromSnapshots.mockRejectedValue(new Error("A"));
    getKqAdminSeasonRewardPreview.mockRejectedValue(new Error("B"));
    getKqAdminHeritageSnapshot.mockRejectedValue(new Error("C"));
    getKqAdminCollectionSnapshot.mockRejectedValue(new Error("D"));
    getKqAdminNotebookRewardPreview.mockRejectedValue(new Error("E"));
    getKqAdminSeasonRolloverPreview.mockRejectedValue(new Error("F"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect((await response.json()).warnings).toHaveLength(6);
  });
});
