import { describe, expect, it, vi } from "vitest";
import type { Product } from "@/data/products";
import {
  collectChangedStorefrontPaths,
  normalizeIndexNowUrls,
  notifyIndexNow,
} from "@/lib/indexnow";
import type { CmsStore } from "@/types/store";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "heaven",
    name: "Heaven",
    category: "fleurs",
    price: 2.5,
    image: "/heaven.jpg",
    description: "Fleur CBD bretonne.",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function store(products: Product[]): CmsStore {
  return {
    products,
    blog: [],
    producers: [],
    content: { home: {}, boutique: {} },
    sections: { home: [], boutique: [] },
  } as unknown as CmsStore;
}

describe("IndexNow", () => {
  it("does not notify a product when only its database timestamps change", () => {
    const previous = store([product()]);
    const next = store([product({ updatedAt: "2026-08-10T00:00:00.000Z" })]);

    expect(collectChangedStorefrontPaths(previous, next)).toEqual([]);
  });

  it("notifies the product, its category and the market after a public change", () => {
    const previous = store([product()]);
    const next = store([product({ price: 3 })]);

    expect(collectChangedStorefrontPaths(previous, next)).toEqual([
      "/boutique",
      "/boutique/fleurs-cbd",
      "/boutique/fleurs-cbd/heaven",
    ]);
  });

  it("notifies the regional pillar when producer information changes", () => {
    const previous = store([product()]);
    const next = {
      ...store([product()]),
      producers: [{ id: "breton-farm", name: "Ferme bretonne", region: "Bretagne" }],
    } as CmsStore;

    expect(collectChangedStorefrontPaths(previous, next)).toContain("/cbd-breton");
  });

  it("rejects URLs outside the canonical origin", () => {
    expect(
      normalizeIndexNowUrls(
        ["/boutique", "https://example.com/injection", "/boutique#selection"],
        "https://www.leschanvriersbretons.com",
      ),
    ).toEqual([
      "https://www.leschanvriersbretons.com/boutique",
    ]);
  });

  it("sends a canonical batch with its validation location", async () => {
    const fetchImpl = vi.fn(
      async (...args: Parameters<typeof fetch>): Promise<Response> => {
        void args;
        return new Response(null, { status: 200 });
      },
    );

    await expect(
      notifyIndexNow(["/boutique"], {
        baseUrl: "https://www.leschanvriersbretons.com",
        key: "valid-indexnow-key-2026",
        fetchImpl,
      }),
    ).resolves.toBe("notified");

    const [, init] = fetchImpl.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual({
      host: "www.leschanvriersbretons.com",
      key: "valid-indexnow-key-2026",
      keyLocation: "https://www.leschanvriersbretons.com/indexnow-key.txt",
      urlList: ["https://www.leschanvriersbretons.com/boutique"],
    });
  });
});
