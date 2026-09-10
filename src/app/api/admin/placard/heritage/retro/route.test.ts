import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const {
  getValidatedAdminContext,
  awardKqHeritagePurchaseBatch,
  previewKqHeritagePurchaseBatch,
} = vi.hoisted(() => ({
  getValidatedAdminContext: vi.fn(),
  awardKqHeritagePurchaseBatch: vi.fn(),
  previewKqHeritagePurchaseBatch: vi.fn(),
}));
vi.mock("@/lib/admin-guard", () => ({ getValidatedAdminContext }));
vi.mock("@/lib/supabase/kanab-quest-heritage-purchase-backend", () => ({
  awardKqHeritagePurchaseBatch,
  previewKqHeritagePurchaseBatch,
}));
import { POST } from "@/app/api/admin/placard/heritage/retro/route";

const request = (body: unknown) => new Request("http://localhost/api/admin/placard/heritage/retro", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});

describe("POST /api/admin/placard/heritage/retro", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.KQ_RETRO_ADMIN_WRITES_ALLOWED;
  });
  afterEach(() => delete process.env.KQ_RETRO_ADMIN_WRITES_ALLOWED);
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
  it("previews one private batch without calling the write backend", async () => {
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    previewKqHeritagePurchaseBatch.mockResolvedValue({
      live: false, processedItems: 25, eligibleUnits: 8, pendingUnits: 6, alreadyAwarded: 2, nextCursor: 280,
    });
    const response = await POST(request({ cursor: 250 }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(previewKqHeritagePurchaseBatch).toHaveBeenCalledWith(250);
    expect(awardKqHeritagePurchaseBatch).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({ mode: "preview", writeAllowed: false, pendingUnits: 6 });
  });
  it("refuses an execution while the independent write gate is closed", async () => {
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    const response = await POST(request({
      cursor: 250,
      execute: true,
      confirmation: "EXECUTE_RETRO_BATCH",
    }));
    expect(response.status).toBe(409);
    expect(awardKqHeritagePurchaseBatch).not.toHaveBeenCalled();
  });
  it("executes one confirmed batch when the write gate is open", async () => {
    process.env.KQ_RETRO_ADMIN_WRITES_ALLOWED = "true";
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    previewKqHeritagePurchaseBatch.mockResolvedValue({
      live: true, processedItems: 25, eligibleUnits: 6, pendingUnits: 6, alreadyAwarded: 0, nextCursor: null,
    });
    awardKqHeritagePurchaseBatch.mockResolvedValue({
      live: true, processedItems: 25, eligibleUnits: 6, awarded: 6, alreadyAwarded: 0, nextCursor: null,
    });
    const response = await POST(request({
      cursor: 250,
      execute: true,
      confirmation: "EXECUTE_RETRO_BATCH",
      previewFingerprint: "heritage:250:25:6:6:0:end",
    }));
    expect(response.status).toBe(200);
    expect(awardKqHeritagePurchaseBatch).toHaveBeenCalledWith(250);
    expect(await response.json()).toMatchObject({ mode: "execute", writeAllowed: true, awarded: 6 });
  });

  it("rejects a stale preview before calling the write backend", async () => {
    process.env.KQ_RETRO_ADMIN_WRITES_ALLOWED = "true";
    getValidatedAdminContext.mockResolvedValue({ email: "admin@example.test" });
    previewKqHeritagePurchaseBatch.mockResolvedValue({
      live: true, processedItems: 25, eligibleUnits: 6, pendingUnits: 5, alreadyAwarded: 1, nextCursor: null,
    });
    const response = await POST(request({
      cursor: 250,
      execute: true,
      confirmation: "EXECUTE_RETRO_BATCH",
      previewFingerprint: "heritage:250:25:6:6:0:end",
    }));
    expect(response.status).toBe(409);
    expect(awardKqHeritagePurchaseBatch).not.toHaveBeenCalled();
  });
});
