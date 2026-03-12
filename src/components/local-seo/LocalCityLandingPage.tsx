import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BreadcrumbJsonLd,
  CityServiceJsonLd,
  FaqJsonLd,
  ProductListJsonLd,
} from "@/components/JsonLd";
import { ProductCard } from "@/components/ProductCard";
import { readPublicStoreByBackend } from "@/lib/data-backend";
import { getCityData, getNearbyCities } from "@/lib/local-seo-data";
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
  const variations = cityProductVariations[slug] || cityProductVariations["cbd-rennes"];
  const store = await readPublicStoreByBackend();
  const featuredProducts = selectFeaturedProducts(store.products);
  const nearbyCities = getNearbyCities(slug);
  const producerById = new Map(store.producers.map((producer) => [producer.id, producer]));
  const faqItems = [
    {
      question: `Le CBD est-il légal à ${cityData.name} ?`,
      answer:
        "Oui. Notre CBD breton est conforme à la réglementation française avec un THC sous le seuil autorisé et des analyses laboratoire à l'appui.",
    },
    {
      question: `Combien de temps pour recevoir une commande à ${cityData.name} ?`,
      answer:
        "Les expéditions sont préparées rapidement et livrées en France métropolitaine avec suivi, dans un emballage discret.",
    },
    {
      question: "Quel produit choisir entre fleurs, huiles, résines et tisanes ?",
      answer:
        "Les fleurs conviennent à ceux qui recherchent le profil naturel du chanvre, les huiles offrent un usage simple, les résines une concentration plus marquée et les tisanes une approche plus douce.",
    },
  ];

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
          <h2 className="mb-4 text-2xl font-display text-ink">Formats les plus recherchés à {cityData.name}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <p className="text-sm leading-relaxed text-charcoal">{variations.fleurIntro}</p>
            <p className="text-sm leading-relaxed text-charcoal">{variations.huilleIntro}</p>
            <p className="text-sm leading-relaxed text-charcoal">{variations.resinIntro}</p>
            <p className="text-sm leading-relaxed text-charcoal">{variations.tisaneIntro}</p>
          </div>
        </div>

        <div className="cartoon-border mt-10 bg-cream p-8">
          <h2 className="mb-6 text-3xl font-display text-ink">Pourquoi choisir le CBD breton à {cityData.name} ?</h2>
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <h3 className="mb-3 text-lg font-display text-ink">Qualité certifiée</h3>
              <p className="text-sm leading-relaxed text-charcoal">
                Chaque produit CBD est analysé en laboratoire. THC inférieur au seuil légal, conformité française, traçabilité claire.
              </p>
            </div>
            <div>
              <h3 className="mb-3 text-lg font-display text-ink">Naturel et responsable</h3>
              <p className="text-sm leading-relaxed text-charcoal">
                Culture sans pesticide ni chimie lourde. Notre CBD breton respecte l'environnement, le terroir et une logique de production propre.
              </p>
            </div>
            <div>
              <h3 className="mb-3 text-lg font-display text-ink">Prix producteur direct</h3>
              <p className="text-sm leading-relaxed text-charcoal">
                Circuit court et vente directe. Vous achetez un CBD naturel sans surcouche d'intermédiaires, avec une logique de qualité avant volume.
              </p>
            </div>
          </div>
        </div>

        <div className="cartoon-border mt-8 bg-cream p-6">
          <h2 className="mb-4 text-2xl font-display text-ink">Producteur direct breton</h2>
          <p className="mb-4 leading-relaxed text-charcoal">
            Les Chanvriers Bretons cultivent le chanvre en Bretagne et valorisent une chaîne courte, de la culture à la préparation des commandes livrées chez vous à {cityData.name}.
          </p>
          <p className="mb-4 leading-relaxed text-charcoal">
            Notre approche est simple : proposer des fleurs CBD, des huiles naturelles, des résines et des tisanes chanvre artisanales avec un niveau de transparence élevé.
          </p>
          <p className="leading-relaxed text-charcoal">
            Acheter chez Les Chanvriers Bretons, c'est soutenir une agriculture locale responsable en {cityData.department} et plus largement en Bretagne.
          </p>
        </div>

        <div className="cartoon-border mt-8 bg-cream p-6">
          <h2 className="mb-4 text-2xl font-display text-ink">Questions fréquentes sur le CBD à {cityData.name}</h2>
          <div className="space-y-4">
            {faqItems.map((item) => (
              <div key={item.question}>
                <h3 className="mb-2 font-bold text-ink">{item.question}</h3>
                <p className="text-sm text-charcoal">{item.answer}</p>
              </div>
            ))}
          </div>
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
          </div>
        </div>

        {nearbyCities.length > 0 && (
          <div className="cartoon-border mt-8 bg-cream p-6">
            <h2 className="mb-4 text-2xl font-display text-ink">CBD dans les villes proches</h2>
            <p className="mb-4 text-sm leading-relaxed text-charcoal">
              Vous cherchez aussi du CBD naturel dans d'autres villes bretonnes proches de {cityData.name} ? Consultez aussi nos pages locales pour renforcer votre recherche par zone géographique.
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
            <strong>CBD naturel livré à {cityData.name}, {cityData.department} :</strong> découvrez nos fleurs de CBD breton, huiles naturelles full spectrum, résines et tisanes chanvre artisanales.
          </p>
          <p>
            <strong>Achat en ligne en direct du producteur :</strong> chaque référence privilégie la qualité, la traçabilité et une approche naturelle du chanvre en Bretagne.
          </p>
          <p>
            <strong>Producteur CBD en Bretagne :</strong> Les Chanvriers Bretons mettent en avant un chanvre cultivé proprement, des transformations maîtrisées et une logistique adaptée à toute la région.
          </p>
        </div>
      </div>
    </section>
  );
}