"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { type ProductCategory } from "@/data/products";
import { useCmsStore } from "@/hooks/useCmsStore";
import { resolveProductProducer } from "@/lib/own-producer";
import { dedupeProducts } from "@/lib/product-dedup";
import type { Producer } from "@/types/store";

const categoryMap: Record<string, { filter: ProductCategory; label: string }> = {
  "fleurs-cbd": { filter: "fleurs", label: "Fleurs CBD" },
  "resines-cbd": { filter: "resines", label: "Resines CBD" },
  "huiles-cbd": { filter: "huiles", label: "Huiles CBD" },
  "e-liquide-cbd": { filter: "e-liquide", label: "E-liquides CBD" },
  "cosmetiques-cbd": { filter: "cosmetiques", label: "Cosmetiques CBD" },
  "tisane-cbd": { filter: "alimentaire", label: "Tisane CBD" },
  "alimentaire-cbd": { filter: "alimentaire", label: "Tisane CBD" }, // legacy slug
  "miam-cbd": { filter: "miam", label: "Miam CBD" },
  "accessoires-cbd": { filter: "accessoires", label: "Accessoires CBD" },
};

export default function CategoryPage() {
  const params = useParams();
  const slug = params.category as string;
  const { store, loading } = useCmsStore();
  const categoryInfo = categoryMap[slug];
  const uniqueProducts = useMemo(() => dedupeProducts(store.products), [store.products]);

  const producersById = useMemo(
    () => new Map<string, Producer>(store.producers.map((producer) => [producer.id, producer])),
    [store.producers],
  );

  const filteredProducts = useMemo(
    () =>
      categoryInfo
        ? uniqueProducts.filter((product) => product.category === categoryInfo.filter)
        : [],
    [categoryInfo, uniqueProducts],
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
              producer={resolveProductProducer(product, producersById)}
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
      "Découvrez notre sélection de fleurs CBD bio bretonnes, cultivées avec soin. Arômes naturels, qualité premium, prix pas cher.",
    "resines-cbd":
      "Découvrez notre sélection de résines CBD bio, texture et arômes maîtrisés, avec analyses laboratoire.",
    "huiles-cbd":
      "Nos huiles CBD bio full spectrum et broad spectrum, faciles à doser. Idéales pour la relaxation et le bien-être au quotidien.",
    "e-liquide-cbd":
      "E-liquides CBD au profil aromatique maîtrisé pour vapotage, sélectionnés avec exigence et transparence.",
    "cosmetiques-cbd":
      "Soins visage et corps au CBD bio : baumes, crèmes et huiles de massage. Le chanvre breton au service de votre peau.",
    "tisane-cbd":
      "Infusions et tisanes au chanvre breton, gourmandes et relaxantes, pour intégrer le CBD à votre routine.",
    "alimentaire-cbd":
      "Infusions et tisanes au chanvre breton, gourmandes et relaxantes, pour intégrer le CBD à votre routine.",
    "miam-cbd":
      "Produits alimentaires et gourmandises au chanvre breton, pour intégrer le CBD à votre quotidien.",
    "accessoires-cbd":
      "Grinders, pochons, plateaux et kits découverte. Tout l'essentiel pour profiter de vos produits CBD.",
  };
  return descriptions[slug] ?? "";
}

function getCategorySeoTitle(slug: string): string {
  const titles: Record<string, string> = {
    "fleurs-cbd": "Pourquoi choisir nos fleurs CBD ?",
    "resines-cbd": "Pourquoi choisir nos résines CBD bio ?",
    "huiles-cbd": "Comment bien choisir son huile CBD ?",
    "e-liquide-cbd": "Bien choisir son e-liquide CBD",
    "cosmetiques-cbd": "Les bienfaits du CBD pour la peau",
    "tisane-cbd": "Le CBD dans vos tisanes et infusions",
    "alimentaire-cbd": "Le CBD dans vos tisanes et infusions",
    "miam-cbd": "Le CBD dans vos produits gourmands",
    "accessoires-cbd": "Bien s'équiper pour le CBD",
  };
  return titles[slug] ?? "";
}

function getCategorySeoText(slug: string): React.ReactNode {
  const texts: Record<string, React.ReactNode> = {
    "fleurs-cbd": (
      <>
        <p>
          Nos fleurs CBD sont sélectionnées auprès de producteurs français
          respectant des normes strictes. Chaque lot est analysé en
          laboratoire pour garantir un taux de THC conforme à la législation
          française.
        </p>
        <p>
          Que vous cherchiez une fleur CBD pas chère pour un usage quotidien,
          notre shop CBD propose des produits adaptés à tous les budgets
          avec livraison rapide en France.
        </p>
      </>
    ),
    "resines-cbd": (
      <>
        <p>
          Nos résines CBD sont sélectionnées pour leur profil aromatique, leur
          texture et leur régularité. Chaque lot est contrôlé en laboratoire
          pour garantir une qualité irréprochable.
        </p>
        <p>
          Notre catégorie dédiée résines permet de comparer simplement les
          références sans mélanger avec les fleurs CBD.
        </p>
      </>
    ),
    "huiles-cbd": (
      <>
        <p>
          L&apos;huile CBD est un format populaire pour profiter des bienfaits du
          cannabidiol. Nos huiles CBD bio sont disponibles en différentes
          concentrations pour s&apos;adapter à vos besoins.
        </p>
        <p>
          Full spectrum ou broad spectrum, nos huiles conservent les molécules
          naturelles du chanvre breton pour un effet d&apos;entourage optimal.
        </p>
      </>
    ),
    "e-liquide-cbd": (
      <>
        <p>
          Nos e-liquides CBD sont proposés avec des profils aromatiques clairs
          et des dosages transparents pour un usage confortable.
        </p>
        <p>
          Cette catégorie regroupe uniquement les références de vape CBD, pour
          une navigation plus simple et plus propre.
        </p>
      </>
    ),
    "cosmetiques-cbd": (
      <>
        <p>
          Le CBD possède des propriétés apaisantes qui en font un allié idéal
          pour les soins de la peau. Nos cosmétiques CBD bio combinent chanvre
          breton et ingrédients naturels.
        </p>
        <p>
          Baumes, crèmes et huiles de massage : notre gamme cosmétique CBD est
          formulée pour tous les types de peau.
        </p>
      </>
    ),
    "tisane-cbd": (
      <>
        <p>
          Intégrez le chanvre breton dans votre routine bien-être avec nos
          tisanes et infusions sélectionnées pour la détente et le plaisir
          gustatif.
        </p>
        <p>
          Cette catégorie rassemble les formats boisson chaude au même endroit
          pour une lecture plus claire.
        </p>
      </>
    ),
    "miam-cbd": (
      <>
        <p>
          Découvrez notre gamme Miam : produits gourmands et alimentaires au
          chanvre breton, sélectionnés pour le plaisir et le bien-être.
        </p>
        <p>
          Cette catégorie rassemble les produits alimentaires CBD pour une
          navigation simplifiée.
        </p>
      </>
    ),
    "alimentaire-cbd": (
      <>
        <p>
          Découvrez nos produits alimentaires au chanvre breton, sélectionnés
          pour le bien-être et le plaisir gustatif au quotidien.
        </p>
        <p>
          Cette catégorie rassemble les produits alimentaires CBD au même
          endroit pour une navigation simplifiée.
        </p>
      </>
    ),
    "accessoires-cbd": (
      <>
        <p>
          Complétez votre expérience CBD avec nos accessoires de qualité :
          grinders, pochons et plateaux pour un usage pratique.
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
