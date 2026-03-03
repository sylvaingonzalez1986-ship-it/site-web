import type { Metadata } from "next";
import { HomePinnedExperience } from "@/components/home/HomePinnedExperience";
import { readPublicStoreByBackend } from "@/lib/data-backend";

export const metadata: Metadata = {
  title:
    "CBD Naturel Direct Producteur Bretagne | Fleurs de CBD, Huiles & Tisanes Chanvre Artisanales",
  description:
    "Découvrez Les Chanvriers Bretons, producteur CBD en Bretagne. Fleurs de CBD direct producteur, huiles spectre complet, tisanes chanvre artisanales. Achat CBD circuit court, français, sans pesticide. Livraison rapide France.",
  alternates: {
    canonical: "https://leschanvriersbretons.com",
  },
  openGraph: {
    title:
      "Les Chanvriers Bretons | CBD Naturel Direct Producteur Bretagne",
    description:
      "CBD breton en circuit court : fleurs de CBD direct producteur, tisanes chanvre artisanales, huiles & résines. CBD français sans pesticide, livraison rapide France.",
    url: "https://leschanvriersbretons.com",
  },
};

export default async function HomePage() {
  const store = await readPublicStoreByBackend();

  return <HomePinnedExperience initialStore={store} />;
}
