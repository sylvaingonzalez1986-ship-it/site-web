"use client";

import Image from "next/image";
import Link from "next/link";
import { Dices, Flame, Gift, PackageOpen, RotateCcw, ShoppingBag, Sparkles, Star, Swords, Trophy, X, Zap } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  advanceKqStage,
  activateKqHeritage,
  canActivateKqHeritage,
  canPlayKqCard,
  getKqHandCodes,
  getKqEffectNoticeKind,
  getKqHarvestTier,
  getKqVisibleActionCards,
  getKqCardTradeoff,
  getKqSituation,
  KQ_BUDDIES,
  KQ_CARDS,
  KQ_COLLECTIONS,
  KQ_STAGES,
  playKqCard,
  previewKqResolution,
  redrawKqHand,
  resolveKqStage,
  rollKqDice,
  startKqGame,
  swapKqHeritageHandCard,
  type KqGameState,
  type KqOutcome,
  type KqSupportCard,
} from "@/lib/kanab-quest-game";
import { createKqFlower, createKqOpponent, getKqJuryProgram, lockKqBattle, resolveKqBattle, type KqBattle } from "@/lib/kanab-quest-battle";
import { addKqBoosterToInventory, applyKqArenaStreakReward, openKqSupportBooster } from "@/lib/kanab-quest-booster";
import { claimKqChallenges, evaluateKqChallenges, getKqChallengeProgress, getKqDailyChallenges, getKqGameChallengeDate } from "@/lib/kanab-quest-challenges";
import { buildKqCollectionDeck, buildKqRecommendedDeck, getKqCardChallengeFit, getKqDeckCoverage, getKqOpeningHandChance, sanitizeKqDeckSelection, summarizeKqCardEconomy } from "@/lib/kanab-quest-economy";
import { applyKqBattleToRanking, createKqRankProfile, getKqLeague, getKqLocalLeaderboard, getKqMatchmaking, getKqRatingStake, type KqRankProfile } from "@/lib/kanab-quest-ranking";
import { createLocalKqRepository, type KqBurnReceipt, type KqFavoriteDeck, type KqRepository } from "@/lib/kanab-quest-repository";
import { KQ_HERITAGE_CARDS } from "@/lib/kanab-quest-heritage";
import { getKqCardArtwork } from "@/lib/kanab-quest-artwork";
import { getKqFeedbackTone } from "@/lib/kanab-quest-feedback";
import { applyKqRemoteAction, createKqScopedRequest, finalizeKqRemoteBattle, finalizeKqRemoteBotBattle, getKqRemoteActiveRun, getKqRemoteBattles, getKqRemoteFlowerRivals, getKqRemoteFlowers, lockKqRemoteBattle, playKqRemoteCard, startKqRemoteRun, swapKqRemoteHeritageCard, type KqApiBurnReceipt, type KqApiScope, type KqFlowerRival, type KqOfficialBattle, type KqOfficialFlower } from "@/lib/kanab-quest-api";
import { KqPhysicsDice, type KqDiceMotionPhase, type KqPhysicsDiceHandle } from "./KqPhysicsDice";
import styles from "./KanabQuestDicePrototype.module.css";

const LOCAL_COLLECTION_CODES = KQ_CARDS.map((card) => card.code);
const DEFAULT_LOCAL_INVENTORY = Object.fromEntries(KQ_CARDS.map((card) => [card.code, 3]));
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
  rating: number;
  seasonPoints: number;
  wins: number;
  losses: number;
  streak: number;
  league: string;
  leagueProgress: number;
  pointsToNextLeague: number;
  arenaExperience: number;
};
type OfficialLeaderboardEntry = {
  rank: number;
  pseudo: string;
  rating: number;
  seasonPoints: number;
  wins: number;
  losses: number;
  streak: number;
};
type BotBattleResult = {
  battleId: string;
  winner: "player" | "opponent";
  burnedAt: string;
  experienceAwarded: number;
  todayCount: number;
  dailyLimit: number;
  opponentName: string;
  varietyName: string;
  rounds: KqOfficialBattle["rounds"];
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
  winner: "player" | "opponent";
  burnedAt: string;
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
  warnings?: string[];
  activeRun?: Awaited<ReturnType<typeof getKqRemoteActiveRun>>["activeRun"];
  flowers?: KqOfficialFlower[];
  battles?: KqOfficialBattle[];
  progress?: OfficialRankProgress | null;
};

const CATEGORY_LABELS: Record<KqSupportCard["category"], string> = {
  substrate: "Substrat", pbi: "Auxiliaire PBI", equipment: "Équipement", "know-how": "Savoir-faire", luck: "Coup de chance",
};

const OUTCOME_COPY: Record<KqOutcome, { title: string; artAlt: string; artSrc: string }> = {
  critical: {
    title: "Réussite exceptionnelle !",
    artAlt: "Sylvain célèbre une réussite exceptionnelle devant une plante luxuriante",
    artSrc: "/app/kanab-quest/reactions/sylvain-outcome-critical-v2.webp",
  },
  success: {
    title: "Étape remportée !",
    artAlt: "Sylvain lève le pouce après une étape de culture réussie",
    artSrc: "/app/kanab-quest/reactions/sylvain-outcome-success-v1.webp",
  },
  fragile: {
    title: "Ça passe de justesse !",
    artAlt: "Sylvain souffle de soulagement après une réussite de justesse",
    artSrc: "/app/kanab-quest/reactions/sylvain-outcome-fragile-v1.webp",
  },
  failure: {
    title: "Complication… mais on continue !",
    artAlt: "Sylvain intervient avec détermination sur une plante affaiblie",
    artSrc: "/app/kanab-quest/reactions/sylvain-outcome-failure-v1.webp",
  },
};

const PEST_LABELS = { aphids: "Pucerons", mites: "Acariens", thrips: "Thrips" } as const;
const COVERAGE_LABELS = { roots: "Racines", water: "Eau", climate: "Climat", pest: "Ravageurs", flower: "Floraison", drying: "Séchage" } as const;
const FLOWER_STAT_LABELS = { appearance: "Apparence", aroma: "Arômes", vigor: "Vigueur", mastery: "Maîtrise", regularity: "Régularité" } as const;
type FlowerStatKey = keyof typeof FLOWER_STAT_LABELS;
type FlowerTcgStatus = KqOfficialFlower["status"] | "new";

const FLOWER_TCG_STATUS_COPY: Record<FlowerTcgStatus, { label: string; note: string }> = {
  new: { label: "Nouvelle Fleur", note: "Usage unique · brûlée après son duel" },
  available: { label: "Prête à jouer", note: "Usage unique · brûlée après son duel" },
  locked: { label: "Duel engagé", note: "Verrouillée · burn au verdict" },
  burned: { label: "Brûlée", note: "Carte consommée définitivement" },
};

function FlowerTcgCard({
  varietyName,
  varietyCode,
  tier,
  quality,
  stats,
  imageUrl,
  reference,
  status = "available",
  selected = false,
}: {
  varietyName: string;
  varietyCode?: string;
  tier: string;
  quality: number;
  stats: Record<string, number>;
  imageUrl?: string;
  reference: string;
  status?: FlowerTcgStatus;
  selected?: boolean;
}) {
  const buddie = KQ_BUDDIES.find((item) => item.code === varietyCode || item.name === varietyName);
  const statusCopy = FLOWER_TCG_STATUS_COPY[status];
  const statKeys = Object.keys(FLOWER_STAT_LABELS) as FlowerStatKey[];

  return (
    <article
      className={styles.flowerTcgCard}
      data-status={status}
      data-selected={selected || undefined}
      aria-label={`Carte Fleur ${varietyName}, qualité ${quality}, ${statusCopy.label}`}
    >
      <header className={styles.flowerTcgHeader}>
        <span>Kanab Quest · Carte Fleur</span>
        <em>#{String(buddie?.cardNumber ?? 0).padStart(3, "0")}</em>
      </header>
      <div className={styles.flowerTcgArtwork}>
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={`Illustration du Buddie ${varietyName}`}
            fill
            sizes="(max-width: 700px) 82vw, 310px"
          />
        ) : (
          <span className={styles.flowerTcgArtworkFallback} aria-hidden="true">
            {varietyName.slice(0, 1)}
          </span>
        )}
        <span className={styles.flowerTcgTier}>{tier}</span>
        <span className={styles.flowerTcgQuality}><strong>{quality}</strong><small>Qualité</small></span>
      </div>
      <div className={styles.flowerTcgIdentity}>
        <span>{buddie?.rarity ?? "Fleur officielle"}</span>
        <h3>{varietyName}</h3>
        <small>{reference}</small>
      </div>
      <dl className={styles.flowerTcgStats}>
        {statKeys.map((stat) => (
          <div key={stat}>
            <dt>{FLOWER_STAT_LABELS[stat]}</dt>
            <dd>{stats[stat] ?? 0}</dd>
          </div>
        ))}
      </dl>
      <footer className={styles.flowerTcgFooter}>
        <span><Flame /> {statusCopy.label}</span>
        <small>{statusCopy.note}</small>
      </footer>
    </article>
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
    alt: "Sylvain contrôle le séchage et l’affinage de sa récolte",
  },
};
const dieKind = (value: number | undefined) => value === 1 ? "danger" : value === 6 ? "spark" : value && value >= 4 ? "success" : value ? "neutral" : undefined;
const DIE_PIP_POSITIONS: Record<number, readonly number[]> = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};
const DICE_ROLL_DURATION_MS = 1350;
const DIE_SIDES = ["front", "back", "right", "left", "top", "bottom"] as const;

const getDieFaceValues = (value: number | undefined) => {
  if (!value) return [undefined, 6, 3, 4, 2, 5];
  const opposite = 7 - value;
  const remainingPairs = [[1, 6], [2, 5], [3, 4]].filter((pair) => !pair.includes(value));
  return [value, opposite, remainingPairs[0][0], remainingPairs[0][1], remainingPairs[1][0], remainingPairs[1][1]];
};

function GameDie({ value, index, rolling = false, validated = false }: { value: number | undefined; index: number; rolling?: boolean; validated?: boolean }) {
  const rollingFaces = [2, 5, 6] as const;
  const renderedValue = rolling ? rollingFaces[index % rollingFaces.length] : value;
  const faceValues = getDieFaceValues(renderedValue);

  return (
    <span
      className={styles.gameDie}
      data-kind={rolling ? "rolling" : validated ? dieKind(value) : undefined}
      data-die-index={index + 1}
      aria-hidden="true"
    >
      <span className={styles.dieCube}>
        {DIE_SIDES.map((side, faceIndex) => {
          const faceValue = faceValues[faceIndex];
          const pips = faceValue ? DIE_PIP_POSITIONS[faceValue] ?? [] : [];
          return (
            <span key={side} className={styles.dieFace} data-side={side}>
              {pips.length > 0
                ? pips.map((position) => <i key={position} data-position={position} />)
                : <em className={styles.dieQuestion}>?</em>}
              <span className={styles.dieShine} />
            </span>
          );
        })}
      </span>
    </span>
  );
}
const formatKqDate = (value: string | null | undefined) => value ? new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
}).format(new Date(value)) : "date inconnue";
const toLocalReceipt = (receipt: KqApiBurnReceipt, runSeed: number): KqBurnReceipt => ({
  id: receipt.id, cardCode: receipt.cardCode, runSeed, stageIndex: receipt.stageIndex,
  useKind: receipt.useKind, burnedAt: receipt.burnedAt,
});

function CardArtwork({ code, name }: { code: string; name: string }) {
  const src = getKqCardArtwork(code);
  return src ? (
    <span className={styles.cardArtwork}>
      <Image src={src} alt={`Illustration de la carte ${name}`} fill sizes="(max-width: 760px) 190px, 220px" />
    </span>
  ) : null;
}

function SupportCard({ card, state, copies, handCopies, deckCopies, serverValidatedCopy = false, onPlay }: { card: KqSupportCard; state: KqGameState; copies: number; handCopies: number; deckCopies: number; serverValidatedCopy?: boolean; onPlay: (code: string) => void }) {
  const permission = canPlayKqCard(state, card);
  const exhausted = card.category !== "pbi"
    && state.usedCards.filter((code) => code === card.code).length >= state.deckCodes.filter((code) => code === card.code).length;
  const active = state.playedThisStage.includes(card.code);
  const unavailable = copies <= 0 && !serverValidatedCopy;
  return (
    <button
      type="button"
      className={styles.supportCard}
      data-category={card.category}
      data-rarity={card.rarity}
      data-active={active || undefined}
      disabled={!permission.allowed || unavailable}
      onClick={() => onPlay(card.code)}
      aria-label={`${card.name}. ${card.description} ${active ? "Active pour cette étape." : exhausted ? "Toutes les copies du deck ont été brûlées." : permission.reason}`}
    >
      <CardArtwork code={card.code} name={card.name} />
      <span className={styles.cardCost}>{card.xpCost === 0 ? "∞" : card.xpCost}<small>XP</small></span>
      <span className={styles.cardCollection}>{card.category === "pbi" ? `Réserve PBI · album ×${copies}` : `Main ×${handCopies} · deck ×${deckCopies} · album ×${copies}`}</span>
      <strong>{card.name}</strong>
      <em>{CATEGORY_LABELS[card.category]}</em>
      <p>{card.description}</p>
      <small className={styles.cardReason}>{active ? "Active puis brûlée" : exhausted ? "🔥 Copies du deck brûlées" : unavailable ? "Aucune copie restante" : permission.reason}</small>
    </button>
  );
}

export function KanabQuestDicePrototype({
  apiScope = "admin",
  showAdminOperations = true,
  showPackLab = false,
  viewMode = "full",
  onOpenArena,
}: {
  apiScope?: KqApiScope;
  showAdminOperations?: boolean;
  showPackLab?: boolean;
  viewMode?: "full" | "game" | "arena";
  onOpenArena?: () => void;
}) {
  const isPlayerMode = apiScope === "player";
  const remoteRequest = useMemo(() => createKqScopedRequest(apiScope), [apiScope]);
  const sessionStoragePrefix = isPlayerMode ? "kq-player" : "kq-admin";
  const [state, setState] = useState<KqGameState>(() => startKqGame(2026));
  const [hydrated, setHydrated] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [directDiceResult, setDirectDiceResult] = useState(false);
  const [physicsDiceActive, setPhysicsDiceActive] = useState(false);
  const [diceMotionPhase, setDiceMotionPhase] = useState<KqDiceMotionPhase>("idle");
  const [diceVisualSyncing, setDiceVisualSyncing] = useState(false);
  const [battle, setBattle] = useState<KqBattle | null>(null);
  const [battleHistory, setBattleHistory] = useState<KqBattle[]>([]);
  const [burnHistory, setBurnHistory] = useState<KqBurnReceipt[]>([]);
  const [inventory, setInventory] = useState<Record<string, number>>(() => ({ ...DEFAULT_LOCAL_INVENTORY }));
  const [setupOpen, setSetupOpen] = useState(true);
  const [selectedBuddie, setSelectedBuddie] = useState(KQ_BUDDIES[0].code);
  const [selectedSubstrate, setSelectedSubstrate] = useState("BOTTE-001");
  const [selectedCards, setSelectedCards] = useState<string[]>(["BOTTE-003", "BOTTE-004", "BOTTE-005", "BOTTE-006"]);
  const [selectedHeritage, setSelectedHeritage] = useState("");
  const [heritageSwapOutIndex, setHeritageSwapOutIndex] = useState<number | null>(null);
  const [heritageExchangeTab, setHeritageExchangeTab] = useState<"hand" | "reserve">("hand");
  const [rankProfile, setRankProfile] = useState<KqRankProfile>(() => createKqRankProfile());
  const [selectedRivalId, setSelectedRivalId] = useState("rival-maya");
  const [pendingBurnCode, setPendingBurnCode] = useState<string | null>(null);
  const [pendingStart, setPendingStart] = useState(false);
  const [lastBooster, setLastBooster] = useState<KqSupportCard[]>([]);
  const [boosterNonce, setBoosterNonce] = useState(0);
  const [pendingBattleVerdict, setPendingBattleVerdict] = useState(false);
  const rollTimerRef = useRef<number | null>(null);
  const physicsDiceRef = useRef<KqPhysicsDiceHandle | null>(null);
  const verdictTimerRef = useRef<number | null>(null);
  const repositoryRef = useRef<KqRepository | null>(null);
  const remoteInventoryRef = useRef<Record<string, number>>({});
  const skipNextSessionFetchRef = useRef(false);
  const mobileViewportRef = useRef<{ scrollY: number } | null>(null);
  const [revealedRounds, setRevealedRounds] = useState(0);
  const [deckNotice, setDeckNotice] = useState("");
  const [deckFilter, setDeckFilter] = useState<"all" | "equipment" | "know-how" | "luck">("all");
  const [favoriteDeck, setFavoriteDeck] = useState<KqFavoriteDeck | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showCollectionChest, setShowCollectionChest] = useState(false);
  const [chestOpening, setChestOpening] = useState(false);
  const [dailyChallenges, setDailyChallenges] = useState(() => getKqDailyChallenges());
  const [mobilePlayTab, setMobilePlayTab] = useState<"culture" | "hand" | "dice" | "challenges">("culture");
  const [remoteCollection, setRemoteCollection] = useState<RemoteCollectionStatus>({
    loading: true, error: "", ownerFound: false, collectionActive: false, totalCopies: 0, cardCount: 0, cultureTokenBalance: 0,
  });
  const [collectionRefreshNonce, setCollectionRefreshNonce] = useState(0);
  const [remoteInventory, setRemoteInventory] = useState<Record<string, number>>({});
  const [remoteHeritageOwnedCodes, setRemoteHeritageOwnedCodes] = useState<string[]>([]);
  const [remoteHeritageActive, setRemoteHeritageActive] = useState(false);
  const [remoteHeritageFragments, setRemoteHeritageFragments] = useState(0);
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
  const [remoteRunId, setRemoteRunId] = useState<string | null>(null);
  const [persistedFlowerId, setPersistedFlowerId] = useState<string | null>(null);
  const [officialFlowers, setOfficialFlowers] = useState<KqOfficialFlower[]>([]);
  const [matchFlowerId, setMatchFlowerId] = useState<string | null>(null);
  const [flowerRivals, setFlowerRivals] = useState<KqFlowerRival[]>([]);
  const [selectedRemoteRivalId, setSelectedRemoteRivalId] = useState<string | null>(null);
  const [botBattleResult, setBotBattleResult] = useState<BotBattleResult | null>(null);
  const [matchmakingLoading, setMatchmakingLoading] = useState(false);
  const [pendingRemoteBattle, setPendingRemoteBattle] = useState(false);
  const [officialBattles, setOfficialBattles] = useState<KqOfficialBattle[]>([]);
  const [pendingOfficialVerdictId, setPendingOfficialVerdictId] = useState<string | null>(null);
  const [officialBattleResult, setOfficialBattleResult] = useState<OfficialBattleResult | null>(null);
  const [officialChallengeReward, setOfficialChallengeReward] = useState<{ points: number; titles: string[] } | null>(null);
  const [remoteAction, setRemoteAction] = useState<"start" | "card" | "game" | null>(null);
  const [remoteNotice, setRemoteNotice] = useState("");
  const [ownedBuddieCodes, setOwnedBuddieCodes] = useState<string[]>([]);
  const [ownedBuddieArtwork, setOwnedBuddieArtwork] = useState<Record<string, { imageUrl: string; ownedCopies: number }>>({});
  const [officialRankProgress, setOfficialRankProgress] = useState<OfficialRankProgress | null>(null);
  const [officialLeaderboard, setOfficialLeaderboard] = useState<OfficialLeaderboardEntry[]>([]);

  const refreshOfficialRanking = useCallback(async (includeProgress = true) => {
    if (!isPlayerMode) return;
    const [progressResponse, leaderboardResponse] = await Promise.all([
      includeProgress ? fetch("/api/arena/placard/me", { cache: "no-store" }) : null,
      fetch("/api/arena/placard/rankings", { cache: "force-cache" }),
    ]);
    if (progressResponse?.ok) {
      const payload = await progressResponse.json() as { progress?: OfficialRankProgress | null };
      setOfficialRankProgress(payload.progress ?? null);
    }
    if (leaderboardResponse.ok) {
      const payload = await leaderboardResponse.json() as { entries?: OfficialLeaderboardEntry[] };
      setOfficialLeaderboard(payload.entries ?? []);
    }
  }, [isPlayerMode]);

  const applyOfficialSessionPayload = useCallback((payload: PlayerSessionPayload) => {
    const activeRun = payload.activeRun ?? null;
    const flowers = payload.flowers ?? [];
    setOfficialFlowers(flowers);
    setOfficialBattles(payload.battles ?? []);
    setOfficialRankProgress(payload.progress ?? null);
    if (!activeRun) {
      const currentRemoteInventory = remoteInventoryRef.current;
      setRemoteRunId(null);
      if (isPlayerMode) {
        setState(startKqGame(Date.now()));
        setBattle(null);
        setSetupOpen(true);
      }
      window.sessionStorage.removeItem(`${sessionStoragePrefix}-remote-run-id`);
      setSelectedCards((current) => sanitizeKqDeckSelection(current, currentRemoteInventory));
      setSelectedSubstrate((current) => (currentRemoteInventory[current] ?? 0) > 0
        ? current
        : KQ_CARDS.find((card) => card.category === "substrate" && (currentRemoteInventory[card.code] ?? 0) > 0)?.code ?? current);
      setRemoteNotice("");
    } else {
      const receipts = activeRun.burnReceipts.map((receipt) => toLocalReceipt(receipt, activeRun.state.seed));
      setRemoteRunId(activeRun.runId);
      window.sessionStorage.setItem(`${sessionStoragePrefix}-remote-run-id`, activeRun.runId);
      setState(activeRun.state);
      setSelectedBuddie(activeRun.state.varietyCode);
      setSelectedSubstrate(activeRun.state.deckCodes.find((code) => KQ_CARDS.find((card) => card.code === code)?.category === "substrate") ?? "BOTTE-001");
      setSelectedCards(activeRun.state.deckCodes.filter((code) => !["substrate", "pbi"].includes(KQ_CARDS.find((card) => card.code === code)?.category ?? "")));
      setBurnHistory((history) => [...receipts, ...history.filter((entry) => !receipts.some((receipt) => receipt.id === entry.id))].slice(0, 100));
      setSetupOpen(false);
      setRemoteNotice(`Culture officielle reprise · ${receipts.length} reçu${receipts.length > 1 ? "s" : ""} vérifié${receipts.length > 1 ? "s" : ""}.`);
    }
    const matchingFlower = flowers.find((flower) => flower.runId === activeRun?.runId)
      ?? flowers.find((flower) => flower.id === window.sessionStorage.getItem(`${sessionStoragePrefix}-remote-flower-id`));
    if (matchingFlower) {
      setPersistedFlowerId(matchingFlower.id);
      window.sessionStorage.setItem(`${sessionStoragePrefix}-remote-flower-id`, matchingFlower.id);
    }
    if ((payload.warnings?.length ?? 0) > 0) setRemoteNotice(payload.warnings!.join(" · "));
  }, [isPlayerMode, sessionStoragePrefix]);

  useEffect(() => {
    const refreshCollection = () => setCollectionRefreshNonce((value) => value + 1);
    window.addEventListener("kq:collection-updated", refreshCollection);
    return () => window.removeEventListener("kq:collection-updated", refreshCollection);
  }, []);

  useEffect(() => {
    setMobilePlayTab("culture");
  }, [state.stageIndex]);

  useEffect(() => {
    const repository = createLocalKqRepository(window.localStorage);
    repositoryRef.current = repository;
    setRemoteRunId(window.sessionStorage.getItem(`${sessionStoragePrefix}-remote-run-id`));
    setPersistedFlowerId(window.sessionStorage.getItem(`${sessionStoragePrefix}-remote-flower-id`));
    setRemoteBurnsEnabled(isPlayerMode || window.sessionStorage.getItem(`${sessionStoragePrefix}-remote-burns`) === "1");
    setDirectDiceResult(window.localStorage.getItem("kq-dice-direct-result") === "1");
    void repository.loadSession().then((snapshot) => {
      if (!isPlayerMode && snapshot.game) {
        setState(snapshot.game);
        setSelectedBuddie(snapshot.game.varietyCode);
        setSelectedSubstrate(snapshot.game.deckCodes.find((code) => KQ_CARDS.find((card) => card.code === code)?.category === "substrate") ?? "BOTTE-001");
        setSelectedCards(snapshot.game.deckCodes.filter((code) => !["substrate", "pbi"].includes(KQ_CARDS.find((card) => card.code === code)?.category ?? "")));
        setSetupOpen(false);
      }
      if (!isPlayerMode) {
        if (snapshot.battle) setBattle(snapshot.battle);
        setBattleHistory(snapshot.battleHistory);
        setBurnHistory(snapshot.burnHistory);
        if (snapshot.ranking) setRankProfile(snapshot.ranking);
        if (snapshot.inventory) setInventory({ ...DEFAULT_LOCAL_INVENTORY, ...snapshot.inventory });
      }
      setFavoriteDeck(snapshot.favoriteDeck);
      setShowOnboarding(!snapshot.onboardingSeen);
      setHydrated(true);
    });
  }, [isPlayerMode, sessionStoragePrefix]);

  useEffect(() => {
    void refreshOfficialRanking(false);
  }, [refreshOfficialRanking]);

  useEffect(() => {
    if (!isPlayerMode && !showAdminOperations) {
      setRemoteCollection((current) => ({ ...current, loading: false, error: "" }));
      return;
    }
    const controller = new AbortController();
    const bootstrapUrl = isPlayerMode
      ? "/api/arena/placard/bootstrap"
      : "/api/admin/placard/bootstrap";
    void fetch(bootstrapUrl, { cache: "no-store", signal: controller.signal })
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
            cards?: Array<{ code?: string; ownedCopies?: number; isActive?: boolean }>;
            eligiblePurchaseUnits?: number;
            attributedPurchaseUnits?: number;
            pendingPurchaseUnits?: number;
            fragmentBalance?: number;
          };
          collection?: null | {
            ownerFound?: boolean;
            collectionActive?: boolean;
            inventory?: Record<string, number>;
            cards?: unknown[];
            cultureTokenBalance?: number;
          };
          ownedBuddieCodes?: string[];
          ownedBuddies?: Array<{ code: string; imageUrl?: string; ownedCopies?: number }>;
          playerSession?: PlayerSessionPayload | null;
        };
        if (!response.ok) throw new Error(payload.error || "Initialisation Placard indisponible.");
        if ((payload.warnings?.length ?? 0) > 0) setRemoteNotice(payload.warnings!.join(" · "));
        setLaunchReadiness(showAdminOperations ? payload.readiness ?? null : null);
        setSeasonRewardPreview(showAdminOperations ? payload.seasonRewards ?? null : null);
        setSeasonRolloverPreview(showAdminOperations ? payload.seasonRollover ?? null : null);
        setNotebookRewardPreview(showAdminOperations ? payload.notebookRewards ?? null : null);
        const heritage = payload.heritage ?? {};
        setRemoteHeritageOwnedCodes((heritage.cards ?? [])
          .filter((card) => card.isActive === true && Number(card.ownedCopies ?? 0) > 0)
          .map((card) => String(card.code ?? "")).filter(Boolean));
        setRemoteHeritageActive(heritage.collectionActive === true);
        setRemoteHeritageFragments(Number(heritage.fragmentBalance ?? 0));
        const collection = payload.collection ?? {};
        if (isPlayerMode) {
          const ownedCodes = (payload.ownedBuddieCodes ?? []).filter((code) =>
            KQ_BUDDIES.some((buddie) => buddie.code === code));
          setOwnedBuddieCodes(ownedCodes);
          setOwnedBuddieArtwork(Object.fromEntries((payload.ownedBuddies ?? []).map((buddie) => [
            buddie.code,
            { imageUrl: buddie.imageUrl ?? "", ownedCopies: Number(buddie.ownedCopies ?? 0) },
          ])));
          setSelectedBuddie((current) => ownedCodes.includes(current) ? current : ownedCodes[0] ?? current);
        }
        const inventory = collection.inventory ?? {};
        remoteInventoryRef.current = inventory;
        setRemoteInventory(inventory);
        setRemoteCollection({
          loading: false,
          error: payload.collection ? "" : "Inventaire distant indisponible.",
          ownerFound: collection.ownerFound === true,
          collectionActive: collection.collectionActive === true,
          totalCopies: Object.values(inventory).reduce((sum, count) => sum + count, 0),
          cardCount: collection.cards?.length ?? 0,
          cultureTokenBalance: Math.max(0, Number(collection.cultureTokenBalance ?? 0)),
        });
        if (isPlayerMode && payload.playerSession && (payload.playerSession.warnings?.length ?? 0) === 0) {
          skipNextSessionFetchRef.current = true;
          applyOfficialSessionPayload(payload.playerSession);
          const warnings = [...(payload.warnings ?? []), ...(payload.playerSession.warnings ?? [])];
          if (warnings.length > 0) setRemoteNotice(warnings.join(" · "));
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        const message = error instanceof Error ? error.message : "Initialisation Placard indisponible.";
        setRemoteNotice(message);
        setRemoteCollection((current) => ({ ...current, loading: false, error: message }));
      });
    return () => controller.abort();
  }, [applyOfficialSessionPayload, collectionRefreshNonce, isPlayerMode, showAdminOperations]);

  useEffect(() => {
    if (!remoteBurnsEnabled || remoteCollection.loading || !remoteCollection.ownerFound) {
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
    void fetch(sessionUrl, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as {
          error?: string;
          warnings?: string[];
          activeRun?: Awaited<ReturnType<typeof getKqRemoteActiveRun>>["activeRun"];
          flowers?: KqOfficialFlower[];
          battles?: KqOfficialBattle[];
          progress?: OfficialRankProgress | null;
        };
        if (!response.ok) throw new Error(payload.error || "Session Placard indisponible.");
        const activeRun = payload.activeRun ?? null;
        const flowers = payload.flowers ?? [];
        setOfficialFlowers(flowers);
        setOfficialBattles(payload.battles ?? []);
        setOfficialRankProgress(payload.progress ?? null);
        if (!activeRun) {
          const currentRemoteInventory = remoteInventoryRef.current;
          setRemoteRunId(null);
          if (isPlayerMode) {
            setState(startKqGame(Date.now()));
            setBattle(null);
            setSetupOpen(true);
          }
          window.sessionStorage.removeItem(`${sessionStoragePrefix}-remote-run-id`);
          setSelectedCards((current) => sanitizeKqDeckSelection(current, currentRemoteInventory));
          setSelectedSubstrate((current) => (currentRemoteInventory[current] ?? 0) > 0
            ? current
            : KQ_CARDS.find((card) => card.category === "substrate" && (currentRemoteInventory[card.code] ?? 0) > 0)?.code ?? current);
          setRemoteNotice("");
        } else {
          const receipts = activeRun.burnReceipts.map((receipt) => toLocalReceipt(receipt, activeRun.state.seed));
          setRemoteRunId(activeRun.runId);
          window.sessionStorage.setItem(`${sessionStoragePrefix}-remote-run-id`, activeRun.runId);
          setState(activeRun.state);
          setSelectedBuddie(activeRun.state.varietyCode);
          setSelectedSubstrate(activeRun.state.deckCodes.find((code) => KQ_CARDS.find((card) => card.code === code)?.category === "substrate") ?? "BOTTE-001");
          setSelectedCards(activeRun.state.deckCodes.filter((code) => !["substrate", "pbi"].includes(KQ_CARDS.find((card) => card.code === code)?.category ?? "")));
          setBurnHistory((history) => [...receipts, ...history.filter((entry) => !receipts.some((receipt) => receipt.id === entry.id))].slice(0, 100));
          setSetupOpen(false);
          setRemoteNotice(`Culture officielle reprise · ${receipts.length} reçu${receipts.length > 1 ? "s" : ""} vérifié${receipts.length > 1 ? "s" : ""}.`);
        }
        const matchingFlower = flowers.find((flower) => flower.runId === activeRun?.runId)
          ?? flowers.find((flower) => flower.id === window.sessionStorage.getItem(`${sessionStoragePrefix}-remote-flower-id`));
        if (matchingFlower) {
          setPersistedFlowerId(matchingFlower.id);
          window.sessionStorage.setItem(`${sessionStoragePrefix}-remote-flower-id`, matchingFlower.id);
        }
        if ((payload.warnings?.length ?? 0) > 0) setRemoteNotice(payload.warnings!.join(" · "));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setRemoteNotice(error instanceof Error ? error.message : "Session Placard indisponible.");
      })
      .finally(() => setRemoteAction(null));
    return () => controller.abort();
  }, [isPlayerMode, remoteBurnsEnabled, remoteCollection.loading, remoteCollection.ownerFound, sessionStoragePrefix]);

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
  const activeInventory = remoteBurnsEnabled ? remoteInventory : inventory;
  const preview = previewKqResolution(state);
  const rewardableDailyChallenges = dailyChallenges.filter((challenge) => !rankProfile.claimedChallengeCodes.includes(challenge.claimKey));
  const availableCards = useMemo(() => getKqVisibleActionCards(state), [state]);
  const handCodes = useMemo(() => getKqHandCodes(state), [state]);
  const supportDeckSize = state.deckCodes.filter((code) => !["substrate", "pbi"].includes(KQ_CARDS.find((card) => card.code === code)?.category ?? "")).length;
  const burnedSupportCount = state.usedCards.filter((code) => !["substrate", "pbi"].includes(KQ_CARDS.find((card) => card.code === code)?.category ?? "")).length;
  const redrawLimit = KQ_HERITAGE_CARDS.find((card) => card.code === state.heritageCode)?.effect === "two-extra-redraws" ? 3 : 1;
  const canRedrawHand = state.phase === "prepare"
    && !state.preparationPlayed
    && (state.handRedrawsUsed ?? 0) < redrawLimit
    && !state.playedThisStage.some((code) => KQ_CARDS.find((card) => card.code === code)?.category !== "substrate");

  const preserveMobileViewport = () => {
    if (typeof window === "undefined" || !window.matchMedia("(max-width: 760px)").matches) return;
    mobileViewportRef.current = { scrollY: window.scrollY };
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  useLayoutEffect(() => {
    const snapshot = mobileViewportRef.current;
    if (!snapshot) return;
    mobileViewportRef.current = null;

    window.scrollTo({ top: snapshot.scrollY, left: 0, behavior: "auto" });
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: snapshot.scrollY, left: 0, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [state.phase, state.stageIndex, state.dice, state.usedCards.length]);

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

  const applyGameAction = async (action: "roll" | "resolve" | "advance" | "redraw" | "heritage", deferState = false): Promise<KqGameState | null> => {
    preserveMobileViewport();
    if (!remoteBurnsEnabled) {
      const nextState = action === "roll" ? rollKqDice(state) : action === "resolve" ? resolveKqStage(state) : action === "advance" ? advanceKqStage(state) : action === "redraw" ? redrawKqHand(state) : activateKqHeritage(state);
      if (!deferState) setState(nextState);
      return nextState;
    }
    if (!remoteRunId || remoteAction !== null) return null;
    setRemoteAction("game");
    try {
      const result = await applyKqRemoteAction(remoteRunId, action, remoteRequest);
      if (!deferState) setState(result.state);
      if (result.persistedFlower?.id) {
        setPersistedFlowerId(result.persistedFlower.id);
        window.sessionStorage.setItem(`${sessionStoragePrefix}-remote-flower-id`, result.persistedFlower.id);
        setRemoteRunId(null);
        window.sessionStorage.removeItem(`${sessionStoragePrefix}-remote-run-id`);
        const refreshed = await getKqRemoteFlowers(remoteRequest);
        setOfficialFlowers(refreshed.flowers);
      }
      setRemoteNotice(action === "roll" ? "Lancer confirmé par le serveur." : "");
      return result.state;
    } catch (error) {
      setRemoteNotice(error instanceof Error ? error.message : "Synchronisation impossible.");
      return null;
    } finally {
      setRemoteAction(null);
    }
  };

  const swapHeritageCard = async (reserveIndex: number) => {
    if (heritageSwapOutIndex === null || remoteAction !== null) return;
    if (!remoteBurnsEnabled) {
      const nextState = swapKqHeritageHandCard(state, heritageSwapOutIndex, reserveIndex);
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
    if (rolling || state.phase !== "prepare") return;
    if (directDiceResult || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhysicsDiceActive(false);
      setDiceMotionPhase("idle");
      await applyGameAction("roll");
      return;
    }

    const startedAt = window.performance.now();
    setDiceMotionPhase("preparing");
    setRolling(true);
    const rolledState = await applyGameAction("roll", true);
    if (!rolledState?.dice) {
      setRolling(false);
      setDiceMotionPhase("idle");
      return;
    }

    const values = rolledState.bonusDie ? [...rolledState.dice, rolledState.bonusDie] : [...rolledState.dice];
    const physicsDice = physicsDiceRef.current;
    if (physicsDice) {
      setPhysicsDiceActive(true);
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      const completed = await physicsDice.roll(values, setDiceMotionPhase);
      if (completed) {
        setState(rolledState);
        setRolling(false);
        setDiceMotionPhase("idle");
        return;
      }
      setPhysicsDiceActive(false);
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
    setRolling(false);
    setDiceMotionPhase("idle");
  };

  const toggleDirectDiceResult = () => {
    setDirectDiceResult((current) => {
      const next = !current;
      window.localStorage.setItem("kq-dice-direct-result", next ? "1" : "0");
      return next;
    });
  };

  const reset = () => {
    if (isPlayerMode && remoteRunId && state.phase !== "complete") {
      setRemoteNotice("Ta culture officielle est toujours active. Termine ses six étapes avant d’en préparer une nouvelle.");
      return;
    }
    setBattle(null);
    setRolling(false);
    setSelectedCards((current) => sanitizeKqDeckSelection(current, activeInventory));
    if ((activeInventory[selectedSubstrate] ?? 0) <= 0) {
      setSelectedSubstrate(KQ_CARDS.find((card) => card.category === "substrate" && (activeInventory[card.code] ?? 0) > 0)?.code ?? selectedSubstrate);
    }
    setSetupOpen(true);
    setPersistedFlowerId(null);
    window.sessionStorage.removeItem(`${sessionStoragePrefix}-remote-flower-id`);
  };

  const setRemoteMode = (enabled: boolean) => {
    if (isPlayerMode) return;
    setRemoteBurnsEnabled(enabled);
    if (enabled && selectedHeritage && !remoteHeritageOwnedCodes.includes(selectedHeritage)) setSelectedHeritage("");
    setRemoteNotice(enabled
      ? "Mode officiel activé : chaque confirmation brûlera une vraie copie."
      : "Mode simulation locale : aucune copie enregistrée ne sera touchée.");
    window.sessionStorage.setItem(`${sessionStoragePrefix}-remote-burns`, enabled ? "1" : "0");
  };

  const findOfficialRivals = async (flowerId: string) => {
    setMatchFlowerId(flowerId);
    setFlowerRivals([]);
    setSelectedRemoteRivalId(null);
    setMatchmakingLoading(true);
    setRemoteNotice("");
    try {
      const { rivals } = await getKqRemoteFlowerRivals(flowerId, remoteRequest);
      setFlowerRivals(rivals);
      setSelectedRemoteRivalId(rivals[0]?.flowerId ?? null);
      if (rivals.length === 0) setRemoteNotice("Aucun rival humain disponible et tes 10 entraînements du jour sont déjà utilisés.");
    } catch (error) {
      setRemoteNotice(error instanceof Error ? error.message : "Matchmaking indisponible.");
    } finally {
      setMatchmakingLoading(false);
    }
  };

  const confirmRemoteBattle = async () => {
    if (!matchFlowerId || !selectedRemoteRivalId) return;
    setMatchmakingLoading(true);
    try {
      const selectedRival = flowerRivals.find((rival) => rival.flowerId === selectedRemoteRivalId);
      if (selectedRival?.opponentType === "bot") {
        const result = await finalizeKqRemoteBotBattle(matchFlowerId, selectedRemoteRivalId.slice(4), remoteRequest);
        setOfficialFlowers((flowers) => flowers.filter((flower) => flower.id !== matchFlowerId));
        const score = `${result.rounds.filter((round) => round.winner === "player").length}–${result.rounds.filter((round) => round.winner === "opponent").length}`;
        setBotBattleResult({
          battleId: result.battleId,
          winner: result.winner,
          burnedAt: result.burnedAt,
          experienceAwarded: result.experienceAwarded,
          todayCount: result.todayCount,
          dailyLimit: result.dailyLimit,
          opponentName: selectedRival.opponentName ?? "Bot d’entraînement",
          varietyName: selectedRival.varietyName,
          rounds: result.rounds,
          rewardCard: result.rewardCard,
        });
        if (result.rewardCard) {
          setRemoteInventory((current) => ({
            ...current,
            [result.rewardCard!.code]: (current[result.rewardCard!.code] ?? 0) + 1,
          }));
          setCollectionRefreshNonce((nonce) => nonce + 1);
        }
        setRemoteNotice(`${result.winner === "player" ? "Victoire" : "Défaite"} contre ${selectedRival.opponentName ?? "le bot"} · ${score} · +${result.experienceAwarded.toLocaleString("fr-FR")} EXP d’Arène · entraînement ${result.todayCount}/${result.dailyLimit}. Ta Fleur a été brûlée.`);
        setPendingRemoteBattle(false);
        setFlowerRivals([]);
        setSelectedRemoteRivalId(null);
        setMatchFlowerId(null);
        try {
          const refreshed = await getKqRemoteBattles(remoteRequest);
          setOfficialBattles(refreshed.battles);
        } catch {
          // Le reçu affiché reste la source de vérité jusqu’au prochain rechargement.
        }
        await refreshOfficialRanking();
        return;
      }
      const result = await lockKqRemoteBattle(matchFlowerId, selectedRemoteRivalId, remoteRequest);
      setOfficialFlowers((flowers) => flowers.map((flower) => flower.id === matchFlowerId ? { ...flower, status: "locked" } : flower));
      setRemoteNotice(`Duel ${result.battleId.slice(0, 8)} verrouillé · les deux Fleurs sont maintenant engagées.`);
      const refreshed = await getKqRemoteBattles(remoteRequest);
      setOfficialBattles(refreshed.battles);
      setPendingRemoteBattle(false);
      setFlowerRivals([]);
      setSelectedRemoteRivalId(null);
    } catch (error) {
      setRemoteNotice(error instanceof Error ? error.message : "Verrouillage du duel impossible.");
    } finally {
      setMatchmakingLoading(false);
    }
  };

  const distributeSeasonRewards = async () => {
    if (!seasonRewardPreview?.rewardsLive || seasonDistributionPending) return;
    if (!window.confirm("Distribuer définitivement les récompenses de fin de saison aux joueurs éligibles ?")) return;
    setSeasonDistributionPending(true);
    setRemoteNotice("");
    try {
      const response = await fetch("/api/admin/placard/season-rewards", {
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
      const response = await fetch("/api/admin/placard/notebook-rewards", {
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
    setMatchmakingLoading(true);
    try {
      const verdict = await finalizeKqRemoteBattle(pendingOfficialVerdictId, remoteRequest);
      const resolvedBattle = officialBattles.find((battle) => battle.id === verdict.battleId);
      setOfficialBattles((battles) => battles.map((battle) => battle.id === verdict.battleId ? {
        ...battle, status: "verdict", rounds: verdict.rounds, winner: verdict.winner, verdictAt: verdict.burnedAt,
        playerFlower: { ...battle.playerFlower }, opponentFlower: { ...battle.opponentFlower },
      } : battle));
      setOfficialBattleResult({
        battleId: verdict.battleId,
        winner: verdict.winner,
        burnedAt: verdict.burnedAt,
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
          getKqRemoteFlowers(remoteRequest),
          getKqRemoteBattles(remoteRequest),
        ]);
        setOfficialFlowers(flowersSnapshot.flowers);
        setOfficialBattles(battlesSnapshot.battles);
      } catch {
        // The verdict receipt above remains authoritative. A later page refresh
        // will reload the same burned flowers and battle archive.
      }
      setRemoteNotice(verdict.replayed
        ? `Verdict déjà enregistré et resynchronisé · ${verdict.winner === "player" ? "victoire" : "défaite"} · aucun nouveau burn.`
        : `${verdict.winner === "player" ? "Victoire" : "Défaite"} · les deux Fleurs ont été brûlées · cote ${verdict.rankProfile?.rating ?? "mise à jour"}${verdict.challengePoints > 0 ? ` · +${verdict.challengePoints} points de défis` : ""}${verdict.pvpBoosterGranted ? " · booster La Botte de 3 cartes gagné !" : ""}.`);
      if (verdict.pvpBoosterGranted) {
        window.dispatchEvent(new Event("kq:boosters-updated"));
      }
      await refreshOfficialRanking();
      setPendingOfficialVerdictId(null);
    } catch (error) {
      setRemoteNotice(error instanceof Error ? error.message : "Verdict impossible.");
    } finally {
      setMatchmakingLoading(false);
    }
  };

  const startSelectedGame = async () => {
    const currentDailyChallenges = getKqDailyChallenges();
    if (dailyChallenges[0]?.dayKey !== currentDailyChallenges[0]?.dayKey) {
      setDailyChallenges(currentDailyChallenges);
      setDeckNotice("Les défis du jour viennent de changer. Vérifie-les avant de lancer ta culture.");
      setPendingStart(false);
      return;
    }
    const usesFreeSubstrate = !KQ_CARDS.some((card) => card.category === "substrate" && (activeInventory[card.code] ?? 0) > 0);
    if (!usesFreeSubstrate && (activeInventory[selectedSubstrate] ?? 0) <= 0) return;
    if (remoteBurnsEnabled) {
      setRemoteAction("start");
      setRemoteNotice("");
      try {
        const result = await startKqRemoteRun({
          buddieCode: selectedBuddie,
          deckCodes: [selectedSubstrate, ...selectedCards],
          cultureTokens: 0,
          heritageCode: selectedHeritage || undefined,
        }, remoteRequest);
        const nextInventory = result.freeSubstrate
          ? remoteInventory
          : { ...remoteInventory, [selectedSubstrate]: Math.max(0, (remoteInventory[selectedSubstrate] ?? 0) - 1) };
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
        window.sessionStorage.setItem(`${sessionStoragePrefix}-remote-run-id`, result.runId);
        setRemoteNotice(result.freeSubstrate
          ? "Culture lancée avec le Substrat standard gratuit · aucune carte La Botte brûlée."
          : `Substrat brûlé et confirmé · reçu ${result.burnReceipt?.id.slice(0, 8)}.`);
        setPendingStart(false);
        setSetupOpen(false);
      } catch (error) {
        setRemoteNotice(error instanceof Error ? error.message : "Démarrage distant impossible.");
      } finally {
        setRemoteAction(null);
      }
      return;
    }
    const hasBiocontrolChallenge = rewardableDailyChallenges.some((challenge) => challenge.code === "biocontrol");
    const allowedPests = [...new Set(KQ_CARDS
      .filter((card) => card.category === "pbi" && (activeInventory[card.code] ?? 0) > 0)
      .flatMap((card) => card.targets ?? []))];
    const nextState = startKqGame(Date.now(), {
      varietyCode: selectedBuddie,
      deckCodes: [selectedSubstrate, ...selectedCards],
      collectionCodes: LOCAL_COLLECTION_CODES.filter((code) => (activeInventory[code] ?? 0) > 0),
      recentSituationCodes: state.situationCodes,
      challengeDayKey: dailyChallenges[0]?.dayKey,
      requiredSituationTags: hasBiocontrolChallenge ? ["pest"] : [],
      allowedPests,
      startingXp: hasBiocontrolChallenge ? 2 : 1,
      heritageCode: selectedHeritage || undefined,
      startedAt: new Date().toISOString(),
    });
    const nextInventory = usesFreeSubstrate
      ? inventory
      : { ...inventory, [selectedSubstrate]: Math.max(0, (inventory[selectedSubstrate] ?? 0) - 1) };
    setState(nextState);
    setBattle(null);
    setInventory(nextInventory);
    if (!usesFreeSubstrate) {
      const receipt: KqBurnReceipt = { id: `BURN-${nextState.seed}-0-${selectedSubstrate}-1`, cardCode: selectedSubstrate, runSeed: nextState.seed, stageIndex: 0, useKind: "substrate", burnedAt: new Date().toISOString() };
      setBurnHistory((history) => [receipt, ...history.filter((entry) => entry.id !== receipt.id)].slice(0, 100));
      void repositoryRef.current?.saveBurnTransaction(nextState, nextInventory, receipt);
    }
    setPendingStart(false);
    setSetupOpen(false);
  };

  const playAndBurnCard = async (code: string) => {
    if ((activeInventory[code] ?? 0) <= 0) return;
    preserveMobileViewport();
    if (remoteBurnsEnabled) {
      if (!remoteRunId) {
        setRemoteNotice("Cette culture n’est pas enregistrée. Recommence-la en mode officiel.");
        setPendingBurnCode(null);
        return;
      }
      setRemoteAction("card");
      setRemoteNotice("");
      try {
        const result = await playKqRemoteCard(remoteRunId, code, remoteRequest);
        const nextInventory = { ...remoteInventory, [code]: Math.max(0, (remoteInventory[code] ?? 0) - 1) };
        const receipt = toLocalReceipt(result.burnReceipt, result.state.seed);
        setState(result.state);
        remoteInventoryRef.current = nextInventory;
        setRemoteInventory(nextInventory);
        setBurnHistory((history) => [receipt, ...history.filter((entry) => entry.id !== receipt.id)].slice(0, 100));
        if (!isPlayerMode) void repositoryRef.current?.saveGame(result.state);
        setRemoteNotice(`${KQ_CARDS.find((card) => card.code === code)?.name ?? code} appliquée · reçu ${receipt.id.slice(0, 8)}.`);
        setPendingBurnCode(null);
      } catch (error) {
        setRemoteNotice(error instanceof Error ? error.message : "Validation distante impossible.");
      } finally {
        setRemoteAction(null);
      }
      return;
    }
    const next = playKqCard(state, code);
    if (next === state) return;
    const nextInventory = { ...inventory, [code]: Math.max(0, (inventory[code] ?? 0) - 1) };
    const card = KQ_CARDS.find((item) => item.code === code);
    const receipt: KqBurnReceipt = { id: `BURN-${next.seed}-${next.stageIndex}-${code}-${next.usedCards.length}`, cardCode: code, runSeed: next.seed, stageIndex: next.stageIndex, useKind: card?.category === "pbi" ? "pbi" : "support", burnedAt: new Date().toISOString() };
    setState(next);
    setInventory(nextInventory);
    setBurnHistory((history) => [receipt, ...history.filter((entry) => entry.id !== receipt.id)].slice(0, 100));
    void repositoryRef.current?.saveBurnTransaction(next, nextInventory, receipt);
    setPendingBurnCode(null);
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

  const saveFavoriteDeck = () => {
    const favorite = { buddieCode: selectedBuddie, substrateCode: selectedSubstrate, supportCodes: [...selectedCards] };
    setFavoriteDeck(favorite);
    setDeckNotice(`Deck favori enregistré avec ${selectedCards.length} carte${selectedCards.length > 1 ? "s" : ""}.`);
    void repositoryRef.current?.saveFavoriteDeck(favorite);
  };

  const restoreFavoriteDeck = () => {
    if (!favoriteDeck) return;
    const restoredCards = sanitizeKqDeckSelection(favoriteDeck.supportCodes, activeInventory);
    setSelectedBuddie(favoriteDeck.buddieCode);
    setSelectedSubstrate((activeInventory[favoriteDeck.substrateCode] ?? 0) > 0
      ? favoriteDeck.substrateCode
      : KQ_CARDS.find((card) => card.category === "substrate" && (activeInventory[card.code] ?? 0) > 0)?.code ?? selectedSubstrate);
    setSelectedCards(restoredCards);
    const missing = favoriteDeck.supportCodes.length - restoredCards.length;
    setDeckNotice(missing > 0 ? `Deck favori restauré sans ${missing} copie${missing > 1 ? "s" : ""} épuisée${missing > 1 ? "s" : ""}.` : "Deck favori restauré.");
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

  const openCollectionChest = () => {
    if (chestOpening) return;
    setChestOpening(true);
    window.setTimeout(() => {
      setShowCollectionChest(true);
      setChestOpening(false);
    }, 520);
  };

  const applyRecommendedDeck = () => {
    const buddie = KQ_BUDDIES.find((item) => item.code === selectedBuddie);
    if (!buddie) return;
    const recommendation = buildKqRecommendedDeck(buddie.effect, activeInventory, rewardableDailyChallenges.map((challenge) => challenge.code));
    setSelectedSubstrate(recommendation.substrate);
    setSelectedCards(recommendation.support);
    setDeckNotice("Deck conseillé appliqué : défis du jour + synergie du Buddie. Tu peux encore tout modifier.");
  };

  const openTestBooster = () => {
    const cards = openKqSupportBooster(Date.now() + boosterNonce);
    setInventory((current) => addKqBoosterToInventory(current, cards));
    setLastBooster(cards);
    setBoosterNonce((value) => value + 1);
  };

  const matchmaking = getKqMatchmaking(rankProfile);
  const selectedRival = matchmaking.find((rival) => rival.id === selectedRivalId) ?? matchmaking[0];
  const leaderboard = getKqLocalLeaderboard(rankProfile);
  const league = getKqLeague(rankProfile.rating);
  const playerLeaderboardEntry = leaderboard.find((entry) => entry.isPlayer);
  const displayedRank = isPlayerMode ? officialRankProgress?.rank ?? null : playerLeaderboardEntry?.rank ?? null;
  const displayedLeague = isPlayerMode ? officialRankProgress?.league ?? "Non classé" : league.name;
  const displayedRating = isPlayerMode ? officialRankProgress?.rating ?? 1000 : rankProfile.rating;
  const displayedSeasonPoints = isPlayerMode ? officialRankProgress?.seasonPoints ?? 0 : rankProfile.seasonPoints;
  const displayedWins = isPlayerMode ? officialRankProgress?.wins ?? 0 : rankProfile.wins;
  const displayedLosses = isPlayerMode ? officialRankProgress?.losses ?? 0 : rankProfile.losses;
  const displayedStreak = isPlayerMode ? officialRankProgress?.streak ?? 0 : rankProfile.streak;
  const displayedArenaExperience = isPlayerMode ? officialRankProgress?.arenaExperience ?? 0 : 0;
  const displayedLeagueProgress = isPlayerMode ? officialRankProgress?.leagueProgress ?? 0 : league.progress;
  const displayedPointsToNext = isPlayerMode ? officialRankProgress?.pointsToNextLeague ?? 0 : league.pointsToNext;
  const displayedLeaderboard = isPlayerMode
    ? officialLeaderboard.slice(0, 3).map((entry) => ({
      id: `${entry.rank}-${entry.pseudo}`,
      rank: entry.rank,
      name: entry.pseudo,
      rating: entry.rating,
      isPlayer: entry.rank === officialRankProgress?.rank,
    }))
    : leaderboard.slice(0, 3);
  const activeSubstrate = KQ_CARDS.find((card) => card.code === state.deckCodes.find((code) => KQ_CARDS.find((item) => item.code === code)?.category === "substrate")) ?? KQ_CARDS[0];
  const activeHeritage = KQ_HERITAGE_CARDS.find((card) => card.code === state.heritageCode);
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

  if (!hydrated) return <main className={styles.page}><div className={styles.loading}>Ouverture de La Botte…</div></main>;

  if (setupOpen || viewMode === "arena") {
    const supportCards = KQ_CARDS.filter((card) => card.timing !== "passive" && card.category !== "pbi" && (deckFilter === "all" || card.category === deckFilter));
    const substrates = KQ_CARDS.filter((card) => card.category === "substrate");
    const hasOwnedSubstrate = substrates.some((card) => (activeInventory[card.code] ?? 0) > 0);
    const pbiReserve = KQ_CARDS.filter((card) => card.category === "pbi");
    const ownedBotteCount = KQ_CARDS.filter((card) => (activeInventory[card.code] ?? 0) > 0).length;
    const totalBotteCopies = KQ_CARDS.reduce((sum, card) => sum + (activeInventory[card.code] ?? 0), 0);
    const selectedReferenceCount = new Set(selectedCards).size;
    const deckCoverage = getKqDeckCoverage(selectedCards);
    const mostBurned = Object.entries(burnHistory.reduce<Record<string, number>>((counts, receipt) => ({ ...counts, [receipt.cardCode]: (counts[receipt.cardCode] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return (
      <main className={styles.page} data-player-mode={isPlayerMode || undefined} data-admin-operations={showAdminOperations || undefined} data-view-mode={viewMode}>
        {showCollectionChest ? (
          <div className={styles.collectionModalBackdrop} role="presentation" onClick={() => setShowCollectionChest(false)}>
            <section className={styles.collectionModal} role="dialog" aria-modal="true" aria-labelledby="collection-title" onClick={(event) => event.stopPropagation()}>
              <header>
                <div>
                  <span>Étape 3 · Inventaire de jeu</span>
                  <h2 id="collection-title">Choisis tes cartes</h2>
                  <p>Compose ta main La Botte et équipe, si tu le souhaites, une carte Héritage.</p>
                </div>
                <button type="button" aria-label="Fermer l’inventaire" onClick={() => setShowCollectionChest(false)}><X /></button>
              </header>
              <div className={styles.collectionModalSummary}>
                <span><b>{selectedCards.length}</b> carte{selectedCards.length > 1 ? "s" : ""} dans ta main</span>
                <span><b>{ownedBotteCount}</b> référence{ownedBotteCount > 1 ? "s" : ""} possédée{ownedBotteCount > 1 ? "s" : ""}</span>
                <span><b>{selectedHeritage ? "1" : "0"}</b> Héritage équipé</span>
              </div>
              <div className={styles.collectionInventoryBody}>
                <section className={styles.collectionInventorySection} aria-labelledby="botte-inventory-title">
                  <header>
                    <div>
                      <span>Ta main</span>
                      <h3 id="botte-inventory-title">Cartes La Botte</h3>
                      <p>Ajoute les cartes que tu veux jouer. Les cartes non possédées restent visibles en gris.</p>
                    </div>
                  </header>
                  <div className={styles.collectionInventory}>
                    {KQ_CARDS.filter((card) => card.timing !== "passive" && card.category !== "pbi").map((card) => {
                      const ownedCopies = activeInventory[card.code] ?? 0;
                      const selectedCopies = selectedCards.filter((code) => code === card.code).length;
                      const locked = ownedCopies <= 0;
                      return <article key={card.code} data-locked={locked || undefined} data-selected={selectedCopies > 0 || undefined}><CardArtwork code={card.code} name={card.name} /><span>{CATEGORY_LABELS[card.category]}</span><strong>{card.name}</strong><p>{card.description}</p><small>{locked ? "Non détenue" : `${ownedCopies} copie${ownedCopies > 1 ? "s" : ""} disponible${ownedCopies > 1 ? "s" : ""}`}</small><div><button type="button" aria-label={`Retirer une copie de ${card.name}`} disabled={locked || selectedCopies <= 0} onClick={() => removeCardCopy(card.code)}>−</button><b>{locked ? "🔒" : `${selectedCopies} / ${ownedCopies}`}</b><button type="button" aria-label={`Ajouter une copie de ${card.name}`} disabled={locked || selectedCopies >= ownedCopies} onClick={() => addCardCopy(card.code)}>+</button></div></article>;
                    })}
                  </div>
                </section>
                <section className={`${styles.collectionInventorySection} ${styles.collectionHeritageSection}`} aria-labelledby="heritage-inventory-title">
                  <header>
                    <div>
                      <span>Option facultative · permanente</span>
                      <h3 id="heritage-inventory-title">Cartes Héritage</h3>
                      <p>Équipe un seul pouvoir permanent. Cette carte ne prend aucune place dans ta main et ne brûle jamais.</p>
                      <small>{remoteBurnsEnabled ? remoteHeritageActive ? `${remoteHeritageOwnedCodes.length}/12 possédée(s) · ${remoteHeritageFragments} fragments` : "Collection en attente d’activation" : "Galerie locale complète"}</small>
                    </div>
                  </header>
                  <div className={styles.collectionHeritageInventory}>
                    <article className={styles.heritageClassic} data-selected={!selectedHeritage || undefined}>
                      <span>Sans Héritage</span>
                      <strong>Culture classique</strong>
                      <p>Aucun pouvoir permanent équipé.</p>
                      <button type="button" aria-pressed={!selectedHeritage} onClick={() => setSelectedHeritage("")}>{!selectedHeritage ? "Sélectionnée" : "Choisir"}</button>
                    </article>
                    {KQ_HERITAGE_CARDS.map((card) => {
                      const remotelyOwned = remoteHeritageOwnedCodes.includes(card.code);
                      const disabled = remoteBurnsEnabled && !remotelyOwned;
                      const selected = selectedHeritage === card.code;
                      return <article key={card.code} data-selected={selected || undefined} data-locked={disabled || undefined}><span>{card.timing === "passive" ? "Passif" : "1 fois/culture"}</span><CardArtwork code={card.code} name={card.name} /><strong>{card.name}</strong><p>{card.description}</p><small>{disabled ? "Avis à faire valider" : selected ? "Pouvoir équipé" : "Disponible"}</small><button type="button" disabled={disabled} aria-pressed={selected} onClick={() => setSelectedHeritage(card.code)}>{disabled ? "Non possédée" : selected ? "Équipée" : "Équiper"}</button></article>;
                    })}
                  </div>
                </section>
              </div>
              <footer>
                <p>Seules les cartes La Botte réellement jouées pendant la partie seront brûlées.</p>
                <button type="button" className={styles.primaryButton} onClick={() => setShowCollectionChest(false)}>Valider ma sélection · {selectedCards.length} carte{selectedCards.length > 1 ? "s" : ""}{selectedHeritage ? " · 1 Héritage" : ""}</button>
              </footer>
            </section>
          </div>
        ) : null}
        <section className={styles.setupPanel}>
          <header className={styles.setupHero}><div className={styles.setupHeroCopy}><span>Le Placard Kanab Quest{isPlayerMode ? "" : " · local"}</span><h1>Prépare <em>ta culture.</em></h1><i aria-hidden="true" /><p>Choisis ta variété, ton substrat et tes cartes. Puis lance la partie.</p><button type="button" className={styles.guideReplay} onClick={() => setShowOnboarding(true)}>Règles en 1 minute</button></div><div className={styles.setupHeroArt} aria-hidden="true"><span /><Image src="/sylvain-culture-hero.webp" alt="" width={1122} height={1402} priority sizes="(max-width: 760px) 72vw, 390px" /></div></header>
          {showAdminOperations && !isPlayerMode ? <div className={styles.remoteCollectionStatus} data-error={remoteCollection.error || undefined}>
            <span>{isPlayerMode ? "Mes cartes La Botte" : "Données sécurisées · test admin"}</span>
            {remoteCollection.loading ? <strong>Chargement de tes cartes…</strong> : remoteCollection.error ? <strong>{remoteCollection.error}</strong> : <strong>{remoteCollection.totalCopies} carte{remoteCollection.totalCopies > 1 ? "s" : ""} disponible{remoteCollection.totalCopies > 1 ? "s" : ""}</strong>}
            <small>{remoteCollection.loading ? "Connexion à ton album…" : remoteCollection.error ? "Ta collection est momentanément indisponible." : isPlayerMode ? "Seules les cartes réellement jouées seront brûlées." : `${remoteCollection.ownerFound ? "Compte admin retrouvé" : "Aucun compte collection associé"} · collection ${remoteCollection.collectionActive ? "active" : "inactive"}.`}</small>
            {!isPlayerMode ? <button type="button" className={styles.remoteModeButton} disabled={remoteCollection.loading || !remoteCollection.ownerFound || remoteAction !== null} data-active={remoteBurnsEnabled || undefined} aria-pressed={remoteBurnsEnabled} onClick={() => setRemoteMode(!remoteBurnsEnabled)}>{remoteBurnsEnabled ? "🔥 Burns officiels activés" : "Simulation locale"}</button> : null}
          </div> : null}
          {remoteNotice ? <div className={styles.remoteNotice} data-tone={getKqFeedbackTone(remoteNotice)} role="status" aria-live="polite">{remoteNotice}</div> : null}
          {launchReadiness ? <details className={styles.launchReadiness} data-safe={launchReadiness.safelyDormant || undefined}><summary><span>Préflight de lancement</span><strong>{launchReadiness.readyForActivation ? "Contenu complet · activation encore verrouillée" : `${launchReadiness.blockers.length} blocage${launchReadiness.blockers.length > 1 ? "s" : ""} restant${launchReadiness.blockers.length > 1 ? "s" : ""}`}</strong><small>{launchReadiness.contentReady ? "Contenu : complet" : "Contenu : incomplet"} · {launchReadiness.safelyDormant ? "Sécurité : tous les verrous sont fermés" : "Alerte : un verrou de lancement est déjà ouvert"}</small></summary><div>{launchReadiness.checks.map((check) => { const safetyCheck = check.code.endsWith("-dormant"); return <p key={check.code} data-ready={check.ready || undefined} data-kind={safetyCheck ? "safety" : "content"}><b>{check.ready ? "✓" : "○"}</b><span>{check.label}</span><strong>{check.ready ? safetyCheck ? "Fermé" : "Prêt" : safetyCheck ? "À refermer" : "À terminer"}</strong></p>; })}<section className={styles.activationSequence}><h3>Fenêtre de lancement coordonnée</h3><small>Cette liste est volontairement informative : aucune activation automatique depuis cet écran.</small><ol>{launchReadiness.activationStillRequired.map((step) => <li key={step}>{step}</li>)}</ol></section></div></details> : null}
          {seasonRewardPreview ? <details className={styles.seasonRewardPreview}><summary><span>Fin de saison · {seasonRewardPreview.rewardsLive ? "distribution active" : "aperçu dormant"}</span><strong>{seasonRewardPreview.eligiblePlayers} joueur(s) éligible(s)</strong><small>{seasonRewardPreview.rewardsLive ? "La commande applique les reçus idempotents après confirmation." : "Aucune récompense n’est distribuée pendant les tests."}</small></summary><div><b>{seasonRewardPreview.pendingGrants}<small>attributions en attente</small></b><b>{seasonRewardPreview.alreadyGranted}<small>déjà attribuées</small></b><b>{seasonRewardPreview.totalSupportBoosters}<small>boosters La Botte prévus</small></b><b>{seasonRewardPreview.totalHeritageFragments}<small>fragments Héritage prévus</small></b></div><p>Distribution {seasonRewardPreview.rewardsLive ? "active" : "dormante"} · palier minimum : 3 duels terminés. Les titres, cadres et rubans restent prioritaires sur la puissance.</p><button type="button" className={styles.seasonDistributionButton} disabled={!seasonRewardPreview.rewardsLive || seasonRewardPreview.pendingGrants <= 0 || seasonDistributionPending} title={!seasonRewardPreview.rewardsLive ? "Le verrou KQ_SEASON_REWARDS_LIVE est désactivé." : undefined} onClick={() => void distributeSeasonRewards()}>{seasonDistributionPending ? "Distribution en cours…" : seasonRewardPreview.rewardsLive ? "Distribuer les récompenses" : "Distribution verrouillée"}</button></details> : null}
          {seasonRolloverPreview ? <details className={styles.seasonRewardPreview}><summary><span>Passage de saison · préflight seul</span><strong>{seasonRolloverPreview.fromSeason} → {seasonRolloverPreview.toSeason ?? "à planifier"}</strong><small>{seasonRolloverPreview.ready ? "Toutes les conditions techniques sont réunies." : "La clôture reste impossible tant que les blocages ne sont pas levés."}</small></summary><div><b>{seasonRolloverPreview.players}<small>joueurs classés</small></b><b>{seasonRolloverPreview.eligiblePlayers}<small>éligibles aux lots</small></b><b>{seasonRolloverPreview.missingRewardGrants}<small>récompenses manquantes</small></b><b>{seasonRolloverPreview.lockedBattles}<small>duels verrouillés</small></b></div><p>{seasonRolloverPreview.blockers.length > 0 ? seasonRolloverPreview.blockers.join(" · ") : "Archive et remise à zéro prêtes. Aucune exécution n’est exposée dans l’interface."}</p><button type="button" className={styles.seasonDistributionButton} disabled>Clôture non activée</button></details> : null}
          {notebookRewardPreview ? <details className={styles.notebookRewardPreview}><summary><span>Carnet → Placard · {notebookRewardPreview.rewardsLive ? "actif" : "aperçu dormant"}</span><strong>{notebookRewardPreview.pendingBadges} badge{notebookRewardPreview.pendingBadges > 1 ? "s" : ""} avec gains prévus</strong><small>La note donnée n’influence jamais la récompense.</small></summary><div className={styles.notebookRewardTotals}><b>{notebookRewardPreview.pendingSupportBoosters}<small>boosters La Botte prévus</small></b><b>{notebookRewardPreview.pendingCultureTokens}<small>jetons Coup de pouce prévus</small></b><b>{notebookRewardPreview.alreadyGranted}<small>badges déjà traités</small></b></div><ul>{notebookRewardPreview.badges.map((badge) => <li key={badge.profileBadgeId} data-granted={badge.granted || undefined}><span><strong>{badge.label}</strong><small>{badge.granted ? "Déjà attribué" : notebookRewardPreview.rewardsLive ? "À attribuer automatiquement" : "Prévu au lancement"}</small></span><b>{badge.supportBoosters > 0 ? `${badge.supportBoosters} booster${badge.supportBoosters > 1 ? "s" : ""}` : ""}{badge.supportBoosters > 0 && badge.cultureTokens > 0 ? " + " : ""}{badge.cultureTokens > 0 ? `${badge.cultureTokens} jeton${badge.cultureTokens > 1 ? "s" : ""}` : ""}</b></li>)}</ul><p>Aucun bouton client de réclamation : les gains seront attribués automatiquement et une seule fois après validation du badge.</p><button type="button" className={styles.notebookRetroButton} disabled={!notebookRewardPreview.rewardsLive || notebookRetroCursor === null || notebookRetroPending} title={!notebookRewardPreview.rewardsLive ? "Le verrou KQ_NOTEBOOK_REWARDS_LIVE est désactivé." : undefined} onClick={() => void runNotebookRetroBatch()}>{notebookRetroPending ? "Traitement du lot…" : !notebookRewardPreview.rewardsLive ? "Rétro-attribution verrouillée" : notebookRetroCursor === null ? "Rétro-attribution terminée" : notebookRetroCursor === 0 ? "Lancer la rétro-attribution" : "Traiter le lot suivant"}</button></details> : null}
          {!isPlayerMode ? <div className={styles.albumSummary}>
            <article><span>Collection variétés</span><strong>{KQ_COLLECTIONS.buddies.title}</strong><p><b>{KQ_BUDDIES.length}</b> variétés jouables dans le prototype · {KQ_COLLECTIONS.buddies.totalCards} cartes dans l’album complet</p><div><i style={{ width: `${KQ_BUDDIES.length / KQ_COLLECTIONS.buddies.totalCards * 100}%` }} /></div></article>
            <article><span>Collection auxiliaire</span><strong>{KQ_COLLECTIONS.support.title}</strong><p><b>{ownedBotteCount}</b> références disponibles · {totalBotteCopies} copies · objectif {KQ_COLLECTIONS.support.totalCards}</p><div><i style={{ width: `${ownedBotteCount / KQ_COLLECTIONS.support.totalCards * 100}%` }} /></div></article>
          </div> : null}
          {isPlayerMode && (ownedBuddieCodes.length === 0 || totalBotteCopies === 0) ? (
            <aside className={styles.collectionBlockingNotice} role="status">
              <Flame />
              <div>
                <strong>Ta collection n’est pas encore prête pour une culture</strong>
                {ownedBuddieCodes.length === 0 ? <p>Il te faut au moins une carte Buddie dans ton album pour choisir la variété.</p> : null}
                {totalBotteCopies === 0 ? <p>Il te faut aussi un Substrat et au moins une carte La Botte jouable.</p> : null}
                <small>Les Buddies et les cartes non consommées restent dans ton album. Seules les cartes La Botte confirmées brûlent.</small>
              </div>
              <Link href="/profil/collection">Voir mon album</Link>
            </aside>
          ) : null}
          {viewMode === "arena" ? (
            <header className={styles.arenaModeHero}>
              <span>Compétition officielle</span>
              <h1>L’Arène des Fleurs</h1>
              <p>Choisis une Fleur arrivée à maturité, trouve un adversaire et grimpe au classement.</p>
            </header>
          ) : null}
          <section id="placard-saison" className={styles.arenaDashboard}>
            <div><span>Arène Kanab Quest</span><h2>{isPlayerMode ? `Ta saison${officialRankProgress?.seasonCode ? ` · ${officialRankProgress.seasonCode}` : ""}` : "Ta saison locale"}</h2><p>{displayedPointsToNext > 0 ? `${displayedPointsToNext} points de cote avant la ligue suivante.` : isPlayerMode ? "Joue un duel officiel pour entrer dans le classement." : "Palier maximal atteint dans le prototype."}</p><div className={styles.leagueProgress}><i style={{ width: `${displayedLeagueProgress}%` }} /></div><small className={styles.nextBooster}>{3 - (displayedStreak % 3)} victoire{3 - (displayedStreak % 3) > 1 ? "s" : ""} de suite avant le prochain booster</small></div>
            <div className={styles.arenaStats}><span><strong>#{displayedRank ?? "–"}</strong><small>Classement</small></span><span><strong>{displayedLeague}</strong><small>Ligue</small></span><span><strong>{displayedRating}</strong><small>Cote</small></span><span><strong>{displayedSeasonPoints}</strong><small>Points</small></span><span><strong>{displayedArenaExperience.toLocaleString("fr-FR")}</strong><small>EXP Arène</small></span><span><strong>{displayedWins}–{displayedLosses}</strong><small>Bilan</small></span><span><strong>{displayedStreak}</strong><small>Série</small></span></div>
            <ol>{displayedLeaderboard.map((entry) => <li key={entry.id} data-player={entry.isPlayer || undefined}><b>#{entry.rank}</b><span>{entry.name}</span><strong>{entry.rating}</strong></li>)}</ol>
          </section>
          <section className={styles.dailyChallengeBoard}>
            <header><span>Rotation quotidienne · {dailyChallenges[0]?.dayKey}</span><h2>Les 3 défis du jour</h2><p>Adapte ton Buddie et ton deck avant de lancer la culture.</p></header>
            <div>{dailyChallenges.map((challenge) => { const claimed = rankProfile.claimedChallengeCodes.includes(challenge.claimKey); const missingPbi = challenge.code === "biocontrol" && !pbiReserve.some((card) => (activeInventory[card.code] ?? 0) > 0); return <article key={challenge.claimKey} data-claimed={claimed || undefined} data-blocked={missingPbi || undefined}><Star /><span><strong>{challenge.title}</strong><small>{missingPbi ? "Aucune PBI disponible dans ton album." : challenge.code === "biocontrol" ? `${challenge.description} Bonus mission : +1 XP au départ.` : challenge.description}</small></span><b>{claimed ? "Déjà gagné" : missingPbi ? "PBI requise" : `+${challenge.points}`}</b></article>; })}</div>
          </section>
          <details className={styles.packFormat}>
            <summary><span>Deux collections · deux parcours</span><strong>Les boosters Buddies restent inchangés</strong><small>La Botte possède sa boutique dans L’Arène.</small></summary>
            <div><b>Buddies · album habituel</b><b>La Botte · 10 cartes</b><b>Prix La Botte · 5 points</b></div>
            <p>Les points gagnés avec les achats servent dans les deux boutiques, avec un tarif propre à La Botte. Les Héritages restent exclusivement liés aux fleurs concours.</p>
          </details>
          {!isPlayerMode && (showAdminOperations || showPackLab) ? <details className={styles.boosterLab} open={showPackLab || undefined}><summary>Prévisualisation locale · Booster La Botte</summary><div><div><span>Boutique de L’Arène</span><strong>Booster La Botte · 10 cartes</strong><p>Aperçu local uniquement : aucune carte n’est enregistrée.</p></div><aside><button type="button" onClick={openTestBooster}><Sparkles /> Ouvrir un booster test</button></aside></div></details> : null}
          {lastBooster.length > 0 ? <div className={styles.boosterReveal} aria-live="polite">{lastBooster.map((card, index) => <article key={`${card.code}-${index}`} data-rarity={card.rarity}><CardArtwork code={card.code} name={card.name} /><span>{card.rarity}</span><strong>{card.name}</strong><small>{remoteBurnsEnabled ? "Aperçu local · aucune copie enregistrée" : `Tu en possèdes maintenant ${inventory[card.code] ?? 0}`}</small></article>)}</div> : null}
          {burnHistory.length > 0 ? <div className={styles.burnArchive}><Flame /><span><small>Registre permanent · {burnHistory.length} burns</small><strong>Cartes les plus utilisées</strong><div>{mostBurned.map(([code, count]) => <b key={code}>{KQ_CARDS.find((card) => card.code === code)?.name ?? code} ×{count}</b>)}</div></span></div> : null}
          <h2 id="placard-preparation">1. Ton Buddie</h2>
          <div className={styles.buddieChoices}>{KQ_BUDDIES.filter((buddie) => !isPlayerMode || ownedBuddieCodes.includes(buddie.code)).map((buddie) => { const artwork = ownedBuddieArtwork[buddie.code]; return <button key={buddie.code} type="button" data-selected={selectedBuddie === buddie.code || undefined} aria-pressed={selectedBuddie === buddie.code} onClick={() => setSelectedBuddie(buddie.code)}>{artwork?.imageUrl ? <span className={styles.buddieArtwork}><Image src={artwork.imageUrl} alt={`Carte ${buddie.name}`} fill sizes="(max-width: 760px) 220px, 260px" className="object-cover" /></span> : null}<span>Kanab Quest #{buddie.cardNumber}</span><strong>{buddie.name}</strong><em>{buddie.rarity}{artwork?.ownedCopies ? ` · ×${artwork.ownedCopies}` : ""}</em><p>{buddie.ability}</p></button>; })}</div>
          <div className={styles.deckAssistant}><span><Sparkles /><b>Première partie ?</b> Le deck conseillé utilise uniquement les copies encore disponibles et reste entièrement modifiable.</span><button type="button" onClick={applyRecommendedDeck}>Créer le deck conseillé</button></div>
          <h2>2. Ton Substrat</h2>
          {!hasOwnedSubstrate ? <p className={styles.deckNotice}><b>Substrat standard offert :</b> tu peux commencer sans aucune carte La Botte. Aucune carte ne sera brûlée au lancement.</p> : null}
          <div className={styles.substrateChoices}>{substrates.map((card) => <button key={card.code} type="button" disabled={hasOwnedSubstrate && (activeInventory[card.code] ?? 0) <= 0} data-selected={selectedSubstrate === card.code || undefined} aria-pressed={selectedSubstrate === card.code} onClick={() => setSelectedSubstrate(card.code)}><CardArtwork code={card.code} name={card.name} /><strong>{!hasOwnedSubstrate && card.code === selectedSubstrate ? "Substrat standard" : card.name}</strong><p>{card.description}</p><em>{!hasOwnedSubstrate && card.code === selectedSubstrate ? "Fourni gratuitement · aucun burn" : `${activeInventory[card.code] ?? 0} copie(s) · ${card.rarity}`}</em></button>)}</div>
          {isPlayerMode ? <><h2 className={styles.collectionChestTitle}>3. Ton inventaire de jeu</h2><button type="button" className={styles.collectionChest} data-opening={chestOpening || undefined} aria-haspopup="dialog" aria-label="Ouvrir le coffre La Botte" onClick={openCollectionChest}><span className={styles.collectionChestArt}><Image src="/placard/collection-chest.png" alt="" fill sizes="220px" /></span><b>{chestOpening ? "Ouverture…" : "Ouvrir le coffre"}</b></button></> : null}
          <h2 className={styles.deckSectionTitle}>3. La Botte <small>{selectedCards.length} carte{selectedCards.length > 1 ? "s" : ""}</small></h2>
          <p className={`${styles.deckNotice} ${styles.deckSelectionNotice}`} role="status" aria-live="polite">{deckNotice || "Ajoute autant de copies que tu en possèdes. Chaque copie jouée sera brûlée."}</p>
          <div className={styles.deckOdds}><div><span>Taille du deck</span><strong>{selectedCards.length}</strong></div><div><span>Références différentes</span><strong>{selectedReferenceCount}</strong></div><p><b>À retenir :</b> plus le deck est grand, plus il offre de solutions, mais plus une carte précise devient difficile à piocher dans une main de dix.</p></div>
          <div className={styles.deckCoverage}><span>Couverture des situations</span><div>{Object.entries(COVERAGE_LABELS).map(([tag, label]) => { const count = deckCoverage[tag as keyof typeof COVERAGE_LABELS]; return <b key={tag} data-empty={count === 0 || undefined}>{label}<small>{count}</small></b>; })}<b data-versatile><Sparkles /> Polyvalentes<small>{deckCoverage.versatile}</small></b></div><p>Un zéro signale un angle mort, pas une interdiction : les dés et les cartes polyvalentes permettent toujours de jouer.</p></div>
          <div className={styles.deckQuickActions}><span>Composition rapide</span><div><button type="button" onClick={() => applyCollectionDeck("one-each")}>1 de chaque</button><button type="button" onClick={() => applyCollectionDeck("all-copies")}>Toutes mes copies</button><button type="button" disabled={selectedCards.length === 0} onClick={() => { setSelectedCards([]); setDeckNotice("Deck vidé. Tu peux commencer sans carte La Botte."); }}>Vider</button></div></div>
          <div className={styles.favoriteDeckActions}><span>Deck favori · local</span><div><button type="button" disabled={selectedCards.length === 0} onClick={saveFavoriteDeck}>{favoriteDeck ? "Remplacer le favori" : "Enregistrer"}</button><button type="button" disabled={!favoriteDeck} onClick={restoreFavoriteDeck}>Restaurer</button><button type="button" disabled={!favoriteDeck} onClick={deleteFavoriteDeck}>Supprimer</button></div></div>
          <div className={styles.deckFilters} aria-label="Filtrer les cartes La Botte">{([['all', 'Toutes'], ['equipment', 'Équipement'], ['know-how', 'Savoir-faire'], ['luck', 'Chance']] as const).map(([value, label]) => <button key={value} type="button" data-selected={deckFilter === value || undefined} aria-pressed={deckFilter === value} onClick={() => setDeckFilter(value)}>{label}</button>)}</div>
          <div className={styles.deckChoices}>{supportCards.map((card) => { const challengeFit = getKqCardChallengeFit(card, rewardableDailyChallenges.map((challenge) => challenge.code)); const selectedCopies = selectedCards.filter((code) => code === card.code).length; const ownedCopies = activeInventory[card.code] ?? 0; const drawChance = getKqOpeningHandChance(selectedCards.length, selectedCopies); return <article key={card.code} className={styles.deckChoiceCard} data-selected={selectedCopies > 0 || undefined} data-empty={ownedCopies <= 0 || undefined} data-challenge-fit={challengeFit || undefined}><CardArtwork code={card.code} name={card.name} /><span>{CATEGORY_LABELS[card.category]}</span>{challengeFit ? <i className={styles.challengeFit}><Star /> Aide défi</i> : null}<strong>{card.name}</strong><p>{card.description}</p><em>{ownedCopies} copie(s) · {card.xpCost} XP</em>{selectedCopies > 0 ? <small className={styles.drawChance}>{drawChance}% dans la première main</small> : null}<div><button type="button" aria-label={`Retirer une copie de ${card.name}`} disabled={selectedCopies <= 0} onClick={() => removeCardCopy(card.code)}>−</button><b>{selectedCopies} / {ownedCopies}</b><button type="button" aria-label={`Ajouter une copie de ${card.name}`} disabled={selectedCopies >= ownedCopies} onClick={() => addCardCopy(card.code)}>+</button></div></article>; })}</div>
          <div className={styles.pbiReserve}><span>Réserve PBI de l’album · automatique</span><div>{pbiReserve.map((card) => <strong key={card.code} data-empty={(activeInventory[card.code] ?? 0) <= 0 || undefined}>{card.name} <small>×{activeInventory[card.code] ?? 0}</small></strong>)}</div><p>Ces cartes ne prennent aucune place dans le deck. Elles apparaissent seulement après identification d’un ravageur. Une référence à zéro ne peut plus intervenir.</p></div>
          <div className={styles.setupFooter}><span>{hasOwnedSubstrate ? "🔥 Le Substrat choisi brûle au départ. Ensuite, seules les cartes réellement jouées brûlent." : "✓ Substrat standard gratuit. Les cartes La Botte sont entièrement facultatives."}</span><button type="button" className={styles.primaryButton} disabled={(hasOwnedSubstrate && (activeInventory[selectedSubstrate] ?? 0) <= 0) || (isPlayerMode && !ownedBuddieCodes.includes(selectedBuddie)) || remoteAction !== null} onClick={() => setPendingStart(true)}>Commencer avec {selectedCards.length === 0 ? "aucune carte" : `${selectedCards.length} carte${selectedCards.length > 1 ? "s" : ""}`}</button></div>
          {remoteBurnsEnabled ? (
            <section id="placard-reserve" className={styles.officialFlowerReserve}>
              <header>
                <span>Réserve officielle</span>
                <h2>Mes Fleurs d’Arène</h2>
                <p>{officialFlowers.length} Fleur{officialFlowers.length > 1 ? "s" : ""} officielle{officialFlowers.length > 1 ? "s" : ""} enregistrée{officialFlowers.length > 1 ? "s" : ""}. Chaque carte ne peut disputer qu’un seul duel.</p>
              </header>
              {officialFlowers.length > 0 ? (
                <div className={styles.officialFlowerGrid}>
                  {officialFlowers.map((flower) => (
                    <div className={styles.officialFlowerSlot} key={flower.id}>
                      <FlowerTcgCard
                        varietyName={flower.varietyName}
                        varietyCode={flower.varietyCode}
                        tier={getKqHarvestTier(flower.quality)}
                        quality={flower.quality}
                        stats={flower.stats}
                        imageUrl={ownedBuddieArtwork[flower.varietyCode]?.imageUrl}
                        reference={`Fleur ${flower.id.slice(0, 8)}`}
                        status={flower.status}
                        selected={matchFlowerId === flower.id}
                      />
                      {flower.status === "available" ? (
                        <button type="button" disabled={matchmakingLoading} onClick={() => void findOfficialRivals(flower.id)}>
                          <Swords /> Jouer cette carte
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : <p className={styles.emptyFlowerReserve}>Termine une culture officielle pour créer ta première Fleur officielle.</p>}
              {matchFlowerId && flowerRivals.length > 0 ? <div className={styles.remoteRivals}><span>{flowerRivals[0]?.opponentType === "bot" ? `Entraînement bots · ${flowerRivals[0].remainingBotDuels ?? 0}/10 restants · +0,1 EXP` : "Adversaires compatibles · ±8 qualité"}</span>{flowerRivals.map((rival) => <button key={rival.flowerId} type="button" data-selected={selectedRemoteRivalId === rival.flowerId || undefined} onClick={() => setSelectedRemoteRivalId(rival.flowerId)}><strong>{rival.opponentType === "bot" ? `🤖 ${rival.opponentName}` : rival.varietyName}</strong><small>{rival.varietyName} · Qualité {rival.quality}{rival.opponentType === "bot" ? " · 0,1 EXP" : ""}</small></button>)}<button type="button" className={styles.remoteBattleButton} disabled={!selectedRemoteRivalId || matchmakingLoading} onClick={() => setPendingRemoteBattle(true)}><Swords /> {flowerRivals.find((rival) => rival.flowerId === selectedRemoteRivalId)?.opponentType === "bot" ? "Affronter ce bot" : "Préparer ce duel"}</button></div> : null}
            </section>
          ) : null}
          {remoteBurnsEnabled && officialBattles.length > 0 ? <section className={styles.officialBattles}><span>Jury officiel</span><h2>Mes duels officiels</h2>{officialChallengeReward ? <div className={styles.officialChallengeReward}><Star /><span><strong>+{officialChallengeReward.points} points de défis</strong><small>{officialChallengeReward.titles.length > 0 ? officialChallengeReward.titles.join(" · ") : "Aucun défi supplémentaire validé"}</small></span></div> : null}{officialBattles.map((officialBattle) => <article key={officialBattle.id} data-status={officialBattle.status} data-opponent={officialBattle.opponentType}><header><div><strong>{officialBattle.playerFlower.variety}</strong><small>Ta Fleur</small></div><b>VS</b><div><strong>{officialBattle.opponentFlower.variety}</strong><small>{officialBattle.opponentType === "bot" ? "🤖 Entraînement" : "Adversaire"}</small></div></header>{officialBattle.status === "locked" ? <><p>Les deux Fleurs sont verrouillées. Le verdict les brûlera définitivement.</p><button type="button" disabled={matchmakingLoading} onClick={() => setPendingOfficialVerdictId(officialBattle.id)}><Trophy /> Demander le verdict</button></> : officialBattle.status === "cancelled" ? <><h3>Duel expiré</h3><p>Aucun verdict, aucun burn et aucun point. Les deux Fleurs sont redevenues disponibles.</p><small>Engagement annulé après 48 heures · {formatKqDate(officialBattle.lockedAt)}</small></> : <><h3>{officialBattle.winner === "player" ? "Victoire" : "Défaite"}{officialBattle.opponentType === "bot" ? " d’entraînement" : " officielle"}</h3><div className={styles.officialRounds}>{officialBattle.rounds.map((round) => <span key={round.code} data-winner={round.winner}><strong>{round.label}</strong><b>{round.playerScore} – {round.opponentScore}</b></span>)}</div><small>{officialBattle.opponentType === "bot" ? `Ta Fleur brûlée · +${Number(officialBattle.experienceAwarded ?? 0.1).toLocaleString("fr-FR")} EXP d’Arène` : "Deux Fleurs brûlées · +1 EXP d’Arène"} · {formatKqDate(officialBattle.verdictAt)}</small></>}</article>)}</section> : null}
          {battleHistory.length > 0 ? <section className={styles.battleHistory}><span>Archives locales</span><h2>Derniers concours</h2><div>{battleHistory.slice(0, 5).map((receipt) => <article key={receipt.id}><Flame /><span><strong>{receipt.playerFlower.variety} vs {receipt.opponentFlower.variety}</strong><small>{receipt.winner === "player" ? "Victoire" : "Défaite"} · brûlées le {formatKqDate(receipt.burnedAt)}</small></span><b>{receipt.rounds.filter((round) => round.winner === "player").length}–{receipt.rounds.filter((round) => round.winner === "opponent").length}</b></article>)}</div></section> : null}
        </section>
        {showOnboarding ? <div className={styles.onboardingBackdrop} role="presentation" onClick={closeOnboarding}><section className={styles.onboarding} role="dialog" aria-modal="true" aria-labelledby="kq-guide-title" aria-describedby="kq-guide-intro" onClick={(event) => event.stopPropagation()}><button type="button" className={styles.onboardingClose} aria-label="Fermer les règles" onClick={closeOnboarding}><X /></button><span>Le Placard · règles en 1 minute</span><h2 id="kq-guide-title">Cultive. Joue. Gagne.</h2><p id="kq-guide-intro" className={styles.onboardingIntro}>Construis ta collection, prépare la meilleure main et mesure ta stratégie à celle des autres joueurs.</p><div className={styles.onboardingSteps}><article><PackageOpen /><b>1. Ouvre tes packs</b><p>Retrouve dans <strong>Le Placard</strong> tous les packs que tu as gagnés et ouvre-les pour enrichir ta collection.</p></article><article><ShoppingBag /><b>2. Gagne des points</b><p>Chaque commande te rapporte des points. Utilise-les pour acheter de nouveaux packs et obtenir plus de cartes.</p></article><article><Dices /><b>3. Prépare ta main</b><p>Choisis soigneusement tes cartes et compose une main efficace pour performer au mieux pendant ta culture.</p></article><article><Swords /><b>4. Défie les joueurs</b><p>Affronte les autres joueurs : la meilleure stratégie l’emporte et te fait grimper au classement.</p></article><article><Gift /><b>5. Remporte des lots</b><p>Monte le plus haut possible avant la fin de la saison pour gagner les récompenses mises en jeu.</p></article></div><button type="button" className={styles.primaryButton} onClick={closeOnboarding}>C’est parti · préparer ma main</button></section></div> : null}
          {pendingStart ? <div className={styles.burnConfirmBackdrop} role="presentation" onClick={() => remoteAction === null && setPendingStart(false)}><section className={styles.burnConfirm} role="dialog" aria-modal="true" aria-labelledby="substrate-burn-title" onClick={(event) => event.stopPropagation()}><Flame /><span>{hasOwnedSubstrate ? remoteBurnsEnabled ? "Burn officiel" : "Simulation locale" : "Démarrage gratuit"}</span><h2 id="substrate-burn-title">{hasOwnedSubstrate ? "Brûler le Substrat ?" : "Commencer sans carte La Botte ?"}</h2><p>{hasOwnedSubstrate ? `Une copie de ${substrates.find((card) => card.code === selectedSubstrate)?.name} sera détruite.` : "Le Substrat standard est fourni gratuitement et aucune carte ne sera détruite au lancement."} Les {selectedCards.length} cartes du deck ne brûleront que si tu les joues, copie par copie.</p>{remoteNotice ? <small className={styles.modalNotice}>{remoteNotice}</small> : null}<div><button type="button" disabled={remoteAction !== null} onClick={() => setPendingStart(false)}>Annuler</button><button type="button" className={styles.burnButton} disabled={remoteAction !== null} onClick={() => void startSelectedGame()}><Flame /> {remoteAction === "start" ? "Confirmation…" : hasOwnedSubstrate ? "Brûler et commencer" : "Commencer gratuitement"}</button></div></section></div> : null}
          {pendingRemoteBattle ? <div className={styles.burnConfirmBackdrop} role="presentation" onClick={() => !matchmakingLoading && setPendingRemoteBattle(false)}><section className={styles.burnConfirm} role="dialog" aria-modal="true" aria-labelledby="remote-battle-title" onClick={(event) => event.stopPropagation()}><Swords /><span>{flowerRivals.find((rival) => rival.flowerId === selectedRemoteRivalId)?.opponentType === "bot" ? "Entraînement contre un bot" : "Engagement officiel"}</span><h2 id="remote-battle-title">{flowerRivals.find((rival) => rival.flowerId === selectedRemoteRivalId)?.opponentType === "bot" ? "Envoyer cette Fleur au jury ?" : "Verrouiller les deux Fleurs ?"}</h2><p>{flowerRivals.find((rival) => rival.flowerId === selectedRemoteRivalId)?.opponentType === "bot" ? "Le verdict est immédiat et brûlera ta Fleur. Tu gagneras 0,1 EXP d’Arène, sans modifier ton Elo, tes points de saison ni ta série." : "Ta Fleur et la Fleur adverse deviendront indisponibles pour tout autre duel jusqu’au verdict du jury."}</p>{remoteNotice ? <small className={styles.modalNotice}>{remoteNotice}</small> : null}<div><button type="button" disabled={matchmakingLoading} onClick={() => setPendingRemoteBattle(false)}>Annuler</button><button type="button" className={styles.burnButton} disabled={matchmakingLoading} onClick={() => void confirmRemoteBattle()}><Swords /> {matchmakingLoading ? "Jury en cours…" : "Confirmer le duel"}</button></div></section></div> : null}
          {botBattleResult ? <div className={styles.burnConfirmBackdrop} role="presentation" onClick={() => setBotBattleResult(null)}><section className={styles.burnConfirm} role="dialog" aria-modal="true" aria-labelledby="bot-result-title" onClick={(event) => event.stopPropagation()}><button type="button" className={styles.resultCloseButton} aria-label="Fermer le verdict" onClick={() => setBotBattleResult(null)}>Fermer ×</button><Trophy /><span>Verdict d’entraînement · {botBattleResult.todayCount}/{botBattleResult.dailyLimit}</span><h2 id="bot-result-title">{botBattleResult.winner === "player" ? "Victoire !" : "Défaite"}</h2><p>Face à {botBattleResult.opponentName} avec {botBattleResult.varietyName}.</p><div className={styles.officialRounds}>{botBattleResult.rounds.map((round) => <span key={round.code} data-winner={round.winner}><strong>{round.label}</strong><small>{round.explanation}</small><b>{round.playerScore} – {round.opponentScore}</b></span>)}</div>{botBattleResult.rewardCard ? <div className={styles.botCardReward}><span>Carte gagnée · ajoutée à ton inventaire</span><div className={styles.botCardRewardArt}><Image src={getKqCardArtwork(botBattleResult.rewardCard.code) ?? botBattleResult.rewardCard.imageUrl} alt={`Carte ${botBattleResult.rewardCard.name}`} fill sizes="180px" /></div><strong>{botBattleResult.rewardCard.name}</strong><small>{botBattleResult.rewardCard.description}</small></div> : null}<div className={styles.tradeoff}><p><b>Récompense</b>+{botBattleResult.experienceAwarded.toLocaleString("fr-FR")} EXP d’Arène{botBattleResult.rewardCard ? " · 1 carte La Botte" : ""}</p><p><b>Résultat</b>{botBattleResult.rounds.filter((round) => round.winner === "player").length}–{botBattleResult.rounds.filter((round) => round.winner === "opponent").length} · Fleur brûlée</p></div><small>Verdict enregistré · {formatKqDate(botBattleResult.burnedAt)} · reçu {botBattleResult.battleId.slice(0, 8)}</small><div><button type="button" className={styles.burnButton} onClick={() => setBotBattleResult(null)}>Continuer</button></div></section></div> : null}
          {officialBattleResult ? (
            <div className={styles.burnConfirmBackdrop} data-verdict-result role="presentation" onClick={() => setOfficialBattleResult(null)}>
              <section className={styles.burnConfirm} data-victory={officialBattleResult.winner === "player" || undefined} role="dialog" aria-modal="true" aria-labelledby="official-result-title" onClick={(event) => event.stopPropagation()}>
                <button type="button" className={styles.resultCloseButton} aria-label="Fermer le verdict" onClick={() => setOfficialBattleResult(null)}>Fermer ×</button>
                <Trophy />
                <span>Verdict officiel · reçu {officialBattleResult.battleId.slice(0, 8)}</span>
                <h2 id="official-result-title">{officialBattleResult.winner === "player" ? "Victoire !" : "Défaite"}</h2>
                <p>{officialBattleResult.playerVariety} face à {officialBattleResult.opponentVariety}.</p>
                <strong className={styles.verdictScore}>{officialBattleResult.rounds.filter((round) => round.winner === "player").length} – {officialBattleResult.rounds.filter((round) => round.winner === "opponent").length}</strong>
                <div className={styles.officialRounds}>{officialBattleResult.rounds.map((round) => <span key={round.code} data-winner={round.winner}><strong>{round.label}</strong><small>{round.explanation}</small><b>{round.playerScore} – {round.opponentScore}</b></span>)}</div>
                <div className={styles.officialResultRewards}>
                  <p><b>Arène</b>+1 EXP · deux Fleurs brûlées</p>
                  <p><b>Défis</b>{officialBattleResult.challengePoints > 0 ? `+${officialBattleResult.challengePoints} points` : "Aucun point supplémentaire"}</p>
                  {officialBattleResult.pvpBoosterGranted ? <p data-highlight><b>Récompense</b>Booster La Botte · {officialBattleResult.pvpBoosterCardCount} cartes</p> : null}
                </div>
                {officialBattleResult.completedChallengeTitles.length > 0 ? <small>Défis réussis : {officialBattleResult.completedChallengeTitles.join(" · ")}</small> : null}
                {officialBattleResult.rankProfile ? <div className={styles.resultRankSummary}><span><strong>{officialBattleResult.rankProfile.rating}</strong><small>Cote</small></span><span><strong>{officialBattleResult.rankProfile.seasonPoints}</strong><small>Points saison</small></span><span><strong>{officialBattleResult.rankProfile.wins}–{officialBattleResult.rankProfile.losses}</strong><small>Victoires–défaites</small></span></div> : null}
                <small>Verdict enregistré le {formatKqDate(officialBattleResult.burnedAt)}</small>
                <div><button type="button" className={styles.burnButton} onClick={() => setOfficialBattleResult(null)}>Continuer</button></div>
              </section>
            </div>
          ) : null}
          {pendingOfficialVerdictId ? <div className={styles.burnConfirmBackdrop} role="presentation" onClick={() => !matchmakingLoading && setPendingOfficialVerdictId(null)}><section className={styles.burnConfirm} role="dialog" aria-modal="true" aria-labelledby="official-verdict-title" onClick={(event) => event.stopPropagation()}><Flame /><span>Verdict officiel irréversible</span><h2 id="official-verdict-title">Brûler les deux Fleurs ?</h2><p>Le serveur calculera les trois manches, désignera le gagnant, mettra le classement à jour puis brûlera définitivement les deux Fleurs.</p>{remoteNotice ? <small className={styles.modalNotice}>{remoteNotice}</small> : null}<div><button type="button" disabled={matchmakingLoading} onClick={() => setPendingOfficialVerdictId(null)}>Retour</button><button type="button" className={styles.burnButton} disabled={matchmakingLoading} onClick={() => void confirmOfficialVerdict()}><Flame /> {matchmakingLoading ? "Jury en cours…" : "Confirmer le verdict"}</button></div></section></div> : null}
      </main>
    );
  }

  if (state.phase === "complete") {
    const tier = getKqHarvestTier(state.quality);
    const flower = createKqFlower(state);
    const economy = summarizeKqCardEconomy(state);
    const recentJuryCodes = battleHistory.slice(0, 3).flatMap((entry) => entry.rounds.map((round) => round.code));
    const juryProgram = getKqJuryProgram(state.seed, recentJuryCodes);
    const previousLeague = getKqLeague(rankProfile.rating - rankProfile.lastRatingDelta);
    const leagueShifted = previousLeague.name !== league.name;
    const burnedCards = economy.burnedCodes.map((code) => KQ_CARDS.find((card) => card.code === code)).filter((card): card is KqSupportCard => Boolean(card));
    const preservedCards = economy.preservedCodes.map((code) => KQ_CARDS.find((card) => card.code === code)).filter((card): card is KqSupportCard => Boolean(card));
    if (isPlayerMode) {
      return (
        <main className={styles.page} data-player-mode="true">
          <section className={styles.harvestHero}>
            <Image src="/dev/placard/charles.webp" width={180} height={210} alt="Charles présente la récolte" />
            <div>
              <span>Carte Fleur officielle obtenue</span>
              <h1>{tier}</h1>
              <p>{state.varietyName} · créée le {formatKqDate(flower.createdAt)}</p>
              <small className={styles.integrityCode}>
                Culture #{String(state.seed).padStart(5, "0")}
                {persistedFlowerId ? ` · Fleur ${persistedFlowerId.slice(0, 8)}` : " · Enregistrement confirmé"}
              </small>
            </div>
            <div className={styles.finalScore}><Trophy /><strong>{Math.max(0, state.quality)}</strong><small>qualité</small></div>
          </section>
          <section className={styles.traitsPanel}>
            <h2>Ta Fleur rejoint la réserve officielle</h2>
            <p>
              Elle n’est pas brûlée maintenant. Elle reste dans ta réserve jusqu’à son premier duel,
              puis le verdict la brûle définitivement.
            </p>
            <div className={styles.cultureReceipt}>
              <article><Flame /><span><small>Copies brûlées · {burnedCards.length}</small><div>{burnedCards.map((card, index) => <b key={`${card.code}-${index}`}>{card.name}</b>)}</div></span></article>
              <article><Sparkles /><span><small>Cartes conservées · {preservedCards.length}</small><div>{preservedCards.length > 0 ? preservedCards.map((card, index) => <b key={`${card.code}-${index}`}>{card.name}</b>) : <em>Aucune carte conservée</em>}</div></span></article>
            </div>
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
            <button type="button" className={styles.primaryButton} onClick={onOpenArena ?? reset}>
              <Swords /> Voir ma réserve et choisir un rival
            </button>
          </section>
        </main>
      );
    }
    return (
      <main className={styles.page}>
        <section className={styles.harvestHero}>
          <Image src="/dev/placard/charles.webp" width={180} height={210} alt="Charles présente la récolte" />
          <div><span>{persistedFlowerId ? "Carte Fleur officielle obtenue" : "Carte Récolte obtenue"}</span><h1>{tier}</h1><p>{state.varietyName} · créée le {formatKqDate(flower.createdAt)}</p><small className={styles.integrityCode}>Culture #{String(state.seed).padStart(5, "0")} · Empreinte {flower.integrityCode}{persistedFlowerId ? ` · Fleur ${persistedFlowerId.slice(0, 8)}` : ""}</small></div>
          <div className={styles.finalScore}><Trophy /><strong>{Math.max(0, state.quality)}</strong><small>qualité</small></div>
        </section>
        <section className={styles.traitsPanel}>
          <h2>L’histoire de cette culture</h2>
          <div className={styles.cultureReceipt}>
            <article><Flame /><span><small>Copies brûlées · {burnedCards.length}</small><div>{burnedCards.map((card, index) => <b key={`${card.code}-${index}`}>{card.name}</b>)}</div></span></article>
            <article><Sparkles /><span><small>Cartes conservées · {preservedCards.length}</small><div>{preservedCards.length > 0 ? preservedCards.map((card, index) => <b key={`${card.code}-${index}`}>{card.name}</b>) : <em>Aucune carte du deck conservée</em>}</div></span></article>
          </div>
          <div className={styles.traitsList}>{state.traits.map((trait, index) => <span key={`${trait}-${index}`}><Star />{trait}</span>)}</div>
          {state.combos.length > 0 ? <div className={styles.comboList}>{state.combos.map((combo) => <span key={combo}><Sparkles />Combo · {combo}</span>)}</div> : null}
          <ol>{state.history.map((entry) => <li key={entry.stage}><strong>{entry.stage}</strong><span>{entry.dice.join(" + ")} · {entry.total}/{entry.target}</span><em>{entry.trait}</em></li>)}</ol>
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
              <div><Swords /><span><strong>Battle Fleur contre Fleur</strong><small>Les deux Fleurs seront verrouillées, puis brûlées après le verdict.</small></span></div>
              <div className={styles.rivalChoices}>{matchmaking.map((rival) => { const stake = getKqRatingStake(rankProfile.rating, rival.rating); return <button key={rival.id} type="button" data-selected={selectedRival.id === rival.id || undefined} aria-pressed={selectedRival.id === rival.id} onClick={() => setSelectedRivalId(rival.id)}><strong>{rival.name}</strong><small>{rival.variety} · cote {rival.rating}</small><span><b>Victoire +{stake.win}</b><em>Défaite {stake.loss}</em></span></button>; })}</div>
              <button type="button" className={styles.primaryButton} onClick={() => setBattle(lockKqBattle(flower, createKqOpponent(state.seed + selectedRival.seedOffset, { ownerName: selectedRival.name, variety: selectedRival.variety, rating: selectedRival.rating }), state.seed, selectedRival.rating))}>Défier {selectedRival.name}</button>
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
          {battle?.status === "locked" && pendingBattleVerdict ? <div className={styles.burnConfirmBackdrop} role="presentation" onClick={() => setPendingBattleVerdict(false)}><section className={styles.burnConfirm} role="dialog" aria-modal="true" aria-labelledby="flower-burn-title" onClick={(event) => event.stopPropagation()}><Flame /><span>Verdict irréversible</span><h2 id="flower-burn-title">Brûler les deux fleurs ?</h2><p>{battle.playerFlower.variety} et {battle.opponentFlower.variety} seront détruites après les trois manches. Le résultat sera ajouté au classement et ne pourra pas être rejoué.</p><div><button type="button" onClick={() => setPendingBattleVerdict(false)}>Retour au duel</button><button type="button" className={styles.burnButton} onClick={judgeBattle}><Flame /> Confirmer le verdict</button></div></section></div> : null}
          {battle?.status === "verdict" ? (
            <div className={styles.verdictPanel}>
              <span className={styles.verdictKicker}>Verdict officiel</span>
              <h2>{revealedRounds >= battle.rounds.length ? battle.winner === "player" ? "Victoire !" : "Défaite honorable" : "Délibération du jury…"}</h2>
              {revealedRounds >= battle.rounds.length ? <small className={styles.verdictDate}>Fleurs brûlées le {formatKqDate(battle.burnedAt)}</small> : null}
              {revealedRounds >= battle.rounds.length && leagueShifted ? <div className={styles.leagueShift} data-promotion={rankProfile.lastRatingDelta > 0 || undefined}><Trophy /><span><small>{rankProfile.lastRatingDelta > 0 ? "Promotion de ligue" : "Changement de ligue"}</small><strong>{previousLeague.name} → {league.name}</strong></span></div> : null}
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
  const outcomeCopy = state.lastOutcome ? OUTCOME_COPY[state.lastOutcome] : null;
  const runChallenges = getKqDailyChallenges(getKqGameChallengeDate(state));

  return (
    <main className={styles.page} data-view-mode={viewMode}>
      <header className={styles.topbar}>
        <div className={styles.gameBrand}><span className={styles.gameBrandMark} aria-hidden="true"><Image src="/mascots/home-welcome.png" alt="" width={1122} height={1402} sizes="64px" /></span><div><span>{isPlayerMode ? "Kanab Quest · Culture officielle" : "Kanab Quest · Prototype local"}</span><h1>La Botte du Chanvrier</h1></div></div>
        <div className={styles.resources}><span><Zap />{state.xp} XP</span><span>Pression {state.pressure}/4</span>{!isPlayerMode ? <button type="button" onClick={reset}><RotateCcw /> Recommencer</button> : null}</div>
      </header>

      <nav className={styles.stageTrack} aria-label="Étapes de production">
        {KQ_STAGES.map((stage, index) => <span key={stage} data-current={index === state.stageIndex || undefined} data-done={index < state.stageIndex || undefined} aria-current={index === state.stageIndex ? "step" : undefined}><b>{index + 1}</b><small>{stage}</small></span>)}
      </nav>

      {activeHeritage ? (
        <aside className={styles.heritageInPlay} data-used={state.heritageUsed || undefined} data-armed={state.heritageArmed || undefined} aria-label={`Héritage équipé : ${activeHeritage.name}`}>
          <CardArtwork code={activeHeritage.code} name={activeHeritage.name} />
          <div>
            <span>Héritage équipé · ne brûle pas</span>
            <strong>{activeHeritage.name}</strong>
            <p>{activeHeritage.description}</p>
          </div>
          <footer>
            <small>{activeHeritage.timing === "passive" ? "Passif actif" : state.heritageUsed ? "Pouvoir utilisé" : state.heritageArmed ? "Pouvoir armé" : heritagePermission.allowed ? "Pouvoir disponible" : "Déclenchement automatique"}</small>
            {activeHeritage.timing === "once-per-run" ? (
              <button type="button" disabled={!heritagePermission.allowed || remoteAction !== null} onClick={() => void applyGameAction("heritage")}>
                {state.heritageUsed ? "Déjà utilisé" : state.heritageArmed ? "Pouvoir armé" : heritagePermission.allowed ? remoteAction === "game" ? "Activation…" : "Activer le pouvoir" : heritagePermission.reason}
              </button>
            ) : <b>Actif pendant toute la culture</b>}
          </footer>
        </aside>
      ) : null}

      <nav className={styles.mobilePlayTabs} aria-label="Sections de la partie">
        <button type="button" data-active={mobilePlayTab === "culture" || undefined} aria-pressed={mobilePlayTab === "culture"} onClick={() => setMobilePlayTab("culture")}><Sparkles /><span>Culture</span><small>{state.stageIndex + 1}/6</small></button>
        <button type="button" data-active={mobilePlayTab === "hand" || undefined} aria-pressed={mobilePlayTab === "hand"} onClick={() => setMobilePlayTab("hand")}><Flame /><span>Main</span><small>{handCodes.length} cartes</small></button>
        <button type="button" data-active={mobilePlayTab === "dice" || undefined} aria-pressed={mobilePlayTab === "dice"} onClick={() => setMobilePlayTab("dice")}><Dices /><span>Dés</span><small>{state.phase === "prepare" ? "À lancer" : state.phase === "rolled" ? "À valider" : "Résolu"}</small></button>
        <button type="button" data-active={mobilePlayTab === "challenges" || undefined} aria-pressed={mobilePlayTab === "challenges"} onClick={() => setMobilePlayTab("challenges")}><Star /><span>Défis</span><small>{runChallenges.filter((challenge) => getKqChallengeProgress(state, challenge.code).reached).length}/{runChallenges.length}</small></button>
      </nav>

      <section className={`${styles.liveChallenges} ${styles.mobileTabPanel}`} data-mobile-active={mobilePlayTab === "challenges" || undefined} aria-label="Progression des défis du jour">
        <span>Défis</span>
        {runChallenges.map((challenge) => { const progress = getKqChallengeProgress(state, challenge.code); const claimed = rankProfile.claimedChallengeCodes.includes(challenge.claimKey); return <article key={challenge.claimKey} data-reached={progress.reached || undefined} data-claimed={claimed || undefined}><Star /><div><strong>{challenge.title}</strong><small>{claimed ? "Déjà gagné aujourd’hui" : progress.label}</small></div></article>; })}
      </section>

      <section className={styles.gameGrid}>
        <div className={`${styles.situationCard} ${styles.mobileTabPanel}`} data-mobile-active={mobilePlayTab === "culture" || undefined}>
          <span className={styles.stepLabel}>Étape {state.stageIndex + 1}/6 · {situation.stage}</span>
          <div className={styles.situationArt}>
            <Image
              src={STAGE_ILLUSTRATIONS[KQ_STAGES[state.stageIndex]].src}
              width={768}
              height={768}
              sizes="(max-width: 760px) 100vw, 380px"
              alt={STAGE_ILLUSTRATIONS[KQ_STAGES[state.stageIndex]].alt}
              priority={state.stageIndex === 0}
            />
          </div>
          <h2>{situation.name}</h2>
          <p>{situation.story}</p>
          <div className={styles.tags}>{situation.tags.map((tag) => <span key={tag}>{tag === "pest" ? state.revealedPest ? `Ravageur : ${PEST_LABELS[state.revealedPest]}` : "Ravageur non identifié" : tag}</span>)}</div>
          <div className={styles.target}><small>Réussites requises</small><strong>{Math.min(3, situation.difficulty + (state.pressure >= 3 ? 1 : 0))}</strong></div>
        </div>

        <div className={`${styles.diceBoard} ${styles.mobileTabPanel}`} data-mobile-active={mobilePlayTab === "dice" || undefined}>
          <span className={styles.buddyName}>Buddie cultivé</span>
          <h2>{state.varietyName}</h2>
          <div className={styles.pressureMeter} role="meter" aria-label={`Pression ${state.pressure} sur 4`} aria-valuemin={0} aria-valuemax={4} aria-valuenow={state.pressure}>
            <span>{[1, 2, 3, 4].map((level) => <i key={level} data-filled={level <= state.pressure || undefined} data-danger={level >= 3 || undefined} />)}</span>
            <small>{state.pressure >= 3 ? "Sous tension · +1 réussite requise" : "Culture stable · danger à partir de 3"} · un lancer parfait retire 1 Pression</small>
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
          {(state.effectNotices?.length ?? 0) > 0 ? <div className={styles.effectNotices} role="status" aria-live="polite" aria-atomic="true"><strong><Sparkles /> Résultat des effets</strong>{state.effectNotices?.map((notice, index) => { const kind = getKqEffectNoticeKind(notice); return <p key={`${notice}-${index}`} data-kind={kind}>{kind === "applied" ? "✓" : "○"} {notice}</p>; })}</div> : null}
          {state.phase === "prepare" ? (
            <><p>Prépare une carte si tu le souhaites, puis tente ta chance.</p><button type="button" className={styles.rollButton} onClick={roll} disabled={rolling || remoteAction !== null}><Dices />{rolling ? "Les dés roulent…" : "Lancer les dés"}</button></>
          ) : null}
          {state.phase === "rolled" && preview ? (
            <div className={styles.rollResult} aria-live="polite">
              <span>Réussites</span><strong>{preview.total}/{preview.target}</strong><small>{preview.dangers} Danger · {preview.sparks} Étincelle</small>
              <em className={styles.provisionalOutcome} data-outcome={preview.outcome}>Résultat provisoire · {OUTCOME_COPY[preview.outcome].title}</em>
              <p>Tu peux encore jouer une carte de réaction avant de valider.</p>
              <button type="button" className={styles.primaryButton} disabled={remoteAction !== null || diceVisualSyncing} onClick={() => void applyGameAction("resolve")}>{diceVisualSyncing ? "Mise à jour des dés…" : "Valider le résultat"}</button>
            </div>
          ) : null}
          {state.phase === "resolved" && outcomeCopy ? (
            <div className={styles.outcome} data-outcome={state.lastOutcome} role="status" aria-live="polite">
              <span className={styles.outcomeReaction}>
                <Image
                  src={outcomeCopy.artSrc}
                  alt={outcomeCopy.artAlt}
                  fill
                  sizes="(max-width: 760px) 170px, 220px"
                />
              </span>
              <h3>{outcomeCopy.title}</h3><strong>{state.traits.at(-1)}</strong>{(state.history.at(-1)?.combos?.length ?? 0) > 0 ? <small className={styles.comboNotice}><Sparkles aria-hidden="true" /> {state.history.at(-1)?.combos?.join(" · ")}</small> : null}{state.lastOutcome === "critical" ? <small className={styles.pressureRelief}>Pression −1 · la culture reprend son souffle</small> : null}<p>Tu disposes maintenant de {state.xp} XP.</p>
              <button type="button" className={styles.primaryButton} disabled={remoteAction !== null} onClick={() => void applyGameAction("advance")}>{state.stageIndex === KQ_STAGES.length - 1 ? "Révéler la Récolte" : "Étape suivante"}</button>
            </div>
          ) : null}
        </div>
      </section>

      <section className={`${styles.deckPanel} ${styles.mobileTabPanel}`} data-mobile-active={mobilePlayTab === "hand" || undefined}>
        <header><div><span>Album Kanab Quest</span><h2>Ta main · La Botte</h2></div><p>{handCodes.length} copie{handCodes.length > 1 ? "s" : ""} distribuée{handCodes.length > 1 ? "s" : ""} · {Math.max(0, supportDeckSize - burnedSupportCount)} copie{Math.max(0, supportDeckSize - burnedSupportCount) > 1 ? "s" : ""} non brûlée{Math.max(0, supportDeckSize - burnedSupportCount) > 1 ? "s" : ""}. Les doublons occupent plusieurs places dans la main.</p></header>
        <div className={styles.cardColorLegend} aria-label="Code couleur des cartes"><span data-category="equipment">Équipement</span><span data-category="know-how">Savoir-faire</span><span data-category="luck">Chance</span><span data-category="pbi">Auxiliaire PBI</span></div>
        <div className={styles.handActions}><span>{(state.handRedrawsUsed ?? 0) < redrawLimit ? `${redrawLimit - (state.handRedrawsUsed ?? 0)} changement${redrawLimit - (state.handRedrawsUsed ?? 0) > 1 ? "s" : ""} de main disponible${redrawLimit - (state.handRedrawsUsed ?? 0) > 1 ? "s" : ""}.` : "Changement de main déjà utilisé pour cette culture."}</span><button type="button" disabled={!canRedrawHand || remoteAction !== null} onClick={() => void applyGameAction("redraw")}><RotateCcw /> Changer ma main</button></div>
        {(state.heritageReserveCodes?.length ?? 0) > 0 ? (
          <section className={styles.heritageHandExchange}>
            <header><Sparkles /><span><strong>Main prévoyante · 8 cartes vues</strong><small>Choisis une carte de ta main, puis une carte de réserve à faire entrer. Tu peux recommencer avant le lancer.</small></span></header>
            <nav className={styles.heritageExchangeTabs} aria-label="Main prévoyante">
              <button type="button" data-active={heritageExchangeTab === "hand" || undefined} aria-pressed={heritageExchangeTab === "hand"} onClick={() => setHeritageExchangeTab("hand")}>Ma main <small>{handCodes.length} cartes</small></button>
              <button type="button" data-active={heritageExchangeTab === "reserve" || undefined} aria-pressed={heritageExchangeTab === "reserve"} onClick={() => setHeritageExchangeTab("reserve")}>Ma réserve <small>{state.heritageReserveCodes?.length ?? 0} cartes</small></button>
            </nav>
            <div className={styles.heritageExchangePanels}>
              <div data-active={heritageExchangeTab === "hand" || undefined}><b>Choisis la carte à sortir</b>{handCodes.map((code, index) => <button key={`${code}-${index}`} type="button" disabled={remoteAction !== null} data-selected={heritageSwapOutIndex === index || undefined} onClick={() => { setHeritageSwapOutIndex(index); setHeritageExchangeTab("reserve"); }}>{KQ_CARDS.find((card) => card.code === code)?.name ?? code}</button>)}</div>
              <div data-active={heritageExchangeTab === "reserve" || undefined}><b>Choisis la carte à faire entrer</b>{state.heritageReserveCodes?.map((code, index) => <button key={`${code}-${index}`} type="button" disabled={heritageSwapOutIndex === null || remoteAction !== null} onClick={() => void swapHeritageCard(index)}>{KQ_CARDS.find((card) => card.code === code)?.name ?? code}<small>{remoteAction === "game" ? "Confirmation…" : heritageSwapOutIndex === null ? "Choisis d’abord une carte à sortir" : "Faire entrer"}</small></button>)}</div>
            </div>
          </section>
        ) : null}
        {state.revealedPest ? <div className={styles.pestReveal}><strong>🔎 {PEST_LABELS[state.revealedPest]} révélés</strong><span>{availableCards.filter((card) => card.category === "pbi").length} auxiliaire(s) compatible(s) de ta collection affiché(s).</span></div> : situation.pest ? <div className={styles.pestHidden}><strong>Ravageur inconnu</strong><span>Joue la Loupe d’inspection avant les dés pour ouvrir la réserve PBI.</span></div> : null}
        <div className={styles.substrate}><Sparkles /><span><small>Substrat actif</small><strong>{activeSubstrate.name}</strong><em>{activeSubstrate.description}</em></span></div>
        <div className={styles.cardRow}>{availableCards.map((card) => { const usedCopies = state.usedCards.filter((code) => code === card.code).length; const deckCopies = card.category === "pbi" ? 0 : Math.max(0, state.deckCodes.filter((code) => code === card.code).length - usedCopies); return <SupportCard key={card.code} card={card} state={state} copies={activeInventory[card.code] ?? 0} handCopies={card.category === "pbi" ? 0 : handCodes.filter((code) => code === card.code).length} deckCopies={deckCopies} serverValidatedCopy={remoteBurnsEnabled && card.category !== "pbi" && deckCopies > 0} onPlay={setPendingBurnCode} />; })}</div>
        <div className={styles.ashes}><Flame /><span><small>Cendres de cette culture · {state.usedCards.length} copie{state.usedCards.length === 1 ? "" : "s"} brûlée{state.usedCards.length === 1 ? "" : "s"}</small><div>{state.usedCards.map((code, index) => <b key={`${code}-${index}`}>{KQ_CARDS.find((card) => card.code === code)?.name ?? code}</b>)}</div></span></div>
      </section>

      {pendingBurnCode ? (() => {
        const card = KQ_CARDS.find((item) => item.code === pendingBurnCode);
        if (!card) return null;
        const tradeoff = getKqCardTradeoff(card);
        return <div className={styles.burnConfirmBackdrop} role="presentation" onClick={() => remoteAction === null && setPendingBurnCode(null)}><section className={styles.burnConfirm} role="dialog" aria-modal="true" aria-labelledby="burn-confirm-title" onClick={(event) => event.stopPropagation()}><Flame /><span>{remoteBurnsEnabled ? "Burn officiel" : "Simulation locale"}</span><h2 id="burn-confirm-title">Brûler {card.name} ?</h2><p>Cette action détruit une copie de ton album. Il t’en reste {activeInventory[card.code] ?? 0}.</p><div className={styles.tradeoff}><p><b>Avantage</b>{tradeoff.benefit}</p><p><b>Risque</b>{tradeoff.risk}</p></div>{remoteNotice ? <small className={styles.modalNotice}>{remoteNotice}</small> : null}<div><button type="button" disabled={remoteAction !== null} onClick={() => setPendingBurnCode(null)}>Annuler</button><button type="button" className={styles.burnButton} disabled={remoteAction !== null} onClick={() => void playAndBurnCard(card.code)}><Flame /> {remoteAction === "card" ? "Confirmation…" : "Brûler et jouer"}</button></div></section></div>;
      })() : null}

      <div className={styles.mobileTurnBar} aria-label="Action principale du tour">
        <span><Zap /> {state.xp} XP · Pression {state.pressure}/4</span>
        {state.phase === "prepare" ? <button type="button" onClick={roll} disabled={rolling || remoteAction !== null}><Dices />{rolling ? "Lancer…" : "Lancer les dés"}</button> : null}
        {state.phase === "rolled" ? <button type="button" disabled={remoteAction !== null} onClick={() => void applyGameAction("resolve")}>Valider · {preview?.total} réussite{preview?.total === 1 ? "" : "s"}</button> : null}
        {state.phase === "resolved" ? <button type="button" disabled={remoteAction !== null} onClick={() => void applyGameAction("advance")}>{state.stageIndex === KQ_STAGES.length - 1 ? "Voir la Récolte" : "Étape suivante"}</button> : null}
      </div>
    </main>
  );
}
