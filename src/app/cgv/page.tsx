import type { Metadata } from "next";
import Link from "next/link";
import { CmsPageRenderer } from "@/components/cms/CmsPageRenderer";
import { buildCmsStaticPageMetadata, getStaticCmsPageBySlug } from "@/lib/cms-static-pages";

const CMS_SLUG = "cgv";
const CANONICAL_PATH = "/cgv";
const FALLBACK_TITLE = "CGV";
const FALLBACK_DESCRIPTION =
  "Conditions generales de vente (CGV) du site Les Chanvriers Bretons.";

export async function generateMetadata(): Promise<Metadata> {
  return buildCmsStaticPageMetadata({
    slug: CMS_SLUG,
    canonicalPath: CANONICAL_PATH,
    fallbackTitle: FALLBACK_TITLE,
    fallbackDescription: FALLBACK_DESCRIPTION,
  });
}

export default async function CgvPage() {
  const cmsPage = await getStaticCmsPageBySlug(CMS_SLUG);
  if (cmsPage) {
    return <CmsPageRenderer page={cmsPage} />;
  }
  return (
    <section className="section-band bg-cream halftone-overlay paper-grain pt-32">
      <div className="retro-container">
        <article className="cartoon-border bg-white p-6 md:p-10">
          <h1 className="section-title">CONDITIONS GENERALES DE VENTE (CGV)</h1>
          <p className="mt-4 text-sm leading-relaxed text-charcoal">
            Les presentes conditions generales de vente (CGV) regissent les relations entre la
            société Les Champs Bretons, SASU immatriculee au RCS de Paris, et toute personne
            effectuant un achat sur le site{" "}
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
              <h2 className="font-display text-2xl">Article 1 - Preambule</h2>
              <p className="mt-2">
                Toute commande passee sur le site implique l&apos;acceptation sans reserve des
                presentes CGV.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 2 - Produits</h2>
              <p className="mt-2">
                Les produits commercialises comprennent notamment des fleurs de CBD, macerats,
                infusions et autres produits derives du chanvre.
              </p>
              <p className="mt-2">
                Les produits commercialises respectent la legislation en vigueur en France et
                affichent un taux de THC inférieur a 0,3 %, conformement à la réglementation
                applicable.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 3 - Prix et paiement</h2>
              <p className="mt-2">
                Les prix affiches sur le site sont exprimes en euros, toutes taxes comprises (TTC),
                hors frais de livraison.
              </p>
              <p className="mt-2">
                Le paiement s&apos;effectue via les moyens de paiement securises proposes sur le site,
                notamment par carte bancaire via Viva Payments.
              </p>
              <p className="mt-2">
                Les Champs Bretons se reserve le droit de modifier ses prix à tout moment, et les
                produits sont factures sur la base du tarif en vigueur au moment de la validation de
                la commande.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 4 - Commande</h2>
              <p className="mt-2">
                Toute commande est consideree validee une fois le paiement accepte.
              </p>
              <p className="mt-2">
                Le client recoit un e-mail de confirmation de commande.
              </p>
              <p className="mt-2">
                Les Champs Bretons se reserve le droit de refuser une commande en cas de litige
                anterieur, de suspicion de fraude ou de non-respect des presentes CGV.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 5 - Livraison</h2>
              <p className="mt-2">
                Les produits sont expedies dans un delai indicatif de 3 jours ouvres apres
                confirmation du paiement.
              </p>
              <p className="mt-2">
                Les livraisons sont effectuees en France metropolitaine et, le cas echeant, dans
                certains pays europeens selon les modalites affichees sur le site.
              </p>
              <p className="mt-2">
                Les delais de livraison sont indicatifs et un retard imputable au transporteur ne
                saurait engager la responsabilite de Les Champs Bretons.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 6 - Droit de retraction</h2>
              <p className="mt-2">
                Conformement a l&apos;article L.221-18 du Code de la consommation, le client dispose
                d&apos;un delai de 14 jours a compter de la reception de sa commande pour exercer son
                droit de retraction.
              </p>
              <p className="mt-2">
                Les produits doivent être retournes dans leur etat d&apos;origine, non ouverts et non
                utilises. Les frais de retour sont à la charge du client.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 7 - Responsabilite et garantie</h2>
              <p className="mt-2">
                Les produits proposes respectent la réglementation en vigueur. Les Champs Bretons ne
                saurait être tenu responsable d&apos;une mauvaise utilisation des produits.
              </p>
              <p className="mt-2">
                Aucune réclamation ne pourra être acceptee si les produits ont été ouverts, utilises
                ou endommages apres la livraison.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 8 - Propriété intellectuelle</h2>
              <p className="mt-2">
                Tous les elements du site leschanvriersbretons.com, notamment textes, images et
                graphismes, sont protégés par le droit d&apos;auteur et la propriété intellectuelle.
              </p>
              <p className="mt-2">
                Toute reproduction, meme partielle, est strictement interdite sans autorisation
                prealable.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 9 - Données personnelles</h2>
              <p className="mt-2">
                Les informations collectees sont utilisees uniquement pour la gestion des commandes
                et du service client. Elles ne sont ni revendues ni communiquees à des tiers a des
                fins commerciales.
              </p>
              <p className="mt-2">
                Le client dispose d&apos;un droit d&apos;accès, de rectification et de suppression de ses
                données conformement au RGPD. Les details sont disponibles sur la page{" "}
                <Link href="/politique-confidentialite" className="underline">
                  Politique de confidentialite
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 10 - Droit applicable et litiges</h2>
              <p className="mt-2">
                Les presentes CGV sont regies par le droit français.
              </p>
              <p className="mt-2">
                En cas de litige, une solution amiable sera privilegiee. A defaut d&apos;accord, les
                tribunaux compétents seront ceux du ressort du siège social de Les Champs Bretons.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 11 - Majorite legale</h2>
              <p className="mt-2">
                La creation de compte et la commande sur le site sont réservées aux personnes
                majeures (18 ans et plus).
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 12 - Jeu promotionnel</h2>
              <p className="mt-2">
                Le site peut proposer un jeu promotionnel de type booster pack reserve aux
                personnes majeures. Les conditions de participation, les probabilites et les
                modalites d&apos;attribution des lots sont detaillees dans le{" "}
                <Link href="/reglement-jeu-promo" className="underline">
                  Règlement du jeu promotionnel
                </Link>
                .
              </p>
              <p className="mt-2">
                Les lots et avantages attribués au titre du jeu ne sont pas convertibles en
                especes, sauf mention contraire expresse dans le règlement.
              </p>
            </section>
          </div>

          <p className="mt-8 text-xs text-charcoal">Version en vigueur : 21 fevrier 2026</p>
        </article>
      </div>
    </section>
  );
}


