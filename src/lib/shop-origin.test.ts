import { describe, expect, it } from "vitest";
import { parseShopOrigin, shopCardId, shopProductHref, shopResultsHref, shopSearchParams, type ShopOrigin } from "./shop-origin";

const product = "/boutique/fleurs-cbd/fleur-a";
const filters: ShopOrigin = { surface: "market", selection: "neighbors", culture: "greenhouse", entry: "fleur-a" };

describe("shop list origin", () => {
  it.each<ShopOrigin>([
    filters,
    { surface: "category", selection: "products", categorySlug: "fleurs-cbd", entry: "fleur-a" },
    { surface: "producer", selection: "neighbors", producer: "ferme", entry: "fleur-a" },
    { surface: "region", selection: "regions", region: "Pays de la Loire", producer: "ferme", entry: "fleur-a" },
  ])("round-trips the $surface context through two product links", origin => {
    const first = new URL(shopProductHref(product + "#avis-degustation", origin), "https://test.invalid");
    expect(first.hash).toBe("#avis-degustation");
    const afterFirst = parseShopOrigin(first.searchParams);
    expect(afterFirst).toEqual(origin);
    const second = new URL(shopProductHref("/boutique/fleurs-cbd/fleur-b", afterFirst), first);
    expect(parseShopOrigin(second.searchParams)).toEqual(origin);
    expect(shopResultsHref(origin)).toContain("#" + shopCardId(origin));
  });

  it("keeps an optional per-entry marker out of the stable card ID", () => {
    const marked = { ...filters, resume: "a68abf60-73ea-4fed-ae93-be2b621bde39" };
    expect(shopResultsHref(marked)).toContain("resume=" + marked.resume);
    expect(shopCardId(marked)).toEqual(shopCardId(filters));
    expect(shopProductHref(product, null)).toBe(product);
  });

  it.each([
    "depuis=marche&entree=a&selection=wrong",
    "depuis=marche&entree=first&entree=second",
    "depuis=producteur&entree=a",
    "depuis=region&entree=a&selection=regions&region=absente",
    "depuis=categorie&entree=a&rayon=autre",
    "depuis=marche&entree=../ailleurs",
    "depuis=marche&entree=a&culture=hydro",
  ])("falls back for an invalid origin", query => {
    expect(parseShopOrigin(new URLSearchParams(query))).toBeNull();
  });

  it("preserves multiple values from Next page props so they can be rejected", () => {
    expect(parseShopOrigin(shopSearchParams({ depuis: "marche", entree: ["a", "b"] }))).toBeNull();
  });
});
