import type { Product } from "@/data/products";
import type { Producer } from "@/types/store";

export function isPrintfulProduct(product: Product): boolean {
  return product.id.startsWith("printful-p-") || product.id.startsWith("printful-v-");
}

function normalizeGeoLabel(value: string | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function matchesDepartmentCode(label: string, code: string): boolean {
  return (
    label === code ||
    label.startsWith(`${code} `) ||
    label.startsWith(`${code}-`) ||
    label.includes(`(${code})`) ||
    label.endsWith(` ${code}`)
  );
}

export function computeNeighborProducerIds(producers: Producer[]): Set<string> {
  const ids = new Set<string>();

  for (const producer of producers) {
    const region = normalizeGeoLabel(producer.region);
    const department = normalizeGeoLabel(producer.department);
    const isBretagne = region.includes("bretagne");
    const isLoireAtlantique =
      department.includes("loire-atlantique") ||
      department.includes("loire atlantique") ||
      matchesDepartmentCode(department, "44");
    const isMayenne =
      department.includes("mayenne") || matchesDepartmentCode(department, "53");

    if (isBretagne || isLoireAtlantique || isMayenne) {
      ids.add(producer.id);
    }
  }

  return ids;
}

export function mergeUniqueProductsById(products: Product[]): Product[] {
  const seen = new Set<string>();
  const merged: Product[] = [];

  for (const product of products) {
    if (seen.has(product.id)) {
      continue;
    }
    seen.add(product.id);
    merged.push(product);
  }

  return merged;
}
