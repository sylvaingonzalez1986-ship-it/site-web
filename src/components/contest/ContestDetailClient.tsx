"use client";

import Image from "next/image";
import Link from "next/link";
import arenaSubpageStyles from "@/components/contest/ContestArenaSubpage.module.css";
import { useState } from "react";
import { ChevronDown, ThumbsDown, ThumbsUp } from "lucide-react";
import { ProductDetailActions } from "@/components/boutique/ProductDetailActions";
import { ContestEntryCard } from "@/components/contest/ContestEntryCard";
import { ContestHeritageUnlockCard } from "@/components/contest/ContestHeritageUnlockCard";
import { ContestNotebookPanel } from "@/components/contest/ContestNotebookPanel";
import {
  ContestReviewTicker,
  type ContestTickerItem,
} from "@/components/contest/ContestReviewTicker";
import type { Product } from "@/data/products";
import { getContestEntryAnalysisUrl } from "@/lib/contest-analysis";
import {
  CONTEST_AROMA_TAG_LABELS,
  CONTEST_CONSUMPTION_METHOD_LABELS,
  CONTEST_ENTRY_CATEGORY_LABELS,
  CONTEST_SCORE_CRITERION_LABELS,
  CONTEST_SCORE_CRITERIA,
  type ContestReviewVoteSummary,
  type ContestReviewVoteValue,
} from "@/types/contest";
import type { PublicContestEntryDetail, PublicContestReview } from "@/lib/contest-public-api";
import {
  formatContestAverage,
  formatContestDate,
  getContestProductHref,
  getContestReviewAverage,
} from "@/lib/contest-ui";
import { CONTEST_SCORE_MAX } from "@/lib/contest-score";

type ContestDetailClientProps = {
  detail: PublicContestEntryDetail;
  product: Product | null;
  lowStockThresholdGrams: number;
  loginHref: string;
  isAuthenticated: boolean;
};

function buildTechnicalRows(detail: PublicContestEntryDetail) {
  const sheet = {
    ...detail.entry.technicalSheet,
    soil: detail.entry.technicalSheet.soil ?? detail.entry.producer?.soil,
  };
  const indoorCulture = Array.isArray(sheet.indoorCulture)
    ? sheet.indoorCulture.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

  const rows = [
    { label: "Variété", value: String(sheet.variety ?? detail.entry.title) },
    { label: "Sol", value: String(sheet.soil ?? "Non communiqué") },
    { label: "Culture", value: CONTEST_ENTRY_CATEGORY_LABELS[detail.entry.category] },
    { label: "Date récolte", value: formatContestTechnicalDate(sheet.harvestDate) },
  ];

  if (detail.entry.category === "indoor" && indoorCulture.length > 0) {
    rows.push({ label: "Options indoor", value: indoorCulture.join(", ") });
  }

  return rows;
}

function formatContestTechnicalDate(value: unknown): string {
  if (typeof value !== "string" || !value) {
    return "Non communiquée";
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(parsed));
}

function buildGalleryImages(detail: PublicContestEntryDetail) {
  return Array.from(
    new Set([detail.entry.imageUrl, ...detail.entry.galleryUrls].filter(Boolean)),
  );
}

export function ContestDetailClient({
  detail,
  product,
  lowStockThresholdGrams,
  loginHref,
  isAuthenticated,
}: ContestDetailClientProps) {
  const [reviews, setReviews] = useState(detail.reviews);
  const [selectedPublicReviewId, setSelectedPublicReviewId] = useState<string | null>(
    detail.reviews[0]?.id ?? null,
  );
  const [isReviewDetailsOpen, setIsReviewDetailsOpen] = useState(false);
  const [busyVoteReviewId, setBusyVoteReviewId] = useState<string | null>(null);
  const [voteErrorByReviewId, setVoteErrorByReviewId] = useState<Record<string, string>>({});
  const productHref = getContestProductHref(detail.entry.product);
  const technicalRows = buildTechnicalRows(detail);
  const analysisUrl = getContestEntryAnalysisUrl(detail.entry);
  const galleryImages = buildGalleryImages(detail);
  const publicReviewTickerItems: ContestTickerItem[] = reviews.map((review) => ({
    id: review.id,
    pseudo: review.pseudo,
    excerpt: review.comment,
    methodLabel: CONTEST_CONSUMPTION_METHOD_LABELS[review.consumptionMethod],
    stamp: formatContestDate(review.reviewedAt ?? review.createdAt),
    entryTitle: detail.entry.title,
  }));
  const selectedPublicReview =
    reviews.find((review) => review.id === selectedPublicReviewId) ?? reviews[0] ?? null;
  const selectedReviewScoreByCriterion = new Map(
    selectedPublicReview?.scores.map((score) => [score.criterion, score.score]) ?? [],
  );

  const updateReviewVoteSummary = (reviewId: string, voteSummary: ContestReviewVoteSummary) => {
    setReviews((current) =>
      current.map((review) => (review.id === reviewId ? { ...review, voteSummary } : review)),
    );
  };

  const voteForReview = async (review: PublicContestReview, value: ContestReviewVoteValue) => {
    if (!isAuthenticated) {
      window.location.href = loginHref;
      return;
    }

    setBusyVoteReviewId(review.id);
    setVoteErrorByReviewId((current) => ({ ...current, [review.id]: "" }));

    try {
      const response = await fetch(`/api/contest/reviews/${encodeURIComponent(review.id)}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      const payload = (await response.json().catch(() => null)) as {
        voteSummary?: ContestReviewVoteSummary;
        error?: string;
      } | null;

      if (!response.ok || !payload?.voteSummary) {
        setVoteErrorByReviewId((current) => ({
          ...current,
          [review.id]: payload?.error ?? "Vote impossible.",
        }));
        return;
      }

      updateReviewVoteSummary(review.id, payload.voteSummary);
    } catch {
      setVoteErrorByReviewId((current) => ({
        ...current,
        [review.id]: "Erreur reseau pendant le vote.",
      }));
    } finally {
      setBusyVoteReviewId(null);
    }
  };

  return (
    <section className={arenaSubpageStyles.page}>
      <div className={`retro-container ${arenaSubpageStyles.container}`}>
        <nav className="text-sm text-charcoal" aria-label="Fil d'Ariane">
          <Link href="/" className="underline hover:text-ink">
            Accueil
          </Link>
          {" > "}
          <Link href="/arene" className="underline hover:text-ink">
            L&apos;Arène
          </Link>
          {" > "}
          <span className="font-bold text-ink">{detail.entry.title}</span>
        </nav>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <div className="space-y-6">
            <div className="cartoon-border bg-cream p-5 md:p-6">
              <div className="flex justify-center">
                <ContestEntryCard entry={detail.entry} />
              </div>

              {galleryImages.length > 0 ? (
                <div className="mt-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">
                    Carrousel fleurs
                  </p>
                  <div className="mt-3 flex snap-x gap-3 overflow-x-auto pb-2">
                    {galleryImages.map((imageUrl, index) => (
                      <div
                        key={`${imageUrl}-${index}`}
                        className="relative h-28 min-w-[140px] snap-start overflow-hidden rounded border-2 border-[#1a1a1a] bg-white shadow-[3px_3px_0_#1a1a1a]"
                      >
                        <Image
                          src={imageUrl}
                          alt={`${detail.entry.title} - fleur ${index + 1}`}
                          fill
                          sizes="140px"
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-5 rounded border-2 border-[#1a1a1a] bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">
                      Achat du lot premium
                    </p>
                    <h2 className="text-2xl font-bold leading-tight text-ink">
                      {detail.entry.product?.name ?? detail.entry.title}
                    </h2>
                  </div>
                  {detail.entry.product ? (
                    <div className="self-start rounded-full border-2 border-[#1a1a1a] bg-[#fffaf0] px-3 py-2 text-sm font-black text-ink">
                      {detail.entry.product.price.toFixed(2)} EUR
                    </div>
                  ) : null}
                </div>

                {product ? (
                  <ProductDetailActions
                    product={product}
                    lowStockThresholdGrams={lowStockThresholdGrams}
                  />
                ) : productHref ? (
                  <Link
                    href={productHref}
                    className="btn-cartoon btn-primary mt-4 inline-flex min-h-[44px] items-center justify-center px-5 text-xs leading-none"
                  >
                    Aller au produit
                  </Link>
                ) : (
                  <p className="mt-4 text-sm text-charcoal">
                    Le lot reste lié à un produit de la boutique, mais son achat n&apos;est pas encore
                    résolu automatiquement ici.
                  </p>
                )}
              </div>
            </div>

            <ContestHeritageUnlockCard
              entryId={detail.entry.id}
              isAuthenticated={isAuthenticated}
            />

            <div className="cartoon-border bg-cream p-5 md:p-6">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">
                Fiche technique
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {technicalRows.map((row) => (
                  <div key={row.label} className="flex min-h-[84px] flex-col justify-between rounded border-2 border-[#1a1a1a] bg-white p-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-charcoal">
                      {row.label}
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-tight text-ink">{row.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded border-2 border-[#1a1a1a] bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">
                      Analyse laboratoire
                    </p>
                    <p className="mt-1 text-sm font-semibold text-ink">
                      {analysisUrl ? "Disponible" : "En attente"}
                    </p>
                  </div>
                  {analysisUrl ? (
                    <a
                      href={analysisUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-cartoon btn-secondary inline-flex min-h-[40px] items-center justify-center px-4 text-xs leading-none"
                    >
                      Consulter l&apos;analyse
                    </a>
                  ) : (
                    <span className="rounded-full border-2 border-[#1a1a1a] bg-[#fffaf0] px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-charcoal">
                      Bientot
                    </span>
                  )}
                </div>
              </div>

              {detail.entry.track === "concours" &&
              Array.isArray(detail.entry.technicalSheet.dominantTerpenes) &&
              detail.entry.technicalSheet.dominantTerpenes.length > 0 ? (
                <div className="mt-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">
                    Terpènes annoncés
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {detail.entry.technicalSheet.dominantTerpenes.map((terpene) => (
                      <span
                        key={String(terpene)}
                        className="rounded-full border-2 border-[#1a1a1a] bg-yellow px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-ink"
                      >
                        {String(terpene)}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {String(detail.entry.technicalSheet.notes ?? "").trim() ? (
                <div className="mt-4 rounded border-2 border-[#1a1a1a] bg-[#fffaf0] p-4 text-sm leading-relaxed text-charcoal">
                  {String(detail.entry.technicalSheet.notes)}
                </div>
              ) : null}
            </div>

            <div className="cartoon-border bg-cream p-5 md:p-6">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">
                Lecture publique
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="flex min-h-[96px] flex-col justify-between rounded border-2 border-[#1a1a1a] bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-charcoal">
                    Moyenne publique
                  </p>
                  <p className="mt-2 text-2xl font-bold leading-none text-ink">
                    {formatContestAverage(detail.entry.stats.averageScore)} / {CONTEST_SCORE_MAX}
                  </p>
                </div>
                <div className="flex min-h-[96px] flex-col justify-between rounded border-2 border-[#1a1a1a] bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-charcoal">
                    Avis validés
                  </p>
                  <p className="mt-2 text-2xl font-bold leading-none text-ink">
                    {detail.entry.stats.approvedReviewCount}
                  </p>
                </div>
                {detail.entry.ranking?.seasonCategoryRank ? (
                  <div className="flex min-h-[96px] flex-col justify-between rounded border-2 border-[#1a1a1a] bg-white p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-charcoal">
                      Rang catégorie
                    </p>
                    <p className="mt-2 text-2xl font-bold leading-none text-ink">
                      #{detail.entry.ranking.seasonCategoryRank}
                    </p>
                  </div>
                ) : null}
                {detail.entry.ranking?.seasonRankOverall ? (
                  <div className="flex min-h-[96px] flex-col justify-between rounded border-2 border-[#1a1a1a] bg-white p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-charcoal">
                      Rang saison
                    </p>
                    <p className="mt-2 text-2xl font-bold leading-none text-ink">
                      #{detail.entry.ranking.seasonRankOverall}
                    </p>
                  </div>
                ) : null}
              </div>

              {Object.entries(detail.entry.stats.criterionAverages).length > 0 ? (
                <div className="mt-4 grid gap-2">
                  {Object.entries(detail.entry.stats.criterionAverages).map(([criterion, score]) => (
                    <div
                      key={criterion}
                      className="flex items-start justify-between gap-3 rounded border border-[#1a1a1a] bg-[#fffaf0] px-3 py-2 sm:items-center"
                    >
                      <span className="text-sm leading-relaxed text-charcoal">
                        {CONTEST_SCORE_CRITERION_LABELS[criterion as keyof typeof CONTEST_SCORE_CRITERION_LABELS]}
                      </span>
                      <span className="mt-0.5 rounded-full border border-[#1a1a1a] bg-white px-2 py-1 text-xs font-black text-ink sm:mt-0">
                        {formatContestAverage(Number(score))} / {CONTEST_SCORE_MAX}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <ContestNotebookPanel
            entry={detail.entry}
            viewerProfile={detail.viewerProfile}
            viewerReview={detail.viewerReview}
            eligibility={detail.eligibility}
            loginHref={loginHref}
            productHref={productHref}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <ContestReviewTicker
            items={publicReviewTickerItems.map((item) => ({
              ...item,
              methodLabel: item.methodLabel,
            }))}
            title="Commentaires en rotation"
            emptyLabel="Aucune critique approuvée pour le moment sur ce lot."
          />

          <div className="cartoon-border bg-cream p-5 md:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">
                  Avis publics
                </p>
                <h2 className="font-display text-3xl leading-none text-ink">Carnets publiés</h2>
              </div>
              <Link
                href="/arene"
                className="btn-cartoon btn-secondary inline-flex min-h-[42px] items-center justify-center px-4 text-xs leading-none"
              >
                Retour au classement
              </Link>
            </div>

            {reviews.length > 0 && selectedPublicReview ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
                <div className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
                  {reviews.map((review) => {
                    const selected = review.id === selectedPublicReview.id;
                    return (
                      <button
                        key={review.id}
                        type="button"
                        onClick={() => {
                          setSelectedPublicReviewId(review.id);
                          setIsReviewDetailsOpen(false);
                        }}
                        className={`min-w-[220px] rounded border-2 border-[#1a1a1a] p-3 text-left shadow-[2px_2px_0_#1a1a1a] lg:min-w-0 ${
                          selected ? "bg-yellow text-ink" : "bg-white text-charcoal"
                        }`}
                      >
                        <span className="block truncate text-xs font-black uppercase tracking-[0.12em]">
                          {review.pseudo}
                        </span>
                        <span className="mt-1 block text-xs">
                          {formatContestDate(review.reviewedAt ?? review.createdAt)}
                        </span>
                        <span className="mt-2 inline-flex rounded-full border border-[#1a1a1a] bg-[#fffaf0] px-2 py-1 text-[11px] font-black text-ink">
                          {formatContestAverage(getContestReviewAverage(review.scores))} / {CONTEST_SCORE_MAX}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <article className="rounded border-2 border-[#1a1a1a] bg-white p-4 shadow-[4px_4px_0_#1a1a1a]">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <Link
                        href={`/arene/profils/${encodeURIComponent(selectedPublicReview.pseudo)}`}
                        className="text-[11px] font-black uppercase tracking-[0.12em] text-charcoal underline"
                      >
                        {selectedPublicReview.pseudo}
                      </Link>
                      <p className="text-xs text-charcoal">
                        {formatContestDate(selectedPublicReview.reviewedAt ?? selectedPublicReview.createdAt)}
                      </p>
                    </div>
                    <div className="self-start rounded-full border-2 border-[#1a1a1a] bg-[#fffaf0] px-3 py-2 text-sm font-black text-ink">
                      {formatContestAverage(getContestReviewAverage(selectedPublicReview.scores))} / {CONTEST_SCORE_MAX}
                    </div>
                  </div>

                  {selectedPublicReview.comment.trim() ? (
                    <p className="mt-4 text-base leading-relaxed text-charcoal">{selectedPublicReview.comment}</p>
                  ) : (
                    <p className="mt-4 text-sm italic text-charcoal">
                      Pas de critique redigee pour ce carnet.
                    </p>
                  )}

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={busyVoteReviewId === selectedPublicReview.id}
                      onClick={() => void voteForReview(selectedPublicReview, 1)}
                      aria-label="Valider cette critique"
                      className={`inline-flex min-h-[52px] min-w-[92px] items-center justify-center gap-2 rounded border-2 border-[#1a1a1a] px-4 py-3 text-base font-black uppercase tracking-[0.06em] ${
                        selectedPublicReview.voteSummary?.viewerVote === 1
                          ? "bg-yellow text-ink"
                          : "bg-[#fffaf0] text-charcoal"
                      } disabled:opacity-60`}
                    >
                      <ThumbsUp size={22} />
                      {selectedPublicReview.voteSummary?.upvoteCount ?? 0}
                    </button>
                    <button
                      type="button"
                      disabled={busyVoteReviewId === selectedPublicReview.id}
                      onClick={() => void voteForReview(selectedPublicReview, -1)}
                      aria-label="Contester cette critique"
                      className={`inline-flex min-h-[52px] min-w-[92px] items-center justify-center gap-2 rounded border-2 border-[#1a1a1a] px-4 py-3 text-base font-black uppercase tracking-[0.06em] ${
                        selectedPublicReview.voteSummary?.viewerVote === -1
                          ? "bg-[#f2b6a0] text-ink"
                          : "bg-[#fffaf0] text-charcoal"
                      } disabled:opacity-60`}
                    >
                      <ThumbsDown size={22} />
                      {selectedPublicReview.voteSummary?.downvoteCount ?? 0}
                    </button>
                    {selectedPublicReview.voteSummary?.isContested ? (
                      <span className="rounded border-2 border-[#7a1010] bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.06em] text-[#7a1010]">
                        Critique signalee
                      </span>
                    ) : null}
                  </div>

                  {voteErrorByReviewId[selectedPublicReview.id] ? (
                    <p className="mt-2 text-xs font-bold text-[#7a1010]">
                      {voteErrorByReviewId[selectedPublicReview.id]}
                    </p>
                  ) : null}

                  <div className="mt-5 rounded border-2 border-[#1a1a1a] bg-[#fffaf0]">
                    <button
                      type="button"
                      onClick={() => setIsReviewDetailsOpen((current) => !current)}
                      className="flex min-h-[48px] w-full items-center justify-between gap-3 px-4 py-3 text-left text-xs font-black uppercase tracking-[0.1em] text-ink"
                      aria-expanded={isReviewDetailsOpen}
                    >
                      Details de la critique
                      <ChevronDown
                        size={18}
                        aria-hidden="true"
                        className={`shrink-0 transition-transform ${isReviewDetailsOpen ? "rotate-180" : ""}`}
                      />
                    </button>

                    {isReviewDetailsOpen ? (
                      <div className="border-t-2 border-[#1a1a1a] p-4">
                        <div className="grid gap-2 sm:grid-cols-2">
                          {CONTEST_SCORE_CRITERIA.map((criterion) => (
                            <div
                              key={criterion}
                              className="flex items-center justify-between gap-3 rounded border border-[#1a1a1a] bg-white px-3 py-2"
                            >
                              <span className="text-xs font-bold text-charcoal">
                                {CONTEST_SCORE_CRITERION_LABELS[criterion]}
                              </span>
                              <span className="rounded-full border border-[#1a1a1a] bg-yellow px-2 py-1 text-xs font-black text-ink">
                                {selectedReviewScoreByCriterion.get(criterion) ?? "-"} / {CONTEST_SCORE_MAX}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-full border border-[#1a1a1a] bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-charcoal">
                            {CONTEST_CONSUMPTION_METHOD_LABELS[selectedPublicReview.consumptionMethod]}
                          </span>
                          {selectedPublicReview.aromaTags.map((tag) => (
                            <span
                              key={`${selectedPublicReview.id}-${tag.tag}-${tag.customLabel ?? ""}`}
                              className="rounded-full border border-[#1a1a1a] bg-yellow px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-ink"
                            >
                              {tag.tag === "other" ? tag.customLabel : CONTEST_AROMA_TAG_LABELS[tag.tag]}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </article>
              </div>
            ) : (
              <div className="mt-5 rounded border-2 border-dashed border-[#1a1a1a] bg-white p-8 text-center text-sm leading-relaxed text-charcoal">
                Ce lot n&apos;a pas encore de critique approuvee.
              </div>
            )}

            <div className="hidden" aria-hidden="true">
            {reviews.length > 0 ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {reviews.map((review) => (
                  <article key={review.id} className="rounded border-2 border-[#1a1a1a] bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <Link
                          href={`/arene/profils/${encodeURIComponent(review.pseudo)}`}
                          className="text-[11px] font-black uppercase tracking-[0.12em] text-charcoal underline"
                        >
                          {review.pseudo}
                        </Link>
                        <p className="text-xs text-charcoal">
                          {formatContestDate(review.reviewedAt ?? review.createdAt)}
                        </p>
                      </div>
                      <div className="self-start rounded-full border border-[#1a1a1a] bg-[#fffaf0] px-2 py-1 text-xs font-black text-ink">
                        {formatContestAverage(getContestReviewAverage(review.scores))} / {CONTEST_SCORE_MAX}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-[#1a1a1a] bg-[#f7f4ee] px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-charcoal">
                          {CONTEST_CONSUMPTION_METHOD_LABELS[review.consumptionMethod]}
                      </span>
                      {review.aromaTags.slice(0, 3).map((tag) => (
                        <span
                          key={`${review.id}-${tag.tag}-${tag.customLabel ?? ""}`}
                          className="rounded-full border border-[#1a1a1a] bg-yellow px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-ink"
                        >
                          {tag.tag === "other" ? tag.customLabel : CONTEST_AROMA_TAG_LABELS[tag.tag]}
                        </span>
                      ))}
                    </div>

                    {review.comment.trim() ? (
                      <p className="mt-4 text-sm leading-relaxed text-charcoal">{review.comment}</p>
                    ) : (
                      <p className="mt-4 text-sm italic text-charcoal">
                        Pas de critique rédigée pour ce carnet.
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={busyVoteReviewId === review.id}
                        onClick={() => void voteForReview(review, 1)}
                        className={`inline-flex min-h-[38px] items-center gap-2 rounded border-2 border-[#1a1a1a] px-3 py-2 text-xs font-black uppercase tracking-[0.06em] ${
                          review.voteSummary?.viewerVote === 1 ? "bg-yellow text-ink" : "bg-[#fffaf0] text-charcoal"
                        } disabled:opacity-60`}
                      >
                        <ThumbsUp size={14} />
                        {review.voteSummary?.upvoteCount ?? 0}
                      </button>
                      <button
                        type="button"
                        disabled={busyVoteReviewId === review.id}
                        onClick={() => void voteForReview(review, -1)}
                        className={`inline-flex min-h-[38px] items-center gap-2 rounded border-2 border-[#1a1a1a] px-3 py-2 text-xs font-black uppercase tracking-[0.06em] ${
                          review.voteSummary?.viewerVote === -1 ? "bg-[#f2b6a0] text-ink" : "bg-[#fffaf0] text-charcoal"
                        } disabled:opacity-60`}
                      >
                        <ThumbsDown size={14} />
                        {review.voteSummary?.downvoteCount ?? 0}
                      </button>
                      {review.voteSummary?.isContested ? (
                        <span className="rounded border-2 border-[#7a1010] bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.06em] text-[#7a1010]">
                          Critique signalee
                        </span>
                      ) : null}
                    </div>

                    {voteErrorByReviewId[review.id] ? (
                      <p className="mt-2 text-xs font-bold text-[#7a1010]">
                        {voteErrorByReviewId[review.id]}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded border-2 border-dashed border-[#1a1a1a] bg-white p-8 text-center text-sm leading-relaxed text-charcoal">
                Ce lot n&apos;a pas encore de critique approuvée. Les premiers carnets modérés
                apparaîtront ici.
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
