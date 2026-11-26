import { FRENCH_REGIONS, FRENCH_REGION_LABELS, type FrenchRegion } from "@/data/france-geo";
import { categoryLabels, PRODUCT_CULTURE_TYPES, PRODUCT_CULTURE_LABELS, type ProductCategory, type ProductCultureType } from "@/data/products";
import { getCatalogCategoryBySlug } from "@/lib/catalog-categories";

const surfaces = { market: "marche", category: "categorie", producer: "producteur", region: "region" } as const;
const selections = { products: "Mes produits", neighbors: "Mes voisins", copains: "Les copains", regions: "Par région" };
export type ShopOrigin = {
  surface: keyof typeof surfaces;
  selection: keyof typeof selections;
  entry: string;
  categorie?: ProductCategory | "promos" | "all";
  culture?: ProductCultureType | "all";
  categorySlug?: string;
  producer?: string;
  region?: FrenchRegion;
  resume?: string;
};

type PageQuery = Record<string, string | string[] | undefined>;
export function shopSearchParams(query: PageQuery): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") params.append(key, value);
    else value?.forEach(item => params.append(key, item));
  }
  return params;
}

const publicId = /^[\w-]{1,160}$/;
const resumeId = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const originKeys = ["depuis", "entree", "selection", "categorie", "culture", "rayon", "producteur", "region", "resume"];

export function parseShopOrigin(params: URLSearchParams): ShopOrigin | null {
  if (originKeys.some(key => params.getAll(key).length > 1)) return null;
  const source = params.get("depuis");
  const surface = (Object.keys(surfaces) as ShopOrigin["surface"][]).find(key => surfaces[key] === source);
  const entry = params.get("entree");
  const selection = params.get("selection") ?? "products";
  if (!surface || !entry || !publicId.test(entry) || !Object.hasOwn(selections, selection)) return null;

  const categorie = params.get("categorie") ?? "all";
  const culture = params.get("culture") ?? "all";
  const region = params.get("region");
  const producer = params.get("producteur");
  const categorySlug = params.get("rayon");
  const resume = params.get("resume");
  if (categorie !== "all" && categorie !== "promos" && !Object.hasOwn(categoryLabels, categorie)) return null;
  if (culture !== "all" && !PRODUCT_CULTURE_TYPES.some(value => value === culture)) return null;
  if (producer !== null && !publicId.test(producer)) return null;
  if (region !== null && !FRENCH_REGIONS.some(value => value === region)) return null;
  if (resume !== null && !resumeId.test(resume)) return null;
  if ((surface === "region") !== (selection === "regions") || (surface === "region") !== Boolean(region)) return null;
  if (surface === "producer" && !producer) return null;
  if (producer && surface !== "producer" && surface !== "region") return null;
  if (surface === "category") {
    if (!categorySlug || !getCatalogCategoryBySlug(categorySlug) || selection !== "products" || culture !== "all" || categorie !== "all") return null;
  } else if (categorySlug !== null) return null;

  return {
    surface, entry, selection: selection as ShopOrigin["selection"],
    ...(categorie === "all" ? {} : { categorie: categorie as ShopOrigin["categorie"] }),
    ...(culture === "all" ? {} : { culture: culture as ProductCultureType }),
    ...(region && { region: region as FrenchRegion }), ...(producer && { producer }),
    ...(categorySlug && { categorySlug }), ...(resume && { resume }),
  };
}

function listParams(origin: ShopOrigin): URLSearchParams {
  const params = new URLSearchParams();
  if (origin.selection !== "products") params.set("selection", origin.selection);
  if (origin.categorie && origin.categorie !== "all") params.set("categorie", origin.categorie);
  if (origin.culture && origin.culture !== "all") params.set("culture", origin.culture);
  if (origin.region) params.set("region", origin.region);
  if (origin.producer) params.set("producteur", origin.producer);
  if (origin.resume) params.set("resume", origin.resume);
  return params;
}

/** The hash is a control on the destination product, independent of the list anchor. */
export function shopProductHref(href: string, origin?: ShopOrigin | null): string {
  if (!origin) return href;
  const url = new URL(href, "https://shop.invalid");
  originKeys.forEach(key => url.searchParams.delete(key));
  const params = listParams(origin);
  params.set("depuis", surfaces[origin.surface]);
  params.set("entree", origin.entry);
  if (origin.categorySlug) params.set("rayon", origin.categorySlug);
  for (const [key, value] of params) url.searchParams.set(key, value);
  return url.pathname + url.search + url.hash;
}

export function shopCardId(origin: ShopOrigin): string {
  return ["shop-card", origin.surface, origin.region?.replace(/[^a-z0-9-]/gi, "-"), origin.producer, origin.entry].filter(Boolean).join("-");
}

export function shopResultsHref(origin: ShopOrigin): string {
  const path = origin.surface === "category" ? `/boutique/${origin.categorySlug}` : "/boutique";
  const query = listParams(origin).toString();
  return path + (query ? "?" + query : "") + "#" + shopCardId(origin);
}

export function shopOriginLabel(origin: ShopOrigin): string {
  const group = origin.categorySlug ? getCatalogCategoryBySlug(origin.categorySlug)?.label :
    origin.region ? FRENCH_REGION_LABELS[origin.region] : selections[origin.selection];
  const category = origin.categorie && origin.categorie !== "all" ?
    (origin.categorie === "promos" ? "Promos" : categoryLabels[origin.categorie]) : undefined;
  const culture = origin.culture && origin.culture !== "all" ? PRODUCT_CULTURE_LABELS[origin.culture] : undefined;
  return [group, category, culture].filter(Boolean).join(" · ");
}
