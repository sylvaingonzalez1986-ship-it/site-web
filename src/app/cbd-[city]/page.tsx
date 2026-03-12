import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { bretonCities, getCityData } from "@/lib/local-seo-data";
import { readPublicStoreByBackend } from "@/lib/data-backend";
import { getSiteUrl } from "@/lib/site-url";

type LocalCityPageProps = {
  params: Promise<{ city: string }>;
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
            Découvrez nos produits CBD naturels et bretons livrés directement à {cityData.name}. Direct producteur 
            en circuit court, sans pesticide, cultivé en Bretagne. Livraison rapide dans toute la France.
          </p>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/boutique/fleurs-cbd"
            className="cartoon-border bg-cream p-6 hover:bg-[#f0fef9] transition-colors"
          >
            <h2 className="font-display text-xl text-ink mb-2">Fleurs CBD</h2>
            <p className="text-sm text-charcoal">
              Fleurs de CBD breton cultivées sans pesticide. Direct producteur à {cityData.name}.
            </p>
          </Link>

          <Link
            href="/boutique/huiles-cbd"
            className="cartoon-border bg-cream p-6 hover:bg-[#f0fef9] transition-colors"
          >
            <h2 className="font-display text-xl text-ink mb-2">Huiles CBD</h2>
            <p className="text-sm text-charcoal">
              Huiles CBD full spectrum et broad spectrum. Livraison rapide à {cityData.name}.
            </p>
          </Link>

          <Link
            href="/boutique/resines-cbd"
            className="cartoon-border bg-cream p-6 hover:bg-[#f0fef9] transition-colors"
          >
            <h2 className="font-display text-xl text-ink mb-2">Résines CBD</h2>
            <p className="text-sm text-charcoal">
              Résines CBD naturelles bretonnes. Circuit court, analyses laboratoire.
            </p>
          </Link>

          <Link
            href="/boutique/e-liquide-cbd"
            className="cartoon-border bg-cream p-6 hover:bg-[#f0fef9] transition-colors"
          >
            <h2 className="font-display text-xl text-ink mb-2">E-liquides CBD</h2>
            <p className="text-sm text-charcoal">
              E-liquides CBD français de qualité. Vapotage CBD naturel à {cityData.name}.
            </p>
          </Link>

          <Link
            href="/boutique/tisane-cbd"
            className="cartoon-border bg-cream p-6 hover:bg-[#f0fef9] transition-colors"
          >
            <h2 className="font-display text-xl text-ink mb-2">Tisanes Chanvre</h2>
            <p className="text-sm text-charcoal">
              Tisanes chanvre artisanales bretonnes. Infusions CBD relaxantes.
            </p>
          </Link>

          <Link
            href="/blog"
            className="cartoon-border bg-cream p-6 hover:bg-[#f0fef9] transition-colors"
          >
            <h2 className="font-display text-xl text-ink mb-2">Notre Blog</h2>
            <p className="text-sm text-charcoal">
              Guides, conseils et actualités sur le CBD naturel breton.
            </p>
          </Link>
        </div>

        <div className="cartoon-border mt-8 bg-cream p-6">
          <h2 className="font-display text-2xl text-ink mb-4">
            Pourquoi choisir le CBD breton à {cityData.name} ?
          </h2>
          <div className="space-y-4 text-charcoal leading-relaxed">
            <p>
              Les Chanvriers Bretons vous proposent un CBD naturel de qualité, cultivé directement en Bretagne 
              sans pesticide. Notre engagement : le circuit court, la transparence et l'excellence.
            </p>
            <p>
              Chaque produit est analysé en laboratoire pour garantir un taux de THC conforme à la réglementation 
              française et un CBD breton authentique. Livraison rapide partout en France, y compris à {cityData.name}.
            </p>
            <p>
              En achetant chez Les Chanvriers Bretons, vous soutenez une production locale responsable et durable.
              Notre CBD breton sans pesticide offre le meilleur du terroir breton.
            </p>
          </div>
        </div>

        <div className="cartoon-border mt-8 bg-cream p-6">
          <h2 className="font-display text-2xl text-ink mb-4">CBD à {cityData.name} en {cityData.department}</h2>
          <p className="text-charcoal leading-relaxed mb-4">
            Nous livrons rapidement votre CBD naturel à {cityData.name} et partout en {cityData.department}. 
            Que vous recherchiez des fleurs de CBD breton, une huile CBD naturelle ou des tisanes chanvre artisanales, 
            découvrez notre boutique en ligne.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Link
              href="/boutique"
              className="pill-cartoon inline-flex items-center justify-center px-4 py-2 text-xs uppercase tracking-[0.08em]"
            >
              Voir la boutique complète
            </Link>
            <Link
              href="/blog"
              className="pill-cartoon inline-flex items-center justify-center px-4 py-2 text-xs uppercase tracking-[0.08em]"
            >
              Lire nos guides
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
