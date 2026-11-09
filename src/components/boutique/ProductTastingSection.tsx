"use client";

import Link from "@/components/navigation/NavigationLink";
import { ContestReviewSkillRadar } from "@/components/contest/ContestReviewSkillRadar";
import { useContestReviewPages } from "@/components/contest/useContestReviewPages";
import { ArrowDown, ArrowUpRight, BookOpen, MessageCircle, Star } from "lucide-react";
import type { ContestReviewScore } from "@/types/contest";
import {
  CONTEST_AROMA_TAG_LABELS,
  CONTEST_CONSUMPTION_METHOD_LABELS,
  CONTEST_SCORE_CRITERIA,
} from "@/types/contest";
import type { PublicContestProductTastingSummary } from "@/lib/contest-public-api";
import { formatContestAverage, formatContestDate, getContestReviewAverage } from "@/lib/contest-ui";
import { CONTEST_SCORE_MAX } from "@/lib/contest-score";
import { getProductTastingNotebookHref } from "@/lib/contest-product-tasting";
import styles from "./ProductTastingSection.module.css";

type ProductTastingProps = {
  summary: PublicContestProductTastingSummary;
  showArenaLink: boolean;
};

function formatReviewCount(count: number): string {
  return `${count} avis ${count > 1 ? "publiés" : "publié"}`;
}

export function ProductTastingBadge({ summary }: Pick<ProductTastingProps, "summary">) {
  const { approvedReviewCount, averageScore } = summary.entry.stats;
  if (approvedReviewCount === 0) return null;

  return (
    <a data-ui-commerce="tasting-badge" data-ui-shape="control" href="#avis-degustation" className={styles.badge}>
      <span className={styles.badgeScore}>
        <Star size={16} fill="currentColor" aria-hidden="true" />
        {formatContestAverage(averageScore)} <span>/ {CONTEST_SCORE_MAX}</span>
      </span>
      <span className={styles.badgeLabel}>
        <strong>NOTES</strong>
        <span>{formatReviewCount(approvedReviewCount)}</span>
      </span>
      <ArrowDown size={18} aria-hidden="true" />
    </a>
  );
}

function TastingRadar({ scores }: { scores: ContestReviewScore[] }) {
  if (!scores.some(({ score }) => Number.isFinite(score))) return null;
  const verdict = scores.find(({ criterion }) => criterion === "overall_impression")?.score;
  const hasMissingScores = CONTEST_SCORE_CRITERIA.some((criterion) =>
    !scores.some((item) => item.criterion === criterion && Number.isFinite(item.score)),
  );

  return (
    <figure className={styles.radar}>
      <ContestReviewSkillRadar review={{ scores }} showValues={false} showAxisValues showTotals={false} />
      <figcaption className={styles.radarCaption}>
        <span>Notes sur {CONTEST_SCORE_MAX}</span>
        <span>Verdict <strong>{formatContestAverage(verdict)} / {CONTEST_SCORE_MAX}</strong></span>
      </figcaption>
      {hasMissingScores ? <p className={styles.criteriaHint}>— : note non renseignée.</p> : null}
    </figure>
  );
}

export function ProductTastingSection({ summary, showArenaLink }: ProductTastingProps) {
  const { entry } = summary;
  const { reviews, hasMore, loading, error, loadMore } = useContestReviewPages(
    summary.reviews, summary.nextReviewCursor, `/api/boutique/tasting/${encodeURIComponent(entry.id)}/reviews`,
  );
  const notebookHref = getProductTastingNotebookHref(entry);
  const reviewCount = entry.stats.approvedReviewCount;
  const criterionAverages = CONTEST_SCORE_CRITERIA.flatMap((criterion) => {
    const score = entry.stats.criterionAverages[criterion];
    return reviewCount > 0 && typeof score === "number" && Number.isFinite(score) ? [{ criterion, score }] : [];
  });

  return (
    <section data-ui-commerce="paper" data-ui-shape="panel" id="avis-degustation" aria-labelledby="avis-degustation-title" className={styles.panel}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}><BookOpen size={16} aria-hidden="true" /> Le Carnet · les retours de dégustation</p>
          <h2 id="avis-degustation-title" className={styles.title}>Notes &amp; critiques.</h2>
          <p className={styles.intro}>Leurs impressions, leurs arômes, leurs mots. Découvre ce que les dégustateurs en pensent.</p>
        </div>
        <div className={styles.edition}>
          <span>Le lot dégusté</span>
          <strong>{entry.title}</strong>
          {entry.season ? <span>{entry.season.label}{entry.season.isArchived ? " · Archive" : ""}</span> : null}
          <span>Avis publiés après modération</span>
        </div>
      </header>

      <div className={styles.content}>
        <aside className={styles.overview} aria-label="Synthèse des notes de dégustation">
          <div data-ui-commerce="gold" data-ui-shape="panel" className={styles.scoreCard}>
            <p className={styles.label}><Star size={16} aria-hidden="true" /> La note du Carnet</p>
            <div className={styles.average}>
              <strong>{reviewCount > 0 ? formatContestAverage(entry.stats.averageScore) : "—"}</strong>
              <span>/ {CONTEST_SCORE_MAX}</span>
            </div>
            <p className={styles.reviewCount}>{reviewCount > 0 ? formatReviewCount(reviewCount) : "La première note se fait attendre"}</p>
            <p className={styles.criteriaHint}>Moyenne des {CONTEST_SCORE_CRITERIA.length} critères de dégustation.</p>
          </div>

          {criterionAverages.length > 0 ? (
            <div className={styles.criteria}>
              <h3 className={styles.subheading}>Le profil du lot</h3>
              <p className={styles.criteriaHint}>Les moyennes, critère par critère, sur {CONTEST_SCORE_MAX}.</p>
              <TastingRadar scores={criterionAverages} />
            </div>
          ) : null}

          <p className={styles.sourceNote}><BookOpen size={18} aria-hidden="true" /><span>Ces notes et critiques concernent le lot indiqué. La moyenne prend en compte tous les avis publiés après modération.</span></p>
          {showArenaLink ? (
            <>
              <p className={styles.sourceNote}><span><strong>10 g de fleurs à gagner chaque mois.</strong> Un seul avis validé sur une fleur achetée te fait participer aux tirages du 1er de chaque mois, quelle que soit ta note. Tes anciens avis comptent aussi. Un gagnant, un bon à réclamer avec une commande. Règles dans le Carnet.</span></p>
              <Link href={getProductTastingNotebookHref(entry, true)} className={styles.carnetLink}>
                Noter cette fleur <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
              <Link href={notebookHref} className={styles.carnetLink}>
                Ouvrir mon carnet <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </>
          ) : null}
        </aside>

        <div className={styles.reviews}>
          <div className={styles.reviewsHeading}>
            <h3 className={styles.subheading}><MessageCircle size={20} aria-hidden="true" /> À lire dans le Carnet</h3>
            {reviews.length > 0 ? <span aria-live="polite">{reviews.length} avis {reviews.length > 1 ? "affichés" : "affiché"} · plus récents d’abord</span> : null}
          </div>

          {reviews.length > 0 ? (
            <div className={styles.reviewList}>
              {reviews.map((review) => (
                <article data-ui-commerce="paper" data-ui-shape="panel" key={review.id} className={styles.review}>
                  <header className={styles.reviewHeader}>
                    <div className={styles.author}>
                      <span className={styles.initial} aria-hidden="true">{Array.from(review.pseudo.trim())[0]?.toLocaleUpperCase("fr-FR") ?? "C"}</span>
                      <div>
                        <h4>{review.pseudo}</h4>
                        <p>{formatContestDate(review.reviewedAt ?? review.createdAt)}</p>
                      </div>
                    </div>
                    <span data-ui-commerce="gold" data-ui-shape="panel" className={styles.reviewScore}>
                      <strong>{formatContestAverage(getContestReviewAverage(review.scores))}</strong>
                      <span>/ {CONTEST_SCORE_MAX}</span>
                    </span>
                  </header>
                  <div className={styles.reviewBody}>
                    <div className={styles.reviewCopy}>
                      <p className={`${styles.comment} ${review.comment.trim() ? "" : styles.noComment}`}>
                        {review.comment.trim() || "Ce dégustateur a partagé ses notes sans ajouter de critique."}
                      </p>
                      <div className={styles.tags}>
                        <span className={styles.method}>{CONTEST_CONSUMPTION_METHOD_LABELS[review.consumptionMethod]}</span>
                        {review.aromaTags.map((aroma) => (
                          <span key={`${review.id}-${aroma.tag}-${aroma.customLabel ?? ""}`} className={styles.tag}>
                            {aroma.tag === "other" ? aroma.customLabel : CONTEST_AROMA_TAG_LABELS[aroma.tag]}
                          </span>
                        ))}
                      </div>
                    </div>
                    <TastingRadar scores={review.scores} />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <BookOpen size={36} strokeWidth={1.5} aria-hidden="true" />
              <h4>Une page encore blanche.</h4>
              <p>Ce lot n’a pas encore d’avis publié. Les notes et critiques apparaîtront ici après modération.</p>
            </div>
          )}
          {error ? <p role="alert" className={styles.paginationStatus}>{error}</p> : null}
          {hasMore ? (
            <button data-ui-commerce="paper-control" data-ui-shape="control" type="button" className={styles.loadMore} onClick={() => void loadMore()} disabled={loading}>
              {loading ? "Chargement des avis…" : error ? "Réessayer de charger les avis" : "Lire les avis suivants"}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
