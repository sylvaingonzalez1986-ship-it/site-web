import Link from "next/link";
import { ChevronDown, MessageCircle, Star } from "lucide-react";
import type {
  ContestScoreCriterion,
} from "@/types/contest";
import {
  CONTEST_AROMA_TAG_LABELS,
  CONTEST_CONSUMPTION_METHOD_LABELS,
  CONTEST_SCORE_CRITERIA,
  CONTEST_SCORE_CRITERION_LABELS,
} from "@/types/contest";
import type { PublicContestProductTastingSummary } from "@/lib/contest-public-api";
import {
  formatContestAverage,
  formatContestDate,
  getContestReviewAverage,
} from "@/lib/contest-ui";
import { CONTEST_SCORE_MAX } from "@/lib/contest-score";
import styles from "./ProductTastingSection.module.css";

type ProductTastingProps = {
  summary: PublicContestProductTastingSummary;
  showArenaLink: boolean;
};

function formatReviewCount(count: number): string {
  return `${count} avis ${count > 1 ? "vérifiés" : "vérifié"}`;
}

export function ProductTastingBadge({ summary }: Pick<ProductTastingProps, "summary">) {
  if (summary.entry.stats.approvedReviewCount === 0) {
    return null;
  }

  return (
    <a
      href="#avis-degustation"
      className="mt-4 inline-flex min-h-11 w-fit items-center gap-2 border-2 border-[#1a1a1a] bg-yellow px-3 py-2 text-sm font-black uppercase text-ink shadow-[3px_3px_0_#1a1a1a] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <Star size={17} fill="currentColor" aria-hidden="true" />
      <span>{formatContestAverage(summary.entry.stats.averageScore)} / {CONTEST_SCORE_MAX}</span>
      <span aria-hidden="true">·</span>
      <span>{formatReviewCount(summary.entry.stats.approvedReviewCount)}</span>
    </a>
  );
}

function CriterionRow({
  criterion,
  score,
}: {
  criterion: ContestScoreCriterion;
  score: number;
}) {
  const percentage = Math.max(0, Math.min(100, score));

  return (
    <div className={styles.criterion}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold text-charcoal">
          {CONTEST_SCORE_CRITERION_LABELS[criterion]}
        </span>
        <span className="shrink-0 text-xs font-black text-ink">
          {formatContestAverage(score)}
        </span>
      </div>
      <div className={styles.bar} aria-hidden="true">
        <div className="h-full bg-yellow" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

export function ProductTastingSection({ summary, showArenaLink }: ProductTastingProps) {
  const { entry, reviews } = summary;
  const criterionAverages = CONTEST_SCORE_CRITERIA.flatMap((criterion) => {
    const score = entry.stats.criterionAverages[criterion];
    return typeof score === "number" ? [{ criterion, score }] : [];
  });

  return (
    <details id="avis-degustation" className={`group ${styles.panel}`}>
      <summary className={`${styles.summary} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink`}>
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">
            Avis vérifiés · carnet de dégustation
          </p>
          <h2 id="avis-degustation-title" className={styles.title}>
            Notes de dégustation et avis
          </h2>
          <p className="mt-2 text-xs font-bold text-charcoal md:text-sm">
            {entry.stats.approvedReviewCount > 0
              ? `${formatContestAverage(entry.stats.averageScore)} / ${CONTEST_SCORE_MAX} · ${formatReviewCount(entry.stats.approvedReviewCount)}`
              : "Aucun avis publié pour le moment"}
          </p>
        </div>
        <span className={styles.toggle}>
          <span className="hidden sm:inline">Voir le détail</span>
          <ChevronDown size={20} aria-hidden="true" className="transition-transform group-open:rotate-180" />
        </span>
      </summary>

      <div className={styles.content}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-2xl text-sm leading-relaxed text-charcoal">
            Notes publiées après modération pour le lot {entry.season?.label ?? entry.title}.
          </p>
          {showArenaLink ? (
            <Link
              href={`/arene/${entry.slug}`}
              className="btn-cartoon btn-secondary inline-flex min-h-11 shrink-0 items-center justify-center px-4 text-xs"
            >
              Voir le carnet complet
            </Link>
          ) : null}
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(260px,0.7fr)_minmax(0,1.3fr)]">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className={`${styles.stat} bg-yellow`}>
              <span className="text-[11px] font-black uppercase tracking-[0.12em] text-charcoal">Note moyenne</span>
              <strong className="font-display text-3xl leading-none text-ink">
                {entry.stats.approvedReviewCount > 0 ? formatContestAverage(entry.stats.averageScore) : "—"}
                <span className="ml-1 text-base">/ {CONTEST_SCORE_MAX}</span>
              </strong>
            </div>
            <div className={`${styles.stat} bg-white`}>
              <span className="text-[11px] font-black uppercase tracking-[0.12em] text-charcoal">Avis publiés</span>
              <strong className="font-display text-3xl leading-none text-ink">{entry.stats.approvedReviewCount}</strong>
            </div>
          </div>

          {criterionAverages.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {criterionAverages.map(({ criterion, score }) => (
                <CriterionRow key={criterion} criterion={criterion} score={score} />
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <div className="flex items-center gap-2">
            <MessageCircle size={20} aria-hidden="true" />
            <h3 className="font-display text-2xl text-ink">Avis publiés</h3>
          </div>

          {reviews.length > 0 ? (
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              {reviews.map((review) => (
                <article key={review.id} className={styles.review}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.1em] text-ink">{review.pseudo}</p>
                      <p className="mt-1 text-xs text-charcoal">{formatContestDate(review.reviewedAt ?? review.createdAt)}</p>
                    </div>
                    <span className={`shrink-0 ${styles.score}`}>
                      {formatContestAverage(getContestReviewAverage(review.scores))} / {CONTEST_SCORE_MAX}
                    </span>
                  </div>

                  <p className={`mt-4 text-sm leading-relaxed text-charcoal ${review.comment.trim() ? "" : "italic"}`}>
                    {review.comment.trim() || "Pas de commentaire rédigé pour ce carnet."}
                  </p>

                  <details className={`group ${styles.reviewDetails}`}>
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
                      Détails de la dégustation
                      <span aria-hidden="true" className="text-base transition-transform group-open:rotate-45">+</span>
                    </summary>
                    <div className="border-t border-[#1a1a1a] p-3">
                      <div className="flex flex-wrap gap-2">
                        <span className={`${styles.tag} bg-white uppercase tracking-[0.06em] text-charcoal`}>
                          {CONTEST_CONSUMPTION_METHOD_LABELS[review.consumptionMethod]}
                        </span>
                        {review.aromaTags.map((aroma) => (
                          <span key={`${review.id}-${aroma.tag}-${aroma.customLabel ?? ""}`} className={`${styles.tag} uppercase tracking-[0.06em] text-ink`}>
                            {aroma.tag === "other" ? aroma.customLabel : CONTEST_AROMA_TAG_LABELS[aroma.tag]}
                          </span>
                        ))}
                      </div>
                    </div>
                  </details>
                </article>
              ))}
            </div>
          ) : (
            <div className={`${styles.empty} text-sm leading-relaxed text-charcoal`}>
              Ce lot n&apos;a pas encore d&apos;avis publié.
            </div>
          )}
        </div>
        </div>
      </div>
    </details>
  );
}
