import { BoutiquePageClient } from "@/components/boutique/BoutiquePageClient";
import { dedupeProducts } from "@/lib/product-dedup";
import Link from "next/link";
import { getActiveCatalogCategories } from "@/lib/catalog-categories";
import { BreadcrumbJsonLd, CollectionPageJsonLd } from "@/components/JsonLd";
import { getSiteUrl } from "@/lib/site-url";
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
    <BreadcrumbJsonLd items={[
      { name: "Accueil", url: getSiteUrl() },
      { name: "Boutique CBD", url: `${getSiteUrl()}/boutique` },
    ]} />
    <CollectionPageJsonLd name="Boutique CBD" description="Production bretonne et producteurs partenaires : catégories et références du catalogue." url={`${getSiteUrl()}/boutique`} products={uniqueProducts} />
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
    <section className="section-band bg-cream" aria-labelledby="catalogue-navigation-title">
      <div className="retro-container">
        <h2 id="catalogue-navigation-title" className="font-display text-3xl text-ink">Explorer le catalogue CBD</h2>
        <p className="mt-3 max-w-3xl text-charcoal">Retrouvez toutes les références par catégorie, puis comparez les prix, les formats et les informations de chaque producteur.</p>
        <nav aria-label="Catégories du catalogue" className="mt-5 flex flex-wrap gap-3">
          {getActiveCatalogCategories(uniqueProducts).map(category => <Link key={category.slug} href={`/boutique/${category.slug}`} className="btn-cartoon btn-secondary px-5 py-3 text-sm">{category.label}</Link>)}
        </nav>
        <nav aria-label="Guides pour choisir votre CBD" className="mt-6 flex flex-wrap gap-5 text-sm font-bold text-ink">
          <Link href="/cbd-pas-cher" className="underline underline-offset-4">CBD pas cher : comparer les prix</Link>
          <Link href="/cbd-naturel" className="underline underline-offset-4">CBD naturel : origine et composition</Link>
          <Link href="/cbd-breton" className="underline underline-offset-4">Notre production et le CBD breton</Link>
        </nav>
      </div>
    </section>
    </>
  );
}
