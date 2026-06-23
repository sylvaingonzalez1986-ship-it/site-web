"use client";

import type { ViewerContestReview } from "@/lib/contest-public-api";
import { formatContestAverage, getContestReviewAverage } from "@/lib/contest-ui";
import { CONTEST_SCORE_DEFAULT, CONTEST_SCORE_MAX } from "@/lib/contest-score";
import {
  CONTEST_SCORE_CRITERIA,
  type ContestCriterionAverages,
  type ContestScoreCriterion,
} from "@/types/contest";

type ReviewScoreMap = Record<ContestScoreCriterion, number>;
type RadarScore = {
  criterion: ContestScoreCriterion;
  score: number;
};

type ContestReviewSkillRadarProps = {
  review: ViewerContestReview;
  comparisonScores?: ContestCriterionAverages;
  compact?: boolean;
  showLegend?: boolean;
  showValues?: boolean;
  showTotals?: boolean;
  className?: string;
};

const NOTES_SUMMARY_SCORE_ORDER: ContestScoreCriterion[] = [
  "appearance",
  "manicure",
  "drying_curing",
  "cold_aroma",
  "aroma_intensity",
  "aroma_complexity",
  "flavor",
  "smoothness_burn",
  "persistence",
];

const NOTES_SUMMARY_SCORE_LABELS: Record<ContestScoreCriterion, string> = {
  appearance: "Aspect",
  manicure: "Manucure",
  drying_curing: "Curing",
  cold_aroma: "Nez",
  aroma_intensity: "Intensite",
  aroma_complexity: "Complexite",
  flavor: "Gout",
  smoothness_burn: "Douceur",
  persistence: "Tenue",
  overall_impression: "Verdict",
};

function buildInitialScores(): ReviewScoreMap {
  return Object.fromEntries(
    CONTEST_SCORE_CRITERIA.map((criterion) => [criterion, CONTEST_SCORE_DEFAULT]),
  ) as ReviewScoreMap;
}

function buildScoresFromReview(review: ViewerContestReview): ReviewScoreMap {
  const scores = buildInitialScores();

  for (const score of review.scores) {
    scores[score.criterion] = score.score;
  }

  return scores;
}

function getRadarPoint(index: number, total: number, radius: number, center: number) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / total;

  return {
    x: center + Math.cos(angle) * radius,
    y: center + Math.sin(angle) * radius,
  };
}

function formatRadarPoint(point: { x: number; y: number }): string {
  return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
}

function clampRadarScore(score: number): number {
  return Math.max(0, Math.min(CONTEST_SCORE_MAX, score));
}

function buildOrderedScoresFromReview(review: ViewerContestReview): RadarScore[] {
  const scoreMap = buildScoresFromReview(review);

  return NOTES_SUMMARY_SCORE_ORDER.map((criterion) => ({
    criterion,
    score: clampRadarScore(scoreMap[criterion]),
  }));
}

function buildOrderedScoresFromAverages(averages?: ContestCriterionAverages): RadarScore[] | null {
  if (!averages) {
    return null;
  }

  const scores: RadarScore[] = [];
  for (const criterion of NOTES_SUMMARY_SCORE_ORDER) {
    const score = averages[criterion];
    if (typeof score !== "number" || !Number.isFinite(score)) {
      return null;
    }

    scores.push({
      criterion,
      score: clampRadarScore(score),
    });
  }

  return scores;
}

function getRadarPolygonPoints(scores: RadarScore[], maxRadius: number, center: number): string {
  const total = scores.length;

  return scores
    .map((item, index) => {
      const radius = (item.score / CONTEST_SCORE_MAX) * maxRadius;
      return formatRadarPoint(getRadarPoint(index, total, radius, center));
    })
    .join(" ");
}

export function ContestReviewSkillRadar({
  review,
  comparisonScores,
  compact = false,
  showLegend = true,
  showValues = true,
  showTotals = true,
  className = "",
}: ContestReviewSkillRadarProps) {
  const scoreMap = buildScoresFromReview(review);
  const averageScore = formatContestAverage(getContestReviewAverage(review.scores));
  const verdictScore = scoreMap.overall_impression;
  const orderedScores = buildOrderedScoresFromReview(review);
  const comparisonOrderedScores = buildOrderedScoresFromAverages(comparisonScores);
  const hasComparisonScores = comparisonOrderedScores !== null;
  const center = 150;
  const maxRadius = 84;
  const labelRadius = 124;
  const total = orderedScores.length;
  const dataPoints = getRadarPolygonPoints(orderedScores, maxRadius, center);
  const comparisonDataPoints = comparisonOrderedScores
    ? getRadarPolygonPoints(comparisonOrderedScores, maxRadius, center)
    : "";
  const rootClassName = [
    "contest-review-skill-chart",
    compact ? "contest-review-skill-chart-compact" : "",
    hasComparisonScores ? "contest-review-skill-chart-with-comparison" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClassName} aria-label="Graphique des notes par critere">
      <svg className="contest-review-skill-radar" viewBox="0 0 300 300" role="img">
        <title>Graphique etoile des notes de degustation</title>
        {[0.25, 0.5, 0.75, 1].map((ratio) => (
          <polygon
            key={ratio}
            points={orderedScores
              .map((_, index) => formatRadarPoint(getRadarPoint(index, total, maxRadius * ratio, center)))
              .join(" ")}
            className="contest-review-skill-ring"
          />
        ))}
        {orderedScores.map((item, index) => {
          const edgePoint = getRadarPoint(index, total, maxRadius, center);
          const labelPoint = getRadarPoint(index, total, labelRadius, center);
          const textAnchor = labelPoint.x < center - 18 ? "end" : labelPoint.x > center + 18 ? "start" : "middle";

          return (
            <g key={item.criterion}>
              <line
                x1={center}
                y1={center}
                x2={edgePoint.x}
                y2={edgePoint.y}
                className="contest-review-skill-axis"
              />
              <text
                x={labelPoint.x}
                y={labelPoint.y}
                textAnchor={textAnchor}
                dominantBaseline="middle"
                className="contest-review-skill-label"
              >
                {NOTES_SUMMARY_SCORE_LABELS[item.criterion]}
              </text>
            </g>
          );
        })}
        {hasComparisonScores ? (
          <polygon points={comparisonDataPoints} className="contest-review-skill-area contest-review-skill-area-average" />
        ) : null}
        <polygon
          points={dataPoints}
          className={`contest-review-skill-area ${hasComparisonScores ? "contest-review-skill-area-self" : ""}`}
        />
        {comparisonOrderedScores?.map((item, index) => {
          const radius = (item.score / CONTEST_SCORE_MAX) * maxRadius;
          const point = getRadarPoint(index, total, radius, center);

          return (
            <circle
              key={`${item.criterion}-average-point`}
              cx={point.x}
              cy={point.y}
              r="3.4"
              className="contest-review-skill-point contest-review-skill-point-average"
            />
          );
        })}
        {orderedScores.map((item, index) => {
          const radius = (item.score / CONTEST_SCORE_MAX) * maxRadius;
          const point = getRadarPoint(index, total, radius, center);

          return (
            <circle
              key={`${item.criterion}-point`}
              cx={point.x}
              cy={point.y}
              r="3.8"
              className={`contest-review-skill-point ${hasComparisonScores ? "contest-review-skill-point-self" : ""}`}
            />
          );
        })}
      </svg>
      {hasComparisonScores && showLegend ? (
        <div className="contest-review-skill-legend" aria-label="Legende du graphique">
          <span className="contest-review-skill-legend-self">Toi</span>
          <span className="contest-review-skill-legend-average">Moyenne</span>
        </div>
      ) : null}
      {showValues ? (
        <div className="contest-review-skill-values" aria-label="Notes detaillees">
          {orderedScores.map((item) => (
            <span key={item.criterion}>
              <strong>{NOTES_SUMMARY_SCORE_LABELS[item.criterion]}</strong>
              {item.score}
            </span>
          ))}
        </div>
      ) : null}
      {showTotals ? (
        <div className="contest-review-skill-totals" aria-label="Synthese des notes">
          <span>
            <strong>Note globale</strong>
            {averageScore}/{CONTEST_SCORE_MAX}
          </span>
          <span>
            <strong>Verdict</strong>
            {verdictScore}/{CONTEST_SCORE_MAX}
          </span>
        </div>
      ) : null}
    </div>
  );
}
