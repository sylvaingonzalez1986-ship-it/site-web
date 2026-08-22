import type { Metadata } from "next";
import { CmsPageRenderer } from "@/components/cms/CmsPageRenderer";
import { BUSINESS_IDENTITY } from "@/lib/business-identity";
import { buildCmsStaticPageMetadata, getStaticCmsPageBySlug } from "@/lib/cms-static-pages";

const CMS_SLUG = "reglement-jeu-promo";
const CANONICAL_PATH = "/reglement-jeu-promo";
const FALLBACK_TITLE = "Règlement jeu promotionnel";
const FALLBACK_DESCRIPTION =
  "Règlement officiel du jeu promotionnel Booster Pack des Chanvriers Bretons.";

export async function generateMetadata(): Promise<Metadata> {
  return buildCmsStaticPageMetadata({
    slug: CMS_SLUG,
    canonicalPath: CANONICAL_PATH,
    fallbackTitle: FALLBACK_TITLE,
    fallbackDescription: FALLBACK_DESCRIPTION,
  });
}

export default async function ReglementJeuPromoPage() {
  const cmsPage = await getStaticCmsPageBySlug(CMS_SLUG);
  if (cmsPage) {
    return <CmsPageRenderer page={cmsPage} />;
  }
  return (
    <section className="section-band bg-cream halftone-overlay paper-grain pt-32">
      <div className="retro-container">
        <article className="cartoon-border bg-white p-6 md:p-10">
          <h1 className="section-title">REGLEMENT DU JEU PROMOTIONNEL</h1>
          <p className="mt-4 text-sm leading-relaxed text-charcoal">
            Jeu promotionnel &quot;Booster Pack&quot; organise par {BUSINESS_IDENTITY.legalName}.
          </p>

          <div className="mt-6 grid gap-6 text-sm leading-relaxed text-ink">
            <section>
              <h2 className="font-display text-2xl">Article 1 - Organisateur</h2>
              <p className="mt-2">
                SASU {BUSINESS_IDENTITY.legalName} - SIRET {BUSINESS_IDENTITY.siret} - TVA intracommunautaire{" "}
                {BUSINESS_IDENTITY.vatNumber}
                <br />
                {BUSINESS_IDENTITY.address.streetAddress}, {BUSINESS_IDENTITY.address.postalCode}{" "}
                {BUSINESS_IDENTITY.address.addressLocality}, France
                <br />
                Contact : {BUSINESS_IDENTITY.email}
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 2 - Duree</h2>
              <p className="mt-2">
                Le jeu debute le 1er mars 2026 a 00h00 (heure de Paris) pour une duree
                indeterminee, jusqu&apos;a modification, suspension ou arret par l&apos;Organisateur.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 3 - Conditions de participation</h2>
              <p className="mt-2">
                Le jeu est reserve aux personnes majeures (18+) disposant d&apos;un compte client valide
                sur le site et d&apos;une commande payee.
              </p>
              <p className="mt-2">
                Une verification de majorite est requise. L&apos;Organisateur peut annuler toute
                participation frauduleuse (multi-comptes, usurpation, automatisation, abus).
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 4 - Mecanique</h2>
              <p className="mt-2">
                Attribution automatique : 1 pack par tranche de depense affichee dans l&apos;espace
                client, dans la limite de packs configuree pour une commande payee.
              </p>
              <p className="mt-2">
                Chaque pack est ouvrable une seule fois. Les 3 cartes revelees sont determinees
                cote serveur au moment de l&apos;ouverture.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 5 - Probabilites</h2>
              <p className="mt-2">
                Repartition globale des cartes selon la configuration de collection active :
                commune, silver, gold, epique et legendaire.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 6 - Lots</h2>
              <p className="mt-2">
                Les cartes revelees enrichissent la collection TCG du participant. Les avantages
                promotionnels, lots eventuels et modalites d&apos;utilisation associes a certaines
                cartes ou recompenses sont ceux affiches dans l&apos;espace client et/ou dans le
                panier au moment de leur utilisation.
              </p>
              <p className="mt-2">
                La recompense legendaire correspond a 12 bons d&apos;achat de 50 euros, emis a raison
                d&apos;un bon par mois pendant 12 mois, valables sur l&apos;ensemble de la boutique. Les
                frais de port restent a la charge du gagnant.
              </p>
              <p className="mt-2">
                Les lots ne sont ni echangeables contre especes, ni cessibles. Delai de remise :
                30 jours maximum sauf force majeure.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 7 - Limites et anti-fraude</h2>
              <p className="mt-2">
                Les packs sont personnels. L&apos;Organisateur peut suspendre ou annuler tout gain en
                cas de comportement frauduleux ou contraire au present reglement.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 8 - Donnees personnelles</h2>
              <p className="mt-2">
                Les donnees du jeu sont traitees pour la gestion des packs, l&apos;attribution des
                gains, la prevention de la fraude et la preuve des operations.
              </p>
              <p className="mt-2">
                Pour en savoir plus : consultez la politique de confidentialite du site.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 9 - Responsabilite</h2>
              <p className="mt-2">
                L&apos;Organisateur ne peut etre tenu responsable en cas d&apos;incident technique,
                indisponibilite temporaire du service ou force majeure.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 10 - Litiges et mediation</h2>
              <p className="mt-2">
                Le present reglement est soumis au droit francais. Toute reclamation doit etre
                adressee en priorite a leschanvriersbretons@gmail.com.
              </p>
              <p className="mt-2">
                A defaut d&apos;accord amiable, le consommateur peut recourir a un mediateur de la
                consommation conformement aux dispositions du Code de la consommation.
              </p>
              <p className="mt-2">
                Pour les professionnels, tribunal de commerce de Paris competent.
              </p>
            </section>
          </div>

          <p className="mt-8 text-xs text-charcoal">Version en vigueur : 4 mars 2026</p>
        </article>
      </div>
    </section>
  );
}
