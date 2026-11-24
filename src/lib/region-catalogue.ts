import { resolveFrenchRegion, type FrenchRegion } from "@/data/france-geo";
import type { Product } from "@/data/products";
import { rotateProductsForDay } from "@/lib/product-rotation";
import type { Producer } from "@/types/store";

export function buildRegionCatalogue(
  region: FrenchRegion | null,
  producers: Producer[],
  products: Product[],
  ownProducer: Producer,
  ownProducts: Product[],
  rotationDay: number,
) {
  const producerById = new Map<string, Producer>();
  const producerCountByRegion: Partial<Record<FrenchRegion, number>> = {};
  const selectedProducers: Producer[] = [];
  for (const producer of [ownProducer, ...producers]) {
    if (producerById.has(producer.id)) continue;
    producerById.set(producer.id, producer);
    const producerRegion = resolveFrenchRegion(producer.region);
    if (!producerRegion) continue;
    producerCountByRegion[producerRegion] = (producerCountByRegion[producerRegion] ?? 0) + 1;
    if (producerRegion === region) selectedProducers.push(producer);
  }

  const selectedProducerIds = new Set(selectedProducers.map(producer => producer.id));
  const selectedPartnerProducts = products.filter(product => product.producerId && selectedProducerIds.has(product.producerId));
  const selectedProducts = selectedProducerIds.has(ownProducer.id) ? [...selectedPartnerProducts, ...ownProducts] : selectedPartnerProducts;
  const grouped = new Map<string, Product[]>();
  for (const product of selectedPartnerProducts) {
    if (!product.producerId) continue;
    const list = grouped.get(product.producerId) ?? [];
    list.push(product);
    grouped.set(product.producerId, list);
  }
  if (selectedProducerIds.has(ownProducer.id) && ownProducts.length > 0) grouped.set(ownProducer.id, ownProducts);

  return {
    producerById,
    producerCountByRegion,
    selectedProducers,
    selectedProducts: rotateProductsForDay(selectedProducts, rotationDay, `region:${region}`, { ownProductsFirst: true }),
    selectedProductsByProducerId: new Map([...grouped].map(([producerId, producerProducts]) => [
      producerId,
      rotateProductsForDay(producerProducts, rotationDay, `producer:${producerId}`),
    ])),
  };
}

export type RegionCatalogue = ReturnType<typeof buildRegionCatalogue>;
