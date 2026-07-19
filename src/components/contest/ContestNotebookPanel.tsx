"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ContestReviewSkillRadar } from "@/components/contest/ContestReviewSkillRadar";
import styles from "./ContestNotebookPanel.module.css";
import {
  CONTEST_AROMA_TAG_LABELS,
  CONTEST_AROMA_TAGS,
  CONTEST_CONSUMPTION_METHOD_LABELS,
  CONTEST_CONSUMPTION_METHODS,
  CONTEST_ENTRY_CATEGORY_LABELS,
  CONTEST_REVIEW_STATUS_LABELS,
  CONTEST_SCORE_CRITERIA,
  CONTEST_SCORE_CRITERION_LABELS,
  type ContestAromaTag,
  type ContestEntrySummary,
  type ContestReviewAromaSelection,
  type ContestReviewEligibility,
  type ContestReviewSubmissionInput,
  type ContestScoreCriterion,
} from "@/types/contest";
import type { PublicContestProfile, ViewerContestReview } from "@/lib/contest-public-api";
import {
  formatContestAverage,
  getContestEligibilityMessage,
  getContestReviewAverage,
} from "@/lib/contest-ui";
import {
  CONTEST_SCORE_DEFAULT,
  CONTEST_SCORE_MAX,
  CONTEST_SCORE_MIN,
} from "@/lib/contest-score";
import {
  CANNABIS_TERPENE_OPTIONS,
  normalizeContestTerpene,
} from "@/lib/contest-terpenes";
import {
  CONTEST_AROMA_LEXICON_GUIDE,
  CONTEST_CBD_TASTING_RULES,
  CONTEST_CRITERION_GUIDES,
  CONTEST_PREPARATION_GUIDE,
  CONTEST_STANDARD_GUIDE,
  CONTEST_VERDICT_GUIDE,
  type ContestCriterionGuide,
} from "@/lib/contest-tasting-guide";

type ContestNotebookPanelProps = {
  entry: ContestEntrySummary;
  viewerProfile: PublicContestProfile | null;
  viewerReview: ViewerContestReview | null;
  eligibility: ContestReviewEligibility;
  loginHref: string;
  productHref?: string | null;
  displayMode?: "card" | "button" | "spread";
  defaultGuideOpen?: boolean;
  useDesktopSpreadGuide?: boolean;
  onOpenGuide?: () => void;
  onCloseGuide?: () => void;
};

type ReviewScoreMap = Record<ContestScoreCriterion, number>;
type TastingStepMascotKey = "start" | "aspect" | "smell" | "taste" | "verdict";

const GUIDE_PAGES = [
  "Démarrer",
  "Aspect",
  "Odeur",
  "Goût",
  "Verdict",
] as const;

const GUIDE_PAGE_MASCOTS: readonly TastingStepMascotKey[] = [
  "start",
  "aspect",
  "smell",
  "taste",
  "verdict",
];

const QUICK_STEP_SUMMARY = [
  "Choisis ton mode de dégustation.",
  "Note l'aspect de la fleur.",
  "Trouve les terpènes: boosters à gagner.",
  "Note le goût et le confort.",
  "Relis, ajoute une phrase, envoie.",
] as const;

const QUICK_STEP_SUMMARY_REGULAR = [
  "Choisis ton mode de dégustation.",
  "Note l'aspect de la fleur.",
  "Repère les familles aromatiques.",
  "Note le goût et le confort.",
  "Relis, ajoute une phrase, envoie.",
] as const;

const SCORE_GROUPS: Array<{
  page: "visual" | "aroma" | "tasting" | "verdict";
  title: string;
  criteria: ContestScoreCriterion[];
}> = [
  {
    page: "visual",
    title: "Inspection visuelle",
    criteria: ["appearance", "manicure", "drying_curing"],
  },
  {
    page: "aroma",
    title: "Nez et profil terpénique",
    criteria: ["cold_aroma", "aroma_intensity", "aroma_complexity"],
  },
  {
    page: "tasting",
    title: "Dégustation",
    criteria: ["flavor", "smoothness_burn", "persistence"],
  },
  {
    page: "verdict",
    title: "Verdict",
    criteria: ["overall_impression"],
  },
];

const TASTING_STEP_MASCOTS: Record<TastingStepMascotKey, string> = {
  start: "/contest/mascot/tasting/tasting-start.png",
  aspect: "/contest/mascot/tasting/tasting-aspect.png",
  smell: "/contest/mascot/tasting/tasting-smell.png",
  taste: "/contest/mascot/tasting/tasting-taste.png",
  verdict: "/contest/mascot/tasting/tasting-verdict.png",
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

function getScoreHint(score: number): string {
  if (score <= 30) {
    return "Faible ou défaut marqué";
  }

  if (score <= 60) {
    return "Correct mais perfectible";
  }

  if (score <= 80) {
    return "Très bon niveau";
  }

  return "Niveau concours";
}

function normalizeTerpeneSelection(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const knownCodes = new Set(CANNABIS_TERPENE_OPTIONS.map((terpene) => terpene.code));
  const selected: string[] = [];
  for (const value of values) {
    const terpene = normalizeContestTerpene(value);
    if (terpene && knownCodes.has(terpene) && !selected.includes(terpene)) {
      selected.push(terpene);
    }
  }
  return selected;
}

function isExactTerpeneSelection(expected: string[], selected: string[]): boolean {
  if (expected.length === 0 || expected.length !== selected.length) {
    return false;
  }

  const selectedSet = new Set(selected);
  return expected.every((terpene) => selectedSet.has(terpene));
}

function formatHarvestDate(value: unknown): string {
  if (typeof value !== "string" || !value) {
    return "Non renseignee";
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

function getTechnicalText(value: unknown, fallback = "Non renseigne"): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function ScoreSlider({
  criterion,
  value,
  onChange,
  disabled = false,
}: {
  criterion: ContestScoreCriterion;
  value: number;
  onChange: (criterion: ContestScoreCriterion, nextValue: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className={styles.scoreCard}>
      <div className={styles.scoreTop}>
        <span className={styles.scoreLabel}>
          {CONTEST_SCORE_CRITERION_LABELS[criterion]}
        </span>
        <span className={styles.scorePill}>
          {value}/{CONTEST_SCORE_MAX}
        </span>
      </div>
      <input
        type="range"
        min={CONTEST_SCORE_MIN}
        max={CONTEST_SCORE_MAX}
        step={1}
        value={value}
        onChange={(event) => onChange(criterion, Number(event.target.value))}
        disabled={disabled}
        className={styles.scoreRange}
      />
      <p className={styles.scoreHint}>{getScoreHint(value)}</p>
    </label>
  );
}

function getScoreBandIndex(score: number): number {
  if (score <= 30) {
    return 0;
  }

  if (score <= 60) {
    return 1;
  }

  if (score <= 80) {
    return 2;
  }

  return 3;
}

function GuideCard({
  title,
  eyebrow,
  children,
  tone = "white",
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  tone?: "white" | "cream" | "yellow";
}) {
  const toneClass = tone === "yellow"
    ? styles.guideCardYellow
    : tone === "cream"
      ? styles.guideCardCream
      : "";

  return (
    <div className={`${styles.guideCard} ${toneClass}`}>
      {eyebrow ? (
        <p className={styles.cardEyebrow}>{eyebrow}</p>
      ) : null}
      <h4 className={styles.cardTitle}>{title}</h4>
      <div className={styles.cardBody}>{children}</div>
    </div>
  );
}

function GuideBullets({ items }: { items: string[] }) {
  return (
    <ul className={styles.bullets}>
      {items.map((item) => (
        <li key={item} className={styles.bullet}>
          <span aria-hidden="true" className={styles.bulletMark} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function ScoreBandGuide({
  guide,
  score,
}: {
  guide: ContestCriterionGuide;
  score: number;
}) {
  const activeBand = getScoreBandIndex(score);

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {guide.scoreBands.map((band, index) => (
        <div
          key={`${guide.criterion}-${band.range}`}
          className={`rounded border-2 px-3 py-2 text-xs leading-relaxed ${
            index === activeBand
              ? "border-[#1a1a1a] bg-yellow text-ink"
              : "border-[#1a1a1a] bg-[#f7f4ee] text-charcoal"
          }`}
        >
          <p className="font-black uppercase tracking-[0.08em]">
            {band.range} · {band.label}
          </p>
          <p className="mt-1">{band.description}</p>
        </div>
      ))}
    </div>
  );
}

function CriterionGuideCard({
  guide,
  score,
}: {
  guide: ContestCriterionGuide;
  score: number;
}) {
  return (
    <article className={styles.criterionCard}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-charcoal">
            Méthode de note
          </p>
          <h4 className="text-lg font-black leading-tight text-ink">{guide.shortTitle}</h4>
        </div>
        <span className="rounded-full border-2 border-[#1a1a1a] bg-[#fffaf0] px-3 py-1 text-xs font-black text-ink">
          {score}/{CONTEST_SCORE_MAX}
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-charcoal">{guide.promise}</p>
      <div className="mt-4 rounded border-2 border-[#1a1a1a] bg-[#fffaf0] p-3">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-charcoal">
          Comment faire
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-charcoal">
          {guide.method.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded border-2 border-[#1a1a1a] bg-[#f0fff3] p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#1f5a2f]">
            Bons signes
          </p>
          <div className="mt-2 text-xs leading-relaxed text-charcoal">
            <GuideBullets items={guide.positiveSignals.slice(0, 3)} />
          </div>
        </div>
        <div className="rounded border-2 border-[#1a1a1a] bg-[#fff1ee] p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7a1010]">
            A surveiller
          </p>
          <div className="mt-2 text-xs leading-relaxed text-charcoal">
            <GuideBullets items={guide.warningSignals.slice(0, 3)} />
          </div>
        </div>
      </div>
      <div className="mt-3">
        <ScoreBandGuide guide={guide} score={score} />
      </div>
    </article>
  );
}

function CriterionGuideStack({
  criteria,
  scores,
}: {
  criteria: ContestScoreCriterion[];
  scores: ReviewScoreMap;
}) {
  return (
    <div className={styles.criterionStack}>
      {criteria.map((criterion) => (
        <CriterionGuideCard
          key={criterion}
          guide={CONTEST_CRITERION_GUIDES[criterion]}
          score={scores[criterion]}
        />
      ))}
    </div>
  );
}

function AromaLexiconGrid() {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {CONTEST_AROMA_LEXICON_GUIDE.map((family) => (
        <div key={family.family} className="rounded border-2 border-[#1a1a1a] bg-white p-3">
          <p className="text-sm font-black uppercase tracking-[0.08em] text-ink">{family.family}</p>
          <p className="mt-1 text-xs leading-relaxed text-charcoal">{family.cues}</p>
          <p className="mt-2 text-[11px] font-semibold leading-relaxed text-charcoal">
            Pistes terpènes: {family.nearbyTerpenes}
          </p>
        </div>
      ))}
    </div>
  );
}

function QuickHelp({
  title = "Besoin d'aide ?",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <details className={styles.helpCard}>
      <summary>{title}</summary>
      <div className={styles.helpContent}>{children}</div>
    </details>
  );
}

function ContestTastingStepMascot({
  step,
  compact = false,
}: {
  step: TastingStepMascotKey;
  compact?: boolean;
}) {
  return (
    <div className={compact ? styles.compactMascot : styles.stepMascot} aria-hidden="true">
      <Image
        src={TASTING_STEP_MASCOTS[step]}
        alt=""
        width={408}
        height={771}
        sizes={compact ? "72px" : "(max-width: 768px) 78px, 118px"}
        className="h-auto w-full"
      />
    </div>
  );
}

function QuickStepIntro({
  eyebrow,
  title,
  body,
  mascotStep,
}: {
  eyebrow: string;
  title: string;
  body: string;
  mascotStep?: TastingStepMascotKey;
}) {
  return (
    <div className={styles.stepIntro}>
      <div className={styles.stepIntroCopy}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h3 className={styles.stepTitle}>{title}</h3>
        <p className={styles.stepBody}>{body}</p>
      </div>
      {mascotStep ? <ContestTastingStepMascot step={mascotStep} /> : null}
    </div>
  );
}

function ScoreSliderStack({
  criteria,
  scores,
  onChange,
  disabled,
}: {
  criteria: ContestScoreCriterion[];
  scores: ReviewScoreMap;
  onChange: (criterion: ContestScoreCriterion, nextValue: number) => void;
  disabled: boolean;
}) {
  return (
    <div className={styles.scoreStack}>
      {criteria.map((criterion) => (
        <ScoreSlider
          key={criterion}
          criterion={criterion}
          value={scores[criterion]}
          onChange={onChange}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

function TastingContentGrid({
  left,
  right,
}: {
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <div className={styles.stepGrid}>
      <div className={styles.stepPrimary}>{left}</div>
      <aside className={styles.stepAside} aria-label="Conseils pour cette étape">
        {right}
      </aside>
    </div>
  );
}

export function ContestNotebookPanel({
  entry,
  viewerProfile,
  viewerReview,
  eligibility,
  loginHref,
  productHref,
  displayMode = "card",
  defaultGuideOpen = false,
  useDesktopSpreadGuide = false,
  onOpenGuide,
  onCloseGuide,
}: ContestNotebookPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isSpreadDisplayMode = displayMode === "spread";
  const isInlineDisplayMode = displayMode === "button" || isSpreadDisplayMode;
  const shouldOpenReviewEditor =
    searchParams.get("edit") === "notes" &&
    (viewerReview?.status === "pending" || (!viewerReview && eligibility.eligible));
  const [isPending, startTransition] = useTransition();
  const [isGuideOpen, setIsGuideOpen] = useState(shouldOpenReviewEditor || defaultGuideOpen);
  const [isEditingReview, setIsEditingReview] = useState(
    shouldOpenReviewEditor && viewerReview?.status === "pending",
  );
  const [pageIndex, setPageIndex] = useState(0);
  const inlineGuideRef = useRef<HTMLElement | null>(null);
  const launchButtonRef = useRef<HTMLButtonElement | null>(null);
  const [pseudo, setPseudo] = useState(viewerProfile?.pseudo ?? "");
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [scores, setScores] = useState<ReviewScoreMap>(() =>
    shouldOpenReviewEditor && viewerReview ? buildScoresFromReview(viewerReview) : buildInitialScores(),
  );
  const [consumptionMethod, setConsumptionMethod] =
    useState<ContestReviewSubmissionInput["consumptionMethod"]>(() =>
      shouldOpenReviewEditor && viewerReview ? viewerReview.consumptionMethod : "vaporizer",
    );
  const [consumptionDetails, setConsumptionDetails] = useState(() =>
    shouldOpenReviewEditor && viewerReview ? viewerReview.consumptionDetails ?? "" : "",
  );
  const [comment, setComment] = useState(() =>
    shouldOpenReviewEditor && viewerReview ? viewerReview.comment : "",
  );
  const [selectedTags, setSelectedTags] = useState<ContestAromaTag[]>(() =>
    shouldOpenReviewEditor && viewerReview ? viewerReview.aromaTags.map((tag) => tag.tag) : [],
  );
  const [selectedTerpenes, setSelectedTerpenes] = useState<string[]>(() =>
    shouldOpenReviewEditor && viewerReview ? normalizeTerpeneSelection(viewerReview.terpeneGuesses) : [],
  );
  const [otherAromaLabel, setOtherAromaLabel] = useState(() =>
    shouldOpenReviewEditor && viewerReview
      ? viewerReview.aromaTags.find((tag) => tag.tag === "other")?.customLabel ?? ""
      : "",
  );
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const scoreAverage = useMemo(() => {
    const values = Object.values(scores);
    const total = values.reduce((sum, value) => sum + value, 0);
    return values.length > 0 ? total / values.length : 0;
  }, [scores]);

  const notebookIntro = getContestEligibilityMessage(eligibility.reason);
  const technicalSheet = {
    ...entry.technicalSheet,
    soil: entry.technicalSheet.soil ?? entry.producer?.soil,
  };
  const isConcoursEntry = entry.track === "concours";
  const quickStepSummary = isConcoursEntry ? QUICK_STEP_SUMMARY : QUICK_STEP_SUMMARY_REGULAR;
  const expectedTerpenes = useMemo(
    () => (isConcoursEntry ? normalizeTerpeneSelection(entry.technicalSheet.dominantTerpenes) : []),
    [entry.technicalSheet.dominantTerpenes, isConcoursEntry],
  );
  const terpeneRewardUnlocked = isConcoursEntry && isExactTerpeneSelection(expectedTerpenes, selectedTerpenes);
  const savedTerpeneRewardUnlocked =
    isConcoursEntry &&
    isExactTerpeneSelection(expectedTerpenes, normalizeTerpeneSelection(viewerReview?.terpeneGuesses));
  const savedScores = useMemo(
    () => (viewerReview ? buildScoresFromReview(viewerReview) : null),
    [viewerReview],
  );
  const savedSelectedTags = useMemo(
    () => viewerReview?.aromaTags.map((tag) => tag.tag) ?? [],
    [viewerReview],
  );
  const savedSelectedTerpenes = useMemo(
    () => (isConcoursEntry ? normalizeTerpeneSelection(viewerReview?.terpeneGuesses) : []),
    [isConcoursEntry, viewerReview?.terpeneGuesses],
  );
  const savedOtherAromaLabel =
    viewerReview?.aromaTags.find((tag) => tag.tag === "other")?.customLabel ?? "";
  const isReviewReadOnly = Boolean(viewerReview && !isEditingReview);
  const visibleScores = isReviewReadOnly && savedScores ? savedScores : scores;
  const visibleScoreAverage = isReviewReadOnly && viewerReview
    ? getContestReviewAverage(viewerReview.scores)
    : scoreAverage;
  const visibleConsumptionMethod = isReviewReadOnly && viewerReview
    ? viewerReview.consumptionMethod
    : consumptionMethod;
  const visibleConsumptionDetails = isReviewReadOnly && viewerReview
    ? viewerReview.consumptionDetails ?? ""
    : consumptionDetails;
  const visibleSelectedTags = isReviewReadOnly ? savedSelectedTags : selectedTags;
  const visibleSelectedTerpenes = isConcoursEntry
    ? isReviewReadOnly
      ? savedSelectedTerpenes
      : selectedTerpenes
    : [];
  const visibleOtherAromaLabel = isReviewReadOnly ? savedOtherAromaLabel : otherAromaLabel;
  const visibleComment = isReviewReadOnly && viewerReview ? viewerReview.comment : comment;
  const visibleTerpeneRewardUnlocked =
    isConcoursEntry && (isReviewReadOnly ? savedTerpeneRewardUnlocked : terpeneRewardUnlocked);
  const visibleAromaLabels = visibleSelectedTags.map((tag) =>
    tag === "other" ? visibleOtherAromaLabel || "autre" : CONTEST_AROMA_TAG_LABELS[tag],
  );

  const buildReviewCommentDraft = () => {
    const aromaText = visibleAromaLabels.length > 0 ? visibleAromaLabels.join(", ") : "arômes à préciser";
    const contextText = visibleConsumptionDetails.trim()
      ? ` (${visibleConsumptionDetails.trim()})`
      : "";

    return [
      `Dégustée en ${CONTEST_CONSUMPTION_METHOD_LABELS[visibleConsumptionMethod].toLowerCase()}${contextText}.`,
      `Aspect: ${visibleScores.appearance}/${CONTEST_SCORE_MAX}, nez: ${visibleScores.cold_aroma}/${CONTEST_SCORE_MAX}, goût: ${visibleScores.flavor}/${CONTEST_SCORE_MAX}.`,
      `Arômes perçus: ${aromaText}.`,
      `Impression générale: ${visibleScores.overall_impression}/${CONTEST_SCORE_MAX}.`,
    ].join(" ");
  };

  const fillCommentDraft = () => {
    setComment(buildReviewCommentDraft());
  };

  const handleScoreChange = (criterion: ContestScoreCriterion, nextValue: number) => {
    setScores((current) => ({
      ...current,
      [criterion]: nextValue,
    }));
  };

  const handleToggleTag = (tag: ContestAromaTag) => {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );
  };

  const handleToggleTerpene = (terpene: string) => {
    setSelectedTerpenes((current) =>
      current.includes(terpene)
        ? current.filter((item) => item !== terpene)
        : [...current, terpene],
    );
  };

  const refreshPage = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const closeGuide = useCallback(() => {
    setIsGuideOpen(false);
    onCloseGuide?.();

    if (!isInlineDisplayMode) {
      window.requestAnimationFrame(() => launchButtonRef.current?.focus());
    }

    if (searchParams.get("edit") !== "notes") {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("edit");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [isInlineDisplayMode, onCloseGuide, pathname, router, searchParams]);

  useEffect(() => {
    if (!isGuideOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeGuide();
        return;
      }

      if (event.key !== "Tab" || isInlineDisplayMode || !inlineGuideRef.current) {
        return;
      }

      const focusableElements = Array.from(
        inlineGuideRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (!firstElement || !lastElement) {
        return;
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const focusFrame = isInlineDisplayMode
      ? null
      : window.requestAnimationFrame(() => {
          inlineGuideRef.current?.querySelector<HTMLElement>("[data-tasting-close]")?.focus();
        });
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (focusFrame !== null) {
        window.cancelAnimationFrame(focusFrame);
      }
    };
  }, [closeGuide, isGuideOpen, isInlineDisplayMode]);

  useEffect(() => {
    if (!isGuideOpen || isInlineDisplayMode) {
      return;
    }

    document.body.classList.add("contest-guide-open");
    return () => {
      document.body.classList.remove("contest-guide-open");
    };
  }, [isGuideOpen, isInlineDisplayMode]);

  const savePseudo = async () => {
    setProfileMessage(null);
    setProfileError(null);

    try {
      const response = await fetch("/api/contest/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pseudo }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setProfileError(payload?.error || "Impossible d'enregistrer ce pseudo.");
        return;
      }

      setProfileMessage("Pseudo enregistré. Rechargement du guide...");
      refreshPage();
    } catch {
      setProfileError("Erreur réseau lors de l'enregistrement du pseudo.");
    }
  };

  const submitReview = async () => {
    setReviewMessage(null);
    setReviewError(null);

    const aromaTags: ContestReviewAromaSelection[] = selectedTags.map((tag) => {
      if (tag === "other") {
        return {
          tag,
          customLabel: otherAromaLabel.trim(),
        };
      }

      return { tag };
    });

    try {
      const isUpdate = Boolean(viewerReview && isEditingReview);
      const response = await fetch("/api/contest/reviews", {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId: entry.id,
          consumptionMethod,
          consumptionDetails,
          comment,
          scores,
          aromaTags,
          terpeneGuesses: isConcoursEntry ? selectedTerpenes : [],
        } satisfies ContestReviewSubmissionInput),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setReviewError(payload?.error || "Impossible de soumettre l'avis.");
        return;
      }

      setReviewMessage(
        isUpdate
          ? "Guide modifié. Il reste en modération avant publication."
          : "Guide envoyé. Il apparaîtra publiquement après modération.",
      );
      setIsEditingReview(false);
      refreshPage();
    } catch {
      setReviewError("Erreur réseau lors de l'envoi du guide.");
    }
  };

  const startReviewEdit = useCallback(() => {
    if (!viewerReview) {
      return;
    }

    setScores(buildScoresFromReview(viewerReview));
    setConsumptionMethod(viewerReview.consumptionMethod);
    setConsumptionDetails(viewerReview.consumptionDetails ?? "");
    setComment(viewerReview.comment);
    setSelectedTags(viewerReview.aromaTags.map((tag) => tag.tag));
    setSelectedTerpenes(isConcoursEntry ? normalizeTerpeneSelection(viewerReview.terpeneGuesses) : []);
    setOtherAromaLabel(viewerReview.aromaTags.find((tag) => tag.tag === "other")?.customLabel ?? "");
    setReviewMessage(null);
    setReviewError(null);
    setIsEditingReview(true);
    setPageIndex(0);
    setIsGuideOpen(true);
  }, [isConcoursEntry, viewerReview]);

  const resetGuideScroll = useCallback(() => {
    const root = inlineGuideRef.current;
    if (!root) {
      return;
    }

    const scrollViewport = root.querySelector<HTMLElement>("[data-tasting-scroll]");
    if (scrollViewport) {
      scrollViewport.scrollTop = 0;
      return;
    }

    root.scrollTop = 0;
  }, []);

  useEffect(() => {
    if (!isGuideOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(resetGuideScroll);
    return () => window.cancelAnimationFrame(frame);
  }, [isGuideOpen, pageIndex, resetGuideScroll]);

  const goToGuidePage = (nextPage: number) => {
    const boundedPage = Math.max(0, Math.min(GUIDE_PAGES.length - 1, nextPage));
    setPageIndex(boundedPage);

    if (boundedPage === pageIndex) {
      window.requestAnimationFrame(resetGuideScroll);
      window.setTimeout(resetGuideScroll, 60);
    }
  };

  const goToNextPage = () => goToGuidePage(pageIndex + 1);
  const goToPreviousPage = () => goToGuidePage(pageIndex - 1);
  const openGuide = () => {
    const shouldUseDesktopSpreadGuide =
      useDesktopSpreadGuide &&
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 768px)").matches;

    if (shouldUseDesktopSpreadGuide && onOpenGuide) {
      onOpenGuide();
      return;
    }

    setIsGuideOpen(true);
    setPageIndex(viewerReview ? GUIDE_PAGES.length - 1 : 0);
  };

  const renderLockedState = () => {
    if (eligibility.reason === "not_authenticated") {
      return (
        <div className="rounded border-2 border-[#1a1a1a] bg-white p-4">
          <p className="text-sm text-charcoal">
            La publication d&apos;une note est réservée aux clients connectés.
          </p>
          <Link
            href={loginHref}
            className="btn-cartoon btn-primary mt-4 inline-flex min-h-[44px] items-center justify-center px-5 text-xs leading-none"
          >
            Se connecter pour déguster
          </Link>
        </div>
      );
    }

    if (!viewerProfile) {
      return (
        <div className="rounded border-2 border-[#1a1a1a] bg-white p-4">
          <label className="block text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">
            Pseudo dégustateur
          </label>
          <input
            type="text"
            value={pseudo}
            onChange={(event) => setPseudo(event.target.value)}
            placeholder="Ex: BretonTerpene"
            className="mt-2 h-12 w-full border-2 border-[#1a1a1a] bg-[#fffaf0] px-3 text-base text-ink"
          />
          <p className="mt-2 text-xs text-charcoal">
            Ce pseudo signera toutes tes critiques publiées dans l&apos;espace concours.
          </p>
          <button
            type="button"
            onClick={savePseudo}
            disabled={isPending}
            className="btn-cartoon btn-primary mt-4 inline-flex min-h-[44px] items-center justify-center px-5 text-xs leading-none disabled:opacity-60"
          >
            {isPending ? "Enregistrement..." : "Enregistrer mon pseudo"}
          </button>
          {profileMessage ? <p className="mt-3 text-sm font-semibold text-[#1f5a2f]">{profileMessage}</p> : null}
          {profileError ? <p className="mt-3 text-sm font-semibold text-[#7a1010]">{profileError}</p> : null}
        </div>
      );
    }

    if (eligibility.reason === "not_purchased") {
      return (
        <div className="rounded border-2 border-[#1a1a1a] bg-white p-4">
          <p className="text-sm leading-relaxed text-charcoal">
            L&apos;avis public n&apos;est ouvert qu&apos;aux clients ayant acheté ce lot.
          </p>
          {productHref ? (
            <Link
              href={productHref}
              className="btn-cartoon btn-secondary mt-4 inline-flex min-h-[44px] items-center justify-center px-5 text-xs leading-none"
            >
              Aller au produit
            </Link>
          ) : null}
        </div>
      );
    }

    return null;
  };

  const renderExistingReview = () => {
    if (!viewerReview) {
      return null;
    }

    return (
      <div className="contest-guide-verdict-review space-y-4">
        <div className="rounded border-2 border-[#1a1a1a] bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">
                Ton guide
              </p>
              <h3 className="text-2xl font-bold text-ink">{viewerReview.pseudo}</h3>
            </div>
            <div className="flex items-start gap-3 self-start">
              <div className="rounded-full border-2 border-[#1a1a1a] bg-[#fffaf0] px-3 py-2 text-sm font-black text-ink">
                {CONTEST_REVIEW_STATUS_LABELS[viewerReview.status]}
              </div>
              <ContestTastingStepMascot step="verdict" compact />
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="flex min-h-[88px] flex-col justify-between rounded border border-[#1a1a1a] bg-[#f7f4ee] px-3 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-charcoal">
                Moyenne personnelle
              </p>
              <p className="mt-2 text-lg font-bold leading-tight text-ink">
                {formatContestAverage(getContestReviewAverage(viewerReview.scores))} / {CONTEST_SCORE_MAX}
              </p>
            </div>
            <div className="flex min-h-[88px] flex-col justify-between rounded border border-[#1a1a1a] bg-[#f7f4ee] px-3 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-charcoal">
                Mode consommation
              </p>
              <p className="mt-2 text-sm font-bold leading-tight text-ink">
                {CONTEST_CONSUMPTION_METHOD_LABELS[viewerReview.consumptionMethod]}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            {viewerReview.scores.map((score) => (
              <div
                key={score.criterion}
                className="flex items-start justify-between gap-3 rounded border border-[#1a1a1a] bg-white px-3 py-2 sm:items-center"
              >
                <span className="text-sm leading-relaxed text-charcoal">
                  {CONTEST_SCORE_CRITERION_LABELS[score.criterion]}
                </span>
                <span className="mt-0.5 rounded-full border border-[#1a1a1a] bg-[#fffaf0] px-2 py-1 text-xs font-black text-ink sm:mt-0">
                  {score.score}/{CONTEST_SCORE_MAX}
                </span>
              </div>
            ))}
          </div>

          {viewerReview.aromaTags.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {viewerReview.aromaTags.map((tag) => (
                <span
                  key={`${tag.tag}-${tag.customLabel ?? ""}`}
                  className="rounded-full border-2 border-[#1a1a1a] bg-yellow px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-ink"
                >
                  {tag.tag === "other" ? tag.customLabel : CONTEST_AROMA_TAG_LABELS[tag.tag]}
                </span>
              ))}
            </div>
          ) : null}

          {isConcoursEntry && viewerReview.terpeneGuesses.length > 0 ? (
            <div className="mt-4 rounded border-2 border-[#1a1a1a] bg-[#fffaf0] p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">
                Terpènes cochés
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {viewerReview.terpeneGuesses.map((code) => {
                  const option = CANNABIS_TERPENE_OPTIONS.find((terpene) => terpene.code === code);
                  return (
                    <span
                      key={code}
                      className="rounded-full border-2 border-[#1a1a1a] bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-ink"
                    >
                      {option?.label ?? code}
                    </span>
                  );
                })}
              </div>
              {savedTerpeneRewardUnlocked ? (
                <p className="mt-3 rounded border-2 border-[#1a1a1a] bg-yellow px-3 py-2 text-sm font-black text-ink">
                  Badge Nez Absolu débloqué: 3 packs booster sont ajoutés à ton album.
                </p>
              ) : null}
            </div>
          ) : null}

          {viewerReview.comment.trim() ? (
            <div className="mt-4 rounded border-2 border-[#1a1a1a] bg-[#fffaf0] p-4 text-sm leading-relaxed text-charcoal">
              {viewerReview.comment}
            </div>
          ) : null}

          {viewerReview.status === "pending" ? (
            <p className="mt-4 text-sm font-semibold text-[#7c4a00]">
              Le guide est en attente de modération avant apparition publique.
            </p>
          ) : null}
          {viewerReview.status === "rejected" && viewerReview.adminNote.trim() ? (
            <p className="mt-4 text-sm font-semibold text-[#7a1010]">
              Motif modération: {viewerReview.adminNote}
            </p>
          ) : null}

          {viewerReview.status === "pending" ? (
            <button
              type="button"
              onClick={startReviewEdit}
              className="btn-cartoon btn-secondary mt-5 inline-flex min-h-[44px] items-center justify-center px-5 text-xs leading-none"
            >
              Modifier mon guide
            </button>
          ) : (
            <p className="mt-4 text-sm font-semibold text-charcoal">
              Les notes ne sont modifiables que tant que le guide est en attente de modération.
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderNotesOpenButton = (label = "Ouvrir mes notes") => (
    <button
      type="button"
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => {
        event.preventDefault();
        event.stopPropagation();
        openGuide();
      }}
      onMouseDown={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      onTouchMove={(event) => event.stopPropagation()}
      onTouchEnd={(event) => {
        event.preventDefault();
        event.stopPropagation();
        openGuide();
      }}
      onClick={(event) => {
        event.stopPropagation();
        openGuide();
      }}
      className="btn-cartoon btn-primary inline-flex min-h-[52px] items-center justify-center px-6 text-sm leading-none"
      aria-label="Ouvrir mes notes de degustation"
    >
      {label}
    </button>
  );

  const renderApprovedNotesSummary = () => {
    if (!viewerReview) {
      return null;
    }

    const aromaLabels = viewerReview.aromaTags
      .map((tag) => (tag.tag === "other" ? tag.customLabel?.trim() || "Autre" : CONTEST_AROMA_TAG_LABELS[tag.tag]))
      .filter((label): label is string => Boolean(label));
    const terpeneLabels = isConcoursEntry
      ? normalizeTerpeneSelection(viewerReview.terpeneGuesses).map((code) => {
          const option = CANNABIS_TERPENE_OPTIONS.find((terpene) => terpene.code === code);
          return option?.label ?? code;
        })
      : [];
    const commentText = viewerReview.comment.trim();

    return (
      <section className="contest-review-summary-card" aria-label="Resume de mes notes validees">
        <div className="contest-review-summary-header">
          <div className="min-w-0">
            <p className="contest-review-summary-eyebrow">Notes validees</p>
            <h3>{entry.title}</h3>
            <p className="contest-review-summary-meta">
              {CONTEST_CONSUMPTION_METHOD_LABELS[viewerReview.consumptionMethod]}
              {viewerReview.consumptionDetails?.trim() ? ` - ${viewerReview.consumptionDetails.trim()}` : ""}
            </p>
          </div>
          <div className="contest-review-summary-badge">
            <strong>{formatContestAverage(getContestReviewAverage(viewerReview.scores))}</strong>
            <span>/100</span>
          </div>
        </div>

        <div className="contest-review-summary-grid">
          <article className="contest-review-summary-chart-box">
            <ContestReviewSkillRadar
              review={viewerReview}
              comparisonScores={entry.stats.criterionAverages}
              compact
              showValues={false}
              showTotals={false}
            />
          </article>

          <div className="contest-review-summary-side">
            <article className="contest-review-summary-box">
              <p className="contest-review-summary-eyebrow">Gouts & terpenes</p>
              <div className="contest-review-summary-chip-group">
                {aromaLabels.length > 0 ? (
                  aromaLabels.map((label) => (
                    <span key={`aroma-${label}`} className="contest-review-summary-chip contest-review-summary-chip-yellow">
                      {label}
                    </span>
                  ))
                ) : (
                  <p className="contest-review-summary-empty">Aucun gout renseigne.</p>
                )}
              </div>

              <div className="contest-review-summary-terpenes">
                <p>Terpenes</p>
                <div className="contest-review-summary-chip-group">
                  {terpeneLabels.length > 0 ? (
                    terpeneLabels.map((label) => (
                      <span key={`terpene-${label}`} className="contest-review-summary-chip">
                        {label}
                      </span>
                    ))
                  ) : (
                    <span className="contest-review-summary-empty">Aucun terpene coche.</span>
                  )}
                </div>
              </div>
              {savedTerpeneRewardUnlocked ? (
                <p className="contest-review-summary-reward">Badge Nez Absolu debloque.</p>
              ) : null}
            </article>

            <article className="contest-review-summary-box contest-review-summary-written">
              <p className="contest-review-summary-eyebrow">Resume ecrit</p>
              <p>{commentText || "Aucun resume renseigne."}</p>
            </article>
          </div>
        </div>

        <div className="contest-review-summary-actions">{renderNotesOpenButton("Ouvrir mes notes")}</div>
      </section>
    );
  };

  const renderNotesTabContent = () => {
    if (!viewerReview) {
      return renderNotesOpenButton();
    }

    if (viewerReview.status === "approved") {
      return renderApprovedNotesSummary();
    }

    const isPendingReview = viewerReview.status === "pending";

    return (
      <section className="contest-review-summary-state">
        <div>
          <p className="contest-review-summary-eyebrow">
            {CONTEST_REVIEW_STATUS_LABELS[viewerReview.status]}
          </p>
          <h3>{isPendingReview ? "Notes soumises" : "Notes a revoir"}</h3>
          <p>
            {isPendingReview
              ? "Le resume graphique apparaitra ici des que la moderation aura valide tes notes."
              : "Cette note n'a pas ete validee. Ouvre le carnet pour consulter le retour de moderation."}
          </p>
          {viewerReview.status === "rejected" && viewerReview.adminNote.trim() ? (
            <p className="contest-review-summary-admin-note">{viewerReview.adminNote}</p>
          ) : null}
        </div>
        {renderNotesOpenButton(isPendingReview ? "Voir / modifier" : "Ouvrir mes notes")}
      </section>
    );
  };

  const renderNotebookShell = () => (
    <section
      ref={inlineGuideRef}
      className={`${styles.notebook} ${isInlineDisplayMode ? styles.inlineNotebook : ""}`}
      aria-label={`Carnet de dégustation de ${entry.title}`}
    >
      <header className={styles.notebookHeader}>
        <div className={styles.headerIdentity}>
          <ContestTastingStepMascot step={GUIDE_PAGE_MASCOTS[pageIndex]} compact />
          <div className={styles.headerCopy}>
            <p className={styles.eyebrow}>Étape {pageIndex + 1} sur {GUIDE_PAGES.length}</p>
            <h2 className={styles.notebookTitle}>Carnet de dégustation</h2>
            <p className={styles.notebookSubtitle}>{entry.title}</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <div
            className={styles.headerScore}
            aria-label={`Score actuel ${formatContestAverage(visibleScoreAverage)} sur ${CONTEST_SCORE_MAX}`}
          >
            {formatContestAverage(visibleScoreAverage)}/{CONTEST_SCORE_MAX}
          </div>
          <button
            type="button"
            onClick={closeGuide}
            className={styles.closeButton}
            data-tasting-close
            aria-label={isInlineDisplayMode ? "Retour au résumé des notes" : "Fermer le carnet"}
          >
            {isInlineDisplayMode ? "Résumé" : "Fermer"}
          </button>
        </div>
      </header>

      <nav className={styles.stepNav} aria-label="Étapes de notation">
        {GUIDE_PAGES.map((page, index) => (
          <button
            key={page}
            type="button"
            onClick={() => goToGuidePage(index)}
            className={`${styles.stepTab} ${index === pageIndex ? styles.stepTabActive : ""}`}
            aria-current={index === pageIndex ? "page" : undefined}
            aria-label={`Étape ${index + 1} : ${page}`}
          >
            <span className={styles.stepTabNumber}>{index + 1}</span>
            <span className={styles.stepTabLabel}>{page}</span>
          </button>
        ))}
      </nav>

      <div key={pageIndex} className={styles.contentViewport} data-tasting-scroll>
        {renderGuidePage()}
      </div>

      <footer className={styles.notebookFooter}>
        <button
          type="button"
          onClick={goToPreviousPage}
          disabled={pageIndex === 0}
          className={styles.navButton}
        >
          Précédent
        </button>
        <div className={styles.progress} aria-live="polite">
          <div className={styles.progressLabel}>
            <span>{GUIDE_PAGES[pageIndex]}</span>
            <span>{pageIndex + 1}/{GUIDE_PAGES.length}</span>
          </div>
          <div className={styles.progressTrack} aria-hidden="true">
            <span
              className={styles.progressFill}
              style={{ width: `${((pageIndex + 1) / GUIDE_PAGES.length) * 100}%` }}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={goToNextPage}
          disabled={pageIndex === GUIDE_PAGES.length - 1}
          className={`${styles.navButton} ${styles.navButtonPrimary}`}
        >
          Suivant
        </button>
      </footer>
    </section>
  );

  const renderGuidePage = () => {
    if (isReviewReadOnly && pageIndex === GUIDE_PAGES.length - 1) {
      return renderExistingReview();
    }

    const lockedState = viewerReview || isEditingReview ? null : renderLockedState();
    if (lockedState) {
      return lockedState;
    }

    const visualCriteria = SCORE_GROUPS.find((group) => group.page === "visual")?.criteria ?? [];
    const aromaCriteria = SCORE_GROUPS.find((group) => group.page === "aroma")?.criteria ?? [];
    const tastingCriteria = SCORE_GROUPS.find((group) => group.page === "tasting")?.criteria ?? [];
    const verdictCriteria = SCORE_GROUPS.find((group) => group.page === "verdict")?.criteria ?? [];
    const GuideSpread = TastingContentGrid;

    if (pageIndex === 0) {
      return (
        <GuideSpread
          left={
            <>
              <QuickStepIntro
                eyebrow="Mode rapide"
                title="Note cette fleur en 2 minutes"
                body="Tu peux avancer sans lire le guide complet. Les aides restent disponibles si tu bloques."
                mascotStep="start"
              />
              {isConcoursEntry ? (
                <div className="rounded border-2 border-[#1a1a1a] bg-[#fff0c9] p-4 shadow-[3px_3px_0_rgba(23,19,14,0.25)]">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#6d4b00]">
                    Défi terpènes
                  </p>
                  <h4 className="mt-1 text-xl font-black leading-tight text-ink">
                    Trouve le bon combo, débloque 3 boosters
                  </h4>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-charcoal">
                    Dans l&apos;étape Odeur, coche les terpènes dominants que tu reconnais. Si le combo
                    est exact et que ton avis est validé, le badge Nez Absolu donne 3 packs booster.
                  </p>
                </div>
              ) : null}
              <div className="grid gap-2">
                {quickStepSummary.map((step, index) => (
                  <div
                    key={step}
                    className="flex items-center gap-3 rounded border-2 border-[#1a1a1a] bg-white px-3 py-2 text-sm font-bold text-charcoal"
                  >
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-[#1a1a1a] bg-yellow text-xs font-black text-ink">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
              <div className="rounded border-2 border-[#1a1a1a] bg-white p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">
                  Ton mode de dégustation
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {CONTEST_CONSUMPTION_METHODS.map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => {
                        if (!isReviewReadOnly) {
                          setConsumptionMethod(method);
                        }
                      }}
                      disabled={isReviewReadOnly}
                      className={`flex min-h-[54px] items-center rounded border-2 px-3 py-2 text-left ${
                        visibleConsumptionMethod === method
                          ? "border-[#1a1a1a] bg-yellow text-ink"
                          : "border-[#1a1a1a] bg-[#f7f4ee] text-charcoal"
                      } disabled:cursor-default`}
                    >
                      <span className="text-xs font-black uppercase leading-tight tracking-[0.06em]">
                        {CONTEST_CONSUMPTION_METHOD_LABELS[method]}
                      </span>
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={visibleConsumptionDetails}
                  onChange={(event) => setConsumptionDetails(event.target.value)}
                  readOnly={isReviewReadOnly}
                  placeholder="Optionnel: température, roulage, matériel..."
                  className="mt-3 h-12 w-full border-2 border-[#1a1a1a] bg-[#fffaf0] px-3 text-sm text-ink"
                />
              </div>
            </>
          }
          right={
            <>
              <QuickHelp title="Voir les règles et conseils">
                <GuideCard title="La règle du concours" eyebrow="Analyse et dégustation" tone="yellow">
                  <GuideBullets items={CONTEST_CBD_TASTING_RULES} />
                </GuideCard>
                {CONTEST_PREPARATION_GUIDE.map((section) => (
                  <GuideCard key={section.title} title={section.title} eyebrow="Préparation" tone="cream">
                    <p>{section.body}</p>
                    <div className="mt-3">
                      <GuideBullets items={section.bullets} />
                    </div>
                  </GuideCard>
                ))}
              </QuickHelp>
              <QuickHelp title="Fiche du lot">
                <div className="grid gap-2">
                  {[
                    ["Variété", getTechnicalText(technicalSheet.variety, entry.title)],
                    ["Sol", getTechnicalText(technicalSheet.soil)],
                    ["Culture", CONTEST_ENTRY_CATEGORY_LABELS[entry.category]],
                    ["Récolte", formatHarvestDate(technicalSheet.harvestDate)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded border-2 border-[#1a1a1a] bg-[#fffaf0] px-3 py-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-charcoal">{label}</p>
                      <p className="mt-1 text-sm font-bold text-ink">{value}</p>
                    </div>
                  ))}
                </div>
              </QuickHelp>
            </>
          }
        />
      );
    }

    if (pageIndex === 1) {
      return (
        <GuideSpread
          left={
            <>
              <QuickStepIntro
                eyebrow="Étape 1"
                title="Aspect"
                body="Regarde la fleur. Mets simplement les curseurs au niveau qui te semble juste."
                mascotStep="aspect"
              />
              <ScoreSliderStack
                criteria={visualCriteria}
                scores={visibleScores}
                onChange={handleScoreChange}
                disabled={isReviewReadOnly}
              />
            </>
          }
          right={
            <QuickHelp>
              <CriterionGuideStack criteria={visualCriteria} scores={visibleScores} />
            </QuickHelp>
          }
        />
      );
    }

    if (pageIndex === 2) {
      return (
        <GuideSpread
          left={
            <>
              <QuickStepIntro
                eyebrow="Étape 2"
                title={isConcoursEntry ? "Odeur et terpènes" : "Odeur et arômes"}
                body={
                  isConcoursEntry
                    ? "Repère les terpènes dominants : si ton combo est juste, tu peux débloquer des boosters."
                    : "Repère les familles aromatiques dominantes et note la qualité du nez."
                }
                mascotStep="smell"
              />
              {isConcoursEntry ? (
                <div className="rounded border-2 border-[#1a1a1a] bg-yellow p-4 shadow-[3px_3px_0_rgba(23,19,14,0.25)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#6d4b00]">
                        Défi Nez Absolu
                      </p>
                      <h4 className="mt-1 text-xl font-black leading-tight text-ink">
                        Combo exact = 3 boosters
                      </h4>
                    </div>
                    <span className="rounded-full border-2 border-[#1a1a1a] bg-white px-3 py-1 text-xs font-black text-ink">
                      {visibleSelectedTerpenes.length} coché(s)
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-charcoal">
                    Coche les terpènes que tu reconnais dans la fleur. Le bonus est accordé après
                    validation de l&apos;avis si ton combo correspond aux terpènes dominants.
                  </p>
                  {expectedTerpenes.length > 0 ? (
                    <p className={`mt-3 rounded border-2 border-[#1a1a1a] px-3 py-2 text-sm font-black ${
                      visibleTerpeneRewardUnlocked ? "bg-[#f0fff3] text-[#1f5a2f]" : "bg-[#fffaf0] text-charcoal"
                    }`}>
                      {visibleTerpeneRewardUnlocked
                        ? "Combo exact détecté: garde cette sélection avant d'envoyer ton avis."
                        : "Trouve le combo exact pour viser le bonus boosters."}
                    </p>
                  ) : null}
                  <details className="mt-4 rounded border-2 border-[#1a1a1a] bg-[#fffaf0] p-3">
                    <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.1em] text-ink">
                      Choisir mes terpènes ({visibleSelectedTerpenes.length})
                    </summary>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {CANNABIS_TERPENE_OPTIONS.map((terpene) => {
                        const checked = visibleSelectedTerpenes.includes(terpene.code);
                        return (
                          <label
                            key={terpene.code}
                            className={`flex min-h-[44px] items-center gap-3 rounded border-2 px-3 py-2 ${
                              checked
                                ? "border-[#1a1a1a] bg-white"
                                : "border-[#1a1a1a] bg-[#f6f0e6]"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleTerpene(terpene.code)}
                              disabled={isReviewReadOnly}
                              className="h-5 w-5 accent-[#00563f]"
                            />
                            <span className="text-sm font-semibold leading-tight text-ink">
                              {terpene.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </details>
                </div>
              ) : null}
              <div className="rounded border-2 border-[#1a1a1a] bg-white p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">
                  Arômes perçus
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {CONTEST_AROMA_TAGS.map((tag) => {
                    const checked = visibleSelectedTags.includes(tag);
                    return (
                      <label
                        key={tag}
                        className={`flex items-center gap-3 rounded border-2 px-3 py-2 ${
                          checked
                            ? "border-[#1a1a1a] bg-[#fff0c9]"
                            : "border-[#1a1a1a] bg-[#f7f4ee]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleTag(tag)}
                          disabled={isReviewReadOnly}
                          className="h-4 w-4 accent-[#d35400]"
                        />
                        <span className="text-sm font-semibold leading-tight text-ink">
                          {CONTEST_AROMA_TAG_LABELS[tag]}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {visibleSelectedTags.includes("other") ? (
                  <input
                    type="text"
                    value={visibleOtherAromaLabel}
                    onChange={(event) => setOtherAromaLabel(event.target.value)}
                    readOnly={isReviewReadOnly}
                    placeholder="Autre arôme détecté"
                    className="mt-3 h-12 w-full border-2 border-[#1a1a1a] bg-[#fffaf0] px-3 text-sm text-ink"
                  />
                ) : null}
              </div>
              <ScoreSliderStack
                criteria={aromaCriteria}
                scores={visibleScores}
                onChange={handleScoreChange}
                disabled={isReviewReadOnly}
              />
            </>
          }
          right={
            <QuickHelp>
              <AromaLexiconGrid />
              <CriterionGuideStack criteria={aromaCriteria} scores={visibleScores} />
            </QuickHelp>
          }
        />
      );
    }

    if (pageIndex === 3) {
      return (
        <GuideSpread
          left={
            <>
              <QuickStepIntro
                eyebrow="Étape 3"
                title="Goût"
                body="Concentre-toi sur la bouche: saveur, douceur et longueur après la prise."
                mascotStep="taste"
              />
              <ScoreSliderStack
                criteria={tastingCriteria}
                scores={visibleScores}
                onChange={handleScoreChange}
                disabled={isReviewReadOnly}
              />
            </>
          }
          right={
            <QuickHelp>
              <GuideCard title="Selon ton matériel" eyebrow="Contexte important" tone="cream">
                Le vaporisateur met souvent mieux en avant les nuances. La combustion juge davantage
                la douceur et l&apos;absence d&apos;âcreté.
              </GuideCard>
              <CriterionGuideStack criteria={tastingCriteria} scores={visibleScores} />
            </QuickHelp>
          }
        />
      );
    }

    if (pageIndex === 4) {
      return (
        <GuideSpread
          left={
            <>
              <QuickStepIntro
                eyebrow="Dernière étape"
                title="Verdict"
                body="Donne ton impression générale. Une phrase suffit si tes notes sont claires."
                mascotStep="verdict"
              />
              <div className="rounded border-2 border-[#1a1a1a] bg-yellow p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#6d4b00]">
                  Score actuel
                </p>
                <p className="mt-2 text-4xl font-black text-ink">
                  {formatContestAverage(visibleScoreAverage)}
                </p>
                <p className="text-sm font-bold text-ink">/ {CONTEST_SCORE_MAX}</p>
              </div>
              <ScoreSliderStack
                criteria={verdictCriteria}
                scores={visibleScores}
                onChange={handleScoreChange}
                disabled={isReviewReadOnly}
              />
              <div className="rounded border-2 border-[#1a1a1a] bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">
                    Critique rédigée
                  </p>
                  {isReviewReadOnly ? null : (
                    <button
                      type="button"
                      onClick={fillCommentDraft}
                      className="rounded-full border-2 border-[#1a1a1a] bg-[#fffaf0] px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-ink"
                    >
                      Préremplir
                    </button>
                  )}
                </div>
                <textarea
                  value={visibleComment}
                  onChange={(event) => setComment(event.target.value)}
                  readOnly={isReviewReadOnly}
                  maxLength={2000}
                  rows={5}
                  placeholder="Ex: Belle fleur, nez fruité, bouche douce, bonne impression générale."
                  className="mt-3 w-full border-2 border-[#1a1a1a] bg-[#fffaf0] px-3 py-3 text-sm leading-relaxed text-ink"
                />
              </div>
              {isReviewReadOnly ? null : (
                <button
                  type="button"
                  onClick={submitReview}
                  disabled={isPending}
                  className="btn-cartoon btn-primary inline-flex min-h-[48px] items-center justify-center px-6 text-xs leading-none disabled:opacity-60"
                >
                  {isPending ? "Envoi..." : isEditingReview ? "Enregistrer mes modifications" : "Envoyer mon avis"}
                </button>
              )}
              {reviewMessage ? <p className="text-sm font-semibold text-[#1f5a2f]">{reviewMessage}</p> : null}
              {reviewError ? <p className="text-sm font-semibold text-[#7a1010]">{reviewError}</p> : null}
            </>
          }
          right={
            <QuickHelp>
              <GuideCard title="Verdict final" eyebrow="Simple et utile" tone="yellow">
                Dis ce que tu as vu, senti, goûté, puis ton impression générale. Une critique courte
                mais précise vaut mieux qu&apos;un long texte vague.
              </GuideCard>
              <GuideCard title="Repères de note" eyebrow="Avant d'envoyer" tone="cream">
                <GuideBullets items={CONTEST_STANDARD_GUIDE.positives.slice(0, 3)} />
              </GuideCard>
              <GuideCard title="Structure possible" eyebrow="Si tu veux détailler" tone="white">
                <GuideBullets items={CONTEST_VERDICT_GUIDE} />
              </GuideCard>
            </QuickHelp>
          }
        />
      );
    }

    return null;
  };

  const shouldRenderInlineGuide = isInlineDisplayMode && isGuideOpen;

  return (
    <div className={`${styles.panelRoot} ${isInlineDisplayMode ? styles.inlinePanelRoot : ""}`}>
      {isInlineDisplayMode ? (
        shouldRenderInlineGuide ? renderNotebookShell() : renderNotesTabContent()
      ) : (
        <section className={styles.teaser} aria-label="Carnet de dégustation">
          <div className={styles.teaserTop}>
            <p className={styles.eyebrow}>Jury client · {entry.season?.label ?? "Saison active"}</p>
            <div className={styles.teaserScore}>
              {formatContestAverage(viewerReview ? getContestReviewAverage(viewerReview.scores) : scoreAverage)}/{CONTEST_SCORE_MAX}
            </div>
          </div>
          <div className={styles.teaserBody}>
            <div className={styles.teaserCopy}>
              <h2 className={styles.teaserTitle}>Carnet de dégustation</h2>
              <p className={styles.teaserText}>{notebookIntro}</p>
              <div className={styles.teaserMeta} aria-label="Informations du carnet">
                <span className={styles.chip}>{entry.title}</span>
                <span className={styles.chip}>Environ 2 minutes</span>
              </div>
              <button
                ref={launchButtonRef}
                type="button"
                onClick={openGuide}
                className={styles.teaserAction}
                aria-label="Ouvrir le carnet de dégustation"
              >
                {viewerReview ? "Ouvrir mes notes" : "Commencer la dégustation"}
              </button>
            </div>
            <div className={styles.teaserArt} aria-hidden="true">
              <div className={styles.teaserMascot}>
                <Image
                  src={TASTING_STEP_MASCOTS.start}
                  alt=""
                  width={408}
                  height={771}
                  sizes="(max-width: 767px) 70px, 112px"
                  className="h-auto w-full"
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {isGuideOpen && !isInlineDisplayMode ? (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-label={`Carnet de dégustation de ${entry.title}`}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeGuide();
            }
          }}
        >
          <div
            className={styles.modalPanel}
            onClick={(event) => event.stopPropagation()}
          >
            {renderNotebookShell()}
          </div>
        </div>
      ) : null}
    </div>
  );
}
