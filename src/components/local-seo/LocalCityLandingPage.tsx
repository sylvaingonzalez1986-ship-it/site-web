import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BreadcrumbJsonLd,
  CityServiceJsonLd,
  ProductListJsonLd,
} from "@/components/JsonLd";
import { ProductCard } from "@/components/ProductCard";
import { readPublicStoreByBackend } from "@/lib/data-backend";
import {
  getCityData,
  getCityEditorialContent,
  getNearbyCities,
} from "@/lib/local-seo-data";
import { dedupeProducts } from "@/lib/product-dedup";
import { getSiteUrl } from "@/lib/site-url";

type LocalCityPageProps = {
  slug: string;
};

const featuredCategoryOrder = ["fleurs", "huiles", "resines", "alimentaire"] as const;

const cityProductVariations: Record<
  string,
  {
    intro: string;
    fleurIntro: string;
    huilleIntro: string;
    tisaneIntro: string;
    resinIntro: string;
  }
> = {
  "cbd-rennes": {
    intro: "À Rennes, capitale de la Bretagne, nous livrons rapidement nos produits CBD naturels aux habitants et entreprises de la région. Direct du producteur breton, sans pesticide.",
    fleurIntro: "Les fleurs de CBD de Rennes sont cultivées en Bretagne selon les normes les plus strictes. Arômes intenses, taux de CBD analysé en laboratoire.",
    huilleIntro: "Nos huiles CBD full spectrum à Rennes offrent une concentration optimale pour la relaxation quotidienne. Idéales pour les habitants de Rennes et d'Ille-et-Vilaine.",
    tisaneIntro: "Tisanes chanvre artisanales bretonnes distribuées à Rennes. Infusions calmantes, sans THC.",
    resinIntro: "Résines CBD comprimées de la Bretagne, livraison express à Rennes. Pureté garantie.",
  },
  "cbd-quimper": {
    intro: "À Quimper dans le Finistère, découvrez le CBD naturel breton en direct du producteur. Circuit court, livraison rapide dans votre région.",
    fleurIntro: "Fleurs de CBD bretonnes premium à Quimper. Cultivées sans pesticide selon les traditions agricoles bretonnes. Terpènes préservés, qualité garantie.",
    huilleIntro: "Huiles CBD naturelles et bretonnes distribuées à Quimper. Spectre complet, extraction douce.",
    tisaneIntro: "Tisanes chanvre artisanales du producteur breton à Quimper. Goût délicat, effets relaxants.",
    resinIntro: "Résines CBD pures du terroir breton livrées à Quimper. Densité et saveur remarquables.",
  },
  "cbd-brest": {
    intro: "À Brest, nous livrons rapidement votre CBD breton du producteur direct. Sans pesticide, naturel, légal et analysé.",
    fleurIntro: "Fleurs CBD bretonnes de qualité supérieure à Brest. Sélection stricte, parfum authentique, CBD pur.",
    huilleIntro: "Huiles CBD bretonnes à Brest. Full spectrum, prise sublinguale, absorption rapide. Bien-être immédiat.",
    tisaneIntro: "Tisanes chanvre bretonnes servies à Brest. Recette artisanale, ingrédients naturels.",
    resinIntro: "Résines CBD bretonnes à Brest en livraison rapide. Concentration CBD maximale.",
  },
  "cbd-vannes": {
    intro: "À Vannes en Morbihan, le CBD naturel breton est disponible en direct du producteur. Livraison rapide, circuit court, sans intermédiaire.",
    fleurIntro: "Fleurs de CBD pour Vannes issues du producteur breton. Cultivées localement sans pesticide, avec des arômes intenses.",
    huilleIntro: "Huiles CBD à Vannes au spectre complet. Dosage facile, résultats rapides, bien-être durable.",
    tisaneIntro: "Tisanes chanvre artisanales bretonnes à Vannes. Infusion relaxante, saveur boisée.",
    resinIntro: "Résines CBD bretonnes à Vannes. Extraction soignée et qualité constante.",
  },
  "cbd-lorient": {
    intro: "À Lorient, achetez votre CBD naturel breton direct du producteur. Livraison express, sans THC détectable au-delà du seuil légal.",
    fleurIntro: "Fleurs de CBD pour Lorient issues du producteur breton. Qualité laboratoire, terpènes préservés.",
    huilleIntro: "Huiles CBD bretonnes à Lorient. Sublingual, absorption rapide, bien-être quotidien.",
    tisaneIntro: "Tisanes chanvre artisanales bretonnes servies à Lorient. Goût authentique, apaisement naturel.",
    resinIntro: "Résines CBD bretonnes à Lorient. Texture crémeuse, saveur riche, concentration optimale.",
  },
  "cbd-saint-brieuc": {
    intro: "À Saint-Brieuc, découvrez le CBD naturel breton du producteur. Dans les Côtes-d'Armor, profitez d'un CBD légal, frais et sans pesticide.",
    fleurIntro: "Fleurs de CBD bretonnes à Saint-Brieuc. Arômes authentiques, culture sans chimie.",
    huilleIntro: "Huiles CBD full spectrum bretonnes à Saint-Brieuc. Bien-être quotidien, dosage facile.",
    tisaneIntro: "Tisanes chanvre artisanales à Saint-Brieuc. Recette traditionnelle, ingrédients purs.",
    resinIntro: "Résines CBD bretonnes à Saint-Brieuc. Travail artisanal, puissance maîtrisée.",
  },
  "cbd-saint-malo": {
    intro: "À Saint-Malo sur la côte bretonne, profitez d'un CBD naturel issu du producteur breton avec une livraison rapide. Légal, naturel, transparent.",
    fleurIntro: "Fleurs de CBD bretonnes à Saint-Malo. Terroir côtier, qualité supérieure, profils aromatiques nets.",
    huilleIntro: "Huiles CBD bretonnes à Saint-Malo. Usage simple, résultats rapides, formule naturelle.",
    tisaneIntro: "Tisanes chanvre bretonnes artisanales à Saint-Malo. Infusion authentique et pure.",
    resinIntro: "Résines CBD bretonnes à Saint-Malo. Extraction locale, puissance testée, constance garantie.",
  },
  "cbd-fougeres": {
    intro: "À Fougères en Ille-et-Vilaine, achetez le CBD naturel breton du producteur direct. Sans intermédiaire, avec des prix producteurs cohérents.",
    fleurIntro: "Fleurs de CBD bretonnes à Fougères. Qualité premium, culture responsable.",
    huilleIntro: "Huiles CBD bretonnes à Fougères. Spectre complet, effets durables, absorption optimale.",
    tisaneIntro: "Tisanes chanvre artisanales bretonnes à Fougères. Recette apaisante, ancrée dans le terroir.",
    resinIntro: "Résines CBD bretonnes à Fougères. Densité marquée, saveur riche, pureté certifiée.",
  },
  "cbd-vitre": {
    intro: "À Vitré, découvrez un CBD naturel breton issu du producteur. Circuit court, livraison rapide et transparence sur la qualité.",
    fleurIntro: "Fleurs de CBD bretonnes à Vitré. Notes florales intenses, cannabinoïdes préservés.",
    huilleIntro: "Huiles CBD bretonnes à Vitré. Full spectrum naturel, usage simple, bien-être immédiat.",
    tisaneIntro: "Tisanes chanvre bretonnes à Vitré. Artisanat local, goût délicat, détente naturelle.",
    resinIntro: "Résines CBD bretonnes à Vitré. Fabrication soignée, qualité artisanale.",
  },
  "cbd-redon": {
    intro: "À Redon, le CBD naturel breton est livré directement depuis le producteur. Qualité certifiée, positionnement juste, légal en France.",
    fleurIntro: "Fleurs de CBD bretonnes à Redon. Culture attentive, arômes authentiques, THC inférieur au seuil légal.",
    huilleIntro: "Huiles CBD bretonnes à Redon. Spectre complet, goût naturel, bien-être durable.",
    tisaneIntro: "Tisanes chanvre artisanales bretonnes à Redon. Infusion traditionnelle, relaxation douce.",
    resinIntro: "Résines CBD bretonnes à Redon. Extraction soignée, pureté élevée, saveur boisée authentique.",
  },
};

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
  const title = `${cityData.keywords.split(",")[0].trim()} | Les Chanvriers Bretons`;

  return {
    title,
    description: cityData.description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
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
  const cityVariations = cityProductVariations[slug] || cityProductVariations["cbd-rennes"];
  const variations = {
    ...cityVariations,
    intro: `Les commandes destinées à ${cityData.name} sont préparées en Bretagne. Chaque fiche indique le producteur et sa région afin de distinguer notre production des références partenaires.`,
    fleurIntro: `Fleurs actuellement disponibles pour livraison vers ${cityData.name} : comparez le producteur, le mode de culture et l'analyse publiée.`,
    huilleIntro: `Huiles disponibles pour ${cityData.name} : vérifiez le type d'extrait, la concentration et la liste complète des ingrédients.`,
    tisaneIntro: `Tisanes disponibles pour ${cityData.name} : consultez la composition, l'origine des plantes et les conseils de préparation.`,
    resinIntro: `Résines disponibles pour ${cityData.name} : vérifiez le producteur, la composition et le document d'analyse associé.`,
  };
  const editorialContent = getCityEditorialContent(slug);
  const store = await readPublicStoreByBackend();
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
        </div>

        <div className="cartoon-border mt-10 bg-cream p-8">
          <h2 className="mb-3 text-3xl font-display text-ink">Produits CBD disponibles à {cityData.name}</h2>
          <p className="max-w-3xl text-charcoal">
            Voici une sélection de produits réellement disponibles sur la boutique. Vous retrouvez selon les stocks des fleurs CBD, huiles, résines et tisanes chanvre avec livraison vers {cityData.name}.
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
          <h2 className="mb-4 text-2xl font-display text-ink">Formats disponibles à {cityData.name}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <p className="text-sm leading-relaxed text-charcoal">{variations.fleurIntro}</p>
            <p className="text-sm leading-relaxed text-charcoal">{variations.huilleIntro}</p>
            <p className="text-sm leading-relaxed text-charcoal">{variations.resinIntro}</p>
            <p className="text-sm leading-relaxed text-charcoal">{variations.tisaneIntro}</p>
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
            Notre boutique est ouverte en continu avec livraison rapide vers {cityData.name}. Parcourez les catégories et choisissez le format qui vous convient.
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
