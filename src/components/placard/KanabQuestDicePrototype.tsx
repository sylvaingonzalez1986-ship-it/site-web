"use client";

import { KqFlowerTcgCard as FlowerTcgCard, KqGameDie as GameDie, KqSupportCardView as SupportCard, KqCardArtwork as CardArtwork, KQ_FLOWER_STAT_LABELS as FLOWER_STAT_LABELS, KQ_SUPPORT_CATEGORY_LABELS as CATEGORY_LABELS } from "./KqGameCards";
import { KqCardEffectGuide as CardEffectGuide, KqCardRoleLegend } from "./KqCardEffectGuide";
import { KQ_SITUATION_TAG_LABELS, KQ_CARD_RARITY_LABELS, getKqCardRarityLabel } from "@/lib/kanab-quest-card-guide";
import { AppDialog } from "@/components/ui/AppDialog";
import { navigateAfterOverlays } from "@/lib/overlay-history";
import { useGameViewport } from "@/hooks/useGameViewport";
import { getBuddieArtwork } from "@/lib/buddie-artwork";
import { getKqProductionUnits } from "@/lib/kanab-quest-production";
import { KqEnergyPanel } from "./KqEnergyPanel";
import { KqBuddieCarousel } from "./KqBuddieCarousel";
import { getKqBuddieRotationMessage, getKqBuddieRotationRemaining, KQ_BUDDIE_ROTATION_REQUIRED, recordKqBuddieUse, type KqBuddieRotation } from "@/lib/kanab-quest-buddie-rotation";
import { KqInventoryCarousel } from "./KqInventoryCarousel";
import { KqDeckPreparation } from "./KqDeckPreparation";
import { KqSupportRecovery } from "./KqSupportRecovery";
import { getKqPreparationStartingXp } from "@/lib/kanab-quest-deck-preparation";
import { getKqVerifiedPreparationHeritages, reconcileKqPreparationSelection, type KqPreparationSelection } from "@/lib/kanab-quest-preparation-selection";
import { CHANVRIER_STRENGTHS, type ChanvrierStrength } from "@/lib/arena-chanvrier";
import { KqHeritageCarousel } from "./KqHeritageCarousel";
import { KqSeasonBoard } from "./KqSeasonBoard";
import { KqBattleHistory } from "./KqBattleHistory";
import { KqBattleVerdictDialog } from "./KqBattleVerdictDialog";
import { KqCulturePreparation } from "./KqCulturePreparation";
import { KqCultureContract } from "./KqCultureContract";
import { useKqGameSound } from "./KqGameSound";
import { KqHarvestMoment } from "./KqHarvestMoment";
import { KqHarvestTierProgress } from "./KqHarvestTierProgress";
import { KqCardPlayPreview } from "./KqCardPlayPreview";
import { getKqCardPlayPreview } from "@/lib/kanab-quest-card-preview";
import { KQ_HARVEST_TIERS_LEGACY, KQ_HARVEST_TIERS_V2, KQ_LEGENDARY_REQUIREMENTS } from "@/lib/kanab-quest-harvest-tiers";
import { KQ_ENERGY_MODES, type KqEnergyMode, type KqEnergyQuote } from "@/lib/kanab-quest-energy";

import Image from "next/image";
import dynamic from "next/dynamic";
import Link from "@/components/navigation/NavigationLink";
import { ArrowRight, Banknote, Check, ChevronDown, CircleHelp, Dices, Flame, Layers3, Leaf, RotateCcw, Scale, ShoppingBag, Sparkles, Star, Swords, Target, Trophy, X, Zap } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { playKqDiceAnimation } from "@/lib/kanab-quest-dice-animation";
import {
  advanceKqStage,
  activateKqHeritage,
  canActivateKqHeritage,
  canRedrawKqHand,
  getKqHandCodes,
  getKqEffectNoticeKind,
  getKqHarvestBreakdown,
  getKqHarvestTier,
  getKqStateHeritage,
  getKqRunProjection,
  getKqStageTarget,
  getKqUnrescuedZeroSuccessStageCount,
  hasKqFirstCultureRescue,
  getKqCardTradeoff,
  KQ_LIVING_SOIL,
  getKqCultureSystemSituationStatus,
  getKqSituation,
  doesKqCardMatchSituation,
  isKqCultureDead,
  KQ_BUDDIES,
  KQ_CARDS,
  KQ_ACTIVE_CARDS,
  KQ_HAND_SIZE,
  KQ_COLLECTIONS,
  KQ_STAGES,
  getKqStageDisplayName,
  playKqCard,
  previewKqResolution,
  redrawKqHand,
  resolveKqStage,
  rollKqDice,
  startKqGame,
  swapKqHeritageHandCard,
  type KqGameState,
  type KqSupportCard,
} from "@/lib/kanab-quest-game";
import { createKqFlower, createKqOpponent, getKqJuryProgram, lockKqBattle, resolveKqBattle, type KqBattle } from "@/lib/kanab-quest-battle";
import { KqCultureCarePanel } from "./KqCultureCarePanel";
import { KqCannabinoidReport } from "./KqCannabinoidReport";
import { addKqBoosterToInventory, applyKqArenaStreakReward, openKqSupportBooster } from "@/lib/kanab-quest-booster";
import { claimKqChallenges, evaluateKqChallenges, getKqChallengeProgress, getKqDailyChallenges, getKqGameChallengeDate } from "@/lib/kanab-quest-challenges";
import { buildKqCollectionDeck, buildKqRecommendedDeck, getKqCardChallengeFit, getKqDeckCoverage, getKqOpeningHandChance, sanitizeKqDeckSelection, summarizeKqCardEconomy } from "@/lib/kanab-quest-economy";
import { applyKqBattleToRanking, createKqRankProfile, getKqLocalLeaderboard, getKqMatchmaking, type KqRankProfile } from "@/lib/kanab-quest-ranking";
import { createLocalKqRepository, type KqBurnReceipt, type KqFavoriteDeck, type KqRepository } from "@/lib/kanab-quest-repository";
import { KQ_HERITAGE_CARDS, type KqHeritageCard } from "@/lib/kanab-quest-heritage";
import { getKqCardArtwork } from "@/lib/kanab-quest-artwork";
import { getKqSituationArtwork } from "@/lib/kanab-quest-situation-artwork";
import { getKqOutcomeArtwork, KQ_OUTCOME_LABELS } from "@/lib/kanab-quest-outcome-artwork";
import { getKqFeedbackTone } from "@/lib/kanab-quest-feedback";
import { calculateKqPlacardScore } from "@/lib/kanab-quest-reputation";
import {
  getKqJuryScoreFromRounds,
  getKqPinnedRouteFlowerPreview,
  getKqPinnedRouteVerdictStatus,
  KQ_MARKET_ROUTES,
  type KqMarketRouteCode,
} from "@/lib/kanab-quest-market";
import { applyKqRemoteAction, createKqScopedRequest, enqueueKqRemoteRandomBattle, finalizeKqRemoteBattle, finalizeKqRemoteBotBattle, getKqRemoteActiveRun, getKqRemoteBattles, getKqRemoteFlowers, leaveKqRemoteRandomBattleQueue, playKqRemoteCard, pollKqRemoteRandomBattleQueue, startKqRemoteRun, swapKqRemoteHeritageCard, type KqApiBurnReceipt, type KqApiScope, type KqOfficialBattle, type KqOfficialFlower } from "@/lib/kanab-quest-api";
import { startArenaVisiblePolling } from "@/lib/arena-visible-polling";
import { canReuseKqBootstrapProgress } from "@/lib/kanab-quest-bootstrap-policy";
import { formatKqQueueWait } from "@/lib/kanab-quest-random-queue";
import { getKqRemainingDailyChallengePoints, KQ_REWARD_BALANCE } from "@/lib/kanab-quest-reward-balance";
import { KqPhysicsDice, type KqDiceMotionPhase, type KqPhysicsDiceHandle } from "./KqPhysicsDice";
import { assistKqPlayableLesson, type KqPlayableLessonPort } from "@/lib/kanab-quest-playable-lesson";
import { getKqPlayerCardChoices, getKqPlayerCardPermission } from "@/lib/kanab-quest-player-feedback";
import { getKqPressureHint, getKqTurnPreview } from "@/lib/kanab-quest-turn-preview";
import { KqTurnPreview } from "./KqTurnPreview";
import { KqCultureRecap, KqJuryRecap } from "./KqPersonalRecap";
import { clearKqZoneStartRequestKey, getKqClientRunZoneId, getKqZoneStartRequestKey, KQ_CAMPAIGN_START_SCOPE, selectKqClientRun, type KqClientRunSelection } from "@/lib/kanab-quest-client-run-selection";
import { getKqCampaignMemberState, getKqCampaignParticipants } from "@/lib/kanab-quest-campaign";
import { KqCampaignSummary } from "./KqCampaignSummary";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import { isKqWarehouseState, type KqWarehouseZone } from "@/lib/kanab-quest-warehouse";
import styles from "./KanabQuestDicePrototype.module.css";

const LOCAL_COLLECTION_CODES = KQ_ACTIVE_CARDS.map((card) => card.code);
const DEFAULT_LOCAL_INVENTORY = Object.fromEntries(KQ_ACTIVE_CARDS.map((card) => [card.code, 3]));
const isVerifiedInventory = (value: unknown): value is Record<string, number> => Boolean(value) && typeof value === "object"
  && !Array.isArray(value) && Object.values(value as Record<string, unknown>).every(count => Number.isSafeInteger(count) && Number(count) >= 0);
const RecoveryTrial = dynamic(() => import("./KqFirstCultureTrial").then(module => module.KqFirstCultureTrial), { ssr: false });
type RemoteCollectionStatus = {
  loading: boolean;
  error: string;
  ownerFound: boolean;
  collectionActive: boolean;
  totalCopies: number;
  cardCount: number;
  cultureTokenBalance: number;
};
type OfficialRankProgress = {
  seasonCode: string;
  rank: number | null;
  placardScore: number;
  rating: number;
  seasonPoints: number;
  reputation: number;
  businessScore: number;
  wins: number;
  losses: number;
  streak: number;
  leaderboardGeneratedAt?: string | null;
  arenaExperience: number;
  claimedChallengeCodes: string[];
};
type OfficialLeaderboardEntry = {
  rank: number;
  pseudo: string;
  placardScore: number;
  rating: number;
  seasonPoints: number;
  reputation: number;
  businessScore?: number | null;
  wins: number;
  losses: number;
  streak: number;
};
type BotBattleResult = {
  battleId: string;
  playerFlowerId: string;
  winner: "player" | "opponent";
  burnedAt: string;
  experienceAwarded: number;
  todayCount: number;
  dailyLimit: number;
  opponentName: string;
  varietyName: string;
  rounds: KqOfficialBattle["rounds"];
  challengePoints: number;
  completedChallenges: Array<{ code: string; title: string; points: number }>;
  rewardCard: null | {
    code: string;
    name: string;
    rarity: string;
    description: string;
    imageUrl: string;
  };
};
type OfficialBattleResult = {
  battleId: string;
  playerFlowerId?: string;
  winner: "player" | "opponent";
  burnedAt: string;
  experienceAwarded: number;
  rounds: KqOfficialBattle["rounds"];
  playerVariety: string;
  opponentVariety: string;
  challengePoints: number;
  completedChallengeTitles: string[];
  pvpBoosterGranted: boolean;
  pvpBoosterCardCount: number;
  rankProfile: null | {
    rating: number;
    seasonPoints: number;
    wins: number;
    losses: number;
    streak: number;
  };
};
type PlayerSessionPayload = {
  buddieRotation?: KqBuddieRotation | null;
  warnings?: string[];
  activeRun?: Awaited<ReturnType<typeof getKqRemoteActiveRun>>["activeRun"];
  activeRuns?: NonNullable<Awaited<ReturnType<typeof getKqRemoteActiveRun>>["activeRun"]>[];
  flowers?: KqOfficialFlower[];
  battles?: KqOfficialBattle[];
  progress?: OfficialRankProgress | null;
};
type KqRoutePlan = { route: KqMarketRouteCode; equipmentCode: string };
type RemoteHeritageCard = KqHeritageCard & {
  isActive: boolean;
  ownedCopies: number;
  producerNames: string[];
};

const PEST_LABELS = { aphids: "Pucerons", mites: "Acariens", thrips: "Thrips" } as const;
const SITUATION_TAG_LABELS = KQ_SITUATION_TAG_LABELS;
const INCIDENT_LABELS = {
  "electricity-bill": "Incident · Trésorerie",
  "ddtm-inspection": "Incident · Contrôle",
  "crop-theft": "Incident · Sécurité",
} as const;
const COVERAGE_LABELS = { roots: "Racines", water: "Eau", climate: "Climat", pest: "Ravageurs", flower: "Floraison", drying: "Séchage" } as const;
function PinnedRouteFlowerTarget({
  route,
  stats,
}: {
  route: KqMarketRouteCode | null;
  stats: Record<string, number>;
}) {
  const preview = getKqPinnedRouteFlowerPreview({ route, stats });
  if (!preview) return null;
  return (
    <div className={styles.flowerRouteTarget} data-ready={preview.likelyReady || undefined}>
      <Target aria-hidden="true" />
      <span>
        <small>Filière épinglée · estimation pré-jury</small>
        <strong>{preview.name} · seuil {preview.minimumJuryScore.toFixed(1)}/10</strong>
        <em>{preview.likelyReady
          ? `Profil estimé ${preview.estimatedJuryScore.toFixed(1)}/10 · seuil atteint avant verdict`
          : `Profil estimé ${preview.estimatedJuryScore.toFixed(1)}/10 · encore +${preview.qualityGap.toFixed(1)}`}</em>
      </span>
    </div>
  );
}

function VerdictMarketTarget({
  route,
  rounds,
}: {
  route: KqMarketRouteCode | null;
  rounds: Array<{ playerScore: number; opponentScore: number }>;
}) {
  const juryScore = getKqJuryScoreFromRounds(rounds, "player");
  const routeStatus = getKqPinnedRouteVerdictStatus({ route, rounds });
  return (
    <section className={styles.verdictMarketTarget} data-qualified={routeStatus?.qualified || undefined} aria-label="Résultat commercial du jury">
      <Banknote aria-hidden="true" />
      <span>
        <small>Note du jury</small>
        <strong>{juryScore.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}/10</strong>
        <b>{routeStatus
          ? routeStatus.qualified
            ? `${routeStatus.name} · seuil qualité atteint`
            : `${routeStatus.name} · seuil non atteint au jury`
          : "Ta récolte continue au comptoir"}</b>
        <em>Affinage : 6 h réelles après le verdict. Avant maturité, reprise grossiste possible selon son quota.</em>
        <em>Le comptoir confirme le stock, les contenants et les offres.</em>
      </span>
    </section>
  );
}

const STAGE_ILLUSTRATIONS: Record<(typeof KQ_STAGES)[number], { src: string; alt: string }> = {
  Germination: {
    src: "/app/kanab-quest/stages/sylvain-germination-v1.webp",
    alt: "Sylvain place une graine germée dans son support de culture",
  },
  Enracinement: {
    src: "/app/kanab-quest/stages/sylvain-enracinement-v1.webp",
    alt: "Sylvain transplante un jeune plant aux racines développées",
  },
  Croissance: {
    src: "/app/kanab-quest/stages/sylvain-croissance-v1.webp",
    alt: "Sylvain guide les branches du plant pendant sa croissance",
  },
  Floraison: {
    src: "/app/kanab-quest/stages/sylvain-floraison-v1.webp",
    alt: "Sylvain inspecte la floraison et règle la ventilation",
  },
  Récolte: {
    src: "/app/kanab-quest/stages/sylvain-recolte-v1.webp",
    alt: "Sylvain récolte soigneusement les fleurs arrivées à maturité",
  },
  "Séchage & affinage": {
    src: "/app/kanab-quest/stages/sylvain-sechage-affinage-v1.webp",
    alt: "Sylvain contrôle le séchage de sa récolte avant le jury",
  },
};
const DICE_ROLL_DURATION_MS = 1350;
const formatKqDate = (value: string | null | undefined) => value ? new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
}).format(new Date(value)) : "date inconnue";
const toLocalReceipt = (receipt: KqApiBurnReceipt, runSeed: number): KqBurnReceipt => ({
  id: receipt.id, cardCode: receipt.cardCode, runSeed, stageIndex: receipt.stageIndex,
  useKind: receipt.useKind, burnedAt: receipt.burnedAt,
});

function HarvestYieldBreakdown({ state }: { state: KqGameState }) {
  const breakdown = getKqHarvestBreakdown(state);
  const tentCount = getKqProductionUnits(state.equipment?.productionUnits);
  const grams = (value: number) => `${value.toLocaleString("fr-FR")} g`;
  const isComplete = state.phase === "complete";
  return (
    <section className={styles.tentHarvestBreakdown} aria-label="Détail de la récolte">
      <h3>{state.warehouse ? `Récolte des ${state.warehouse.activeAreaM2} m² cultivés` : tentCount > 1 ? `${tentCount} tentes · récoltes additionnées` : "Récolte de la tente"}</h3>
      {breakdown.tentHarvests === null ? <p>Le total enregistré de cette ancienne récolte est conservé.</p> : <>
        {breakdown.tentHarvests.length > 1 ? <ul className={styles.tentHarvestList}>
          {breakdown.tentHarvests.map(tent => <li key={tent.tentNumber}>
            <span><b>Tente {tent.tentNumber}</b><small>{tent.quantityPercent > 0 ? `Matériel : +${tent.quantityPercent.toLocaleString("fr-FR")} % de quantité` : "Matériel : quantité de base"}</small></span>
            <span><strong>{grams(tent.finalHarvestGrams)}</strong>{breakdown.harvestLossPercent > 0 ? <small>{grams(tent.grossHarvestGrams)} avant pertes</small> : null}</span>
          </li>)}
        </ul> : null}
        <div className={styles.yieldEquation}>
          <span><small>Total avant pertes</small><strong>{grams(breakdown.grossHarvestGrams)}</strong></span>
          <span data-loss={breakdown.harvestLossPercent > 0 || undefined}><small>Pertes{breakdown.harvestLossPercent > 0 ? ` · −${breakdown.harvestLossPercent} %` : ""}</small><strong>{breakdown.lostHarvestGrams > 0 ? `−${grams(breakdown.lostHarvestGrams)}` : "Aucune"}</strong></span>
          {state.energy && breakdown.energyAdjustmentGrams !== 0 ? <span><small>Mode {KQ_ENERGY_MODES[state.energy.mode].name}</small><strong>{breakdown.energyAdjustmentGrams > 0 ? "+" : ""}{grams(breakdown.energyAdjustmentGrams)}</strong></span> : null}
        </div>
      </>}
      <p className={styles.tentHarvestTotal}><span>{isComplete ? "Total récolté" : "Total estimé"}{breakdown.harvestLossPercent > 0 ? " après pertes" : ""}</span><strong>{grams(breakdown.finalHarvestGrams)}</strong></p>
      {tentCount > 1 ? <p>Chaque tente contribue selon son propre matériel ; une tente de départ produit moins qu’une tente améliorée.</p> : null}
    </section>
  );
}

function HarvestScoreSheet({ state }: { state: KqGameState }) {
  const breakdown = getKqHarvestBreakdown(state);
  const signed = (value: number) => `${value > 0 ? "+" : ""}${value}`;
  return (
    <section className={styles.harvestScoreSheet} aria-label="Bulletin de la récolte">
      <header><span><Trophy aria-hidden="true" /><small>Bulletin de culture</small><strong>Pourquoi cette note ?</strong></span><p>Chaque chiffre vient du moteur de la partie.</p></header>
      <div className={styles.qualityEquation} aria-label={`${breakdown.stageQuality} points de culture plus ${breakdown.equipmentQualityBonus} points de matériel donnent ${breakdown.finalQuality} points de qualité`}>
        <article><small>Résultats des 6 étapes</small><strong>{signed(breakdown.stageQuality)}</strong></article><b>+</b>
        <article><small>Matériel durable</small><strong>{signed(breakdown.equipmentQualityBonus)}</strong></article><b>=</b>
        <article data-final><small>Qualité finale</small><strong>{breakdown.finalQuality}</strong></article>
      </div>
      <HarvestYieldBreakdown state={state} />
      <ol className={styles.harvestStageLedger}>
        {state.history.map((entry, index) => <li key={entry.stage} data-outcome={entry.outcome}><b>{index + 1}</b><span><strong>{getKqStageDisplayName(entry.stage)}</strong><small>{entry.situation} · dés {entry.dice.join("-")}</small></span><em>{KQ_OUTCOME_LABELS[entry.outcome]}</em><mark data-negative={(entry.qualityDelta ?? 0) < 0 || undefined}>{entry.qualityDelta === undefined ? "Ancien reçu" : `${signed(entry.qualityDelta)} qualité · +${entry.xpGain ?? 0} XP`}</mark></li>)}
      </ol>
    </section>
  );
}

type KqDiceProps = {
  apiScope?: KqApiScope;
  showAdminOperations?: boolean;
  showPackLab?: boolean;
  viewMode?: "full" | "game" | "arena";
  onOpenArena?: () => void;
  onOpenGame?: () => void;
  onOpenMarket?: (flowerId?: string) => void;
  onOpenRun?: (selection: KqClientRunSelection) => void;
  onOpenWarehouse?: (zoneId?: string) => void;
  showWarehouseNavigation?: boolean;
  initialFlowerId?: string;
  initialZoneId?: string;
  initialRunId?: string;
  initialCampaign?: boolean;
  tutorial?: KqPlayableLessonPort;
  isolatedStorage?: { persistent: Pick<Storage, "getItem" | "setItem" | "removeItem">; session: Pick<Storage, "getItem" | "setItem" | "removeItem"> };
  onPreparationChange?: (preparation: KqPreparationSelection) => void;
  onPreparationConsumed?: () => void;
  initialPreparation?: KqPreparationSelection;
};

export function KanabQuestDicePrototype(props: KqDiceProps) {
  const warehouseHref = `/arene/placard?view=workshop${props.initialZoneId ? `&zone=${encodeURIComponent(props.initialZoneId)}` : ""}`;
  return <>{props.showWarehouseNavigation !== false && props.apiScope === "player" && !props.tutorial && props.viewMode !== "arena" ? <nav className={styles.zoneNavigation} aria-label="Navigation de la culture">{props.onOpenWarehouse ? <button type="button" onClick={() => props.onOpenWarehouse?.(props.initialZoneId)}>← L’entrepôt</button> : <Link href={warehouseHref}>← L’entrepôt</Link>}</nav> : null}<KqGameSession key={`${props.apiScope ?? "admin"}:${props.initialZoneId ?? ""}:${props.initialRunId ?? ""}:${props.initialCampaign ? "campaign" : "single"}`} {...props} /></>;
}

function KqGameSession({
  apiScope = "admin",
  showAdminOperations: requestedAdminOperations = true,
  showPackLab = false,
  viewMode = "full",
  onOpenArena,
  onOpenGame,
  onOpenMarket,
  initialFlowerId,
  initialZoneId,
  initialRunId,
  initialCampaign = false,
  onOpenRun,
  onOpenWarehouse,
  tutorial,
  isolatedStorage,
  onPreparationChange,
  onPreparationConsumed,
  initialPreparation,
}: KqDiceProps) {
  const api = useKqTutorialApi();
  const sound = useKqGameSound();
  const [freshHarvestKey, setFreshHarvestKey] = useState<string | null>(null);
  const [presentationView, setPresentationView] = useState(viewMode);
  const currentPresentationView = useRef(viewMode);
  // The same session serves culture and jury. Consume the entrance animation
  // when leaving its view, while preserving the authoritative game state.
  if (presentationView !== viewMode) {
    setPresentationView(viewMode);
    setFreshHarvestKey(null);
  }
  useLayoutEffect(() => { currentPresentationView.current = viewMode; }, [viewMode]);
  const isPlayerMode = !tutorial && apiScope === "player";
  const playerPresentation = isPlayerMode || Boolean(tutorial);
  const showAdminOperations = !tutorial && requestedAdminOperations;
  const lifecycle = useRef<{ mounted: boolean; controller: AbortController | null }>({ mounted: false, controller: null });
  useEffect(() => {
    lifecycle.current = { mounted: true, controller: new AbortController() };
    return () => { lifecycle.current.mounted = false; lifecycle.current.controller?.abort(); };
  }, []);
  const remoteRequest = useMemo<typeof fetch>(() => {
    if (tutorial) return async () => Response.json({ error: "Action officielle indisponible dans cet essai." }, { status: 403 });
    // Exercise transports own their notifications too; the live scoped helper
    // deliberately emits account progress events after official transactions.
    const request: typeof fetch = api.isTutorial
      ? (input, init) => api.request(typeof input === "string" && apiScope === "player" ? input.replace(/^\/api\/admin\/placard/, "/api/arena/placard") : input, init)
      : createKqScopedRequest(apiScope, api.request);
    return async (input, init) => {
      const signal = lifecycle.current.controller?.signal;
      if (!lifecycle.current.mounted || signal?.aborted) throw new DOMException("Culture fermée", "AbortError");
      const response = await request(input, { ...init, signal: signal && init?.signal ? AbortSignal.any([signal, init.signal]) : signal ?? init?.signal });
      if (!lifecycle.current.mounted) throw new DOMException("Culture fermée", "AbortError");
      return response;
    };
  }, [api, apiScope, tutorial]);
  const sessionStoragePrefix = isPlayerMode ? `kq-player${initialZoneId ? `-zone-${initialZoneId}` : initialRunId ? `-run-${initialRunId}` : ""}` : "kq-admin";
  const [zoneContext, setZoneContext] = useState<KqWarehouseZone | null>(null);
  const [campaignParticipants, setCampaignParticipants] = useState<ReturnType<typeof getKqCampaignParticipants>>([]);
  const [selectionReady, setSelectionReady] = useState(!isPlayerMode);
  const [selectionError, setSelectionError] = useState("");
  const [contractBusy, setContractBusy] = useState(false);
  const [activeRuns, setActiveRuns] = useState<NonNullable<PlayerSessionPayload["activeRun"]>[]>([]);
  const startInFlight = useRef(false);
  const [state, setState] = useState<KqGameState>(() => tutorial?.initialGame ?? startKqGame(2026, { domiciliation: "retired" }));
  const cultureDead = isKqCultureDead(state);
  const outcomeArtwork = getKqOutcomeArtwork(state);
  const zeroSuccessStages = getKqUnrescuedZeroSuccessStageCount(state);
  const firstCultureRescueAvailable = hasKqFirstCultureRescue(state);
  const rescuedStageIndex = state.history.findIndex(entry => entry.rescued === true);
  const [recoveryTrialOpen, setRecoveryTrialOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [rolling, setRolling] = useState(false);
  const rollInFlightRef = useRef(false);
  const [gameActionError, setGameActionError] = useState("");
  const [directDiceResult, setDirectDiceResult] = useState(false);
  const [physicsDiceActive, setPhysicsDiceActive] = useState(false);
  const [diceMotionPhase, setDiceMotionPhase] = useState<KqDiceMotionPhase>("idle");
  const [diceVisualSyncing, setDiceVisualSyncing] = useState(false);
  const [battle, setBattle] = useState<KqBattle | null>(null);
  const [battleHistory, setBattleHistory] = useState<KqBattle[]>([]);
  const [burnHistory, setBurnHistory] = useState<KqBurnReceipt[]>([]);
  const [inventory, setInventory] = useState<Record<string, number>>(() => ({ ...DEFAULT_LOCAL_INVENTORY }));
  const [setupOpen, setSetupOpen] = useState(tutorial?.setupOpen ?? true);
  const [setupSection, setSetupSection] = useState<"buddie" | "cards" | "heritage" | null>(null);
  const [selectedBuddie, setSelectedBuddie] = useState(tutorial?.initialGame.varietyCode ?? KQ_BUDDIES[0].code);
  const initialPreparationRef = useRef(initialPreparation);
  const [selectedCards, setSelectedCards] = useState<string[]>(() => [...(initialPreparation?.deckCodes ?? tutorial?.initialGame.deckCodes ?? ["BOTTE-003", "BOTTE-017", "BOTTE-005", "BOTTE-006"])]);
  const [selectedHeritage, setSelectedHeritage] = useState(initialPreparation?.heritageCode ?? "");
  const [preparationNotice, setPreparationNotice] = useState("");
  const preparationCallbacks = useRef({ change: onPreparationChange, consumed: onPreparationConsumed });
  const publishedPreparation = useRef<string | null>(null);
  const consumedPreparationRun = useRef<string | null>(null);
  useLayoutEffect(() => { preparationCallbacks.current = { change: onPreparationChange, consumed: onPreparationConsumed }; }, [onPreparationChange, onPreparationConsumed]);
  const consumePreparation = useCallback((runId: string) => {
    if (consumedPreparationRun.current === runId) return;
    consumedPreparationRun.current = runId;
    publishedPreparation.current = null;
    preparationCallbacks.current.consumed?.();
  }, []);
  const [heritageSwapOutIndex, setHeritageSwapOutIndex] = useState<number | null>(null);
  const [heritageExchangeTab, setHeritageExchangeTab] = useState<"hand" | "reserve">("hand");
  const [rankProfile, setRankProfile] = useState<KqRankProfile>(() => createKqRankProfile());
  const [pendingBurnCode, setPendingBurnCode] = useState<string | null>(null);
  const [handFilterChoice, setHandFilterChoice] = useState<{ scope: string; value: "playable" | "all" } | null>(null);
  const [pendingStart, setPendingStart] = useState(false);
  const [lastBooster, setLastBooster] = useState<KqSupportCard[]>([]);
  const [boosterNonce, setBoosterNonce] = useState(0);
  const [pendingBattleVerdict, setPendingBattleVerdict] = useState(false);
  const rollTimerRef = useRef<number | null>(null);
  const physicsDiceRef = useRef<KqPhysicsDiceHandle | null>(null);
  const verdictTimerRef = useRef<number | null>(null);
  const repositoryRef = useRef<KqRepository | null>(null);
  const remoteInventoryRef = useRef<Record<string, number>>({});
  const remoteAvailableInventoryRef = useRef<Record<string, number>>({});
  const remoteInventoryVerifiedRef = useRef(false);
  const skipNextSessionFetchRef = useRef(false);
  const gameViewportRef = useGameViewport(`${viewMode}:${setupOpen ? "setup" : cultureDead ? "dead" : state.phase === "complete" ? "harvest" : "play"}`);
  const [revealedRounds, setRevealedRounds] = useState(0);
  const [deckNotice, setDeckNotice] = useState("");
  const [deckFilter, setDeckFilter] = useState<"all" | "equipment" | "know-how" | "luck">("all");
  const [deckRarity, setDeckRarity] = useState("all");
  const [favoriteDeck, setFavoriteDeck] = useState<KqFavoriteDeck | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [dailyChallenges, setDailyChallenges] = useState(() => getKqDailyChallenges());
  const [remoteCollection, setRemoteCollection] = useState<RemoteCollectionStatus>({
    loading: true, error: "", ownerFound: false, collectionActive: false, totalCopies: 0, cardCount: 0, cultureTokenBalance: 0,
  });
  const [collectionRefreshNonce, setCollectionRefreshNonce] = useState(0);
  const [remoteInventory, setRemoteInventory] = useState<Record<string, number>>({});
  const [remoteAvailableInventory, setRemoteAvailableInventory] = useState<Record<string, number>>({});
  const [remoteHeritageOwnedCodes, setRemoteHeritageOwnedCodes] = useState<string[]>([]);
  const [remoteHeritageVerified, setRemoteHeritageVerified] = useState(false);
  const [remoteHeritageCards, setRemoteHeritageCards] = useState<RemoteHeritageCard[]>([]);
  const [remoteHeritageProducerNames, setRemoteHeritageProducerNames] = useState<Record<string, string[]>>({});
  const [launchReadiness, setLaunchReadiness] = useState<null | {
    contentReady: boolean;
    readyForActivation: boolean;
    safelyDormant: boolean;
    checks: Array<{ code: string; label: string; ready: boolean }>;
    blockers: string[];
    activationStillRequired: string[];
  }>(null);
  const [seasonRewardPreview, setSeasonRewardPreview] = useState<null | {
    rewardsLive: boolean;
    eligiblePlayers: number;
    alreadyGranted: number;
    pendingGrants: number;
    totalSupportBoosters: number;
    totalHeritageFragments: number;
  }>(null);
  const [seasonRolloverPreview, setSeasonRolloverPreview] = useState<null | {
    fromSeason: string;
    toSeason: string | null;
    players: number;
    eligiblePlayers: number;
    missingRewardGrants: number;
    lockedBattles: number;
    ready: boolean;
    blockers: string[];
  }>(null);
  const [notebookRewardPreview, setNotebookRewardPreview] = useState<null | {
    rewardsLive: boolean;
    unlockedBadges: number;
    alreadyGranted: number;
    pendingBadges: number;
    pendingSupportBoosters: number;
    pendingCultureTokens: number;
    badges: Array<{
      profileBadgeId: number;
      code: string;
      label: string;
      supportBoosters: number;
      cultureTokens: number;
      granted: boolean;
    }>;
  }>(null);
  const [seasonDistributionPending, setSeasonDistributionPending] = useState(false);
  const [notebookRetroCursor, setNotebookRetroCursor] = useState<number | null>(0);
  const [notebookRetroPending, setNotebookRetroPending] = useState(false);
  const [remoteBurnsEnabled, setRemoteBurnsEnabled] = useState(isPlayerMode);
  const [energyMode, setEnergyMode] = useState<KqEnergyMode>("balanced");
  const [energyEstimate, setEnergyEstimate] = useState<KqEnergyQuote | null>(null);
  const [remoteRunId, setRemoteRunId] = useState<string | null>(null);
  const [persistedFlowerId, setPersistedFlowerId] = useState<string | null>(null);
  const [officialFlowers, setOfficialFlowers] = useState<KqOfficialFlower[]>([]);
  const focusedFlowerId = useRef<string | null>(null);
  useEffect(() => {
    if (!hydrated || viewMode !== "arena" || !initialFlowerId || focusedFlowerId.current === initialFlowerId || !officialFlowers.some(flower => flower.id === initialFlowerId)) return;
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(`placard-flower-${initialFlowerId}`);
      if (!target) return;
      focusedFlowerId.current = initialFlowerId;
      target.scrollIntoView({ block: "start", behavior: "instant" });
      target.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hydrated, initialFlowerId, officialFlowers, viewMode]);
  const queuedFlowerIdsKey = useMemo(() => officialFlowers
    .filter((flower) => flower.status === "queued")
    .map((flower) => flower.id)
    .sort()
    .join(","), [officialFlowers]);
  const [botBattleResult, setBotBattleResult] = useState<BotBattleResult | null>(null);
  const [matchmakingLoading, setMatchmakingLoading] = useState(false);
  const [juryCheckNeeded, setJuryCheckNeeded] = useState(false);
  const [juryChecking, setJuryChecking] = useState(false);
  const juryMutationLock = useRef(false);
  const juryUncertain = useRef(false);
  const juryPresentation = useRef(true);
  const juryPending = useRef<{ flowerId?: string; battleId?: string } | null>(null);
  const [pendingRandomQueueFlowerId, setPendingRandomQueueFlowerId] = useState<string | null>(null);
  const [pendingTrainingFlowerId, setPendingTrainingFlowerId] = useState<string | null>(null);
  const [officialBattles, setOfficialBattles] = useState<KqOfficialBattle[]>([]);
  const [recentBattlesLoaded, setRecentBattlesLoaded] = useState(false);
  const [recentBattlesLoading, setRecentBattlesLoading] = useState(false);
  const [recentBattlesError, setRecentBattlesError] = useState("");
  const [pendingOfficialVerdictId, setPendingOfficialVerdictId] = useState<string | null>(null);
  const [officialBattleResult, setOfficialBattleResult] = useState<OfficialBattleResult | null>(null);
  const botRecapBattle = botBattleResult ? officialBattles.find(item => item.id === botBattleResult.battleId) : undefined;
  const officialRecapBattle = officialBattleResult ? officialBattles.find(item => item.id === officialBattleResult.battleId) : undefined;
  // Bind the continuation to this verdict, never to a subsequently selected Flower.
  const officialVerdictFlowerId = officialBattleResult?.playerFlowerId ?? officialRecapBattle?.playerFlower.id;
  const [officialChallengeReward, setOfficialChallengeReward] = useState<{ points: number; titles: string[] } | null>(null);
  const [remoteAction, setRemoteAction] = useState<"start" | "card" | "game" | null>(null);
  const [careBusy, setCareBusy] = useState(false);
  const careStorage = !remoteBurnsEnabled && typeof window !== "undefined" ? tutorial?.storage ?? (isolatedStorage?.persistent ?? window.localStorage) : undefined;
  const [remoteNotice, setRemoteNotice] = useState("");
  const [ownedBuddieCodes, setOwnedBuddieCodes] = useState<string[]>([]);
  const [buddieRotation, setBuddieRotation] = useState<KqBuddieRotation | null>(null);
  const [ownedBuddieArtwork, setOwnedBuddieArtwork] = useState<Record<string, { imageUrl: string; ownedCopies: number }>>({});
  const [officialRankProgress, setOfficialRankProgress] = useState<OfficialRankProgress | null>(null);
  const [officialLeaderboard, setOfficialLeaderboard] = useState<OfficialLeaderboardEntry[]>([]);
  const [routePlan, setRoutePlan] = useState<KqRoutePlan | null>(null);
  const [preparationStrength, setPreparationStrength] = useState<ChanvrierStrength | null | undefined>(undefined);
  const plannedMarketRoute = useMemo(
    () => routePlan ? KQ_MARKET_ROUTES.find((route) => route.code === routePlan.route) ?? null : null,
    [routePlan],
  );

  const preparationBuddie = isPlayerMode ? campaignParticipants[0]?.buddieCode ?? "" : selectedBuddie;
  const unavailableParticipant = campaignParticipants.find(member => !ownedBuddieCodes.includes(member.buddieCode)
    || getKqBuddieRotationRemaining(member.buddieCode, buddieRotation?.recentBuddieCodes ?? []) > 0);
  const selectedBuddieRemaining = remoteBurnsEnabled && buddieRotation
    ? getKqBuddieRotationRemaining(preparationBuddie, buddieRotation.recentBuddieCodes) : 0;
  const buddieStartBlockReason = isPlayerMode && (!selectionReady || selectionError)
    ? selectionError || "Chargement de la zone…"
    : isPlayerMode && activeRuns.length > 0
      ? "Termine tes cultures en cours avant de lancer une nouvelle campagne."
      : isPlayerMode && !campaignParticipants.length
        ? "Place un Buddie dans une zone active de l’entrepôt."
      : isPlayerMode && new Set(campaignParticipants.map(member => member.buddieCode)).size !== campaignParticipants.length
        ? "Chaque zone de la campagne doit avoir son propre Buddie. Ajuste le plan."
    : remoteBurnsEnabled && (remoteCollection.loading || remoteCollection.error || !buddieRotation)
    ? remoteCollection.error || "Vérification des Buddies disponibles. Actualise la page si le chargement échoue."
    : remoteBurnsEnabled && selectedHeritage && !remoteHeritageVerified
      ? "Ton Héritage doit être vérifié. Actualise la collection ou choisis Sans Héritage."
    : selectedBuddieRemaining > 0
      ? getKqBuddieRotationMessage(selectedBuddieRemaining)
      : isPlayerMode && unavailableParticipant
        ? "Un Buddie placé est indisponible ou en rotation. Ajuste ton plan avant de commencer."
        : "";

  const refreshBuddieRotation = useCallback(async () => {
    const response = await remoteRequest("/api/admin/placard/session", { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json() as PlayerSessionPayload;
    if (payload.buddieRotation !== undefined) setBuddieRotation(payload.buddieRotation);
  }, [remoteRequest]);

  const refreshOfficialRanking = useCallback(async (includeProgress = true) => {
    if (!isPlayerMode) return;
    // The shared ranking may lag by a minute; transactions still return the
    // current personal balances and rewards. Reuse bootstrap progress on entry.
    const leaderboardResponse = await api.request("/api/arena/placard/rankings", { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (leaderboardResponse.ok) {
      const payload = await leaderboardResponse.json() as { entries?: OfficialLeaderboardEntry[] };
      setOfficialLeaderboard(payload.entries ?? []);
    }
    if (includeProgress) {
      const progressResponse = await api.request("/api/arena/placard/me", { cache: "no-store", signal: AbortSignal.timeout(20_000) });
      if (progressResponse.ok) {
        const payload = await progressResponse.json() as { progress?: OfficialRankProgress | null };
        setOfficialRankProgress(payload.progress ?? null);
      }
    }
  }, [api, isPlayerMode]);

  const resolveSelectedSession = useCallback(async (payload: PlayerSessionPayload, signal: AbortSignal): Promise<PlayerSessionPayload> => {
    if (!isPlayerMode) return payload;
    let resolved = payload;
    if (initialZoneId || initialRunId) {
      const params = new URLSearchParams();
      if (initialZoneId) params.set("zoneId", initialZoneId);
      if (initialRunId) params.set("runId", initialRunId);
      const response = await remoteRequest(`/api/admin/placard/runs?${params}`, { cache: "no-store", signal });
      const runs = await response.json() as PlayerSessionPayload & { error?: string };
      if (!response.ok) throw new Error(runs.error || "Cette culture est indisponible.");
      resolved = { ...payload, activeRun: runs.activeRun, activeRuns: runs.activeRuns };
    }
    const selected = selectKqClientRun(resolved, { zoneId: initialZoneId, runId: initialRunId, campaign: initialCampaign });
    let zone: KqWarehouseZone | null = null;
    let participants: ReturnType<typeof getKqCampaignParticipants> = [];
    if (selected) {
      const zoneId = getKqClientRunZoneId(selected);
      zone = selected.state.campaign?.members.find(member => member.zoneId === initialZoneId)?.warehouse.zones[0]
        ?? selected.state.warehouse?.zones.find(item => item.id === zoneId) ?? null;
    } else if (initialRunId) {
      throw new Error("Cette culture n’est plus disponible dans la zone choisie. Reviens à l’entrepôt.");
    } else {
      const response = await remoteRequest("/api/admin/placard/warehouse", { cache: "no-store", signal });
      const warehouse = await response.json() as { state?: unknown; revision?: number; error?: string };
      if (!response.ok || !isKqWarehouseState(warehouse.state)) throw new Error(warehouse.error || "La zone est indisponible.");
      zone = warehouse.state.zones.find(item => item.id === initialZoneId) ?? null;
      if (initialZoneId && !zone) throw new Error("Cette zone n’existe plus. Choisis une zone dans l’entrepôt.");
      participants = getKqCampaignParticipants(warehouse.state, warehouse.revision ?? 0);
    }
    if (signal.aborted || !lifecycle.current.mounted) throw new DOMException("Culture fermée", "AbortError");
    const recoveredZoneId = selected ? getKqClientRunZoneId(selected) : undefined;
    if (recoveredZoneId && selected?.state.phase !== "complete") clearKqZoneStartRequestKey((isolatedStorage?.session ?? window.sessionStorage), recoveredZoneId);
    if (selected?.state.campaign) clearKqZoneStartRequestKey((isolatedStorage?.session ?? window.sessionStorage), KQ_CAMPAIGN_START_SCOPE);
    setCampaignParticipants(participants);
    setZoneContext(zone);
    setSelectionError("");
    setSelectionReady(true);
    return { ...resolved, activeRun: selected };
  }, [initialCampaign, initialRunId, initialZoneId, isolatedStorage?.session, isPlayerMode, remoteRequest]);

  const applyOfficialSessionPayload = useCallback((payload: PlayerSessionPayload) => {
    if (!lifecycle.current.mounted) return;
    if (payload.buddieRotation !== undefined) setBuddieRotation(payload.buddieRotation);
    const activeRun = isPlayerMode ? selectKqClientRun(payload, { zoneId: initialZoneId, runId: initialRunId, campaign: initialCampaign }) : payload.activeRun ?? null;
    setActiveRuns(payload.activeRuns ?? (payload.activeRun ? [payload.activeRun] : []));
    const flowers = payload.flowers ?? [];
    setOfficialFlowers(flowers);
    setOfficialBattles(payload.battles ?? []);
    setRecentBattlesLoaded(false);
    setOfficialRankProgress(payload.progress ?? null);
    if (!activeRun) {
      setRemoteRunId(null);
      if (isPlayerMode) {
        setState(startKqGame(Date.now(), { domiciliation: "retired" }));
        setBattle(null);
        setSetupOpen(true);
      }
      (isolatedStorage?.session ?? window.sessionStorage).removeItem(`${sessionStoragePrefix}-remote-run-id`);
      setRemoteNotice("");
    } else {
      const receipts = activeRun.burnReceipts.map((receipt) => toLocalReceipt(receipt, activeRun.state.seed));
      setRemoteRunId(activeRun.runId);
      (isolatedStorage?.session ?? window.sessionStorage).setItem(`${sessionStoragePrefix}-remote-run-id`, activeRun.runId);
      setState(activeRun.state);
      setSelectedBuddie(activeRun.state.varietyCode);

      setSelectedCards(activeRun.state.deckCodes.filter((code) => !["substrate", "pbi"].includes(KQ_CARDS.find((card) => card.code === code)?.category ?? "")));
      setBurnHistory((history) => [...receipts, ...history.filter((entry) => !receipts.some((receipt) => receipt.id === entry.id))].slice(0, 100));
      setSetupOpen(false);
      setRemoteNotice(`Culture officielle reprise · ${receipts.length} reçu${receipts.length > 1 ? "s" : ""} vérifié${receipts.length > 1 ? "s" : ""}.`);
    }
    const matchingFlower = activeRun ? flowers.find((flower) => flower.runId === activeRun.runId)
      : flowers.find((flower) => flower.id === (isolatedStorage?.session ?? window.sessionStorage).getItem(`${sessionStoragePrefix}-remote-flower-id`));
    if (matchingFlower) {
      setPersistedFlowerId(matchingFlower.id);
      (isolatedStorage?.session ?? window.sessionStorage).setItem(`${sessionStoragePrefix}-remote-flower-id`, matchingFlower.id);
    } else if (activeRun) {
      setPersistedFlowerId(null);
      (isolatedStorage?.session ?? window.sessionStorage).removeItem(`${sessionStoragePrefix}-remote-flower-id`);
    }
    if ((payload.warnings?.length ?? 0) > 0) setRemoteNotice(payload.warnings!.join(" · "));
  }, [initialCampaign, initialRunId, initialZoneId, isolatedStorage?.session, isPlayerMode, sessionStoragePrefix]);

  useEffect(() => {
    if (tutorial) return;
    const refreshCollection = () => setCollectionRefreshNonce((value) => value + 1);
    return api.subscribe(["kq:collection-updated"], refreshCollection);
  }, [api, tutorial]);

  useEffect(() => {
    if (!isPlayerMode) return;
    let active = true;
    let controller: AbortController | undefined;
    const refreshRoutePlan = () => {
      controller?.abort();
      const requestController = new AbortController();
      controller = requestController;
      setPreparationStrength(undefined);
      void api.request("/api/arena/placard/equipment", { cache: "no-store", signal: requestController.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("Équipement indisponible.");
          return response.json() as Promise<{ routePlan?: KqRoutePlan | null; strength?: unknown }>;
        })
        .then((payload) => {
          if (!active || requestController.signal.aborted) return;
          setRoutePlan(payload.routePlan ?? null);
          setPreparationStrength(payload.strength === null ? null
            : CHANVRIER_STRENGTHS.some(item => item.code === payload.strength) ? payload.strength as ChanvrierStrength : undefined);
        })
        .catch(() => {
          if (active && !requestController.signal.aborted) setPreparationStrength(undefined);
        });
    };
    if (remoteBurnsEnabled && setupOpen) refreshRoutePlan();
    const unsubscribe = api.subscribe(["kq:equipment-updated"], refreshRoutePlan);
    return () => { active = false; controller?.abort(); unsubscribe(); };
  }, [api, isPlayerMode, remoteBurnsEnabled, setupOpen]);

  useEffect(() => {
    const repository = tutorial?.repository ?? createLocalKqRepository((isolatedStorage?.persistent ?? window.localStorage));
    repositoryRef.current = repository;
    if (!tutorial) {
      if (!isPlayerMode) setRemoteRunId((isolatedStorage?.session ?? window.sessionStorage).getItem(`${sessionStoragePrefix}-remote-run-id`));
      setPersistedFlowerId((isolatedStorage?.session ?? window.sessionStorage).getItem(`${sessionStoragePrefix}-remote-flower-id`));
      setRemoteBurnsEnabled(isPlayerMode || (isolatedStorage?.session ?? window.sessionStorage).getItem(`${sessionStoragePrefix}-remote-burns`) === "1");
    }
    setDirectDiceResult((tutorial?.storage ?? (isolatedStorage?.persistent ?? window.localStorage)).getItem("kq-dice-direct-result") === "1");
    let cancelled = false;
    void repository.loadSession().then((snapshot) => {
      if (cancelled) return;
      if (!isPlayerMode && snapshot.game) {
        setState(snapshot.game);
        setSelectedBuddie(snapshot.game.varietyCode);

        if (!initialPreparationRef.current || !tutorial?.setupOpen) setSelectedCards(snapshot.game.deckCodes.filter((code) => !["substrate", "pbi"].includes(KQ_CARDS.find((card) => card.code === code)?.category ?? "")));
        setSetupOpen(tutorial ? tutorial.storage.getItem("setup-open") !== "0" && tutorial.setupOpen : false);
      }
      if (!isPlayerMode) {
        if (snapshot.battle) setBattle(snapshot.battle);
        setBattleHistory(snapshot.battleHistory);
        setBurnHistory(snapshot.burnHistory);
        if (snapshot.ranking) setRankProfile(snapshot.ranking);
        if (snapshot.inventory) setInventory({ ...DEFAULT_LOCAL_INVENTORY, ...snapshot.inventory });
      }
      if (tutorial) {
        try {
          const preparation = JSON.parse(tutorial.storage.getItem("preparation") ?? "null") as { buddie?: unknown; cards?: unknown; heritage?: unknown; energy?: unknown } | null;
          if (KQ_BUDDIES.some(item => item.code === preparation?.buddie)) setSelectedBuddie(preparation!.buddie as string);
          if (!initialPreparationRef.current) {
            if (Array.isArray(preparation?.cards) && preparation.cards.every(code => typeof code === "string")) setSelectedCards(sanitizeKqDeckSelection(preparation.cards as string[], snapshot.inventory ?? DEFAULT_LOCAL_INVENTORY));
            if (preparation?.heritage === "" || KQ_HERITAGE_CARDS.some(item => item.code === preparation?.heritage)) setSelectedHeritage(preparation!.heritage as string);
          }
          if (preparation?.energy === "eco" || preparation?.energy === "balanced" || preparation?.energy === "intensive") setEnergyMode(preparation.energy);
        } catch { /* Invalid local preferences do not invalidate the culture. */ }
      }
      setFavoriteDeck(snapshot.favoriteDeck);
      setShowOnboarding(!snapshot.onboardingSeen && !isPlayerMode && !tutorial);
      setHydrated(true);
    });
    return () => { cancelled = true; };
  }, [isPlayerMode, isolatedStorage?.persistent, isolatedStorage?.session, sessionStoragePrefix, tutorial]);

  useEffect(() => {
    if (!isPlayerMode) return;
    const refreshAfterMarketSale = () => void refreshOfficialRanking();
    return api.subscribe(["kq:market-updated"], refreshAfterMarketSale);
  }, [api, isPlayerMode, refreshOfficialRanking]);

  useEffect(() => {
    if (!isPlayerMode && !showAdminOperations) {
      setRemoteCollection((current) => ({ ...current, loading: false, error: "" }));
      return;
    }
    const controller = new AbortController();
    remoteInventoryVerifiedRef.current = false;
    setRemoteHeritageVerified(false);
    setRemoteCollection(current => ({ ...current, loading: true, error: "" }));
    const bootstrapUrl = isPlayerMode
      ? "/api/arena/placard/bootstrap"
      : "/api/admin/placard/bootstrap";
    void api.request(bootstrapUrl, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as {
          error?: string;
          warnings?: string[];
          readiness?: typeof launchReadiness;
          seasonRewards?: typeof seasonRewardPreview;
          seasonRollover?: typeof seasonRolloverPreview;
          notebookRewards?: typeof notebookRewardPreview;
          heritage?: null | {
            collectionActive?: boolean;
            purchaseDrawsLive?: boolean;
            cards?: Array<{
              code?: string;
              name?: string;
              timing?: KqHeritageCard["timing"];
              effectCode?: KqHeritageCard["effect"];
              description?: string;
              imageUrl?: string;
              ownedCopies?: number;
              isActive?: boolean;
              producerId?: string | null;
              producerName?: string;
              producerNames?: string[];
            }>;
            eligiblePurchaseUnits?: number;
            attributedPurchaseUnits?: number;
            pendingPurchaseUnits?: number;
            fragmentBalance?: number;
          };
          collection?: null | {
            ownerFound?: boolean;
            collectionActive?: boolean;
            inventory?: Record<string, number>;
            availableInventory?: Record<string, number>;
            cards?: unknown[];
            cultureTokenBalance?: number;
          };
          buddieRotation?: KqBuddieRotation | null;
          ownedBuddieCodes?: string[];
          ownedBuddies?: Array<{ code: string; imageUrl?: string; ownedCopies?: number }>;
          routePlan?: KqRoutePlan | null;
          playerSession?: PlayerSessionPayload | null;
        };
        if (controller.signal.aborted) return;
        if (!response.ok) throw new Error(payload.error || "Initialisation de Kanab Quest indisponible.");
        setBuddieRotation(payload.buddieRotation ?? payload.playerSession?.buddieRotation ?? null);
        if ((payload.warnings?.length ?? 0) > 0) setRemoteNotice(payload.warnings!.join(" · "));
        setLaunchReadiness(showAdminOperations ? payload.readiness ?? null : null);
        setSeasonRewardPreview(showAdminOperations ? payload.seasonRewards ?? null : null);
        setSeasonRolloverPreview(showAdminOperations ? payload.seasonRollover ?? null : null);
        setNotebookRewardPreview(showAdminOperations ? payload.notebookRewards ?? null : null);
        const heritage = payload.heritage ?? {};
        const verifiedHeritages = getKqVerifiedPreparationHeritages(heritage.cards);
        setRemoteHeritageVerified(verifiedHeritages !== null);
        const heritageCards = (Array.isArray(heritage.cards) ? heritage.cards : []).flatMap((card) => {
          if (!card || typeof card !== "object") return [];
          const code = String(card.code ?? "");
          const name = String(card.name ?? "");
          const description = String(card.description ?? "");
          if (!code || !name || !description || !card.timing || !card.effectCode) return [];
          return [{
            code,
            name,
            timing: card.timing,
            effect: card.effectCode,
            description,
            imageUrl: String(card.imageUrl ?? ""),
            ...(card.producerId ? { producerId: String(card.producerId) } : {}),
            producerName: String(card.producerName ?? ""),
            producerNames: (card.producerNames ?? []).map(String).filter(Boolean),
            isActive: card.isActive === true,
            ownedCopies: Number(card.ownedCopies ?? 0),
          } satisfies RemoteHeritageCard];
        });
        setRemoteHeritageCards(heritageCards);
        setRemoteHeritageOwnedCodes(verifiedHeritages ?? []);
        setRemoteHeritageProducerNames(Object.fromEntries(heritageCards.flatMap((card) => {
          return card.code ? [[card.code, card.producerNames]] : [];
        })));
        const collection = payload.collection ?? {};
        if (isPlayerMode) {
          setRoutePlan(payload.routePlan ?? null);
          const ownedCodes = (payload.ownedBuddieCodes ?? []).filter((code) =>
            KQ_BUDDIES.some((buddie) => buddie.code === code));
          setOwnedBuddieCodes(ownedCodes);
          setOwnedBuddieArtwork(Object.fromEntries((payload.ownedBuddies ?? []).map((buddie) => [
            buddie.code,
            { imageUrl: buddie.imageUrl ?? "", ownedCopies: Number(buddie.ownedCopies ?? 0) },
          ])));
          setSelectedBuddie((current) => ownedCodes.includes(current) ? current : ownedCodes[0] ?? current);
        }
        const inventory = collection.inventory;
        const availableInventory = collection.availableInventory ?? inventory;
        if (isVerifiedInventory(inventory) && isVerifiedInventory(availableInventory)) {
          remoteInventoryVerifiedRef.current = true;
          remoteInventoryRef.current = inventory;
          setRemoteInventory(inventory);
          remoteAvailableInventoryRef.current = availableInventory;
          setRemoteAvailableInventory(availableInventory);
          setRemoteCollection({
            loading: false,
            error: "",
            ownerFound: collection.ownerFound === true,
            collectionActive: collection.collectionActive === true,
            totalCopies: Object.values(inventory).reduce((sum, count) => sum + count, 0),
            cardCount: collection.cards?.length ?? 0,
            cultureTokenBalance: Math.max(0, Number(collection.cultureTokenBalance ?? 0)),
          });
        } else {
          setRemoteCollection(current => ({ ...current, loading: false, error: "Inventaire distant indisponible." }));
        }
        const sessionReusable = Boolean(payload.playerSession && (payload.playerSession.warnings?.length ?? 0) === 0);
        if (isPlayerMode && payload.playerSession && sessionReusable) {
          skipNextSessionFetchRef.current = true;
          const selectedSession = await resolveSelectedSession(payload.playerSession, controller.signal);
          if (controller.signal.aborted) return;
          applyOfficialSessionPayload(selectedSession);
          const warnings = [...(payload.warnings ?? []), ...(payload.playerSession.warnings ?? [])];
          if (warnings.length > 0) setRemoteNotice(warnings.join(" · "));
        }
        if (isPlayerMode && !controller.signal.aborted) {
          const progressReusable = sessionReusable && canReuseKqBootstrapProgress(payload.playerSession?.progress);
          await refreshOfficialRanking(!progressReusable);
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        const message = error instanceof Error ? error.message : "Initialisation de Kanab Quest indisponible.";
        if (isPlayerMode) { setSelectionError(message); setSelectionReady(true); }
        setRemoteNotice(message);
        setRemoteCollection((current) => ({ ...current, loading: false, error: message }));
      });
    return () => controller.abort();
  }, [api, applyOfficialSessionPayload, collectionRefreshNonce, isPlayerMode, refreshOfficialRanking, resolveSelectedSession, showAdminOperations]);

  useEffect(() => {
    if (remoteBurnsEnabled && remoteCollection.loading) return;
    if (!remoteBurnsEnabled || !remoteCollection.ownerFound) {
      setOfficialFlowers([]);
      setOfficialBattles([]);
      return;
    }
    if (isPlayerMode && skipNextSessionFetchRef.current) {
      skipNextSessionFetchRef.current = false;
      return;
    }
    const controller = new AbortController();
    setRemoteAction("game");
    const sessionUrl = isPlayerMode
      ? "/api/arena/placard/session"
      : "/api/admin/placard/session";
    void api.request(sessionUrl, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as {
          error?: string;
          warnings?: string[];
          buddieRotation?: KqBuddieRotation | null;
          activeRun?: Awaited<ReturnType<typeof getKqRemoteActiveRun>>["activeRun"];
          activeRuns?: NonNullable<PlayerSessionPayload["activeRun"]>[];
          flowers?: KqOfficialFlower[];
          battles?: KqOfficialBattle[];
          progress?: OfficialRankProgress | null;
        };
        if (!response.ok) throw new Error(payload.error || "Session Kanab Quest indisponible.");
        const selectedSession = await resolveSelectedSession(payload, controller.signal);
        if (controller.signal.aborted) return;
        applyOfficialSessionPayload(selectedSession);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        const message = error instanceof Error ? error.message : "Session Kanab Quest indisponible.";
        if (isPlayerMode) { setSelectionError(message); setSelectionReady(true); }
        setRemoteNotice(message);
      })
      .finally(() => setRemoteAction(null));
    return () => controller.abort();
  }, [api, applyOfficialSessionPayload, isPlayerMode, remoteBurnsEnabled, remoteCollection.loading, remoteCollection.ownerFound, resolveSelectedSession]);

  useEffect(() => {
    if (!remoteBurnsEnabled || !queuedFlowerIdsKey) return;
    let active = true;
    const queuedIds = new Set(queuedFlowerIdsKey.split(","));
    const refreshQueue = async () => {
      try {
        const queuedFlowerId = queuedFlowerIdsKey.split(",")[0];
        const matchAttempt = await pollKqRemoteRandomBattleQueue(queuedFlowerId, remoteRequest);
        // Waiting has not changed the collection: only reload after leaving the queue.
        if (!active || matchAttempt.matchStatus === "queued") return;
        const [flowersSnapshot, battlesSnapshot] = await Promise.all([
          getKqRemoteFlowers(remoteRequest),
          getKqRemoteBattles(remoteRequest),
        ]);
        if (!active) return;
        const resolvedBattle = battlesSnapshot.battles.find((candidate) => (
          queuedIds.has(candidate.playerFlower.id) && candidate.status === "verdict"
        ));
        setOfficialFlowers(flowersSnapshot.flowers);
        setOfficialBattles(battlesSnapshot.battles);
        setRecentBattlesLoaded(true);
        if (resolvedBattle) {
          setRemoteNotice(`${resolvedBattle.winner === "player" ? "Victoire" : "Défaite"} · la file aléatoire a trouvé un adversaire et les deux Fleurs ont été brûlées.`);
          await refreshOfficialRanking();
        } else if (matchAttempt?.matchStatus === "matched") {
          setRemoteNotice("Adversaire aléatoire trouvé. Le duel est verrouillé et le jury termine son verdict.");
        }
      } catch {
        // La file reste durable côté serveur ; une prochaine vérification reprendra.
      }
    };
    const stopPolling = startArenaVisiblePolling(refreshQueue);
    return () => {
      active = false;
      stopPolling();
    };
  }, [queuedFlowerIdsKey, refreshOfficialRanking, remoteBurnsEnabled, remoteRequest]);

  useEffect(() => {
    if (hydrated && !isPlayerMode) void repositoryRef.current?.saveGame(state);
  }, [hydrated, isPlayerMode, state]);

  useEffect(() => {
    if (!hydrated || isPlayerMode) return;
    void repositoryRef.current?.saveBattle(battle);
  }, [battle, hydrated, isPlayerMode]);

  useEffect(() => {
    if (hydrated && !isPlayerMode) void repositoryRef.current?.saveRanking(rankProfile);
  }, [hydrated, isPlayerMode, rankProfile]);

  useEffect(() => {
    if (hydrated && !isPlayerMode) void repositoryRef.current?.saveInventory(inventory);
  }, [hydrated, inventory, isPlayerMode]);

  useEffect(() => {
    if (!hydrated || !tutorial) return;
    tutorial.storage.setItem("setup-open", setupOpen ? "1" : "0");
    tutorial.onProgress({ game: state, battle, setupOpen, revealedRounds });
  }, [battle, hydrated, revealedRounds, setupOpen, state, tutorial]);

  useEffect(() => {
    if (!hydrated || !tutorial) return;
    tutorial.storage.setItem("preparation", JSON.stringify({ buddie: selectedBuddie, cards: selectedCards, heritage: selectedHeritage, energy: energyMode }));
  }, [energyMode, hydrated, selectedBuddie, selectedCards, selectedHeritage, tutorial]);

  useEffect(() => {
    if (!hydrated || !setupOpen || viewMode === "arena"
      || isPlayerMode && (!selectionReady || selectionError || remoteRunId || activeRuns.length > 0)) return;
    if (remoteBurnsEnabled && (remoteCollection.loading || remoteCollection.error || !remoteInventoryVerifiedRef.current)) return;
    const current = { deckCodes: selectedCards, heritageCode: selectedHeritage || null };
    const reconciled = reconcileKqPreparationSelection(current,
      remoteBurnsEnabled ? remoteAvailableInventory : inventory,
      remoteBurnsEnabled && remoteHeritageVerified ? remoteHeritageOwnedCodes : null);
    if (reconciled.removedCopies || reconciled.removedHeritage) {
      if (reconciled.removedCopies) setSelectedCards(reconciled.selection.deckCodes);
      if (reconciled.removedHeritage) setSelectedHeritage("");
      setPreparationNotice([
        reconciled.removedCopies ? `${reconciled.removedCopies} copie${reconciled.removedCopies > 1 ? "s" : ""} de soutien indisponible${reconciled.removedCopies > 1 ? "s" : ""} retirée${reconciled.removedCopies > 1 ? "s" : ""}.` : "",
        reconciled.removedHeritage ? "L’Héritage indisponible a été retiré de la préparation." : "",
      ].filter(Boolean).join(" "));
      return;
    }
    const signature = JSON.stringify(current);
    if (publishedPreparation.current === signature) return;
    publishedPreparation.current = signature;
    preparationCallbacks.current.change?.({ deckCodes: [...selectedCards], heritageCode: current.heritageCode });
  }, [activeRuns.length, hydrated, inventory, isPlayerMode, remoteAvailableInventory, remoteBurnsEnabled, remoteCollection.error, remoteCollection.loading, remoteHeritageOwnedCodes, remoteHeritageVerified, remoteRunId, selectedCards, selectedHeritage, selectionError, selectionReady, setupOpen, viewMode]);

  useEffect(() => {
    if (isPlayerMode && hydrated && selectionReady && !selectionError && !setupOpen && remoteRunId
      && state.phase !== "complete" && viewMode !== "arena") consumePreparation(remoteRunId);
  }, [consumePreparation, hydrated, isPlayerMode, remoteRunId, selectionError, selectionReady, setupOpen, state.phase, viewMode]);

  useEffect(() => () => {
    if (rollTimerRef.current) window.clearTimeout(rollTimerRef.current);
    if (verdictTimerRef.current) window.clearTimeout(verdictTimerRef.current);
  }, []);

  useEffect(() => {
    const refreshDailyChallenges = () => setDailyChallenges((current) => {
      const next = getKqDailyChallenges();
      return current[0]?.dayKey === next[0]?.dayKey ? current : next;
    });
    refreshDailyChallenges();
    const timer = window.setInterval(refreshDailyChallenges, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (battle?.status !== "verdict" || revealedRounds >= battle.rounds.length) return;
    verdictTimerRef.current = window.setTimeout(() => setRevealedRounds((count) => count + 1), revealedRounds === 0 ? 250 : 650);
    return () => {
      if (verdictTimerRef.current) window.clearTimeout(verdictTimerRef.current);
      verdictTimerRef.current = null;
    };
  }, [battle, revealedRounds]);

  const situation = state.phase === "complete" ? null : getKqSituation(state);
  const situationArtwork = getKqSituationArtwork(situation?.code ?? "", Boolean(state.powerOutage))
    ?? STAGE_ILLUSTRATIONS[KQ_STAGES[state.stageIndex]];
  const activeInventory = remoteBurnsEnabled ? setupOpen ? remoteAvailableInventory : remoteInventory : inventory;
  const preview = previewKqResolution(state);
  const turnPreview = useMemo(() => getKqTurnPreview(state), [state]);
  const claimedChallengeCodes = isPlayerMode
    ? officialRankProgress?.claimedChallengeCodes ?? []
    : rankProfile.claimedChallengeCodes;
  const rewardableDailyChallenges = dailyChallenges.filter((challenge) => !claimedChallengeCodes.includes(challenge.claimKey));
  const remainingDailyChallengePoints = getKqRemainingDailyChallengePoints(dailyChallenges, claimedChallengeCodes);
  const cardChoices = useMemo(() => getKqPlayerCardChoices(state, activeInventory), [state, activeInventory]);
  const availableCards = [...cardChoices.choices].sort((left, right) => Number(right.allowed) - Number(left.allowed)
    || Number(Boolean(situation && doesKqCardMatchSituation(right.card, situation))) - Number(Boolean(situation && doesKqCardMatchSituation(left.card, situation))))
    .map(choice => choice.card);
  const handFilterScope = `${remoteRunId ?? state.seed}:${state.stageIndex}:${state.phase}`;
  const handFilter = cardChoices.playableCount === 0 ? "all"
    : handFilterChoice?.scope === handFilterScope ? handFilterChoice.value : "playable";
  const displayedCards = handFilter === "all" ? availableCards
    : availableCards.filter(card => getKqPlayerCardPermission(state, card, activeInventory[card.code] ?? 0).allowed);
  const handCodes = useMemo(() => getKqHandCodes(state), [state]);
  const supportDeckSize = state.deckCodes.filter((code) => !["substrate", "pbi"].includes(KQ_CARDS.find((card) => card.code === code)?.category ?? "")).length;
  const burnedSupportCount = state.usedCards.filter((code) => !["substrate", "pbi"].includes(KQ_CARDS.find((card) => card.code === code)?.category ?? "")).length;
  const redrawPermission = canRedrawKqHand(state);

  useEffect(() => {
    if (state.phase !== "rolled" || !physicsDiceActive || !state.dice) return;
    const values = state.bonusDie ? [...state.dice, state.bonusDie] : [...state.dice];
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      setDiceVisualSyncing(true);
      void physicsDiceRef.current?.sync(values).finally(() => {
        if (!cancelled) setDiceVisualSyncing(false);
      });
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [physicsDiceActive, state.bonusDie, state.dice, state.phase]);

  useEffect(() => {
    if (state.phase !== "resolved" || !physicsDiceActive || !state.dice) return;
    const values = state.bonusDie ? [...state.dice, state.bonusDie] : [...state.dice];
    const frame = window.requestAnimationFrame(() => physicsDiceRef.current?.reveal(values));
    return () => window.cancelAnimationFrame(frame);
  }, [physicsDiceActive, state.bonusDie, state.dice, state.phase]);

  const presentConfirmedAction = (action: string, next: KqGameState) => {
    if (!lifecycle.current.mounted || currentPresentationView.current === "arena" || document.visibilityState !== "visible") return;
    const identity = next.campaign?.id ?? `${next.startedAt}:${next.seed}`;
    if (action === "roll") sound.playOnce("dice", `roll:${identity}:${next.stageIndex}`);
    if (state.phase !== "complete" && next.phase === "complete" && !isKqCultureDead(next)) {
      setFreshHarvestKey(identity);
      sound.playOnce("harvest", `harvest:${identity}`);
    }
  };

  const applyGameAction = async (action: "roll" | "resolve" | "advance" | "redraw" | "heritage", deferState = false): Promise<KqGameState | null> => {
    if (careBusy) return null;
    setGameActionError("");
    if (!remoteBurnsEnabled) {
      const next = action === "roll" ? rollKqDice(state) : action === "resolve" ? resolveKqStage(state) : action === "advance" ? advanceKqStage(state) : action === "redraw" ? redrawKqHand(state) : activateKqHeritage(state);
      const nextState = tutorial ? assistKqPlayableLesson(next) : next;
      if (!deferState) setState(nextState);
      presentConfirmedAction(action, nextState);
      return nextState;
    }
    if ((remoteAction !== null || careBusy)) return null;
    if (!remoteRunId) {
      setGameActionError("La culture n’est plus synchronisée. Actualise-la avant de continuer.");
      return null;
    }
    setRemoteAction("game");
    try {
      const result = await applyKqRemoteAction(remoteRunId, action, remoteRequest);
      if (!lifecycle.current.mounted) return null;
      if (!deferState) setState(result.state);
      presentConfirmedAction(action, result.state);
      if (result.state.phase === "complete") {
        setRemoteRunId(null);
        (isolatedStorage?.session ?? window.sessionStorage).removeItem(`${sessionStoragePrefix}-remote-run-id`);
      }
      if (isKqCultureDead(result.state)) {
        setPersistedFlowerId(null);
        (isolatedStorage?.session ?? window.sessionStorage).removeItem(`${sessionStoragePrefix}-remote-flower-id`);
      }
      const firstFlower = result.persistedFlower ?? result.persistedFlowers?.[0];
      if (firstFlower?.id) {
        setPersistedFlowerId(firstFlower.id);
        (isolatedStorage?.session ?? window.sessionStorage).setItem(`${sessionStoragePrefix}-remote-flower-id`, firstFlower.id);
        const refreshed = await getKqRemoteFlowers(remoteRequest);
        setOfficialFlowers(refreshed.flowers);
      }
      setRemoteNotice(action === "roll" ? "Lancer confirmé par le serveur." : "");
      return result.state;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Synchronisation impossible.";
      setRemoteNotice(message);
      setGameActionError(message);
      return null;
    } finally {
      setRemoteAction(null);
    }
  };

  const swapHeritageCard = async (reserveIndex: number) => {
    if (heritageSwapOutIndex === null || (remoteAction !== null || careBusy)) return;
    if (!remoteBurnsEnabled) {
      const swapped = swapKqHeritageHandCard(state, heritageSwapOutIndex, reserveIndex);
      const nextState = tutorial ? assistKqPlayableLesson(swapped) : swapped;
      setState(nextState);
      setHeritageSwapOutIndex(null);
      setHeritageExchangeTab("hand");
      await repositoryRef.current?.saveGame(nextState);
      return;
    }
    if (!remoteRunId) return;
    setRemoteAction("game");
    try {
      const result = await swapKqRemoteHeritageCard(remoteRunId, heritageSwapOutIndex, reserveIndex, remoteRequest);
      if (!lifecycle.current.mounted) return;
      setState(result.state);
      setHeritageSwapOutIndex(null);
      setHeritageExchangeTab("hand");
      setRemoteNotice("Échange Main prévoyante confirmé par le serveur.");
    } catch (error) {
      setRemoteNotice(error instanceof Error ? error.message : "Échange impossible.");
    } finally {
      setRemoteAction(null);
    }
  };

  const roll = async () => {
    if (rollInFlightRef.current || rolling || (remoteAction !== null || careBusy) || state.phase !== "prepare") return;
    rollInFlightRef.current = true;
    setRolling(true);
    try {
      if (directDiceResult || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setPhysicsDiceActive(false);
        setDiceMotionPhase("idle");
        await applyGameAction("roll");
        return;
      }

      const startedAt = window.performance.now();
      setDiceMotionPhase("preparing");
      const rolledState = await applyGameAction("roll", true);
      if (!rolledState?.dice) return;

      const values = rolledState.bonusDie ? [...rolledState.dice, rolledState.bonusDie] : [...rolledState.dice];
      const physicsDice = physicsDiceRef.current;
      if (physicsDice) {
        setPhysicsDiceActive(true);
        let acceptingAnimationUpdates = true;
        const completed = await playKqDiceAnimation(async () => {
          await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
          if (!acceptingAnimationUpdates) return false;
          return physicsDice.roll(values, (phase) => {
            if (acceptingAnimationUpdates) setDiceMotionPhase(phase);
          });
        });
        acceptingAnimationUpdates = false;
        if (completed) {
          setState(rolledState);
          return;
        }
        setPhysicsDiceActive(false);
        // Unmount a stalled renderer, retaining the server's existing result.
        setDirectDiceResult(true);
      }

      setDiceMotionPhase("rolling");
      const elapsed = window.performance.now() - startedAt;
      await new Promise<void>((resolve) => {
        rollTimerRef.current = window.setTimeout(() => {
          rollTimerRef.current = null;
          resolve();
        }, Math.max(0, DICE_ROLL_DURATION_MS - elapsed));
      });
      setState(rolledState);
    } catch (error) {
      setGameActionError(error instanceof Error ? error.message : "Le lancer est indisponible. Actualise la culture.");
    } finally {
      rollInFlightRef.current = false;
      setRolling(false);
      setDiceMotionPhase("idle");
    }
  };

  const toggleDirectDiceResult = () => {
    setDirectDiceResult((current) => {
      const next = !current;
      (tutorial?.storage ?? (isolatedStorage?.persistent ?? window.localStorage)).setItem("kq-dice-direct-result", next ? "1" : "0");
      return next;
    });
  };

  const reset = () => {
    if (careBusy) return;
    if (isPlayerMode && remoteRunId && state.phase !== "complete") {
      setRemoteNotice("Ta culture officielle est toujours active. Termine-la avant d’en préparer une nouvelle.");
      return;
    }
    if (isPlayerMode && initialRunId && initialZoneId && onOpenRun) {
      onOpenRun({ zoneId: initialZoneId });
      return;
    }
    setBattle(null);
    setRolling(false);
    setSelectedCards((current) => sanitizeKqDeckSelection(current, activeInventory));
    setSetupOpen(true);
    setPersistedFlowerId(null);
    if (!tutorial) (isolatedStorage?.session ?? window.sessionStorage).removeItem(`${sessionStoragePrefix}-remote-flower-id`);
  };

  const setRemoteMode = (enabled: boolean) => {
    if (isPlayerMode || tutorial) return;
    setRemoteBurnsEnabled(enabled);
    if (enabled && selectedHeritage && !remoteHeritageOwnedCodes.includes(selectedHeritage)) setSelectedHeritage("");
    setRemoteNotice(enabled
      ? "Mode officiel activé : chaque confirmation brûlera une vraie copie."
      : "Mode simulation locale : aucune copie enregistrée ne sera touchée.");
    (isolatedStorage?.session ?? window.sessionStorage).setItem(`${sessionStoragePrefix}-remote-burns`, enabled ? "1" : "0");
  };

  const juryRequest: typeof fetch = (input, init) => {
    const timeout = AbortSignal.timeout(20_000);
    return remoteRequest(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout });
  };

  const loadRecentBattles = async () => {
    if (recentBattlesLoading || matchmakingLoading) return;
    setRecentBattlesLoading(true);
    setRecentBattlesError("");
    try {
      const result = await getKqRemoteBattles(juryRequest);
      if (!lifecycle.current.mounted) return;
      setOfficialBattles(result.battles);
      setRecentBattlesLoaded(true);
    } catch {
      if (lifecycle.current.mounted) setRecentBattlesError("L’historique n’a pas pu être chargé. Réessaie.");
    } finally {
      if (lifecycle.current.mounted) setRecentBattlesLoading(false);
    }
  };

  const reconcileJury = async () => {
    if (!lifecycle.current.mounted) return false;
    setJuryChecking(true);
    try {
      const [flowersSnapshot, battlesSnapshot] = await Promise.all([
        getKqRemoteFlowers(juryRequest), getKqRemoteBattles(juryRequest),
      ]);
      if (!lifecycle.current.mounted) return false;
      setOfficialFlowers(flowersSnapshot.flowers);
      setOfficialBattles(battlesSnapshot.battles);
      setRecentBattlesLoaded(true);
      const pending = juryPending.current;
      const resolved = battlesSnapshot.battles.find(item => item.id === pending?.battleId || (pending?.flowerId && item.playerFlower.id === pending.flowerId));
      const flower = flowersSnapshot.flowers.find(item => item.id === pending?.flowerId);
      if (resolved?.status === "verdict") {
        setRemoteNotice(`Le verdict est bien enregistré : ${resolved.winner === "player" ? "victoire" : "défaite"}. Retrouve les manches dans l’historique des duels.`);
        setPendingTrainingFlowerId(null); setPendingRandomQueueFlowerId(null); setPendingOfficialVerdictId(null);
        api.notify("kq:boosters-updated");
        setCollectionRefreshNonce(value => value + 1);
      } else if (resolved?.status === "locked" || flower?.status === "queued" || flower?.status === "locked") {
        setRemoteNotice(flower?.status === "queued" ? "Ta Fleur attend dans la file. Son état a été vérifié." : "Ton duel est enregistré. Le jury n’a pas encore terminé ; retrouve-le dans l’historique.");
        setPendingTrainingFlowerId(null); setPendingRandomQueueFlowerId(null);
      } else if (pending?.flowerId && (!flower || flower.status === "burned")) {
        setRemoteNotice("Ta Fleur a déjà été utilisée. Les récoltes et l’historique sont à jour.");
        setPendingTrainingFlowerId(null); setPendingRandomQueueFlowerId(null);
      } else {
        setRemoteNotice("État du jury vérifié. Aucun nouveau verdict n’est enregistré pour cette demande. Tu peux réessayer si ta Fleur est disponible.");
      }
      juryUncertain.current = false;
      juryPending.current = null;
      setJuryCheckNeeded(false);
      return true;
    } catch {
      if (lifecycle.current.mounted) setJuryCheckNeeded(true);
      return false;
    } finally {
      if (lifecycle.current.mounted) setJuryChecking(false);
    }
  };

  const juryRecovery = <aside className={styles.juryRecovery} role="status" data-jury-recovery>
    <p>La réponse du jury n’a pas pu être confirmée. L’action a peut-être déjà été enregistrée. Vérifie son résultat avant de recommencer.</p>
    <button type="button" disabled={juryChecking} onClick={() => void reconcileJury()}>{juryChecking ? "Vérification…" : "Vérifier le résultat"}</button>
  </aside>;

  const prepareAfterVerdict = () => {
    setOfficialBattleResult(null);
    setBotBattleResult(null);
    // Arena/game share this component instance. Update its screen before the
    // parent changes views, preserving a different culture still in progress.
    if (remoteRunId && state.phase !== "complete") setSetupOpen(false);
    else reset();
    onOpenGame?.();
  };

  const joinRandomBattleQueue = async (flowerId: string) => {
    if (juryMutationLock.current || juryUncertain.current) return;
    juryMutationLock.current = true;
    juryPresentation.current = true;
    juryPending.current = { flowerId };
    setMatchmakingLoading(true);
    setRemoteNotice("");
    try {
      const result = await enqueueKqRemoteRandomBattle(flowerId, juryRequest);
      setPendingRandomQueueFlowerId(null);
      if (result.matchStatus === "queued") {
        setOfficialFlowers((flowers) => flowers.map((flower) => (
          flower.id === flowerId ? { ...flower, status: "queued", queuedAt: result.queuedAt } : flower
        )));
        setRemoteNotice(result.replayed
          ? "Cette Fleur attend déjà dans la file aléatoire. Tu peux encore la retirer."
          : "Fleur déposée dans la file aléatoire. Elle sera engagée et jugée automatiquement dès qu’une Fleur d’un autre joueur arrivera.");
        return;
      }

      const [flowersSnapshot, battlesSnapshot] = await Promise.all([
        getKqRemoteFlowers(juryRequest),
        getKqRemoteBattles(juryRequest),
      ]);
      setOfficialFlowers(flowersSnapshot.flowers);
      setOfficialBattles(battlesSnapshot.battles);
      setRecentBattlesLoaded(true);
      if (result.verdict) {
        const verdict = result.verdict;
        const matchedBattle = battlesSnapshot.battles.find((battle) => battle.id === verdict.battleId);
        if (lifecycle.current.mounted && currentPresentationView.current !== "game" && juryPresentation.current && verdict.replayed === false) {
          sound.playOnce(verdict.winner === "player" ? "victory" : "defeat", `battle:${verdict.battleId}`);
        }
        if (juryPresentation.current) setOfficialBattleResult({
          battleId: verdict.battleId,
          playerFlowerId: matchedBattle?.playerFlower.id,
          winner: verdict.winner,
          burnedAt: verdict.burnedAt,
          experienceAwarded: verdict.experienceAwarded,
          rounds: verdict.rounds,
          playerVariety: matchedBattle?.playerFlower.variety ?? "Ta Fleur",
          opponentVariety: matchedBattle?.opponentFlower.variety ?? "Fleur adverse aléatoire",
          challengePoints: verdict.challengePoints,
          completedChallengeTitles: verdict.completedChallenges.map((challenge) => challenge.title),
          pvpBoosterGranted: verdict.pvpBoosterGranted,
          pvpBoosterCardCount: verdict.pvpBoosterCardCount,
          rankProfile: verdict.rankProfile,
        });
        setOfficialChallengeReward({
          points: verdict.challengePoints,
          titles: verdict.completedChallenges.map((challenge) => challenge.title),
        });
        if (verdict.pvpBoosterGranted) api.notify("kq:boosters-updated");
        setRemoteNotice(`${verdict.winner === "player" ? "Victoire" : "Défaite"} · adversaire tiré au hasard · les deux Fleurs ont été jugées puis brûlées.`);
        void refreshOfficialRanking().catch(() => undefined);
      } else {
        setRemoteNotice("Adversaire aléatoire trouvé. Le duel est verrouillé ; le jury peut être relancé depuis l’historique.");
      }
    } catch (error) {
      setRemoteNotice(error instanceof Error ? error.message : "File de duel indisponible.");
      juryUncertain.current = true; setJuryCheckNeeded(true);
      await reconcileJury();
    } finally {
      juryMutationLock.current = false;
      if (!juryUncertain.current) juryPending.current = null;
      setMatchmakingLoading(false);
    }
  };

  const leaveRandomBattleQueue = async (flowerId: string) => {
    if (juryMutationLock.current || juryUncertain.current) return;
    juryMutationLock.current = true;
    juryPresentation.current = true;
    juryPending.current = { flowerId };
    setMatchmakingLoading(true);
    setRemoteNotice("");
    try {
      const result = await leaveKqRemoteRandomBattleQueue(flowerId, juryRequest);
      setOfficialFlowers((flowers) => flowers.map((flower) => (
        flower.id === flowerId ? { ...flower, status: "available", queuedAt: null } : flower
      )));
      setRemoteNotice(result.left
        ? "Fleur retirée de la file : elle est de nouveau disponible."
        : "Cette Fleur n’était plus dans la file.");
    } catch (error) {
      setRemoteNotice(error instanceof Error ? error.message : "Sortie de file impossible.");
      juryUncertain.current = true; setJuryCheckNeeded(true);
      await reconcileJury();
    } finally {
      juryMutationLock.current = false;
      if (!juryUncertain.current) juryPending.current = null;
      setMatchmakingLoading(false);
    }
  };

  const confirmRemoteBattle = async () => {
    if (!pendingTrainingFlowerId) return;
    const trainingFlowerId = pendingTrainingFlowerId;
    if (juryMutationLock.current || juryUncertain.current) return;
    juryMutationLock.current = true;
    juryPresentation.current = true;
    juryPending.current = { flowerId: trainingFlowerId };
    setMatchmakingLoading(true);
    try {
      const result = await finalizeKqRemoteBotBattle(trainingFlowerId, juryRequest);
      if (lifecycle.current.mounted && currentPresentationView.current !== "game" && juryPresentation.current) {
        sound.playOnce(result.winner === "player" ? "victory" : "defeat", `battle:${result.battleId}`);
      }
      setOfficialFlowers((flowers) => flowers.filter((flower) => flower.id !== trainingFlowerId));
      const score = `${result.rounds.filter((round) => round.winner === "player").length}–${result.rounds.filter((round) => round.winner === "opponent").length}`;
      const opponentName = result.opponentFlower.ownerName || "Bot d’entraînement";
      if (juryPresentation.current) setBotBattleResult({
        battleId: result.battleId,
        playerFlowerId: trainingFlowerId,
        winner: result.winner,
        burnedAt: result.burnedAt,
        experienceAwarded: result.experienceAwarded,
        todayCount: result.todayCount,
        dailyLimit: result.dailyLimit,
        opponentName,
        varietyName: result.opponentFlower.variety,
        rounds: result.rounds,
        challengePoints: result.challengePoints,
        completedChallenges: result.completedChallenges,
        rewardCard: result.rewardCard,
      });
      if (result.rewardCard) {
        setRemoteInventory((current) => ({
          ...current,
          [result.rewardCard!.code]: (current[result.rewardCard!.code] ?? 0) + 1,
        }));
        setCollectionRefreshNonce((nonce) => nonce + 1);
      }
      const challengeReward = result.challengePoints > 0 ? ` · +${result.challengePoints} points de défis` : "";
      setRemoteNotice(`${result.winner === "player" ? "Victoire" : "Défaite"} contre ${opponentName} · ${score} · bot tiré au hasard · +${result.experienceAwarded.toLocaleString("fr-FR")} EXP d’Arène${challengeReward} · entraînement ${result.todayCount}/${result.dailyLimit}. Ta Fleur a été brûlée.`);
      setPendingTrainingFlowerId(null);
      try {
        const refreshed = await getKqRemoteBattles(juryRequest);
        setOfficialBattles(refreshed.battles);
        setRecentBattlesLoaded(true);
      } catch {
        // Le reçu affiché reste la source de vérité jusqu’au prochain rechargement.
      }
      void refreshOfficialRanking().catch(() => undefined);
    } catch (error) {
      setRemoteNotice(error instanceof Error ? error.message : "Verrouillage du duel impossible.");
      juryUncertain.current = true; setJuryCheckNeeded(true);
      await reconcileJury();
    } finally {
      juryMutationLock.current = false;
      if (!juryUncertain.current) juryPending.current = null;
      setMatchmakingLoading(false);
    }
  };

  const distributeSeasonRewards = async () => {
    if (!seasonRewardPreview?.rewardsLive || seasonDistributionPending) return;
    if (!window.confirm("Distribuer définitivement les récompenses de fin de saison aux joueurs éligibles ?")) return;
    setSeasonDistributionPending(true);
    setRemoteNotice("");
    try {
      const response = await api.request("/api/admin/placard/season-rewards", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const payload = await response.json() as {
        error?: string;
        live?: boolean;
        eligiblePlayers?: number;
        granted?: number;
        alreadyGranted?: number;
      };
      if (!response.ok) throw new Error(payload.error || "Distribution de saison impossible.");
      const granted = Number(payload.granted ?? 0);
      const alreadyGranted = Number(payload.alreadyGranted ?? 0);
      const eligiblePlayers = Number(payload.eligiblePlayers ?? 0);
      setSeasonRewardPreview((current) => current ? {
        ...current,
        eligiblePlayers,
        alreadyGranted: granted + alreadyGranted,
        pendingGrants: Math.max(0, eligiblePlayers - granted - alreadyGranted),
      } : current);
      setRemoteNotice(`${granted} récompense${granted > 1 ? "s" : ""} de saison attribuée${granted > 1 ? "s" : ""} · ${alreadyGranted} déjà traitée${alreadyGranted > 1 ? "s" : ""}.`);
    } catch (error) {
      setRemoteNotice(error instanceof Error ? error.message : "Distribution de saison impossible.");
    } finally {
      setSeasonDistributionPending(false);
    }
  };

  const runNotebookRetroBatch = async () => {
    if (!notebookRewardPreview?.rewardsLive || notebookRetroCursor === null || notebookRetroPending) return;
    if (notebookRetroCursor === 0 && !window.confirm("Lancer la rétro-attribution des badges Carnet déjà obtenus, par lots de 50 ?")) return;
    setNotebookRetroPending(true);
    setRemoteNotice("");
    try {
      const response = await api.request("/api/admin/placard/notebook-rewards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cursor: notebookRetroCursor }),
      });
      const payload = await response.json() as {
        error?: string;
        processed?: number;
        granted?: number;
        alreadyGranted?: number;
        nextCursor?: number | null;
      };
      if (!response.ok) throw new Error(payload.error || "Rétro-attribution Carnet impossible.");
      setNotebookRetroCursor(payload.nextCursor ?? null);
      setRemoteNotice(`Lot Carnet traité · ${Number(payload.granted ?? 0)} nouvelle${Number(payload.granted ?? 0) > 1 ? "s" : ""} attribution${Number(payload.granted ?? 0) > 1 ? "s" : ""} · ${Number(payload.alreadyGranted ?? 0)} déjà reçue${Number(payload.alreadyGranted ?? 0) > 1 ? "s" : ""}.${payload.nextCursor == null ? " Rétro-attribution terminée." : " Un lot suivant est disponible."}`);
    } catch (error) {
      setRemoteNotice(error instanceof Error ? error.message : "Rétro-attribution Carnet impossible.");
    } finally {
      setNotebookRetroPending(false);
    }
  };

  const confirmOfficialVerdict = async () => {
    if (!pendingOfficialVerdictId) return;
    if (juryMutationLock.current || juryUncertain.current) return;
    juryMutationLock.current = true;
    juryPresentation.current = true;
    juryPending.current = { battleId: pendingOfficialVerdictId };
    setMatchmakingLoading(true);
    try {
      const verdict = await finalizeKqRemoteBattle(pendingOfficialVerdictId, juryRequest);
      if (lifecycle.current.mounted && currentPresentationView.current !== "game" && juryPresentation.current && verdict.replayed === false) {
        sound.playOnce(verdict.winner === "player" ? "victory" : "defeat", `battle:${verdict.battleId}`);
      }
      const resolvedBattle = officialBattles.find((battle) => battle.id === verdict.battleId);
      // Replace confirmation and result together, before asynchronous refreshes,
      // so retiring the old overlay cannot dismiss the newly presented verdict.
      setPendingOfficialVerdictId(null);
      setOfficialBattles((battles) => battles.map((battle) => battle.id === verdict.battleId ? {
        ...battle, status: "verdict", rounds: verdict.rounds, winner: verdict.winner, verdictAt: verdict.burnedAt,
        playerFlower: { ...battle.playerFlower }, opponentFlower: { ...battle.opponentFlower },
      } : battle));
      if (juryPresentation.current) setOfficialBattleResult({
        battleId: verdict.battleId,
        playerFlowerId: resolvedBattle?.playerFlower.id,
        winner: verdict.winner,
        burnedAt: verdict.burnedAt,
        experienceAwarded: verdict.experienceAwarded,
        rounds: verdict.rounds,
        playerVariety: resolvedBattle?.playerFlower.variety ?? "Ta Fleur",
        opponentVariety: resolvedBattle?.opponentFlower.variety ?? "Fleur adverse",
        challengePoints: verdict.challengePoints,
        completedChallengeTitles: verdict.completedChallenges.map((challenge) => challenge.title),
        pvpBoosterGranted: verdict.pvpBoosterGranted,
        pvpBoosterCardCount: verdict.pvpBoosterCardCount,
        rankProfile: verdict.rankProfile,
      });
      setOfficialFlowers((flowers) => flowers.map((flower) => flower.id === officialBattles.find((battle) => battle.id === verdict.battleId)?.playerFlower.id ? { ...flower, status: "burned" } : flower));
      setOfficialChallengeReward({
        points: verdict.challengePoints,
        titles: verdict.completedChallenges.map((challenge) => challenge.title),
      });
      try {
        const [flowersSnapshot, battlesSnapshot] = await Promise.all([
          getKqRemoteFlowers(juryRequest),
          getKqRemoteBattles(juryRequest),
        ]);
        setOfficialFlowers(flowersSnapshot.flowers);
        setOfficialBattles(battlesSnapshot.battles);
        setRecentBattlesLoaded(true);
      } catch {
        // The verdict receipt above remains authoritative. A later page refresh
        // will reload the same burned flowers and battle archive.
      }
      setRemoteNotice(verdict.replayed
        ? `Verdict déjà enregistré et resynchronisé · ${verdict.winner === "player" ? "victoire" : "défaite"} · aucun nouveau burn.`
        : `${verdict.winner === "player" ? "Victoire" : "Défaite"} · les deux Fleurs ont été brûlées · cote ${verdict.rankProfile?.rating ?? "mise à jour"}${verdict.challengePoints > 0 ? ` · +${verdict.challengePoints} points de défis` : ""}${verdict.pvpBoosterGranted ? " · booster Botte du Chanvrier de 3 cartes gagné !" : ""}.`);
      if (verdict.pvpBoosterGranted) {
        api.notify("kq:boosters-updated");
      }
      void refreshOfficialRanking().catch(() => undefined);
    } catch (error) {
      setRemoteNotice(error instanceof Error ? error.message : "Verdict impossible.");
      juryUncertain.current = true; setJuryCheckNeeded(true);
      await reconcileJury();
    } finally {
      juryMutationLock.current = false;
      if (!juryUncertain.current) juryPending.current = null;
      setMatchmakingLoading(false);
    }
  };

  const startSelectedGame = async () => {
    if (startInFlight.current || remoteAction !== null || careBusy || contractBusy) return;
    if (buddieStartBlockReason) {
      setRemoteNotice(buddieStartBlockReason);
      return;
    }
    if (playerPresentation && (!energyEstimate || energyEstimate.mode !== energyMode)) return;
    const currentDailyChallenges = getKqDailyChallenges();
    if (dailyChallenges[0]?.dayKey !== currentDailyChallenges[0]?.dayKey) {
      setDailyChallenges(currentDailyChallenges);
      setDeckNotice("Les défis du jour viennent de changer. Vérifie-les avant de lancer ta culture.");
      setPendingStart(false);
      return;
    }
    if (remoteBurnsEnabled) {
      startInFlight.current = true;
      setRemoteAction("start");
      setRemoteNotice("");
      try {
        const input = {
          buddieCode: preparationBuddie,
          deckCodes: [...selectedCards],
          cultureTokens: 0,
          energyMode,
          expectedEnergyCents: isPlayerMode ? energyEstimate?.totalCents : undefined,
          heritageCode: selectedHeritage || undefined,
          ...(isPlayerMode ? { campaign: true } : {}),
        };
        const requestKey = isPlayerMode ? getKqZoneStartRequestKey((isolatedStorage?.session ?? window.sessionStorage), KQ_CAMPAIGN_START_SCOPE, { ...input, participants: campaignParticipants }, () => crypto.randomUUID()) : undefined;
        const result = await startKqRemoteRun({ ...input, ...(requestKey ? { requestKey } : {}) }, remoteRequest);
        if (!lifecycle.current.mounted) return;
        setBuddieRotation((current) => result.buddieRotation ?? {
          requiredDistinctBuddies: KQ_BUDDIE_ROTATION_REQUIRED,
          recentBuddieCodes: recordKqBuddieUse(result.state.varietyCode, current?.recentBuddieCodes ?? []),
        });
        const nextInventory = remoteInventory;
        setState(result.state);
        setBattle(null);
        remoteInventoryRef.current = nextInventory;
        setRemoteInventory(nextInventory);
        setRemoteCollection((current) => ({ ...current, cultureTokenBalance: result.cultureTokenBalance }));
        if (result.burnReceipt) {
          const receipt = toLocalReceipt(result.burnReceipt, result.state.seed);
          setBurnHistory((history) => [receipt, ...history.filter((entry) => entry.id !== receipt.id)].slice(0, 100));
        }
        if (!isPlayerMode) void repositoryRef.current?.saveGame(result.state);
        setRemoteRunId(result.runId);
        (isolatedStorage?.session ?? window.sessionStorage).setItem(`${sessionStoragePrefix}-remote-run-id`, result.runId);
        setRemoteNotice(result.state.campaign ? "Campagne lancée · un seul parcours pour tous tes Buddies." : "Culture lancée sur sol vivant · aucune carte Botte du Chanvrier consommée au départ.");
        setPendingStart(false);
        setSetupOpen(false);
        if (isPlayerMode) {
          consumePreparation(result.runId);
          clearKqZoneStartRequestKey((isolatedStorage?.session ?? window.sessionStorage), KQ_CAMPAIGN_START_SCOPE);
          onOpenRun?.({ campaign: !!result.state.campaign, runId: result.state.campaign?.leaderRunId ?? result.runId });
        }
      } catch (error) {
        setRemoteNotice(error instanceof Error ? error.message : "Démarrage distant impossible.");
        void refreshBuddieRotation().catch(() => undefined);
      } finally {
        startInFlight.current = false;
        setRemoteAction(null);
      }
      return;
    }
    const hasBiocontrolChallenge = rewardableDailyChallenges.some((challenge) => challenge.code === "biocontrol");
    const startConfig: Parameters<typeof startKqGame>[1] = {
      domiciliation: "retired",
      varietyCode: selectedBuddie,
      deckCodes: [...selectedCards],
      collectionCodes: LOCAL_COLLECTION_CODES.filter((code) => (activeInventory[code] ?? 0) > 0),
      recentSituationCodes: state.situationCodes,
      challengeDayKey: dailyChallenges[0]?.dayKey,
      requiredSituationTags: hasBiocontrolChallenge ? ["pest"] : [],
      startingXp: hasBiocontrolChallenge ? 2 : 1,
      heritageCode: selectedHeritage || undefined,
      heritageCard: selectedHeritageCard,
      ...(tutorial ? { energyMode } : {}),
      startedAt: new Date().toISOString(),
    };
    const nextState = tutorial ? tutorial.startGame(startConfig) : startKqGame(Date.now(), startConfig);
    setState(nextState);
    setBattle(null);
    void repositoryRef.current?.saveGame(nextState);
    setPendingStart(false);
    setSetupOpen(false);
  };

  const closeCardInspection = () => {
    setPendingBurnCode(null);
    window.requestAnimationFrame(() => {
      if (document.activeElement === document.body || !document.activeElement?.isConnected) {
        gameViewportRef.current?.querySelector<HTMLElement>("[data-culture-hand] > summary")?.focus();
      }
    });
  };

  const playAndBurnCard = async (code: string) => {
    if (careBusy || remoteAction !== null || rolling || diceVisualSyncing) return;
    const selectedCard = KQ_CARDS.find(card => card.code === code);
    if (!selectedCard || !getKqPlayerCardPermission(state, selectedCard, activeInventory[code] ?? 0).allowed) return;
    if (remoteBurnsEnabled) {
      if (!remoteRunId) {
        setRemoteNotice("Cette culture n’est pas enregistrée. Recommence-la en mode officiel.");
        closeCardInspection();
        return;
      }
      setRemoteAction("card");
      setRemoteNotice("");
      try {
        const result = await playKqRemoteCard(remoteRunId, code, remoteRequest);
        if (!lifecycle.current.mounted) return;
        const nextInventory = { ...remoteInventory, [code]: Math.max(0, (remoteInventory[code] ?? 0) - 1) };
        const receipt = toLocalReceipt(result.burnReceipt, result.state.seed);
        setState(result.state);
        remoteInventoryRef.current = nextInventory;
        setRemoteInventory(nextInventory);
        setBurnHistory((history) => [receipt, ...history.filter((entry) => entry.id !== receipt.id)].slice(0, 100));
        if (!isPlayerMode) void repositoryRef.current?.saveGame(result.state);
        setRemoteNotice(`${KQ_CARDS.find((card) => card.code === code)?.name ?? code} appliquée · reçu ${receipt.id.slice(0, 8)}.`);
        closeCardInspection();
      } catch (error) {
        setRemoteNotice(error instanceof Error ? error.message : "Validation distante impossible.");
      } finally {
        setRemoteAction(null);
      }
      return;
    }
    const played = playKqCard(state, code);
    if (played === state) return;
    const next = tutorial ? assistKqPlayableLesson(played) : played;
    const nextInventory = { ...inventory, [code]: Math.max(0, (inventory[code] ?? 0) - 1) };
    const card = KQ_CARDS.find((item) => item.code === code);
    const receipt: KqBurnReceipt = { id: `BURN-${next.seed}-${next.stageIndex}-${code}-${next.usedCards.length}`, cardCode: code, runSeed: next.seed, stageIndex: next.stageIndex, useKind: card?.category === "pbi" ? "pbi" : "support", burnedAt: new Date().toISOString() };
    setState(next);
    setInventory(nextInventory);
    setBurnHistory((history) => [receipt, ...history.filter((entry) => entry.id !== receipt.id)].slice(0, 100));
    void repositoryRef.current?.saveBurnTransaction(next, nextInventory, receipt);
    closeCardInspection();
  };

  const addCardCopy = (code: string) => {
    const selectedCopies = selectedCards.filter((item) => item === code).length;
    if (selectedCopies >= (activeInventory[code] ?? 0)) {
      setDeckNotice("Toutes les copies disponibles de cette carte sont déjà dans le deck.");
      return;
    }
    setSelectedCards([...selectedCards, code]);
    setDeckNotice("Une copie ajoutée. La taille du deck dépend uniquement de ta collection.");
  };

  const removeCardCopy = (code: string) => {
    const index = selectedCards.lastIndexOf(code);
    if (index < 0) return;
    setSelectedCards(selectedCards.filter((_, itemIndex) => itemIndex !== index));
    setDeckNotice("Une copie retirée du deck.");
  };

  const applyCollectionDeck = (mode: "one-each" | "all-copies") => {
    const deck = buildKqCollectionDeck(activeInventory, mode);
    setSelectedCards(deck);
    setDeckNotice(mode === "one-each"
      ? `Une copie de chacune de tes ${new Set(deck).size} références jouables a été ajoutée.`
      : `Toutes tes ${deck.length} copies jouables ont été engagées.`);
  };

  const applyRecommendedDeck = () => {
    const buddie = KQ_BUDDIES.find(item => item.code === preparationBuddie) ?? KQ_BUDDIES.find(item => item.code === selectedBuddie) ?? KQ_BUDDIES[0];
    const deck = buildKqRecommendedDeck(buddie.effect, activeInventory, rewardableDailyChallenges.map(challenge => challenge.code), buddie.code, { startingXp: preparationStartingXp }).support;
    setSelectedCards(deck);
    setDeckNotice(deck.length
      ? `Deck conseillé : ${deck.length} carte${deck.length > 1 ? "s" : ""} de ta collection. Seules tes copies disponibles sont utilisées ; tu peux modifier ce choix.`
      : "Aucune carte jouable disponible. Tu peux cultiver sans carte Botte du Chanvrier.");
  };

  const saveFavoriteDeck = () => {
    const favorite = { buddieCode: preparationBuddie, supportCodes: [...selectedCards] };
    setFavoriteDeck(favorite);
    setDeckNotice(`Deck favori enregistré avec ${selectedCards.length} carte${selectedCards.length > 1 ? "s" : ""}.`);
    void repositoryRef.current?.saveFavoriteDeck(favorite);
  };

  const restoreFavoriteDeck = () => {
    if (!favoriteDeck) return;
    const restoredCards = sanitizeKqDeckSelection(favoriteDeck.supportCodes, activeInventory);
    const remaining = remoteBurnsEnabled && buddieRotation
      ? getKqBuddieRotationRemaining(favoriteDeck.buddieCode, buddieRotation.recentBuddieCodes) : 0;
    const favoriteUnavailable = remoteBurnsEnabled && (!buddieRotation || remaining > 0)
      || isPlayerMode && !ownedBuddieCodes.includes(favoriteDeck.buddieCode);
    if (!favoriteUnavailable && !(isPlayerMode && initialZoneId)) setSelectedBuddie(favoriteDeck.buddieCode);

    setSelectedCards(restoredCards);
    const missing = favoriteDeck.supportCodes.length - restoredCards.length;
    const cardsNotice = missing > 0 ? `Deck favori restauré sans ${missing} copie${missing > 1 ? "s" : ""} indisponible${missing > 1 ? "s" : ""}.` : "Deck favori restauré.";
    setDeckNotice(isPlayerMode && initialZoneId ? cardsNotice : favoriteUnavailable
      ? `Cartes Botte du Chanvrier restaurées. Buddie favori indisponible. ${remaining > 0 ? getKqBuddieRotationMessage(remaining) : "Choisis un Buddie disponible dans ton album."}`
      : cardsNotice);
  };

  const deleteFavoriteDeck = () => {
    setFavoriteDeck(null);
    setDeckNotice("Deck favori supprimé.");
    void repositoryRef.current?.saveFavoriteDeck(null);
  };

  const closeOnboarding = () => {
    setShowOnboarding(false);
    void repositoryRef.current?.saveOnboardingSeen(true);
  };

  const openTestBooster = () => {
    const cards = openKqSupportBooster(Date.now() + boosterNonce);
    setInventory((current) => addKqBoosterToInventory(current, cards));
    setLastBooster(cards);
    setBoosterNonce((value) => value + 1);
  };

  const matchmaking = getKqMatchmaking(rankProfile);
  const randomLocalRival = matchmaking[Math.abs(state.seed + battleHistory.length * 97) % matchmaking.length];
  const leaderboard = getKqLocalLeaderboard(rankProfile);
  const playerLeaderboardEntry = leaderboard.find((entry) => entry.isPlayer);
  const displayedRank = isPlayerMode ? officialRankProgress?.rank ?? null : playerLeaderboardEntry?.rank ?? null;
  const displayedRating = isPlayerMode ? officialRankProgress?.rating ?? 1000 : rankProfile.rating;
  const displayedSeasonPoints = isPlayerMode ? officialRankProgress?.seasonPoints ?? 0 : rankProfile.seasonPoints;
  const displayedWins = isPlayerMode ? officialRankProgress?.wins ?? 0 : rankProfile.wins;
  const displayedLosses = isPlayerMode ? officialRankProgress?.losses ?? 0 : rankProfile.losses;
  const displayedStreak = isPlayerMode ? officialRankProgress?.streak ?? 0 : rankProfile.streak;
  const displayedArenaExperience = isPlayerMode ? officialRankProgress?.arenaExperience ?? 0 : 0;
  const displayedBusinessScore = isPlayerMode ? officialRankProgress?.businessScore ?? 0 : 0;
  const displayedPlacardScore = isPlayerMode
    ? officialRankProgress?.placardScore ?? calculateKqPlacardScore({
      rating: displayedRating,
      seasonPoints: displayedSeasonPoints,
      reputation: officialRankProgress?.reputation ?? 0,
      businessScore: displayedBusinessScore,
    }).score
    : calculateKqPlacardScore({
      rating: rankProfile.rating,
      seasonPoints: rankProfile.seasonPoints,
      reputation: 0,
    }).score;
  const displayedLeaderboard = isPlayerMode
    ? officialLeaderboard.slice(0, 3).map((entry) => ({
      id: `${entry.rank}-${entry.pseudo}`,
      rank: entry.rank,
      name: entry.pseudo,
      placardScore: entry.placardScore,
      rating: entry.rating,
      reputation: entry.reputation,
      businessScore: entry.businessScore,
      isPlayer: entry.rank === officialRankProgress?.rank,
    }))
    : leaderboard.slice(0, 3).map((entry) => ({
      ...entry,
      placardScore: calculateKqPlacardScore({
        rating: entry.rating,
        seasonPoints: entry.seasonPoints,
        reputation: 0,
      }).score,
      reputation: 0,
    }));
  const activeSubstrate = KQ_LIVING_SOIL;
  const cultureSystemStatus = situation ? getKqCultureSystemSituationStatus(state) : null;
  const activeHeritage = getKqStateHeritage(state);
  const selectableHeritageCards: readonly KqHeritageCard[] = remoteHeritageCards.length > 0
    ? remoteHeritageCards.filter((card) => card.isActive)
    : KQ_HERITAGE_CARDS;
  const selectedHeritageCard = selectableHeritageCards.find((card) => card.code === selectedHeritage);
  const preparationStartingXp = getKqPreparationStartingXp({
    source: remoteBurnsEnabled ? "official" : tutorial ? "tutorial" : "local",
    buddieCodes: isPlayerMode ? selectionReady && !selectionError ? campaignParticipants.map(member => member.buddieCode) : [] : [selectedBuddie],
    heritageCard: !selectedHeritage ? null : remoteBurnsEnabled
      ? remoteHeritageCards.find(card => card.code === selectedHeritage && card.isActive && card.ownedCopies > 0)
      : selectedHeritageCard,
    chanvrierStrength: preparationStrength,
    cultureTokens: 0,
    localBaseXp: tutorial ? 1 : rewardableDailyChallenges.some(challenge => challenge.code === "biocontrol") ? 2 : 1,
  });
  const heritagePermission = canActivateKqHeritage(state);
  const challengeResults = battle?.status === "verdict" ? evaluateKqChallenges(state, battle) : [];

  const judgeBattle = () => {
    if (!battle) return;
    const recentJuryCodes = battleHistory.slice(0, 3).flatMap((entry) => entry.rounds.map((round) => round.code));
    const verdict = resolveKqBattle(battle, state.seed, new Date(), recentJuryCodes);
    const rankedProfile = claimKqChallenges(applyKqBattleToRanking(rankProfile, verdict, verdict.opponentRating), evaluateKqChallenges(state, verdict));
    const reward = applyKqArenaStreakReward(rankedProfile, inventory, state.seed);
    const nextProfile = reward.profile;
    const nextInventory = reward.inventory;
    if (reward.cards.length > 0) setInventory(nextInventory);
    setPendingBattleVerdict(false);
    setRevealedRounds(0);
    setBattle(verdict);
    setBattleHistory((history) => [verdict, ...history.filter((entry) => entry.id !== verdict.id)].slice(0, 20));
    setRankProfile(nextProfile);
    void repositoryRef.current?.saveVerdictTransaction(verdict, nextProfile, nextInventory);
  };

  const contractRun = isPlayerMode && !api.isTutorial ? <KqCultureContract mode="run" runId={state.campaign?.leaderRunId ?? remoteRunId ?? initialRunId}
    refreshKey={`${state.stageIndex}:${state.phase}:${state.usedCards.length}:${state.quality}`} disabled={remoteAction !== null || careBusy} onBusyChange={setContractBusy} /> : null;

  if (!hydrated) return <main data-culture-run={state.campaign?.leaderRunId ?? remoteRunId ?? initialRunId} data-culture-campaign={state.campaign?.id} data-culture-zone={zoneContext?.id} data-culture-phase={state.phase} data-culture-stage={state.stageIndex} data-culture-variety={state.varietyCode} ref={gameViewportRef} className={styles.page}><div className={styles.loading}>Ouverture de Botte du Chanvrier…</div></main>;

  if (isPlayerMode && viewMode !== "arena" && (!selectionReady || selectionError)) {
    return <section className={styles.zoneSelection} data-culture-selection><h2>{selectionError ? "Culture indisponible" : "Ouverture de la culture…"}</h2><p role={selectionError ? "alert" : "status"}>{selectionError || "Vérification de la zone et de ta sauvegarde."}</p>{selectionError ? <button type="button" onClick={() => setCollectionRefreshNonce(value => value + 1)}>Réessayer</button> : null}</section>;
  }
  if (isPlayerMode && viewMode !== "arena" && setupOpen && activeRuns.length > 0) {
    return <section className={styles.zoneSelection} data-culture-selection><h2>Mes cultures</h2><p>{activeRuns.length ? "Choisis la culture à reprendre." : "Choisis une zone dans l’entrepôt pour commencer."}</p><div className={styles.runChoices}>{activeRuns.map(run => {
      const zoneId = getKqClientRunZoneId(run);
      const zone = run.state.warehouse?.zones.find(item => item.id === zoneId);
      const artwork = getBuddieArtwork(run.state.varietyCode, ownedBuddieArtwork[run.state.varietyCode]?.imageUrl);
      const label = <>{artwork ? <Image src={artwork} alt="" width={64} height={64} /> : <Leaf aria-hidden="true" />}<span><strong>{zone?.name ?? "Culture précédente"}</strong><small>{run.state.varietyName} · {getKqStageDisplayName(KQ_STAGES[run.state.stageIndex] ?? "Récolte")}</small></span><ArrowRight aria-hidden="true" /></>;
      return onOpenRun ? <button type="button" key={run.runId} onClick={() => onOpenRun({ zoneId, runId: run.runId })}>{label}</button> : <Link key={run.runId} href={`/arene/placard?view=game&run=${encodeURIComponent(run.runId)}${zoneId ? `&zone=${encodeURIComponent(zoneId)}` : ""}`}>{label}</Link>;
    })}</div>{onOpenWarehouse ? <button type="button" onClick={() => onOpenWarehouse()}>Ouvrir l’entrepôt</button> : <Link href="/arene/placard?view=workshop">Ouvrir l’entrepôt</Link>}</section>;
  }

  if (setupOpen || viewMode === "arena") {
    const supportCards = KQ_ACTIVE_CARDS.filter((card) => (deckFilter === "all" || card.category === deckFilter) && (deckRarity === "all" || card.rarity === deckRarity));
    const ownedBotteCount = KQ_ACTIVE_CARDS.filter((card) => (activeInventory[card.code] ?? 0) > 0).length;
    const totalBotteCopies = KQ_ACTIVE_CARDS.reduce((sum, card) => sum + (activeInventory[card.code] ?? 0), 0);
    const selectedReferenceCount = new Set(selectedCards).size;
    const deckCoverage = getKqDeckCoverage(selectedCards);
    const mostBurned = Object.entries(burnHistory.reduce<Record<string, number>>((counts, receipt) => ({ ...counts, [receipt.cardCode]: (counts[receipt.cardCode] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return (
      <main data-culture-run={state.campaign?.leaderRunId ?? remoteRunId ?? initialRunId} data-culture-campaign={state.campaign?.id} data-culture-zone={zoneContext?.id} data-culture-phase={state.phase} data-culture-stage={state.stageIndex} data-culture-variety={state.varietyCode} ref={gameViewportRef} className={styles.page} data-player-mode={playerPresentation || undefined} data-playable-lesson={Boolean(tutorial) || undefined} data-admin-operations={showAdminOperations || undefined} data-view-mode={viewMode}>
        <section className={styles.setupPanel}
          data-preparation-deck={setupOpen && viewMode !== "arena" ? selectedCards.join(",") : undefined}
          data-preparation-heritage={setupOpen && viewMode !== "arena" ? selectedHeritage : undefined}>
          <header className={styles.cultureIntro} data-culture-intro>
            <h1 className={styles.cultureIntroTitle}>{zoneContext?.name ?? "Cultures"}</h1>
            <Image src="/placard/map/culture-barn-sylvain-v1.webp" alt="" width={1536} height={512} loading="eager" sizes="(max-width: 760px) 100vw, 720px" />
          </header>
          <details className={styles.setupRules} data-culture-setup-help>
            <summary><CircleHelp size={16} aria-hidden="true" />Aide<ChevronDown size={14} aria-hidden="true" /></summary>
            <p>{tutorial ? "Essai assisté : un dé peut être ajusté avant validation pour poursuivre jusqu’à la récolte fictive." : <>La vitalité suit les opérations et les problèmes rencontrés. À 0 avant la récolte, la culture meurt.{isPlayerMode ? " Pour la toute première culture du compte, un secours gratuit permet de continuer une fois, avec les pénalités de l’étape." : null}</>}</p>
          </details>
          {showAdminOperations && !isPlayerMode ? <div className={styles.remoteCollectionStatus} data-error={remoteCollection.error || undefined}>
            <span>{isPlayerMode ? "Mes cartes Botte du Chanvrier" : "Données sécurisées · test admin"}</span>
            {remoteCollection.loading ? <strong>Chargement de tes cartes…</strong> : remoteCollection.error ? <strong>{remoteCollection.error}</strong> : <strong>{remoteCollection.totalCopies} carte{remoteCollection.totalCopies > 1 ? "s" : ""} disponible{remoteCollection.totalCopies > 1 ? "s" : ""}</strong>}
            <small>{remoteCollection.loading ? "Connexion à ton album…" : remoteCollection.error ? "Ta collection est momentanément indisponible." : isPlayerMode ? "Seules les cartes réellement jouées seront brûlées." : `${remoteCollection.ownerFound ? "Compte admin retrouvé" : "Aucun compte collection associé"} · collection ${remoteCollection.collectionActive ? "active" : "inactive"}.`}</small>
            {!isPlayerMode ? <button type="button" className={styles.remoteModeButton} disabled={remoteCollection.loading || !remoteCollection.ownerFound || (remoteAction !== null || careBusy)} data-active={remoteBurnsEnabled || undefined} aria-pressed={remoteBurnsEnabled} onClick={() => setRemoteMode(!remoteBurnsEnabled)}>{remoteBurnsEnabled ? "🔥 Burns officiels activés" : "Simulation locale"}</button> : null}
          </div> : null}
          {remoteNotice ? <div className={styles.remoteNotice} data-tone={getKqFeedbackTone(remoteNotice)} role="status" aria-live="polite">{remoteNotice}</div> : null}
          {juryCheckNeeded ? juryRecovery : null}
          {launchReadiness ? <details className={styles.launchReadiness} data-safe={launchReadiness.safelyDormant || undefined}><summary><span>Préflight de lancement</span><strong>{launchReadiness.readyForActivation ? "Contenu complet · activation encore verrouillée" : `${launchReadiness.blockers.length} blocage${launchReadiness.blockers.length > 1 ? "s" : ""} restant${launchReadiness.blockers.length > 1 ? "s" : ""}`}</strong><small>{launchReadiness.contentReady ? "Contenu : complet" : "Contenu : incomplet"} · {launchReadiness.safelyDormant ? "Sécurité : tous les verrous sont fermés" : "Alerte : un verrou de lancement est déjà ouvert"}</small></summary><div>{launchReadiness.checks.map((check) => { const safetyCheck = check.code.endsWith("-dormant"); return <p key={check.code} data-ready={check.ready || undefined} data-kind={safetyCheck ? "safety" : "content"}><b>{check.ready ? "✓" : "○"}</b><span>{check.label}</span><strong>{check.ready ? safetyCheck ? "Fermé" : "Prêt" : safetyCheck ? "À refermer" : "À terminer"}</strong></p>; })}<section className={styles.activationSequence}><h3>Fenêtre de lancement coordonnée</h3><small>Cette liste est volontairement informative : aucune activation automatique depuis cet écran.</small><ol>{launchReadiness.activationStillRequired.map((step) => <li key={step}>{step}</li>)}</ol></section></div></details> : null}
          {seasonRewardPreview ? <details className={styles.seasonRewardPreview}><summary><span>Fin de saison · {seasonRewardPreview.rewardsLive ? "distribution active" : "aperçu dormant"}</span><strong>{seasonRewardPreview.eligiblePlayers} joueur(s) éligible(s)</strong><small>{seasonRewardPreview.rewardsLive ? "La commande applique les reçus idempotents après confirmation." : "Aucune récompense n’est distribuée pendant les tests."}</small></summary><div><b>{seasonRewardPreview.pendingGrants}<small>attributions en attente</small></b><b>{seasonRewardPreview.alreadyGranted}<small>déjà attribuées</small></b><b>{seasonRewardPreview.totalSupportBoosters}<small>boosters Botte du Chanvrier prévus</small></b><b>{seasonRewardPreview.totalHeritageFragments}<small>fragments Héritage prévus</small></b></div><p>Distribution {seasonRewardPreview.rewardsLive ? "active" : "dormante"} · palier minimum : 3 duels terminés. Les titres, cadres et rubans restent prioritaires sur la puissance.</p><button type="button" className={styles.seasonDistributionButton} disabled={!seasonRewardPreview.rewardsLive || seasonRewardPreview.pendingGrants <= 0 || seasonDistributionPending} title={!seasonRewardPreview.rewardsLive ? "Le verrou KQ_SEASON_REWARDS_LIVE est désactivé." : undefined} onClick={() => void distributeSeasonRewards()}>{seasonDistributionPending ? "Distribution en cours…" : seasonRewardPreview.rewardsLive ? "Distribuer les récompenses" : "Distribution verrouillée"}</button></details> : null}
          {seasonRolloverPreview ? <details className={styles.seasonRewardPreview}><summary><span>Passage de saison · préflight seul</span><strong>{seasonRolloverPreview.fromSeason} → {seasonRolloverPreview.toSeason ?? "à planifier"}</strong><small>{seasonRolloverPreview.ready ? "Toutes les conditions techniques sont réunies." : "La clôture reste impossible tant que les blocages ne sont pas levés."}</small></summary><div><b>{seasonRolloverPreview.players}<small>joueurs classés</small></b><b>{seasonRolloverPreview.eligiblePlayers}<small>éligibles aux lots</small></b><b>{seasonRolloverPreview.missingRewardGrants}<small>récompenses manquantes</small></b><b>{seasonRolloverPreview.lockedBattles}<small>duels verrouillés</small></b></div><p>{seasonRolloverPreview.blockers.length > 0 ? seasonRolloverPreview.blockers.join(" · ") : "Archive et remise à zéro prêtes. Aucune exécution n’est exposée dans l’interface."}</p><button type="button" className={styles.seasonDistributionButton} disabled>Clôture non activée</button></details> : null}
          {notebookRewardPreview ? <details className={styles.notebookRewardPreview}><summary><span>Carnet → Kanab Quest · {notebookRewardPreview.rewardsLive ? "actif" : "aperçu dormant"}</span><strong>{notebookRewardPreview.pendingBadges} badge{notebookRewardPreview.pendingBadges > 1 ? "s" : ""} avec gains prévus</strong><small>La note donnée n’influence jamais la récompense.</small></summary><div className={styles.notebookRewardTotals}><b>{notebookRewardPreview.pendingSupportBoosters}<small>boosters Botte du Chanvrier prévus</small></b><b>{notebookRewardPreview.pendingCultureTokens}<small>jetons Coup de pouce prévus</small></b><b>{notebookRewardPreview.alreadyGranted}<small>badges déjà traités</small></b></div><ul>{notebookRewardPreview.badges.map((badge) => <li key={badge.profileBadgeId} data-granted={badge.granted || undefined}><span><strong>{badge.label}</strong><small>{badge.granted ? "Déjà attribué" : notebookRewardPreview.rewardsLive ? "À attribuer automatiquement" : "Prévu au lancement"}</small></span><b>{badge.supportBoosters > 0 ? `${badge.supportBoosters} booster${badge.supportBoosters > 1 ? "s" : ""}` : ""}{badge.supportBoosters > 0 && badge.cultureTokens > 0 ? " + " : ""}{badge.cultureTokens > 0 ? `${badge.cultureTokens} jeton${badge.cultureTokens > 1 ? "s" : ""}` : ""}</b></li>)}</ul><p>Aucun bouton client de réclamation : les gains seront attribués automatiquement et une seule fois après validation du badge.</p><button type="button" className={styles.notebookRetroButton} disabled={!notebookRewardPreview.rewardsLive || notebookRetroCursor === null || notebookRetroPending} title={!notebookRewardPreview.rewardsLive ? "Le verrou KQ_NOTEBOOK_REWARDS_LIVE est désactivé." : undefined} onClick={() => void runNotebookRetroBatch()}>{notebookRetroPending ? "Traitement du lot…" : !notebookRewardPreview.rewardsLive ? "Rétro-attribution verrouillée" : notebookRetroCursor === null ? "Rétro-attribution terminée" : notebookRetroCursor === 0 ? "Lancer la rétro-attribution" : "Traiter le lot suivant"}</button></details> : null}
          {!playerPresentation ? <div className={styles.albumSummary}>
            <article><span>Collection variétés</span><strong>{KQ_COLLECTIONS.buddies.title}</strong><p><b>{KQ_BUDDIES.length}</b> variétés jouables dans le prototype · {KQ_COLLECTIONS.buddies.totalCards} cartes dans l’album complet</p><div><i style={{ width: `${KQ_BUDDIES.length / KQ_COLLECTIONS.buddies.totalCards * 100}%` }} /></div></article>
            <article><span>Collection auxiliaire</span><strong>{KQ_COLLECTIONS.support.title}</strong><p><b>{ownedBotteCount}</b> références disponibles · {totalBotteCopies} copies · objectif {KQ_COLLECTIONS.support.totalCards}</p><div><i style={{ width: `${ownedBotteCount / KQ_COLLECTIONS.support.totalCards * 100}%` }} /></div></article>
          </div> : null}
          {isPlayerMode && ownedBuddieCodes.length === 0 ? (
            <aside className={styles.collectionBlockingNotice} role="status">
              <Flame />
              <div>
                <strong>Ta collection n’est pas encore prête pour une culture</strong>
                <p>Il te faut au moins une carte Buddie dans ton album pour choisir la variété.</p>
                <small>Les Buddies et les cartes non consommées restent dans ton album. Seules les cartes Botte du Chanvrier confirmées brûlent.</small>
              </div>
              <Link href="/profil/collection">Voir mon album</Link>
            </aside>
          ) : null}
          {viewMode === "arena" ? (
            <header className={styles.arenaModeHero}>
              <span>Compétition officielle</span>
              <h1>L’Arène des Fleurs</h1>
              <p>Dépose ta Fleur. Adversaire aléatoire, verdict automatique.</p>
            </header>
          ) : null}
          <KqSeasonBoard
            seasonCode={officialRankProgress?.seasonCode} rank={displayedRank} score={displayedPlacardScore}
            rating={displayedRating} seasonPoints={displayedSeasonPoints} reputation={isPlayerMode ? officialRankProgress?.reputation ?? 0 : 0}
            businessScore={displayedBusinessScore}
            wins={displayedWins} losses={displayedLosses} streak={displayedStreak} arenaExperience={displayedArenaExperience}
            leaderboard={displayedLeaderboard} updatedAt={officialRankProgress?.leaderboardGeneratedAt}
            local={!isPlayerMode || api.isTutorial} onOpenArena={() => {
              const reserve = document.getElementById("placard-reserve");
              if (reserve && reserve.getClientRects().length > 0) {
                reserve.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
                reserve.focus({ preventScroll: true });
              } else onOpenArena?.();
            }}
          />
          <details className={styles.packFormat}>
            <summary><span>Deux collections · deux parcours</span><strong>Les boosters Buddies restent inchangés</strong><small>Botte du Chanvrier possède sa boutique dans L’Arène.</small></summary>
            <div><b>Buddies · album habituel</b><b>Botte du Chanvrier · 10 cartes</b><b>Prix Botte du Chanvrier · 5 points</b></div>
            <p>Les points gagnés avec les achats servent dans les deux boutiques, avec un tarif propre à Botte du Chanvrier. Les Héritages se débloquent avec les avis de dégustation éligibles, en Regular comme en Concours.</p>
          </details>
          {!isPlayerMode && (showAdminOperations || showPackLab) ? <details className={styles.boosterLab} open={showPackLab || undefined}><summary>Prévisualisation locale · Booster Botte du Chanvrier</summary><div><div><span>Boutique de L’Arène</span><strong>Booster Botte du Chanvrier · 10 cartes</strong><p>Aperçu local uniquement : aucune carte n’est enregistrée.</p></div><aside><button type="button" onClick={openTestBooster}><Sparkles /> Ouvrir un booster test</button></aside></div></details> : null}
          {lastBooster.length > 0 ? <div className={styles.boosterReveal} aria-live="polite">{lastBooster.map((card, index) => <article key={`${card.code}-${index}`} data-rarity={card.rarity}><CardArtwork code={card.code} name={card.name} /><span>{getKqCardRarityLabel(card.rarity)}</span><strong>{card.name}</strong><small>{remoteBurnsEnabled ? "Aperçu local · aucune copie enregistrée" : `Tu en possèdes maintenant ${inventory[card.code] ?? 0}`}</small></article>)}</div> : null}
          {burnHistory.length > 0 ? <div className={styles.burnArchive}><Flame /><span><small>Registre permanent · {burnHistory.length} burns</small><strong>Cartes les plus utilisées</strong><div>{mostBurned.map(([code, count]) => <b key={code}>{KQ_CARDS.find((card) => card.code === code)?.name ?? code} ×{count}</b>)}</div></span></div> : null}
          {playerPresentation ? <div className={styles.setupChoices} data-culture-setup-choices>
            {preparationNotice ? <p className={styles.preparationNotice} role="status" data-preparation-adjusted>{preparationNotice}</p> : null}
            {isPlayerMode ? <div data-arena-tour="culture"><KqCampaignSummary participants={campaignParticipants} /><div className={styles.zoneNavigation}>{onOpenWarehouse ? <button type="button" data-preparation-edit-plan onClick={() => onOpenWarehouse(initialZoneId)}>Modifier le plan</button> : <Link href="/arene/placard?view=workshop">Modifier le plan</Link>}</div></div> : <details className={styles.setupChoice} open={setupSection === "buddie"} data-setup-choice="buddie" data-arena-tour="culture">
              <summary onClick={event => { event.preventDefault(); setSetupSection(setupSection === "buddie" ? null : "buddie"); }}>
                <span className={styles.setupChoiceIcon}><Leaf aria-hidden="true" /></span>
                <span><small>1 · Ta variété</small><strong>{KQ_BUDDIES.find(buddie => buddie.code === selectedBuddie)?.name ?? "Choisir un Buddie"}</strong><em>{buddieStartBlockReason || "Ton Buddie reste dans ta collection."}</em></span>
                <span className={styles.setupChoiceEdit}>{setupSection === "buddie" ? "Fermer" : "Modifier"}<ChevronDown size={16} aria-hidden="true" /></span>
              </summary>
              {setupSection === "buddie" ? <div className={styles.setupChoiceContent}><KqBuddieCarousel buddies={KQ_BUDDIES.filter(buddie => !isPlayerMode || ownedBuddieCodes.includes(buddie.code))}
                artwork={ownedBuddieArtwork} selectedCode={selectedBuddie} rotation={remoteBurnsEnabled ? buddieRotation : undefined} onSelect={setSelectedBuddie} />
                <button type="button" className={styles.setupChoiceDone} data-culture-keep-choice onClick={() => { setSetupSection(null); document.querySelector<HTMLElement>('[data-setup-choice="buddie"] > summary')?.focus(); }}><Check size={16} aria-hidden="true" /> Garder cette variété</button></div> : null}
            </details>}
            <details className={styles.setupChoice} open={setupSection === "cards"} data-setup-choice="cards">
              <summary onClick={event => { event.preventDefault(); setSetupSection(setupSection === "cards" ? null : "cards"); }}>
                <span className={styles.setupChoiceIcon}><Layers3 aria-hidden="true" /></span>
                <span><small>2 · Tes cartes de soutien · facultatif</small><strong>{selectedCards.length ? `${selectedCards.length} carte${selectedCards.length > 1 ? "s" : ""} choisie${selectedCards.length > 1 ? "s" : ""}` : "Sans carte de soutien"}</strong><em>Seules les copies jouées pendant la culture seront consommées.</em></span>
                <span className={styles.setupChoiceEdit}>{setupSection === "cards" ? "Fermer" : "Modifier"}<ChevronDown size={16} aria-hidden="true" /></span>
              </summary>
              {setupSection === "cards" ? <div className={styles.setupChoiceContent}>
                <KqDeckPreparation deckCodes={selectedCards} inventory={remoteBurnsEnabled && (remoteCollection.loading || remoteCollection.error) ? null : activeInventory}
                  startingXp={preparationStartingXp} loading={remoteBurnsEnabled && remoteCollection.loading} error={remoteBurnsEnabled ? remoteCollection.error : ""} />
                {isPlayerMode ? <KqSupportRecovery inventory={remoteCollection.loading || remoteCollection.error ? null : activeInventory}
                  onReturnToCards={() => document.querySelector<HTMLElement>("[data-deck-preparation]")?.focus({ preventScroll: true })}
                  onOpenDestination={destination => { if (destination === "market") onOpenMarket?.(); else if (destination === "workshop" || destination === "harvests") onOpenWarehouse?.(initialZoneId); }} /> : null}
                <div className={styles.setupDeckActions}><button type="button" data-recommended-deck disabled={remoteBurnsEnabled && (remoteCollection.loading || Boolean(remoteCollection.error))} onClick={applyRecommendedDeck}>Deck conseillé</button><button type="button" disabled={selectedCards.length === 0} onClick={saveFavoriteDeck}>{favoriteDeck ? "Enregistrer ce favori" : "Garder comme favori"}</button><button type="button" disabled={!favoriteDeck || remoteBurnsEnabled && (remoteCollection.loading || Boolean(remoteCollection.error))} onClick={restoreFavoriteDeck}>Reprendre mon favori</button><button type="button" disabled={selectedCards.length === 0} onClick={() => setSelectedCards([])}>Retirer les cartes</button></div>
                {deckNotice ? <p role="status">{deckNotice}</p> : null}
                <KqInventoryCarousel inventory={activeInventory} selectedCodes={selectedCards} onAdd={addCardCopy} onRemove={removeCardCopy}
                  loading={remoteBurnsEnabled && remoteCollection.loading} error={remoteBurnsEnabled ? remoteCollection.error : ""} />
                <button type="button" className={styles.setupChoiceDone} data-culture-keep-choice onClick={() => { setSetupSection(null); document.querySelector<HTMLElement>('[data-setup-choice="cards"] > summary')?.focus(); }}><Check size={16} aria-hidden="true" /> Garder ces cartes</button></div> : null}
            </details>
            <details className={styles.setupChoice} open={setupSection === "heritage"} data-setup-choice="heritage">
              <summary onClick={event => { event.preventDefault(); setSetupSection(setupSection === "heritage" ? null : "heritage"); }}>
                <span className={styles.setupChoiceIcon}><Sparkles aria-hidden="true" /></span>
                <span><small>3 · Ton Héritage · facultatif</small><strong>{selectedHeritageCard?.name ?? (selectedHeritage ? "Héritage à vérifier" : "Sans Héritage")}</strong><em>{selectedHeritageCard ? "Son pouvoir t’accompagne. La carte est conservée." : selectedHeritage ? "Ton choix est conservé pendant la vérification." : "Tu peux commencer sans ce bonus."}</em></span>
                <span className={styles.setupChoiceEdit}>{setupSection === "heritage" ? "Fermer" : "Modifier"}<ChevronDown size={16} aria-hidden="true" /></span>
              </summary>
              {setupSection === "heritage" ? <div className={styles.setupChoiceContent}><KqHeritageCarousel cards={selectableHeritageCards} ownedCodes={remoteHeritageOwnedCodes}
                ownershipRequired={remoteBurnsEnabled} producerNames={remoteHeritageProducerNames}
                selectedCode={selectedHeritage} onSelect={setSelectedHeritage}
                renderArtwork={(card, producerLabel) => <CardArtwork code={card.code} name={card.name} producerName={producerLabel} imageUrl={card.imageUrl} />} />
                <button type="button" className={styles.setupChoiceDone} data-culture-keep-choice onClick={() => { setSetupSection(null); document.querySelector<HTMLElement>('[data-setup-choice="heritage"] > summary')?.focus(); }}><Check size={16} aria-hidden="true" /> Garder ce choix</button></div> : null}
            </details>
          </div> : <KqBuddieCarousel buddies={KQ_BUDDIES} artwork={ownedBuddieArtwork} selectedCode={selectedBuddie} rotation={remoteBurnsEnabled ? buddieRotation : undefined} onSelect={setSelectedBuddie} />}
          <h2 id="placard-deck" tabIndex={-1} className={styles.deckSectionTitle}>{isPlayerMode ? "3" : "2"}. Botte du Chanvrier <small>{selectedCards.length} carte{selectedCards.length > 1 ? "s" : ""}</small></h2>
          <p className={`${styles.deckNotice} ${styles.deckSelectionNotice}`} role="status" aria-live="polite">{deckNotice || "Ajoute autant de copies que tu en possèdes. Chaque copie jouée sera brûlée."}</p>
          <div className={styles.deckOdds}><div><span>Taille du deck</span><strong>{selectedCards.length}</strong></div><div><span>Références différentes</span><strong>{selectedReferenceCount}</strong></div><p><b>À retenir :</b> plus le deck est grand, plus il offre de solutions, mais plus une carte précise devient difficile à piocher dans une main de {KQ_HAND_SIZE} cartes.</p></div>
          <div className={styles.deckCoverage}><span>Couverture des situations</span><div>{Object.entries(COVERAGE_LABELS).map(([tag, label]) => { const count = deckCoverage[tag as keyof typeof COVERAGE_LABELS]; return <b key={tag} data-empty={count === 0 || undefined}>{label}<small>{count}</small></b>; })}<b data-versatile><Sparkles /> Polyvalentes<small>{deckCoverage.versatile}</small></b></div><p>Un zéro signale un angle mort, pas une interdiction : les dés et les cartes polyvalentes permettent toujours de jouer.</p></div>
          <div className={styles.deckQuickActions}><span>Composition rapide</span><div><button type="button" data-recommended-deck onClick={applyRecommendedDeck}>Deck conseillé</button><button type="button" onClick={() => applyCollectionDeck("one-each")}>1 de chaque</button><button type="button" onClick={() => applyCollectionDeck("all-copies")}>Toutes mes copies</button><button type="button" disabled={selectedCards.length === 0} onClick={() => { setSelectedCards([]); setDeckNotice("Deck vidé. Tu peux commencer sans carte Botte du Chanvrier."); }}>Vider</button></div></div>
          <div className={styles.favoriteDeckActions}><span>Deck favori · local</span><div><button type="button" disabled={selectedCards.length === 0} onClick={saveFavoriteDeck}>{favoriteDeck ? "Remplacer le favori" : "Enregistrer"}</button><button type="button" disabled={!favoriteDeck} onClick={restoreFavoriteDeck}>Restaurer</button><button type="button" disabled={!favoriteDeck} onClick={deleteFavoriteDeck}>Supprimer</button></div></div>
          <div className={styles.deckFilters} aria-label="Filtrer les cartes Botte du Chanvrier">{([['all', 'Toutes'], ['equipment', 'Équipement'], ['know-how', 'Savoir-faire'], ['luck', 'Chance']] as const).map(([value, label]) => <button key={value} type="button" data-selected={deckFilter === value || undefined} aria-pressed={deckFilter === value} onClick={() => setDeckFilter(value)}>{label}</button>)}</div>
          <label className={styles.deckRarityFilter}>Rareté<select aria-label="Filtrer le deck par rareté" value={deckRarity} onChange={event => setDeckRarity(event.target.value)}><option value="all">Toutes les raretés</option>{Object.entries(KQ_CARD_RARITY_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
          <p className={styles.deckNotice}>Les épiques offrent un secours puissant et ciblé. Une seule carte épique peut être jouée par culture.</p>
          <div className={styles.deckChoices}>{supportCards.map((card) => { const challengeFit = getKqCardChallengeFit(card, rewardableDailyChallenges.map((challenge) => challenge.code)); const selectedCopies = selectedCards.filter((code) => code === card.code).length; const ownedCopies = activeInventory[card.code] ?? 0; const drawChance = getKqOpeningHandChance(selectedCards.length, selectedCopies); return <article key={card.code} className={styles.deckChoiceCard} data-selected={selectedCopies > 0 || undefined} data-empty={ownedCopies <= 0 || undefined} data-challenge-fit={challengeFit || undefined}><CardArtwork code={card.code} name={card.name} /><span>{CATEGORY_LABELS[card.category]}</span>{challengeFit ? <i className={styles.challengeFit}><Star /> Aide défi</i> : null}<strong>{card.name}</strong><CardEffectGuide card={card} /><em>{ownedCopies} copie(s) · {card.xpCost} XP</em>{selectedCopies > 0 ? <small className={styles.drawChance}>{drawChance}% dans la première main</small> : null}<div><button type="button" aria-label={`Retirer une copie de ${card.name}`} disabled={selectedCopies <= 0} onClick={() => removeCardCopy(card.code)}>−</button><b>{selectedCopies} / {ownedCopies}</b><button type="button" aria-label={`Ajouter une copie de ${card.name}`} disabled={selectedCopies >= ownedCopies} onClick={() => addCardCopy(card.code)}>+</button></div></article>; })}</div>
          <div className={styles.pbiReserve}><span>Suivi vivant · intrants et protection biologique</span><p>Observe gratuitement les problèmes pendant la culture. Retrouve les intrants et les auxiliaires dans la boutique et la réserve du panneau de santé. Ils ne prennent aucune place dans le deck.</p></div>
          {isPlayerMode && !api.isTutorial ? <KqCultureContract disabled={remoteAction !== null || careBusy || pendingStart} onBusyChange={setContractBusy} /> : null}
          {playerPresentation ? <section className={styles.setupLaunch} data-culture-preparation aria-labelledby="culture-preparation-title">
            <div><h2 id="culture-preparation-title">Prêt à cultiver ?</h2><p>{isPlayerMode ? "6 étapes communes. Dés, cartes et soins font avancer tous tes Buddies." : "6 étapes à jouer. Le sol vivant est inclus ; le coût d’énergie sera présenté avant de commencer."}</p>{buddieStartBlockReason ? <p className={styles.setupLaunchWarning} role="status">{buddieStartBlockReason}</p> : null}</div>
            <button type="button" disabled={Boolean(buddieStartBlockReason) || remoteAction !== null || careBusy || contractBusy} onClick={() => setPendingStart(true)}>{remoteAction !== null || careBusy || contractBusy ? "Action en cours…" : isPlayerMode ? "Lancer la campagne" : "Lancer ma culture"}<ArrowRight size={20} aria-hidden="true" /></button>
            <details><summary>Comment se déroule une étape ?</summary><p>Lis la situation, utilise une carte ou un soin si tu le souhaites, puis lance les dés. Tu peux encore jouer une réaction avant de valider. Les achats et les cartes consommées demandent toujours ton action.</p></details>
          </section> : <KqCulturePreparation cardCount={selectedCards.length} note="Sol vivant inclus. Seules les cartes jouées sont consommées." disabled={Boolean(buddieStartBlockReason)} disabledReason={buddieStartBlockReason} busy={(remoteAction !== null || careBusy)} onEditDeck={() => {
            const target = document.getElementById("inventory-carousel-title") ?? document.getElementById("placard-deck");
            target?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
            target?.focus({ preventScroll: true });
          }} onStart={()=>setPendingStart(true)} />}
          {remoteBurnsEnabled ? (
            <section id="placard-reserve" tabIndex={-1} className={styles.officialFlowerReserve}>
              <header>
                <span>Réserve officielle</span>
                <h2>Mes Fleurs d’Arène</h2>
                <p>{officialFlowers.length} Fleur{officialFlowers.length > 1 ? "s" : ""} dans ta réserve.</p>
              </header>
              <details className={styles.duelHelp}>
                <summary>Duels : règles et récompenses</summary>
                <aside className={styles.duelRewardGuide} aria-label="Comparaison des récompenses de duel">
                <div data-mode="pvp">
                  <Swords />
                  <span><strong>Duel aléatoire · classé</strong><small>{KQ_REWARD_BALANCE.pvp.directSeasonPoints.min} à {KQ_REWARD_BALANCE.pvp.directSeasonPoints.max} points directs · {KQ_REWARD_BALANCE.pvp.arenaExperience.min} à {KQ_REWARD_BALANCE.pvp.arenaExperience.max} EXP</small><b>Elo + série · {KQ_REWARD_BALANCE.pvp.winnerCardCount} cartes au gagnant</b></span>
                </div>
                <div data-mode="training">
                  <Dices />
                  <span><strong>Entraînement · immédiat</strong><small>0 point direct · {KQ_REWARD_BALANCE.training.arenaExperience.min.toLocaleString("fr-FR")} EXP</small><b>Sans Elo ni série · {KQ_REWARD_BALANCE.training.winnerCardCount} carte si victoire</b></span>
                </div>
                <p><Star /> Défis communs aux deux modes : <strong>jusqu’à +{remainingDailyChallengePoints} points encore disponibles aujourd’hui</strong>, encaissés une seule fois.</p>
                </aside>
              </details>
              {officialFlowers.length > 0 ? (
                <div className={styles.officialFlowerGrid}>
                  {officialFlowers.map((flower) => (
                    <div className={styles.officialFlowerSlot} key={flower.id} id={`placard-flower-${flower.id}`} tabIndex={-1} data-requested={initialFlowerId === flower.id || undefined}>
                      <FlowerTcgCard
                        varietyName={flower.varietyName}
                        varietyCode={flower.varietyCode}
                        tier={flower.tier ?? getKqHarvestTier(flower.quality, flower)}
                        quality={flower.quality}
                        stats={flower.stats}
                        imageUrl={ownedBuddieArtwork[flower.varietyCode]?.imageUrl}
                        reference={`Fleur ${flower.id.slice(0, 8)}`}
                        status={flower.status}
                        selected={pendingTrainingFlowerId === flower.id || pendingRandomQueueFlowerId === flower.id}
                      />
                      {flower.cannabinoidReport ? <KqCannabinoidReport report={flower.cannabinoidReport} /> : null}
                      <PinnedRouteFlowerTarget route={routePlan?.route ?? null} stats={flower.stats} />
                      {flower.status === "available" ? (
                        <>
                          <button type="button" disabled={matchmakingLoading || juryCheckNeeded} onClick={() => setPendingRandomQueueFlowerId(flower.id)}>
                            <Swords /> Duel aléatoire · classé
                          </button>
                          <button type="button" disabled={matchmakingLoading || juryCheckNeeded} data-culture-training-flower={flower.id} onClick={() => { setRemoteNotice(""); setPendingTrainingFlowerId(flower.id); }}>
                            <Dices /> Entraînement · {KQ_REWARD_BALANCE.training.arenaExperience.min.toLocaleString("fr-FR")} EXP
                          </button>
                        </>
                      ) : flower.status === "queued" ? (
                        <>
                          <p className={styles.queueWait} role="status">Recherche en cours · {formatKqQueueWait(flower.queuedAt)}</p>
                          <button type="button" disabled={matchmakingLoading || juryCheckNeeded} onClick={() => void leaveRandomBattleQueue(flower.id)}>
                            <X /> Retirer de la file
                          </button>
                        </>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : <p className={styles.emptyFlowerReserve}>Termine une culture officielle pour créer ta première Fleur officielle.</p>}
            </section>
          ) : null}
          {remoteBurnsEnabled && officialBattles.length > 0 ? <section className={styles.officialBattles}>
            {officialChallengeReward ? <div className={styles.officialChallengeReward}><Star /><span><strong>+{officialChallengeReward.points} points de défis</strong><small>{officialChallengeReward.titles.length > 0 ? officialChallengeReward.titles.join(" · ") : "Aucun défi supplémentaire validé"}</small></span></div> : null}
            <KqBattleHistory battles={officialBattles} pending={matchmakingLoading || juryCheckNeeded} onRequestVerdict={setPendingOfficialVerdictId}
              onLoadRecent={() => void loadRecentBattles()} loadingRecent={recentBattlesLoading} recentLoaded={recentBattlesLoaded} recentError={recentBattlesError} />
          </section> : null}
          {battleHistory.length > 0 ? <section className={styles.battleHistory}><span>Archives locales</span><h2>Derniers concours</h2><div>{battleHistory.slice(0, 5).map((receipt) => <article key={receipt.id}><Flame /><span><strong>{receipt.playerFlower.variety} vs {receipt.opponentFlower.variety}</strong><small>{receipt.winner === "player" ? "Victoire" : "Défaite"} · brûlées le {formatKqDate(receipt.burnedAt)}</small></span><b>{receipt.rounds.filter((round) => round.winner === "player").length}–{receipt.rounds.filter((round) => round.winner === "opponent").length}</b></article>)}</div></section> : null}
        </section>
        {showOnboarding ? <div className={styles.onboardingBackdrop} role="presentation" onClick={closeOnboarding}><section className={styles.onboarding} role="dialog" aria-modal="true" aria-labelledby="kq-guide-title" aria-describedby="kq-guide-intro" onClick={(event) => event.stopPropagation()}><button type="button" className={styles.onboardingClose} aria-label="Fermer les règles" onClick={closeOnboarding}><X /></button><span>Kanab Quest · la boucle en 1 minute</span><h2 id="kq-guide-title">Cultive. Transforme. Réinvestis.</h2><p id="kq-guide-intro" className={styles.onboardingIntro}>Tes choix de culture fabriquent une récolte unique. Sa qualité ouvre de meilleurs débouchés, finance ton atelier et construit ta réputation.</p><div className={styles.onboardingSteps}><article><ShoppingBag /><b>1. Prépare ton atelier</b><p>Tout pousse sur sol vivant. Choisis ton Buddie et tes cartes <strong>Botte du Chanvrier</strong>. Les équipements durables déjà achetés renforcent chaque nouvelle partie.</p></article><article><Dices /><b>2. Passe les 6 étapes</b><p>Lance les dés, réponds aux situations et dépense tes cartes au bon moment. Protège à la fois la <strong>qualité</strong> et la quantité récoltée.</p></article><article><Scale /><b>3. Affronte le jury</b><p>À la récolte, le jury note la fleur. La note détermine son palier, sa valeur brute et les transformations réellement accessibles.</p></article><article><Flame /><b>4. Choisis ton débouché</b><p>Vends le lot brut, transforme-le en hash ou rosin, ou valorise-le en biomasse. Après le duel, 6 heures réelles de curing commencent : seul le grossiste achète avant maturité.</p></article><article><Trophy /><b>5. Réinvestis intelligemment</b><p>Utilise ton argent pour améliorer tente, lumière et machines. La qualité vendue augmente aussi ta <strong>réputation</strong> et départage le classement.</p></article></div><button type="button" className={styles.primaryButton} onClick={closeOnboarding}>C’est parti · préparer mon atelier</button></section></div> : null}
          {pendingStart ? <AppDialog open onClose={() => setPendingStart(false)} title="Ma culture" labelledBy="culture-system-burn-title" className={styles.verdictDialog} bodyClassName={styles.burnConfirm}><Flame /><span>Démarrage sur sol vivant</span><h2 id="culture-system-burn-title">{isPlayerMode ? "Commencer la campagne ?" : "Commencer la culture ?"}</h2><p>Le sol vivant est inclus et aucune carte n’est consommée au lancement. Les {selectedCards.length} cartes du deck ne brûleront que si tu les joues, copie par copie.</p>{playerPresentation ? <KqEnergyPanel campaign={isPlayerMode} disabled={(remoteAction !== null || careBusy)} selectedMode={energyMode} onModeChange={setEnergyMode} onQuoteChange={setEnergyEstimate} /> : null}{buddieStartBlockReason || remoteNotice ? <small className={styles.modalNotice}>{buddieStartBlockReason || remoteNotice}</small> : null}<div><button type="button" onClick={() => setPendingStart(false)}>{remoteAction === "start" ? "Fermer" : "Annuler"}</button><button type="button" className={styles.burnButton} disabled={(remoteAction !== null || careBusy) || Boolean(buddieStartBlockReason) || (playerPresentation && (!energyEstimate || energyEstimate.mode !== energyMode))} data-culture-confirm-start onClick={() => void startSelectedGame()}><Flame /> {remoteAction === "start" ? "Confirmation…" : "Commencer"}</button></div></AppDialog> : null}
          {pendingRandomQueueFlowerId ? <AppDialog open onClose={() => { juryPresentation.current = false; setPendingRandomQueueFlowerId(null); }} title="Le jury" labelledBy="random-queue-title" className={styles.verdictDialog} bodyClassName={styles.burnConfirm}><Swords /><span>Arène aléatoire · classée</span><h2 id="random-queue-title">Mettre cette Fleur à disposition ?</h2><p>Le serveur choisira au hasard une Fleur appartenant à un autre joueur, quelle que soit sa qualité. Tu pourras retirer la tienne tant qu’elle attend ; dès qu’un adversaire arrive, le jury se lance et les deux Fleurs brûlent automatiquement.</p><small>Gain garanti au verdict : {KQ_REWARD_BALANCE.pvp.directSeasonPoints.min} à {KQ_REWARD_BALANCE.pvp.directSeasonPoints.max} points de saison directs et {KQ_REWARD_BALANCE.pvp.arenaExperience.min} à {KQ_REWARD_BALANCE.pvp.arenaExperience.max} EXP. Le gagnant reçoit {KQ_REWARD_BALANCE.pvp.winnerCardCount} cartes Botte du Chanvrier.</small>{remoteNotice ? <small className={styles.modalNotice}>{remoteNotice}</small> : null}<div><button type="button" onClick={() => { juryPresentation.current = false; setPendingRandomQueueFlowerId(null); }}>{matchmakingLoading ? "Fermer" : "Annuler"}</button><button type="button" className={styles.burnButton} disabled={matchmakingLoading || juryCheckNeeded} onClick={() => void joinRandomBattleQueue(pendingRandomQueueFlowerId)}><Swords /> {matchmakingLoading ? "Recherche…" : "Entrer dans la file"}</button></div>{matchmakingLoading ? <p className={styles.modalNotice}>Tu peux fermer cette fenêtre : l’action soumise au jury continue.</p> : null}{juryCheckNeeded ? juryRecovery : null}</AppDialog> : null}
          {pendingTrainingFlowerId ? <AppDialog open onClose={() => { juryPresentation.current = false; setPendingTrainingFlowerId(null); }} title="Le jury" labelledBy="remote-battle-title" className={styles.verdictDialog} bodyClassName={styles.burnConfirm}><Swords /><span>Entraînement aléatoire</span><h2 id="remote-battle-title">Confier cette Fleur au jury ?</h2><p>Le serveur tirera le bot au hasard et le révélera avec le verdict. Le duel immédiat brûlera ta Fleur et rapportera {KQ_REWARD_BALANCE.training.arenaExperience.min.toLocaleString("fr-FR")} EXP d’Arène et une carte seulement en cas de victoire. Il ne modifie ni ton Elo ni ta série ; les défis du jour validés peuvent toutefois ajouter leurs points de saison.</p>{remoteNotice ? <small className={styles.modalNotice}>{remoteNotice}</small> : null}<div><button type="button" onClick={() => { juryPresentation.current = false; setPendingTrainingFlowerId(null); }}>{matchmakingLoading ? "Fermer" : "Annuler"}</button><button type="button" className={styles.burnButton} disabled={matchmakingLoading || juryCheckNeeded} data-culture-confirm-training onClick={() => void confirmRemoteBattle()}><Swords /> {matchmakingLoading ? "Tirage et jury…" : "Lancer l’entraînement"}</button></div>{matchmakingLoading ? <p className={styles.modalNotice}>Tu peux fermer cette fenêtre : l’action soumise au jury continue.</p> : null}{juryCheckNeeded ? juryRecovery : null}</AppDialog> : null}
          {botBattleResult ? (
            <KqBattleVerdictDialog battleId={botBattleResult.battleId} kind="training" winner={botBattleResult.winner}
              subtitle={`Face à ${botBattleResult.opponentName} · ${botBattleResult.varietyName}.`}
              rounds={botBattleResult.rounds} experience={botBattleResult.experienceAwarded}
              challengePoints={botBattleResult.challengePoints} challenges={botBattleResult.completedChallenges.map(challenge => challenge.title)}
              cardCount={botBattleResult.rewardCard ? 1 : 0}
              rewardCard={botBattleResult.rewardCard ? { ...botBattleResult.rewardCard, imageUrl: getKqCardArtwork(botBattleResult.rewardCard.code) ?? botBattleResult.rewardCard.imageUrl } : null}
              trainingProgress={`${botBattleResult.todayCount}/${botBattleResult.dailyLimit}`}
              playerStats={botRecapBattle?.playerFlower.stats} opponentStats={botRecapBattle?.opponentFlower.stats}
              onPrepare={onOpenGame || viewMode !== "arena" ? () => navigateAfterOverlays(prepareAfterVerdict) : undefined}
              prepareHref={!tutorial ? "/arene/placard?view=game" : undefined}
              prepareLabel={remoteRunId && state.phase !== "complete" ? "Reprendre ma culture en cours" : undefined}
              receipt={`Verdict enregistré · ${formatKqDate(botBattleResult.burnedAt)} · reçu ${botBattleResult.battleId.slice(0, 8)}`}
              continuation={<VerdictMarketTarget route={routePlan?.route ?? null} rounds={botBattleResult.rounds} />}
              onOpenLot={onOpenMarket && botBattleResult.playerFlowerId ? () => navigateAfterOverlays(() => onOpenMarket(botBattleResult.playerFlowerId)) : undefined}
              onClose={() => setBotBattleResult(null)}>
              <KqJuryRecap rounds={botBattleResult.rounds} playerStats={botRecapBattle?.playerFlower.stats} opponentStats={botRecapBattle?.opponentFlower.stats} />
            </KqBattleVerdictDialog>
          ) : null}
          {officialBattleResult ? (
            <KqBattleVerdictDialog battleId={officialBattleResult.battleId} kind="official" winner={officialBattleResult.winner}
              subtitle={`${officialBattleResult.playerVariety} face à ${officialBattleResult.opponentVariety}.`}
              rounds={officialBattleResult.rounds} experience={officialBattleResult.experienceAwarded}
              challengePoints={officialBattleResult.challengePoints} challenges={officialBattleResult.completedChallengeTitles}
              cardCount={officialBattleResult.pvpBoosterGranted ? officialBattleResult.pvpBoosterCardCount : 0}
              rank={officialBattleResult.rankProfile}
              playerStats={officialRecapBattle?.playerFlower.stats} opponentStats={officialRecapBattle?.opponentFlower.stats}
              onPrepare={onOpenGame || viewMode !== "arena" ? () => navigateAfterOverlays(prepareAfterVerdict) : undefined}
              prepareHref={!tutorial ? "/arene/placard?view=game" : undefined}
              prepareLabel={remoteRunId && state.phase !== "complete" ? "Reprendre ma culture en cours" : undefined}
              receipt={`Verdict enregistré · ${formatKqDate(officialBattleResult.burnedAt)} · reçu ${officialBattleResult.battleId.slice(0, 8)}`}
              continuation={<VerdictMarketTarget route={routePlan?.route ?? null} rounds={officialBattleResult.rounds} />}
              onOpenLot={onOpenMarket && officialVerdictFlowerId ? () => navigateAfterOverlays(() => onOpenMarket(officialVerdictFlowerId)) : undefined}
              onClose={() => setOfficialBattleResult(null)}>
              <KqJuryRecap rounds={officialBattleResult.rounds} playerStats={officialRecapBattle?.playerFlower.stats} opponentStats={officialRecapBattle?.opponentFlower.stats} />
            </KqBattleVerdictDialog>
          ) : null}
          {pendingOfficialVerdictId ? <AppDialog open onClose={() => { juryPresentation.current = false; setPendingOfficialVerdictId(null); }} title="Le jury" labelledBy="official-verdict-title" className={styles.verdictDialog} bodyClassName={styles.burnConfirm}><Flame /><span>Verdict officiel irréversible</span><h2 id="official-verdict-title">Brûler les deux Fleurs ?</h2><p>Le serveur calculera les trois manches, désignera le gagnant, mettra le classement à jour puis brûlera définitivement les deux Fleurs.</p>{remoteNotice ? <small className={styles.modalNotice}>{remoteNotice}</small> : null}<div><button type="button" onClick={() => { juryPresentation.current = false; setPendingOfficialVerdictId(null); }}>Fermer</button><button type="button" className={styles.burnButton} disabled={matchmakingLoading || juryCheckNeeded} data-culture-confirm-verdict onClick={() => void confirmOfficialVerdict()}><Flame /> {matchmakingLoading ? "Jury en cours…" : "Confirmer le verdict"}</button></div>{matchmakingLoading ? <p className={styles.modalNotice}>Tu peux fermer cette fenêtre : l’action soumise au jury continue.</p> : null}{juryCheckNeeded ? juryRecovery : null}</AppDialog> : null}
      </main>
    );
  }

  if (state.phase === "complete") {
    const economy = summarizeKqCardEconomy(state);
    const burnedCards = economy.burnedCodes.map((code) => KQ_CARDS.find((card) => card.code === code)).filter((card): card is KqSupportCard => Boolean(card));
    const preservedCards = economy.preservedCodes.map((code) => KQ_CARDS.find((card) => card.code === code)).filter((card): card is KqSupportCard => Boolean(card));
    const harvestMoment = <KqHarvestMoment state={state} flowers={isPlayerMode ? officialFlowers : undefined}
      runId={remoteRunId ?? initialRunId ?? officialFlowers.find(item => item.id === persistedFlowerId)?.runId}
      artwork={outcomeArtwork ?? undefined} fresh={freshHarvestKey === (state.campaign?.id ?? `${state.startedAt}:${state.seed}`)}
      onContinue={isPlayerMode ? onOpenArena : undefined} />;
    if (isPlayerMode && state.campaign) {
      return <main data-culture-run={state.campaign.leaderRunId} data-culture-campaign={state.campaign.id} data-culture-phase={state.phase} ref={gameViewportRef} className={styles.page} data-player-mode="true">
        {harvestMoment}
        <KqCampaignSummary state={state} flowers={officialFlowers} />
        {contractRun}
        <details className={styles.cultureDisclosure} data-culture-campaign-recap><summary>Journal et cartes de la campagne</summary><KqCultureRecap state={state} /><HarvestScoreSheet state={state} /><p>{burnedCards.length} copie{burnedCards.length > 1 ? "s" : ""} brûlée{burnedCards.length > 1 ? "s" : ""} · {preservedCards.length} conservée{preservedCards.length > 1 ? "s" : ""}, pour l’ensemble de la campagne.</p><KqCultureCarePanel state={state} request={remoteRequest} runId={state.campaign.leaderRunId} disabled onStateChange={setState} onBusyChange={setCareBusy} /></details>
        <details className={styles.cultureDisclosure}><summary>Charges et factures</summary><KqEnergyPanel campaign campaignMembers={state.campaign.members} runId={state.campaign.leaderRunId} /></details>
        {!cultureDead && !onOpenArena && <Link className={styles.primaryButton} href="/arene/placard?view=arena"><Swords /> Voir ma réserve</Link>}
        <div className={styles.zoneNavigation}>{onOpenWarehouse ? <button type="button" onClick={() => onOpenWarehouse()}>Retour à l’entrepôt</button> : <Link href="/arene/placard?view=workshop">Retour à l’entrepôt</Link>}</div>
      </main>;
    }
    if (cultureDead) {
      return (
        <main data-culture-run={state.campaign?.leaderRunId ?? remoteRunId ?? initialRunId} data-culture-campaign={state.campaign?.id} data-culture-zone={zoneContext?.id} data-culture-phase={state.phase} data-culture-stage={state.stageIndex} data-culture-variety={state.varietyCode} ref={gameViewportRef} className={styles.page} data-player-mode={playerPresentation || undefined} data-view-mode={viewMode}>
          {contractRun}
          <section className={styles.cultureDeath} aria-labelledby="culture-death-title" data-outcome="dead" data-outcome-stage={outcomeArtwork?.stage}>
            {outcomeArtwork?.outcome === "dead" ? (
              <span className={styles.cultureDeathArtwork}>
                <Image src={outcomeArtwork.src} alt={outcomeArtwork.alt} fill sizes="(max-width: 760px) 240px, 300px" />
              </span>
            ) : null}
            <div className={styles.cultureDeathCopy}>
              <span>Culture terminée · {state.varietyName}</span>
              <h1 id="culture-death-title">Culture terminée sans récolte</h1>
              <p>{state.care ? "La vitalité est tombée à 0 au dernier bilan. Le journal du suivi explique les problèmes et les pertes accumulées." : <>La dernière étape a été validée à 0 réussite alors que ta culture avait déjà une étape à zéro{rescuedStageIndex >= 0 ? " et que ton secours avait été utilisé" : ""}.</>}</p>
              <strong>Aucune récolte · Aucune carte Fleur</strong>
            </div>
          </section>
          <section className={styles.recoveryPanel} data-culture-recovery aria-label="Comprendre et préparer la suite">
            <h2>Ton aventure continue</h2>
            <p><strong>Tu gardes ta collection :</strong> ton Buddie, ton Héritage et les cartes non jouées. Les copies utilisées pendant cette culture restent consommées.</p>
            <KqCultureRecap state={state} />
            <p><strong>Pour la prochaine culture :</strong> garde si possible une réaction pour un lancer à zéro. Avant de valider, ouvre « Jouer une réaction » et vérifie les cartes compatibles avec tes XP disponibles.</p>
            <p>Tu peux aussi t’entraîner avec du matériel prêté : l’essai gratuit garantit une récolte fictive.</p>
            <div className={styles.recoveryActions}>
              <button type="button" className={styles.primaryButton} data-culture-recovery-action="prepare" onClick={reset}><RotateCcw /> Préparer une nouvelle culture</button>
              <button type="button" data-culture-recovery-action="trial" onClick={() => setRecoveryTrialOpen(true)}>M’entraîner sans frais</button>
            </div>
          </section>
          <KqCultureCarePanel state={state} request={remoteRequest} storage={careStorage} runId={remoteRunId} disabled={careBusy || remoteAction !== null || rolling || diceVisualSyncing || Boolean(pendingBurnCode)} onStateChange={setState} onBusyChange={setCareBusy} />
          <section className={styles.traitsPanel}>
            <h2>L’histoire de cette culture</h2>
            <ol className={styles.cultureDeathHistory} aria-label="Résultats des étapes validées">
              {state.history.map((entry, index) => (
                <li key={entry.stage} data-zero={entry.total === 0 && !entry.rescued || undefined} data-rescued={entry.rescued || undefined}>
                  <span><strong>{index + 1}. {getKqStageDisplayName(entry.stage)}</strong><small>{entry.situation}</small></span>
                  <b>{entry.total} réussite{entry.total === 1 ? "" : "s"}{entry.rescued ? " · secours utilisé" : ""}</b>
                </li>
              ))}
            </ol>
            <div className={styles.cultureReceipt}>
              <article><Flame /><span><small>Copies brûlées · {burnedCards.length}</small><div>{burnedCards.length > 0 ? burnedCards.map((card, index) => <b key={`${card.code}-${index}`}>{card.name}</b>) : <em>Aucune carte brûlée</em>}</div></span></article>
              <article><Sparkles /><span><small>Cartes conservées · {preservedCards.length}</small><div>{preservedCards.length > 0 ? preservedCards.map((card, index) => <b key={`${card.code}-${index}`}>{card.name}</b>) : <em>Aucune carte du deck conservée</em>}</div></span></article>
            </div>
          </section>
          {recoveryTrialOpen ? <RecoveryTrial storageKey="recovery" continueLabel="Préparer ma prochaine culture"
            onClose={() => setRecoveryTrialOpen(false)} onContinue={() => { setRecoveryTrialOpen(false); reset(); }} /> : null}
        </main>
      );
    }
    const flower = createKqFlower(state);
    const harvestProjection = getKqRunProjection(state);
    const recentJuryCodes = battleHistory.slice(0, 3).flatMap((entry) => entry.rounds.map((round) => round.code));
    const juryProgram = getKqJuryProgram(state.seed, recentJuryCodes, state.rulesVersion);
    if (isPlayerMode) {
      return (
        <main data-culture-run={state.campaign?.leaderRunId ?? remoteRunId ?? initialRunId} data-culture-campaign={state.campaign?.id} data-culture-zone={zoneContext?.id} data-culture-phase={state.phase} data-culture-stage={state.stageIndex} data-culture-variety={state.varietyCode} ref={gameViewportRef} className={styles.page} data-player-mode="true">
          {harvestMoment}
          {contractRun}
          <section className={styles.traitsPanel}>
            <h2>Ta Fleur rejoint la réserve officielle</h2>
            {harvestProjection.nextTier && harvestProjection.qualityToNextTier === 0 ? <p><KqHarvestTierProgress projection={harvestProjection} /></p> : null}
            <p>
              Elle n’est pas brûlée maintenant. Elle reste dans ta réserve jusqu’à son premier duel,
              puis le verdict la brûle définitivement.
            </p>
            <p>Le jury et le duel passent en premier. Après le verdict, ton lot commence ses 6 heures réelles de curing en entrepôt ; pendant ce délai, seul le grossiste peut le reprendre.</p>
            <div className={styles.cultureReceipt}>
              <article><Flame /><span><small>Copies brûlées · {burnedCards.length}</small><div>{burnedCards.map((card, index) => <b key={`${card.code}-${index}`}>{card.name}</b>)}</div></span></article>
              <article><Sparkles /><span><small>Cartes conservées · {preservedCards.length}</small><div>{preservedCards.length > 0 ? preservedCards.map((card, index) => <b key={`${card.code}-${index}`}>{card.name}</b>) : <em>Aucune carte conservée</em>}</div></span></article>
            </div>
            {state.energy ? <KqEnergyPanel lockedQuote={state.energy} lockedWarehouse={state.warehouse} lockedTents={state.equipment?.tents} lockedScope={state.equipment?.scope} productionUnits={state.equipment?.productionUnits} runId={remoteRunId ?? initialRunId} zoneId={initialZoneId} /> : null}
            <KqCultureRecap state={state} />
            <KqCultureCarePanel state={state} request={remoteRequest} storage={careStorage} runId={remoteRunId} disabled={careBusy || remoteAction !== null || rolling || diceVisualSyncing || Boolean(pendingBurnCode)} onStateChange={setState} onBusyChange={setCareBusy} />
            <HarvestScoreSheet state={state} />
            <div className={styles.traitsList}>{flower.traits.map((trait, index) => <span key={`${trait}-${index}`}><Star />{trait}</span>)}</div>
            <section className={styles.harvestFlowerCard} aria-label="Carte Fleur obtenue">
              <FlowerTcgCard
                varietyName={flower.variety}
                varietyCode={state.varietyCode}
                tier={flower.tier}
                quality={state.quality}
                stats={flower.stats}
                imageUrl={ownedBuddieArtwork[state.varietyCode]?.imageUrl}
                reference={flower.integrityCode}
                status="new"
              />
            </section>
            {!onOpenArena ? <Link className={styles.primaryButton} href="/arene/placard?view=arena"><Swords /> Voir ma réserve et entrer dans la file</Link> : null}
          </section>
        </main>
      );
    }
    return (
      <main data-culture-run={state.campaign?.leaderRunId ?? remoteRunId ?? initialRunId} data-culture-campaign={state.campaign?.id} data-culture-zone={zoneContext?.id} data-culture-phase={state.phase} data-culture-stage={state.stageIndex} data-culture-variety={state.varietyCode} ref={gameViewportRef} className={styles.page} data-player-mode={playerPresentation || undefined} data-playable-lesson={Boolean(tutorial) || undefined}>
        {harvestMoment}
        <p className={styles.integrityCode}>Culture #{String(state.seed).padStart(5, "0")} · Empreinte {flower.integrityCode}</p>
        <section className={styles.traitsPanel}>
          <h2>L’histoire de cette culture</h2>
          {harvestProjection.nextTier && harvestProjection.qualityToNextTier === 0 ? <p><KqHarvestTierProgress projection={harvestProjection} /></p> : null}
          <div className={styles.cultureReceipt}>
            <article><Flame /><span><small>Copies brûlées · {burnedCards.length}</small><div>{burnedCards.map((card, index) => <b key={`${card.code}-${index}`}>{card.name}</b>)}</div></span></article>
            <article><Sparkles /><span><small>Cartes conservées · {preservedCards.length}</small><div>{preservedCards.length > 0 ? preservedCards.map((card, index) => <b key={`${card.code}-${index}`}>{card.name}</b>) : <em>Aucune carte du deck conservée</em>}</div></span></article>
          </div>
          <KqCultureRecap state={state} />
          <KqCultureCarePanel state={state} request={remoteRequest} storage={careStorage} runId={remoteRunId} disabled={careBusy || remoteAction !== null || rolling || diceVisualSyncing || Boolean(pendingBurnCode)} onStateChange={setState} onBusyChange={setCareBusy} />
            <HarvestScoreSheet state={state} />
          <div className={styles.traitsList}>{flower.traits.map((trait, index) => <span key={`${trait}-${index}`}><Star />{trait}</span>)}</div>
          {state.combos.length > 0 ? <div className={styles.comboList}>{state.combos.map((combo) => <span key={combo}><Sparkles />Combo · {combo}</span>)}</div> : null}
          <section className={styles.harvestFlowerCard} aria-label="Carte Fleur obtenue">
            <FlowerTcgCard
              varietyName={flower.variety}
              varietyCode={state.varietyCode}
              tier={flower.tier}
              quality={state.quality}
              stats={flower.stats}
              imageUrl={ownedBuddieArtwork[state.varietyCode]?.imageUrl}
              reference={flower.integrityCode}
              status="new"
            />
          </section>
          {!battle ? (
            <div className={styles.battleEntry}>
              <div><Swords /><span><strong>Battle Fleur contre Fleur · tirage aléatoire</strong><small>Aucun rival à choisir : le simulateur forme le duel, puis les deux Fleurs brûlent au verdict.</small></span></div>
              <button type="button" className={styles.primaryButton} disabled={!randomLocalRival} onClick={() => {
                if (!randomLocalRival) return;
                setBattle(lockKqBattle(
                  flower,
                  createKqOpponent(state.seed + randomLocalRival.seedOffset, {
                    rulesVersion: state.rulesVersion,
                    ownerName: randomLocalRival.name,
                    variety: randomLocalRival.variety,
                    rating: randomLocalRival.rating,
                  }),
                  state.seed,
                  randomLocalRival.rating,
                ));
              }}><Swords /> Trouver un adversaire au hasard</button>
            </div>
          ) : null}
          {battle?.status === "locked" ? (
            <div className={styles.versusPanel}>
              <article><small>Ta Fleur</small><strong>{battle.playerFlower.variety}</strong><span>{battle.playerFlower.tier}</span><div className={styles.flowerStats}>{Object.entries(battle.playerFlower.stats).map(([stat, value]) => <span key={stat}><small>{FLOWER_STAT_LABELS[stat as keyof typeof FLOWER_STAT_LABELS]}</small><b>{value}</b></span>)}</div></article>
              <b>VS</b>
              <article><small>{battle.opponentFlower.ownerName}</small><strong>{battle.opponentFlower.variety}</strong><span>{battle.opponentFlower.tier}</span><div className={styles.flowerStats}>{Object.entries(battle.opponentFlower.stats).map(([stat, value]) => <span key={stat}><small>{FLOWER_STAT_LABELS[stat as keyof typeof FLOWER_STAT_LABELS]}</small><b>{value}</b></span>)}</div></article>
              <div className={styles.juryProgram}><span>Programme du jury</span>{juryProgram.map((round, index) => <div key={round.code}><b>{index + 1}</b><strong>{round.label}</strong><small>{round.explanation}</small></div>)}</div>
              <p><Flame /> Après validation du jury, les deux cartes seront définitivement brûlées.</p>
              <button type="button" className={styles.primaryButton} onClick={() => setPendingBattleVerdict(true)}>Lancer le verdict du jury</button>
            </div>
          ) : null}
          {battle?.status === "locked" && pendingBattleVerdict ? <AppDialog open onClose={() => setPendingBattleVerdict(false)} title="Le jury" labelledBy="flower-burn-title" className={styles.verdictDialog} bodyClassName={styles.burnConfirm}><Flame /><span>{tutorial ? "Verdict d’essai" : "Verdict irréversible"}</span><h2 id="flower-burn-title">Brûler les deux fleurs ?</h2><p>{battle.playerFlower.variety} et {battle.opponentFlower.variety} seront détruites après les trois manches. {tutorial ? "Seules les Fleurs prêtées et le classement fictif de cet essai sont concernés." : "Le résultat sera ajouté au classement et ne pourra pas être rejoué."}</p><div><button type="button" onClick={() => setPendingBattleVerdict(false)}>Retour au duel</button><button type="button" className={styles.burnButton} onClick={judgeBattle}><Flame /> Confirmer le verdict</button></div></AppDialog> : null}
          {battle?.status === "verdict" ? (
            <div className={styles.verdictPanel}>
              <span className={styles.verdictKicker}>{tutorial ? "Verdict fictif" : "Verdict officiel"}</span>
              <h2>{revealedRounds >= battle.rounds.length ? battle.winner === "player" ? "Victoire !" : "Défaite honorable" : "Délibération du jury…"}</h2>
              {revealedRounds >= battle.rounds.length ? <KqJuryRecap rounds={battle.rounds} playerStats={battle.playerFlower.stats} opponentStats={battle.opponentFlower.stats} onPrepare={reset} /> : null}
              {revealedRounds >= battle.rounds.length ? <small className={styles.verdictDate}>Fleurs brûlées le {formatKqDate(battle.burnedAt)}</small> : null}
              {revealedRounds >= battle.rounds.length && rankProfile.lastArenaRewardCards.length > 0 ? <div className={styles.arenaBoosterReward}><Sparkles /><span><small>Série de {rankProfile.streak} victoires · booster gagné</small><strong>{rankProfile.lastArenaRewardCards.map((code) => KQ_CARDS.find((card) => card.code === code)?.name ?? code).join(" · ")}</strong></span></div> : null}
              <div className={styles.battleRounds}>{battle.rounds.slice(0, revealedRounds).map((round) => <div key={round.code} data-winner={round.winner}><strong>{round.label}<small>{round.explanation}</small></strong><span>{round.playerScore}<small>{round.winner === "player" ? "Gagné" : ""}</small></span><b>–</b><span>{round.opponentScore}<small>{round.winner === "opponent" ? "Gagné" : ""}</small></span></div>)}</div>
              {revealedRounds < battle.rounds.length ? <div className={styles.juryWaiting}><i /><i /><i /><span>Manche {Math.min(revealedRounds + 1, 3)} sur 3</span></div> : <><p className={styles.burnReceipt}><Flame /> {battle.playerFlower.variety} et {battle.opponentFlower.variety} ont été brûlées. Leurs reçus restent dans l’historique.</p><div className={styles.rewardDeltas}><div className={styles.ratingDelta} data-positive={rankProfile.lastRatingDelta > 0 || undefined}><Trophy /><span><small>Évolution de ta cote</small><strong>{rankProfile.lastRatingDelta > 0 ? "+" : ""}{rankProfile.lastRatingDelta}</strong></span></div><div className={styles.seasonDelta}><Star /><span><small>Gain de saison</small><strong>+{rankProfile.lastSeasonPointsDelta}</strong></span></div></div><div className={styles.challengeResults}><h3>Défis du jour · {challengeResults[0]?.dayKey}</h3>{challengeResults.map((challenge) => { const awarded = rankProfile.lastClaimedChallengeCodes.includes(challenge.claimKey); return <div key={challenge.claimKey} data-completed={challenge.completed || undefined}><span><strong>{challenge.completed ? "✓ " : "○ "}{challenge.title}</strong><small>{challenge.description}</small></span><b>{awarded ? `+${challenge.points}` : challenge.completed ? "Déjà gagné" : "—"}</b></div>; })}</div><div className={styles.rankSummary}><span><strong>{rankProfile.rating}</strong><small>Cote</small></span><span><strong>{rankProfile.seasonPoints}</strong><small>Points saison</small></span><span><strong>{rankProfile.wins}-{rankProfile.losses}</strong><small>Victoires-défaites</small></span></div><ol className={styles.leaderboard}>{leaderboard.map((entry) => <li key={entry.id} data-player={entry.isPlayer || undefined}><b>#{entry.rank}</b><span>{entry.name}</span><strong>{entry.rating}</strong></li>)}</ol><button type="button" className={styles.primaryButton} onClick={reset}><RotateCcw /> Nouvelle culture</button></>}
            </div>
          ) : null}
        </section>
      </main>
    );
  }

  if (!situation) return null;
  const runChallenges = getKqDailyChallenges(getKqGameChallengeDate(state));
  const runProjection = getKqRunProjection(state);
  const displayedHarvestGrams = state.campaign ? state.campaign.members.reduce((sum, member) =>
    sum + getKqRunProjection(getKqCampaignMemberState(state, member)).harvestGrams, 0) : runProjection.harvestGrams;
  const lastStageReward = state.phase === "resolved" ? state.history.at(-1) ?? null : null;
  const primaryAction = state.phase === "prepare" ? "roll" : state.phase === "rolled" ? "resolve" : "advance";
  const actionContext = state.phase === "prepare"
    ? `${getKqStageTarget(state)} réussite${getKqStageTarget(state) > 1 ? "s" : ""} requise${getKqStageTarget(state) > 1 ? "s" : ""} · ${cardChoices.label.toLowerCase()}`
    : state.phase === "rolled" && preview
      ? turnPreview?.dead ? "Valider ce bilan entraînera la mort de la culture, sans récolte."
        : turnPreview?.rescued ? "Valider ce bilan utilisera ton secours de première culture."
        : turnPreview?.heritage?.changesOutcome ? `${turnPreview.heritage.name} assurera la réussite de ce bilan.`
        : preview.total === 0
        ? state.care ? "0 réussite : le bilan actualisera la santé et les problèmes en cours." : zeroSuccessStages > 0
          ? firstCultureRescueAvailable ? "0 réussite : ton secours permettra de continuer." : "0 réussite : valider fera mourir la culture."
          : "0 réussite : valider comptera comme une première étape à risque."
        : `${preview.total}/${preview.target} réussites · ${cardChoices.label.toLowerCase()}`
      : `${lastStageReward ? KQ_OUTCOME_LABELS[lastStageReward.outcome] : "Étape validée"} · ${state.xp} XP disponibles`;
  const focusTurnElement = (selector: string) => {
    window.requestAnimationFrame(() => {
      const element = gameViewportRef.current?.querySelector<HTMLElement>(selector);
      element?.focus({ preventScroll: true });
      element?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  };
  const performTurnAction = async () => {
    if (pendingBurnCode || rolling || (remoteAction !== null || careBusy) || diceVisualSyncing) return;
    if (primaryAction === "roll") {
      focusTurnElement("[data-culture-decision]");
      await roll();
    } else {
      const nextState = await applyGameAction(primaryAction);
      if (nextState?.phase === "prepare") focusTurnElement("[data-culture-situation]");
      else if (nextState?.phase === "resolved" && !isKqCultureDead(nextState)) focusTurnElement("[data-culture-result]");
    }
  };

  return (
    <main data-culture-run={state.campaign?.leaderRunId ?? remoteRunId ?? initialRunId} data-culture-campaign={state.campaign?.id} data-culture-zone={zoneContext?.id} data-culture-phase={state.phase} data-culture-stage={state.stageIndex} data-culture-variety={state.varietyCode} ref={gameViewportRef} className={styles.page} data-view-mode={viewMode} data-player-mode={playerPresentation || undefined} data-playable-lesson={Boolean(tutorial) || undefined} data-culture-play>
      {contractRun}
      <header className={styles.topbar}>
        <div className={styles.gameBrand}><span className={styles.gameBrandMark} aria-hidden="true"><Image src="/mascots/home-welcome.png" alt="" width={1122} height={1402} sizes="64px" /></span><div><span>{tutorial ? "Kanab Quest · Culture d’essai" : isPlayerMode ? "Kanab Quest · Culture officielle" : "Kanab Quest · Prototype local"}</span><h1>{state.campaign ? "Ma campagne" : zoneContext?.name ?? "Ma culture"}</h1></div></div>
        <div className={styles.resources}><span><Zap />{state.xp} XP</span><span><Star /> Qualité {runProjection.projectedQuality}</span><span>Pression {state.pressure}/4</span>{!isPlayerMode ? <button type="button" onClick={reset}><RotateCcw /> Recommencer</button> : null}</div>
      </header>

      <nav className={styles.stageTrack} aria-label="Étapes de production">
        {KQ_STAGES.map((stage, index) => <span key={stage} data-current={index === state.stageIndex || undefined} data-done={index < state.stageIndex || undefined} aria-current={index === state.stageIndex ? "step" : undefined}><b>{index + 1}</b><small>{getKqStageDisplayName(stage)}</small></span>)}
      </nav>

      {!state.care && state.firstCultureRescue ? <aside className={styles.rescueNotice} data-culture-rescue data-status={firstCultureRescueAvailable ? "available" : "used"} role="status">
        <strong>{firstCultureRescueAvailable ? "Première culture · 1 secours gratuit disponible" : `Secours utilisé à l’étape ${rescuedStageIndex + 1}`}</strong>
        <span>{firstCultureRescueAvailable
          ? "Au deuxième résultat validé à zéro, ta culture continuera. Les dés, la qualité et les XP de l’étape garderont leur résultat normal."
          : "Ta culture a pu continuer. Un nouveau résultat validé à zéro mettra fin à cette culture sans récolte."}</span>
      </aside> : !state.care && zeroSuccessStages > 0 ? <aside className={styles.cultureFailureRule} data-warning role="status"><strong>1 étape à 0 réussite.</strong> {tutorial ? "Dans cet essai, un dé sera assisté si nécessaire pour te laisser découvrir la récolte." : "Une deuxième étape validée à 0, même plus tard, entraînera la mort de la culture sans récolte."}</aside> : null}

      <section className={styles.gameGrid}>
        <div className={styles.situationCard} data-culture-situation tabIndex={-1}>
          <span className={styles.stepLabel}>Étape {state.stageIndex + 1}/6 · {getKqStageDisplayName(situation.stage)}</span>
          {situation.incident ? <span className={styles.incidentLabel}>{INCIDENT_LABELS[situation.incident]}</span> : null}
          <div className={styles.situationArt}>
            <Image
              src={situationArtwork.src}
              width={768}
              height={768}
              sizes="(max-width: 760px) 100vw, 380px"
              alt={situationArtwork.alt}
              priority={state.stageIndex === 0}
            />
          </div>
          <div className={styles.situationCopy}>
            <h2>{situation.name}</h2>
            <p>{situation.story}</p>
            <div className={styles.tags}>{situation.tags.map((tag) => <span key={tag}>{tag === "pest" ? state.care ? "Ravageur suivi dans le panneau de santé" : state.revealedPest ? `Ravageur : ${PEST_LABELS[state.revealedPest]}` : "Ravageur non identifié" : SITUATION_TAG_LABELS[tag] ?? tag}</span>)}</div>
          </div>
          <div className={styles.target}><small>Réussites requises</small><strong>{getKqStageTarget(state)}</strong></div>
        </div>

        <div className={styles.diceBoard} aria-label="Décision du tour" data-culture-decision data-phase={state.phase} tabIndex={-1}>
          <span className={styles.buddyName}>{state.campaign ? state.campaign.members.length === 1 ? "1 culture" : `${state.campaign.members.length} cultures réunies` : "Buddie cultivé"}</span>
          <h2>{state.campaign ? "Un lancer pour tous" : state.varietyName}</h2>
          {state.powerOutage ? <div className={styles.outageAlert}><Zap /><span><strong>Coupure de courant</strong><small>Le meilleur dé deviendra un Danger pendant cette étape.</small></span></div> : null}
          <div className={styles.pressureMeter} role="meter" aria-label={`Pression ${state.pressure} sur 4`} aria-valuemin={0} aria-valuemax={4} aria-valuenow={state.pressure}>
            <span>{[1, 2, 3, 4].map((level) => <i key={level} data-filled={level <= state.pressure || undefined} data-danger={level >= 3 || undefined} />)}</span>
            <small>{getKqPressureHint(state)}</small>
          </div>
          <div className={styles.diceTray} data-phase={state.phase} data-motion-phase={diceMotionPhase} data-rolling={rolling || undefined} data-result={state.phase === "rolled" || undefined} data-direct-result={directDiceResult || undefined} data-physics={physicsDiceActive || undefined}>
            {!directDiceResult ? <KqPhysicsDice ref={physicsDiceRef} /> : null}
            {diceMotionPhase !== "idle" ? <span className={styles.diceMotionStatus} role="status" aria-live="polite"><i aria-hidden="true" /><small>{diceMotionPhase === "preparing" ? "Préparation du lancer" : diceMotionPhase === "rolling" ? "Lancer physique" : diceMotionPhase === "settling" ? "Derniers rebonds" : "Lecture du résultat"}</small></span> : null}
            <div className={styles.dice} role="status" aria-live="polite" aria-label={state.dice ? `Résultat des dés : ${state.dice[0]}, ${state.dice[1]} et ${state.dice[2]}${state.bonusDie ? `. Quatrième dé ${state.bonusDie} écarté` : ""}` : "Les dés n’ont pas encore été lancés"}>
              <GameDie value={state.dice?.[0]} index={0} rolling={rolling} validated={state.phase === "resolved"} />
              <GameDie value={state.dice?.[1]} index={1} rolling={rolling} validated={state.phase === "resolved"} />
              <GameDie value={state.dice?.[2]} index={2} rolling={rolling} validated={state.phase === "resolved"} />
            </div>
            {state.bonusDie && !physicsDiceActive ? <span className={styles.discardedDie}><GameDie value={state.bonusDie} index={3} validated={state.phase === "resolved"} /><small>4e dé · écarté</small></span> : null}
          </div>
          <div className={styles.diceLegend} aria-label="Légende des faces de dés">
            <span data-kind="danger"><b>1</b> Danger</span>
            <span data-kind="neutral"><b>2–3</b> Neutre</span>
            <span data-kind="success"><b>4–5</b> Réussite</span>
            <span data-kind="spark"><b>6</b> Étincelle</span>
          </div>
          {state.phase === "rolled" && preview ? (
            <div className={styles.rollResult} data-culture-result tabIndex={-1} aria-live="polite">
              <span>Réussites</span><strong>{preview.total}/{preview.target}</strong><small>{preview.dangers} Danger · {preview.sparks} Étincelle</small>
              {turnPreview ? <KqTurnPreview preview={turnPreview} /> : null}
              {!state.care && preview.total === 0 && turnPreview?.outcome !== "success" && turnPreview?.outcome !== "critical" ? <p className={styles.cultureDeathWarning}>{tutorial ? "Cette étape restera ratée. L’essai assistera un dé si nécessaire aux étapes suivantes pour permettre la récolte fictive." : zeroSuccessStages > 0
                ? firstCultureRescueAvailable
                  ? `Valider utilisera ton secours gratuit : la culture continuera, sans changer le résultat de cette étape.${cardChoices.playableCount > 0 ? " Tu peux encore jouer une réaction pour conserver ce secours." : ""}`
                  : `Valider ce résultat à 0 réussite mettra fin à ta culture.${cardChoices.playableCount > 0 ? " Tu peux encore tenter de la sauver avec une carte de réaction." : ""}`
                : firstCultureRescueAvailable
                  ? "Ce zéro restera une étape ratée. Ton secours sera gardé pour un éventuel deuxième résultat à zéro."
                  : "Valider ce résultat comptera comme une étape à 0 réussite. Une deuxième étape à 0 entraînera la mort de ta culture sans récolte."}</p> : null}
              <p>{cardChoices.playableCount > 0 ? `${cardChoices.label} avant de valider. Leur effet est indiqué dans ta main.` : "Aucune carte de réaction ne peut être jouée maintenant."}</p>
            </div>
          ) : null}
          {state.phase === "resolved" && outcomeArtwork && outcomeArtwork.outcome !== "dead" ? (
            <div className={styles.outcome} data-culture-result tabIndex={-1} data-outcome={outcomeArtwork.outcome} data-outcome-stage={outcomeArtwork.stage} role="status" aria-live="polite">
              <span key={outcomeArtwork.src} className={styles.outcomeReaction}>
                <Image
                  src={outcomeArtwork.src}
                  alt={outcomeArtwork.alt}
                  fill
                  sizes="(max-width: 760px) 110px, 220px"
                />
              </span>
              {state.history.at(-1)?.dice.every(face => face === 6) ? <div className={styles.tripleSpark} role="status"><Sparkles size={22} /><div><strong>Triple étincelle !</strong><span>Trois 6 conservés. Termine la culture pour avancer dans ce succès.</span></div></div> : null}
                <h3>{KQ_OUTCOME_LABELS[outcomeArtwork.outcome]}</h3><strong>{lastStageReward?.trait ?? state.traits.at(-1)}</strong>{(lastStageReward?.combos?.length ?? 0) > 0 ? <small className={styles.comboNotice}><Sparkles aria-hidden="true" /> {lastStageReward?.combos?.join(" · ")}</small> : null}{outcomeArtwork.outcome === "critical" ? <small className={styles.pressureRelief}>Pression −1 · la culture reprend son souffle</small> : null}
              {lastStageReward ? <div className={styles.stageRewardReceipt} aria-label="Gains de l’étape"><span data-negative={(lastStageReward.qualityDelta ?? 0) < 0 || undefined}><Star aria-hidden="true" /><strong>{(lastStageReward.qualityDelta ?? 0) > 0 ? "+" : ""}{lastStageReward.qualityDelta ?? 0}</strong><small>Qualité</small></span><span><Zap aria-hidden="true" /><strong>+{lastStageReward.xpGain ?? 0}</strong><small>XP gagnés</small></span><span><Scale aria-hidden="true" /><strong>{displayedHarvestGrams.toLocaleString("fr-FR")} g</strong><small>Lot projeté</small></span>{(lastStageReward.harvestLossPercent ?? 0) > 0 ? <span data-negative><Flame aria-hidden="true" /><strong>−{lastStageReward.harvestLossPercent} %</strong><small>Récolte volée</small></span> : null}</div> : null}
              <p>Réserve disponible : {state.xp} XP.</p>
              {lastStageReward?.rescued ? <p className={styles.rescueReceipt} data-culture-rescue-receipt><strong>Ton secours a permis de continuer.</strong> Le résultat et les gains de cette étape restent inchangés. Le secours de première culture est maintenant utilisé.</p> : null}
            </div>
          ) : null}
          <div className={styles.turnActions} data-culture-actionbar data-suspended={Boolean(pendingBurnCode) || undefined}>
            {state.phase !== "resolved" ? <button type="button" className={styles.turnOptionsLink} onClick={() => focusTurnElement("[data-culture-options]")}>Voir mes possibilités{cardChoices.playableCount > 0 ? ` · ${cardChoices.playableCount} carte${cardChoices.playableCount > 1 ? "s" : ""}` : ""}</button> : null}
            <small className={styles.turnActionContext} data-warning={state.phase === "rolled" && (turnPreview?.dead || turnPreview?.rescued || preview?.total === 0) || undefined}>{actionContext}</small>
            <button type="button" className={state.phase === "prepare" ? styles.rollButton : styles.primaryButton}
              data-culture-primary-action data-action={primaryAction}
              disabled={Boolean(pendingBurnCode) || (remoteAction !== null || careBusy) || rolling || diceVisualSyncing}
              aria-busy={(remoteAction !== null || careBusy) || rolling || diceVisualSyncing}
              onClick={() => void performTurnAction()}>
              {state.phase === "prepare" ? <Dices aria-hidden="true" /> : null}
              {rolling ? "Les dés roulent…" : diceVisualSyncing ? "Mise à jour des dés…" : (remoteAction !== null || careBusy) ? "Confirmation…"
                : state.phase === "prepare" ? "Lancer les dés" : state.phase === "rolled" ? "Valider le résultat"
                  : state.stageIndex === KQ_STAGES.length - 1 ? "Révéler la Récolte" : "Étape suivante"}
            </button>
          </div>
          <section className={styles.turnOptions} data-culture-options tabIndex={-1} aria-label="Tes possibilités pour cette étape">
            <header><strong>{state.phase === "resolved" ? "Pour la suite" : state.phase === "rolled" ? "Avant de valider" : "Avant de lancer"}</strong><small>{state.phase === "resolved" ? "Retrouve ta santé et les cartes conservées." : "Les cartes et les soins sont facultatifs."}</small></header>
            <KqCultureCarePanel compact state={state} request={remoteRequest} storage={careStorage} runId={remoteRunId} disabled={careBusy || remoteAction !== null || rolling || diceVisualSyncing || Boolean(pendingBurnCode)} onStateChange={setState} onBusyChange={setCareBusy} />
          {activeHeritage && activeHeritage.timing === "once-per-run" && (heritagePermission.allowed || state.heritageArmed) ? (
            <aside className={styles.heritageInPlay} data-used={state.heritageUsed || undefined} data-armed={state.heritageArmed || undefined} aria-label={`Héritage équipé : ${activeHeritage.name}`}>
              <CardArtwork code={activeHeritage.code} name={activeHeritage.name} producerName={activeHeritage.producerName} imageUrl={activeHeritage.imageUrl} />
              <div>
                <span>Héritage équipé · ne brûle pas</span>
                <strong>{activeHeritage.name}</strong>
                <p>{activeHeritage.description}</p>
              </div>
              <footer>
                <small>{state.heritageArmed ? "Pouvoir armé" : "Pouvoir disponible"}</small>
                <button type="button" disabled={!heritagePermission.allowed || (remoteAction !== null || careBusy)} onClick={() => void applyGameAction("heritage")}>
                  {state.heritageArmed ? "Pouvoir armé" : remoteAction === "game" ? "Activation…" : "Activer le pouvoir"}
                </button>
              </footer>
            </aside>
          ) : activeHeritage ? (
            <details className={styles.heritageSummary}>
              <summary><span>{activeHeritage.name}</span><small>Héritage · {state.heritageUsed ? "pouvoir utilisé" : activeHeritage.timing === "passive" ? "passif actif" : "en attente"}</small></summary>
              <div><CardArtwork code={activeHeritage.code} name={activeHeritage.name} producerName={activeHeritage.producerName} imageUrl={activeHeritage.imageUrl} /><span><strong>Héritage équipé · ne brûle pas</strong><p>{activeHeritage.description}</p>{activeHeritage.timing === "once-per-run" && !state.heritageUsed ? <small>{heritagePermission.reason}</small> : null}</span></div>
            </details>
          ) : null}
          <details className={styles.handDetails} data-culture-hand>
            <summary><span>{state.phase === "resolved" ? "Consulter ma main" : state.phase === "rolled" ? "Jouer une réaction" : "Préparer une carte"}</span><small data-playable-card-count={cardChoices.playableCount}>{cardChoices.label}</small></summary>
            <section className={styles.deckPanel}>
              <p className={styles.cardChoiceHint} data-card-choice-hint>{cardChoices.explanation}</p>
              <header><div><h2>Ta main</h2></div><p data-hand-capacity>{handCodes.length} / {KQ_HAND_SIZE} copie{handCodes.length > 1 ? "s" : ""} distribuée{handCodes.length > 1 ? "s" : ""} · {Math.max(0, supportDeckSize - burnedSupportCount)} copie{Math.max(0, supportDeckSize - burnedSupportCount) > 1 ? "s" : ""} non brûlée{Math.max(0, supportDeckSize - burnedSupportCount) > 1 ? "s" : ""}.</p></header>
              <p className={styles.handTurnLimit}>Par étape : 1 préparation avant les dés, puis 1 réaction après, au maximum.</p>
              <nav className={styles.handFilters} aria-label="Afficher les cartes de la main">
                <button type="button" data-hand-filter="playable" aria-pressed={handFilter === "playable"} disabled={cardChoices.playableCount === 0} onClick={() => setHandFilterChoice({ scope: handFilterScope, value: "playable" })}>Jouables <b>{cardChoices.playableCount}</b></button>
                <button type="button" data-hand-filter="all" aria-pressed={handFilter === "all"} onClick={() => setHandFilterChoice({ scope: handFilterScope, value: "all" })}>Toutes <b>{availableCards.length}</b></button>
              </nav>
              <p className={styles.handFilterHint}>Chaque carte apparaît une fois ; « Main ×2 » indique deux copies.</p>
              {displayedCards.length > 1 ? <p className={styles.handScrollHint}>Fais défiler les cartes · au clavier : ← →.</p> : null}
              <div key={`${handFilterScope}:${handFilter}`} className={styles.cardRow} data-culture-hand-cards role="region" aria-label="Cartes de ta main" aria-keyshortcuts="ArrowLeft ArrowRight" tabIndex={0}
                onKeyDown={event => {
                  if (event.target !== event.currentTarget || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
                  event.preventDefault();
                  event.currentTarget.scrollBy({ left: (event.key === "ArrowRight" ? 1 : -1) * event.currentTarget.clientWidth * .85, behavior: "auto" });
                }}>{displayedCards.map((card) => { const usedCopies = state.usedCards.filter((code) => code === card.code).length; const deckCopies = card.category === "pbi" ? 0 : Math.max(0, state.deckCodes.filter((code) => code === card.code).length - usedCopies); return <SupportCard key={card.code} card={card} state={state} copies={activeInventory[card.code] ?? 0} handCopies={card.category === "pbi" ? 0 : handCodes.filter((code) => code === card.code).length} deckCopies={deckCopies} onPlay={setPendingBurnCode} compact />; })}</div>
              <details className={styles.handGuide}><summary>Rôle des cartes</summary><KqCardRoleLegend /></details>
              <div className={styles.handActions}><span data-hand-redraw-reason>{redrawPermission.remaining} changement{redrawPermission.remaining > 1 ? "s" : ""} restant{redrawPermission.remaining > 1 ? "s" : ""}. {redrawPermission.reason}</span><button type="button" data-hand-redraw disabled={!redrawPermission.allowed || remoteAction !== null || careBusy || rolling || diceVisualSyncing} onClick={() => void applyGameAction("redraw")}><RotateCcw /> Changer ma main</button></div>
              {(state.heritageReserveCodes?.length ?? 0) > 0 ? (
                <section className={styles.heritageHandExchange}>
                  <header><Sparkles /><span><strong>Main prévoyante · {handCodes.length + (state.heritageReserveCodes?.length ?? 0)} cartes vues</strong><small>Choisis une carte de ta main, puis une carte de réserve à faire entrer. Tu peux recommencer avant le lancer.</small></span></header>
                  <nav className={styles.heritageExchangeTabs} aria-label="Main prévoyante">
                    <button type="button" data-active={heritageExchangeTab === "hand" || undefined} aria-pressed={heritageExchangeTab === "hand"} onClick={() => setHeritageExchangeTab("hand")}>Ma main <small>{handCodes.length} cartes</small></button>
                    <button type="button" data-active={heritageExchangeTab === "reserve" || undefined} aria-pressed={heritageExchangeTab === "reserve"} onClick={() => setHeritageExchangeTab("reserve")}>Ma réserve <small>{state.heritageReserveCodes?.length ?? 0} cartes</small></button>
                  </nav>
                  <div className={styles.heritageExchangePanels}>
                    <div data-active={heritageExchangeTab === "hand" || undefined}><b>Choisis la carte à sortir</b>{handCodes.map((code, index) => <button key={`${code}-${index}`} type="button" disabled={(remoteAction !== null || careBusy)} data-selected={heritageSwapOutIndex === index || undefined} onClick={() => { setHeritageSwapOutIndex(index); setHeritageExchangeTab("reserve"); }}>{KQ_CARDS.find((card) => card.code === code)?.name ?? code}</button>)}</div>
                    <div data-active={heritageExchangeTab === "reserve" || undefined}><b>Choisis la carte à faire entrer</b>{state.heritageReserveCodes?.map((code, index) => <button key={`${code}-${index}`} type="button" disabled={heritageSwapOutIndex === null || (remoteAction !== null || careBusy)} onClick={() => void swapHeritageCard(index)}>{KQ_CARDS.find((card) => card.code === code)?.name ?? code}<small>{remoteAction === "game" ? "Confirmation…" : heritageSwapOutIndex === null ? "Choisis d’abord une carte à sortir" : "Faire entrer"}</small></button>)}</div>
                  </div>
                </section>
              ) : null}
              {state.care ? null : state.revealedPest ? <div className={styles.pestReveal}><strong>🔎 {PEST_LABELS[state.revealedPest]} révélés</strong><span>{availableCards.filter((card) => card.category === "pbi").length} auxiliaire(s) compatible(s) de ta collection affiché(s).</span></div> : situation.pest ? <div className={styles.pestHidden}><strong>Ravageur inconnu</strong><span>Joue la Loupe d’inspection avant les dés pour ouvrir la réserve PBI.</span></div> : null}
              <div className={styles.substrate} data-tone={cultureSystemStatus?.tone}><Sparkles /><span><small>Culture indoor</small><strong>{activeSubstrate.name}</strong><em>{cultureSystemStatus?.detail ?? activeSubstrate.description}</em></span>{cultureSystemStatus ? <b className={styles.cultureSystemStatus}>{cultureSystemStatus.label}</b> : null}</div>
            </section>
          </details>
          {(state.effectNotices?.length ?? 0) > 0 ? <div className={styles.effectNotices} role="status" aria-live="polite" aria-atomic="true"><strong><Sparkles /> Résultat des effets</strong>{state.effectNotices?.map((notice, index) => { const kind = getKqEffectNoticeKind(notice); return <p key={`${notice}-${index}`} data-kind={kind}>{kind === "applied" ? "✓" : "○"} {notice}</p>; })}</div> : null}
          </section>

        </div>
      </section>

      <section className={styles.cultureDetails} aria-label="Détails de la culture">
        {state.campaign && <details className={styles.cultureDisclosure} data-campaign-progress><summary><span>{state.campaign.members.length === 1 ? "Ma culture" : `Mes ${state.campaign.members.length} cultures`}</span><small>Rendement · cannabinoïdes · terpènes</small></summary><KqCampaignSummary state={state} /></details>}
        <details className={styles.cultureDisclosure} hidden={!!state.campaign}>
          <summary><span>Projection de la récolte</span><small>{displayedHarvestGrams.toLocaleString("fr-FR")} g estimés · {runProjection.tier}</small></summary>
          <section className={styles.runProjection} aria-label="Projection de la récolte">
            <header><span>Trajectoire actuelle</span><small>Recalculée après chaque étape</small></header>
            <div>
              <article><Star aria-hidden="true" /><span><strong>{runProjection.projectedQuality}</strong><small>Qualité projetée{runProjection.equipmentQualityBonus > 0 ? ` · +${runProjection.equipmentQualityBonus} matériel` : ""}</small></span></article>
              <article><Trophy aria-hidden="true" /><span><strong>{runProjection.tier}</strong><small>Palier actuel</small></span></article>
              <article><Scale aria-hidden="true" /><span><strong>{displayedHarvestGrams.toLocaleString("fr-FR")} g</strong><small>Total estimé · {state.warehouse ? `${state.warehouse.activeAreaM2} m²` : `${getKqProductionUnits(state.equipment?.productionUnits)} tente${getKqProductionUnits(state.equipment?.productionUnits)>1?"s":""}`}{runProjection.harvestLossPercent > 0 ? " · après pertes" : ""}</small></span></article>
              <article><Sparkles aria-hidden="true" /><span><strong>{runProjection.remainingStages}</strong><small>Étape{runProjection.remainingStages > 1 ? "s" : ""} encore ouverte{runProjection.remainingStages > 1 ? "s" : ""}</small></span></article>
            </div>
            <p><KqHarvestTierProgress projection={runProjection} /></p>
            {getKqProductionUnits(state.equipment?.productionUnits) > 1 || runProjection.harvestLossPercent > 0 ? <details className={styles.tentHarvestDetails}><summary>{state.warehouse ? "Voir le calcul de la récolte et les pertes" : "Voir le détail par tente et les pertes"}</summary><HarvestYieldBreakdown state={state} /></details> : null}
            {plannedMarketRoute ? <aside className={styles.runRouteTarget}><Target aria-hidden="true" /><span><small>Cap commercial épinglé</small><strong>{plannedMarketRoute.name} · jury ≥ {plannedMarketRoute.minimumJuryScore.toFixed(1)}/10</strong><em>La Qualité de culture prépare la Fleur ; seul le verdict officiel donnera la note commerciale.</em></span></aside> : null}
            <p>Projection non garantie : seuls les résultats déjà validés et le matériel installé sont comptés.</p>
          </section>
        </details>
        <details className={styles.cultureDisclosure}>
          <summary><span>Barème des fleurs</span><small>Les paliers de cette culture</small></summary>
          <ul className={styles.cultureHistory}>
            {(state.harvestTierVersion === 2 ? KQ_HARVEST_TIERS_V2 : KQ_HARVEST_TIERS_LEGACY).map(tier => <li key={tier.name}><strong>{tier.name}</strong><b>Dès {tier.minimumQuality} points</b></li>)}
          </ul>
          <div className={styles.cultureHelp}>
            {state.harvestTierVersion === 2 ? <p>Fleur légendaire : au moins {KQ_LEGENDARY_REQUIREMENTS.minimumQuality} points de Qualité et {KQ_LEGENDARY_REQUIREMENTS.minimumSuccessfulStages} étapes réussies, dont {KQ_LEGENDARY_REQUIREMENTS.minimumCriticalStages} critiques.</p> : <p>Cette culture conserve son barème d’origine.</p>}
            <p>La Qualité de culture est distincte de la note du jury et de la qualité commerciale sur 10.</p>
          </div>
        </details>
        <details className={styles.cultureDisclosure}>
          <summary><span>Défis du jour</span><small>{runChallenges.filter((challenge) => getKqChallengeProgress(state, challenge.code).reached).length}/{runChallenges.length} atteints</small></summary>
          <section className={styles.liveChallenges} aria-label="Progression des défis du jour">
            {runChallenges.map((challenge) => { const progress = getKqChallengeProgress(state, challenge.code); const claimed = claimedChallengeCodes.includes(challenge.claimKey); return <article key={challenge.claimKey} data-reached={progress.reached || undefined} data-claimed={claimed || undefined}><Star /><div><strong>{challenge.title}</strong><small>{claimed ? "Déjà gagné aujourd’hui" : progress.label}</small></div></article>; })}
          </section>
        </details>
        <details className={styles.cultureDisclosure}>
          <summary><span>Historique et cartes brûlées</span><small>{state.history.length} étape{state.history.length > 1 ? "s" : ""} validée{state.history.length > 1 ? "s" : ""}</small></summary>
          {state.history.length > 0 ? <ol className={styles.cultureHistory}>{state.history.map((entry, index) => <li key={entry.stage}><span><strong>{index + 1}. {getKqStageDisplayName(entry.stage)} · {KQ_OUTCOME_LABELS[entry.outcome]}{entry.rescued ? " · secours utilisé" : ""}</strong><small>{entry.situation} · dés {entry.dice.join("–")}</small></span><b>{entry.qualityDelta === undefined ? "Ancien reçu" : `${entry.qualityDelta > 0 ? "+" : ""}${entry.qualityDelta} qualité · +${entry.xpGain ?? 0} XP`}</b></li>)}</ol> : <p className={styles.cultureHelp}>Aucune étape validée pour le moment.</p>}
          <div className={styles.ashes}><Flame /><span><small>Cendres de cette culture · {state.usedCards.length} copie{state.usedCards.length === 1 ? "" : "s"} brûlée{state.usedCards.length === 1 ? "" : "s"}</small><div>{state.usedCards.map((code, index) => <b key={`${code}-${index}`}>{KQ_CARDS.find((card) => card.code === code)?.name ?? code}</b>)}</div></span></div>
        </details>
        <details className={styles.cultureDisclosure}>
          <summary><span>Règles et animation des dés</span></summary>
          <div className={styles.cultureHelp}><p>{state.care ? "La vitalité suit les opérations et les problèmes observés. À 0 avant récolte, la culture meurt sans récolte. La première culture dispose d’un secours unique. Observer est gratuit ; les intrants et auxiliaires se gèrent dans le panneau de santé." : "Deux étapes validées à 0 réussite entraînent la mort de cette culture historique. La première culture dispose d’un secours automatique unique."}</p><p>À partir de 3 Pression, la cible augmente d’une réussite, dans la limite de 3. Un lancer parfait retire 1 Pression.</p><p>Tu peux jouer une carte avant le lancer, ou une carte de réaction avant de valider, selon son effet. Jouer une carte Botte du Chanvrier brûle une copie de ton album ; la confirmation affiche son coût, son avantage et son risque.</p>
          <button
            type="button"
            className={styles.directResultToggle}
            role="switch"
            aria-checked={directDiceResult}
            onClick={toggleDirectDiceResult}
          >
            <span aria-hidden="true"><i /></span>
            <b>Résultat direct</b>
            <small>Ignorer l’animation du lancer</small>
          </button>
          </div>
        </details>
      </section>

      {pendingBurnCode ? (() => {
        const card = KQ_CARDS.find((item) => item.code === pendingBurnCode);
        if (!card) return null;
        const tradeoff = getKqCardTradeoff(card);
        const permission = getKqPlayerCardPermission(state, card, activeInventory[card.code] ?? 0);
        const busy = remoteAction !== null || careBusy || rolling || diceVisualSyncing;
        const blockedReason = !permission.allowed ? permission.reason : busy ? "Attends la fin de l’action en cours pour jouer cette carte." : null;
        const cardPreview = !busy ? getKqCardPlayPreview(state, card, activeInventory[card.code] ?? 0) : null;
        let teachingAssistance = false;
        if (tutorial && cardPreview?.kind === "deterministic") {
          const played = playKqCard(state, card.code);
          const assisted = assistKqPlayableLesson(played);
          teachingAssistance = assisted.care?.vitality !== played.care?.vitality || assisted.dice?.join() !== played.dice?.join();
        }
        return <AppDialog open onClose={closeCardInspection} title="Consulter une carte" labelledBy="burn-confirm-title" className={styles.verdictDialog} bodyClassName={styles.burnConfirm}>
          <Flame /><span>{permission.allowed ? "Jouer une carte" : "Carte conservée"}</span>
          <h2 id="burn-confirm-title">{permission.allowed ? `Brûler ${card.name} ?` : card.name}</h2>
          {blockedReason ? <p className={styles.cardBlockedReason} id="card-blocked-reason" data-card-blocked-reason role="status">{blockedReason}</p> : null}
          <p>Jouer cette carte détruit une copie de ton album. Copies disponibles : {activeInventory[card.code] ?? 0}.</p>
          <p data-culture-card-cost><strong>Coût : {card.xpCost} XP de culture.</strong><br />Tu disposes de {state.xp} XP.</p>
          {teachingAssistance ? <p data-card-teaching-assistance>Dans cet essai, un secours accompagne les situations critiques.</p> : cardPreview ? <KqCardPlayPreview preview={cardPreview} /> : null}
          <div className={styles.tradeoff}><p><b>Avantage</b>{tradeoff.benefit}</p><p><b>Risque</b>{tradeoff.risk}</p></div>
          <details className={styles.cardDialogRules}><summary>Règles et situations adaptées</summary><CardEffectGuide card={card} /></details>
          {remoteNotice ? <small className={styles.modalNotice}>{remoteNotice}</small> : null}
          <div><button type="button" onClick={closeCardInspection}>{blockedReason ? "Fermer" : "Annuler"}</button><button type="button" className={styles.burnButton} disabled={Boolean(blockedReason)} aria-describedby={blockedReason ? "card-blocked-reason" : undefined} data-culture-confirm-card onClick={() => void playAndBurnCard(card.code)}><Flame /> {remoteAction === "card" ? "Confirmation…" : "Brûler et jouer"}</button></div>
        </AppDialog>;
      })() : null}

      {gameActionError ? (
        <div className={styles.gameActionError} role="alert">
          <p>{gameActionError}</p>
          <button type="button" disabled={(remoteAction !== null || careBusy) || rolling} onClick={() => {
            setGameActionError("");
            setCollectionRefreshNonce((value) => value + 1);
          }}>Actualiser la culture</button>
        </div>
      ) : null}
    </main>
  );
}
