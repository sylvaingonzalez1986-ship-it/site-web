import type { Metadata } from "next";
import { HomeEditorialExperience } from "@/components/home/HomeEditorialExperience";
import { readPublicStoreByBackend } from "@/lib/data-backend";

export const metadata: Metadata = {
  title: "CBD naturel en Bretagne | Production et partenaires identifiés",
  description:
    "Découvrez Les Chanvriers Bretons : production bretonne et références de producteurs partenaires, avec origine, composition et analyses disponibles par produit.",
  alternates: {
    canonical: "https://www.leschanvriersbretons.com",
  },
  openGraph: {
    title: "Les Chanvriers Bretons | CBD naturel et traçable",
    description:
      "Production bretonne et producteurs partenaires clairement identifiés. Le catalogue présente les catégories et références réellement disponibles.",
    url: "https://www.leschanvriersbretons.com",
  },
};

export default async function HomePage() {
  const store = await readPublicStoreByBackend();

  return <HomeEditorialExperience initialStore={store} />;
}
