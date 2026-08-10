import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import styles from "./SeoGuideLinks.module.css";

type SeoGuideLinksProps = {
  className?: string;
};

const SEO_GUIDES = [
  {
    href: "/cbd-naturel",
    index: "01",
    title: "CBD naturel",
    description:
      "Comprendre l’origine, la culture, la traçabilité et les analyses d’un CBD naturel.",
  },
  {
    href: "/cbd-pas-cher",
    index: "02",
    title: "CBD pas cher",
    description:
      "Comparer les formats et trouver un CBD à prix juste sans renoncer à la qualité.",
  },
] as const;

export function SeoGuideLinks({ className = "" }: SeoGuideLinksProps) {
  return (
    <section className={`${styles.section} ${className}`} aria-labelledby="seo-guide-links-title">
      <header className={styles.header}>
        <p className={styles.eyebrow}>Guides du marché</p>
        <h2 id="seo-guide-links-title">Mieux choisir son CBD</h2>
      </header>

      <div className={styles.grid}>
        {SEO_GUIDES.map((guide) => (
          <Link key={guide.href} href={guide.href} className={styles.guide}>
            <span className={styles.index}>{guide.index}</span>
            <span className={styles.copy}>
              <strong>{guide.title}</strong>
              <span>{guide.description}</span>
            </span>
            <ArrowUpRight size={19} strokeWidth={2.4} aria-hidden="true" />
          </Link>
        ))}
      </div>
    </section>
  );
}
