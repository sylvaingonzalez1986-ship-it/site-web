import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
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
  CONTEST_CONSUMPTION_METHOD_LABELS,
  CONTEST_ENTRY_TRACKS,
  type ContestEntryTrack,
  type ContestPublicTesterProfile,
} from "@/types/contest";
import {
  formatContestAverage,
  formatContestDate,
  getContestReviewAverage,
} from "@/lib/contest-ui";
import { CONTEST_SCORE_MAX } from "@/lib/contest-score";
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
    title: `${decodeURIComponent(pseudo)} - Profil testeur`,
    robots: { index: false, follow: false },
  };
}

function ProgressCard({ profile }: { profile: ContestPublicTesterProfile }) {
  const progress = profile.progress;

  return (
    <div className="cartoon-border bg-cream p-5 md:p-6">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">Profil testeur</p>
      <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-4xl leading-none text-ink">{profile.profile.pseudo}</h1>
          <p className="mt-2 text-sm font-bold text-charcoal">{progress.currentLevel.label}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded border-2 border-[#1a1a1a] bg-white px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-charcoal">Points</p>
            <p className="text-lg font-black text-ink">{progress.totalPoints}</p>
          </div>
          <div className="rounded border-2 border-[#1a1a1a] bg-white px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-charcoal">Saison</p>
            <p className="text-lg font-black text-ink">{progress.seasonRank ? `#${progress.seasonRank}` : "-"}</p>
          </div>
          <div className="rounded border-2 border-[#1a1a1a] bg-white px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-charcoal">Global</p>
            <p className="text-lg font-black text-ink">{progress.globalRank ? `#${progress.globalRank}` : "-"}</p>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.08em] text-charcoal">
          <span>{progress.currentLevel.label}</span>
          <span>{progress.nextLevel ? progress.nextLevel.label : "Niveau max"}</span>
        </div>
        <div className="mt-2 h-5 overflow-hidden rounded-full border-2 border-[#1a1a1a] bg-white">
          <div className="h-full bg-yellow" style={{ width: `${progress.progressPercent}%` }} />
        </div>
      </div>
    </div>
  );
}

export default async function TesterProfilePage({ params, searchParams }: TesterProfilePageProps) {
  const { pseudo } = await params;
  const { season, track } = await searchParams;
  const session = await getOptionalContestSession();
  const adminAuthorized = await isCurrentRequestAdminAuthorized();
  if (!canCustomerAccessContestFeatureServer(session?.customer ?? null, { adminAuthorized })) {
    if (isContestFeatureEnabledServer() && isContestBetaAccessRestrictedServer() && !session && !adminAuthorized) {
      redirect(`/compte/connexion?next=${encodeURIComponent(`/bete-de-concours/profils/${pseudo}`)}`);
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
  const contestParams = new URLSearchParams();
  if (season) {
    contestParams.set("season", season);
  }
  if (safeTrack && safeTrack !== "regular") {
    contestParams.set("track", safeTrack);
  }
  const contestQuery = contestParams.toString();
  const contestHref = contestQuery ? `/bete-de-concours?${contestQuery}` : "/bete-de-concours";

  return (
    <section className="section-band bg-mint halftone-overlay paper-grain pt-36 pb-20">
      <div className="retro-container space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <nav className="text-sm text-charcoal" aria-label="Fil d'Ariane">
            <Link href={contestHref} className="underline hover:text-ink">
              Bete de concours
            </Link>
            {" > "}
            <span className="font-bold text-ink">{profile.profile.pseudo}</span>
          </nav>
          <Link
            href={contestHref}
            className="btn-cartoon btn-secondary inline-flex min-h-[44px] w-full items-center justify-center gap-2 px-4 text-xs leading-none sm:w-auto"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Retour au concours
          </Link>
        </div>

        <ProgressCard profile={profile} />

        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <div className="cartoon-border bg-cream p-5 md:p-6">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">Badges</p>
            <h2 className="font-display text-3xl leading-none text-ink">Achievements</h2>
            <div className="mt-5 grid gap-3">
              {profile.badges.length > 0 ? (
                profile.badges.map((badge) => (
                  <div key={badge.id} className="rounded border-2 border-[#1a1a1a] bg-white p-3">
                    <p className="text-sm font-black text-ink">{badge.badge?.label ?? badge.badgeId}</p>
                    <p className="mt-1 text-xs font-semibold text-charcoal">
                      {badge.rewardPackCount} booster{badge.rewardPackCount > 1 ? "s" : ""}
                      {badge.rewardClaimedAt ? " / reclame" : " / a reclamer"}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded border-2 border-dashed border-[#1a1a1a] bg-white p-4 text-sm text-charcoal">
                  Aucun badge debloque pour le moment.
                </p>
              )}
            </div>
          </div>

          <div className="cartoon-border bg-cream p-5 md:p-6">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">Critiques publiees</p>
            <h2 className="font-display text-3xl leading-none text-ink">Carnets valides</h2>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {profile.reviews.length > 0 ? (
                profile.reviews.map((review) => (
                  <article key={review.id} className="rounded border-2 border-[#1a1a1a] bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link
                          href={review.entrySlug ? `/bete-de-concours/${review.entrySlug}` : "/bete-de-concours"}
                          className="text-sm font-black text-ink underline"
                        >
                          {review.entryTitle ?? review.entryId}
                        </Link>
                        <p className="mt-1 text-xs text-charcoal">
                          {CONTEST_CONSUMPTION_METHOD_LABELS[review.consumptionMethod]} /{" "}
                          {formatContestDate(review.reviewedAt ?? review.createdAt)}
                        </p>
                      </div>
                      <span className="rounded-full border border-[#1a1a1a] bg-[#fffaf0] px-2 py-1 text-xs font-black text-ink">
                        {formatContestAverage(getContestReviewAverage(review.scores))} / {CONTEST_SCORE_MAX}
                      </span>
                    </div>
                    <p className="mt-4 text-sm leading-relaxed text-charcoal">
                      {review.comment.trim() || "Pas de critique redigee pour ce carnet."}
                    </p>
                  </article>
                ))
              ) : (
                <p className="rounded border-2 border-dashed border-[#1a1a1a] bg-white p-5 text-sm text-charcoal">
                  Aucune critique approuvee pour le moment.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
