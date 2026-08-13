import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContestArenaPage } from "@/app/bete-de-concours/page";
import type { ContestEntryTrack } from "@/types/contest";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Mon Carnet de dégustation — L’Arène",
  description: "Choisis une fleur, remplis ton carnet de dégustation et retrouve tes avis.",
  robots: { index: false, follow: false },
};

type ArenaNotebookTrackPageProps = {
  params: Promise<{ track: string }>;
  searchParams: Promise<{ season?: string; category?: string }>;
};

export default async function ArenaNotebookTrackPage({ params, searchParams }: ArenaNotebookTrackPageProps) {
  const [{ track }, query] = await Promise.all([params, searchParams]);
  if (track !== "regular" && track !== "concours") notFound();

  return (
    <ContestArenaPage
      searchParams={Promise.resolve({ ...query, track: track as ContestEntryTrack })}
      surface="notebook"
    />
  );
}
