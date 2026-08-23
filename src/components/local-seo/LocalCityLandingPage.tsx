import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BreadcrumbJsonLd,
  CityServiceJsonLd,
  FaqJsonLd,
  ProductListJsonLd,
  WebPageJsonLd,
} from "@/components/JsonLd";
import { ProductCard } from "@/components/ProductCard";
import { formatCatalogCategoryList, getActiveCatalogCategories } from "@/lib/catalog-categories";
import { CBD_NATUREL_CANONICAL_ANSWER } from "@/lib/cbd-natural-answer";
import { readPublicStoreByBackend } from "@/lib/data-backend";
import {
  getCityData,
  getCityEditorialContent,
  getCityFaq,
  getNearbyCities,
  LOCAL_SEO_LAST_REVIEWED,
} from "@/lib/local-seo-data";
import { dedupeProducts } from "@/lib/product-dedup";
import { getSiteUrl } from "@/lib/site-url";

type LocalCityPageProps = {
  slug: string;
};

const featuredCategoryOrder = ["fleurs", "e-liquide", "resines", "huiles", "cosmetiques", "alimentaire"] as const;

export function isLocalCitySlug(slug: string): boolean {
  return Boolean(getCityData(slug));
}

export function getLocalCityMetadata(slug: string): Metadata {
  const cityData = getCityData(slug);

  if (!cityData) {
    return {
      title: "Page introuvable",
      robots: { index: false, follow: false },
    };
  }

  const baseUrl = getSiteUrl();
  const canonicalUrl = `${baseUrl}/${cityData.slug}`;
  const title = `${cityData.keywords.split(",")[0].trim()} : livraison, origine et analyses`;

  return {
    title,
    description: cityData.description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${title} | Les Chanvriers Bretons`,
      description: cityData.description,
      url: canonicalUrl,
      type: "website",
    },
  };
}

function selectFeaturedProducts(
  products: Awaited<ReturnType<typeof readPublicStoreByBackend>>["products"],
) {
  const uniqueProducts = dedupeProducts(products);
  const featured = featuredCategoryOrder
    .map((category) => uniqueProducts.find((product) => product.category === category))
    .filter((product): product is (typeof uniqueProducts)[number] => Boolean(product));

  if (featured.length >= 4) {
    return featured.slice(0, 4);
  }

  const selectedIds = new Set(featured.map((product) => product.id));
  const fallback = uniqueProducts.filter((product) => !selectedIds.has(product.id)).slice(0, 4 - featured.length);
  return [...featured, ...fallback];
}

export async function LocalCityLandingPage({ slug }: LocalCityPageProps) {
  const cityData = getCityData(slug);

  if (!cityData) {
    notFound();
  }

  const baseUrl = getSiteUrl();
  const pageUrl = `${baseUrl}/${cityData.slug}`;
  const variations = {
    intro: `Les commandes destinées à ${cityData.name} sont préparées en Bretagne. Chaque fiche indique le producteur et sa région afin de distinguer notre production des références partenaires.`,
  };
  const editorialContent = getCityEditorialContent(slug);
  const faqItems = getCityFaq(slug);
  const store = await readPublicStoreByBackend();
  const activeCatalogCategories = getActiveCatalogCategories(store.products);
  const availableCategoryText = formatCatalogCategoryList(activeCatalogCategories);
  const featuredProducts = selectFeaturedProducts(store.products);
  const nearbyCities = getNearbyCities(slug);
  const producerById = new Map(store.producers.map((producer) => [producer.id, producer]));

  return (
    <section className="section-band bg-mint halftone-overlay paper-grain pt-32">
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: baseUrl },
          { name: `CBD ${cityData.name}`, url: pageUrl },
        ]}
      />
      <CityServiceJsonLd
        city={cityData.name}
        department={cityData.department}
        url={pageUrl}
        description={cityData.description}
      />
      <WebPageJsonLd
        name={`CBD à ${cityData.name} : livraison, origine et analyses`}
        description={cityData.description}
        url={pageUrl}
        about={["CBD naturel", `Livraison de CBD à ${cityData.name}`, "Origine du CBD", "Analyse de laboratoire CBD"]}
        dateModified={LOCAL_SEO_LAST_REVIEWED}
      />
      <FaqJsonLd questions={faqItems} />
      <ProductListJsonLd products={featuredProducts} producers={store.producers} />
      <div className="retro-container">
        <div className="cartoon-border bg-cream p-8">
          <nav className="mb-4 text-sm text-charcoal" aria-label="Fil d'Ariane">
            <Link href="/" className="hover:text-ink underline">
              Accueil
            </Link>
            {" > "}
            <span className="font-bold text-ink">CBD {cityData.name}</span>
          </nav>

          <h1 className="section-title text-ink">CBD Naturel à {cityData.name}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-charcoal">{variations.intro}</p>
          <p className="mt-4 text-sm text-charcoal">
            Dernière vérification : <time dateTime={LOCAL_SEO_LAST_REVIEWED}>23 août 2026</time>
          </p>
        </div>

        <div className="cartoon-border mt-8 bg-white p-6 md:p-8" aria-labelledby="definition-cbd-naturel">
          <h2 id="definition-cbd-naturel" className="mb-4 text-2xl font-display text-ink">
            CBD naturel : la définition utilisée sur ce site
          </h2>
          <p className="max-w-4xl leading-relaxed text-charcoal">{CBD_NATUREL_CANONICAL_ANSWER}</p>
          <p className="mt-4 text-sm text-charcoal">
            <Link className="font-bold underline" href="/cbd-naturel">
              Consulter le guide complet et ses sources publiques
            </Link>
          </p>
        </div>

        <div className="cartoon-border mt-10 bg-cream p-8">
          <h2 className="mb-3 text-3xl font-display text-ink">Produits CBD disponibles à {cityData.name}</h2>
          <p className="max-w-3xl text-charcoal">
            Cette sélection vient du catalogue public actuel : {availableCategoryText}, selon les stocks publiés, avec livraison vers {cityData.name}.
          </p>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {featuredProducts.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              producer={product.producerId ? producerById.get(product.producerId) : undefined}
              addButtonLabel={store.content.boutique.addButtonLabel}
              lowStockThresholdGrams={store.content.boutique.lowStockThresholdGrams}
              imagePriority={index < 2}
            />
          ))}
        </div>

        <div className="cartoon-border mt-8 bg-cream p-6">
          <h2 className="mb-4 text-2xl font-display text-ink">Catégories actuellement disponibles à {cityData.name}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {activeCatalogCategories.map((category) => (
              <Link
                key={category.slug}
                href={`/boutique/${category.slug}`}
                className="cartoon-border-sm bg-white p-4 text-sm leading-relaxed text-charcoal hover:text-ink"
              >
                <strong className="block text-ink">{category.label}</strong>
                Voir les références actuellement publiées, leur origine et les informations disponibles sur leur fiche.
              </Link>
            ))}
          </div>
        </div>

        {editorialContent && (
          <div className="cartoon-border mt-8 bg-cream p-6">
            <h2 className="mb-4 text-2xl font-display text-ink">{editorialContent.title}</h2>
            <div className="space-y-4 text-sm leading-relaxed text-charcoal">
              {editorialContent.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
        )}

        <div className="cartoon-border mt-8 bg-white p-6 md:p-8">
          <h2 className="mb-5 text-2xl font-display text-ink">Questions fréquentes sur le CBD à {cityData.name}</h2>
          <div className="grid gap-4">
            {faqItems.map((item) => (
              <article key={item.question} className="cartoon-border-sm bg-cream p-5">
                <h3 className="font-display text-lg text-ink">{item.question}</h3>
                <p className="mt-2 text-sm leading-relaxed text-charcoal">{item.answer}</p>
              </article>
            ))}
          </div>
          <p className="mt-5 text-sm leading-relaxed text-charcoal">
            Pour approfondir, consultez notre guide sur le <Link className="underline" href="/cbd-naturel">CBD naturel</Link>,
            notre méthode pour <Link className="underline" href="/analyse-laboratoire-cbd">lire une analyse de laboratoire</Link>
            et la page <Link className="underline" href="/a-propos">qui sommes-nous</Link>.
          </p>
        </div>

        <div className="cartoon-border mt-10 bg-cream p-8">
          <h2 className="mb-6 text-3xl font-display text-ink">Quels éléments vérifier avant de commander ?</h2>
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <h3 className="mb-3 text-lg font-display text-ink">Analyse disponible</h3>
              <p className="text-sm leading-relaxed text-charcoal">
                Lorsqu&apos;une analyse de laboratoire est publiée, son lien apparaît sur la fiche du produit concerné.
              </p>
            </div>
            <div>
              <h3 className="mb-3 text-lg font-display text-ink">Origine indiquée</h3>
              <p className="text-sm leading-relaxed text-charcoal">
                Le nom et la région du producteur permettent de distinguer notre production bretonne des sélections partenaires.
              </p>
            </div>
            <div>
              <h3 className="mb-3 text-lg font-display text-ink">Composition lisible</h3>
              <p className="text-sm leading-relaxed text-charcoal">
                Vérifiez les ingrédients, le type d&apos;extrait et les éventuels cannabinoïdes ou arômes ajoutés.
              </p>
            </div>
          </div>
        </div>

        <div className="cartoon-border mt-8 bg-cream p-6">
          <h2 className="mb-4 text-2xl font-display text-ink">Production bretonne et producteurs partenaires</h2>
          <p className="mb-4 leading-relaxed text-charcoal">
            Les Chanvriers Bretons cultivent du chanvre en Bretagne et proposent aussi des références sélectionnées auprès de producteurs partenaires français.
          </p>
          <p className="mb-4 leading-relaxed text-charcoal">
            La fiche de chaque produit affiche sa provenance. Les commandes à destination de {cityData.name} sont préparées puis expédiées depuis la Bretagne.
          </p>
          <p className="leading-relaxed text-charcoal">
            Avant de commander, utilisez ces informations pour choisir en connaissance de cause plutôt que de vous fier au seul mot « naturel ».
          </p>
        </div>

        <div className="cartoon-border mt-8 bg-yellow p-6 text-center">
          <h2 className="mb-4 text-2xl font-display text-ink">Découvrir le CBD breton</h2>
          <p className="mb-6 text-charcoal">
            Notre boutique est ouverte en continu avec les modes de livraison proposés pour {cityData.name}. Parcourez les catégories réellement disponibles et choisissez votre référence.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/boutique"
              className="btn-cartoon btn-primary inline-flex items-center justify-center px-6 py-3 text-sm uppercase tracking-[0.08em]"
            >
              Voir la boutique
            </Link>
            <Link
              href="/blog"
              className="btn-cartoon btn-secondary inline-flex items-center justify-center px-6 py-3 text-sm uppercase tracking-[0.08em]"
            >
              Lire nos guides CBD
            </Link>
            <Link
              href="/cbd-naturel"
              className="btn-cartoon btn-secondary inline-flex items-center justify-center px-6 py-3 text-sm uppercase tracking-[0.08em]"
            >
              CBD Naturel
            </Link>
          </div>
        </div>

        {nearbyCities.length > 0 && (
          <div className="cartoon-border mt-8 bg-cream p-6">
            <h2 className="mb-4 text-2xl font-display text-ink">CBD dans les villes proches</h2>
            <p className="mb-4 text-sm leading-relaxed text-charcoal">
              Consultez les informations de livraison et les produits disponibles pour d&apos;autres villes bretonnes proches de {cityData.name}.
            </p>
            <div className="flex flex-wrap gap-2">
              {nearbyCities.map((nearbyCity) => (
                <Link
                  key={nearbyCity.slug}
                  href={`/${nearbyCity.slug}`}
                  className="pill-cartoon inline-flex items-center justify-center px-4 py-2 text-xs uppercase tracking-[0.08em]"
                >
                  CBD {nearbyCity.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="cartoon-border mt-8 space-y-3 bg-cream p-6 text-sm text-charcoal">
          <p>
            <strong>Livraison à {cityData.name}, {cityData.department} :</strong> les catégories et stocks réellement disponibles sont affichés dans la boutique.
          </p>
          <p>
            <strong>Origine :</strong> la production des Chanvriers Bretons et les références partenaires sont identifiées séparément sur les fiches.
          </p>
          <p>
            <strong>Preuves :</strong> vérifiez la composition et l&apos;analyse disponible avant de choisir un produit.
          </p>
        </div>
      </div>
    </section>
  );
}
