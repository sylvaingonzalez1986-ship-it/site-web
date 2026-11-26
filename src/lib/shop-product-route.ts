import "server-only";
import { cache } from "react";
import { PUBLIC_CATALOG_CATEGORIES } from "@/lib/catalog-categories";
import { computeNeighborProducerIds } from "@/lib/boutique-helpers";
import { readPublicStoreByBackend } from "@/lib/data-backend";
import { getOwnProducer } from "@/lib/own-producer";
import { resolveFrenchRegion } from "@/data/france-geo";
import type { Product } from "@/data/products";
import type { PublicStoreResponse } from "@/types/store";
import type { ShopOrigin } from "./shop-origin";

export const readProductCatalog = cache(readPublicStoreByBackend);

export function productReturnContext(origin: ShopOrigin | null, product: Product, store: PublicStoreResponse) {
  if (origin?.surface === "category" && !PUBLIC_CATALOG_CATEGORIES.some(
    item => item.category === product.category && item.slug === origin.categorySlug,
  )) return { origin: null };
  const producerId = origin?.producer;
  if (!origin || !producerId) return { origin };
  const own = getOwnProducer(store.content.boutique);
  const producer = producerId === own.id ? own : store.producers.find(item => item.id === producerId);
  if (!producer) return { origin: null };
  const group = producerId === own.id ? "products" :
    computeNeighborProducerIds(store.producers).has(producerId) ? "neighbors" : "copains";
  const valid = origin.region ? resolveFrenchRegion(producer.region) === origin.region : group === origin.selection;
  return valid ? { origin, originProducerName: producer.name } : { origin: null };
}
