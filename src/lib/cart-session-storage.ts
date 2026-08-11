import type { Product, ProductCategory } from "@/data/products";

export const CART_SESSION_STORAGE_KEY = "shop:cart:v1";

export type StoredCartLine = Product & { quantity: number };

type StoredCart = {
  version: 1;
  updatedAt: number;
  items: StoredCartLine[];
};

const MAX_CART_AGE_MS = 48 * 60 * 60 * 1000;
const MAX_CART_STORAGE_LENGTH = 500_000;
const VALID_CATEGORIES = new Set<ProductCategory>([
  "fleurs",
  "resines",
  "huiles",
  "e-liquide",
  "cosmetiques",
  "alimentaire",
  "miam",
  "accessoires",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStoredCartLine(value: unknown): value is StoredCartLine {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    value.id.length <= 240 &&
    typeof value.name === "string" &&
    value.name.length > 0 &&
    value.name.length <= 240 &&
    typeof value.category === "string" &&
    VALID_CATEGORIES.has(value.category as ProductCategory) &&
    typeof value.price === "number" &&
    Number.isFinite(value.price) &&
    value.price >= 0 &&
    value.price <= 100_000 &&
    typeof value.image === "string" &&
    value.image.length <= 2_048 &&
    typeof value.description === "string" &&
    value.description.length <= 20_000 &&
    typeof value.quantity === "number" &&
    Number.isInteger(value.quantity) &&
    value.quantity >= 1 &&
    value.quantity <= 99
  );
}

export function readCartFromSession(
  storage: Pick<Storage, "getItem" | "removeItem">,
  now = Date.now(),
): StoredCartLine[] {
  try {
    const raw = storage.getItem(CART_SESSION_STORAGE_KEY);
    if (!raw) return [];
    if (raw.length > MAX_CART_STORAGE_LENGTH) {
      storage.removeItem(CART_SESSION_STORAGE_KEY);
      return [];
    }

    const parsed = JSON.parse(raw) as Partial<StoredCart>;
    const validEnvelope =
      parsed.version === 1 &&
      typeof parsed.updatedAt === "number" &&
      Number.isFinite(parsed.updatedAt) &&
      parsed.updatedAt <= now + 60_000 &&
      now - parsed.updatedAt <= MAX_CART_AGE_MS &&
      Array.isArray(parsed.items) &&
      parsed.items.length <= 50;
    if (!validEnvelope || !parsed.items?.every(isStoredCartLine)) {
      storage.removeItem(CART_SESSION_STORAGE_KEY);
      return [];
    }

    const uniqueItems = new Map<string, StoredCartLine>();
    for (const item of parsed.items) {
      uniqueItems.set(item.id, item);
    }
    return Array.from(uniqueItems.values());
  } catch {
    storage.removeItem(CART_SESSION_STORAGE_KEY);
    return [];
  }
}

export function saveCartToSession(
  storage: Pick<Storage, "setItem" | "removeItem">,
  items: StoredCartLine[],
): void {
  try {
    if (items.length === 0) {
      storage.removeItem(CART_SESSION_STORAGE_KEY);
      return;
    }
    const safeItems = items.slice(0, 50).filter(isStoredCartLine);
    if (safeItems.length === 0) {
      storage.removeItem(CART_SESSION_STORAGE_KEY);
      return;
    }
    storage.setItem(
      CART_SESSION_STORAGE_KEY,
      JSON.stringify({ version: 1, updatedAt: Date.now(), items: safeItems } satisfies StoredCart),
    );
  } catch {
    // A full or disabled sessionStorage must not prevent checkout.
  }
}
