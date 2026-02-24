"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { type ProductCategory } from "@/data/products";
import { useCmsStore } from "@/hooks/useCmsStore";

const categoryMap: Record<string, { filter: ProductCategory; label: string }> = {
  "fleurs-cbd": { filter: "fleurs", label: "Fleurs CBD" },
  "resines-cbd": { filter: "resines", label: "Resines CBD" },
  "huiles-cbd": { filter: "huiles", label: "Huiles CBD" },
  "e-liquide-cbd": { filter: "e-liquide", label: "E-liquides CBD" },
  "cosmetiques-cbd": { filter: "cosmetiques", label: "Cosmetiques CBD" },
  "tisane-cbd": { filter: "alimentaire", label: "Tisane CBD" },
  "alimentaire-cbd": { filter: "alimentaire", label: "Tisane CBD" }, // legacy slug
  "accessoires-cbd": { filter: "accessoires", label: "Accessoires CBD" },
};

export default function CategoryPage() {
  const params = useParams();
  const slug = params.category as string;
  const { store, loading } = useCmsStore();

  const categoryInfo = categoryMap[slug];

  const filteredProducts = useMemo(
    () =>
      categoryInfo
        ? store.products.filter((p) => p.category === categoryInfo.filter && !p.producerId)
        : [],
    [categoryInfo, store.products],
  );

  if (!categoryInfo) {
    return (
      <section className="section-band bg-mint halftone-overlay paper-grain pt-32">
        <div className="retro-container">
          <div className="cartoon-border bg-cream p-8 text-center">
            <h1 className="section-title text-ink">Categorie introuvable</h1>
            <p className="mt-4 text-lg text-charcoal">Cette categorie n&apos;existe pas.</p>
            <Link href="/boutique" className="btn-cartoon btn-primary mt-6 inline-block">
              Retour a la boutique
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section-band bg-mint halftone-overlay paper-grain pt-32">
      <div className="retro-container">
        <div className="cartoon-border bg-cream p-8">
          <nav className="mb-4 text-sm text-charcoal" aria-label="Fil d'Ariane">
            <Link href="/" className="hover:text-ink underline">
              Accueil
            </Link>
            {" > "}
            <Link href="/boutique" className="hover:text-ink underline">
              Boutique
            </Link>
            {" > "}
            <span className="font-bold text-ink">{categoryInfo.label}</span>
          </nav>

          <h1 className="section-title text-ink">{categoryInfo.label}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-charcoal">
            {getCategoryDescription(slug)}
          </p>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              addButtonLabel={store.content.boutique.addButtonLabel}
            />
          ))}
        </div>

        {filteredProducts.length === 0 && !loading && (
          <div className="cartoon-border mt-6 bg-cream p-6 text-center text-charcoal">
            Aucun produit dans cette categorie pour le moment.
          </div>
        )}

        <div className="cartoon-border mt-8 bg-cream p-6">
          <h2 className="font-display text-2xl text-ink">{getCategorySeoTitle(slug)}</h2>
          <div className="mt-4 space-y-3 text-charcoal leading-relaxed">{getCategorySeoText(slug)}</div>
        </div>
      </div>
    </section>
  );
}

function getCategoryDescription(slug: string): string {
  const descriptions: Record<string, string> = {
    "fleurs-cbd":
      "Decouvrez notre selection de fleurs CBD bio, cultivees avec soin. Aromes naturels, qualite premium, prix pas cher.",
    "resines-cbd":
      "Decouvrez notre selection de resines CBD bio, texture et aromes maitrises, avec analyses laboratoire.",
    "huiles-cbd":
      "Nos huiles CBD bio full spectrum et broad spectrum, faciles a doser. Ideales pour la relaxation et le bien-etre au quotidien.",
    "e-liquide-cbd":
      "E-liquides CBD au profil aromatique maitrise pour vapotage, selectionnes avec exigence et transparence.",
    "cosmetiques-cbd":
      "Soins visage et corps au CBD bio : baumes, cremes et huiles de massage. Le chanvre au service de votre peau.",
    "tisane-cbd":
      "Infusions et tisanes au chanvre, gourmandes et relaxantes, pour integrer le CBD a votre routine.",
    "alimentaire-cbd":
      "Infusions et tisanes au chanvre, gourmandes et relaxantes, pour integrer le CBD a votre routine.",
    "accessoires-cbd":
      "Grinders, pochons, plateaux et kits decouverte. Tout l'essentiel pour profiter de vos produits CBD.",
  };
  return descriptions[slug] ?? "";
}

function getCategorySeoTitle(slug: string): string {
  const titles: Record<string, string> = {
    "fleurs-cbd": "Pourquoi choisir nos fleurs CBD bio ?",
    "resines-cbd": "Pourquoi choisir nos resines CBD bio ?",
    "huiles-cbd": "Comment bien choisir son huile CBD ?",
    "e-liquide-cbd": "Bien choisir son e-liquide CBD",
    "cosmetiques-cbd": "Les bienfaits du CBD pour la peau",
    "tisane-cbd": "Le CBD dans vos tisanes et infusions",
    "alimentaire-cbd": "Le CBD dans vos tisanes et infusions",
    "accessoires-cbd": "Bien s'equiper pour le CBD",
  };
  return titles[slug] ?? "";
}

function getCategorySeoText(slug: string): React.ReactNode {
  const texts: Record<string, React.ReactNode> = {
    "fleurs-cbd": (
      <>
        <p>
          Nos fleurs CBD bio sont selectionnees aupres de producteurs europeens
          respectant des normes strictes. Chaque lot est analyse en laboratoire
          pour garantir un taux de THC conforme a la legislation.
        </p>
        <p>
          Que vous cherchiez une fleur CBD pas chere pour un usage quotidien,
          notre shop CBD breton propose des produits adaptes a tous les budgets.
        </p>
      </>
    ),
    "resines-cbd": (
      <>
        <p>
          Nos resines CBD sont selectionnees pour leur profil aromatique, leur
          texture et leur regularite. Chaque lot est controle en laboratoire.
        </p>
        <p>
          Une categorie dediee resines permet de comparer simplement les
          references sans melanger avec les fleurs.
        </p>
      </>
    ),
    "huiles-cbd": (
      <>
        <p>
          L&apos;huile CBD est un format populaire pour profiter des bienfaits du
          cannabidiol. Nos huiles CBD bio sont disponibles en differentes
          concentrations pour s&apos;adapter a vos besoins.
        </p>
        <p>
          Full spectrum ou broad spectrum, nos huiles conservent des molecules
          naturelles du chanvre pour un effet d&apos;entourage optimal.
        </p>
      </>
    ),
    "e-liquide-cbd": (
      <>
        <p>
          Nos e-liquides CBD sont proposes avec des profils aromatiques clairs
          et des dosages transparents pour un usage confortable.
        </p>
        <p>
          Cette categorie regroupe uniquement les references de vape, pour une
          navigation plus simple et plus propre.
        </p>
      </>
    ),
    "cosmetiques-cbd": (
      <>
        <p>
          Le CBD possede des proprietes apaisantes qui en font un allie ideal
          pour les soins de la peau. Nos cosmetiques CBD bio combinent chanvre
          et ingredients naturels.
        </p>
        <p>
          Baumes, cremes et huiles de massage : notre gamme cosmetique CBD est
          formulee pour tous les types de peau.
        </p>
      </>
    ),
    "tisane-cbd": (
      <>
        <p>
          Integrez le chanvre dans votre routine bien-etre avec nos tisanes et
          infusions selectionnees pour la detente et le plaisir gustatif.
        </p>
        <p>
          Cette categorie rassemble les formats boisson chaude au meme endroit
          pour une lecture plus claire.
        </p>
      </>
    ),
    "alimentaire-cbd": (
      <>
        <p>
          Integrez le chanvre dans votre routine bien-etre avec nos tisanes et
          infusions selectionnees pour la detente et le plaisir gustatif.
        </p>
        <p>
          Cette categorie rassemble les formats boisson chaude au meme endroit
          pour une lecture plus claire.
        </p>
      </>
    ),
    "accessoires-cbd": (
      <>
        <p>
          Completez votre experience CBD avec nos accessoires de qualite :
          grinders, pochons et plateaux pour un usage pratique.
        </p>
        <p>
          Notre kit decouverte est parfait pour les debutants qui souhaitent
          explorer l&apos;univers CBD avec tout le necessaire.
        </p>
      </>
    ),
  };

  return texts[slug] ?? null;
}
