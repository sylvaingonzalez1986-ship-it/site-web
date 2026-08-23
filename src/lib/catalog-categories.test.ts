import { describe, expect, it } from "vitest";
import type { Product } from "@/data/products";
import {
  formatCatalogCategoryList,
  getActiveCatalogCategories,
} from "@/lib/catalog-categories";

function product(category: Product["category"]): Pick<Product, "category"> {
  return { category };
}

describe("catalog categories", () => {
  it("returns only categories represented in the public catalog", () => {
    const categories = getActiveCatalogCategories([
      product("e-liquide"),
      product("fleurs"),
      product("fleurs"),
    ]);

    expect(categories.map(({ slug }) => slug)).toEqual(["fleurs-cbd", "e-liquide-cbd"]);
  });

  it("formats a readable French list", () => {
    const categories = getActiveCatalogCategories([
      product("fleurs"),
      product("e-liquide"),
    ]);

    expect(formatCatalogCategoryList(categories)).toBe("fleurs CBD et e-liquides CBD");
  });
});
