import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd, WebPageJsonLd } from "@/components/JsonLd";
import { BUSINESS_IDENTITY } from "@/lib/business-identity";
import { getSiteUrl } from "@/lib/site-url";

const LAST_REVIEWED = "2026-08-22";

export const metadata: Metadata = {
  title: "À propos : identité, production et méthode éditoriale",
  description:
    "Qui publie Les Chanvriers Bretons, comment le catalogue distingue production bretonne et partenaires, et comment nos informations sont vérifiées.",
  alternates: {
    canonical: "https://www.leschanvriersbretons.com/a-propos",
  },
  openGraph: {
    title: "À propos des Chanvriers Bretons",
    description:
      "Identité de l'entreprise, traçabilité du catalogue et méthode de vérification des contenus.",
    url: "https://www.leschanvriersbretons.com/a-propos",
    type: "website",
  },
};

export default function AboutPage() {
  const baseUrl = getSiteUrl();
  const pageUrl = `${baseUrl}/a-propos`;

  return (
    <section className="section-band bg-mint halftone-overlay paper-grain pt-32">
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: baseUrl },
          { name: "À propos", url: pageUrl },
        ]}
      />
      <WebPageJsonLd
        name="À propos des Chanvriers Bretons"
        description="Identité de l'entreprise, distinction entre production propre et partenaires, et méthode éditoriale."
        url={pageUrl}
        about={["Les Chanvriers Bretons", "Traçabilité du CBD", "Méthode éditoriale"]}
        dateModified={LAST_REVIEWED}
      />

      <div className="retro-container">
        <article className="cartoon-border bg-cream p-6 md:p-10">
          <nav className="mb-4 text-sm text-charcoal" aria-label="Fil d'Ariane">
            <Link href="/" className="underline hover:text-ink">
              Accueil
            </Link>
            {" > "}
            <span className="font-bold text-ink">À propos</span>
          </nav>

          <h1 className="section-title text-ink">Qui sommes-nous ?</h1>
          <p className="mt-4 max-w-4xl text-lg leading-relaxed text-charcoal">
            Les Chanvriers Bretons est une marque dédiée au chanvre et au CBD. Le site est édité par{" "}
            {BUSINESS_IDENTITY.legalName} et publié sous la responsabilité de {BUSINESS_IDENTITY.president}. Notre
            objectif est de rendre chaque référence compréhensible : qui la produit, d&apos;où elle vient, ce
            qu&apos;elle contient et quelles preuves sont consultables.
          </p>
          <p className="mt-4 text-sm text-charcoal">
            Dernière vérification : <time dateTime={LAST_REVIEWED}>22 août 2026</time>
          </p>

          <dl className="mt-8 grid gap-5 md:grid-cols-2">
            <div className="cartoon-border-sm bg-white p-5">
              <dt className="font-display text-xl text-ink">Marque</dt>
              <dd className="mt-2 text-charcoal">{BUSINESS_IDENTITY.brandName}</dd>
            </div>
            <div className="cartoon-border-sm bg-white p-5">
              <dt className="font-display text-xl text-ink">Éditeur légal</dt>
              <dd className="mt-2 text-charcoal">
                {BUSINESS_IDENTITY.legalName} — SIREN {BUSINESS_IDENTITY.siren} — SIRET {BUSINESS_IDENTITY.siret}
              </dd>
            </div>
            <div className="cartoon-border-sm bg-white p-5">
              <dt className="font-display text-xl text-ink">Responsable de publication</dt>
              <dd className="mt-2 text-charcoal">{BUSINESS_IDENTITY.president}, président</dd>
            </div>
            <div className="cartoon-border-sm bg-white p-5">
              <dt className="font-display text-xl text-ink">Contact éditorial</dt>
              <dd className="mt-2 text-charcoal">
                <a className="underline" href={`mailto:${BUSINESS_IDENTITY.email}`}>
                  {BUSINESS_IDENTITY.email}
                </a>
              </dd>
            </div>
          </dl>
        </article>

        <article className="cartoon-border mt-8 bg-yellow p-6 md:p-10">
          <h2 className="font-display text-3xl text-ink">Identité vérifiable hors de ce site</h2>
          <p className="mt-4 max-w-4xl leading-relaxed text-charcoal">
            Les identifiants légaux, la date de création et le dirigeant peuvent être contrôlés dans des
            registres externes. Ces liens servent de références d&apos;identité pour distinguer la marque{" "}
            Les Chanvriers Bretons de l&apos;éditeur légal {BUSINESS_IDENTITY.legalName}.
          </p>
          <ul className="mt-5 grid gap-4 md:grid-cols-2">
            <li className="cartoon-border-sm bg-white p-5">
              <a
                className="font-bold underline"
                href={BUSINESS_IDENTITY.officialRegistryUrl}
                target="_blank"
                rel="noreferrer"
              >
                Annuaire des entreprises — fiche officielle
              </a>
              <p className="mt-2 text-sm text-charcoal">SIREN {BUSINESS_IDENTITY.siren}, créé le 22 mars 2025.</p>
            </li>
            <li className="cartoon-border-sm bg-white p-5">
              <a
                className="font-bold underline"
                href={BUSINESS_IDENTITY.externalRegistryUrl}
                target="_blank"
                rel="noreferrer"
              >
                Fiche d&apos;entreprise externe
              </a>
              <p className="mt-2 text-sm text-charcoal">Dénomination, SIRET et dirigeant publiquement recoupables.</p>
            </li>
          </ul>
        </article>

        <article className="cartoon-border mt-8 bg-cream p-6 md:p-10">
          <h2 className="font-display text-3xl text-ink">Référencements sectoriels externes</h2>
          <p className="mt-4 max-w-4xl leading-relaxed text-charcoal">
            Des sites tiers mentionnent actuellement Les Chanvriers Bretons ou certaines offres du catalogue.
            Ces références sont indépendantes : elles ne constituent ni un label, ni une certification, ni une
            validation de l&apos;ensemble des produits. Leurs informations peuvent évoluer séparément du site officiel.
          </p>
          <ul className="mt-5 grid gap-4 md:grid-cols-3">
            {BUSINESS_IDENTITY.externalMentions.map((mention) => (
              <li key={mention.url} className="cartoon-border-sm bg-white p-5">
                <a className="font-bold underline" href={mention.url} target="_blank" rel="noreferrer">
                  {mention.name}
                </a>
                <p className="mt-2 text-sm text-charcoal">{mention.description}</p>
              </li>
            ))}
          </ul>
        </article>

        <article className="cartoon-border mt-8 bg-white p-6 md:p-10">
          <h2 className="font-display text-3xl text-ink">Production propre et producteurs partenaires</h2>
          <div className="mt-4 grid gap-4 leading-relaxed text-charcoal">
            <p>
              Le catalogue ne doit pas être lu comme si toutes les références avaient la même origine.
              Les produits rattachés aux Chanvriers Bretons sont présentés comme notre production ou notre
              sélection maison. Les autres portent le nom du producteur partenaire concerné.
            </p>
            <p>
              Pour une information précise, la fiche produit prévaut sur les pages générales. Elle peut
              indiquer l&apos;origine, le mode de culture, la composition, les formats et une analyse de
              laboratoire lorsqu&apos;elle est disponible. Notre guide explique aussi{" "}
              <Link className="underline" href="/analyse-laboratoire-cbd">comment lire ce document</Link>.
              Une certification n&apos;est mentionnée que lorsqu&apos;elle
              est attribuée au produit ou au producteur concerné.
            </p>
            <p>
              Commencez par notre guide <Link className="underline" href="/cbd-naturel">CBD naturel</Link>,
              puis consultez la <Link className="underline" href="/boutique">fiche de la référence</Link> qui
              vous intéresse.
            </p>
          </div>
        </article>

        <article className="cartoon-border mt-8 bg-cream p-6 md:p-10">
          <h2 className="font-display text-3xl text-ink">Notre méthode éditoriale</h2>
          <ul className="mt-5 grid gap-4 text-charcoal md:grid-cols-2">
            <li className="cartoon-border-sm bg-white p-5">
              <strong className="block text-ink">Distinguer faits et termes commerciaux</strong>
              Le mot « naturel » est expliqué comme un terme descriptif, pas comme un label officiel.
            </li>
            <li className="cartoon-border-sm bg-white p-5">
              <strong className="block text-ink">Relier les affirmations aux preuves</strong>
              Nous privilégions l&apos;origine, le producteur, l&apos;étiquette et l&apos;analyse du lot concerné.
            </li>
            <li className="cartoon-border-sm bg-white p-5">
              <strong className="block text-ink">Dater les contenus de référence</strong>
              Les guides sensibles à la réglementation affichent leur date de dernière vérification.
            </li>
            <li className="cartoon-border-sm bg-white p-5">
              <strong className="block text-ink">Éviter les promesses médicales</strong>
              Nos contenus informent sur les produits et les précautions ; ils ne remplacent pas un avis médical.
            </li>
          </ul>

          <div className="mt-6 text-sm leading-relaxed text-charcoal">
            <p>
              Pour les informations générales sur le CBD et sa réglementation, nous citons notamment
              Drogues Info Service et la MILDECA. Pour signaler une erreur ou demander une correction,
              utilisez l&apos;adresse de contact ci-dessus.
            </p>
            <p className="mt-3">
              Les informations juridiques complètes figurent dans les{" "}
              <Link className="underline" href="/mentions-legales">mentions légales</Link>.
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}
