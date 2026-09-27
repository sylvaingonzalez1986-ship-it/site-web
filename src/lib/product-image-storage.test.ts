import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: mocks.createClient }));

import { cleanupUnusedProductUploads } from "@/lib/product-image-storage";
import { cleanupScope, SCOPES } from "../../scripts/cleanup-supabase-storage-orphans.mjs";

const SHOP = "00000000-0000-4000-8000-000000000001.jpg";
const NOTEBOOK = "00000000-0000-4000-8000-000000000002.jpg";
const GALLERY = "00000000-0000-4000-8000-000000000003.webp";
const LAST_PAGE = "00000000-0000-4000-8000-000000000004.png";
const ORPHAN = "00000000-0000-4000-8000-000000000005.jpg";
const SECOND_SHOP = "00000000-0000-4000-8000-000000000006.jpg";
const url = (name: string) => `https://example.supabase.co/storage/v1/object/public/products/${name}`;

function fixture(failure?: { table: string; offset: number; malformed?: boolean }) {
  const rows: Record<string, Array<Record<string, unknown>>> = {
    products: [
      { id: "p1", image: url(SHOP), images: [] },
      { id: "p2", image: "", images: [] },
      { id: "p3", image: "", images: [url(SECOND_SHOP)] },
    ],
    contest_entries: [
      { id: "a", season_id: "archived-season", is_published: false, image_url: url(NOTEBOOK), gallery_urls: [] },
      { id: "b", image_url: "", gallery_urls: [] },
      { id: "c", season_id: "older-season", is_published: false, image_url: "", gallery_urls: [url(GALLERY)] },
      { id: "d", image_url: null, gallery_urls: null },
      { id: "e", image_url: url(LAST_PAGE), gallery_urls: [] },
    ],
  };
  const ranges: Array<{ table: string; start: number; end: number }> = [];
  const remove = vi.fn().mockResolvedValue({ data: [], error: null });
  const list = vi.fn().mockResolvedValue({ data: [SHOP, SECOND_SHOP, NOTEBOOK, GALLERY, LAST_PAGE, ORPHAN].map(name => ({ id: name, name })), error: null });
  const from = vi.fn((table: string) => ({
    select: vi.fn(() => ({
      order: vi.fn((column: string, options: { ascending: boolean }) => {
        expect(column).toBe("id");
        expect(options).toEqual({ ascending: true });
        return {
          range: vi.fn(async (start: number, end: number) => {
            ranges.push({ table, start, end });
            if (failure?.table === table && failure.offset === start) {
              return { data: null, error: failure.malformed ? null : { message: "reference read failed" } };
            }
            // Simulate an API cap smaller than the requested range; do not stop at a short page.
            return { data: rows[table].slice(start, Math.min(end + 1, start + 2)), error: null };
          }),
        };
      }),
    })),
  }));
  const client = { from, storage: { from: vi.fn(() => ({ list, remove })) } };
  return { client, ranges, list, remove };
}

const productsScope = SCOPES.find(scope => scope.bucket === "products")!;
const cleanups = [
  {
    name: "admin product image cleanup",
    run: async (state: ReturnType<typeof fixture>) => {
      mocks.createClient.mockReturnValue(state.client);
      await cleanupUnusedProductUploads([url(SHOP), url(SECOND_SHOP)]);
    },
  },
  {
    name: "storage orphan script",
    run: async (state: ReturnType<typeof fixture>) => {
      await cleanupScope({ supabase: state.client, ...productsScope, applyChanges: true });
    },
  },
];

beforeEach(() => vi.clearAllMocks());

for (const cleanup of cleanups) {
  describe(cleanup.name, () => {
    it("preserves notebook-only photos, historical unpublished galleries and every reference page", async () => {
      const state = fixture();
      await cleanup.run(state);
      expect(state.ranges.filter(range => range.table === "contest_entries").map(range => range.start)).toEqual([0, 2, 4, 5]);
      expect(state.list).toHaveBeenCalledOnce();
      expect(state.remove).toHaveBeenCalledExactlyOnceWith([ORPHAN]);
    });

    it.each([0, 2])("never deletes when notebook references fail at offset %i", async (offset) => {
      const state = fixture({ table: "contest_entries", offset });
      await expect(cleanup.run(state)).rejects.toThrow("reading contest_entries image references failed");
      expect(state.list).not.toHaveBeenCalled();
      expect(state.remove).not.toHaveBeenCalled();
    });

    it("treats an invalid reference response as failure instead of an empty notebook", async () => {
      const state = fixture({ table: "contest_entries", offset: 2, malformed: true });
      await expect(cleanup.run(state)).rejects.toThrow("invalid response");
      expect(state.remove).not.toHaveBeenCalled();
    });
  });
}

describe("storage orphan script source union", () => {
  it("paginates product references and cleans their union with notebook references once", async () => {
    const state = fixture();
    const summary = await cleanupScope({ supabase: state.client, ...productsScope, applyChanges: true });
    expect(state.ranges.filter(range => range.table === "products").map(range => range.start)).toEqual([0, 2, 3]);
    expect(summary.referencedObjects).toBe(5);
    expect(summary.deletedObjects).toBe(1);
    expect(state.remove).toHaveBeenCalledExactlyOnceWith([ORPHAN]);
  });

  it("does not delete anything if product references fail after the first page", async () => {
    const state = fixture({ table: "products", offset: 2 });
    await expect(cleanupScope({ supabase: state.client, ...productsScope, applyChanges: true })).rejects.toThrow("reading products image references failed");
    expect(state.list).not.toHaveBeenCalled();
    expect(state.remove).not.toHaveBeenCalled();
  });

  it("keeps dry-run non-destructive after collecting both sources", async () => {
    const state = fixture();
    const summary = await cleanupScope({ supabase: state.client, ...productsScope, applyChanges: false });
    expect(summary.orphanObjects).toBe(1);
    expect(summary.deletedObjects).toBe(0);
    expect(state.remove).not.toHaveBeenCalled();
  });
});
