import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Product } from "@/data/products";
import { ProductDetailActions } from "./ProductDetailActions";

vi.mock("@/context/CartContext", () => ({
  useCart: () => ({ addToCart: vi.fn(), cartLoading: false }),
}));

const product: Product = {
  id: "variant-test",
  name: "Fleur de test",
  category: "fleurs",
  price: 99,
  image: "/fleur.webp",
  description: "Fleur de test",
  variantOptions: [
    { id: "large", label: "10 g", price: 19.5, stockQuantity: 0 },
    { id: "small", label: "5 g", price: 11.5, stockQuantity: 2 },
  ],
};

function render(overrides: Partial<Product> = {}) {
  return renderToStaticMarkup(createElement(ProductDetailActions, {
    product: { ...product, ...overrides },
  }));
}

describe("ProductDetailActions server-rendered offer controls", () => {
  it("selects the available format and shows the price on each public option", () => {
    const html = render({ analysisPdf: "/analyses/lot.pdf" });

    expect(html).toMatch(/<option value="small" selected="">5 g — 11,50\s*€<\/option>/u);
    expect(html).toMatch(/<option value="large" disabled="">10 g — 19,50\s*€ \(rupture\)<\/option>/u);
    const addButton = html.match(/<button [^>]*data-ui-commerce="primary"[^>]*>/u)?.[0];
    expect(addButton).toBeDefined();
    expect(addButton).not.toContain('disabled=""');
    expect(html).toContain('href="/analyses/lot.pdf"');
  });

  it("disables buying when all formats are out of stock without falling back to the base price", () => {
    const html = render({
      variantOptions: product.variantOptions?.map((variant) => ({ ...variant, stockQuantity: 0 })),
    });

    expect(html).toMatch(/<select[^>]* disabled="">/u);
    expect(html).toContain('<option value="" selected="">Aucun format en stock</option>');
    expect(html.match(/<option value="(?:large|small)" disabled="">/gu)).toHaveLength(2);
    expect(html).toMatch(/<button [^>]*data-ui-commerce="primary"[^>]* disabled=""[^>]*>/u);
    expect(html).toContain("Rupture de stock");
    expect(html).not.toMatch(/99,00\s*€/u);
    expect(html).toContain("Aucune analyse de laboratoire publiée");
  });
});
