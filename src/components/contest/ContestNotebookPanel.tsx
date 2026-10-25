"use client";

import Image from "next/image";
import Link from "@/components/navigation/NavigationLink";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useRouter } from "@/components/navigation/NavigationFeedback";
import { ContestReviewSkillRadar } from "@/components/contest/ContestReviewSkillRadar";
import { useKqTutorialApi } from "../placard/KqTutorialApiContext";
import styles from "./ContestNotebookPanel.module.css";
import { contestDraftKey, contestReviewVersion, readContestDraft, type ContestNotebookDraft } from "@/lib/contest-notebook-draft";
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
  displayMode?: "card" | "button" | "spread" | "book";
  defaultGuideOpen?: boolean;
  useDesktopSpreadGuide?: boolean;
  onOpenGuide?: () => void;
  onCloseGuide?: () => void;
  draftOwnerId?: string | null;
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
  "Repère les terpènes que tu reconnais.",
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

const TASTING_STEP_MASCOTS: Record<TastingStepMascotKey, { src: string; width: number; height: number }> = {
  start: { src: "/contest/mascot/tasting/tasting-start.png", width: 390, height: 463 },
  aspect: { src: "/contest/mascot/tasting/tasting-aspect.png", width: 400, height: 428 },
  smell: { src: "/contest/mascot/tasting/tasting-smell.png", width: 346, height: 442 },
  taste: { src: "/contest/mascot/tasting/tasting-taste.png", width: 370, height: 440 },
  verdict: { src: "/contest/mascot/tasting/tasting-verdict.png", width: 390, height: 463 },
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
  evaluated = true,
}: {
  criterion: ContestScoreCriterion;
  value: number;
  onChange: (criterion: ContestScoreCriterion, nextValue: number) => void;
  disabled?: boolean;
  evaluated?: boolean;
}) {
  return (
    <div className={styles.scoreCard} data-notebook-criterion={criterion} data-notebook-evaluated={evaluated}>
    <label>
      <div className={styles.scoreTop}>
        <span className={styles.scoreLabel}>
          {CONTEST_SCORE_CRITERION_LABELS[criterion]}
        </span>
        <span className={styles.scorePill}>
          {evaluated ? `${value}/${CONTEST_SCORE_MAX}` : "À noter"}
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
        aria-label={CONTEST_SCORE_CRITERION_LABELS[criterion]}
        aria-valuetext={evaluated ? `${value} sur ${CONTEST_SCORE_MAX}` : "Non évalué. Ajuste le curseur ou confirme la valeur proposée."}
      />
      <p className={styles.scoreHint}>{evaluated ? getScoreHint(value) : "Ce critère ne compte pas encore dans ta note."}</p>
    </label>
    {!evaluated && !disabled ? <button type="button" className={styles.confirmScore} onClick={() => onChange(criterion, value)} aria-label={`Confirmer ${value} sur 100 pour ${CONTEST_SCORE_CRITERION_LABELS[criterion]}`}>Confirmer {value}/100</button> : null}
    </div>
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
          className={`${styles.scoreBand} ${index === activeBand ? styles.scoreBandActive : ""}`}
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
        <span className={styles.numberStamp}>
          {score}/{CONTEST_SCORE_MAX}
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-charcoal">{guide.promise}</p>
      <div className={styles.methodNote}>
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
        <div className={styles.positiveNote}>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#1f5a2f]">
            Bons signes
          </p>
          <div className="mt-2 text-xs leading-relaxed text-charcoal">
            <GuideBullets items={guide.positiveSignals.slice(0, 3)} />
          </div>
        </div>
        <div className={styles.warningNote}>
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
        <div key={family.family} className={styles.registerEntry}>
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
        {...TASTING_STEP_MASCOTS[step]}
        alt=""
        sizes={compact ? "84px" : "(max-width: 480px) 76px, 116px"}
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
  evaluatedCriteria,
}: {
  criteria: ContestScoreCriterion[];
  scores: ReviewScoreMap;
  onChange: (criterion: ContestScoreCriterion, nextValue: number) => void;
  disabled: boolean;
  evaluatedCriteria: ContestScoreCriterion[];
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
          evaluated={disabled || evaluatedCriteria.includes(criterion)}
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

export function ContestNotebookPanel(props: ContestNotebookPanelProps) {
  return <ContestNotebookEditor key={`${props.draftOwnerId ?? "anonymous"}:${props.entry.id}:${contestReviewVersion(props.viewerReview)}`} {...props} />;
}

function ContestNotebookEditor({
  entry,
  viewerProfile,
  viewerReview: initialServerReview,
  eligibility,
  loginHref,
  productHref,
  displayMode = "card",
  defaultGuideOpen = false,
  useDesktopSpreadGuide = false,
  onOpenGuide,
  onCloseGuide,
  draftOwnerId,
}: ContestNotebookPanelProps) {
  const api = useKqTutorialApi();
  const serverReview = useRef(initialServerReview).current;
  const [submittedReview, setSubmittedReview] = useState<ViewerContestReview | null>(null);
  const viewerReview = submittedReview ?? serverReview;
  const fieldId = useId();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isSpreadDisplayMode = displayMode === "spread";
  const isBookDisplayMode = displayMode === "book";
  const isInlineDisplayMode = displayMode === "button" || isSpreadDisplayMode || displayMode === "book";
  const shouldOpenReviewEditor =
    searchParams.get("edit") === "notes" &&
    (viewerReview?.status === "pending" || viewerReview?.status === "rejected" || (!viewerReview && eligibility.eligible));
  const [isPending, startTransition] = useTransition();
  const [isGuideOpen, setIsGuideOpen] = useState(shouldOpenReviewEditor || defaultGuideOpen);
  const [isEditingReview, setIsEditingReview] = useState(
    shouldOpenReviewEditor && (viewerReview?.status === "pending" || viewerReview?.status === "rejected"),
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
  const [modeConfirmed, setModeConfirmed] = useState(false);
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
  const reviewFeedbackRef = useRef<HTMLDivElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingPseudo, setIsSavingPseudo] = useState(false);
  const submissionLock = useRef(false);
  const pseudoLock = useRef(false);
  const [evaluatedCriteria, setEvaluatedCriteria] = useState<ContestScoreCriterion[]>(shouldOpenReviewEditor && viewerReview ? [...CONTEST_SCORE_CRITERIA] : []);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftMessage, setDraftMessage] = useState<string | null>(null);
  const [olderDraft, setOlderDraft] = useState<ContestNotebookDraft | null>(null);
  const [reviewConflict, setReviewConflict] = useState(false);
  const [hasDraftEdits, setHasDraftEdits] = useState(false);
  const draftKey = draftOwnerId ? contestDraftKey(draftOwnerId, entry.id) : null;

  useEffect(() => {
    if (!reviewMessage && !reviewError) return;
    reviewFeedbackRef.current?.focus({ preventScroll: true });
    reviewFeedbackRef.current?.scrollIntoView({ block: "nearest" });
  }, [reviewMessage, reviewError]);

  useEffect(() => {
    if (draftKey && draftOwnerId) {
      try {
        const raw = localStorage.getItem(draftKey);
        const draft = readContestDraft(raw, draftOwnerId, entry.id, serverReview);
        if (draft) {
          setScores(draft.scores);
          setConsumptionMethod(draft.consumptionMethod);
          setConsumptionDetails(draft.consumptionDetails ?? "");
          setComment(draft.comment);
          setSelectedTags(draft.aromaTags.map((item) => item.tag));
          setSelectedTerpenes(normalizeTerpeneSelection(draft.terpeneGuesses));
          setOtherAromaLabel(draft.aromaTags.find((item) => item.tag === "other")?.customLabel ?? "");
          setEvaluatedCriteria(draft.evaluatedCriteria);
          setPageIndex(draft.pageIndex);
          setIsEditingReview(Boolean(serverReview));
          setIsGuideOpen(true);
          setHasDraftEdits(true);
          setDraftMessage("Brouillon retrouvé sur cet appareil. Tu peux reprendre ta dégustation.");
        } else if (raw) {
          const older = readContestDraft(raw, draftOwnerId, entry.id, serverReview, Date.now(), true);
          if (older) setOlderDraft(older);
          else localStorage.removeItem(draftKey);
        }
      } catch {
        setDraftMessage("La sauvegarde sur cet appareil est indisponible. Garde cette page ouverte jusqu’à l’envoi.");
      }
    }
    setDraftLoaded(true);
  }, [draftKey, draftOwnerId, entry.id, serverReview]);

  useEffect(() => {
    if (!draftLoaded || !draftKey || !draftOwnerId || !hasDraftEdits || (viewerReview && !isEditingReview)) return;
    const draft: ContestNotebookDraft = {
      version: 1, ownerId: draftOwnerId, entryId: entry.id, baseReviewVersion: contestReviewVersion(viewerReview), savedAt: Date.now(), pageIndex,
      scores, consumptionMethod, consumptionDetails, comment, evaluatedCriteria,
      aromaTags: selectedTags.map((tag) => tag === "other" ? { tag, customLabel: otherAromaLabel } : { tag }),
      terpeneGuesses: selectedTerpenes,
    };
    try { localStorage.setItem(draftKey, JSON.stringify(draft)); }
    catch { setDraftMessage("La sauvegarde sur cet appareil est indisponible. Garde cette page ouverte jusqu’à l’envoi."); }
  }, [draftLoaded, draftKey, draftOwnerId, hasDraftEdits, viewerReview, isEditingReview, entry.id, pageIndex, scores, consumptionMethod, consumptionDetails, comment, evaluatedCriteria, selectedTags, otherAromaLabel, selectedTerpenes]);

  const scoreAverage = useMemo(() => {
    const values = evaluatedCriteria.map((criterion) => scores[criterion]);
    const total = values.reduce((sum, value) => sum + value, 0);
    return values.length > 0 ? total / values.length : null;
  }, [scores, evaluatedCriteria]);

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
  const visibleEvaluatedCriteria = isReviewReadOnly && viewerReview
    ? CONTEST_SCORE_CRITERIA.filter((criterion) => viewerReview.scores.some((score) => score.criterion === criterion && Number.isFinite(score.score)))
    : evaluatedCriteria;
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
    const writtenScore = (criterion: ContestScoreCriterion) => isReviewReadOnly || evaluatedCriteria.includes(criterion)
      ? `${visibleScores[criterion]}/${CONTEST_SCORE_MAX}`
      : "à préciser";

    return [
      `Dégustée en ${CONTEST_CONSUMPTION_METHOD_LABELS[visibleConsumptionMethod].toLowerCase()}${contextText}.`,
      `Aspect: ${writtenScore("appearance")}, nez: ${writtenScore("cold_aroma")}, goût: ${writtenScore("flavor")}.`,
      `Arômes perçus: ${aromaText}.`,
      `Impression générale: ${writtenScore("overall_impression")}.`,
    ].join(" ");
  };

  const fillCommentDraft = () => {
    if (comment.trim()) return;
    setComment(buildReviewCommentDraft());
    setHasDraftEdits(true);
  };

  const handleScoreChange = (criterion: ContestScoreCriterion, nextValue: number) => {
    setHasDraftEdits(true);
    setEvaluatedCriteria((current) => current.includes(criterion) ? current : [...current, criterion]);
    setScores((current) => ({
      ...current,
      [criterion]: nextValue,
    }));
  };

  const handleToggleTag = (tag: ContestAromaTag) => {
    setHasDraftEdits(true);
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );
  };

  const handleToggleTerpene = (terpene: string) => {
    setHasDraftEdits(true);
    setSelectedTerpenes((current) =>
      current.includes(terpene)
        ? current.filter((item) => item !== terpene)
        : [...current, terpene],
    );
  };

  const refreshPage = () => {
    if (api.isTutorial) return;
    startTransition(() => {
      router.refresh();
    });
  };

  const closeGuide = useCallback(() => {
    setIsGuideOpen(false);
    onCloseGuide?.();

    if (!isInlineDisplayMode) {
      window.requestAnimationFrame(() => launchButtonRef.current?.focus({ preventScroll: true }));
    }

    if (api.isTutorial || searchParams.get("edit") !== "notes") {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("edit");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [isInlineDisplayMode, onCloseGuide, pathname, router, searchParams, api]);

  useEffect(() => {
    if (!isGuideOpen || isBookDisplayMode) {
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
  }, [closeGuide, isGuideOpen, isInlineDisplayMode, isBookDisplayMode]);

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
    if (pseudoLock.current) return;
    pseudoLock.current = true;
    setIsSavingPseudo(true);
    setProfileMessage(null);
    setProfileError(null);

    try {
      const response = await api.request("/api/contest/profile", {
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
    } finally {
      pseudoLock.current = false;
      setIsSavingPseudo(false);
    }
  };

  const submitReview = async () => {
    if (submissionLock.current) return;
    setReviewMessage(null);
    setReviewError(null);
    setReviewConflict(false);
    const missing = CONTEST_SCORE_CRITERIA.filter((criterion) => !evaluatedCriteria.includes(criterion));
    if (missing.length) {
      setReviewError(`Il reste ${missing.length} critère${missing.length > 1 ? "s" : ""} à évaluer. Ajuste ou confirme chaque note avant l’envoi.`);
      const group = SCORE_GROUPS.findIndex((item) => item.criteria.includes(missing[0]));
      setPageIndex(group + 1);
      return;
    }
    submissionLock.current = true;
    setIsSubmitting(true);

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
      const response = await api.request("/api/contest/reviews", {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId: entry.id,
          ...(isUpdate ? { expectedUpdatedAt: viewerReview?.updatedAt } : {}),
          consumptionMethod,
          consumptionDetails,
          comment,
          scores,
          aromaTags,
          terpeneGuesses: isConcoursEntry ? selectedTerpenes : [],
        } satisfies ContestReviewSubmissionInput),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string; review?: ViewerContestReview } | null;
      if (!response.ok) {
        setReviewConflict(response.status === 409);
        setReviewError(response.status === 409
          ? "Cet avis a changé depuis son ouverture. Ton brouillon est conservé. Charge la nouvelle version pour comparer tes notes avant de les renvoyer."
          : payload?.error || "Impossible de soumettre l'avis.");
        return;
      }
      if (!payload?.review) {
        setReviewError("L’envoi n’a pas pu être confirmé. Ton brouillon est conservé ; recharge le carnet pour vérifier ton avis.");
        return;
      }

      setReviewMessage(
        api.isTutorial ? "Fiche d’essai terminée. Ces notes fictives restent dans le didacticiel." : isUpdate
          ? "Guide modifié. Il reste en modération avant publication."
          : "Guide envoyé. Il apparaîtra publiquement après modération.",
      );
      setIsEditingReview(false);
      setSubmittedReview(payload.review);
      setHasDraftEdits(false);
      setDraftMessage(null);
      try { if (draftKey) localStorage.removeItem(draftKey); } catch { /* Saved server review takes precedence on the next visit. */ }
      refreshPage();
    } catch {
      setReviewError("Erreur réseau lors de l'envoi du guide.");
    } finally {
      submissionLock.current = false;
      setIsSubmitting(false);
    }
  };

  const startReviewEdit = useCallback(() => {
    if (!viewerReview) {
      return;
    }

    setScores(buildScoresFromReview(viewerReview));
    setEvaluatedCriteria([...CONTEST_SCORE_CRITERIA]);
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
        <div className={styles.paperPanel}>
          <p className="text-sm text-charcoal">
            La publication d&apos;une note est réservée aux clients connectés.
          </p>
          <Link
            href={loginHref}
            className={`${styles.actionButton} ${styles.actionButtonPrimary} ${styles.actionSpaced}`}
          >
            Se connecter pour déguster
          </Link>
        </div>
      );
    }

    if (!viewerProfile) {
      return (
        <div className={styles.paperPanel}>
          <label htmlFor={`${fieldId}-pseudo`} className="block text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">
            Pseudo dégustateur
          </label>
          <input
            id={`${fieldId}-pseudo`}
            type="text"
            value={pseudo}
            onChange={(event) => setPseudo(event.target.value)}
            placeholder="Ex: BretonTerpene"
            className={styles.textInput}
          />
          <p className="mt-2 text-xs text-charcoal">
            Ce pseudo signera toutes tes critiques publiées dans l&apos;espace concours.
          </p>
          <button
            type="button"
            onClick={savePseudo}
            disabled={isPending || isSavingPseudo}
            className={`${styles.actionButton} ${styles.actionButtonPrimary} ${styles.actionSpaced}`}
          >
            {isPending || isSavingPseudo ? "Enregistrement..." : "Enregistrer mon pseudo"}
          </button>
          {profileMessage ? <p role="status" className="mt-3 text-sm font-semibold text-[#1f5a2f]">{profileMessage}</p> : null}
          {profileError ? <p role="alert" className="mt-3 text-sm font-semibold text-[#7a1010]">{profileError}</p> : null}
        </div>
      );
    }

    if (eligibility.reason === "not_purchased") {
      return (
        <div className={styles.paperPanel}>
          <p className="text-sm leading-relaxed text-charcoal">
            L&apos;avis public n&apos;est ouvert qu&apos;aux clients ayant acheté ce lot.
          </p>
          {productHref ? (
            <Link
              href={productHref}
              className={`${styles.actionButton} ${styles.actionSpaced}`}
            >
              Aller au produit
            </Link>
          ) : null}
        </div>
      );
    }

    return null;
  };

  const renderBookScoreSummary = () => (
    <section className={styles.bookScoreSummary} aria-label="Comparaison de mes notes">
      <div className={styles.bookScoreHeading}>
        <div><p>Mon profil de dégustation</p><h3>Mes notes</h3></div>
        <ContestTastingStepMascot step="verdict" compact />
      </div>
      <p className={styles.bookReviewStatus}>
        {viewerReview ? CONTEST_REVIEW_STATUS_LABELS[viewerReview.status] : `Brouillon · ${evaluatedCriteria.length}/${CONTEST_SCORE_CRITERIA.length} critères évalués · notes non envoyées`}
        {isEditingReview ? " · Modifications en cours" : ""}
      </p>
      <div className={styles.bookScoreTotals}>
        <div data-score="player"><span>Ta note</span><strong>{formatContestAverage(visibleScoreAverage)}<small>/100</small></strong></div>
        <div data-score="community"><span>Moyenne des joueurs</span><strong>{entry.stats.approvedReviewCount > 0 ? <>{formatContestAverage(entry.stats.averageScore)}<small>/100</small></> : "—"}</strong></div>
      </div>
      {CONTEST_SCORE_CRITERIA.every((criterion) => visibleEvaluatedCriteria.includes(criterion)) ? (
        <ContestReviewSkillRadar
          review={{ scores: CONTEST_SCORE_CRITERIA.map((criterion) => ({ criterion, score: visibleScores[criterion] })) }}
          comparisonScores={entry.stats.approvedReviewCount > 0 ? entry.stats.criterionAverages : undefined}
          showValues={false}
          showTotals={false}
        />
      ) : (
        <p className={styles.bookScoreCaption} data-notebook-score-progress>
          <strong>{visibleEvaluatedCriteria.length}/{CONTEST_SCORE_CRITERIA.length} critères évalués.</strong>{" "}
          Ton profil graphique apparaîtra une fois toutes tes notes renseignées.
        </p>
      )}
      <p className={styles.bookScoreCaption}>{entry.stats.approvedReviewCount > 0
        ? `Moyenne calculée sur ${entry.stats.approvedReviewCount} avis validé${entry.stats.approvedReviewCount > 1 ? "s" : ""}.`
        : "Pas encore d’avis validé : la moyenne apparaîtra après les premières validations."}</p>
    </section>
  );

  const renderOlderDraft = () => olderDraft ? (
    <details className={styles.olderDraft}>
      <summary>Retrouver mon brouillon d’une version précédente</summary>
      <p>Les notes enregistrées sur le serveur ont changé. Ce brouillon reste disponible pour comparer, sans remplacer ton avis actuel.</p>
      <p>{CONTEST_CONSUMPTION_METHOD_LABELS[olderDraft.consumptionMethod]}{olderDraft.consumptionDetails ? ` · ${olderDraft.consumptionDetails}` : ""}</p>
      {olderDraft.aromaTags.length > 0 ? <p>Arômes : {olderDraft.aromaTags.map((item) => item.tag === "other" ? item.customLabel : CONTEST_AROMA_TAG_LABELS[item.tag]).join(", ")}</p> : null}
      {olderDraft.terpeneGuesses?.length ? <p>Terpènes : {olderDraft.terpeneGuesses.map((code) => CANNABIS_TERPENE_OPTIONS.find((item) => item.code === code)?.label ?? code).join(", ")}</p> : null}
      <textarea aria-label="Critique de mon ancien brouillon" readOnly value={olderDraft.comment} rows={4} />
      <dl>{olderDraft.evaluatedCriteria.map((criterion) => <div key={criterion}><dt>{CONTEST_SCORE_CRITERION_LABELS[criterion]}</dt><dd>{olderDraft.scores[criterion]}/100</dd></div>)}</dl>
    </details>
  ) : null;

  const renderBookNotes = () => (
    <div className={styles.bookNotes} data-book-notes>
      {renderOlderDraft()}
      {renderBookScoreSummary()}
      {visibleComment ? <section className={styles.bookWrittenNotes}><h3>Mes impressions</h3><p>{visibleComment}</p></section> : null}
      {viewerReview?.adminNote ? <p className={styles.bookScoreCaption}>Retour de modération : {viewerReview.adminNote}</p> : null}
      <div className={styles.bookNotesActions}>
        <button type="button" className={styles.navButton} onClick={onCloseGuide}>Retour à la fleur</button>
        <button type="button" className={`${styles.navButton} ${styles.navButtonPrimary}`} onClick={() => {
          if ((viewerReview?.status === "pending" || viewerReview?.status === "rejected") && !isEditingReview) startReviewEdit();
          else if (viewerReview && !isEditingReview) openGuide();
          else setIsGuideOpen(true);
        }}>{viewerReview?.status === "rejected" ? "Corriger mes notes" : viewerReview?.status === "pending" ? "Modifier mes notes" : viewerReview ? "Lire mes notes" : "Continuer la dégustation"}</button>
      </div>
    </div>
  );

  const renderExistingReview = () => {
    if (!viewerReview) {
      return null;
    }

    return (
      <div className="contest-guide-verdict-review space-y-4">
        {isBookDisplayMode ? renderBookScoreSummary() : null}
        <div className={styles.paperPanel}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">
                Ton guide
              </p>
              <h3 className="text-2xl font-bold text-ink">{viewerReview.pseudo}</h3>
            </div>
            <div className="flex items-start gap-3 self-start">
              <div className={styles.statusStamp}>
                {CONTEST_REVIEW_STATUS_LABELS[viewerReview.status]}
              </div>
              <ContestTastingStepMascot step="verdict" compact />
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className={styles.reviewFact}>
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-charcoal">
                Moyenne personnelle
              </p>
              <p className="mt-2 text-lg font-bold leading-tight text-ink">
                {formatContestAverage(getContestReviewAverage(viewerReview.scores))} / {CONTEST_SCORE_MAX}
              </p>
            </div>
            <div className={styles.reviewFact}>
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
                className={styles.reviewScoreRow}
              >
                <span className="text-sm leading-relaxed text-charcoal">
                  {CONTEST_SCORE_CRITERION_LABELS[score.criterion]}
                </span>
                <span className={styles.reviewScoreValue}>
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
                  className={styles.aromaStamp}
                >
                  {tag.tag === "other" ? tag.customLabel : CONTEST_AROMA_TAG_LABELS[tag.tag]}
                </span>
              ))}
            </div>
          ) : null}

          {isConcoursEntry && viewerReview.terpeneGuesses.length > 0 ? (
            <div className={styles.methodNote}>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">
                Terpènes cochés
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {viewerReview.terpeneGuesses.map((code) => {
                  const option = CANNABIS_TERPENE_OPTIONS.find((terpene) => terpene.code === code);
                  return (
                    <span
                      key={code}
                      className={styles.aromaStamp}
                    >
                      {option?.label ?? code}
                    </span>
                  );
                })}
              </div>
              {savedTerpeneRewardUnlocked && viewerReview.status === "approved" ? (
                <p className={styles.matchNote}>
                  Ta sélection correspond aux terpènes du lot.
                </p>
              ) : null}
            </div>
          ) : null}

          {viewerReview.comment.trim() ? (
            <div className={styles.writtenNote}>
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

          {viewerReview.status === "pending" || viewerReview.status === "rejected" ? (
            <button
              type="button"
              onClick={startReviewEdit}
              className={`${styles.actionButton} ${styles.actionSpaced}`}
            >
              {viewerReview.status === "rejected" ? "Corriger et renvoyer mon guide" : "Modifier mon guide"}
            </button>
          ) : (
            <p className="mt-4 text-sm font-semibold text-charcoal">
              Ce guide a été validé. Ses notes publiées sont conservées.
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
      className={`${styles.actionButton} ${styles.actionButtonPrimary}`}
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
      <section className={styles.summaryCard} aria-label="Resume de mes notes validees">
        <div className={styles.summaryHeader}>
          <div className="min-w-0">
            <p className={styles.summaryEyebrow}>Notes validees</p>
            <h3>{entry.title}</h3>
            <p className={styles.summaryMeta}>
              {CONTEST_CONSUMPTION_METHOD_LABELS[viewerReview.consumptionMethod]}
              {viewerReview.consumptionDetails?.trim() ? ` - ${viewerReview.consumptionDetails.trim()}` : ""}
            </p>
          </div>
          <div className={styles.summaryBadge}>
            <strong>{formatContestAverage(getContestReviewAverage(viewerReview.scores))}</strong>
            <span>/100</span>
          </div>
        </div>

        <div className={styles.summaryGrid}>
          <article className={styles.summaryChartBox}>
            <ContestReviewSkillRadar
              review={viewerReview}
              comparisonScores={entry.stats.criterionAverages}
              compact
              showValues={false}
              showTotals={false}
            />
          </article>

          <div className={styles.summarySide}>
            <article className={styles.summaryBox}>
              <p className={styles.summaryEyebrow}>Gouts & terpenes</p>
              <div className={styles.summaryChipGroup}>
                {aromaLabels.length > 0 ? (
                  aromaLabels.map((label) => (
                    <span key={`aroma-${label}`} className={`${styles.summaryChip} ${styles.summaryChipYellow}`}>
                      {label}
                    </span>
                  ))
                ) : (
                  <p className={styles.summaryEmpty}>Aucun gout renseigne.</p>
                )}
              </div>

              <div className={styles.summaryTerpenes}>
                <p>Terpenes</p>
                <div className={styles.summaryChipGroup}>
                  {terpeneLabels.length > 0 ? (
                    terpeneLabels.map((label) => (
                      <span key={`terpene-${label}`} className={styles.summaryChip}>
                        {label}
                      </span>
                    ))
                  ) : (
                    <span className={styles.summaryEmpty}>Aucun terpene coche.</span>
                  )}
                </div>
              </div>
              {savedTerpeneRewardUnlocked ? (
                <p className={styles.summaryReward}>Ta sélection correspond aux terpènes du lot.</p>
              ) : null}
            </article>

            <article className={`${styles.summaryBox} ${styles.summaryWritten}`}>
              <p className={styles.summaryEyebrow}>Resume ecrit</p>
              <p>{commentText || "Aucun resume renseigne."}</p>
            </article>
          </div>
        </div>

        <div className={styles.summaryActions}>{renderNotesOpenButton("Ouvrir mes notes")}</div>
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
      <section className={styles.summaryState}>
        <div>
          <p className={styles.summaryEyebrow}>
            {CONTEST_REVIEW_STATUS_LABELS[viewerReview.status]}
          </p>
          <h3>{isPendingReview ? "Notes soumises" : "Notes a revoir"}</h3>
          <p>
            {isPendingReview
              ? "Le resume graphique apparaitra ici des que la moderation aura valide tes notes."
              : "Cette note n'a pas ete validee. Ouvre le carnet pour consulter le retour de moderation."}
          </p>
          {viewerReview.status === "rejected" && viewerReview.adminNote.trim() ? (
            <p className={styles.summaryAdminNote}>{viewerReview.adminNote}</p>
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
      data-notebook-page={pageIndex}
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
            data-notebook-page-link={index}
          >
            <span className={styles.stepTabNumber}>{index + 1}</span>
            <span className={styles.stepTabLabel}>{page}</span>
          </button>
        ))}
      </nav>

      <div key={pageIndex} className={styles.contentViewport} data-tasting-scroll>
        <div ref={reviewFeedbackRef} tabIndex={-1} className={styles.feedback}>
          {draftMessage ? <p role="status">{draftMessage}</p> : hasDraftEdits && draftKey && !submittedReview ? <p>Ton brouillon est sauvegardé sur cet appareil.</p> : null}
          {reviewMessage ? <p role="status">{reviewMessage}</p> : null}
          {reviewError ? <p role="alert">{reviewError}</p> : null}
          {reviewConflict ? <button type="button" className={styles.confirmScore} onClick={refreshPage} disabled={isPending}>Charger la nouvelle version</button> : null}
        </div>
        {renderOlderDraft()}
        <fieldset disabled={isSubmitting} className={styles.formFields}>{renderGuidePage()}</fieldset>
      </div>

      <footer className={styles.notebookFooter} data-notebook-footer>
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
          onClick={isBookDisplayMode && pageIndex === GUIDE_PAGES.length - 1 ? () => setIsGuideOpen(false) : goToNextPage}
          data-notebook-next
          disabled={!isBookDisplayMode && pageIndex === GUIDE_PAGES.length - 1}
          className={`${styles.navButton} ${styles.navButtonPrimary}`}
        >
          {isBookDisplayMode && pageIndex === GUIDE_PAGES.length - 1 ? "Mes notes" : "Suivant"}
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
                title={displayMode === "book" ? "Avant la première impression" : "Note cette fleur en 2 minutes"}
                body={displayMode === "book" ? "Installe-toi, prépare ta fleur et choisis ton mode de dégustation. Avance à ton rythme." : "Tu peux avancer sans lire le guide complet. Les aides restent disponibles si tu bloques."}
                mascotStep="start"
              />
              {isConcoursEntry ? (
                <div className={styles.goldPanel}>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#6d4b00]">
                    Repères aromatiques
                  </p>
                  <h4 className="mt-1 text-xl font-black leading-tight text-ink">
                    Reconnais les terpènes dominants
                  </h4>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-charcoal">
                    Dans l&apos;étape Odeur, coche les terpènes dominants que tu reconnais.
                    Prends le temps de décrire tes impressions pour compléter ta dégustation.
                  </p>
                </div>
              ) : null}
              <div className="grid gap-2" hidden={displayMode === "book"}>
                {quickStepSummary.map((step, index) => (
                  <div
                    key={step}
                    className={styles.preparationRow}
                  >
                    <span className={styles.preparationNumber}>
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
              <div className={styles.paperPanel}>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">
                  Ton mode de dégustation
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2" data-notebook-mode-confirmed={modeConfirmed}>
                  {CONTEST_CONSUMPTION_METHODS.map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => {
                        if (!isReviewReadOnly) {
                          setConsumptionMethod(method);
                          setModeConfirmed(true);
                          setHasDraftEdits(true);
                        }
                      }}
                      disabled={isReviewReadOnly}
                      aria-pressed={visibleConsumptionMethod === method}
                      data-notebook-method={method}
                      className={`${styles.methodButton} ${visibleConsumptionMethod === method ? styles.methodButtonActive : ""}`}
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
                  onChange={(event) => { setConsumptionDetails(event.target.value); setHasDraftEdits(true); }}
                  readOnly={isReviewReadOnly}
                  aria-label="Précisions sur ton mode de dégustation"
                  data-notebook-mode-details
                  maxLength={300}
                  placeholder="Optionnel: température, roulage, matériel..."
                  className={styles.textInput}
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
                    <div key={label} className={styles.registerEntry}>
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
                evaluatedCriteria={evaluatedCriteria}
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
                    ? "Repère les terpènes dominants et décris les arômes que tu reconnais."
                    : "Repère les familles aromatiques dominantes et note la qualité du nez."
                }
                mascotStep="smell"
              />
              {isConcoursEntry ? (
                <div className={styles.goldPanel}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#6d4b00]">
                        Repères aromatiques
                      </p>
                      <h4 className="mt-1 text-xl font-black leading-tight text-ink">
                        Quels terpènes reconnais-tu ?
                      </h4>
                    </div>
                    <span className={styles.numberStamp}>
                      {visibleSelectedTerpenes.length} coché(s)
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-charcoal">
                    Coche les terpènes que tu reconnais dans la fleur pour préciser
                    tes impressions olfactives.
                  </p>
                  {expectedTerpenes.length > 0 ? (
                    <p className={`${styles.terpeneNote} ${visibleTerpeneRewardUnlocked ? styles.terpeneNoteMatched : ""}`}>
                      {visibleTerpeneRewardUnlocked
                        ? "Combo exact détecté: garde cette sélection avant d'envoyer ton avis."
                        : "Compare les arômes perçus avec les terpènes proposés."}
                    </p>
                  ) : null}
                  <details className={styles.methodNote}>
                    <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.1em] text-ink">
                      Choisir mes terpènes ({visibleSelectedTerpenes.length})
                    </summary>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {CANNABIS_TERPENE_OPTIONS.map((terpene) => {
                        const checked = visibleSelectedTerpenes.includes(terpene.code);
                        return (
                          <label
                            key={terpene.code}
                            className={`${styles.checkOption} ${checked ? styles.checkOptionActive : ""}`}
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
              <div className={styles.paperPanel}>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">
                  Arômes perçus
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {CONTEST_AROMA_TAGS.map((tag) => {
                    const checked = visibleSelectedTags.includes(tag);
                    return (
                      <label
                        key={tag}
                        className={`${styles.checkOption} ${checked ? styles.checkOptionActive : ""}`}
                      >
                        <input
                          type="checkbox"
                          data-notebook-aroma={tag}
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
                  onChange={(event) => { setOtherAromaLabel(event.target.value); setHasDraftEdits(true); }}
                  readOnly={isReviewReadOnly}
                  aria-label="Autre arôme détecté"
                  data-notebook-other-aroma
                  data-notebook-filled={Boolean(visibleOtherAromaLabel.trim())}
                  maxLength={80}
                    placeholder="Autre arôme détecté"
                    className={styles.textInput}
                  />
                ) : null}
              </div>
              <ScoreSliderStack
                criteria={aromaCriteria}
                evaluatedCriteria={evaluatedCriteria}
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
                evaluatedCriteria={evaluatedCriteria}
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
              {isBookDisplayMode ? renderBookScoreSummary() : <div className={styles.goldPanel}>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#6d4b00]">
                  Score actuel
                </p>
                <p className="mt-2 text-4xl font-black text-ink">
                  {formatContestAverage(visibleScoreAverage)}
                </p>
                <p className="text-sm font-bold text-ink">/ {CONTEST_SCORE_MAX}</p>
              </div>}
              <ScoreSliderStack
                criteria={verdictCriteria}
                evaluatedCriteria={evaluatedCriteria}
                scores={visibleScores}
                onChange={handleScoreChange}
                disabled={isReviewReadOnly}
              />
              <div className={styles.paperPanel}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">
                    Critique rédigée
                  </p>
                  {isReviewReadOnly ? null : (
                    <button
                      type="button"
                      onClick={fillCommentDraft}
                      disabled={Boolean(comment.trim())}
                      title={comment.trim() ? "Ton texte est conservé. Vide le champ pour utiliser le modèle." : "Créer un modèle à partir de tes notes"}
                      className={styles.smallAction}
                    >
                      Préremplir
                    </button>
                  )}
                </div>
                <textarea
                  value={visibleComment}
                  onChange={(event) => { setComment(event.target.value); setHasDraftEdits(true); }}
                  aria-label="Critique rédigée"
                  data-notebook-comment
                  data-notebook-filled={Boolean(visibleComment.trim())}
                  onFocus={(event) => {
                    if (isBookDisplayMode) return;
                    const field = event.currentTarget;
                    window.setTimeout(() => {
                      if (document.activeElement === field) field.scrollIntoView({ behavior: "smooth", block: "center" });
                    }, 280);
                  }}
                  readOnly={isReviewReadOnly}
                  maxLength={2000}
                  rows={5}
                  placeholder="Ex: Belle fleur, nez fruité, bouche douce, bonne impression générale."
                  className={styles.verdictTextarea}
                />
              </div>
              {isReviewReadOnly ? null : (
                <button
                  type="button"
                  onClick={submitReview}
                  data-notebook-submit
                  disabled={isPending || isSubmitting}
                  className={`${styles.actionButton} ${styles.actionButtonPrimary}`}
                >
                  {isPending || isSubmitting ? "Envoi..." : viewerReview?.status === "rejected" && isEditingReview ? "Renvoyer mon avis corrigé" : isEditingReview ? "Enregistrer mes modifications" : "Envoyer mon avis"}
                </button>
              )}
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
    <div className={`${styles.panelRoot} ${isInlineDisplayMode ? styles.inlinePanelRoot : ""} ${displayMode === "book" ? styles.bookPanel : ""}`}>
      {isInlineDisplayMode ? (
        shouldRenderInlineGuide ? renderNotebookShell() : isBookDisplayMode ? renderBookNotes() : renderNotesTabContent()
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
                  {...TASTING_STEP_MASCOTS.start}
                  alt=""
                  sizes="(max-width: 767px) 96px, 160px"
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
