import type { Metadata } from "next";
import { HomePinnedExperience } from "@/components/home/HomePinnedExperience";

export const metadata: Metadata = {
  title: "Accueil — Votre Shop CBD Bio Breton Pas Cher",
  description:
    "Découvrez Les Chanvriers Bretons, votre shop CBD bio pas cher en Bretagne. Fleurs, huiles, résines et cosmétiques CBD de qualité. Livraison rapide en France.",
  alternates: {
    canonical: "https://leschanvriersbretons.com",
  },
};

export default function HomePage() {
  return <HomePinnedExperience />;
}
