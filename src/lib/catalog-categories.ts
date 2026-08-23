import type { Product, ProductCategory } from "@/data/products";

export const PUBLIC_CATALOG_CATEGORIES = [
  { category: "fleurs", slug: "fleurs-cbd", label: "Fleurs CBD", sentenceLabel: "fleurs CBD" },
  { category: "resines", slug: "resines-cbd", label: "Résines CBD", sentenceLabel: "résines CBD" },
  { category: "huiles", slug: "huiles-cbd", label: "Huiles CBD", sentenceLabel: "huiles CBD" },
  { category: "e-liquide", slug: "e-liquide-cbd", label: "E-liquides CBD", sentenceLabel: "e-liquides CBD" },
  { category: "cosmetiques", slug: "cosmetiques-cbd", label: "Cosmétiques CBD", sentenceLabel: "cosmétiques CBD" },
  { category: "alimentaire", slug: "tisane-cbd", label: "Infusions au chanvre", sentenceLabel: "infusions au chanvre" },
  { category: "miam", slug: "miam-cbd", label: "Produits gourmands", sentenceLabel: "produits gourmands" },
  { category: "accessoires", slug: "accessoires-cbd", label: "Accessoires", sentenceLabel: "accessoires" },
] as const satisfies ReadonlyArray<{
  category: ProductCategory;
  slug: string;
  label: string;
  sentenceLabel: string;
}>;

export type PublicCatalogCategory = (typeof PUBLIC_CATALOG_CATEGORIES)[number];

export function getActiveCatalogCategories(
  products: ReadonlyArray<Pick<Product, "category">>,
): PublicCatalogCategory[] {
  const activeCategories = new Set(products.map((product) => product.category));
  return PUBLIC_CATALOG_CATEGORIES.filter(({ category }) => activeCategories.has(category));
}

export function getCatalogCategoryBySlug(slug: string): PublicCatalogCategory | undefined {
  return PUBLIC_CATALOG_CATEGORIES.find((category) => category.slug === slug);
}

export function formatCatalogCategoryList(categories: PublicCatalogCategory[]): string {
  const labels = categories.map(({ sentenceLabel }) => sentenceLabel);
  if (labels.length <= 1) return labels[0] ?? "produits actuellement publiés";
  if (labels.length === 2) return `${labels[0]} et ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} et ${labels.at(-1)}`;
}
