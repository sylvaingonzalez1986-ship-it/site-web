import type { Metadata } from "next";
import { ContestArenaPage } from "@/app/bete-de-concours/page";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Mon Carnet de dégustation — L’Arène",
  description: "Choisis une fleur, remplis ton carnet de dégustation et retrouve tes avis.",
  robots: { index: false, follow: false },
};

export default function ArenaNotebookPage() {
  return <ContestArenaPage searchParams={Promise.resolve({})} surface="notebook-hub" />;
}
