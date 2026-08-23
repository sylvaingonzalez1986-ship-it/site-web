import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@/data/products";

const mocks = vi.hoisted(() => ({
  getPublishedBlogPostsByBackend: vi.fn(),
  readPublicStoreByBackend: vi.fn(),
}));

vi.mock("@/lib/data-backend", () => ({
  getPublishedBlogPostsByBackend: mocks.getPublishedBlogPostsByBackend,
  readPublicStoreByBackend: mocks.readPublicStoreByBackend,
}));

import { GET } from "@/app/feed.xml/route";

describe("public Atom feed", () => {
  beforeEach(() => {
    const product: Product = {
      id: "flower-1",
      name: "Fleur documentée",
      category: "fleurs",
      price: 2.5,
      image: "/flower.webp",
      description: "Origine et analyse disponibles.",
      updatedAt: "2026-08-23T10:00:00.000Z",
    };
    mocks.getPublishedBlogPostsByBackend.mockResolvedValue([]);
    mocks.readPublicStoreByBackend.mockResolvedValue({ products: [product] });
  });

  it("returns a public cacheable Atom document", async () => {
    const response = await GET();
    const xml = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/atom+xml");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(xml).toContain("https://www.leschanvriersbretons.com/cbd-naturel");
    expect(xml).toContain("https://www.leschanvriersbretons.com/boutique/fleurs-cbd/flower-1");
  });
});
