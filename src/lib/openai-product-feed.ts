import type { Product, ProductCategory } from "@/data/products";
import { BUSINESS_IDENTITY } from "@/lib/business-identity";
import { getProductPublicPath } from "@/lib/indexnow";
import { hasActiveProductPromo } from "@/lib/product-promo";
import { isProductInStock } from "@/lib/product-stock";

export const OPENAI_PRODUCT_FEED_COLUMNS = [
  "is_eligible_search",
  "is_eligible_checkout",
  "item_id",
  "title",
  "description",
  "url",
  "brand",
  "condition",
  "product_category",
  "image_url",
  "additional_image_urls",
  "price",
  "sale_price",
  "availability",
  "group_id",
  "listing_has_variations",
  "variant_dict",
  "seller_name",
  "seller_url",
  "is_digital",
  "return_policy",
  "warning",
  "age_restriction",
] as const;

type FeedColumn = (typeof OPENAI_PRODUCT_FEED_COLUMNS)[number];
type FeedRow = Record<FeedColumn, string>;

type FeedOptions = {
  baseUrl: string;
  producerNamesById?: ReadonlyMap<string, string>;
  defaultBrand?: string;
  sellerName?: string;
};

const CATEGORY_PATHS: Record<ProductCategory, string> = {
  fleurs: "CBD et chanvre > Fleurs CBD",
  resines: "CBD et chanvre > Résines CBD",
  huiles: "CBD et chanvre > Huiles CBD",
  "e-liquide": "CBD et chanvre > E-liquides CBD",
  cosmetiques: "CBD et chanvre > Cosmétiques CBD",
  alimentaire: "CBD et chanvre > Infusions au chanvre",
  miam: "CBD et chanvre > Produits gourmands",
  accessoires: "CBD et chanvre > Accessoires",
};

const PRODUCT_WARNING =
  "Vente réservée aux adultes. Tenir hors de portée des enfants. En cas de traitement, de grossesse ou d’allaitement, demander conseil à un professionnel de santé. Ne pas conduire après consommation.";

function absoluteUrl(baseUrl: string, value: string): string {
  return new URL(value, `${baseUrl.replace(/\/$/, "")}/`).toString();
}

function normalizePlainText(value: string, maxLength: number): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeItemId(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

function isSupportedImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      /\.(?:jpe?g|png)$/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function formatPrice(value: number): string {
  return `${value.toFixed(2)} EUR`;
}

function csvCell(value: string): string {
  if (!/[",\r\n]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}

function productBrand(product: Product, options: FeedOptions): string {
  if (product.producerId) {
    const producerName = options.producerNamesById?.get(product.producerId)?.trim();
    if (producerName) return producerName.slice(0, 70);
  }

  return (options.defaultBrand?.trim() || BUSINESS_IDENTITY.brandName).slice(0, 70);
}

function productImages(product: Product, baseUrl: string): {
  main: string;
  additional: string;
} | null {
  const main = absoluteUrl(baseUrl, product.image);
  if (!isSupportedImageUrl(main)) return null;

  const additional = [...new Set(product.images ?? [])]
    .map((image) => absoluteUrl(baseUrl, image))
    .filter((image) => image !== main && isSupportedImageUrl(image))
    .join(",");

  return { main, additional };
}

function createBaseRow(
  product: Product,
  options: FeedOptions,
  images: { main: string; additional: string },
): FeedRow {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const sellerName = options.sellerName?.trim() || BUSINESS_IDENTITY.brandName;

  return {
    is_eligible_search: "true",
    is_eligible_checkout: "false",
    item_id: "",
    title: "",
    description:
      normalizePlainText(product.description, 5_000) ||
      `${product.name} proposé par ${productBrand(product, options)}.`,
    url: absoluteUrl(baseUrl, getProductPublicPath(product)),
    brand: productBrand(product, options),
    condition: "new",
    product_category: CATEGORY_PATHS[product.category],
    image_url: images.main,
    additional_image_urls: images.additional,
    price: "",
    sale_price: "",
    availability: "",
    group_id: "",
    listing_has_variations: "false",
    variant_dict: "",
    seller_name: sellerName.slice(0, 70),
    seller_url: baseUrl,
    is_digital: "false",
    return_policy: `${baseUrl}/cgv`,
    warning: PRODUCT_WARNING,
    age_restriction: "18",
  };
}

export function buildOpenAiProductFeedRows(
  products: Product[],
  options: FeedOptions,
): FeedRow[] {
  const rows: FeedRow[] = [];

  for (const product of products) {
    const images = productImages(product, options.baseUrl);
    if (!images) continue;

    const variants = Array.isArray(product.variantOptions)
      ? product.variantOptions.filter(
          (variant) =>
            variant.enabled !== false &&
            Number.isFinite(variant.price) &&
            variant.price > 0,
        )
      : [];

    if (variants.length > 0) {
      for (const variant of variants) {
        const itemId = normalizeItemId(`${product.id}-${variant.id}`);
        if (!itemId) continue;

        const row = createBaseRow(product, options, images);
        row.item_id = itemId;
        row.title = normalizePlainText(`${product.name} — ${variant.label}`, 150);
        row.price = formatPrice(variant.price);
        row.availability =
          variant.inStock === false ||
          (typeof variant.stockQuantity === "number" && variant.stockQuantity <= 0)
            ? "out_of_stock"
            : "in_stock";
        row.group_id = normalizeItemId(product.id);
        row.listing_has_variations = "true";
        row.variant_dict = JSON.stringify({ format: variant.label });
        rows.push(row);
      }
      continue;
    }

    if (!Number.isFinite(product.price) || product.price <= 0) continue;
    const itemId = normalizeItemId(product.id);
    if (!itemId) continue;

    const row = createBaseRow(product, options, images);
    row.item_id = itemId;
    row.title = normalizePlainText(product.name, 150);
    row.price = formatPrice(
      hasActiveProductPromo(product) ? product.originalPrice : product.price,
    );
    row.sale_price = hasActiveProductPromo(product) ? formatPrice(product.price) : "";
    row.availability = isProductInStock(product) ? "in_stock" : "out_of_stock";
    row.group_id = itemId;
    rows.push(row);
  }

  return rows;
}

export function buildOpenAiProductFeed(
  products: Product[],
  options: FeedOptions,
): string {
  const header = OPENAI_PRODUCT_FEED_COLUMNS.join(",");
  const lines = buildOpenAiProductFeedRows(products, options).map((row) =>
    OPENAI_PRODUCT_FEED_COLUMNS.map((column) => csvCell(row[column])).join(","),
  );

  return `${[header, ...lines].join("\r\n")}\r\n`;
}
