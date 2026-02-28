import type { Metadata } from "next";
import { BreadcrumbJsonLd, FaqJsonLd, ProductListJsonLd } from "@/components/JsonLd";
import { readStoreByBackend } from "@/lib/data-backend";

const CBD_FAQ = [
  {
    question: "Le CBD est-il légal en France ?",
    answer:
      "Oui, le CBD (cannabidiol) est légal en France à condition que le taux de THC soit inférieur à 0,3 %. Tous nos produits CBD sont analysés en laboratoire et conformes à la réglementation française.",
  },
  {
    question: "Quelle est la différence entre CBD et THC ?",
    answer:
      "Le CBD (cannabidiol) est une molécule non psychoactive du chanvre, contrairement au THC (tétrahydrocannabinol) qui provoque des effets euphorisants. Le CBD est autorisé en France, le THC est interdit au-delà de 0,3 %.",
  },
  {
    question: "Comment choisir sa fleur CBD ?",
    answer:
      "Le choix d'une fleur CBD dépend de vos préférences aromatiques, du mode de culture (indoor, greenhouse, outdoor) et du taux de CBD souhaité. Nos fleurs CBD bio bretonnes sont sélectionnées pour leur qualité et analysées en laboratoire.",
  },
  {
    question: "Quelle est la différence entre huile CBD full spectrum et broad spectrum ?",
    answer:
      "L'huile CBD full spectrum contient l'ensemble des cannabinoïdes du chanvre (dont une trace de THC < 0,3 %), tandis que la broad spectrum est sans THC. Les deux offrent un effet d'entourage bénéfique.",
  },
  {
    question: "Livrez-vous partout en France ?",
    answer:
      "Oui, Les Chanvriers Bretons livrent dans toute la France métropolitaine. Nous proposons une livraison rapide et suivie pour tous nos produits CBD bio bretons.",
  },
];

export const metadata: Metadata = {
  title: "Boutique CBD Bio Breton Pas Cher | Fleurs, Résines, Huiles CBD Bretagne",
  description:
    "Achetez du CBD bio breton pas cher : fleurs CBD, résines, huiles spectre complet, e-liquides, cosmétiques et tisanes. Qualité premium, producteurs bretons, livraison rapide en France.",
  alternates: {
    canonical: "https://leschanvriersbretons.com/boutique",
  },
  openGraph: {
    title: "Boutique CBD Bio Breton Pas Cher — Les Chanvriers Bretons",
    description:
      "Tous nos produits CBD bio bretons au meilleur prix. Fleurs, résines, huiles, e-liquides, cosmétiques et tisanes CBD. Livraison rapide en France.",
    url: "https://leschanvriersbretons.com/boutique",
  },
};

export default async function BoutiqueLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const store = await readStoreByBackend();

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: "https://leschanvriersbretons.com" },
          {
            name: "Boutique CBD",
            url: "https://leschanvriersbretons.com/boutique",
          },
        ]}
      />
      <ProductListJsonLd products={store.products} producers={store.producers} />
      <FaqJsonLd questions={CBD_FAQ} />
      {children}
    </>
  );
}
