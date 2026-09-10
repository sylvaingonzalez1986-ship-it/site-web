import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getValidatedAdminContext,
  getKqAdminNotebookRewardPreview,
  previewKqNotebookRewardBatch,
  syncKqNotebookRewardBatch,
} = vi.hoisted(() => ({
  getValidatedAdminContext: vi.fn(),
  getKqAdminNotebookRewardPreview: vi.fn(),
  previewKqNotebookRewardBatch: vi.fn(),
  syncKqNotebookRewardBatch: vi.fn(),
}));

vi.mock("@/lib/admin-guard", () => ({ getValidatedAdminContext }));
vi.mock("@/lib/supabase/kanab-quest-backend", () => ({ getKqAdminNotebookRewardPreview }));
vi.mock("@/lib/supabase/kanab-quest-notebook-rewards-backend", () => ({
  previewKqNotebookRewardBatch,
  syncKqNotebookRewardBatch,
}));

import { GET, POST } from "@/app/api/admin/placard/notebook-rewards/route";

const request = (body: unknown) => new Request("http://localhost/api/admin/placard/notebook-rewards", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe("GET /api/admin/placard/notebook-rewards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.KQ_RETRO_ADMIN_WRITES_ALLOWED;
  });
  afterEach(() => delete process.env.KQ_RETRO_ADMIN_WRITES_ALLOWED);

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

  it("previews one private batch without calling the write backend", async () => {
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    previewKqNotebookRewardBatch.mockResolvedValue({
      live: true, processed: 12, pending: 9, alreadyGranted: 3, nextCursor: 180,
    });
    const response = await POST(request({ cursor: 120 }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(previewKqNotebookRewardBatch).toHaveBeenCalledWith(120);
    expect(syncKqNotebookRewardBatch).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({ mode: "preview", writeAllowed: false, pending: 9 });
  });

  it("refuses an execution while the independent write gate is closed", async () => {
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    const response = await POST(request({
      cursor: 120,
      execute: true,
      confirmation: "EXECUTE_RETRO_BATCH",
    }));
    expect(response.status).toBe(409);
    expect(syncKqNotebookRewardBatch).not.toHaveBeenCalled();
  });

  it("executes one confirmed batch when the write gate is open", async () => {
    process.env.KQ_RETRO_ADMIN_WRITES_ALLOWED = "true";
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    previewKqNotebookRewardBatch.mockResolvedValue({
      live: true, processed: 9, pending: 9, alreadyGranted: 0, nextCursor: null,
    });
    syncKqNotebookRewardBatch.mockResolvedValue({
      live: true, processed: 9, granted: 9, alreadyGranted: 0, nextCursor: null,
    });
    const response = await POST(request({
      cursor: 120,
      execute: true,
      confirmation: "EXECUTE_RETRO_BATCH",
      previewFingerprint: "notebook:120:9:9:0:end",
    }));
    expect(response.status).toBe(200);
    expect(syncKqNotebookRewardBatch).toHaveBeenCalledWith(120);
    expect(await response.json()).toMatchObject({ mode: "execute", writeAllowed: true, granted: 9 });
  });

  it("rejects a stale preview before calling the write backend", async () => {
    process.env.KQ_RETRO_ADMIN_WRITES_ALLOWED = "true";
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    previewKqNotebookRewardBatch.mockResolvedValue({
      live: true, processed: 9, pending: 8, alreadyGranted: 1, nextCursor: null,
    });
    const response = await POST(request({
      cursor: 120,
      execute: true,
      confirmation: "EXECUTE_RETRO_BATCH",
      previewFingerprint: "notebook:120:9:9:0:end",
    }));
    expect(response.status).toBe(409);
    expect(syncKqNotebookRewardBatch).not.toHaveBeenCalled();
  });
});
