import { beforeEach, describe, expect, it, vi } from "vitest";

const { getValidatedAdminContext, getKqAdminNotebookRewardPreview, syncKqNotebookRewardBatch } = vi.hoisted(() => ({
  getValidatedAdminContext: vi.fn(),
  getKqAdminNotebookRewardPreview: vi.fn(),
  syncKqNotebookRewardBatch: vi.fn(),
}));

vi.mock("@/lib/admin-guard", () => ({ getValidatedAdminContext }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({ getKqAdminNotebookRewardPreview }));
vi.mock("@/lib/supabase/kanab-quest-notebook-rewards-backend", () => ({ syncKqNotebookRewardBatch }));

import { GET, POST } from "@/app/api/admin/placard/notebook-rewards/route";

const request = (body: unknown) => new Request("http://localhost/api/admin/placard/notebook-rewards", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe("GET /api/admin/placard/notebook-rewards", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses unauthenticated previews", async () => {
    getValidatedAdminContext.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(getKqAdminNotebookRewardPreview).not.toHaveBeenCalled();
  });

  it("returns a private read-only preview for the admin", async () => {
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    getKqAdminNotebookRewardPreview.mockResolvedValue({
      rewardsLive: false,
      pendingBadges: 2,
      pendingSupportBoosters: 2,
      pendingCultureTokens: 3,
      badges: [],
    });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(getKqAdminNotebookRewardPreview).toHaveBeenCalledWith("admin@example.test");
  });

  it("refuses unauthenticated retro-attribution batches", async () => {
    getValidatedAdminContext.mockResolvedValue(null);
    expect((await POST(request({ cursor: 0 }))).status).toBe(401);
    expect(syncKqNotebookRewardBatch).not.toHaveBeenCalled();
  });

  it("rejects an invalid cursor before the backend", async () => {
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    expect((await POST(request({ cursor: -1 }))).status).toBe(400);
    expect(syncKqNotebookRewardBatch).not.toHaveBeenCalled();
  });

  it("runs one private dormant batch with an explicit cursor", async () => {
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    syncKqNotebookRewardBatch.mockResolvedValue({
      live: false, processed: 0, granted: 0, alreadyGranted: 0, nextCursor: null,
    });
    const response = await POST(request({ cursor: 120 }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(syncKqNotebookRewardBatch).toHaveBeenCalledWith(120);
    expect(await response.json()).toMatchObject({ live: false, processed: 0 });
  });
});
