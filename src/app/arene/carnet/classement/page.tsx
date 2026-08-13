import type { Metadata } from "next";
import { ContestArenaPage } from "@/app/bete-de-concours/page";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Classement des fleurs — Mon Carnet",
  description: "Palmarès des fleurs établi à partir des notes validées dans les carnets de dégustation.",
  robots: { index: false, follow: false },
};

type ArenaNotebookRankingPageProps = {
  searchParams: Promise<{ season?: string; category?: string; track?: string }>;
};

export default function ArenaNotebookRankingPage({ searchParams }: ArenaNotebookRankingPageProps) {
  return <ContestArenaPage searchParams={searchParams} surface="notebook-ranking" />;
}
