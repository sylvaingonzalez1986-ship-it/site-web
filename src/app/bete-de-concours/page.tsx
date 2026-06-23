import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ContestHubClient } from "@/components/contest/ContestHubClient";
import { ContestSchemaUnavailable } from "@/components/contest/ContestSchemaUnavailable";
import {
  canCustomerAccessContestFeatureServer,
  isContestBetaAccessRestrictedServer,
  isContestFeatureEnabledServer,
} from "@/lib/contest-feature";
import { isCurrentRequestAdminAuthorized } from "@/lib/admin-guard";
import {
  getContestFeed,
  getContestNotebookUnlocks,
  getContestProfile,
  getContestProfileBadges,
  getContestRankings,
  getContestSeasons,
  getContestTesterProgress,
  getContestTesterRankings,
  getPublicContestEntries,
  isContestSchemaMissingError,
} from "@/lib/contest-backend";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import {
  CONTEST_ENTRY_CATEGORIES,
  CONTEST_ENTRY_TRACKS,
  type ContestEntryCategory,
  type ContestEntryTrack,
} from "@/types/contest";
import {
  sanitizePublicContestBadge,
  sanitizePublicContestNotebookUnlock,
  sanitizePublicContestProfile,
  sanitizePublicContestProgress,
  sanitizePublicContestRankingItem,
} from "@/lib/contest-public-api";
import type { PublicCustomer } from "@/types/customer";

export const revalidate = 60;

type ContestHubPageProps = {
  searchParams: Promise<{ season?: string; category?: string; track?: string }>;
};

type ContestCategoryCounts = Record<ContestEntryCategory, number>;

const EMPTY_CONTEST_CATEGORY_COUNTS: ContestCategoryCounts = {
  outdoor: 0,
  greenhouse: 0,
  indoor: 0,
};

function parseCategory(value?: string): ContestEntryCategory | undefined {
  if (!value) {
    return undefined;
  }

  return CONTEST_ENTRY_CATEGORIES.includes(value as ContestEntryCategory)
    ? (value as ContestEntryCategory)
    : undefined;
}

function parseTrack(value?: string): ContestEntryTrack {
  return CONTEST_ENTRY_TRACKS.includes(value as ContestEntryTrack)
    ? (value as ContestEntryTrack)
    : "regular";
}

function getContestCategoryCounts(entries: Array<{ category: ContestEntryCategory }>): ContestCategoryCounts {
  const counts: ContestCategoryCounts = { ...EMPTY_CONTEST_CATEGORY_COUNTS };

  for (const entry of entries) {
    counts[entry.category] += 1;
  }

  return counts;
}

function resolveActiveContestCategory(
  counts: ContestCategoryCounts,
  requestedCategory?: ContestEntryCategory,
): ContestEntryCategory {
  if (requestedCategory && counts[requestedCategory] > 0) {
    return requestedCategory;
  }

  return CONTEST_ENTRY_CATEGORIES.find((category) => counts[category] > 0) ?? requestedCategory ?? "outdoor";
}

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

export const metadata: Metadata = {
  title: "Bête de concours",
  description:
    "Hub local de dégustation pour les lots premium: classement saisonnier, carrousel des fleurs et critiques clients modérées.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ContestHubPage({ searchParams }: ContestHubPageProps) {
  try {
    const params = await searchParams;
    const requestedCategory = parseCategory(params.category);
    const selectedTrack = parseTrack(params.track);
    const session = await getOptionalContestSession();
    const adminAuthorized = await isCurrentRequestAdminAuthorized();
    if (!canCustomerAccessContestFeatureServer(session?.customer ?? null, { adminAuthorized })) {
      if (isContestFeatureEnabledServer() && isContestBetaAccessRestrictedServer() && !session && !adminAuthorized) {
        const nextPath = `/bete-de-concours${params.season || params.category || selectedTrack !== "regular" ? `?${new URLSearchParams(
          Object.entries({
            season: params.season,
            category: params.category,
            track: selectedTrack !== "regular" ? selectedTrack : undefined,
          }).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
        ).toString()}` : ""}`;
        redirect(`/compte/connexion?next=${encodeURIComponent(nextPath)}`);
      }
      notFound();
    }

    const entryPayload = await getPublicContestEntries({
      seasonCode: params.season,
      track: selectedTrack,
    });
    const selectedSeasonCode = entryPayload.selectedSeason?.code ?? params.season;
    const categoryCounts = getContestCategoryCounts(entryPayload.entries);
    const activeCategory = resolveActiveContestCategory(categoryCounts, requestedCategory);
    const visibleEntries = entryPayload.entries.filter((entry) => entry.category === activeCategory);

    const [
      seasons,
      rankingPayload,
      feedPayload,
      notebookUnlocks,
      viewerProfile,
      viewerBadges,
      viewerProgress,
      testerSeasonRankings,
      testerGlobalRankings,
    ] = await Promise.all([
      getContestSeasons(),
      getContestRankings({ seasonCode: selectedSeasonCode, category: activeCategory, track: selectedTrack, limit: 12 }),
      getContestFeed({
        seasonCode: selectedSeasonCode,
        category: activeCategory,
        track: selectedTrack,
        limit: 18,
        viewerCustomerId: session?.customerId,
      }),
      getContestNotebookUnlocks({
        customerId: session?.customerId,
        customerEmail: session?.customer.email,
        seasonCode: selectedSeasonCode,
      }),
      session?.customerId ? getContestProfile(session.customerId) : null,
      session?.customerId ? getContestProfileBadges(session.customerId, { syncRewards: false }) : [],
      session?.customerId
        ? getContestTesterProgress({ customerId: session.customerId, seasonCode: selectedSeasonCode })
        : null,
      getContestTesterRankings({ scope: "season", seasonCode: selectedSeasonCode, limit: 10 }),
      getContestTesterRankings({ scope: "global", limit: 10 }),
    ]);

    return (
      <ContestHubClient
        seasons={seasons}
        selectedSeasonCode={entryPayload.selectedSeason?.code}
        selectedTrack={selectedTrack}
        activeCategory={activeCategory}
        categoryCounts={categoryCounts}
        entries={visibleEntries}
        rankings={rankingPayload.entries}
        feed={feedPayload.items}
        notebookUnlocks={notebookUnlocks.map(sanitizePublicContestNotebookUnlock)}
        viewerProfile={viewerProfile ? sanitizePublicContestProfile(viewerProfile) : null}
        viewerBadges={viewerBadges.map(sanitizePublicContestBadge)}
        viewerProgress={viewerProgress ? sanitizePublicContestProgress(viewerProgress) : null}
        testerSeasonRankings={testerSeasonRankings.items.map(sanitizePublicContestRankingItem)}
        testerGlobalRankings={testerGlobalRankings.items.map(sanitizePublicContestRankingItem)}
        isAuthenticated={Boolean(session?.customerId)}
      />
    );
  } catch (error) {
    if (isContestSchemaMissingError(error)) {
      return <ContestSchemaUnavailable />;
    }
    throw error;
  }
}
