import { describe, expect, it } from "vitest";
import type { Product } from "@/data/products";
import {
  buildCatalogTransparencyDocument,
  buildCatalogTransparencySnapshot,
} from "@/lib/catalog-transparency";
import { DEFAULT_OWN_PRODUCER } from "@/lib/own-producer";
import type { Producer } from "@/types/store";

const partner: Producer = {
  ...DEFAULT_OWN_PRODUCER,
  id: "partner-1",
  name: "Producteur partenaire",
  location: "Jura",
  department: "Jura",
  region: "Bourgogne-Franche-Comté",
};

const products: Product[] = [
  {
    id: "own-flower",
    name: "Fleur maison",
    category: "fleurs",
    price: 2,
    image: "/flower.webp",
    description: "Notes végétales.",
    analysisPdf: "/analysis.pdf",
    updatedAt: "2026-08-20T12:00:00.000Z",
  },
  {
    id: "partner-flower",
    name: "Fleur partenaire",
    category: "fleurs",
    price: 3,
    image: "/partner.webp",
    description: "Notes fruitées.",
    producerId: partner.id,
    updatedAt: "2026-08-22T12:00:00.000Z",
  },
  {
    id: "unknown-resin",
    name: "Résine origine à compléter",
    category: "resines",
    price: 4,
    image: "/resin.webp",
    description: "Texture souple.",
    producerId: "missing-producer",
  },
];

describe("catalog transparency snapshot", () => {
  it("derives factual coverage metrics from the published catalog", () => {
    const snapshot = buildCatalogTransparencySnapshot(products, [partner]);

    expect(snapshot).toMatchObject({
      publishedReferences: 3,
      ownReferences: 1,
      partnerReferences: 2,
      producerIdentified: 2,
      originIdentified: 2,
      analysesAvailable: 1,
      unresolvedProducerReferences: 1,
      distinctProducers: 2,
      activeCategories: 2,
      lastCatalogUpdate: "2026-08-22T12:00:00.000Z",
    });
    expect(snapshot.categories).toEqual([
      { category: "fleurs", label: "Fleurs CBD", publishedReferences: 2, analysesAvailable: 1 },
      { category: "resines", label: "Résines CBD", publishedReferences: 1, analysesAvailable: 0 },
    ]);
  });

  it("deduplicates identical public references before counting", () => {
    const snapshot = buildCatalogTransparencySnapshot([...products, { ...products[0], id: "duplicate" }], [partner]);

    expect(snapshot.publishedReferences).toBe(3);
    expect(snapshot.analysesAvailable).toBe(1);
  });

  it("publishes explicit metric definitions with canonical URLs", () => {
    const snapshot = buildCatalogTransparencySnapshot(products, [partner]);
    const document = buildCatalogTransparencyDocument(
      snapshot,
      "https://www.leschanvriersbretons.com",
    );

    expect(document.canonicalPage).toBe("https://www.leschanvriersbretons.com/cbd-naturel");
    expect(document.dataAsOf).toBe("2026-08-22T12:00:00.000Z");
    expect(document.definitions.analysesAvailable).toContain("lien public");
    expect(document.metrics).toBe(snapshot);
  });
});
