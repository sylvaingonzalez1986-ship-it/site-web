"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { type ProductCategory } from "@/data/products";
import { useCmsStore } from "@/hooks/useCmsStore";
import { getOwnProducer, resolveProductProducer } from "@/lib/own-producer";
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
  const ownProducer = useMemo(() => getOwnProducer(store.content.boutique), [store.content.boutique]);

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
              producer={resolveProductProducer(product, producersById, ownProducer)}
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
      "Fleurs de CBD direct producteur breton, cultivées naturellement sans pesticide. CBD naturel en circuit court, qualité analysée en laboratoire.",
    "resines-cbd":
      "Résines CBD naturelles sélectionnées auprès de producteurs français. Texture et arômes maîtrisés, CBD breton sans pesticide, analyses laboratoire.",
    "huiles-cbd":
      "Huiles CBD naturelles full spectrum et broad spectrum, direct producteur breton. CBD facile à doser, idéal pour la relaxation et le bien-être au quotidien.",
    "e-liquide-cbd":
      "E-liquides CBD au profil aromatique maîtrisé, sélectionnés avec exigence auprès de producteurs français. Vapotage CBD naturel et transparent.",
    "cosmetiques-cbd":
      "Soins visage et corps au CBD naturel breton : baumes, crèmes et huiles de massage. Le chanvre cultivé en Bretagne au service de votre peau.",
    "tisane-cbd":
      "Tisanes chanvre artisanales et infusions CBD bretonnes, gourmandes et relaxantes. Circuit court, sans pesticide, pour intégrer le CBD naturel à votre routine.",
    "alimentaire-cbd":
      "Tisanes chanvre artisanales et infusions CBD bretonnes, gourmandes et relaxantes. Circuit court, sans pesticide, pour intégrer le CBD naturel à votre routine.",
    "miam-cbd":
      "Produits gourmands au chanvre breton, CBD naturel et artisanal. Découvrez le terroir breton dans votre assiette, en circuit court.",
    "accessoires-cbd":
      "Grinders, pochons, plateaux et kits découverte. Tout l'essentiel pour profiter de vos produits CBD naturels.",
  };
  return descriptions[slug] ?? "";
}

function getCategorySeoTitle(slug: string): string {
  const titles: Record<string, string> = {
    "fleurs-cbd": "Pourquoi acheter ses fleurs de CBD direct producteur breton ?",
    "resines-cbd": "Résines CBD naturelles : le circuit court sans pesticide",
    "huiles-cbd": "Comment bien choisir son huile CBD naturelle ?",
    "e-liquide-cbd": "Bien choisir son e-liquide CBD français",
    "cosmetiques-cbd": "Les bienfaits du CBD naturel breton pour la peau",
    "tisane-cbd": "Tisanes chanvre artisanales : le CBD dans votre tasse",
    "alimentaire-cbd": "Tisanes chanvre artisanales : le CBD dans votre tasse",
    "miam-cbd": "Le CBD breton dans vos produits gourmands",
    "accessoires-cbd": "Bien s'équiper pour le CBD",
  };
  return titles[slug] ?? "";
}

function getCategorySeoText(slug: string): React.ReactNode {
  const texts: Record<string, React.ReactNode> = {
    "fleurs-cbd": (
      <>
        <p>
          Nos fleurs de CBD sont cultivées en direct par des producteurs bretons et
          français qui travaillent sans pesticide, dans le respect du terroir.
          Chaque lot est analysé en laboratoire pour garantir un taux de THC
          conforme à la réglementation française et un CBD naturel de qualité.
        </p>
        <p>
          En achetant vos fleurs de CBD direct producteur, vous soutenez le circuit
          court et la production locale en Bretagne. Notre boutique vous offre un
          accès transparent à du CBD breton authentique, livré rapidement partout en France.
        </p>
      </>
    ),
    "resines-cbd": (
      <>
        <p>
          Nos résines CBD sont sélectionnées auprès de producteurs français pour
          leur profil aromatique et leur texture. Chaque lot est contrôlé en
          laboratoire, sans pesticide, pour un CBD naturel et irréprochable.
        </p>
        <p>
          Achat CBD circuit court : en choisissant nos résines, vous profitez d'un
          produit breton artisanal au juste prix, livré rapidement en France.
        </p>
      </>
    ),
    "huiles-cbd": (
      <>
        <p>
          L&apos;huile CBD est un format idéal pour profiter du cannabidiol au quotidien.
          Nos huiles CBD naturelles sont proposées en full spectrum et broad spectrum,
          issues de chanvre breton cultivé sans pesticide.
        </p>
        <p>
          Direct producteur en Bretagne, nos huiles conservent l'ensemble des
          molécules naturelles du chanvre pour un effet d&apos;entourage optimal.
          Achat CBD en circuit court, livraison rapide France.
        </p>
      </>
    ),
    "e-liquide-cbd": (
      <>
        <p>
          Nos e-liquides CBD sont proposés avec des profils aromatiques clairs
          et des dosages transparents, sélectionnés auprès de producteurs français
          respectant une démarche sans pesticide.
        </p>
        <p>
          Cette catégorie regroupe uniquement les références de vape CBD naturel,
          pour une navigation simple et un achat CBD en toute confiance.
        </p>
      </>
    ),
    "cosmetiques-cbd": (
      <>
        <p>
          Le CBD naturel possède des propriétés apaisantes idéales pour les soins
          de la peau. Nos cosmétiques combinent chanvre breton cultivé sans pesticide
          et ingrédients naturels sélectionnés.
        </p>
        <p>
          Baumes, crèmes et huiles de massage : notre gamme cosmétique CBD est
          formulée pour tous les types de peau, en circuit court depuis la Bretagne.
        </p>
      </>
    ),
    "tisane-cbd": (
      <>
        <p>
          Nos tisanes chanvre artisanales sont élaborées avec du chanvre breton
          cultivé sans pesticide, pour une infusion CBD naturelle, gourmande et
          relaxante. Le terroir breton dans votre tasse.
        </p>
        <p>
          Achat CBD circuit court : chaque tisane chanvre artisanale est produite
          en petite série par des producteurs locaux, pour une qualité et une
          traçabilité irréprochables. Livraison rapide France.
        </p>
      </>
    ),
    "miam-cbd": (
      <>
        <p>
          Découvrez notre gamme Miam : produits gourmands au chanvre breton,
          CBD naturel et artisanal. Circuit court et terroir breton dans votre assiette.
        </p>
        <p>
          Cette catégorie rassemble les produits alimentaires CBD pour une
          navigation simplifiée et un achat CBD en confiance.
        </p>
      </>
    ),
    "alimentaire-cbd": (
      <>
        <p>
          Nos produits alimentaires au chanvre breton sont sélectionnés en circuit
          court, pour le bien-être et le plaisir gustatif. CBD naturel, sans pesticide.
        </p>
        <p>
          Tisanes chanvre artisanales et infusions CBD pour intégrer le cannabidiol
          à votre quotidien. Livraison rapide France.
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
