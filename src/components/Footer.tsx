"use client";

import Link from "next/link";
import { ArrowRight, Instagram, MapPin } from "lucide-react";
import { useMemo } from "react";
import {
  ContactEmailButton,
  CONTACT_EMAIL,
  CONTACT_MAILTO,
} from "@/components/ContactEmailButton";
import { useCmsPages } from "@/hooks/useCmsPages";
import { useCmsStore } from "@/hooks/useCmsStore";
import styles from "./Footer.module.css";

const MARKET_LINKS = [
  { href: "/boutique/fleurs-cbd", label: "Fleurs CBD" },
  { href: "/boutique/resines-cbd", label: "Résines CBD" },
  { href: "/boutique/huiles-cbd", label: "Huiles CBD" },
  { href: "/boutique/e-liquide-cbd", label: "E-liquides CBD" },
  { href: "/boutique/cosmetiques-cbd", label: "Cosmétiques CBD" },
  { href: "/boutique/tisane-cbd", label: "Tisanes CBD" },
  { href: "/boutique/miam-cbd", label: "Miam CBD" },
  { href: "/analyse-laboratoire-cbd", label: "Lire une analyse CBD" },
  { href: "/blog", label: "Le blog CBD" },
] as const;

const REGIONAL_LINKS = [
  { href: "/cbd-breton", label: "CBD breton" },
  { href: "/cbd-naturel", label: "CBD naturel" },
  { href: "/cbd-pas-cher", label: "CBD pas cher" },
  { href: "/cbd-rennes", label: "Rennes" },
  { href: "/cbd-quimper", label: "Quimper" },
  { href: "/cbd-brest", label: "Brest" },
  { href: "/cbd-vannes", label: "Vannes" },
  { href: "/cbd-lorient", label: "Lorient" },
  { href: "/cbd-saint-brieuc", label: "Saint-Brieuc" },
  { href: "/cbd-saint-malo", label: "Saint-Malo" },
  { href: "/cbd-fougeres", label: "Fougères" },
  { href: "/cbd-vitre", label: "Vitré" },
  { href: "/cbd-redon", label: "Redon" },
] as const;

type FooterLink = {
  href: string;
  label: string;
};

function FooterLinkList({ links }: { links: FooterLink[] | readonly FooterLink[] }) {
  return (
    <ul className={styles.linkList}>
      {links.map((link) => (
        <li key={link.href}>
          <Link href={link.href} className={styles.navLink}>
            <span>{link.label}</span>
            <ArrowRight size={15} strokeWidth={2.25} aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Footer() {
  const { store, loading } = useCmsStore();
  const { pages: cmsPages } = useCmsPages();
  const footer = store.content.footer;

  const dynamicFooterLinks = useMemo(() => {
    const staticHrefs = new Set([
      "/mentions-legales",
      "/politique-confidentialite",
      "/politique-cookies",
      "/cgv",
      "/reglement-jeu-promo",
      "/a-propos",
    ]);

    return [...cmsPages]
      .filter((page) => page.showInFooter)
      .sort((a, b) => a.position - b.position)
      .map((page) => ({
        href: `/${page.slug}`,
        label: page.footerLabel.trim() || page.title.trim() || page.slug,
      }))
      .filter((link) => !staticHrefs.has(link.href));
  }, [cmsPages]);

  const legalLinks = useMemo<FooterLink[]>(
    () => [
      { href: "/mentions-legales", label: footer.legalLabel.trim() || "Mentions légales" },
      { href: "/politique-confidentialite", label: footer.privacyLabel.trim() || "Politique de confidentialité" },
      { href: "/politique-cookies", label: "Politique cookies" },
      { href: "/cgv", label: "Conditions générales de vente" },
      { href: "/a-propos", label: "À propos et méthode" },
      { href: "/reglement-jeu-promo", label: "Règlement jeu promo" },
      ...dynamicFooterLinks,
    ],
    [dynamicFooterLinks, footer.legalLabel, footer.privacyLabel],
  );

  if (loading) {
    return (
      <footer className={styles.footer}>
        <div className={`retro-container ${styles.inner}`}>
          <div className={styles.loading} />
        </div>
      </footer>
    );
  }

  return (
    <footer className={styles.footer}>
      <div className={`retro-container ${styles.inner}`}>
        <div className={styles.top}>
          <section className={styles.brand} aria-labelledby="footer-brand-title">
            <p className={styles.eyebrow}>
              <MapPin size={15} strokeWidth={2.4} aria-hidden="true" />
              Maison bretonne · producteurs identifiés
            </p>
            <h2 id="footer-brand-title" className={styles.brandTitle}>
              Les Chanvriers
              <span>Bretons</span>
            </h2>
            <p className={styles.lead}>
              Notre production bretonne et des références de producteurs partenaires, distinguées sur chaque fiche.
            </p>

            <div className={styles.actions}>
              <ContactEmailButton
                label="Nous contacter"
                buttonClassName={styles.actionPrimary}
                iconClassName={styles.actionIcon}
                statusClassName={styles.contactStatus}
              />
              <Link
                href="https://www.instagram.com/leschanvriersbretons"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.actionSecondary}
                aria-label="Instagram des Chanvriers Bretons"
              >
                <Instagram size={17} aria-hidden="true" />
                Instagram
              </Link>
            </div>
          </section>

          <nav className={styles.navigation} aria-label="Navigation du pied de page">
            <section className={styles.column}>
              <p className={styles.columnIndex}>01</p>
              <h3 className={styles.columnTitle}>Le marché</h3>
              <FooterLinkList links={MARKET_LINKS} />
            </section>

            <section className={styles.column}>
              <p className={styles.columnIndex}>02</p>
              <h3 className={styles.columnTitle}>Informations</h3>
              <FooterLinkList links={legalLinks} />
            </section>
          </nav>
        </div>

        <nav className={styles.regional} aria-label="CBD en Bretagne">
          <div className={styles.regionalHeading}>
            <p className={styles.columnIndex}>03</p>
            <h3>CBD en Bretagne</h3>
          </div>
          <div className={styles.regionalLinks}>
            {REGIONAL_LINKS.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
        </nav>

        <div className={styles.bottom}>
          <p>{footer.copyright}</p>
          <a href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a>
          <p>CBD naturel · Origines identifiées · Traçabilité par référence</p>
        </div>
      </div>
    </footer>
  );
}
