import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@/data/products";
import { DEFAULT_OWN_PRODUCER } from "@/lib/own-producer";

const mocks = vi.hoisted(() => ({ readPublicStoreByBackend: vi.fn() }));

vi.mock("@/lib/data-backend", () => ({
  readPublicStoreByBackend: mocks.readPublicStoreByBackend,
}));

import { GET } from "@/app/cbd-naturel/catalogue-transparence.json/route";

describe("catalog transparency JSON", () => {
  beforeEach(() => {
    const product: Product = {
      id: "flower-1",
      name: "Fleur documentée",
      category: "fleurs",
      price: 2.5,
      image: "/flower.webp",
      description: "Profil aromatique.",
      analysisPdf: "/analysis.pdf",
      updatedAt: "2026-08-23T10:00:00.000Z",
    };

    mocks.readPublicStoreByBackend.mockResolvedValue({
      products: [product],
      producers: [],
      content: { boutique: { ownProducer: DEFAULT_OWN_PRODUCER } },
    });
  });

  it("returns a public, cacheable and self-described dataset", async () => {
    const response = await GET();
    const document = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(document.canonicalPage).toBe("https://www.leschanvriersbretons.com/cbd-naturel");
    expect(document.metrics.publishedReferences).toBe(1);
    expect(document.metrics.analysesAvailable).toBe(1);
    expect(document.definitions.analysesAvailable).toContain("lien public");
    expect(document.observations).toHaveLength(1);
    expect(document.observations[0]).toMatchObject({
      name: "Fleur documentée",
      productUrl: "https://www.leschanvriersbretons.com/boutique/fleurs-cbd/flower-1",
      producerName: "Les Chanvriers Bretons",
      origin: "Bretagne",
      analysisUrl: "https://www.leschanvriersbretons.com/analysis.pdf",
    });
  });
});
