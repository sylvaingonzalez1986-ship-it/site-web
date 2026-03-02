"use client";

import Link from "next/link";
import { Instagram, Mail } from "lucide-react";
import { useMemo, useState } from "react";
import { ContactRequestModal } from "@/components/ContactRequestModal";
import { useCmsPages } from "@/hooks/useCmsPages";
import { useCmsStore } from "@/hooks/useCmsStore";

export function Footer() {
  const { store, loading } = useCmsStore();
  const { pages: cmsPages } = useCmsPages();
  const footer = store.content.footer;
  const [contactOpen, setContactOpen] = useState(false);
  const dynamicFooterLinks = useMemo(() => {
    const staticHrefs = new Set([
      "/mentions-legales",
      "/politique-confidentialite",
      "/politique-cookies",
      "/cgv",
      "/reglement-jeu-promo",
    ]);

    return [...cmsPages]
      .filter((page) => page.showInFooter)
      .sort((a, b) => a.position - b.position)
      .map((page) => ({
        href: `/${page.slug}`,
        label: page.footerLabel.trim() || page.title,
      }))
      .filter((link) => !staticHrefs.has(link.href));
  }, [cmsPages]);

  if (loading) {
    return (
      <footer className="border-t-2 border-[#1a1a1a] bg-yellow py-10 halftone-overlay paper-grain">
        <div className="retro-container">
          <div className="cartoon-border bg-cream p-5 md:p-7" />
        </div>
      </footer>
    );
  }

  return (
    <>
      <footer className="border-t-2 border-[#1a1a1a] bg-yellow py-10 halftone-overlay paper-grain">
        <div className="retro-container">
          <div className="cartoon-border bg-cream p-5 md:p-7">
            <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr_1fr] lg:items-start">
              <div>
                <p className="text-sm font-semibold text-ink">Les Chanvriers Bretons</p>
                <p className="mt-1 text-xs text-charcoal">{footer.copyright}</p>
                <p className="mt-2 text-xs text-charcoal">
                  Nous contacter:{" "}
                  <a
                    href="mailto:leschanvriersbretons@gmail.com"
                    className="font-semibold underline decoration-2 underline-offset-2 hover:text-ink"
                  >
                    leschanvriersbretons@gmail.com
                  </a>
                </p>
                <p className="mt-2 text-xs text-charcoal">
                  CBD naturel, breton et légal.
                </p>

                <div className="mt-4 flex flex-wrap items-stretch gap-3">
                  <button
                    type="button"
                    className="btn-cartoon btn-secondary inline-flex min-h-[44px] w-full items-center justify-center gap-2 px-4 text-center text-xs leading-none sm:w-auto"
                    onClick={() => setContactOpen(true)}
                  >
                    <Mail size={14} /> Nous contacter
                  </button>
                  <Link
                    href="https://www.instagram.com/leschanvriersbretons"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-cartoon btn-secondary inline-flex min-h-[44px] w-full items-center justify-center gap-2 px-4 text-center text-xs leading-none sm:w-auto"
                    aria-label="Instagram"
                  >
                    <Instagram size={14} /> Instagram
                  </Link>
                </div>
              </div>

              <div className="cartoon-border-sm bg-[#f7f4ee] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.09em] text-charcoal">
                  Boutique & Blog
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Link
                    href="/boutique/fleurs-cbd"
                    className="inline-flex min-h-[40px] items-center justify-center border-2 border-[#1a1a1a] bg-white px-3 text-xs font-semibold uppercase tracking-[0.06em] text-ink transition-colors hover:bg-[#e8f7f2]"
                  >
                    Fleurs CBD
                  </Link>
                  <Link
                    href="/boutique/resines-cbd"
                    className="inline-flex min-h-[40px] items-center justify-center border-2 border-[#1a1a1a] bg-white px-3 text-xs font-semibold uppercase tracking-[0.06em] text-ink transition-colors hover:bg-[#e8f7f2]"
                  >
                    Resines CBD
                  </Link>
                  <Link
                    href="/boutique/huiles-cbd"
                    className="inline-flex min-h-[40px] items-center justify-center border-2 border-[#1a1a1a] bg-white px-3 text-xs font-semibold uppercase tracking-[0.06em] text-ink transition-colors hover:bg-[#e8f7f2]"
                  >
                    Huiles CBD
                  </Link>
                  <Link
                    href="/boutique/e-liquide-cbd"
                    className="inline-flex min-h-[40px] items-center justify-center border-2 border-[#1a1a1a] bg-white px-3 text-xs font-semibold uppercase tracking-[0.06em] text-ink transition-colors hover:bg-[#e8f7f2]"
                  >
                    E-liquides CBD
                  </Link>
                  <Link
                    href="/boutique/cosmetiques-cbd"
                    className="inline-flex min-h-[40px] items-center justify-center border-2 border-[#1a1a1a] bg-white px-3 text-xs font-semibold uppercase tracking-[0.06em] text-ink transition-colors hover:bg-[#e8f7f2]"
                  >
                    Cosmetiques CBD
                  </Link>
                  <Link
                    href="/boutique/tisane-cbd"
                    className="inline-flex min-h-[40px] items-center justify-center border-2 border-[#1a1a1a] bg-white px-3 text-xs font-semibold uppercase tracking-[0.06em] text-ink transition-colors hover:bg-[#e8f7f2]"
                  >
                    Tisanes CBD
                  </Link>
                  <Link
                    href="/boutique/miam-cbd"
                    className="inline-flex min-h-[40px] items-center justify-center border-2 border-[#1a1a1a] bg-white px-3 text-xs font-semibold uppercase tracking-[0.06em] text-ink transition-colors hover:bg-[#e8f7f2]"
                  >
                    Miam CBD
                  </Link>
                  <Link
                    href="/blog"
                    className="inline-flex min-h-[40px] items-center justify-center border-2 border-[#1a1a1a] bg-white px-3 text-xs font-semibold uppercase tracking-[0.06em] text-ink transition-colors hover:bg-[#e8f7f2] sm:col-span-2"
                  >
                    Blog CBD
                  </Link>
                </div>
              </div>

              <div className="cartoon-border-sm bg-[#f7f4ee] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.09em] text-charcoal">
                  Informations légales
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Link
                    href="/mentions-legales"
                    className="inline-flex min-h-[40px] items-center justify-center border-2 border-[#1a1a1a] bg-white px-3 text-xs font-semibold uppercase tracking-[0.06em] text-ink transition-colors hover:bg-[#e8f7f2]"
                  >
                    {footer.legalLabel}
                  </Link>
                  <Link
                    href="/politique-confidentialite"
                    className="inline-flex min-h-[40px] items-center justify-center border-2 border-[#1a1a1a] bg-white px-3 text-xs font-semibold uppercase tracking-[0.06em] text-ink transition-colors hover:bg-[#e8f7f2]"
                  >
                    {footer.privacyLabel}
                  </Link>
                  <Link
                    href="/politique-cookies"
                    className="inline-flex min-h-[40px] items-center justify-center border-2 border-[#1a1a1a] bg-white px-3 text-xs font-semibold uppercase tracking-[0.06em] text-ink transition-colors hover:bg-[#e8f7f2]"
                  >
                    Politique cookies
                  </Link>
                  <Link
                    href="/cgv"
                    className="inline-flex min-h-[40px] items-center justify-center border-2 border-[#1a1a1a] bg-white px-3 text-xs font-semibold uppercase tracking-[0.06em] text-ink transition-colors hover:bg-[#e8f7f2]"
                  >
                    CGV
                  </Link>
                  <Link
                    href="/reglement-jeu-promo"
                    className="inline-flex min-h-[40px] items-center justify-center border-2 border-[#1a1a1a] bg-white px-3 text-xs font-semibold uppercase tracking-[0.06em] text-ink transition-colors hover:bg-[#e8f7f2] sm:col-span-2"
                  >
                    Règlement jeu promo
                  </Link>
                  {dynamicFooterLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="inline-flex min-h-[40px] items-center justify-center border-2 border-[#1a1a1a] bg-white px-3 text-xs font-semibold uppercase tracking-[0.06em] text-ink transition-colors hover:bg-[#e8f7f2] sm:col-span-2"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>

      <ContactRequestModal open={contactOpen} onClose={() => setContactOpen(false)} />
    </>
  );
}
