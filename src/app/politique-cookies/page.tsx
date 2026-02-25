import type { Metadata } from "next";
import { CmsPageRenderer } from "@/components/cms/CmsPageRenderer";
import { buildCmsStaticPageMetadata, getStaticCmsPageBySlug } from "@/lib/cms-static-pages";

const CMS_SLUG = "politique-cookies";
const CANONICAL_PATH = "/politique-cookies";
const FALLBACK_TITLE = "Politique de cookies";
const FALLBACK_DESCRIPTION =
  "Politique de cookies du site Les Chanvriers Bretons.";

export async function generateMetadata(): Promise<Metadata> {
  return buildCmsStaticPageMetadata({
    slug: CMS_SLUG,
    canonicalPath: CANONICAL_PATH,
    fallbackTitle: FALLBACK_TITLE,
    fallbackDescription: FALLBACK_DESCRIPTION,
  });
}

export default async function PolitiqueCookiesPage() {
  const cmsPage = await getStaticCmsPageBySlug(CMS_SLUG);
  if (cmsPage) {
    return <CmsPageRenderer page={cmsPage} />;
  }
  return (
    <section className="section-band bg-cream halftone-overlay paper-grain pt-32">
      <div className="retro-container">
        <article className="cartoon-border bg-white p-6 md:p-10">
          <h1 className="section-title">POLITIQUE DE COOKIES</h1>
          <p className="mt-4 break-words text-sm leading-relaxed text-charcoal [overflow-wrap:anywhere]">
            Cette politique explique l&apos;usage des cookies sur le site
            {" "}
            <a
              href="https://leschanvriersbretons.com"
              className="break-all underline"
              target="_blank"
              rel="noreferrer"
            >
              https://leschanvriersbretons.com
            </a>
            .
          </p>

          <div className="mt-6 grid gap-6 break-words text-sm leading-relaxed text-ink [overflow-wrap:anywhere]">
            <section>
              <h2 className="font-display text-2xl">Article 1 - Qu&apos;est-ce qu&apos;un cookie </h2>
              <p className="mt-2">
                Un cookie est un petit fichier texte depose sur votre terminal lors de la visite
                d&apos;un site web. Il permet notamment de conserver des informations utiles au bon
                fonctionnement du service.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 2 - Cookies utilises</h2>
              <p className="mt-2">
                Le site utilise principalement des cookies techniques nécessaires.
              </p>
              <div className="mt-3 max-w-full overflow-x-auto">
                <table className="w-full min-w-[700px] border-collapse text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-[#f4f1ea]">
                      <th className="border border-[#1a1a1a] px-3 py-2 font-semibold">Cookie</th>
                      <th className="border border-[#1a1a1a] px-3 py-2 font-semibold">Type</th>
                      <th className="border border-[#1a1a1a] px-3 py-2 font-semibold">Finalite</th>
                      <th className="border border-[#1a1a1a] px-3 py-2 font-semibold">Duree</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-[#1a1a1a] px-3 py-2 font-mono text-[11px]">
                        age_verified
                      </td>
                      <td className="border border-[#1a1a1a] px-3 py-2">Technique</td>
                      <td className="border border-[#1a1a1a] px-3 py-2">
                        Memoriser la verification de majorite (18+).
                      </td>
                      <td className="border border-[#1a1a1a] px-3 py-2">24 heures</td>
                    </tr>
                    <tr>
                      <td className="border border-[#1a1a1a] px-3 py-2 font-mono text-[11px]">
                        sb-...-auth-token
                      </td>
                      <td className="border border-[#1a1a1a] px-3 py-2">Technique</td>
                      <td className="border border-[#1a1a1a] px-3 py-2">
                        Maintenir la session du compte client connecte.
                      </td>
                      <td className="border border-[#1a1a1a] px-3 py-2">
                        Session ou duree configurée par le service d&apos;authentification.
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-[#1a1a1a] px-3 py-2 font-mono text-[11px]">
                        lcb_admin_session
                      </td>
                      <td className="border border-[#1a1a1a] px-3 py-2">Technique</td>
                      <td className="border border-[#1a1a1a] px-3 py-2">
                        Sécuriser l&apos;accès a l&apos;espace administrateur.
                      </td>
                      <td className="border border-[#1a1a1a] px-3 py-2">12 heures maximum</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 3 - Base legale</h2>
              <p className="mt-2">
                Les cookies techniques utilises sont nécessaires au fonctionnement du site et a la
                sécurité des services. Leur depot repose sur l&apos;interet legitime de l&apos;editeur et,
                selon les cas, sur l&apos;execution du contrat.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 4 - Gestion des cookies</h2>
              <p className="mt-2">
                Vous pouvez configurer votre navigateur pour refuser ou supprimer les cookies.
                Toutefois, le blocage des cookies techniques peut empecher l&apos;accès au compte, au
                panier, a l&apos;espace admin ou au processus de commande.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 5 - Cookies tiers et mesure d&apos;audience</h2>
              <p className="mt-2">
                A ce jour, aucun cookie publicitaire tiers n&apos;est depose par defaut sur le site.
                Si des outils de mesure d&apos;audience non strictement nécessaires sont ajoutes, cette
                politique sera mise à jour et un mecanisme de consentement sera mis en place le cas
                echeant.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 6 - Contact</h2>
              <p className="mt-2">
                Pour toute question relative aux cookies :
                <br />
                <span className="break-all">leschanvriersbretons@gmail.com</span>
              </p>
            </section>
          </div>

          <p className="mt-8 text-xs text-charcoal">Version en vigueur : 21 fevrier 2026</p>
        </article>
      </div>
    </section>
  );
}


