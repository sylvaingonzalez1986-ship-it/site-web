import type { Metadata } from "next";
import {
  COOKIE_CONSENT_COOKIE_NAME,
  COOKIE_CONSENT_DURATION_LABEL,
} from "@/components/cookies/cookie-consent-config";
import { buildCmsStaticPageMetadata } from "@/lib/cms-static-pages";

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

export default function PolitiqueCookiesPage() {
  return (
    <section className="section-band bg-cream halftone-overlay paper-grain pt-32">
      <div className="retro-container">
        <article className="cartoon-border bg-white p-6 md:p-10">
          <h1 className="section-title">POLITIQUE DE COOKIES</h1>
          <p className="mt-4 break-words text-sm leading-relaxed text-charcoal [overflow-wrap:anywhere]">
            Cette politique explique l&apos;usage des cookies sur le site{" "}
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
              <h2 className="font-display text-2xl">Article 1 - Qu&apos;est-ce qu&apos;un cookie</h2>
              <p className="mt-2">
                Un cookie est un petit fichier texte depose sur votre terminal lors de la visite
                d&apos;un site web. Il permet notamment de conserver des informations utiles au bon
                fonctionnement du service.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 2 - Cookies utilises</h2>
              <p className="mt-2">
                Le site utilise des cookies strictement necessaires et un cookie de preference pour
                memoriser votre choix de consentement. Les categories analytiques et marketing
                restent desactivees tant que vous ne les avez pas acceptees.
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
                      <td className="border border-[#1a1a1a] px-3 py-2 font-mono text-[11px]">age_verified</td>
                      <td className="border border-[#1a1a1a] px-3 py-2">Technique</td>
                      <td className="border border-[#1a1a1a] px-3 py-2">
                        Memoriser la verification de majorite (18+).
                      </td>
                      <td className="border border-[#1a1a1a] px-3 py-2">24 heures</td>
                    </tr>
                    <tr>
                      <td className="border border-[#1a1a1a] px-3 py-2 font-mono text-[11px]">
                        {COOKIE_CONSENT_COOKIE_NAME}
                      </td>
                      <td className="border border-[#1a1a1a] px-3 py-2">Technique</td>
                      <td className="border border-[#1a1a1a] px-3 py-2">
                        Memoriser votre choix de consentement et rouvrir facilement les
                        preferences cookies.
                      </td>
                      <td className="border border-[#1a1a1a] px-3 py-2">
                        {COOKIE_CONSENT_DURATION_LABEL}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-[#1a1a1a] px-3 py-2 font-mono text-[11px]">sb-...-auth-token</td>
                      <td className="border border-[#1a1a1a] px-3 py-2">Technique</td>
                      <td className="border border-[#1a1a1a] px-3 py-2">
                        Maintenir la session du compte client connecte.
                      </td>
                      <td className="border border-[#1a1a1a] px-3 py-2">Session ou duree configuree par l&apos;authentification.</td>
                    </tr>
                    <tr>
                      <td className="border border-[#1a1a1a] px-3 py-2 font-mono text-[11px]">lcb_admin_session</td>
                      <td className="border border-[#1a1a1a] px-3 py-2">Technique</td>
                      <td className="border border-[#1a1a1a] px-3 py-2">
                        Securiser l&apos;acces a l&apos;espace administrateur.
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
                Les cookies techniques sont necessaires au fonctionnement et a la securite du site.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 4 - Gestion des cookies</h2>
              <p className="mt-2">
                Le blocage des cookies techniques via votre navigateur peut limiter l&apos;acces au
                compte, au panier, a l&apos;espace admin ou au processus de commande.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl">Article 5 - Mesure d&apos;audience</h2>
              <p className="mt-2">
                La mesure d&apos;audience est assuree par Vercel Analytics uniquement apres votre
                consentement a la categorie analytique. L&apos;ancien suivi local en base de données
                n&apos;est plus utilise.
              </p>
              <p className="mt-2">
                Vous pouvez accepter, refuser ou personnaliser vos preferences depuis le modal de
                consentement puis les modifier a tout moment via le bouton cookies affiche en bas a
                gauche de l&apos;ecran.
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

          <p className="mt-8 text-xs text-charcoal">Version en vigueur : 13 mars 2026</p>
        </article>
      </div>
    </section>
  );
}
