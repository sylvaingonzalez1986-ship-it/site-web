import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ContestHubClient } from "@/components/contest/ContestHubClient";
import { ContestArenaHub } from "@/components/contest/ContestArenaHub";
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
  getPublicContestEntries,
  isContestSchemaMissingError,
} from "@/lib/contest-backend";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerApiEnabled } from "@/lib/kanab-quest-player-access";
import { isSupabaseAuthCookieName } from "@/lib/supabase-auth-cookies";
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
  searchParams: Promise<{ season?: string; category?: string; track?: string; vue?: string }>;
  surface?: "arena" | "notebook" | "notebook-ranking";
};

type ContestArenaView = "jouer" | "carnet" | "classement";

function parseArenaView(value?: string): ContestArenaView {
  return value === "jouer" || value === "classement" ? value : "carnet";
}

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
  const cookieStore = await cookies();
  if (!cookieStore.getAll().some((cookie) => isSupabaseAuthCookieName(cookie.name))) {
    return null;
  }

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
  title: "L'Arène - concours et dégustation CBD",
  description:
    "L'Arène réunit les lots CBD de saison, les carnets de dégustation, les avis vérifiés et le classement de la communauté.",
  alternates: {
    canonical: "/arene",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export async function ContestArenaPage({ searchParams, surface = "arena" }: ContestHubPageProps) {
  try {
    const params = await searchParams;
    const arenaView = surface === "arena" ? parseArenaView(params.vue) : "carnet";
    const requestedCategory = parseCategory(params.category);
    const selectedTrack = parseTrack(params.track);
    const [session, adminAuthorized] = await Promise.all([
      getOptionalContestSession(),
      isCurrentRequestAdminAuthorized(),
    ]);
    if (!canCustomerAccessContestFeatureServer(session?.customer ?? null, { adminAuthorized })) {
      if (isContestFeatureEnabledServer() && isContestBetaAccessRestrictedServer() && !session && !adminAuthorized) {
        const basePath = surface === "arena"
          ? "/arene"
          : surface === "notebook"
            ? `/arene/carnet/${selectedTrack}`
            : "/arene/carnet/classement";
        const nextPath = `${basePath}${params.season || params.category || selectedTrack !== "regular" ? `?${new URLSearchParams(
          Object.entries({
            season: params.season,
            category: params.category,
            track: surface === "arena" && selectedTrack !== "regular" ? selectedTrack : undefined,
          }).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
        ).toString()}` : ""}`;
        redirect(`/compte/connexion?next=${encodeURIComponent(nextPath)}`);
      }
      notFound();
    }

    if (surface === "arena" && !params.vue) {
      return <ContestArenaHub />;
    }
    if (surface === "arena" && arenaView === "carnet") {
      redirect("/arene/carnet/regular");
    }
    if (surface === "arena" && arenaView === "jouer") {
      redirect("/arene/placard");
    }

    const entryPayload = arenaView === "carnet"
      ? await getPublicContestEntries({ seasonCode: params.season, track: selectedTrack })
      : { entries: [], selectedSeason: null };
    const selectedSeasonCode = entryPayload.selectedSeason?.code ?? params.season;
    const categoryCounts = getContestCategoryCounts(entryPayload.entries);
    const activeCategory = resolveActiveContestCategory(categoryCounts, requestedCategory);
    const visibleEntries = entryPayload.entries.filter((entry) => entry.category === activeCategory);
    const includeCommunityPanels = arenaView === "carnet" && (surface === "arena" || surface === "notebook-ranking");

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
      includeCommunityPanels ? getContestSeasons() : Promise.resolve([]),
      includeCommunityPanels
        ? getContestRankings({ seasonCode: selectedSeasonCode, category: activeCategory, track: selectedTrack, limit: 12 })
        : Promise.resolve({ entries: [] }),
      includeCommunityPanels ? getContestFeed({
        seasonCode: selectedSeasonCode,
        category: activeCategory,
        track: selectedTrack,
        limit: 18,
        viewerCustomerId: session?.customerId,
      }) : Promise.resolve({ items: [] }),
      arenaView === "carnet" ? getContestNotebookUnlocks({
        customerId: session?.customerId,
        customerEmail: session?.customer.email,
        seasonCode: selectedSeasonCode,
      }) : Promise.resolve([]),
      arenaView === "carnet" && session?.customerId ? getContestProfile(session.customerId) : null,
      arenaView === "carnet" && session?.customerId ? getContestProfileBadges(session.customerId, { syncRewards: false }) : [],
      session?.customerId
        ? getContestTesterProgress({ customerId: session.customerId, seasonCode: selectedSeasonCode })
        : null,
      Promise.resolve({ items: [] }),
      Promise.resolve({ items: [] }),
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
        isAdminAuthorized={adminAuthorized}
        isPlacardPlayerEnabled={isKqPlayerApiEnabled()}
        initialView={arenaView}
        surface={surface}
      />
    );
  } catch (error) {
    if (isContestSchemaMissingError(error)) {
      return <ContestSchemaUnavailable />;
    }
    throw error;
  }
}

export default async function LegacyContestHubPage({ searchParams }: ContestHubPageProps) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.season) query.set("season", params.season);
  if (params.category) query.set("category", params.category);
  if (params.track) query.set("track", params.track);
  if (params.vue) query.set("vue", params.vue);
  permanentRedirect(`/arene${query.size ? `?${query.toString()}` : ""}`);
}
