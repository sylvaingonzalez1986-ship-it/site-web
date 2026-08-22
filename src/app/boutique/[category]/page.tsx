import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CollectionPageJsonLd } from "@/components/JsonLd";
import { ProductCard } from "@/components/ProductCard";
import { type ProductCategory } from "@/data/products";
import { readPublicStoreByBackend } from "@/lib/data-backend";
import { getSiteUrl } from "@/lib/site-url";
import { getOwnProducer, resolveProductProducer, sortOwnProductsFirst } from "@/lib/own-producer";
import { dedupeProducts } from "@/lib/product-dedup";
import { getProductCardTastingSummaries } from "@/lib/product-card-tasting-backend";
import type { Producer } from "@/types/store";

const categoryMap: Record<string, { filter: ProductCategory; label: string }> = {
  "fleurs-cbd": { filter: "fleurs", label: "Fleurs CBD" },
  "resines-cbd": { filter: "resines", label: "Resines CBD" },
  "huiles-cbd": { filter: "huiles", label: "Huiles CBD" },
  "e-liquide-cbd": { filter: "e-liquide", label: "E-liquides CBD" },
  "cosmetiques-cbd": { filter: "cosmetiques", label: "Cosmetiques CBD" },
  "tisane-cbd": { filter: "alimentaire", label: "Tisane CBD" },
  "alimentaire-cbd": { filter: "alimentaire", label: "Tisane CBD" },
  "miam-cbd": { filter: "miam", label: "Miam CBD" },
  "accessoires-cbd": { filter: "accessoires", label: "Accessoires CBD" },
};

const relatedCategoryLinks: Record<string, string[]> = {
  "fleurs-cbd": ["resines-cbd", "huiles-cbd", "tisane-cbd"],
  "resines-cbd": ["fleurs-cbd", "huiles-cbd"],
  "huiles-cbd": ["fleurs-cbd", "cosmetiques-cbd", "tisane-cbd"],
  "e-liquide-cbd": ["fleurs-cbd", "resines-cbd"],
  "cosmetiques-cbd": ["huiles-cbd", "tisane-cbd"],
  "tisane-cbd": ["huiles-cbd", "miam-cbd"],
  "alimentaire-cbd": ["huiles-cbd", "miam-cbd"],
  "miam-cbd": ["tisane-cbd", "fleurs-cbd"],
  "accessoires-cbd": ["fleurs-cbd", "huiles-cbd"],
};

export function generateStaticParams() {
  return Object.keys(categoryMap).map((category) => ({ category }));
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: slug } = await params;
  const categoryInfo = categoryMap[slug];

  if (!categoryInfo) {
    notFound();
  }

  const store = await readPublicStoreByBackend();
  const uniqueProducts = dedupeProducts(store.products);
  const ownProducer = getOwnProducer(store.content.boutique);
  const producersById = new Map<string, Producer>(
    store.producers.map((producer) => [producer.id, producer]),
  );

  const filteredProducts = sortOwnProductsFirst(
    uniqueProducts.filter((product) => product.category === categoryInfo.filter),
  );
  const tastingSummariesByProductId = await getProductCardTastingSummaries(
    filteredProducts.map((product) => product.id),
  );
  const baseUrl = getSiteUrl();
  const categoryDescription = getCategoryDescription(slug);
  const relatedLinks = (relatedCategoryLinks[slug] ?? [])
    .map((relatedSlug) => ({ href: `/boutique/${relatedSlug}`, label: categoryMap[relatedSlug]?.label }))
    .filter((link): link is { href: string; label: string } => Boolean(link.label));

  return (
    <section className="section-band bg-mint halftone-overlay paper-grain pt-32">
      <CollectionPageJsonLd
        name={categoryInfo.label}
        description={categoryDescription}
        url={`${baseUrl}/boutique/${slug}`}
        products={filteredProducts}
      />

      <div className="retro-container">
        <div className="cartoon-border bg-cream p-8">
          <nav className="mb-4 text-sm text-charcoal" aria-label="Fil d'Ariane">
            <Link href="/" className="hover:text-ink underline">
              Accueil
            </Link>
            {" > "}
            <Link href="/boutique" className="hover:text-ink underline">
              Boutique
            </Link>
            {" > "}
            <span className="font-bold text-ink">{categoryInfo.label}</span>
          </nav>

          <h1 className="section-title text-ink">{categoryInfo.label}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-charcoal">
            {categoryDescription}
          </p>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              producer={resolveProductProducer(product, producersById, ownProducer)}
              addButtonLabel={store.content.boutique.addButtonLabel}
              lowStockThresholdGrams={store.content.boutique.lowStockThresholdGrams}
              tastingSummary={tastingSummariesByProductId[product.id]}
            />
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="cartoon-border mt-6 bg-cream p-6 text-center text-charcoal">
            Aucun produit dans cette catégorie pour le moment.
          </div>
        )}

        <div className="cartoon-border mt-8 bg-cream p-6">
          <h2 className="font-display text-2xl text-ink">{getCategorySeoTitle(slug)}</h2>
          <div className="mt-4 space-y-3 text-charcoal leading-relaxed">{getCategorySeoText(slug)}</div>
        </div>

        {relatedLinks.length > 0 && (
          <div className="cartoon-border mt-8 bg-cream p-6">
            <h2 className="font-display text-2xl text-ink">Vous aimerez aussi</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {relatedLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="pill-cartoon inline-flex min-h-[40px] items-center justify-center px-4 text-xs uppercase tracking-[0.08em]"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

type CategoryGuide = {
  description: string;
  title: string;
  paragraphs: [string, string];
};

const categoryGuides: Record<string, CategoryGuide> = {
  "fleurs-cbd": {
    description:
      "Comparez les fleurs CBD selon leur origine, leur producteur, leur mode de culture, leurs formats et les analyses disponibles.",
    title: "Comment comparer des fleurs CBD ?",
    paragraphs: [
      "Vérifiez le producteur, l'origine du chanvre, le mode de culture déclaré, la composition et le numéro de lot. Une analyse récente doit pouvoir être rapprochée de la référence vendue lorsqu'elle est publiée.",
      "Cette catégorie peut réunir notre production et des fleurs de producteurs partenaires. Le nom affiché sur chaque carte et chaque fiche permet de les distinguer.",
    ],
  },
  "resines-cbd": {
    description:
      "Comparez les résines CBD selon leur producteur ou marque, leur composition, leur format et les analyses disponibles.",
    title: "Comment lire une fiche de résine CBD ?",
    paragraphs: [
      "La texture ou le nom commercial ne suffisent pas à décrire une résine. Consultez la liste des ingrédients, les cannabinoïdes annoncés, l'origine et l'analyse correspondant au lot lorsqu'elle est disponible.",
      "Les références partenaires sont attribuées à leur producteur. Cette distinction permet de ne pas confondre leur origine avec la production des Chanvriers Bretons.",
    ],
  },
  "huiles-cbd": {
    description:
      "Comparez les huiles CBD selon leur dosage, leur type d'extrait, leur composition, leur marque et leur format.",
    title: "Comment comparer des huiles CBD ?",
    paragraphs: [
      "Vérifiez la quantité totale, la concentration, l'huile support et le type d'extrait indiqué. Les mentions full spectrum, broad spectrum ou isolat décrivent des compositions différentes.",
      "Consultez l'étiquette et l'analyse disponible pour vérifier les cannabinoïdes du produit. Si vous suivez un traitement, demandez conseil à un professionnel de santé.",
    ],
  },
  "e-liquide-cbd": {
    description:
      "Comparez les e-liquides CBD selon leur dosage, leur composition, leur marque, leur format et leurs précautions d'utilisation.",
    title: "Comment choisir un e-liquide CBD ?",
    paragraphs: [
      "Consultez la concentration en CBD, la liste des ingrédients, le volume et les consignes du fabricant. La fiche doit identifier clairement la marque ou le producteur de la référence.",
      "Respectez le matériel compatible et les précautions indiquées sur l'emballage. Ces produits sont réservés aux adultes et ne doivent pas être présentés comme des traitements.",
    ],
  },
  "cosmetiques-cbd": {
    description:
      "Comparez les cosmétiques au CBD selon leur composition, leur marque, leur format et leurs conseils d'utilisation.",
    title: "Comment lire une fiche de cosmétique au CBD ?",
    paragraphs: [
      "Vérifiez la liste INCI, la quantité, la zone d'application et les précautions du fabricant. La présence de CBD ne permet pas, à elle seule, de déduire un effet thérapeutique.",
      "L'origine et la marque varient selon les références. La fiche produit rassemble les informations disponibles pour le produit concerné.",
    ],
  },
  "tisane-cbd": {
    description:
      "Comparez les tisanes et infusions au chanvre selon leurs ingrédients, leur origine, leur producteur et leurs conseils de préparation.",
    title: "Comment comparer des tisanes au chanvre ?",
    paragraphs: [
      "Lisez la liste complète des plantes, les proportions lorsqu'elles sont indiquées, les allergènes éventuels et les conseils de préparation. L'origine doit être vérifiée référence par référence.",
      "Le catalogue peut réunir des produits maison et des tisanes partenaires. Le producteur ou la marque affiché sur la fiche permet de les distinguer.",
    ],
  },
  "alimentaire-cbd": {
    description:
      "Comparez les produits alimentaires au CBD ou au chanvre selon leur composition, leurs allergènes, leur origine et leur marque.",
    title: "Comment vérifier un produit alimentaire au CBD ?",
    paragraphs: [
      "Consultez les ingrédients, les allergènes, la quantité, les conditions de conservation et les conseils d'utilisation. Les caractéristiques peuvent varier d'une référence à l'autre.",
      "Le producteur ou la marque et l'origine disponible sont indiqués sur la fiche. L'étiquette du produit reçu reste la référence pour le lot concerné.",
    ],
  },
  "miam-cbd": {
    description:
      "Découvrez les produits gourmands au CBD ou au chanvre avec leur composition, leurs allergènes, leur origine et leur marque.",
    title: "Que vérifier sur un produit gourmand au CBD ?",
    paragraphs: [
      "Lisez la composition, les allergènes, la quantité et les conditions de conservation. Le mot naturel ne remplace pas ces informations ni l'étiquette du produit.",
      "Les références peuvent provenir des Chanvriers Bretons ou de partenaires identifiés. Consultez la fiche pour connaître l'origine du produit concerné.",
    ],
  },
  "accessoires-cbd": {
    description:
      "Grinders, contenants, plateaux et kits : comparez les accessoires selon leur usage, leurs dimensions et leurs matériaux.",
    title: "Comment choisir un accessoire CBD ?",
    paragraphs: [
      "Choisissez selon l'usage prévu, les dimensions, les matériaux et les consignes d'entretien indiquées sur la fiche.",
      "Pour la conservation, privilégiez un contenant fermé et suivez les instructions propres au produit CBD concerné.",
    ],
  },
};

function getCategoryDescription(slug: string): string {
  return categoryGuides[slug]?.description ?? "";
}

function getCategorySeoTitle(slug: string): string {
  return categoryGuides[slug]?.title ?? "";
}

function getCategorySeoText(slug: string): ReactNode {
  return categoryGuides[slug]?.paragraphs.map((paragraph) => (
    <p key={paragraph}>{paragraph}</p>
  )) ?? null;
}
