import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { bretonCities, getCityData } from "@/lib/local-seo-data";
import { readPublicStoreByBackend } from "@/lib/data-backend";
import { getSiteUrl } from "@/lib/site-url";

type LocalCityPageProps = {
  params: Promise<{ city: string }>;
};

// Enhanced product descriptions by city
const cityProductVariations: Record<string, {
  intro: string;
  fleurIntro: string;
  huilleIntro: string;
  tisaneIntro: string;
  resinIntro: string;
}> = {
  "cbd-rennes": {
    intro: "À Rennes, capitale de la Bretagne, nous livrons rapidement nos produits CBD naturels aux habitants et entreprises de la région. Direct du producteur breton, sans pesticide.",
    fleurIntro: "Les fleurs de CBD de Rennes sont cultivées en Bretagne selon les normes les plus strictes. Arômes intenses, taux de CBD analysé en laboratoire.",
    huilleIntro: "Nos huiles CBD full spectrum à Rennes offrent une concentration optimale pour la relaxation quotidienne. Idéales pour les habitants de Rennes et Ille-et-Vilaine.",
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
    intro: "À Brest, nous livrons rapidement votre CBD breton du producteur direct. Sans pesticide, naturel, legal et analysé.",
    fleurIntro: "Fleurs CBD bretonnes de qualité supérieure à Brest. Sélection stricte, parfum authentique, CBD pur.",
    huilleIntro: "Huiles CBD bretonnes à Brest. Full spectrum, sous-linguale, rapide absorption. Bien-être immédiat.",
    tisaneIntro: "Tisanes chanvre bretonnes servies à Brest. Recette artisanale, ingrédients naturels.",
    resinIntro: "Résines CBD breton à Brest en livraison rapide. Concentration CBD maximale.",
  },
  "cbd-vannes": {
    intro: "À Vannes en Morbihan, le CBD naturel breton de producteur direct. Livraison rapide, circuit court, sans intermédiaire.",
    fleurIntro: "Fleurs de CBD vannoises du producteur breton. Cultivées localement sans pesticide, arômes intenses.",
    huilleIntro: "Huiles CBD complete spectrum à Vannes. Dosage facile, risultats rapides, bien-être durable.",
    tisaneIntro: "Tisanes chanvre artisanales bretonnes à Vannes. Infusion relaxante, saveur boisée.",
    resinIntro: "Résines CBD breton à Vannes. Pureté 99%, extraction CO2 supercritique.",
  },
  "cbd-lorient": {
    intro: "À Lorient, achetez votre CBD naturel breton direct du producteur. Livraison express, sans THC détectable.",
    fleurIntro: "Fleurs de CBD lorientaises du producteur breton. Qualité laboratoire, terpènes préservés.",
    huilleIntro: "Huiles CBD bretonnes à Lorient. Sublingual, absorption rapide, bien-être garanti.",
    tisaneIntro: "Tisanes chanvre artisanales bretonnes servies à Lorient. Goût authentique, apaisement naturel.",
    resinIntro: "Résines CBD breton à Lorient. Texture crémeuse, saveur riche, concentration optimale.",
  },
  "cbd-saint-brieuc": {
    intro: "À Saint-Brieuc, découvrez le CBD naturel breton du producteur. Côtes-d'Armor : CBD legal, fresh, sans pesticide.",
    fleurIntro: "Fleurs de CBD breton à Saint-Brieuc. Arômes breton authentiques, cultivées sans chimie.",
    huilleIntro: "Huiles CBD full spectrum bretonnes à Saint-Brieuc. Bien-être quotidien, dosage facile.",
    tisaneIntro: "Tisanes chanvre artisanales à Saint-Brieuc. Recette traditionnelle, ingrédients purs.",
    resinIntro: "Résines CBD breton à Saint-Brieuc. Comprimées artisanalement, puissance maximale.",
  },
  "cbd-saint-malo": {
    intro: "À Saint-Malo sur la côte bretonne, CBD naturel du producteur breton en livraison rapide. Legal, naturel, transparent.",
    fleurIntro: "Fleurs de CBD breton à Saint-Malo. Côte bretonne, terroir pur, qualité supérieure.",
    huilleIntro: "Huiles CBD bretonnes à Saint-Malo. Sublingual efficace, résultats rapides, naturel.",
    tisaneIntro: "Tisanes chanvre bretonnes artisanales à Saint-Malo. Infusion côtière, authentique et pure.",
    resinIntro: "Résines CBD breton à Saint-Malo. Extraction locale, puissance testée, satisfaction garantie.",
  },
  "cbd-fougeres": {
    intro: "À Fougères en Ille-et-Vilaine, achetez le CBD naturel breton du producteur direct. Sans intermédiaire, prix justes.",
    fleurIntro: "Fleurs de CBD breton à Fougères. Qualité premium, cultivation biologique responsable.",
    huilleIntro: "Huiles CBD bretonnes à Fougères. Spectre complet, effets durables, absorption optimale.",
    tisaneIntro: "Tisanes chanvre artisanales bretonnes à Fougères. Recette secrète, apaisement garanti.",
    resinIntro: "Résines CBD breton à Fougères. Densité maximale, saveur riche, pureté certifiée.",
  },
  "cbd-vitre": {
    intro: "À Vitré, CBD naturel breton du producteur. Circuit court, livraison rapide, prix producteur transparent.",
    fleurIntro: "Fleurs de CBD breton à Vitré. Arômes intensément floral, cannabinoïdes intacts.",
    huilleIntro: "Huiles CBD bretonnes à Vitré. Full spectrum naturel, sous-lingual efficace, bien-être immédiat.",
    tisaneIntro: "Tisanes chanvre bretonnes à Vitré. Artisanat local, goût délicat, détente naturelle.",
    resinIntro: "Résines CBD breton à Vitré. Comprimées manuellement, qualité artisanale garantie.",
  },
  "cbd-redon": {
    intro: "À Redon, le CBD naturel breton livré directement du producteur. Qualité certifiée, prix juste, légal en France.",
    fleurIntro: "Fleurs de CBD breton à Redon. Cultivation passionnée, arômes authentiques, THC < 0.3%.",
    huilleIntro: "Huiles CBD bretonnes à Redon. Spectre complet, goût naturel, bien-être durable garantit.",
    tisaneIntro: "Tisanes chanvre artisanales bretonnes à Redon. Infusion traditionnelle, relaxation profonde.",
    resinIntro: "Résines CBD breton à Redon. Extraction soignée, pureté maximale, saveur boisée authentique.",
  },
};

export async function generateStaticParams() {
  return bretonCities.map((city) => ({ city: city.slug }));
}

export async function generateMetadata({
  params,
}: LocalCityPageProps): Promise<Metadata> {
  const { city } = await params;
  const cityData = getCityData(city);

  if (!cityData) {
    return {
      title: "Page introuvable",
      robots: { index: false, follow: false },
    };
  }

  const baseUrl = getSiteUrl();
  const canonicalUrl = `${baseUrl}/${cityData.slug}`;
  const title = `${cityData.keywords.split(",")[0].trim()} | Les Chanvriers Bretons`;
  const description = cityData.description;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "website",
    },
  };
}

export default async function LocalCityPage({ params }: LocalCityPageProps) {
  const { city } = await params;
  const cityData = getCityData(city);

  if (!cityData) {
    notFound();
  }

  const store = await readPublicStoreByBackend();
  const baseUrl = getSiteUrl();
  const variations = cityProductVariations[city] || cityProductVariations["cbd-rennes"];

  return (
    <section className="section-band bg-mint halftone-overlay paper-grain pt-32">
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
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-charcoal">
            {variations.intro}
          </p>
        </div>

        {/* Produits Principaux */}
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
          {/* Fleurs CBD */}
          <Link
            href="/boutique/fleurs-cbd"
            className="cartoon-border bg-cream p-6 hover:bg-[#f0fef9] transition-colors"
          >
            <h2 className="font-display text-2xl text-ink mb-3">🌿 Fleurs CBD</h2>
            <p className="text-sm text-charcoal mb-3">
              {variations.fleurIntro}
            </p>
            <div className="space-y-2 text-xs text-charcoal">
              <p><strong>✓ Cultivation sans pesticide</strong></p>
              <p><strong>✓ Analyse laboratoire certifiée</strong></p>
              <p><strong>✓ Arômes authentiques préservés</strong></p>
              <p className="text-ink font-bold pt-2">À partir de 12€ les 3g</p>
            </div>
          </Link>

          {/* Huiles CBD */}
          <Link
            href="/boutique/huiles-cbd"
            className="cartoon-border bg-cream p-6 hover:bg-[#f0fef9] transition-colors"
          >
            <h2 className="font-display text-2xl text-ink mb-3">💧 Huiles CBD Full Spectrum</h2>
            <p className="text-sm text-charcoal mb-3">
              {variations.huilleIntro}
            </p>
            <div className="space-y-2 text-xs text-charcoal">
              <p><strong>✓ Dosage facile (compte-gouttes)</strong></p>
              <p><strong>✓ Absorption rapide et efficace</strong></p>
              <p><strong>✓ Spectre complet de cannabinoïdes</strong></p>
              <p className="text-ink font-bold pt-2">À partir de 18€ les 10ml</p>
            </div>
          </Link>

          {/* Résines CBD */}
          <Link
            href="/boutique/resines-cbd"
            className="cartoon-border bg-cream p-6 hover:bg-[#f0fef9] transition-colors"
          >
            <h2 className="font-display text-2xl text-ink mb-3">🔷 Résines CBD</h2>
            <p className="text-sm text-charcoal mb-3">
              {variations.resinIntro}
            </p>
            <div className="space-y-2 text-xs text-charcoal">
              <p><strong>✓ Concentration CBD maximale</strong></p>
              <p><strong>✓ Texture crémeuse naturelle</strong></p>
              <p><strong>✓ Extraction CO2 supercritique</strong></p>
              <p className="text-ink font-bold pt-2">À partir de 15€ les 3g</p>
            </div>
          </Link>

          {/* Tisanes */}
          <Link
            href="/boutique/tisane-cbd"
            className="cartoon-border bg-cream p-6 hover:bg-[#f0fef9] transition-colors"
          >
            <h2 className="font-display text-2xl text-ink mb-3">☕ Tisanes Chanvre Artisanales</h2>
            <p className="text-sm text-charcoal mb-3">
              {variations.tisaneIntro}
            </p>
            <div className="space-y-2 text-xs text-charcoal">
              <p><strong>✓ Recette traditionnelle bretonne</strong></p>
              <p><strong>✓ Ingrédients naturels sélectionnés</strong></p>
              <p><strong>✓ Effet relaxant immédiat</strong></p>
              <p className="text-ink font-bold pt-2">À partir de 8€ la boîte (10/12 sachets)</p>
            </div>
          </Link>
        </div>

        {/* Section Pourquoi CBD Breton */}
        <div className="cartoon-border mt-10 bg-cream p-8">
          <h2 className="font-display text-3xl text-ink mb-6">
            Pourquoi choisir le CBD breton à {cityData.name} ?
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <h3 className="font-display text-lg text-ink mb-3">🔬 Qualité Certifiée</h3>
              <p className="text-sm text-charcoal leading-relaxed">
                Chaque produit CBD est analysé en laboratoire. THC &lt; 0.3% garantit, conforme à la loi française 2024.
              </p>
            </div>
            <div>
              <h3 className="font-display text-lg text-ink mb-3">🌱 Naturel et Responsable</h3>
              <p className="text-sm text-charcoal leading-relaxed">
                Cultivation sans pesticide ni chimie. Notre CBD breton respecte l'environnement et le terroir.
              </p>
            </div>
            <div>
              <h3 className="font-display text-lg text-ink mb-3">💰 Prix Producteur Direct</h3>
              <p className="text-sm text-charcoal leading-relaxed">
                Circuit court = prix justes. Pas d'intermédiaire, vous achetez directement du producteur breton.
              </p>
            </div>
          </div>
        </div>

        {/* Section Producteur Local */}
        <div className="cartoon-border mt-8 bg-cream p-6">
          <h2 className="font-display text-2xl text-ink mb-4">🌾 Producteur Direct Breton</h2>
          <p className="text-charcoal leading-relaxed mb-4">
            Les Chanvriers Bretons cultivent le chanvre en Bretagne depuis plusieurs années. Nous maîtrisons toute la chaîne 
            de production : de la graine à la livraison chez vous à {cityData.name}.
          </p>
          <p className="text-charcoal leading-relaxed mb-4">
            <strong>Notre philosophie :</strong> Un CBD naturel, honnête et transparent. Pas de marketing, juste du bon chanvre breton 
            cultivé sans pesticide, analysé en laboratoire, et livré rapidement partout en France.
          </p>
          <p className="text-charcoal leading-relaxed">
            Acheter chez Les Chanvriers Bretons, c'est soutenir une agriculture locale responsable et durable en {cityData.department}.
          </p>
        </div>

        {/* Section FAQ */}
        <div className="cartoon-border mt-8 bg-cream p-6">
          <h2 className="font-display text-2xl text-ink mb-4">❓ Vos Questions sur le CBD à {cityData.name}</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-ink mb-2">Le CBD est-il légal à {cityData.name} ?</h3>
              <p className="text-sm text-charcoal">
                Oui ! Notre CBD breton est 100% légal en France 2024. THC &lt; 0.3% certifié laboratoire. 
                Vous pouvez acheter et consommer légalement.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-ink mb-2">Combien de temps pour recevoir ma commande à {cityData.name} ?</h3>
              <p className="text-sm text-charcoal">
                Livraison en 2-3 jours ouvrables en France métropolitaine. Suivi de colis inclus. 
                Discrétion garantie dans l'emballage.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-ink mb-2">Quel produit CBD me convient ?</h3>
              <p className="text-sm text-charcoal">
                <strong>Fleurs :</strong> Pour les amateurs de goût naturel. <strong>Huiles :</strong> Pour le dosage facile et discret. 
                <strong>Résines :</strong> Pour la concentration maximale. <strong>Tisanes :</strong> Pour la relaxation douce.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-ink mb-2">Y a-t-il des effets psychoactifs ?</h3>
              <p className="text-sm text-charcoal">
                Non. Notre CBD contient &lt; 0.3% de THC. Vous ressentirez une relaxation naturelle, pas d'effet "défonce".
              </p>
            </div>
          </div>
        </div>

        {/* CTA Final */}
        <div className="cartoon-border mt-8 bg-yellow p-6 text-center">
          <h2 className="font-display text-2xl text-ink mb-4">Prêt à découvrir le CBD breton ?</h2>
          <p className="text-charcoal mb-6 leading-relaxed">
            Notre boutique est ouverte 24/7. Livraison rapide à {cityData.name}, paiement sécurisé, satisfaction garantie.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              href="/boutique"
              className="btn-cartoon btn-primary inline-flex items-center justify-center px-6 py-3 text-sm uppercase tracking-[0.08em]"
            >
              Voir tous les produits
            </Link>
            <Link
              href="/blog"
              className="btn-cartoon btn-secondary inline-flex items-center justify-center px-6 py-3 text-sm uppercase tracking-[0.08em]"
            >
              Lire nos guides CBD
            </Link>
          </div>
        </div>

        {/* Local SEO Text */}
        <div className="cartoon-border mt-8 bg-cream p-6 text-sm text-charcoal space-y-3">
          <p>
            <strong>CBD naturel livré à {cityData.name}, {cityData.department} :</strong> 
            {" "}Découvrez nos fleurs de CBD breton, huiles naturelles full spectrum, résines pures et tisanes chanvre artisanales. 
            Direct du producteur breton sans pesticide.
          </p>
          <p>
            <strong>Achetez le meilleur CBD en ligne :</strong> 
            {" "}Tous nos produits sont analysés en laboratoire. Livraison rapide en 2-3 jours. Discrétion garantie. 
            Circuit court producteur direct = prix justes et qualité authentique.
          </p>
          <p>
            <strong>Producteur CBD en Bretagne :</strong> 
            {" "}Les Chanvriers Bretons cultivent le chanvre naturellement en Bretagne depuis plusieurs années. 
            Excellence, transparence, responsabilité. Votre confiance est notre priorité.
          </p>
        </div>
      </div>
    </section>
  );
}
