import { BoutiquePageClient } from "@/components/boutique/BoutiquePageClient";
import { dedupeProducts } from "@/lib/product-dedup";
import { getOwnProducer } from "@/lib/own-producer";
import { readPublicStoreByBackend } from "@/lib/data-backend";
import {
  isPrintfulProduct,
  computeNeighborProducerIds,
} from "@/lib/boutique-helpers";

export default async function BoutiquePage() {
  const store = await readPublicStoreByBackend();
  const boutique = store.content.boutique;
  const uniqueProducts = dedupeProducts(store.products);
  const ownProducer = getOwnProducer(boutique);

  const ownProducts = uniqueProducts.filter(
    (p) => !p.producerId && !isPrintfulProduct(p),
  );
  const partnerProducts = uniqueProducts.filter(
    (p) => p.producerId && !isPrintfulProduct(p),
  );
  const neighborProducerIds = computeNeighborProducerIds(store.producers);
  const voisinProducts = partnerProducts.filter(
    (p) => p.producerId && neighborProducerIds.has(p.producerId),
  );
  const copainsProducts = partnerProducts.filter(
    (p) => p.producerId && !neighborProducerIds.has(p.producerId),
  );
  const globalAccessoriesProducts = uniqueProducts.filter(
    (p) => p.category === "accessoires",
  );
  const boutiqueSections = store.sections.boutique.filter((s) => s.visible);

  return (
    <BoutiquePageClient
      boutique={boutique}
      producers={store.producers}
      ownProducer={ownProducer}
      ownProducts={ownProducts}
      partnerProducts={partnerProducts}
      voisinProducts={voisinProducts}
      copainsProducts={copainsProducts}
      globalAccessoriesProducts={globalAccessoriesProducts}
      boutiqueSections={boutiqueSections}
    />
  );
}
