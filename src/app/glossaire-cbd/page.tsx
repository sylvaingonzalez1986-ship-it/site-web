import type { Metadata } from "next";
import Link from "next/link";
import {
  ArticleJsonLd,
  BreadcrumbJsonLd,
  DefinedTermSetJsonLd,
  WebPageJsonLd,
} from "@/components/JsonLd";
import {
  CBD_GLOSSARY_ENTRIES,
  CBD_GLOSSARY_LAST_REVIEWED,
  CBD_GLOSSARY_SOURCES,
} from "@/lib/cbd-glossary";
import { getSiteUrl } from "@/lib/site-url";

const PAGE_SLUG = "glossaire-cbd";
const FIRST_PUBLISHED = "2026-08-23";

const pageTitle = "Glossaire du CBD : 15 définitions vérifiables";
const pageDescription =
  "CBD naturel, THC, cannabinoïdes, full spectrum, isolat, analyse de laboratoire et Novel Food : définitions courtes, contrôles pratiques et sources publiques.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: {
    canonical: `https://www.leschanvriersbretons.com/${PAGE_SLUG}`,
  },
  openGraph: {
    title: `${pageTitle} | Les Chanvriers Bretons`,
    description: pageDescription,
    url: `https://www.leschanvriersbretons.com/${PAGE_SLUG}`,
    type: "article",
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "Glossaire du CBD et du chanvre",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
    images: ["/og-default.png"],
  },
};

export default async function CbdGlossaryPage() {
  const baseUrl = getSiteUrl();
  const pageUrl = `${baseUrl}/${PAGE_SLUG}`;
  const sources = Object.values(CBD_GLOSSARY_SOURCES);

  return (
    <section className="section-band bg-mint halftone-overlay paper-grain pt-32">
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: baseUrl },
          { name: "Glossaire du CBD", url: pageUrl },
        ]}
      />
      <WebPageJsonLd
        name={pageTitle}
        description={pageDescription}
        url={pageUrl}
        about={["CBD", "CBD naturel", "Chanvre", "Cannabinoïdes", "Analyse CBD"]}
        dateModified={CBD_GLOSSARY_LAST_REVIEWED}
      />
      <ArticleJsonLd
        title={pageTitle}
        description={pageDescription}
        url={pageUrl}
        image={`${baseUrl}/og-default.png`}
        datePublished={FIRST_PUBLISHED}
        dateModified={CBD_GLOSSARY_LAST_REVIEWED}
        category="Glossaire CBD et chanvre"
        about={CBD_GLOSSARY_ENTRIES.map(({ term }) => term)}
        citations={sources}
      />
      <DefinedTermSetJsonLd
        name="Glossaire du CBD et du chanvre"
        description={pageDescription}
        url={pageUrl}
        terms={CBD_GLOSSARY_ENTRIES.map((entry) => ({
          name: entry.term,
          description: entry.definition,
          anchor: entry.slug,
          aliases: entry.aliases,
        }))}
      />

      <div className="retro-container">
        <div className="cartoon-border bg-cream p-8">
          <nav className="mb-4 text-sm text-charcoal" aria-label="Fil d'Ariane">
            <Link href="/" className="underline hover:text-ink">Accueil</Link>
            {" > "}
            <span className="font-bold text-ink">Glossaire du CBD</span>
          </nav>
          <h1 className="section-title text-ink">Glossaire du CBD</h1>
          <p className="mt-4 max-w-4xl text-lg leading-relaxed text-charcoal">
            Quinze définitions courtes pour interpréter une fiche CBD sans confondre origine végétale,
            certification, composition et résultat d’analyse. Chaque entrée indique aussi le contrôle concret
            à effectuer avant de comparer deux produits.
          </p>
          <p className="mt-4 text-sm text-charcoal">
            Contenu publié par <Link href="/a-propos" className="underline hover:text-ink">Les Chanvriers Bretons</Link>
            {" · "}<time dateTime={CBD_GLOSSARY_LAST_REVIEWED}>Vérifié le 23 août 2026</time>
          </p>
        </div>

        <div className="cartoon-border mt-8 bg-white p-8" aria-labelledby="utiliser-glossaire">
          <h2 id="utiliser-glossaire" className="mb-4 text-3xl font-display text-ink">
            Comment utiliser ce glossaire ?
          </h2>
          <p className="max-w-4xl leading-relaxed text-charcoal">
            Une définition décrit un terme ; elle ne valide pas un produit. Pour une référence précise,
            rapprochez toujours la fiche, l’étiquette, le numéro de lot et le rapport de laboratoire disponible.
            Les appellations commerciales comme « naturel », « full spectrum » ou « broad spectrum » doivent
            être confirmées par des informations mesurables.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/cbd-naturel" className="btn-cartoon btn-secondary px-5 py-3 text-sm">
              Guide CBD naturel
            </Link>
            <Link href="/analyse-laboratoire-cbd" className="btn-cartoon btn-secondary px-5 py-3 text-sm">
              Lire une analyse CBD
            </Link>
            <Link href="/cbd-breton" className="btn-cartoon btn-secondary px-5 py-3 text-sm">
              Vérifier une origine bretonne
            </Link>
          </div>
        </div>

        <nav className="cartoon-border mt-8 bg-cream p-6" aria-label="Index du glossaire CBD">
          <h2 className="mb-4 text-2xl font-display text-ink">Accès direct aux définitions</h2>
          <ul className="flex flex-wrap gap-2">
            {CBD_GLOSSARY_ENTRIES.map((entry) => (
              <li key={entry.slug}>
                <a
                  href={`#${entry.slug}`}
                  className="pill-cartoon inline-flex px-4 py-2 text-xs uppercase tracking-[0.06em]"
                >
                  {entry.term}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-8 grid gap-6">
          {CBD_GLOSSARY_ENTRIES.map((entry, index) => (
            <article
              key={entry.slug}
              id={entry.slug}
              className="cartoon-border scroll-mt-28 bg-cream p-6 md:p-8"
            >
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-charcoal">
                Définition {String(index + 1).padStart(2, "0")}
              </p>
              <h2 className="mt-2 text-3xl font-display text-ink">
                <dfn className="not-italic">{entry.term}</dfn>
              </h2>
              {entry.aliases && entry.aliases.length > 0 && (
                <p className="mt-2 text-sm text-charcoal">
                  Aussi appelé : {entry.aliases.join(", ")}.
                </p>
              )}
              <p className="mt-4 max-w-4xl leading-relaxed text-charcoal">{entry.definition}</p>
              <div className="cartoon-border-sm mt-5 bg-white p-4">
                <h3 className="font-bold text-ink">Contrôle pratique</h3>
                <p className="mt-1 text-sm leading-relaxed text-charcoal">{entry.practicalCheck}</p>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-charcoal">
                <span className="font-bold text-ink">Sources :</span>
                {entry.sourceIds.map((sourceId) => {
                  const source = CBD_GLOSSARY_SOURCES[sourceId];
                  return (
                    <a
                      key={sourceId}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-ink"
                    >
                      {source.name}
                    </a>
                  );
                })}
              </div>
              {entry.relatedHref && entry.relatedLabel && (
                <p className="mt-4 text-sm">
                  <Link href={entry.relatedHref} className="font-bold underline hover:text-ink">
                    {entry.relatedLabel}
                  </Link>
                </p>
              )}
            </article>
          ))}
        </div>

        <div className="cartoon-border mt-8 bg-white p-8">
          <h2 className="mb-4 text-2xl font-display text-ink">Sources publiques principales</h2>
          <p className="max-w-4xl text-sm leading-relaxed text-charcoal">
            Les règles et connaissances peuvent évoluer. Les liens ci-dessous permettent de revenir aux
            publications publiques utilisées pour cette révision éditoriale.
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-charcoal">
            {sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">
                  {source.name}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="cartoon-border mt-8 bg-yellow p-6 text-center">
          <h2 className="text-2xl font-display text-ink">Passer des définitions aux preuves</h2>
          <p className="mx-auto mt-2 max-w-3xl text-charcoal">
            Consultez ensuite les fiches réellement publiées pour comparer origine, composition, producteur et
            analyse disponible, sans déduire une qualité du seul nom commercial.
          </p>
          <Link href="/boutique" className="btn-cartoon btn-primary mt-5 inline-flex px-6 py-3 text-sm uppercase tracking-[0.08em]">
            Voir le catalogue actuel
          </Link>
        </div>
      </div>
    </section>
  );
}
