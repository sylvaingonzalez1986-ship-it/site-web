import type { Metadata } from "next";
import { HomePinnedExperience } from "@/components/home/HomePinnedExperience";

export const metadata: Metadata = {
  title: "Shop CBD Bio Breton Pas Cher | Fleurs, Huiles, Résines CBD Bretagne",
  description:
    "Découvrez Les Chanvriers Bretons, votre shop CBD bio breton pas cher. Fleurs CBD, huiles spectre complet, résines, cosmétiques et tisanes au chanvre breton. Producteurs locaux, livraison rapide en France.",
  alternates: {
    canonical: "https://leschanvriersbretons.com",
  },
  openGraph: {
    title: "Les Chanvriers Bretons | Shop CBD Bio Breton Pas Cher",
    description:
      "CBD bio Bretagne : fleurs, résines, huiles, cosmétiques et tisanes au chanvre breton. Qualité premium, prix pas cher, livraison rapide France.",
    url: "https://leschanvriersbretons.com",
  },
};

export default function HomePage() {
  return <HomePinnedExperience />;
}
