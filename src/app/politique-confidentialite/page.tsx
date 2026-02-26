import type { Metadata } from "next";
import Link from "next/link";
import { CmsPageRenderer } from "@/components/cms/CmsPageRenderer";
import { buildCmsStaticPageMetadata, getStaticCmsPageBySlug } from "@/lib/cms-static-pages";

const CMS_SLUG = "politique-confidentialite";
const CANONICAL_PATH = "/politique-confidentialite";
const FALLBACK_TITLE = "Politique de confidentialite";
const FALLBACK_DESCRIPTION =
  "Politique de confidentialite du site Les Chanvriers Bretons relative a la collecte et au traitement des donnees personnelles.";

export async function generateMetadata(): Promise<Metadata> {
  return buildCmsStaticPageMetadata({
    slug: CMS_SLUG,
    canonicalPath: CANONICAL_PATH,
    fallbackTitle: FALLBACK_TITLE,
    fallbackDescription: FALLBACK_DESCRIPTION,
  });
}

export default async function PolitiqueConfidentialitePage() {
  const cmsPage = await getStaticCmsPageBySlug(CMS_SLUG);
  if (cmsPage) {
    return <CmsPageRenderer page={cmsPage} />;
  }
  return (
    <section className="section-band bg-cream halftone-overlay paper-grain pt-32">
      <div className="retro-container">
        <article className="cartoon-border bg-white p-6 md:p-10">
          <h1 className="section-title">POLITIQUE DE CONFIDENTIALITE</h1>
          <p className="mt-4 text-sm leading-relaxed text-charcoal">
            La presente politique de confidentialite est adaptee au site{" "}
            <a
              href="https://leschanvriersbretons.com"
              className="underline"
              target="_blank"
              rel="noreferrer"
            >
              https://leschanvriersbretons.com
            </a>{" "}
            et decrit la maniere dont les données personnelles sont collectees, utilisees et
            protegees.
          </p>

          <div className="mt-6 grid gap-6 text-sm leading-relaxed text-ink">
            <section>
              <h2 className="font-display text-2xl">Article 1 - Definitions</h2>
              <p className="mt-2">
                Données personnelles : toute information relative a une personne physique
                identifiee ou identifiable.
                <br />
                Site ou Service : le site https://leschanvriersbretons.com et l&apos;ensemble de ses
                pages.
                <br />
                Editeur : SASU Les Champs Bretons, responsable de l&apos;edition et du contenu du Site.
                <br />
                Utilisateur : toute personne qui visite le Site ou utilise ses services.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 2 - Objet de la politique</h2>
              <p className="mt-2">
                Cette politique a pour objet d&apos;informer les Utilisateurs sur les engagements du
                Site concernant le respect de la vie privee et la protection des données
                personnelles.
              </p>
              <p className="mt-2">
                En utilisant le Site et en creant un compte, vous vous engagez a fournir des
                informations exactes et à jour.
              </p>
              <p className="mt-2">
                Vous pouvez exercer vos droits à tout moment (accès, rectification, suppression,
                opposition, limitation) en ecrivant a : leschanvriersbretons@gmail.com.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 3 - Données collectees</h2>
              <p className="mt-2">
                Les données collectees sont principalement celles transmises volontairement via les
                formulaires du Site, notamment lors de la creation du compte, de la connexion, de la
                mise à jour du profil et de la commande : nom, prenom, date de naissance, e-mail,
                telephone, adresse postale et informations liees à la commande.
              </p>
              <p className="mt-2">
                Certaines données techniques peuvent egalement être traitees : adresse IP, journaux
                de sécurité et cookies nécessaires au fonctionnement (par exemple verification d&apos;age
                et maintien de session).
              </p>
              <p className="mt-2">
                Pour les paiements, les transactions sont traitees par Viva Payments. Les données de
                carte bancaire sont collectees et traitees directement par le prestataire de
                paiement selon ses propres conditions.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 4 - Finalites des traitements</h2>
              <p className="mt-2">
                Les données sont traitees pour :
                <br />- gerer les comptes clients et l&apos;authentification,
                <br />- traiter les commandes, paiements, livraisons et factures,
                <br />- assurer le service client,
                <br />- prevenir les abus, la fraude et sécuriser le Site,
                <br />- respecter les obligations legales et comptables.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 5 - Destinataires des données</h2>
              <p className="mt-2">
                Les données sont destinees a l&apos;Editeur et, strictement pour l&apos;execution du
                service, a ses sous-traitants techniques (hebergement, infrastructure applicative,
                paiement).
              </p>
              <p className="mt-2">
                Les données ne sont ni vendues ni cedees à des tiers à des fins commerciales.
              </p>
              <p className="mt-2">
                En cas d&apos;obligation legale, certaines données peuvent être transmises aux autorites
                compétentes.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 6 - Sécurité des données</h2>
              <p className="mt-2">
                Le Site met en oeuvre des mesures techniques et organisationnelles appropriees pour
                proteger les données contre l&apos;accès non autorisé, la perte, l&apos;alteration ou la
                divulgation.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 7 - Duree de conservation</h2>
              <p className="mt-2">
                Les données sont conservees pendant la duree strictement nécessaire aux finalites
                indiquees ci-dessus, puis archivees ou supprimees conformement aux obligations
                legales applicables (notamment comptables et fiscales).
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 8 - Cookies</h2>
              <p className="mt-2">
                Le Site utilise des cookies strictement nécessaires a son fonctionnement. Ces
                cookies ne servent pas à la publicite comportementale.
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[680px] border-collapse text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-[#f4f1ea]">
                      <th className="border border-[#1a1a1a] px-3 py-2 font-semibold">Cookie</th>
                      <th className="border border-[#1a1a1a] px-3 py-2 font-semibold">Finalite</th>
                      <th className="border border-[#1a1a1a] px-3 py-2 font-semibold">Duree</th>
                      <th className="border border-[#1a1a1a] px-3 py-2 font-semibold">
                        Base legale
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-[#1a1a1a] px-3 py-2 font-mono text-[11px]">
                        age_verified
                      </td>
                      <td className="border border-[#1a1a1a] px-3 py-2">
                        Memoriser la verification de majorite (18+).
                      </td>
                      <td className="border border-[#1a1a1a] px-3 py-2">24 heures</td>
                      <td className="border border-[#1a1a1a] px-3 py-2">
                        Interet legitime et obligations legales.
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-[#1a1a1a] px-3 py-2 font-mono text-[11px]">
                        sb-...-auth-token
                      </td>
                      <td className="border border-[#1a1a1a] px-3 py-2">
                        Maintien de session client apres connexion au compte.
                      </td>
                      <td className="border border-[#1a1a1a] px-3 py-2">
                        Session ou duree configurée par le service d&apos;authentification.
                      </td>
                      <td className="border border-[#1a1a1a] px-3 py-2">
                        Execution du contrat (accès au compte).
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-[#1a1a1a] px-3 py-2 font-mono text-[11px]">
                        lcb_admin_session
                      </td>
                      <td className="border border-[#1a1a1a] px-3 py-2">
                        Sécurisation de l&apos;accès a l&apos;interface d&apos;administration.
                      </td>
                      <td className="border border-[#1a1a1a] px-3 py-2">12 heures maximum</td>
                      <td className="border border-[#1a1a1a] px-3 py-2">
                        Interet legitime (sécurité du Site).
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-3">
                Vous pouvez configurer votre navigateur pour bloquer les cookies. Le blocage de
                certains cookies techniques peut toutefois empecher le bon fonctionnement du compte,
                du panier ou de la commande.
              </p>
              <p className="mt-2">
                A ce jour, aucun cookie publicitaire tiers n&apos;est depose par defaut sur le Site.
              </p>
              <p className="mt-2">
                Plus de details sont disponibles sur la page{" "}
                <Link href="/politique-cookies" className="underline">
                  Politique de cookies
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 9 - Exercice de vos droits</h2>
              <p className="mt-2">
                Pour toute question ou demande relative a vos données personnelles :
                <br />
                SASU Les Champs Bretons
                <br />
                60 rue Francois 1er, 75008 Paris, France
                <br />
                E-mail : leschanvriersbretons@gmail.com
              </p>
              <p className="mt-2">
                En cas de desaccord persistant, vous pouvez egalement introduire une réclamation
                aupres de la CNIL.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 10 - Données liees au jeu promotionnel</h2>
              <p className="mt-2">
                Dans le cadre du jeu promotionnel &quot;Ticket de grattage&quot;, le Site traite des données
                nécessaires a l&apos;attribution des tickets et des gains : identifiant client,
                identifiant commande, montant de commande, numero de ticket, résultat de grattage,
                date de grattage et journaux anti-fraude.
              </p>
              <p className="mt-2">
                Ces données sont conservees pour assurer la preuve des operations promotionnelles,
                la prevention des abus et le respect des obligations comptables et legales.
              </p>
              <p className="mt-2">
                Le detail des conditions du jeu est disponible sur la page{" "}
                <Link href="/reglement-jeu-promo" className="underline">
                  Règlement du jeu promotionnel
                </Link>
                .
              </p>
            </section>
          </div>

          <p className="mt-8 text-xs text-charcoal">Tous droits reserves - Fevrier 2026</p>
        </article>
      </div>
    </section>
  );
}


