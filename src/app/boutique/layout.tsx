import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Boutique CBD naturel | Origine et producteurs identifiés",
  description:
    "Catalogue CBD actualisé selon les références disponibles. Production des Chanvriers Bretons et producteurs partenaires distingués sur chaque fiche.",
  alternates: {
    canonical: "https://www.leschanvriersbretons.com/boutique",
  },
  openGraph: {
    title: "Boutique CBD naturel — Les Chanvriers Bretons",
    description:
      "Un catalogue de CBD dont l'origine, le producteur ou la marque et les analyses disponibles sont présentés par référence.",
    url: "https://www.leschanvriersbretons.com/boutique",
  },
};

export default function BoutiqueLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
