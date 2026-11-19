import type { Metadata } from "next";
import Link from "@/components/navigation/NavigationLink";
import { BreadcrumbJsonLd, WebPageJsonLd } from "@/components/JsonLd";
import { BUSINESS_IDENTITY } from "@/lib/business-identity";
import { readPublicStoreByBackend } from "@/lib/data-backend";
import { isOwnProduct } from "@/lib/own-producer";
import { normalizeAnalysisUrl } from "@/lib/product-analysis-url";
import { isProductInStock } from "@/lib/product-stock";
import { getSiteUrl } from "@/lib/site-url";

const LAST_REVIEWED = "2026-11-19";

export const metadata: Metadata = {
  title: "Sylvain, producteur de chanvre en Ille-et-Vilaine",
  description:
    "Rencontrez Sylvain, producteur de chanvre en Ille-et-Vilaine, découvrez sa récolte et retrouvez les producteurs partenaires des Chanvriers Bretons.",
  alternates: {
    canonical: "https://www.leschanvriersbretons.com/a-propos",
  },
  openGraph: {
    title: "Sylvain et la ferme des Chanvriers Bretons",
    description:
      "La culture du chanvre en Ille-et-Vilaine, les récoltes de la ferme et les producteurs partenaires.",
    url: "https://www.leschanvriersbretons.com/a-propos",
    type: "website",
  },
};

export default async function AboutPage() {
  const baseUrl = getSiteUrl();
  const pageUrl = `${baseUrl}/a-propos`;
  const { products } = await readPublicStoreByBackend();
  const ownFlowers = products.filter((product) => product.category === "fleurs" && isOwnProduct(product));
  const availableFlower = ownFlowers.find(isProductInStock);
  const documentedFlower = ownFlowers.find((product) => normalizeAnalysisUrl(product.analysisPdf));

  return (
    <section className="section-band bg-mint halftone-overlay paper-grain pt-32">
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: baseUrl },
          { name: "À propos", url: pageUrl },
        ]}
      />
      <WebPageJsonLd
        name="Sylvain et la ferme des Chanvriers Bretons"
        description="La culture du chanvre en Ille-et-Vilaine, les récoltes de la ferme et les producteurs partenaires."
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

          <h1 className="section-title text-ink">Sylvain, producteur de chanvre en Ille-et-Vilaine</h1>
          <p className="mt-4 max-w-4xl text-lg leading-relaxed text-charcoal">
            Moi, c&apos;est Sylvain. Je cultive du chanvre en Ille-et-Vilaine, en Bretagne. Au Marché, vous
            trouverez des fleurs de notre récolte et des fleurs choisies chez d&apos;autres producteurs. Sur la
            fiche, vous pouvez voir qui les a cultivées et quelles informations sont disponibles sur le lot.
          </p>
          <p className="mt-4 text-sm text-charcoal">
            Présentation de la ferme mise à jour le <time dateTime={LAST_REVIEWED}>19 novembre 2026</time>
          </p>
          <Link href="#notre-ferme" className="mt-4 inline-block text-sm font-bold text-ink underline underline-offset-4">Notre ferme et nos partenaires</Link>

          <dl className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
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
                <a className="underline [overflow-wrap:anywhere]" href={`mailto:${BUSINESS_IDENTITY.email}`}>
                  {BUSINESS_IDENTITY.email}
                </a>
              </dd>
            </div>
          </dl>
        </article>

        <article id="notre-ferme" className="cartoon-border mt-8 scroll-mt-28 bg-white p-6 md:p-10">
          <h2 className="font-display text-3xl text-ink">Notre ferme et les producteurs partenaires</h2>
          <div className="mt-4 grid gap-4 leading-relaxed text-charcoal">
            <p>
              On cultive du chanvre en Bretagne. Quand une fiche indique que la fleur vient de notre récolte,
              vous achetez directement au producteur. Vous trouverez aussi des références sous notre nom qui
              relèvent de la sélection maison.
            </p>
            <p>
              On choisit aussi des fleurs chez des collègues. Au Marché, ouvrez « Par région » pour découvrir
              les producteurs, ou partez d&apos;une fiche pour voir qui a fourni la fleur. On prépare les commandes
              en Bretagne, quel que soit le lieu de culture de la fleur.
            </p>
            <p>
              Sur chaque fiche, lisez les informations déclarées sur la culture et la composition. Si un
              rapport est publié, cherchez le numéro du lot. S&apos;il manque, demandez-nous de confirmer la correspondance avec votre sachet.
            </p>
          </div>
          <nav aria-label="Découvrir les producteurs et les lots" className="mt-5 flex flex-wrap gap-3">
            {availableFlower && <Link href={`/boutique/fleurs-cbd/${availableFlower.id}`} className="btn-cartoon btn-primary px-5 py-3 text-sm">Voir {availableFlower.name}, une fleur maison en stock</Link>}
            {documentedFlower && documentedFlower.id !== availableFlower?.id && <Link href={`/boutique/fleurs-cbd/${documentedFlower.id}`} className="btn-cartoon btn-secondary px-5 py-3 text-sm">Voir {documentedFlower.name} et son analyse</Link>}
            <Link href="/boutique#producteurs" className="btn-cartoon btn-primary px-5 py-3 text-sm">Découvrir les producteurs au Marché</Link>
            <Link href="/boutique/fleurs-cbd" className="btn-cartoon btn-secondary px-5 py-3 text-sm">Voir les fleurs et les formats</Link>
            <Link href="/cbd-naturel#cbd-naturel-en-bref" className="px-3 py-3 text-sm font-bold text-ink underline underline-offset-4">Vérifier l’origine et le lot</Link>
          </nav>
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
