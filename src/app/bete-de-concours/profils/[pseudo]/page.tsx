import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ContestSchemaUnavailable } from "@/components/contest/ContestSchemaUnavailable";
import { isContestNotebookEnabledServer } from "@/lib/contest-notebook-access";
import {
  getPublicContestTesterProfile,
  isContestSchemaMissingError,
} from "@/lib/contest-backend";
import {
  CONTEST_ENTRY_TRACKS,
  type ContestEntryTrack,
} from "@/types/contest";
import { ArenaPublicTesterProfile } from "@/components/contest/ArenaPublicTesterProfile";

export const revalidate = 60;

type TesterProfilePageProps = {
  params: Promise<{ pseudo: string }>;
  searchParams: Promise<{ season?: string; track?: string }>;
};

export async function generateMetadata({ params }: TesterProfilePageProps): Promise<Metadata> {
  const { pseudo } = await params;
  return {
    title: `${decodeURIComponent(pseudo)} - Testeur de L'Arène`,
    alternates: { canonical: `/arene/profils/${encodeURIComponent(pseudo)}` },
    robots: { index: false, follow: false },
  };
}

export async function ArenaTesterProfilePage({ params, searchParams }: TesterProfilePageProps) {
  if (!isContestNotebookEnabledServer()) notFound();
  const { pseudo } = await params;
  const { season, track } = await searchParams;
  let profile = null;
  try {
    profile = await getPublicContestTesterProfile({
      pseudo: decodeURIComponent(pseudo),
      seasonCode: season,
      limit: 20,
    });
  } catch (error) {
    if (isContestSchemaMissingError(error)) {
      return <ContestSchemaUnavailable compact />;
    }
    throw error;
  }

  if (!profile) {
    notFound();
  }

  const safeTrack = CONTEST_ENTRY_TRACKS.includes(track as ContestEntryTrack)
    ? (track as ContestEntryTrack)
    : undefined;
  const contestParams = new URLSearchParams();
  if (season) {
    contestParams.set("season", season);
  }
  if (safeTrack && safeTrack !== "regular") {
    contestParams.set("track", safeTrack);
  }
  const contestQuery = contestParams.toString();
  const contestHref = `/arene/carnet/classement${contestQuery ? `?${contestQuery}` : ""}`;

  return <ArenaPublicTesterProfile profile={profile} backHref={contestHref} />;
}

export default async function LegacyTesterProfilePage({ params, searchParams }: TesterProfilePageProps) {
  const { pseudo } = await params;
  const queryParams = await searchParams;
  const query = new URLSearchParams();
  if (queryParams.season) query.set("season", queryParams.season);
  if (queryParams.track) query.set("track", queryParams.track);
  permanentRedirect(`/arene/profils/${encodeURIComponent(pseudo)}${query.size ? `?${query.toString()}` : ""}`);
}
