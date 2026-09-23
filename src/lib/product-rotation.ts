import type { Product } from "@/data/products";
import { isOwnProduct } from "./own-producer";
import { isProductInStock } from "./product-stock";

const DAY_IN_MILLISECONDS = 86_400_000;
const parisDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** A civil-day ordinal, independent of the server's timezone and DST day length. */
export function getProductRotationDay(date: Date): number {
  const parts = parisDateFormatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_IN_MILLISECONDS);
}

function hashProduct(scope: string, id: string): number {
  const value = `${scope.length}:${scope}${id}`;
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16_777_619);
  }

  // Spread similar IDs across the base order, without runtime randomness.
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  return (hash ^ (hash >>> 16)) >>> 0;
}

function rotatePartition(products: Product[], day: number, scope: string): Product[] {
  if (products.length < 2) return products;

  const ordered = products
    .map((product) => ({ product, rank: hashProduct(scope, product.id) }))
    .sort((left, right) => {
      const rankDifference = left.rank - right.rank;
      if (rankDifference !== 0) return rankDifference;
      // Code-unit comparison avoids locale-dependent ordering on hash collisions.
      return left.product.id < right.product.id ? -1 : left.product.id > right.product.id ? 1 : 0;
    })
    .map(({ product }) => product);
  const offset = ((day % ordered.length) + ordered.length) % ordered.length;
  return [...ordered.slice(offset), ...ordered.slice(0, offset)];
}

/**
 * Rotate each eligibility group by one place per day, giving every product each
 * position once per cycle while the group is unchanged. Filter and deduplicate
 * before calling so the cycle reflects the products actually displayed.
 */
export function rotateProductsForDay(
  products: readonly Product[],
  day: number,
  scope: string,
  options: { ownProductsFirst?: boolean } = {},
): Product[] {
  const separateProductions = options.ownProductsFirst === true;
  const partitions: Product[][] = Array.from(
    { length: separateProductions ? 4 : 2 },
    () => [],
  );

  for (const product of products) {
    const stockGroup = isProductInStock(product) ? 0 : 1;
    const partition = separateProductions
      ? stockGroup * 2 + (isOwnProduct(product) ? 0 : 1)
      : stockGroup;
    partitions[partition].push(product);
  }

  return partitions.flatMap((partition) => rotatePartition(partition, day, scope));
}
