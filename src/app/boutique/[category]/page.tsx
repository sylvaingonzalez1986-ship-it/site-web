"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { type ProductCategory } from "@/data/products";
import { useCmsStore } from "@/hooks/useCmsStore";

const categoryMap: Record<string, { filter: ProductCategory; label: string }> =
  {
    "fleurs-cbd": { filter: "fleurs", label: "Fleurs & Résines CBD" },
    "huiles-cbd": { filter: "huiles", label: "Huiles CBD" },
    "cosmetiques-cbd": { filter: "cosmetiques", label: "Cosmétiques CBD" },
    "alimentaire-cbd": { filter: "alimentaire", label: "Alimentaire CBD" },
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
        ? store.products.filter(
            (p) => p.category === categoryInfo.filter && !p.producerId,
          )
        : [],
    [categoryInfo, store.products],
  );

  if (!categoryInfo) {
    return (
      <section className="section-band bg-mint halftone-overlay paper-grain pt-32">
        <div className="retro-container">
          <div className="cartoon-border bg-cream p-8 text-center">
            <h1 className="section-title text-ink">Catégorie introuvable</h1>
            <p className="mt-4 text-lg text-charcoal">
              Cette catégorie n&apos;existe pas.
            </p>
            <Link href="/boutique" className="btn-cartoon btn-primary mt-6 inline-block">
              Retour à la boutique
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
            Aucun produit dans cette catégorie pour le moment.
          </div>
        )}

        <div className="cartoon-border mt-8 bg-cream p-6">
          <h2 className="font-display text-2xl text-ink">
            {getCategorySeoTitle(slug)}
          </h2>
          <div className="mt-4 space-y-3 text-charcoal leading-relaxed">
            {getCategorySeoText(slug)}
          </div>
        </div>
      </div>
    </section>
  );
}

function getCategoryDescription(slug: string): string {
  const descriptions: Record<string, string> = {
    "fleurs-cbd":
      "Découvrez notre sélection de fleurs et résines CBD bio, cultivées avec soin. Arômes naturels, qualité premium, prix pas cher.",
    "huiles-cbd":
      "Nos huiles CBD bio full spectrum et broad spectrum, faciles à doser. Idéales pour la relaxation et le bien-être au quotidien.",
    "cosmetiques-cbd":
      "Soins visage et corps au CBD bio : baumes, crèmes et huiles de massage. Le chanvre au service de votre peau.",
    "alimentaire-cbd":
      "Infusions, gummies et miel au CBD bio. Des produits gourmands pour intégrer le CBD dans votre routine.",
    "accessoires-cbd":
      "Grinders, pochons, plateaux et kits découverte. Tout l'essentiel pour profiter de vos produits CBD.",
  };
  return descriptions[slug] ?? "";
}

function getCategorySeoTitle(slug: string): string {
  const titles: Record<string, string> = {
    "fleurs-cbd": "Pourquoi choisir nos fleurs CBD bio ?",
    "huiles-cbd": "Comment bien choisir son huile CBD ?",
    "cosmetiques-cbd": "Les bienfaits du CBD pour la peau",
    "alimentaire-cbd": "Le CBD dans votre alimentation",
    "accessoires-cbd": "Bien s'équiper pour le CBD",
  };
  return titles[slug] ?? "";
}

function getCategorySeoText(slug: string): React.ReactNode {
  const texts: Record<string, React.ReactNode> = {
    "fleurs-cbd": (
      <>
        <p>
          Nos fleurs CBD bio sont sélectionnées auprès de producteurs européens
          respectant des normes strictes de culture biologique. Chaque lot est
          analysé en laboratoire pour garantir un taux de THC conforme à la
          législation française (inférieur à 0.3%).
        </p>
        <p>
          Que vous cherchiez une fleur CBD pas chère pour un usage quotidien ou
          une résine CBD premium pour les moments spéciaux, notre shop CBD
          breton propose des produits adaptés à tous les budgets.
        </p>
      </>
    ),
    "huiles-cbd": (
      <>
        <p>
          L&apos;huile CBD est le format le plus populaire pour profiter des
          bienfaits du cannabidiol. Nos huiles CBD bio sont disponibles en
          différentes concentrations (10%, 20%) pour s&apos;adapter à vos
          besoins.
        </p>
        <p>
          Full spectrum ou broad spectrum, nos huiles conservent l&apos;ensemble
          des cannabinoïdes et terpènes naturels du chanvre pour un effet
          d&apos;entourage optimal. Un shop CBD de qualité au meilleur prix.
        </p>
      </>
    ),
    "cosmetiques-cbd": (
      <>
        <p>
          Le CBD possède des propriétés apaisantes et anti-inflammatoires qui en
          font un allié idéal pour les soins de la peau. Nos cosmétiques CBD bio
          combinent chanvre et ingrédients naturels.
        </p>
        <p>
          Baumes réparateurs, crèmes hydratantes et huiles de massage : notre
          gamme cosmétique CBD est formulée pour tous les types de peau, à un
          prix pas cher.
        </p>
      </>
    ),
    "alimentaire-cbd": (
      <>
        <p>
          Intégrez le CBD dans votre routine bien-être avec nos produits
          alimentaires bio. Infusions relaxantes pour le soir, gummies fruités
          pour la journée, ou miel au chanvre pour vos tartines.
        </p>
        <p>
          Chaque produit alimentaire CBD de notre shop est dosé avec précision
          pour un effet maîtrisé et un goût agréable.
        </p>
      </>
    ),
    "accessoires-cbd": (
      <>
        <p>
          Complétez votre expérience CBD avec nos accessoires de qualité.
          Grinders, pochons hermétiques et plateaux design pour un usage
          pratique et stylé.
        </p>
        <p>
          Notre kit découverte est parfait pour les débutants qui souhaitent
          explorer l&apos;univers CBD avec tout le nécessaire.
        </p>
      </>
    ),
  };
  return texts[slug] ?? null;
}
