import { BoutiquePageClient } from "@/components/boutique/BoutiquePageClient";
import { dedupeProducts } from "@/lib/product-dedup";
import { SeoGuideLinks } from "@/components/seo/SeoGuideLinks";
import { getOwnProducer } from "@/lib/own-producer";
import { readPublicStoreByBackend } from "@/lib/data-backend";
import {
  isPrintfulProduct,
  computeNeighborProducerIds,
} from "@/lib/boutique-helpers";
import { getProductCardTastingSummaries } from "@/lib/product-card-tasting-backend";

export default async function BoutiquePage() {
  const store = await readPublicStoreByBackend();
  const boutique = store.content.boutique;
  const uniqueProducts = dedupeProducts(store.products);
  const tastingSummariesByProductId = await getProductCardTastingSummaries(
    uniqueProducts.map((product) => product.id),
  );
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
  const visibleBoutiqueSections = store.sections.boutique.filter((s) => s.visible);
  const hasProductsSection = visibleBoutiqueSections.some((section) => section.type === "products");
  const boutiqueSections = visibleBoutiqueSections.map((section) =>
    section.type === "copains" && !hasProductsSection
      ? { ...section, type: "products" as const }
      : section,
  );

  return (
    <>
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
        tastingSummariesByProductId={tastingSummariesByProductId}
      />
      <div className="section-band bg-cream py-10">
        <div className="retro-container">
          <SeoGuideLinks />
        </div>
      </div>
    </>
  );
}
