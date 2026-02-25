import type { Metadata } from "next";
import Link from "next/link";
import { CmsPageRenderer } from "@/components/cms/CmsPageRenderer";
import { buildCmsStaticPageMetadata, getStaticCmsPageBySlug } from "@/lib/cms-static-pages";

const CMS_SLUG = "mentions-legales";
const CANONICAL_PATH = "/mentions-legales";
const FALLBACK_TITLE = "Mentions legales";
const FALLBACK_DESCRIPTION =
  "Mentions legales du site Les Chanvriers Bretons conformement a la loi numero 2004-575 du 21 juin 2004.";

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
              <h2 className="font-display text-2xl">Editeur du site</h2>
              <p className="mt-2">
                Nom de l&apos;entreprise : Les Champs Bretons
                <br />
                Gerant : Monsieur Sylvain Gonzalez
                <br />
                Adresse : 60 rue Francois 1er, 75008 Paris
                <br />
                SIRET : 94236899400011
                <br />
                TVA intracommunautaire : FR9094238994
                <br />
                Adresse e-mail : leschanvriersbretons@gmail.com
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Responsable de publication</h2>
              <p className="mt-2">
                Responsable de la publication et webmaster : M. Sylvain Gonzalez
                <br />
                Contact : leschanvriersbretons@gmail.com
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Hebergeur</h2>
              <p className="mt-2">
                O2 Switch
                <br />
                222-224 Boulevard Gustave Flaubert
                <br />
                63000 Clermont-Ferrand
                <br />
                France
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Propriété intellectuelle</h2>
              <p className="mt-2">
                Toute reproduction, representation, modification, publication ou adaptation totale
                ou partielle des elements du site, quel que soit le moyen ou le procede utilise,
                est interdite sans autorisation ecrite prealable a l&apos;adresse :
                leschanvriersbretons@gmail.com.
              </p>
              <p className="mt-2">
                Toute exploitation non autorisée du site ou de l&apos;un quelconque des elements
                qu&apos;il contient sera consideree comme constitutive d&apos;une contrefacon et
                poursuivie conformement aux dispositions des articles L.335-2 et suivants du Code
                de la propriété intellectuelle.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Règlement des litiges</h2>
              <p className="mt-2">
                La Commission europeenne fournit une plateforme de règlement des litiges en ligne
                (ODR), accessible a l&apos;adresse :
                {" "}
                <a
                  href="https://ec.europa.eu/consumers/odr/"
                  className="underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  https://ec.europa.eu/consumers/odr/
                </a>
                .
              </p>
              <p className="mt-2">
                En tant que client, vous avez toujours la possibilite de contacter le conseil
                d&apos;arbitrage de la Commission europeenne. Nous ne sommes ni disposes a, ni
                obliges de, participer a une procedure de règlement des litiges devant un conseil
                d&apos;arbitrage de la consommation.
              </p>
              <p className="mt-2">Contact e-mail : leschanvriersbretons@gmail.com</p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Jeu promotionnel</h2>
              <p className="mt-2">
                Le site peut proposer un jeu promotionnel de type &quot;machine a gratter&quot;.
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


