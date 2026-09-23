import Link from "@/components/navigation/NavigationLink";
import { ArrowDown, ArrowUpRight, BookOpen, ChevronDown, MessageCircle, Star } from "lucide-react";
import type { ContestScoreCriterion } from "@/types/contest";
import {
  CONTEST_AROMA_TAG_LABELS,
  CONTEST_CONSUMPTION_METHOD_LABELS,
  CONTEST_SCORE_CRITERIA,
  CONTEST_SCORE_CRITERION_LABELS,
} from "@/types/contest";
import type { PublicContestProductTastingSummary } from "@/lib/contest-public-api";
import { formatContestAverage, formatContestDate, getContestReviewAverage } from "@/lib/contest-ui";
import { CONTEST_SCORE_MAX } from "@/lib/contest-score";
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
    <a href="#avis-degustation" className={styles.badge}>
      <span className={styles.badgeScore}>
        <Star size={16} fill="currentColor" aria-hidden="true" />
        {formatContestAverage(averageScore)} <span>/ {CONTEST_SCORE_MAX}</span>
      </span>
      <span className={styles.badgeLabel}>
        <strong>Les notes du Carnet</strong>
        <span>{formatReviewCount(approvedReviewCount)}</span>
      </span>
      <ArrowDown size={18} aria-hidden="true" />
    </a>
  );
}

function CriterionRow({ criterion, score }: { criterion: ContestScoreCriterion; score: number }) {
  const percentage = Math.max(0, Math.min(100, (score / CONTEST_SCORE_MAX) * 100));
  return (
    <div className={styles.criterion}>
      <div className={styles.criterionLabel}>
        <span>{CONTEST_SCORE_CRITERION_LABELS[criterion]}</span>
        <strong>{formatContestAverage(score)}</strong>
      </div>
      <div className={styles.bar} aria-hidden="true">
        <span style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

export function ProductTastingSection({ summary, showArenaLink }: ProductTastingProps) {
  const { entry, reviews } = summary;
  const reviewCount = entry.stats.approvedReviewCount;
  const criterionAverages = CONTEST_SCORE_CRITERIA.flatMap((criterion) => {
    const score = entry.stats.criterionAverages[criterion];
    return reviewCount > 0 && typeof score === "number" ? [{ criterion, score }] : [];
  });

  return (
    <section id="avis-degustation" aria-labelledby="avis-degustation-title" className={styles.panel}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}><BookOpen size={16} aria-hidden="true" /> Le Carnet · les retours de dégustation</p>
          <h2 id="avis-degustation-title" className={styles.title}>Notes &amp; critiques.</h2>
          <p className={styles.intro}>Leurs impressions, leurs arômes, leurs mots. Découvre ce que les dégustateurs en pensent.</p>
        </div>
        <div className={styles.edition}>
          <span>Le lot dégusté</span>
          <strong>{entry.season?.label ?? entry.title}</strong>
          <span>Avis publiés après modération</span>
        </div>
      </header>

      <div className={styles.content}>
        <aside className={styles.overview} aria-label="Synthèse des notes de dégustation">
          <div className={styles.scoreCard}>
            <p className={styles.label}><Star size={16} aria-hidden="true" /> La note du Carnet</p>
            <div className={styles.average}>
              <strong>{reviewCount > 0 ? formatContestAverage(entry.stats.averageScore) : "—"}</strong>
              <span>/ {CONTEST_SCORE_MAX}</span>
            </div>
            <p className={styles.reviewCount}>{reviewCount > 0 ? formatReviewCount(reviewCount) : "La première note se fait attendre"}</p>
          </div>

          {criterionAverages.length > 0 ? (
            <details className={styles.criteria}>
              <summary>Le profil du lot <ChevronDown size={18} aria-hidden="true" /></summary>
              <p className={styles.criteriaHint}>Les moyennes, critère par critère, sur {CONTEST_SCORE_MAX}.</p>
              <div className={styles.criteriaRows}>
                {criterionAverages.map(({ criterion, score }) => <CriterionRow key={criterion} criterion={criterion} score={score} />)}
              </div>
            </details>
          ) : null}

          <p className={styles.sourceNote}><BookOpen size={18} aria-hidden="true" /><span>Ces notes et critiques proviennent des carnets de dégustation remplis pour ce lot.</span></p>
          {showArenaLink ? (
            <Link href={`/arene/${entry.slug}`} className={styles.carnetLink}>
              Voir le carnet complet <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          ) : null}
        </aside>

        <div className={styles.reviews}>
          <div className={styles.reviewsHeading}>
            <h3 className={styles.subheading}><MessageCircle size={20} aria-hidden="true" /> À lire dans le Carnet</h3>
            {reviews.length > 0 ? <span>{reviews.length < reviewCount ? `${reviews.length} derniers avis sur ${reviewCount}` : formatReviewCount(reviewCount)}</span> : null}
          </div>

          {reviews.length > 0 ? (
            <div className={styles.reviewList}>
              {reviews.map((review) => (
                <article key={review.id} className={styles.review}>
                  <header className={styles.reviewHeader}>
                    <div className={styles.author}>
                      <span className={styles.initial} aria-hidden="true">{Array.from(review.pseudo.trim())[0]?.toLocaleUpperCase("fr-FR") ?? "C"}</span>
                      <div>
                        <h4>{review.pseudo}</h4>
                        <p>{formatContestDate(review.reviewedAt ?? review.createdAt)}</p>
                      </div>
                    </div>
                    <span className={styles.reviewScore}>
                      <strong>{formatContestAverage(getContestReviewAverage(review.scores))}</strong>
                      <span>/ {CONTEST_SCORE_MAX}</span>
                    </span>
                  </header>
                  <p className={`${styles.comment} ${review.comment.trim() ? "" : styles.noComment}`}>
                    {review.comment.trim() || "Ce dégustateur a partagé ses notes sans ajouter de critique."}
                  </p>
                  <details className={styles.reviewDetails}>
                    <summary>Détail de sa dégustation <ChevronDown size={17} aria-hidden="true" /></summary>
                    <div className={styles.detailsContent}>
                      <div className={styles.tags}>
                        <span className={styles.method}>{CONTEST_CONSUMPTION_METHOD_LABELS[review.consumptionMethod]}</span>
                        {review.aromaTags.map((aroma) => (
                          <span key={`${review.id}-${aroma.tag}-${aroma.customLabel ?? ""}`} className={styles.tag}>
                            {aroma.tag === "other" ? aroma.customLabel : CONTEST_AROMA_TAG_LABELS[aroma.tag]}
                          </span>
                        ))}
                      </div>
                      {review.scores.length > 0 ? (
                        <dl className={styles.reviewCriteria}>
                          {CONTEST_SCORE_CRITERIA.flatMap((criterion) => {
                            const score = review.scores.find((item) => item.criterion === criterion)?.score;
                            return typeof score === "number" ? [
                              <div key={criterion}>
                                <dt>{CONTEST_SCORE_CRITERION_LABELS[criterion]}</dt>
                                <dd>{formatContestAverage(score)} <span>/ {CONTEST_SCORE_MAX}</span></dd>
                              </div>,
                            ] : [];
                          })}
                        </dl>
                      ) : null}
                    </div>
                  </details>
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
        </div>
      </div>
    </section>
  );
}
