import type { Metadata } from "next";
import { BUSINESS_IDENTITY } from "@/lib/business-identity";
import Link from "next/link";
import { CmsPageRenderer } from "@/components/cms/CmsPageRenderer";
import { buildCmsStaticPageMetadata, getStaticCmsPageBySlug } from "@/lib/cms-static-pages";

const CMS_SLUG = "mentions-legales";
const CANONICAL_PATH = "/mentions-legales";
const FALLBACK_TITLE = "Mentions légales";
const FALLBACK_DESCRIPTION =
  "Mentions légales du site Les Chanvriers Bretons conformément à la loi numéro 2004-575 du 21 juin 2004.";

export async function generateMetadata(): Promise<Metadata> {
  return buildCmsStaticPageMetadata({
    slug: CMS_SLUG,
    canonicalPath: CANONICAL_PATH,
    fallbackTitle: FALLBACK_TITLE,
    fallbackDescription: FALLBACK_DESCRIPTION,
  });
}

export default async function MentionsLegalesPage() {
  const cmsPage = await getStaticCmsPageBySlug(CMS_SLUG);
  if (cmsPage) {
    return <CmsPageRenderer page={cmsPage} />;
  }
  return (
    <section className="section-band bg-cream halftone-overlay paper-grain pt-32">
      <div className="retro-container">
        <article className="cartoon-border bg-white p-6 md:p-10">
          <h1 className="section-title">MENTIONS LEGALES</h1>
          <p className="mt-4 text-sm text-charcoal">
            Conformement aux dispositions des articles 6-III et 19 de la Loi numero 2004-575 du 21
            juin 2004 pour la Confiance dans l&apos;economie numerique (L.C.E.N.), les informations
            suivantes sont portees à la connaissance des utilisateurs du site{" "}
            <a
              href="https://www.leschanvriersbretons.com"
              className="underline"
              target="_blank"
              rel="noreferrer"
            >
              www.leschanvriersbretons.com
            </a>
            .
          </p>

          <div className="mt-6 grid gap-6 text-sm leading-relaxed text-ink">
            <section>
              <h2 className="font-display text-2xl">Éditeur du site</h2>
              <p className="mt-2">
                Nom de l&apos;entreprise : {BUSINESS_IDENTITY.legalName}
                <br />
                Président : Monsieur {BUSINESS_IDENTITY.president}
                <br />
                Adresse : {BUSINESS_IDENTITY.address.streetAddress}, {BUSINESS_IDENTITY.address.postalCode}{" "}
                {BUSINESS_IDENTITY.address.addressLocality}
                <br />
                SIREN : {BUSINESS_IDENTITY.siren}
                <br />
                SIRET : {BUSINESS_IDENTITY.siret}
                <br />
                TVA intracommunautaire : {BUSINESS_IDENTITY.vatNumber}
                <br />
                Adresse e-mail : {BUSINESS_IDENTITY.email}
                <br />
                <a
                  className="underline"
                  href={BUSINESS_IDENTITY.officialRegistryUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Vérifier l&apos;immatriculation sur l&apos;Annuaire des entreprises
                </a>
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Responsable de publication</h2>
              <p className="mt-2">
                Responsable de la publication et webmaster : M. {BUSINESS_IDENTITY.president}
                <br />
                Contact : {BUSINESS_IDENTITY.email}
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Hébergeur</h2>
              <p className="mt-2">
                Vercel Inc.
                <br />
                440 N Barranca Avenue #4133
                <br />
                Covina, CA 91723
                <br />
                États-Unis
                <br />
                <a className="underline" href="https://vercel.com" target="_blank" rel="noreferrer">
                  vercel.com
                </a>
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Propriété intellectuelle</h2>
              <p className="mt-2">
                Toute reproduction, representation, modification, publication ou adaptation totale
                ou partielle des elements du site, quel que soit le moyen ou le procede utilise,
                est interdite sans autorisation ecrite prealable a l&apos;adresse :
                {" "}{BUSINESS_IDENTITY.email}.
              </p>
              <p className="mt-2">
                Toute exploitation non autorisée du site ou de l&apos;un quelconque des elements
                qu&apos;il contient sera consideree comme constitutive d&apos;une contrefacon et
                poursuivie conformement aux dispositions des articles L.335-2 et suivants du Code
                de la propriété intellectuelle.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Réclamations et règlement des litiges</h2>
              <p className="mt-2">
                Pour toute réclamation, contactez d&apos;abord {BUSINESS_IDENTITY.email} afin de rechercher
                une solution amiable.
              </p>
              <p className="mt-2">
                La plateforme européenne de règlement en ligne des litiges (ODR) a été supprimée le 20
                juillet 2025. Les informations actuelles sur les voies de recours et les organismes de
                règlement extrajudiciaire sont publiées par la Commission européenne :{" "}
                <a
                  href="https://consumer-redress.ec.europa.eu/index_fr"
                  className="underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Recours des consommateurs dans l&apos;Union européenne
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Jeu promotionnel</h2>
              <p className="mt-2">
                Le site peut proposer un jeu promotionnel de type &quot;booster pack&quot;.
              </p>
              <p className="mt-2">
                Les conditions de participation, la liste des lots et les modalites d&apos;attribution
                sont decrites dans le{" "}
                <Link href="/reglement-jeu-promo" className="underline">
                  Règlement du jeu promotionnel
                </Link>
                .
              </p>
            </section>
          </div>
        </article>
      </div>
    </section>
  );
}


