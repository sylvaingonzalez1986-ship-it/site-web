import Link from "@/components/navigation/NavigationLink";
import { ArrowLeft, BookOpen, Medal } from "lucide-react";
import { CONTEST_CONSUMPTION_METHOD_LABELS, type ContestPublicTesterProfile } from "@/types/contest";
import { formatContestAverage, formatContestDate, getContestReviewAverage } from "@/lib/contest-ui";
import { CONTEST_SCORE_MAX } from "@/lib/contest-score";
import { KqChapterHeading } from "../placard/KqChapterHeading";
import { KqProgressMeter } from "../placard/KqVisuals";
import styles from "./ArenaPublicTesterProfile.module.css";

export function ArenaPublicTesterProfile({ profile, backHref }: { profile: ContestPublicTesterProfile; backHref: string }) {
  const { progress } = profile;
  return <section className={styles.page}>
    <div className={`retro-container ${styles.container}`}>
      <nav className={styles.breadcrumb} aria-label="Fil d’Ariane">
        <Link href={backHref}><ArrowLeft size={17} aria-hidden="true" />Retour aux classements</Link>
        <span>{profile.profile.pseudo}</span>
      </nav>

      <KqChapterHeading art="collection" level={1} title={`Profil de ${profile.profile.pseudo}`}>
        <p>{progress.currentLevel.label}</p>
      </KqChapterHeading>

      <section className={styles.progressSheet} aria-label="Progression du testeur">
        <dl className={styles.numbers}>
          <div><dt>Points testeur</dt><dd>{progress.totalPoints.toLocaleString("fr-FR")} <small>pts</small></dd></div>
          <div><dt>Place · saison</dt><dd>{progress.seasonRank ? `#${progress.seasonRank}` : "Non classé"}</dd></div>
          <div><dt>Place · global</dt><dd>{progress.globalRank ? `#${progress.globalRank}` : "Non classé"}</dd></div>
        </dl>
        {progress.nextLevel ? <KqProgressMeter
          label={`Vers ${progress.nextLevel.label}`}
          value={progress.pointsIntoLevel}
          max={progress.pointsIntoLevel + progress.pointsToNextLevel}
          valueLabel={`${progress.pointsToNextLevel.toLocaleString("fr-FR")} points restants`}
          tone="gold"
        /> : <p className={styles.levelComplete}>Dernier niveau atteint : {progress.currentLevel.label}.</p>}
      </section>

      <div className={styles.columns}>
        <section className={styles.badges} aria-labelledby="tester-distinctions">
          <div className={styles.sectionHeading}><Medal size={24} aria-hidden="true" /><h2 id="tester-distinctions">Les distinctions</h2></div>
          {profile.badges.length > 0 ? <ul className={styles.badgeList}>{profile.badges.map(badge => <li key={badge.id}>
            <strong>{badge.badge?.label ?? badge.badgeId}</strong>
            <p>{badge.rewardPackCount} booster{badge.rewardPackCount > 1 ? "s" : ""} · {badge.rewardClaimedAt ? "réclamé" : "à réclamer"}{badge.rewardClaimedAt && badge.rewardPackCount > 1 ? "s" : ""}</p>
          </li>)}</ul> : <p className={styles.empty}>Aucun badge débloqué pour le moment.</p>}
        </section>

        <section className={styles.reviews} aria-labelledby="tester-reviews">
          <div className={styles.sectionHeading}><BookOpen size={24} aria-hidden="true" /><h2 id="tester-reviews">Les carnets validés</h2></div>
          {profile.reviews.length > 0 ? <div className={styles.reviewList}>{profile.reviews.map(review => <article key={review.id} className={styles.review}>
            <header><div>
              <h3><Link href={review.entrySlug ? `/arene/${review.entrySlug}` : "/arene/carnet/classement"}>{review.entryTitle ?? review.entryId}</Link></h3>
              <p>{CONTEST_CONSUMPTION_METHOD_LABELS[review.consumptionMethod]} · {formatContestDate(review.reviewedAt ?? review.createdAt)}</p>
            </div><span className={styles.reviewScore}><strong>{formatContestAverage(getContestReviewAverage(review.scores))}</strong><small>/ {CONTEST_SCORE_MAX}</small></span></header>
            <p className={styles.reviewComment}>{review.comment.trim() || "Pas de critique rédigée pour ce carnet."}</p>
          </article>)}</div> : <p className={styles.empty}>Aucune critique approuvée pour le moment.</p>}
        </section>
      </div>
    </div>
  </section>;
}
