import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { ContestSchemaUnavailable } from "@/components/contest/ContestSchemaUnavailable";
import {
  canCustomerAccessContestFeatureServer,
  isContestBetaAccessRestrictedServer,
  isContestFeatureEnabledServer,
} from "@/lib/contest-feature";
import { isCurrentRequestAdminAuthorized } from "@/lib/admin-guard";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import {
  getPublicContestTesterProfile,
  isContestSchemaMissingError,
} from "@/lib/contest-backend";
import {
  CONTEST_ENTRY_TRACKS,
  type ContestEntryTrack,
} from "@/types/contest";
import { ArenaPublicTesterProfile } from "@/components/contest/ArenaPublicTesterProfile";
import type { PublicCustomer } from "@/types/customer";

export const revalidate = 60;

type TesterProfilePageProps = {
  params: Promise<{ pseudo: string }>;
  searchParams: Promise<{ season?: string; track?: string }>;
};

async function getOptionalContestSession(): Promise<{
  customerId: string;
  customer: PublicCustomer;
} | null> {
  try {
    return await getCurrentCustomerSessionByBackend();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("[supabase:auth.getUser]")) {
      return null;
    }
    throw error;
  }
}

export async function generateMetadata({ params }: TesterProfilePageProps): Promise<Metadata> {
  const { pseudo } = await params;
  return {
    title: `${decodeURIComponent(pseudo)} - Testeur de L'Arène`,
    alternates: { canonical: `/arene/profils/${encodeURIComponent(pseudo)}` },
    robots: { index: false, follow: false },
  };
}

export async function ArenaTesterProfilePage({ params, searchParams }: TesterProfilePageProps) {
  const { pseudo } = await params;
  const { season, track } = await searchParams;
  const session = await getOptionalContestSession();
  const adminAuthorized = await isCurrentRequestAdminAuthorized();
  if (!canCustomerAccessContestFeatureServer(session?.customer ?? null, { adminAuthorized })) {
    if (isContestFeatureEnabledServer() && isContestBetaAccessRestrictedServer() && !session && !adminAuthorized) {
      redirect(`/compte/connexion?next=${encodeURIComponent(`/arene/profils/${pseudo}`)}`);
    }
    notFound();
  }

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
  const contestParams = new URLSearchParams({ vue: "classement" });
  if (season) {
    contestParams.set("season", season);
  }
  if (safeTrack && safeTrack !== "regular") {
    contestParams.set("track", safeTrack);
  }
  const contestQuery = contestParams.toString();
  const contestHref = `/arene?${contestQuery}`;

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
