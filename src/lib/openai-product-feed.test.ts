import { describe, expect, it } from "vitest";
import type { Product } from "@/data/products";
import {
  OPENAI_PRODUCT_FEED_COLUMNS,
  buildOpenAiProductFeed,
  buildOpenAiProductFeedRows,
} from "@/lib/openai-product-feed";

const baseProduct: Product = {
  id: "flower-1",
  name: "Fleur, testée",
  category: "fleurs",
  price: 8,
  originalPrice: 10,
  promoPercent: 20,
  image: "/flower.jpg",
  images: ["/flower.jpg", "/flower-side.png", "/ignored.webp"],
  producerId: "producer-1",
  description: '<p>Lot "A" analysé.</p>',
  trackStock: true,
  stockQuantity: 3,
};

describe("OpenAI product feed", () => {
  it("exports required search, price, stock and merchant data", () => {
    const rows = buildOpenAiProductFeedRows([baseProduct], {
      baseUrl: "https://www.leschanvriersbretons.com",
      producerNamesById: new Map([["producer-1", "Ferme partenaire"]]),
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      is_eligible_search: "true",
      is_eligible_checkout: "false",
      item_id: "flower-1",
      title: "Fleur, testée",
      description: 'Lot "A" analysé.',
      brand: "Ferme partenaire",
      price: "10.00 EUR",
      sale_price: "8.00 EUR",
      availability: "in_stock",
      image_url: "https://www.leschanvriersbretons.com/flower.jpg",
      additional_image_urls:
        "https://www.leschanvriersbretons.com/flower-side.png",
      age_restriction: "18",
    });
  });

  it("emits one stable row per enabled variant, including unavailable variants", () => {
    const rows = buildOpenAiProductFeedRows(
      [
        {
          ...baseProduct,
          variantOptions: [
            { id: "3g", label: "3 g", price: 9, stockQuantity: 4 },
            { id: "10g", label: "10 g", price: 24, stockQuantity: 0 },
            { id: "hidden", label: "Masqué", price: 1, enabled: false },
          ],
        },
      ],
      { baseUrl: "https://www.leschanvriersbretons.com" },
    );

    expect(rows.map((row) => row.item_id)).toEqual(["flower-1-3g", "flower-1-10g"]);
    expect(rows.map((row) => row.availability)).toEqual(["in_stock", "out_of_stock"]);
    expect(rows[0].group_id).toBe("flower-1");
    expect(rows[0].listing_has_variations).toBe("true");
    expect(rows[0].variant_dict).toBe('{"format":"3 g"}');
  });

  it("produces UTF-8 CSV with the stable columns and safe quoting", () => {
    const csv = buildOpenAiProductFeed([baseProduct], {
      baseUrl: "https://www.leschanvriersbretons.com",
    });

    expect(csv.startsWith(OPENAI_PRODUCT_FEED_COLUMNS.join(","))).toBe(true);
    expect(csv).toContain('"Fleur, testée"');
    expect(csv).toContain('"Lot ""A"" analysé."');
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("drops products that cannot satisfy required image or price fields", () => {
    const rows = buildOpenAiProductFeedRows(
      [
        { ...baseProduct, id: "bad-image", image: "/flower.webp" },
        { ...baseProduct, id: "bad-price", price: 0, originalPrice: undefined, promoPercent: undefined },
      ],
      { baseUrl: "https://www.leschanvriersbretons.com" },
    );

    expect(rows).toEqual([]);
  });
});
