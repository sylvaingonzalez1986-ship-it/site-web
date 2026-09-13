import type { Product } from "@/data/products";
import type { StoredCartLine } from "./cart-session-storage";
import { getAvailableQuantity, getSelectableVariantOptions, isProductInStock } from "./product-stock";

export type CartActionResult =
  | { ok: true }
  | { ok: false; reason: "unauthenticated" | "invalid_product" | "stock_limit"; maxAvailable?: number };

type Mutation = { items: StoredCartLine[]; result: CartActionResult };

export function addCartItem(items: StoredCartLine[], product: Product, variantId?: string, quantity = 1): Mutation {
  const invalid: Mutation = { items, result: { ok: false, reason: "invalid_product" } };
  if (!Number.isFinite(quantity) || quantity < 1) return invalid;
  const qty = Math.round(quantity);
  const [baseId, embeddedVariantId = ""] = product.id.split("::");
  const variantKey = variantId || embeddedVariantId;
  const variants = product.variantOptions ?? [];
  const selectable = getSelectableVariantOptions(product);
  const variant = variantKey ? selectable.find(option => option.id === variantKey) : selectable[0];
  if (variantKey && !variant) return invalid;
  if ((variants.length > 0 && !variant) || !isProductInStock(product)) {
    return { items, result: { ok: false, reason: "stock_limit", maxAvailable: 0 } };
  }
  const price = variant?.price ?? product.price;
  if (!Number.isFinite(price) || price < 0) return invalid;
  const id = variant ? `${baseId}::${variant.id}` : baseId;
  const existing = items.find(item => item.id === id);
  const max = Math.min(99, getAvailableQuantity(product, variant?.id ?? "") ?? 99);
  if ((existing?.quantity ?? 0) + qty > max) {
    return { items, result: { ok: false, reason: "stock_limit", maxAvailable: max } };
  }
  if (!existing && items.length >= 50) return invalid;
  const line = { ...product, id, price,
    name: variant && !embeddedVariantId ? `${product.name} - ${variant.label}` : product.name,
    quantity: (existing?.quantity ?? 0) + qty };
  return { items: existing ? items.map(item => item.id === id ? line : item) : [...items, line], result: { ok: true } };
}

export function changeCartQuantity(items: StoredCartLine[], id: string, quantity: number): Mutation {
  const item = items.find(line => line.id === id);
  if (!item || !Number.isFinite(quantity) || quantity < 1) {
    return { items, result: { ok: false, reason: "invalid_product" } };
  }
  const variantId = id.split("::")[1] ?? "";
  const validVariant = !item.variantOptions?.length || getSelectableVariantOptions(item).some(variant => variant.id === variantId);
  const max = !validVariant || !isProductInStock(item) ? 0 : Math.min(99, getAvailableQuantity(item, variantId) ?? 99);
  const qty = Math.min(Math.round(quantity), max);
  return {
    items: qty <= 0 ? items.filter(line => line.id !== id) : items.map(line => line.id === id ? { ...line, quantity: qty } : line),
    result: quantity > max ? { ok: false, reason: "stock_limit", maxAvailable: max } : { ok: true },
  };
}
