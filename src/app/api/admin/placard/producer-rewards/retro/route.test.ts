import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  preview: vi.fn(),
  sync: vi.fn(),
}));

vi.mock("@/lib/admin-guard", () => ({ getValidatedAdminContext: mocks.admin }));
vi.mock("@/lib/supabase/kanab-quest-producer-rewards-backend", () => ({
  previewKqProducerNotebookRewardBatch: mocks.preview,
  syncKqProducerNotebookRewardBatch: mocks.sync,
}));

import { POST } from "@/app/api/admin/placard/producer-rewards/retro/route";

const request = (body: unknown) => new Request("http://localhost/api/admin/placard/producer-rewards/retro", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

const preview = {
  live: true,
  processed: 50,
  eligibleReviews: 12,
  pendingFlowerBoosters: 20,
  pendingHeritages: 3,
  alreadyComplete: 7,
  nextCursor: 50,
};

describe("POST /api/admin/placard/producer-rewards/retro", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.KQ_RETRO_ADMIN_WRITES_ALLOWED;
  });
  afterEach(() => delete process.env.KQ_RETRO_ADMIN_WRITES_ALLOWED);

  it("refuses unauthenticated previews", async () => {
    mocks.admin.mockResolvedValue(null);
    expect((await POST(request({ cursor: 0 }))).status).toBe(401);
    expect(mocks.preview).not.toHaveBeenCalled();
  });

  it("returns a read-only preview by default", async () => {
    mocks.admin.mockResolvedValue({ email: "admin@example.test" });
    mocks.preview.mockResolvedValue(preview);
    const response = await POST(request({ cursor: 0 }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.preview).toHaveBeenCalledWith(0);
    expect(mocks.sync).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({
      mode: "preview",
      writeAllowed: false,
      previewFingerprint: "producer:0:50:12:20:3:7:50",
    });
  });

  it("refuses writes while the independent gate is closed", async () => {
    mocks.admin.mockResolvedValue({ email: "admin@example.test" });
    const response = await POST(request({
      cursor: 0,
      execute: true,
      confirmation: "EXECUTE_RETRO_BATCH",
      previewFingerprint: "producer:0:50:12:20:3:7:50",
    }));
    expect(response.status).toBe(409);
    expect(mocks.preview).not.toHaveBeenCalled();
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it("rejects a stale preview before persistence", async () => {
    process.env.KQ_RETRO_ADMIN_WRITES_ALLOWED = "true";
    mocks.admin.mockResolvedValue({ email: "admin@example.test" });
    mocks.preview.mockResolvedValue({ ...preview, pendingHeritages: 2 });
    const response = await POST(request({
      cursor: 0,
      execute: true,
      confirmation: "EXECUTE_RETRO_BATCH",
      previewFingerprint: "producer:0:50:12:20:3:7:50",
    }));
    expect(response.status).toBe(409);
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it("executes one confirmed unchanged batch when the gate is open", async () => {
    process.env.KQ_RETRO_ADMIN_WRITES_ALLOWED = "true";
    mocks.admin.mockResolvedValue({ email: "admin@example.test" });
    mocks.preview.mockResolvedValue(preview);
    mocks.sync.mockResolvedValue({
      live: true,
      processed: 50,
      flowerBoostersGranted: 20,
      heritagesGranted: 3,
      nextCursor: 50,
    });
    const response = await POST(request({
      cursor: 0,
      execute: true,
      confirmation: "EXECUTE_RETRO_BATCH",
      previewFingerprint: "producer:0:50:12:20:3:7:50",
    }));
    expect(response.status).toBe(200);
    expect(mocks.sync).toHaveBeenCalledWith(0);
    expect(await response.json()).toMatchObject({ mode: "execute", flowerBoostersGranted: 20 });
  });
});
