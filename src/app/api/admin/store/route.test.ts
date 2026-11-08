import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readStore: vi.fn(), writeStore: vi.fn(), after: vi.fn(), notifyIndexNow: vi.fn(),
}));
vi.mock("next/server", async (importOriginal) => ({
  ...await importOriginal<typeof import("next/server")>(), after: mocks.after,
}));
vi.mock("@/lib/admin-guard", () => ({ denyIfNotAdminApi: async () => null }));
vi.mock("@/lib/audit-log", () => ({ logAuditEvent: vi.fn() }));
vi.mock("@/lib/data-backend", () => ({
  readStoreByBackend: mocks.readStore, writeStoreByBackend: mocks.writeStore,
  invalidatePublicStoreCache: vi.fn(), invalidateBlogPostsCache: vi.fn(),
}));
vi.mock("@/lib/indexnow", () => ({
  collectChangedStorefrontPaths: () => ["/boutique"], notifyIndexNow: mocks.notifyIndexNow,
}));
vi.mock("@/lib/blog-image-storage", () => ({ cleanupUnusedBlogUploads: vi.fn() }));
vi.mock("@/lib/product-image-storage", () => ({ cleanupUnusedProductUploads: vi.fn() }));
vi.mock("@/lib/producer-image-storage", () => ({ cleanupUnusedProducerUploads: vi.fn() }));
vi.mock("@/lib/product-analysis-storage", () => ({ cleanupUnusedProductAnalyses: vi.fn() }));
vi.mock("@/lib/product-video-storage", () => ({ cleanupUnusedProductVideoUploads: vi.fn() }));
vi.mock("@/lib/product-media-cleanup", () => ({
  cleanupUnusedProductAnalyses: vi.fn(), cleanupUnusedProductVideoUploads: vi.fn(),
}));

import { PUT } from "@/app/api/admin/store/route";

const store = {
  products: [], producers: [], blog: [], orders: [{ id: "existing-order" }],
  content: { home: {}, boutique: { ownProducer: { image: "" } } },
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network access in store test"); }));
  mocks.readStore.mockResolvedValue(store);
  mocks.writeStore.mockImplementation(async (payload) => payload);
});
afterEach(() => vi.unstubAllGlobals());

describe("admin store write safeguards", () => {
  it("rejects unrecoverable text before writing or cleaning media", async () => {
    const response = await PUT(new Request("http://localhost/api/admin/store", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...store, blog: [{ title: "F\uFFFDvrier" }] }),
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("Texte invalide") });
    expect(mocks.readStore).not.toHaveBeenCalled();
    expect(mocks.writeStore).not.toHaveBeenCalled();
  });

  it("preserves orders and schedules public page notification after a valid save", async () => {
    const response = await PUT(new Request("http://localhost/api/admin/store", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...store, orders: [] }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.writeStore).toHaveBeenCalledWith(expect.objectContaining({ orders: store.orders }));
    expect(mocks.after).toHaveBeenCalledOnce();
    const notify = mocks.after.mock.calls[0]?.[0] as () => Promise<void>;
    await notify();
    expect(mocks.notifyIndexNow).toHaveBeenCalledWith(["/boutique"]);
  });
});
