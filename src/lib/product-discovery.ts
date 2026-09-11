import type { Product } from "@/data/products";
import { dedupeProducts } from "@/lib/product-dedup";
import { getSelectableVariantOptions, isProductInStock } from "@/lib/product-stock";

export type PurchasableFormat = {
  price: number;
  label: string;
  weightGrams: number | null;
  pricePerGram: number | null;
};

export const formatEuro = (value: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);

function positiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

// Only an explicit weight is comparable. Never interpret a CBD dose (mg),
// a liquid volume, a product name or a mixed pack as a weight of flowers.
function variantWeight(label: string): number | null {
  const match = label.trim().match(/^(\d+(?:[.,]\d+)?)\s*(g|kg)$/i);
  if (!match) return null;
  const grams = Number(match[1].replace(",", ".")) * (match[2].toLowerCase() === "kg" ? 1000 : 1);
  return positiveNumber(grams) ? grams : null;
}

export function getPurchasableFormats(product: Product): PurchasableFormat[] {
  if (!isProductInStock(product)) return [];
  const byWeight = !product.isPack && ["fleurs", "resines"].includes(product.category);
  const variants = product.variantOptions ?? [];
  const formats = variants.length
    ? getSelectableVariantOptions(product).map(option => ({
        price: option.price,
        label: option.label,
        weightGrams: byWeight ? variantWeight(option.label) : null,
      }))
    : [{
        price: product.price,
        label: byWeight && positiveNumber(product.weightGrams)
          ? `${new Intl.NumberFormat("fr-FR").format(product.weightGrams)} g`
          : "À l’unité",
        weightGrams: byWeight && positiveNumber(product.weightGrams) ? product.weightGrams : null,
      }];
  return formats.filter(format => positiveNumber(format.price))
    .map(format => ({ ...format, pricePerGram: format.weightGrams ? format.price / format.weightGrams : null }))
    .sort((a, b) => a.price - b.price || a.label.localeCompare(b.label, "fr"));
}

export function getAffordableProducts(products: Product[], limit = 9) {
  return dedupeProducts(products.filter(product => product.category !== "accessoires" && getPurchasableFormats(product).length > 0))
    .flatMap(product => {
      const format = getPurchasableFormats(product)[0];
      return format ? [{ product, format }] : [];
    })
    .sort((a, b) => a.format.price - b.format.price || a.product.name.localeCompare(b.product.name, "fr"))
    .slice(0, limit);
}

export function getFlowerPriceComparison(products: Product[], limit = 12) {
  return dedupeProducts(products.filter(product => product.category === "fleurs" && getPurchasableFormats(product).some(format => format.pricePerGram !== null)))
    .flatMap(product => {
      const format = getPurchasableFormats(product)
        .filter((format): format is PurchasableFormat & { pricePerGram: number } => format.pricePerGram !== null)
        .sort((a, b) => a.pricePerGram - b.pricePerGram || a.price - b.price)[0];
      return format ? [{ product, format }] : [];
    })
    .sort((a, b) => a.format.pricePerGram - b.format.pricePerGram || a.format.price - b.format.price || a.product.name.localeCompare(b.product.name, "fr"))
    .slice(0, limit);
}

export function buildProductMetaDescription(product: Product, producer: string): string {
  const format = getPurchasableFormats(product)[0];
  const price = format ? `Dès ${formatEuro(format.price)}${format.weightGrams ? ` les ${format.label}` : ""}.` : "Actuellement indisponible.";
  const culture = product.cultureMode ? ` Culture ${product.cultureMode}.` : "";
  const analysis = product.analysisPdf ? " Analyse consultable." : "";
  const text = `${product.name}. ${price} ${producer}.${culture}${analysis} Origine et formats sur la fiche.`;
  return text.length <= 160 ? text : `${text.slice(0, 157).replace(/\s+\S*$/, "")}…`;
}
