import type { Metadata } from "next";
import { BreadcrumbJsonLd, FaqJsonLd, ProductListJsonLd } from "@/components/JsonLd";
import { readPublicStoreByBackend } from "@/lib/data-backend";

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
  {
    question: "Pourquoi acheter du CBD en circuit court chez un producteur breton ?",
    answer:
      "Acheter du CBD en circuit court chez un producteur breton comme Les Chanvriers Bretons, c'est soutenir l'agriculture locale, garantir la traçabilité du produit et profiter d'un CBD naturel cultivé sans pesticide, au juste prix.",
  },
  {
    question: "Vos tisanes chanvre sont-elles artisanales ?",
    answer:
      "Oui, nos tisanes chanvre artisanales sont élaborées en petite série à partir de chanvre breton cultivé sans pesticide. Chaque lot est analysé en laboratoire pour garantir un produit naturel et conforme.",
  },
];

export const metadata: Metadata = {
  title:
    "Boutique CBD Naturel | Fleurs de CBD Direct Producteur Breton, Tisanes Chanvre Artisanales",
  description:
    "Achat CBD circuit court : fleurs de CBD direct producteur breton, résines, huiles spectre complet, tisanes chanvre artisanales. CBD français sans pesticide, livraison rapide en France.",
  alternates: {
    canonical: "https://leschanvriersbretons.com/boutique",
  },
  openGraph: {
    title:
      "Boutique CBD Naturel Direct Producteur — Les Chanvriers Bretons",
    description:
      "Tous nos produits CBD naturel breton en circuit court. Fleurs de CBD, résines, huiles, tisanes chanvre artisanales. CBD français sans pesticide, livraison rapide France.",
    url: "https://leschanvriersbretons.com/boutique",
  },
};

export default async function BoutiqueLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const store = await readPublicStoreByBackend();

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
