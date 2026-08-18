"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  ArrowRightLeft,
  Award,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleHelp,
  FileCheck2,
  Gift,
  LockKeyhole,
  PackageOpen,
  Sprout,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  X,
} from "lucide-react";
import { NotebookFlipBook } from "@/components/contest/NotebookFlipBook";
import { ContestNotebookPanel } from "@/components/contest/ContestNotebookPanel";
import { ContestReviewSkillRadar } from "@/components/contest/ContestReviewSkillRadar";
import { ArenaNavigation, type ContestArenaView } from "@/components/contest/ArenaNavigation";
import { ProducerRewardJourney } from "@/components/contest/ProducerRewardJourney";
import arenaStyles from "@/components/contest/ContestArena.module.css";
import { QuantitySelector } from "@/components/QuantitySelector";
import { useCart } from "@/context/CartContext";
import { categoryLabels, type Product, type ProductCategory } from "@/data/products";
import { useLotteryExperience } from "@/hooks/useLotteryExperience";
import { KQ_CARDS } from "@/lib/kanab-quest-game";
import { getKqCardArtwork } from "@/lib/kanab-quest-artwork";
import {
  findKqProducerRewardForEntry,
  type KqProducerRewardProgress,
} from "@/lib/kanab-quest-producer-rewards";
import {
  CONTEST_AROMA_TAG_LABELS,
  CONTEST_CONSUMPTION_METHOD_LABELS,
  CONTEST_ENTRY_CATEGORIES,
  CONTEST_ENTRY_CATEGORY_LABELS,
  CONTEST_ENTRY_TRACK_LABELS,
  CONTEST_ENTRY_TRACKS,
  CONTEST_REVIEW_STATUS_LABELS,
  CONTEST_SCORE_CRITERION_LABELS,
  CONTEST_SCORE_CRITERIA,
  type ContestEntryCategory,
  type ContestEntrySummary,
  type ContestEntryTrack,
  type ContestFeedItem,
  type ContestReviewEligibility,
  type ContestReviewVoteSummary,
  type ContestReviewVoteValue,
  type ContestSeason,
} from "@/types/contest";
import type {
  PublicContestNotebookUnlock,
  PublicContestEntryDetail,
  PublicContestProfile,
  PublicContestProfileBadge,
  PublicContestReview,
  PublicContestTesterProgress,
  PublicContestTesterRankingItem,
  ViewerContestReview,
} from "@/lib/contest-public-api";
import {
  formatContestDate,
  formatContestAverage,
  getContestReviewAverage,
  getContestProductHref,
} from "@/lib/contest-ui";
import { getContestEntryAnalysisUrl } from "@/lib/contest-analysis";
import { CONTEST_SCORE_MAX } from "@/lib/contest-score";
import { rarityLabels } from "@/lib/lottery-card-ui";

type ContestHubClientProps = {
  seasons: ContestSeason[];
  selectedSeasonCode?: string;
  selectedTrack: ContestEntryTrack;
  activeCategory: ContestEntryCategory;
  categoryCounts: Record<ContestEntryCategory, number>;
  entries: ContestEntrySummary[];
  rankings: ContestEntrySummary[];
  feed: ContestFeedItem[];
  notebookUnlocks: PublicContestNotebookUnlock[];
  viewerProfile: PublicContestProfile | null;
  viewerBadges: PublicContestProfileBadge[];
  viewerProgress: PublicContestTesterProgress | null;
  testerSeasonRankings: PublicContestTesterRankingItem[];
  testerGlobalRankings: PublicContestTesterRankingItem[];
  isAuthenticated: boolean;
  isAdminAuthorized: boolean;
  isPlacardPlayerEnabled: boolean;
  initialView: ContestArenaView;
  surface?: "arena" | "notebook" | "notebook-ranking";
};

type ContestMascotPanel = "intro" | "profile" | "leaderboard";

type ContestNotebookView = "lab" | "notes" | "collection";

type ContestLotteryExperience = ReturnType<typeof useLotteryExperience>;

type TestedFlowerCardItem = {
  entry: ContestEntrySummary;
  review: ViewerContestReview;
  unlock: PublicContestNotebookUnlock;
  entryIndex: number;
};

type PlacardRankingEntry = {
  rank: number;
  pseudo: string;
  rating: number;
  seasonPoints: number;
  wins: number;
  losses: number;
  streak: number;
};

type ArenaRankingEntry = {
  rank: number;
  pseudo: string;
  score: number;
  notebookScore: number;
  placardScore: number;
  approvedReviewCount: number;
  rating: number;
  wins: number;
  losses: number;
};

type PlacardPlayerProgress = {
  rank: number | null;
  rating: number;
  seasonPoints: number;
  wins: number;
  losses: number;
  streak: number;
  burnedFlowers: number;
  league: string;
  leagueProgress: number;
  pointsToNextLeague: number;
};

export const CONTEST_BADGE_CATALOG = [
  {
    id: "contest-badge-testeur",
    code: "testeur",
    label: "Testeur",
    condition: "Achète une fleur concours et fais valider ton avis.",
    rewardPacks: 1,
  },
  {
    id: "contest-badge-testeur-en-serie",
    code: "testeur-en-serie",
    label: "Testeur en série",
    condition: "Goûte et fais valider ton avis sur 3 fleurs concours.",
    rewardPacks: 5,
  },
  {
    id: "contest-badge-nez-absolu",
    code: "nez-absolu",
    label: "Nez Absolu",
    condition: "Trouve les terpènes exacts présents dans une fleur concours.",
    rewardPacks: 3,
  },
  {
    id: "contest-badge-nez-divin",
    code: "nez-divin",
    label: "Nez Divin",
    condition: "Trouve les terpènes exacts de 3 fleurs concours.",
    rewardPacks: 6,
  },
] as const;

const CONTEST_ACHIEVEMENT_BADGE_CATALOG = [
  { id: "contest-badge-premier-carnet", code: "premier-carnet", label: "Première dégustation", condition: "Fais valider ta première critique concours.", rewardPacks: 1, rewardFamily: "botte", rewardLabel: "1 booster La Botte" },
  { id: "contest-badge-gouteur-regulier", code: "gouteur-regulier", label: "Goûteur régulier", condition: "Fais valider 3 critiques concours.", rewardPacks: 2, rewardFamily: "botte", rewardLabel: "1 booster La Botte + 2 Coups de pouce" },
  { id: "contest-badge-marathon-des-lots", code: "marathon-des-lots", label: "Marathon des lots", condition: "Fais valider 10 critiques concours.", rewardPacks: 4, rewardFamily: "buddies", rewardLabel: "4 boosters Kanab Quest" },
  { id: "contest-badge-premiere-piste", code: "premiere-piste", label: "Première piste", condition: "Identifie 1 terpène dominant.", rewardPacks: 1, rewardFamily: "botte", rewardLabel: "1 booster La Botte" },
  { id: "contest-badge-combo-aromatique", code: "combo-aromatique", label: "Combo aromatique", condition: "Identifie 3 terpènes sur une même critique.", rewardPacks: 3, rewardFamily: "botte", rewardLabel: "1 booster La Botte + 1 Coup de pouce" },
  { id: "contest-badge-nez-absolu", code: "nez-absolu", label: "Nez absolu", condition: "Identifie tous les terpènes dominants d’une fleur.", rewardPacks: 3, rewardFamily: "botte", rewardLabel: "2 boosters La Botte + 1 Coup de pouce" },
  { id: "contest-badge-nez-divin", code: "nez-divin", label: "Nez divin", condition: "Obtiens Nez absolu sur 3 critiques.", rewardPacks: 6, rewardFamily: "buddies", rewardLabel: "6 boosters Kanab Quest" },
  { id: "contest-badge-tour-de-saison", code: "tour-de-saison", label: "Tour de saison", condition: "Teste 3 fleurs différentes pendant la même saison.", rewardPacks: 2, rewardFamily: "buddies", rewardLabel: "2 boosters Kanab Quest" },
  { id: "contest-badge-expert-outdoor", code: "expert-outdoor", label: "Expert Outdoor", condition: "Fais valider 3 critiques Outdoor.", rewardPacks: 1, rewardFamily: "botte", rewardLabel: "1 booster La Botte + 1 Coup de pouce" },
  { id: "contest-badge-expert-greenhouse", code: "expert-greenhouse", label: "Expert Greenhouse", condition: "Fais valider 3 critiques Greenhouse.", rewardPacks: 1, rewardFamily: "botte", rewardLabel: "1 booster La Botte + 1 Coup de pouce" },
  { id: "contest-badge-expert-indoor", code: "expert-indoor", label: "Expert Indoor", condition: "Fais valider 3 critiques Indoor.", rewardPacks: 1, rewardFamily: "botte", rewardLabel: "1 booster La Botte + 1 Coup de pouce" },
  { id: "contest-badge-critique-utile", code: "critique-utile", label: "Critique utile", condition: "Obtiens la validation « utile » de l’équipe.", rewardPacks: 1, rewardFamily: "botte", rewardLabel: "1 Coup de pouce" },
  { id: "contest-badge-plume-dor", code: "plume-dor", label: "Plume d’or", condition: "Obtiens la distinction « excellente critique ».", rewardPacks: 3, rewardFamily: "buddies", rewardLabel: "3 boosters Kanab Quest" },
  { id: "contest-badge-voix-respectee", code: "voix-respectee", label: "Voix respectée", condition: "Reçois 25 votes positifs sur tes critiques.", rewardPacks: 2, rewardFamily: "buddies", rewardLabel: "2 boosters Kanab Quest" },
  { id: "contest-badge-validateur-serieux", code: "validateur-serieux", label: "Validateur sérieux", condition: "Vote sur 25 critiques d’autres testeurs.", rewardPacks: 1, rewardFamily: "botte", rewardLabel: "1 Coup de pouce" },
] as const;

const CONTEST_MASCOT_SCENES = {
  intro: {
    src: "/contest/mascot/flower-inspector.png",
    alt: "Mascotte qui inspecte une fleur avec une loupe",
  },
  profile: {
    src: "/contest/mascot/profile-progress.png",
    alt: "Mascotte devant une jauge de progression",
  },
  leaderboard: {
    src: "/contest/mascot/leaderboard-judge.png",
    alt: "Mascotte arbitre devant le classement",
  },
  review: {
    src: "/contest/mascot/review-popup.png",
    alt: "Mascotte devant une critique avec pouces haut et bas",
  },
} as const;

function ContestMascotScene({
  variant,
  className = "",
}: {
  variant: keyof typeof CONTEST_MASCOT_SCENES;
  className?: string;
}) {
  const scene = CONTEST_MASCOT_SCENES[variant];

  return (
    <div className={`contest-mascot-scene ${className}`}>
      <Image
        src={scene.src}
        alt={scene.alt}
        width={640}
        height={640}
        sizes="(max-width: 768px) 132px, 190px"
        className="h-full w-full object-contain"
      />
    </div>
  );
}

function ArenaCharacter({
  variant,
  ariaLabel,
  onClick,
  onHoverPreview,
  onHoverEnd,
}: {
  variant: "profile" | "leaderboard";
  ariaLabel: string;
  onClick?: () => void;
  onHoverPreview?: () => void;
  onHoverEnd?: () => void;
}) {
  const image = (
    <Image
      src={variant === "profile" ? "/charles.png" : "/sylvain.png"}
      alt=""
      width={1536}
      height={2048}
      sizes="92px"
    />
  );

  if (!onClick) {
    return <div className={`${arenaStyles.arenaCharacter} contest-mascot-button`} aria-hidden="true">{image}</div>;
  }

  return (
    <button
      type="button"
      className={`${arenaStyles.arenaCharacter} contest-mascot-button`}
      aria-label={ariaLabel}
      onClick={onClick}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") onHoverPreview?.();
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") onHoverEnd?.();
      }}
    >
      {image}
    </button>
  );
}

function ContestHubPanelModal({
  eyebrow,
  title,
  children,
  onClose,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (!dialog.open) {
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
    }

    return () => {
      if (dialog.open) {
        dialog.close();
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="contest-hub-panel-dialog"
      role="dialog"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="contest-hub-panel-shell relative z-[1] max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded border-4 border-[#1a1a1a] bg-[#fffaf0] p-4 shadow-[7px_7px_0_#1a1a1a] sm:p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">
              {eyebrow}
            </p>
            <h2 className="mt-1 text-2xl font-black leading-tight text-ink">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="contest-hub-panel-close inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#1a1a1a] bg-white text-ink"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

function ContestHubHoverPreview({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      className="pointer-events-none fixed right-6 top-24 z-[124] hidden max-h-[calc(100vh-8rem)] w-[min(440px,calc(100vw-3rem))] overflow-hidden rounded border-4 border-[#1a1a1a] bg-[#fffaf0] p-4 shadow-[7px_7px_0_#1a1a1a] md:block"
      role="status"
      aria-live="polite"
    >
      <div className="mb-4">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-2xl font-black leading-tight text-ink">{title}</h2>
      </div>
      <div className="max-h-[calc(100vh-15rem)] overflow-hidden">{children}</div>
    </div>
  );
}

function ContestIntroPopupContent() {
  return (
    <div className="grid gap-3 text-sm leading-relaxed text-charcoal">
      <p>
        Choisis Regular pour les fleurs deja presentes sur le site, ou Concours pour les lots
        reserves aux tests de saison.
      </p>
      <p>
        Le carnet sert a gouter, noter et envoyer une critique publique. Seuls les avis valides
        sur les varietes Concours font progresser ton profil testeur, tes badges et ton classement.
      </p>
      <div className="rounded border-2 border-[#1a1a1a] bg-white p-3 text-xs font-black uppercase tracking-[0.08em] text-ink">
        Concours uniquement: 20 pts par fleur goutee / 50 pts si tous les terpenes sont trouves / votes publics en bonus.
      </div>
    </div>
  );
}

function ContestProfileSetupForm({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [pseudo, setPseudo] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isBusy = isSaving || isPending;

  const savePseudo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const trimmedPseudo = pseudo.trim();
    if (!trimmedPseudo) {
      setError("Pseudo requis.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/contest/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pseudo: trimmedPseudo }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(payload?.error || "Impossible d'enregistrer ce pseudo.");
        return;
      }

      setMessage("Pseudo enregistre. Rechargement du profil...");
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setError("Erreur reseau lors de l'enregistrement du pseudo.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={savePseudo} className={`grid gap-3 ${className}`}>
      <label className="block text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">
        Pseudo testeur requis
      </label>
      <div className={compact ? "grid gap-2" : "grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"}>
        <input
          type="text"
          value={pseudo}
          onChange={(event) => setPseudo(event.target.value)}
          placeholder="Ex: BretonTerpene"
          minLength={3}
          maxLength={24}
          pattern="[A-Za-z0-9._-]{3,24}"
          required
          autoComplete="nickname"
          disabled={isBusy}
          className="h-12 w-full border-2 border-[#1a1a1a] bg-[#fffaf0] px-3 text-base text-ink disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isBusy}
          className="btn-cartoon btn-primary inline-flex min-h-[48px] items-center justify-center px-5 text-xs leading-none disabled:opacity-60"
        >
          {isBusy ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
      <p className="text-xs font-semibold leading-relaxed text-charcoal">
        3 a 24 caracteres: lettres, chiffres, point, tiret ou underscore. Ce pseudo signera tes
        critiques publiques.
      </p>
      {message ? <p className="text-sm font-semibold text-[#1f5a2f]">{message}</p> : null}
      {error ? <p className="text-sm font-semibold text-[#7a1010]">{error}</p> : null}
    </form>
  );
}

function ContestTesterProfileDetails({
  progress,
  isAuthenticated,
  showSetupForm = false,
}: {
  progress: PublicContestTesterProgress | null;
  isAuthenticated: boolean;
  showSetupForm?: boolean;
}) {
  if (!isAuthenticated) {
    return (
      <div className="grid gap-3 text-sm leading-relaxed text-charcoal">
        <p>Connecte-toi pour activer ton profil testeur, suivre tes niveaux et debloquer tes badges.</p>
        <Link
          href="/compte/connexion?next=%2Farene"
          className="btn-cartoon btn-primary inline-flex min-h-[42px] items-center justify-center px-4 text-xs leading-none"
        >
          Voir mon profil
        </Link>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="grid gap-3 text-sm leading-relaxed text-charcoal">
        {showSetupForm ? (
          <ContestProfileSetupForm compact />
        ) : (
          <>
            <p>Cree ton pseudo dans le carnet d&apos;un lot concours pour activer ta progression.</p>
            <p>Une fois ton premier avis valide, tes points, ton niveau et tes badges apparaitront ici.</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className={arenaStyles.progressStatsGrid}>
        <div className={arenaStyles.progressStatCard}>
          <p className={arenaStyles.progressStatLabel}>Niveau actuel</p>
          <p className={arenaStyles.progressStatValue}>{progress.currentLevel.label}</p>
        </div>
        <div className={arenaStyles.progressStatCard}>
          <p className={arenaStyles.progressStatLabel}>Prochain palier</p>
          <p className={arenaStyles.progressStatValue}>
            {progress.nextLevel ? `${progress.pointsToNextLevel} pts` : "Niveau max"}
          </p>
        </div>
        <div className={arenaStyles.progressStatCard}>
          <p className={arenaStyles.progressStatLabel}>Rang saison</p>
          <p className={arenaStyles.progressStatValue}>{progress.seasonRank ? `#${progress.seasonRank}` : "-"}</p>
        </div>
        <div className={arenaStyles.progressStatCard}>
          <p className={arenaStyles.progressStatLabel}>Rang global</p>
          <p className={arenaStyles.progressStatValue}>{progress.globalRank ? `#${progress.globalRank}` : "-"}</p>
        </div>
      </div>
      <div className="rounded border-2 border-[#1a1a1a] bg-yellow p-3 text-xs font-black uppercase leading-relaxed tracking-[0.08em] text-ink">
        Concours uniquement: 20 pts par fleur goutee / 10 pts par terpene trouve / 50 pts si tous les terpenes sont bons.
      </div>
    </div>
  );
}

function ContestTesterLeaderboardDetails() {
  return (
    <div className="grid gap-3 text-sm leading-relaxed text-charcoal">
      <p>
        Le classement saison compare les testeurs sur la recolte en cours. Le classement global
        additionne toute l&apos;activite validee.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded border-2 border-[#1a1a1a] bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-charcoal">Saison</p>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-charcoal">
            Ideal pour suivre les testeurs les plus actifs sur les lots du moment.
          </p>
        </div>
        <div className="rounded border-2 border-[#1a1a1a] bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-charcoal">Global</p>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-charcoal">
            Recompense la regularite et les critiques utiles sur la duree.
          </p>
        </div>
      </div>
      <div className="rounded border-2 border-[#1a1a1a] bg-white p-3">
        <p className="text-[10px] font-black uppercase tracking-[0.1em] text-charcoal">
          Comptage des points
        </p>
        <ul className="mt-2 grid gap-1 text-xs font-semibold leading-relaxed text-charcoal">
          <li>+20 pts quand une critique Concours est validee.</li>
          <li>+10 pts par terpene dominant correctement trouve sur une variete Concours.</li>
          <li>+5 pts par pouce haut recu, -1 pt par pouce bas sur une critique Concours.</li>
          <li>+30 ou +75 pts si l&apos;admin marque une critique Concours utile ou excellente.</li>
        </ul>
      </div>
      <p className="rounded border-2 border-[#1a1a1a] bg-yellow p-3 text-xs font-black uppercase leading-relaxed tracking-[0.08em] text-ink">
        Clique sur un testeur du classement pour voir son profil public.
      </p>
    </div>
  );
}

function ContestLeaderboardHelpDropdown() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="grid gap-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#1a1a1a] bg-yellow text-ink shadow-[2px_2px_0_#1a1a1a] transition hover:-translate-y-0.5"
          aria-label="Voir comment les points sont comptabilises"
          aria-expanded={isOpen}
        >
          <CircleHelp size={20} aria-hidden="true" />
        </button>
      </div>
      {isOpen ? (
        <div className="rounded border-2 border-[#1a1a1a] bg-[#fffaf0] p-3 shadow-[3px_3px_0_rgba(26,26,26,0.16)]">
          <ContestTesterLeaderboardDetails />
        </div>
      ) : null}
    </div>
  );
}

export function ContestNotebookCollectionDashboard({
  lottery,
  isAuthenticated,
  availableTicketCount,
  status,
  onOpenNextPack,
}: {
  lottery: ContestLotteryExperience;
  isAuthenticated: boolean;
  availableTicketCount: number;
  status: string | null;
  onOpenNextPack: () => void;
}) {
  const { album, inventory, config, loading, error, acting } = lottery;
  const summary = album?.summary;
  const collectionTitle =
    album?.collectionTitle || inventory?.collection?.title || config?.collectionTitle || "Kanab Quest Collection";
  const totalCards = summary?.totalCards ?? inventory?.totalCards ?? 0;
  const uniqueOwned = summary?.ownedUnique ?? inventory?.uniqueOwned ?? 0;
  const duplicateCopies = summary?.duplicateCopies ?? inventory?.duplicateCopies ?? 0;
  const completionPercent = Math.round(summary?.completionPercent ?? inventory?.completionPercent ?? 0);
  const claimablePages =
    summary?.claimablePages ?? album?.pages.filter((page) => page.rewardStatus === "claimable").length ?? 0;
  const availableClaims = summary?.availableClaims ?? inventory?.availableClaims.length ?? 0;
  const rarityRows =
    album?.pages.map((page) => ({
      key: page.rarity,
      label: page.label,
      owned: page.ownedUnique,
      total: page.totalSlots,
      percent: Math.round(page.completionPercent),
    })) ??
    inventory?.byRarity.map((entry) => ({
      key: entry.rarity,
      label: rarityLabels[entry.rarity],
      owned: entry.ownedUnique,
      total: entry.totalCards,
      percent: entry.totalCards > 0 ? Math.round((entry.ownedUnique / entry.totalCards) * 100) : 0,
    })) ??
    [];

  return (
    <section className="contest-notebook-collection-dashboard">
      <div className="contest-notebook-collection-header">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-charcoal">
            Collection de cartes
          </p>
          <h3 className="mt-1 text-xl font-black leading-tight text-ink">Progression de l&apos;album</h3>
          <p className="mt-1 truncate text-xs font-semibold text-charcoal">{collectionTitle}</p>
        </div>
        <span className="contest-notebook-collection-chip">{completionPercent}%</span>
      </div>

      <div className="mt-3 h-4 overflow-hidden rounded-full border-2 border-[#17130e] bg-white">
        <div className="h-full bg-[#00563f]" style={{ width: `${completionPercent}%` }} />
      </div>

      <div className="contest-notebook-collection-stats">
        <div>
          <p>Boosters</p>
          <strong>{availableTicketCount}</strong>
        </div>
        <div>
          <p>Collection</p>
          <strong>
            {uniqueOwned}/{totalCards}
          </strong>
        </div>
        <div>
          <p>Doublons</p>
          <strong>{duplicateCopies}</strong>
        </div>
        <div>
          <p>Lots</p>
          <strong>{claimablePages + availableClaims}</strong>
        </div>
      </div>

      {loading && !album && !inventory ? (
        <p className="mt-3 text-xs font-semibold text-charcoal">Chargement de ta collection...</p>
      ) : null}
      {error ? <p className="mt-3 text-xs font-bold text-[#7a1010]">{error}</p> : null}
      {status ? <p className="mt-3 text-xs font-bold text-[#1f5a2f]">{status}</p> : null}

      {rarityRows.length > 0 ? (
        <div className="contest-notebook-collection-rarities">
          {rarityRows.slice(0, 5).map((row) => (
            <span key={row.key}>
              {row.label}: {row.owned}/{row.total}
            </span>
          ))}
        </div>
      ) : null}

      <div className="contest-notebook-collection-actions">
        {isAuthenticated ? (
          <button
            type="button"
            onClick={onOpenNextPack}
            disabled={acting || availableTicketCount < 1}
            className="contest-notebook-booster-button"
          >
            <span className="relative block h-14 w-10 shrink-0">
              <Image
                src="/app/lottery/sealed-booster-pack.png"
                alt=""
                fill
                sizes="40px"
                className="object-contain"
              />
            </span>
            <span className="min-w-0 text-left">
              <span className="block text-xs font-black uppercase tracking-[0.08em]">
                {availableTicketCount > 0 ? "Ouvrir un booster" : "Aucun booster"}
              </span>
              <span className="mt-0.5 block text-[11px] font-semibold leading-tight text-charcoal">
                {availableTicketCount > 0
                  ? `${availableTicketCount} pack${availableTicketCount > 1 ? "s" : ""} disponible${availableTicketCount > 1 ? "s" : ""}`
                  : "Les boosters gagnes apparaitront ici."}
              </span>
            </span>
          </button>
        ) : (
          <Link
            href="/compte/connexion?next=%2Farene"
            className="contest-notebook-booster-button"
          >
            <span className="min-w-0 text-left">
              <span className="block text-xs font-black uppercase tracking-[0.08em]">Connecte-toi</span>
              <span className="mt-0.5 block text-[11px] font-semibold leading-tight text-charcoal">
                Pour ouvrir tes boosters depuis le carnet.
              </span>
            </span>
          </Link>
        )}

        <Link href="/profil/collection" className="contest-notebook-collection-link">
          Voir l&apos;album complet
        </Link>
      </div>
    </section>
  );
}

function ContestNotebookViewTabs({
  activeView,
  availablePackCount,
  unlockedBadgeCount,
  onChange,
}: {
  activeView: ContestNotebookView;
  availablePackCount: number;
  unlockedBadgeCount: number;
  onChange: (view: ContestNotebookView) => void;
}) {
  const tabs: Array<{ view: ContestNotebookView; label: string; hint?: string }> = [
    { view: "lab", label: "Fiche" },
    { view: "notes", label: "Notes" },
    { view: "collection", label: "Collection", hint: `${unlockedBadgeCount}/${CONTEST_ACHIEVEMENT_BADGE_CATALOG.length}` },
  ];

  return (
    <div className="contest-notebook-view-tabs" aria-label="Onglets du carnet">
      {tabs.map((tab) => (
        <button
          key={tab.view}
          type="button"
          onClick={() => onChange(tab.view)}
          className={activeView === tab.view ? "contest-notebook-view-tab-active" : ""}
          aria-current={activeView === tab.view ? "page" : undefined}
        >
          <span>{tab.label}</span>
          {tab.view === "collection" ? (
            <strong>
              {availablePackCount > 0
                ? `${availablePackCount} pack${availablePackCount > 1 ? "s" : ""}`
                : tab.hint}
            </strong>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function getUnlockedContestBadgeCount(badges: PublicContestProfileBadge[]) {
  const unlockedBadges = new Map(
    badges.map((profileBadge) => [
      profileBadge.badge?.code || profileBadge.badgeId,
      profileBadge,
    ]),
  );

  return CONTEST_ACHIEVEMENT_BADGE_CATALOG.filter((badge) =>
    unlockedBadges.has(badge.code) || unlockedBadges.has(badge.id),
  ).length;
}

const CONTEST_NOTEBOOK_MISSIONS = [
  {
    badgeCode: "combo-aromatique",
    title: "Les bons terpènes et goûts",
    condition: "Retrouve 3 terpènes ou goûts justes dans la liste lors d’une même dégustation.",
  },
  {
    badgeCode: "premier-carnet",
    title: "Critique élaborée",
    condition: "Complète ta dégustation, rédige ta critique et fais-la valider.",
  },
] as const;

function ContestNotebookMissionCards({
  badges,
  isAuthenticated,
}: {
  badges: PublicContestProfileBadge[];
  isAuthenticated: boolean;
}) {
  const unlockedCodes = new Set(
    badges.map((profileBadge) => profileBadge.badge?.code || profileBadge.badgeId),
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2" aria-label="Missions de dégustation">
      {CONTEST_NOTEBOOK_MISSIONS.map((mission, index) => {
        const unlocked = unlockedCodes.has(mission.badgeCode)
          || unlockedCodes.has(`contest-badge-${mission.badgeCode}`);
        return (
          <article
            key={mission.badgeCode}
            className={`flex min-h-48 flex-col rounded border-2 border-ink p-4 shadow-[3px_3px_0_#1a1a1a] ${
              unlocked ? "bg-[#dff2df]" : "bg-[#fffaf0]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="inline-grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-ink bg-yellow text-sm font-black">
                {index + 1}
              </span>
              <span className={`rounded-full border border-ink px-2 py-1 text-[10px] font-black uppercase ${unlocked ? "bg-green text-white" : "bg-white text-charcoal"}`}>
                {unlocked ? "Mission réussie" : isAuthenticated ? "À accomplir" : "Connexion requise"}
              </span>
            </div>
            <h4 className="mt-3 font-display text-xl uppercase leading-none text-ink">{mission.title}</h4>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-charcoal">{mission.condition}</p>
            <div className="mt-auto border-t-2 border-dashed border-ink pt-3">
              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-green">Récompense</span>
              <strong className="block text-sm text-ink">1 pack · 10 cartes La Botte</strong>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ContestBotteCollection({
  isAuthenticated,
  entryId,
  entryTitle,
  entryTrack,
  reviewApproved,
}: {
  isAuthenticated: boolean;
  entryId: string;
  entryTitle: string;
  entryTrack: ContestEntryTrack;
  reviewApproved: boolean;
}) {
  const [snapshot, setSnapshot] = useState<{
    collection?: { cards?: Array<{ code: string; ownedCopies: number }> };
    heritage?: { cards?: Array<{ code: string; ownedCopies: number }>; fragmentBalance?: number } | null;
  } | null>(null);
  const [shop, setShop] = useState<{
    availableEntitlements: Array<{ id: string; source: string; cardCount: number; createdAt: string }>;
  } | null>(null);
  const [campaigns, setCampaigns] = useState<KqProducerRewardProgress[]>([]);
  const [openedCards, setOpenedCards] = useState<Array<{
    code: string;
    name: string;
    rarity: string;
    imageUrl?: string;
  }>>([]);
  const [loading, setLoading] = useState(isAuthenticated);
  const [opening, setOpening] = useState(false);
  const [notice, setNotice] = useState("");

  const refreshCollection = useCallback(async (signal?: AbortSignal) => {
    const [bootstrapResponse, boostersResponse] = await Promise.all([
      fetch("/api/arena/placard/bootstrap", { cache: "no-store", signal }),
      fetch("/api/arena/placard/boosters", { cache: "no-store", signal }),
    ]);
    if (!bootstrapResponse.ok) throw new Error("Collection indisponible");
    if (!boostersResponse.ok) throw new Error("Coffre indisponible");
    const [nextSnapshot, nextShop] = await Promise.all([
      bootstrapResponse.json(),
      boostersResponse.json(),
    ]);
    setSnapshot(nextSnapshot);
    setShop(nextShop);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    void refreshCollection(controller.signal)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setSnapshot(null);
          setShop(null);
          setNotice("Le coffre est momentanément indisponible.");
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [isAuthenticated, refreshCollection]);

  const supportCopies = new Map((snapshot?.collection?.cards ?? []).map((card) => [card.code, Number(card.ownedCopies)]));
  const supportOwned = KQ_CARDS.filter((card) => (supportCopies.get(card.code) ?? 0) > 0).length;
  const selectedCampaign = findKqProducerRewardForEntry(campaigns, entryId);
  const selectedFlower = selectedCampaign?.entries.find((entry) => entry.entryId === entryId) ?? null;
  const availableTenCardPacks = (shop?.availableEntitlements ?? []).filter((item) => item.cardCount === 10);
  const selectedFlowerEntitlementId = selectedFlower?.packReward.availableEntitlementIds[0];
  const nextEntitlement = availableTenCardPacks.find((item) => item.id === selectedFlowerEntitlementId)
    ?? availableTenCardPacks[0]
    ?? null;

  const openNextPack = async () => {
    if (!nextEntitlement || opening) return;
    setOpening(true);
    setNotice("");
    try {
      const response = await fetch("/api/arena/placard/boosters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entitlementId: nextEntitlement.id }),
      });
      const payload = await response.json() as {
        cards?: Array<{ code: string; name: string; rarity: string; imageUrl?: string }>;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "Ouverture impossible.");
      setOpenedCards(payload.cards ?? []);
      await refreshCollection();
      window.dispatchEvent(new Event("kq:boosters-updated"));
      window.dispatchEvent(new Event("kq:collection-updated"));
      window.dispatchEvent(new Event("kq:producer-rewards-changed"));
      setNotice(`${payload.cards?.length ?? 10} cartes La Botte ont rejoint ton inventaire.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Ouverture impossible.");
    } finally {
      setOpening(false);
    }
  };

  if (!isAuthenticated) return <div className="rounded border-2 border-ink bg-white p-5 text-sm font-bold">Connecte-toi pour voir tes cartes La Botte et tes Héritages.</div>;
  if (loading) return <div className="rounded border-2 border-ink bg-white p-5 text-sm font-bold">Chargement de La Botte…</div>;

  const renderCard = (card: { code: string; name: string; description: string }, copies: number) => {
    const artwork = getKqCardArtwork(card.code);
    return <article key={card.code} className={`w-40 shrink-0 rounded border-2 border-ink p-2 shadow-[3px_3px_0_#1a1a1a] ${copies > 0 ? "bg-white" : "bg-[#dedbd2] opacity-75"}`}>
      {artwork ? <div className={`relative aspect-[2/3] overflow-hidden border border-ink ${copies > 0 ? "" : "grayscale"}`}><Image src={artwork} alt={`Carte ${card.name}`} fill sizes="160px" className="object-cover" /></div> : null}
      <span className="mt-2 block text-[9px] font-black uppercase tracking-wider text-green">La Botte · consommable</span>
      <strong className="mt-1 block text-sm leading-tight">{card.name}</strong>
      <small className="mt-1 block text-[10px] leading-snug text-charcoal">{card.description}</small>
      <b className="mt-2 block text-xs">{copies > 0 ? `Possédée ×${copies}` : "À découvrir"}</b>
    </article>;
  };

  const flowerPackReward = selectedFlower?.packReward ?? {
    eligible: entryTrack === "concours",
    totalPacks: entryTrack === "concours" ? 5 : 0,
    grantedPacks: 0,
    availablePacks: 0,
    openedPacks: 0,
    availableEntitlementIds: [],
  };
  const flowerPackStatus = !flowerPackReward?.eligible
    ? "regular"
    : flowerPackReward.availablePacks > 0
      ? "ready"
      : flowerPackReward.openedPacks >= flowerPackReward.totalPacks
        ? "opened"
        : (selectedFlower?.reviewed ?? reviewApproved)
          ? "pending"
          : "locked";

  return <div className="grid min-w-0 gap-5">
    <ProducerRewardJourney
      isAuthenticated={isAuthenticated}
      entryId={entryId}
      embedded
      onCampaignsChange={setCampaigns}
    />

    <section
      className={`min-w-0 overflow-hidden rounded border-2 border-ink p-4 shadow-[4px_4px_0_#17130e] ${
        flowerPackStatus === "ready" ? "bg-[#dff2df]" : flowerPackStatus === "opened" ? "bg-[#fff3c4]" : "bg-[#e2e0da]"
      }`}
      aria-labelledby="contest-botte-chest-title"
    >
      <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-green">Récompense fleur concours</p>
          <h3 id="contest-botte-chest-title" className="mt-1 break-words font-display text-2xl uppercase leading-none text-ink">Coffre La Botte</h3>
          <p className="mt-2 max-w-xl text-xs font-semibold leading-relaxed text-charcoal">
            {flowerPackStatus === "ready"
              ? `${selectedFlower?.title ?? entryTitle} a débloqué ses 5 packs. Ouvre-les un par un, chacun contient 10 cartes.`
              : flowerPackStatus === "opened"
                ? `Les 5 packs de ${selectedFlower?.title ?? entryTitle} ont été ouverts.`
                : flowerPackStatus === "pending"
                  ? "Ton avis est validé. Les cinq packs sont en cours d’attribution."
                  : flowerPackStatus === "locked"
                    ? "Fais valider ton avis sur cette fleur concours pour débloquer 5 packs de 10 cartes."
                    : "Les cinq packs sont réservés aux fleurs concours. Tes packs de mission restent disponibles dans ce coffre."}
          </p>
        </div>
        <div className={`mx-auto grid h-24 w-28 place-items-center rounded border-2 border-ink shadow-[3px_3px_0_#17130e] sm:mx-0 ${flowerPackStatus === "ready" ? "bg-green text-white" : "bg-white text-charcoal"}`}>
          {flowerPackStatus === "ready" ? <PackageOpen size={46} aria-hidden="true" /> : flowerPackStatus === "opened" ? <Gift size={46} aria-hidden="true" /> : <LockKeyhole size={42} aria-hidden="true" />}
        </div>
      </div>

      {flowerPackReward?.eligible ? (
        <div className="mt-4 grid grid-cols-5 gap-1.5" aria-label="Progression des cinq packs de cette fleur">
          {Array.from({ length: flowerPackReward.totalPacks }, (_, index) => {
            const opened = index < flowerPackReward.openedPacks;
            const ready = !opened && index < flowerPackReward.openedPacks + flowerPackReward.availablePacks;
            return <span key={index} className={`grid min-h-11 place-items-center rounded border-2 border-ink text-[10px] font-black uppercase ${opened ? "bg-yellow" : ready ? "bg-green text-white" : "bg-white/50 text-charcoal"}`} title={opened ? "Pack ouvert" : ready ? "Pack prêt" : "Pack verrouillé"}>
              {opened ? "Ouvert" : ready ? `Pack ${index + 1}` : <LockKeyhole size={15} aria-label="Verrouillé" />}
            </span>;
          })}
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-black text-ink">{availableTenCardPacks.length} pack{availableTenCardPacks.length > 1 ? "s" : ""} de 10 cartes disponible{availableTenCardPacks.length > 1 ? "s" : ""}</p>
        <button type="button" disabled={!nextEntitlement || opening} onClick={() => void openNextPack()} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded border-2 border-ink bg-yellow px-4 text-xs font-black uppercase shadow-[3px_3px_0_#17130e] disabled:cursor-not-allowed disabled:bg-white disabled:opacity-55 sm:w-auto">
          <PackageOpen size={20} aria-hidden="true" />
          {opening ? "Ouverture…" : nextEntitlement ? "Ouvrir un pack" : "Aucun pack à ouvrir"}
        </button>
      </div>
      {notice ? <p className="mt-3 text-xs font-bold text-ink" role="status">{notice}</p> : null}

      {openedCards.length > 0 ? (
        <div className="mt-5 border-t-2 border-dashed border-ink pt-4" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-green">Pack ouvert</p><h4 className="font-display text-xl uppercase">Tes 10 nouvelles cartes</h4></div>
            <button type="button" onClick={() => setOpenedCards([])} className="grid h-11 w-11 shrink-0 place-items-center rounded border-2 border-ink bg-white" aria-label="Fermer les cartes révélées"><X size={20} /></button>
          </div>
          <div className="mt-3 overflow-x-auto pb-3">
            <div className="grid w-max grid-flow-col auto-cols-[9rem] gap-3 md:w-full md:grid-flow-row md:grid-cols-5">
              {openedCards.map((card, index) => {
                const artwork = getKqCardArtwork(card.code) ?? card.imageUrl;
                return <article key={`${card.code}-${index}`} className="min-w-0 rounded border-2 border-ink bg-white p-2 shadow-[2px_2px_0_#17130e]">
                  {artwork ? <div className="relative aspect-[2/3] overflow-hidden rounded border border-ink"><Image src={artwork} alt={`Carte ${card.name}`} fill sizes="(max-width: 767px) 144px, 180px" className="object-contain" /></div> : null}
                  <small className="mt-2 block truncate text-[9px] font-black uppercase text-green">{card.rarity}</small>
                  <strong className="mt-0.5 block text-xs leading-tight">{card.name}</strong>
                </article>;
              })}
            </div>
          </div>
        </div>
      ) : null}
    </section>

    <section className="rounded border-2 border-ink bg-white p-3 shadow-[3px_3px_0_#17130e]">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-green">Cartes possédées</p><h3 className="font-display text-xl uppercase">Inventaire La Botte</h3></div>
        <b className="text-lg">{supportOwned}/{KQ_CARDS.length}</b>
      </div>
      <p className="mt-1 text-xs font-semibold text-charcoal">Consulte ici toutes les cartes déjà révélées et le nombre d’exemplaires possédés.</p>
      <details className="mt-3 border-t-2 border-dashed border-ink pt-3">
        <summary className="flex min-h-11 cursor-pointer items-center justify-center border-2 border-ink bg-yellow px-4 text-xs font-black uppercase shadow-[2px_2px_0_#17130e]">Voir l&apos;inventaire</summary>
        <div className="mt-3 flex gap-3 overflow-x-auto pb-3">{KQ_CARDS.map((card) => renderCard(card, supportCopies.get(card.code) ?? 0))}</div>
      </details>
    </section>
  </div>;
}

function ContestNotebookCollectionTab({
  isAuthenticated,
  badges,
  entryId,
  entryTitle,
  entryTrack,
  reviewApproved,
}: {
  isAuthenticated: boolean;
  badges: PublicContestProfileBadge[];
  entryId: string;
  entryTitle: string;
  entryTrack: ContestEntryTrack;
  reviewApproved: boolean;
}) {
  return (
    <div className="contest-notebook-collection-tab">
      <div className="contest-lab-sheet-header">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-charcoal">
            Carnet de dégustation
          </p>
          <h2 className="mt-1 text-xl font-black leading-tight text-ink">Héritages &amp; coffre La Botte</h2>
        </div>
      </div>
      <ContestBotteCollection
        isAuthenticated={isAuthenticated}
        entryId={entryId}
        entryTitle={entryTitle}
        entryTrack={entryTrack}
        reviewApproved={reviewApproved}
      />

      <div className="mt-4 border-t-2 border-ink pt-4">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-green">Missions de dégustation</p>
        <h3 className="font-display text-xl uppercase">Deux défis, deux packs La Botte</h3>
        <p className="mt-1 text-xs font-semibold text-charcoal">Réussis chaque mission pour débloquer un pack de 10 cartes pour ton coffre.</p>
      </div>
      <ContestNotebookMissionCards
        badges={badges}
        isAuthenticated={isAuthenticated}
      />
    </div>
  );
}

function ContestNotebookEntryCarousel({
  entries,
  activeIndex,
  activeView,
  unlockByEntryId,
  unlockedBadgeCount,
  onSelectEntry,
  onOpenCollection,
}: {
  entries: ContestEntrySummary[];
  activeIndex: number;
  activeView: ContestNotebookView;
  unlockByEntryId: Map<string, PublicContestNotebookUnlock>;
  unlockedBadgeCount: number;
  onSelectEntry: (index: number) => void;
  onOpenCollection: () => void;
}) {
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const collectionIndex = entries.length;
  const activeCarouselIndex = activeView === "collection" ? collectionIndex : activeIndex;
  const totalItems = entries.length + 1;
  const canGoPrevious = activeCarouselIndex > 0;
  const canGoNext = activeCarouselIndex < totalItems - 1;

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    itemRefs.current[activeCarouselIndex]?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeCarouselIndex]);

  const goToCarouselIndex = (nextIndex: number) => {
    const safeIndex = Math.max(0, Math.min(totalItems - 1, nextIndex));

    if (safeIndex === collectionIndex) {
      onOpenCollection();
      return;
    }

    onSelectEntry(safeIndex);
  };

  return (
    <nav className="contest-notebook-carousel" aria-label="Navigation du carnet">
      <button
        type="button"
        className="contest-notebook-carousel-arrow"
        onClick={() => goToCarouselIndex(activeCarouselIndex - 1)}
        disabled={!canGoPrevious}
        aria-label="Élément précédent"
      >
        <ChevronLeft aria-hidden="true" size={18} />
      </button>

      <div className="contest-notebook-carousel-rail">
        {entries.map((entry, index) => {
          const label = getContestBookmarkLabel(entry);
          const unlocked = unlockByEntryId.has(entry.id);
          const isActive = activeView !== "collection" && index === activeIndex;

          return (
            <button
              key={entry.id}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              type="button"
              onClick={() => onSelectEntry(index)}
              className={`contest-notebook-carousel-card ${
                isActive ? "contest-notebook-carousel-card-active" : ""
              } ${unlocked ? "" : "contest-notebook-carousel-card-locked"}`}
              title={label}
              aria-label={`Ouvrir la variété ${label}`}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="contest-notebook-carousel-kicker">
                Lot {String(index + 1).padStart(2, "0")}
              </span>
              <span className="contest-notebook-carousel-title">{label}</span>
              <span className="contest-notebook-carousel-state">
                {unlocked ? "Débloqué" : "À débloquer"}
              </span>
            </button>
          );
        })}

        <button
          ref={(node) => {
            itemRefs.current[collectionIndex] = node;
          }}
          type="button"
          onClick={onOpenCollection}
          className={`contest-notebook-carousel-card contest-notebook-carousel-card-collection ${
            activeView === "collection" ? "contest-notebook-carousel-card-active" : ""
          }`}
          title="Collection et badges"
          aria-label="Ouvrir la collection et les badges"
          aria-current={activeView === "collection" ? "page" : undefined}
        >
          <span className="contest-notebook-carousel-kicker">Album</span>
          <span className="contest-notebook-carousel-title">Collection</span>
          <span className="contest-notebook-carousel-state">
            {unlockedBadgeCount}/{CONTEST_ACHIEVEMENT_BADGE_CATALOG.length} badges
          </span>
        </button>
      </div>

      <button
        type="button"
        className="contest-notebook-carousel-arrow"
        onClick={() => goToCarouselIndex(activeCarouselIndex + 1)}
        disabled={!canGoNext}
        aria-label="Élément suivant"
      >
        <ChevronRight aria-hidden="true" size={18} />
      </button>
    </nav>
  );
}

function ContestTestedFlowerCarousel({
  items,
  selectedEntryId,
  onOpenEntryNotes,
}: {
  items: TestedFlowerCardItem[];
  selectedEntryId?: string;
  onOpenEntryNotes: (item: TestedFlowerCardItem) => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  const scrollTrack = (direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) {
      return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const step = Math.min(track.clientWidth * 0.86, 380);

    track.scrollBy({
      left: step * direction,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  };

  return (
    <section className="contest-tested-carousel-section" aria-label="Fiches des fleurs testees">
      <div className="contest-tested-carousel-header">
        <div>
          <p className="contest-tested-carousel-eyebrow">Carnet testeur</p>
          <h2>Fleurs testees</h2>
        </div>
        <span className="contest-tested-carousel-count">
          {items.length} fiche{items.length > 1 ? "s" : ""}
        </span>
      </div>

      {items.length > 0 ? (
        <div className="tcg-carousel contest-tested-carousel">
          <button
            type="button"
            className="tcg-carousel-arrow tcg-carousel-arrow--left contest-tested-carousel-arrow"
            onClick={() => scrollTrack(-1)}
            aria-label="Voir les fleurs testees precedentes"
          >
            <ChevronLeft aria-hidden="true" size={20} />
          </button>
          <div ref={trackRef} className="tcg-carousel-track contest-tested-carousel-track">
            {items.map((item) => (
              <ContestTestedFlowerCard
                key={item.review.id}
                item={item}
                selected={selectedEntryId === item.entry.id}
                onOpenNotes={() => onOpenEntryNotes(item)}
              />
            ))}
          </div>
          <button
            type="button"
            className="tcg-carousel-arrow tcg-carousel-arrow--right contest-tested-carousel-arrow"
            onClick={() => scrollTrack(1)}
            aria-label="Voir les fleurs testees suivantes"
          >
            <ChevronRight aria-hidden="true" size={20} />
          </button>
        </div>
      ) : (
        <div className="contest-tested-carousel-empty">
          <strong>Aucune fleur testee pour le moment.</strong>
          <span>Les fiches apparaitront ici apres soumission de tes notes.</span>
        </div>
      )}
    </section>
  );
}

function ContestTestedFlowerCard({
  item,
  selected,
  onOpenNotes,
}: {
  item: TestedFlowerCardItem;
  selected: boolean;
  onOpenNotes: () => void;
}) {
  const [mediaMode, setMediaMode] = useState<"photo" | "chart">("chart");
  const { entry, review } = item;
  const labInfo = getContestLabEntryInfo(entry);
  const imageSrc = entry.imageUrl || review.entryImageUrl || entry.product?.image || "/product_flower.jpg";
  const averageScore = formatContestAverage(getContestReviewAverage(review.scores));
  const statusLabel = CONTEST_REVIEW_STATUS_LABELS[review.status];
  const cardStyle = {
    "--tcg-w": "286px",
    "--tcg-ratio": "1.55",
  } as CSSProperties;
  const isChartMode = mediaMode === "chart";

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpenNotes();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onOpenNotes}
      onKeyDown={handleKeyDown}
      className={`tcg-card contest-tested-card ${selected ? "tcg-card--selected" : ""}`}
      style={cardStyle}
    >
      <div className="tcg-card-inner contest-tested-card-inner">
        <div className={`contest-tested-card-stage ${isChartMode ? "contest-tested-card-stage-chart" : ""}`}>
          {isChartMode ? (
            <ContestReviewSkillRadar
              review={review}
              comparisonScores={entry.stats.criterionAverages}
              compact
              showValues={false}
              showTotals={false}
              className="contest-tested-card-radar"
            />
          ) : (
            <Image
              src={imageSrc}
              alt={entry.title}
              fill
              sizes="286px"
              className="object-cover"
            />
          )}
          <div className="contest-tested-card-overlay contest-tested-card-overlay-top">
            <div className="min-w-0">
              <p>Fleur testee</p>
              <h3 title={getContestBookmarkLabel(entry)}>
                {getContestBookmarkLabel(entry)}
              </h3>
            </div>
            <span className={`contest-tested-card-status contest-tested-card-status-${review.status}`}>
              {statusLabel}
            </span>
          </div>
          <span className="contest-tested-card-media-label">
            {isChartMode ? "Notes" : "Photo"}
          </span>
          <button
            type="button"
            className="contest-tested-card-media-toggle"
            onClick={(event) => {
              event.stopPropagation();
              setMediaMode((current) => (current === "photo" ? "chart" : "photo"));
            }}
            aria-label={isChartMode ? "Afficher la photo de la fleur" : "Afficher le graphique des notes"}
            title={isChartMode ? "Afficher la photo" : "Afficher le graphique"}
          >
            <ArrowRightLeft aria-hidden="true" size={16} />
          </button>
          <div className="contest-tested-card-overlay contest-tested-card-overlay-bottom">
            <span className="contest-tested-card-data-pill">
              <strong>Note</strong>
              {averageScore}/{CONTEST_SCORE_MAX}
            </span>
            <span className="contest-tested-card-data-pill contest-tested-card-data-pill-wide">
              <strong>Producteur</strong>
              {labInfo.producerName}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function getContestEntrySheetText(entry: ContestEntrySummary, ...keys: string[]) {
  for (const key of keys) {
    const value = entry.technicalSheet[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function getContestLabEntryInfo(entry: ContestEntrySummary) {
  const variety =
    typeof entry.technicalSheet.variety === "string" && entry.technicalSheet.variety.trim()
      ? entry.technicalSheet.variety.trim()
      : entry.title;
  const dominantTerpenes = Array.isArray(entry.technicalSheet.dominantTerpenes)
    ? entry.technicalSheet.dominantTerpenes
        .map((terpene) => (typeof terpene === "string" ? terpene.trim() : ""))
        .filter(Boolean)
        .slice(0, 4)
    : [];
  const producerName = entry.producer?.name ?? "Les Chanvriers Bretons";
  const soil =
    getContestEntrySheetText(entry, "soil", "sol", "producerSoil", "solProducteur") ||
    entry.producer?.soil?.trim() ||
    "Non renseigne";
  const department =
    entry.producer?.department?.trim() ||
    getContestEntrySheetText(entry, "department", "departement", "originDepartment", "provenanceDepartment") ||
    entry.producer?.location?.trim() ||
    entry.producer?.region?.trim() ||
    "Non renseigne";
  const analysisUrl = getContestEntryAnalysisUrl(entry);

  return {
    analysisUrl,
    department,
    dominantTerpenes,
    producerName,
    soil,
    variety,
  };
}

function ContestLabEntryPage({
  entry,
  imagePriority,
}: {
  entry: ContestEntrySummary;
  imagePriority?: boolean;
}) {
  return (
    <div className="contest-lab-entry-page">
      <div className="contest-lab-terminal-bar">
        <span>Carnet de dégustation</span>
        <span>{CONTEST_ENTRY_CATEGORY_LABELS[entry.category]}</span>
      </div>

      <article className="contest-lab-specimen-card contest-lab-specimen-card-identity">
        <div className="contest-lab-specimen-header">
          <div className="min-w-0">
            <p>Fiche variété</p>
            <h3>{entry.title}</h3>
          </div>
          <span>{entry.season?.label ?? "Saison"}</span>
        </div>

        <div className="contest-lab-specimen-media">
          <Image
            src={entry.imageUrl || entry.product?.image || "/product_flower.jpg"}
            alt={entry.title}
            fill
            priority={imagePriority}
            sizes="(max-width: 768px) 82vw, 420px"
            className="object-cover"
          />
          <div className="contest-lab-scanlines" aria-hidden="true" />
        </div>
      </article>

    </div>
  );
}

function ContestLabDetailsPanel({ entry }: { entry: ContestEntrySummary }) {
  const labInfo = getContestLabEntryInfo(entry);
  const detailRows = [
    ["Variete", labInfo.variety],
    ["Producteur", labInfo.producerName],
    ["Departement", labInfo.department],
    ["Sol producteur", labInfo.soil],
  ] as const;

  return (
    <div className="contest-lab-lot-details">
      <div className="contest-lab-detail-grid" aria-label="Details du lot">
        {detailRows.map(([label, value]) => (
          <div key={label} className="contest-lab-detail-card">
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      {entry.track === "concours" ? (
        <div className="contest-lab-status-panel">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-charcoal">
            Terpenes
          </p>
          <div className="contest-lab-chip-row mt-3">
            {(labInfo.dominantTerpenes.length > 0 ? labInfo.dominantTerpenes : ["A identifier"]).map(
              (terpene) => (
                <span key={terpene}>{terpene}</span>
              ),
            )}
          </div>
        </div>
      ) : null}

      <div
        className={`contest-lab-analysis-strip ${
          labInfo.analysisUrl ? "contest-lab-analysis-strip-available" : "contest-lab-analysis-strip-pending"
        }`}
      >
        <div className="min-w-0">
          <span>Analyse laboratoire</span>
          <strong>{labInfo.analysisUrl ? "Disponible" : "En attente"}</strong>
        </div>
        {labInfo.analysisUrl ? (
          <a href={labInfo.analysisUrl} target="_blank" rel="noreferrer">
            <FileCheck2 size={14} aria-hidden="true" />
            Consulter
          </a>
        ) : (
          <em>Bientot</em>
        )}
      </div>
    </div>
  );
}

function clampIndex(index: number, entries: ContestEntrySummary[]) {
  if (entries.length === 0) {
    return 0;
  }

  return index >= 0 && index < entries.length ? index : 0;
}

function toCartProduct(entry: ContestEntrySummary): Product | null {
  const linkedProduct = entry.product;
  if (!linkedProduct?.id || !linkedProduct.category) {
    return null;
  }

  if (!Object.prototype.hasOwnProperty.call(categoryLabels, linkedProduct.category)) {
    return null;
  }

  return {
    id: linkedProduct.id,
    name: linkedProduct.name || entry.title,
    category: linkedProduct.category as ProductCategory,
    price: linkedProduct.price,
    image: linkedProduct.image || entry.imageUrl,
    analysisPdf: linkedProduct.analysisPdf,
    description: entry.story || entry.title,
  };
}

function getContestCategoryRank(entry: ContestEntrySummary, fallbackIndex: number) {
  return entry.ranking?.seasonCategoryRank && entry.ranking.seasonCategoryRank > 0
    ? entry.ranking.seasonCategoryRank
    : fallbackIndex + 1;
}

function getStationRankingEntries(rankings: ContestEntrySummary[], entries: ContestEntrySummary[]) {
  const source = rankings.length > 0 ? rankings : entries;

  if (rankings.length > 0) {
    return source;
  }

  return [...source].sort((a, b) => {
    const scoreDelta = b.stats.averageScore - a.stats.averageScore;
    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    return b.stats.approvedReviewCount - a.stats.approvedReviewCount;
  });
}

function getNotebookEligibility({
  entry,
  unlock,
  viewerProfile,
  isAuthenticated,
}: {
  entry: ContestEntrySummary | null;
  unlock?: PublicContestNotebookUnlock;
  viewerProfile: PublicContestProfile | null;
  isAuthenticated: boolean;
}): ContestReviewEligibility {
  if (!entry) {
    return { eligible: false, reason: "entry_unavailable" };
  }

  if (!isAuthenticated) {
    return { eligible: false, reason: "not_authenticated" };
  }

  if (!viewerProfile) {
    return { eligible: false, reason: "missing_profile" };
  }

  if (unlock?.review) {
    return { eligible: false, reason: "already_reviewed" };
  }

  if (!unlock) {
    return { eligible: false, reason: "not_purchased" };
  }

  return { eligible: true, reason: "ok" };
}

function getContestBookmarkLabel(entry: ContestEntrySummary) {
  const variety =
    typeof entry.technicalSheet.variety === "string" ? entry.technicalSheet.variety.trim() : "";

  return variety || entry.title;
}

function ContestStationRankingBoard({
  entries,
  activeCategory,
  selectedEntryId,
  onSelectEntry,
}: {
  entries: ContestEntrySummary[];
  activeCategory: ContestEntryCategory;
  selectedEntryId?: string;
  onSelectEntry: (entryId: string) => void;
}) {
  const displayEntries = entries.length > 0 ? entries : [];
  const categoryLabel = CONTEST_ENTRY_CATEGORY_LABELS[activeCategory];
  const windowRef = useRef<HTMLDivElement | null>(null);

  const scrollRanking = (direction: -1 | 1) => {
    windowRef.current?.scrollBy({ top: direction * 168, behavior: "smooth" });
  };

  return (
    <div className="contest-station-board" aria-label={`Classement ${categoryLabel}`}>
      <div className="contest-station-board-toolbar">
        <strong>{displayEntries.length} lot{displayEntries.length > 1 ? "s" : ""} classé{displayEntries.length > 1 ? "s" : ""}</strong>
        <span>Fais défiler puis clique pour lire les critiques.</span>
        <div>
          <button type="button" onClick={() => scrollRanking(-1)} aria-label="Voir les lots précédents">
            <ChevronUp aria-hidden="true" />
          </button>
          <button type="button" onClick={() => scrollRanking(1)} aria-label="Voir les lots suivants">
            <ChevronDown aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="contest-station-board-header">
        <span>Classement {categoryLabel}</span>
        <span>Score /{CONTEST_SCORE_MAX}</span>
        <span>Avis</span>
      </div>
      <div ref={windowRef} className="contest-station-board-window" tabIndex={0}>
        {displayEntries.length > 0 ? (
          <div className="contest-station-board-track">
            {displayEntries.map((entry, index) => {
              const rank = getContestCategoryRank(entry, index);
              const selected = entry.id === selectedEntryId;

              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onSelectEntry(entry.id)}
                  className={`contest-station-row ${selected ? "contest-station-row-active" : ""}`}
                  aria-label={`Ouvrir les critiques de ${entry.title}`}
                >
                  <span className="contest-station-rank">{String(rank).padStart(2, "0")}</span>
                  <span className="contest-station-title">{entry.title}</span>
                  <span className="contest-station-score">
                    {formatContestAverage(entry.stats.averageScore)}
                  </span>
                  <span className="contest-station-reviews">{entry.stats.approvedReviewCount}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="contest-station-empty">En attente des notes {categoryLabel}</div>
        )}
      </div>
    </div>
  );
}

function ContestRankingReviewsModal({
  entry,
  reviews,
  loading,
  error,
  onClose,
  onSelectReview,
}: {
  entry: ContestEntrySummary;
  reviews: PublicContestReview[];
  loading: boolean;
  error?: string | null;
  onClose: () => void;
  onSelectReview: (review: PublicContestReview) => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const rank = entry.ranking?.seasonCategoryRank;

  return (
    <div
      className={arenaStyles.rankingModalBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ranking-reviews-title"
      onClick={onClose}
    >
      <div className={arenaStyles.rankingModal} onClick={(event) => event.stopPropagation()}>
        <button type="button" className={arenaStyles.rankingModalClose} onClick={onClose} aria-label="Fermer les critiques">
          <X aria-hidden="true" />
        </button>

        <header className={arenaStyles.rankingModalHeader}>
          <div className={arenaStyles.rankingModalImage}>
            <Image
              src={entry.imageUrl || entry.product?.image || "/product_flower.jpg"}
              alt=""
              fill
              sizes="(max-width: 680px) 96px, 150px"
            />
            {rank ? <span>#{String(rank).padStart(2, "0")}</span> : null}
          </div>
          <div>
            <p>{CONTEST_ENTRY_CATEGORY_LABELS[entry.category]} · {entry.producer?.name ?? "Producteur français"}</p>
            <h2 id="ranking-reviews-title">{entry.title}</h2>
            <div className={arenaStyles.rankingModalStats}>
              <strong>{formatContestAverage(entry.stats.averageScore)}/{CONTEST_SCORE_MAX}</strong>
              <span>{entry.stats.approvedReviewCount} critique{entry.stats.approvedReviewCount > 1 ? "s" : ""}</span>
            </div>
          </div>
        </header>

        <div className={arenaStyles.rankingModalBody}>
          <div className={arenaStyles.rankingModalIntro}>
            <p>Les verdicts de la communauté</p>
            <span>Clique sur une critique pour afficher toutes les notes et les arômes.</span>
          </div>

          {loading ? <div className={arenaStyles.rankingModalState}>Chargement des critiques…</div> : null}
          {!loading && error ? <div className={arenaStyles.rankingModalState}>{error}</div> : null}
          {!loading && !error && reviews.length === 0 ? (
            <div className={arenaStyles.rankingModalState}>Aucune critique détaillée n’est encore publiée pour ce lot.</div>
          ) : null}

          {!loading && !error && reviews.length > 0 ? (
            <div className={arenaStyles.rankingReviewList}>
              {reviews.map((review) => (
                <button
                  key={review.id}
                  type="button"
                  className={arenaStyles.rankingReviewCard}
                  onClick={() => onSelectReview(review)}
                >
                  <span className={arenaStyles.rankingReviewTopline}>
                    <strong>{review.pseudo}</strong>
                    <span>{formatContestDate(review.reviewedAt ?? review.createdAt)}</span>
                  </span>
                  <span className={arenaStyles.rankingReviewScore}>
                    {formatContestAverage(getContestReviewAverage(review.scores))}/{CONTEST_SCORE_MAX}
                    <small>{CONTEST_CONSUMPTION_METHOD_LABELS[review.consumptionMethod]}</small>
                  </span>
                  <span className={arenaStyles.rankingReviewQuote}>&quot;{review.comment}&quot;</span>
                  <span className={arenaStyles.rankingReviewAction}>Voir le détail <ChevronRight aria-hidden="true" /></span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ContestReviewMarquee({
  items,
  onSelectReview,
}: {
  items: ContestFeedItem[];
  onSelectReview: (item: ContestFeedItem) => void;
}) {
  const safeItems = useMemo(
    () =>
      items
        .filter((item) => item.excerpt.trim().length > 0)
        .sort((a, b) => {
          const aTime = Date.parse(a.validatedAt ?? a.createdAt);
          const bTime = Date.parse(b.validatedAt ?? b.createdAt);
          if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
            return aTime - bTime;
          }
          return a.reviewId.localeCompare(b.reviewId);
        }),
    [items],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const effectiveActiveIndex =
    activeIndex >= 0 && activeIndex < safeItems.length ? activeIndex : 0;
  const activeItem = safeItems[effectiveActiveIndex] ?? null;

  useEffect(() => {
    if (safeItems.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % safeItems.length);
    }, 5200);

    return () => window.clearInterval(timer);
  }, [safeItems.length]);

  return (
    <div className="contest-review-marquee" aria-label="Avis clients approuvés">
      <div className="contest-review-marquee-label">Avis validés</div>
      <div className="contest-review-marquee-window">
        {activeItem ? (
          <button
            key={activeItem.reviewId}
            type="button"
            onClick={() => onSelectReview(activeItem)}
            className="contest-review-marquee-item contest-review-marquee-item-active"
            aria-label={`Ouvrir l'avis de ${activeItem.pseudo} pour voter`}
          >
            <span className="contest-review-marquee-meta">
              {activeItem.pseudo} / {CONTEST_CONSUMPTION_METHOD_LABELS[activeItem.consumptionMethod]} /{" "}
              {formatContestDate(activeItem.validatedAt ?? activeItem.createdAt)}
            </span>
            <span className="contest-review-marquee-quote">&quot;{activeItem.excerpt}&quot;</span>
            <span className="contest-review-marquee-entry">{activeItem.entryTitle}</span>
          </button>
        ) : (
          <div className="contest-review-marquee-empty">
            Les premiers avis validés défileront ici.
          </div>
        )}
      </div>
      {safeItems.length > 1 ? (
        <div className="contest-review-marquee-dots" aria-label="Navigation des avis validÃ©s">
          {safeItems.map((item, index) => (
            <button
              key={item.reviewId}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`contest-review-marquee-dot ${
                index === effectiveActiveIndex ? "contest-review-marquee-dot-active" : ""
              }`}
              aria-label={`Afficher l'avis validÃ© ${index + 1}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ContestFeedReviewModal({
  item,
  busy,
  error,
  onClose,
  onVote,
}: {
  item: ContestFeedItem;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onVote: (item: ContestFeedItem, value: ContestReviewVoteValue) => void;
}) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const scoreByCriterion = new Map(item.scores.map((score) => [score.criterion, score.score]));

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 px-3 py-4 sm:items-center sm:px-5"
      role="dialog"
      aria-modal="true"
      aria-label="Critique publique"
      onClick={onClose}
      >
      <div
        className="contest-feed-review-modal-shell max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded border-4 border-[#1a1a1a] bg-cream p-4 shadow-[7px_7px_0_#1a1a1a] sm:p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="contest-feed-review-modal-header">
          <ContestMascotScene
            variant="review"
            className="contest-feed-review-modal-mascot contest-mascot-scene-compact"
          />
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">
              Avis public
            </p>
            <h2 className="mt-1 text-2xl font-black leading-tight text-ink">{item.pseudo}</h2>
            <p className="mt-1 text-xs font-semibold text-charcoal">
              {item.entryTitle} / {CONTEST_CONSUMPTION_METHOD_LABELS[item.consumptionMethod]} /{" "}
              {formatContestDate(item.validatedAt ?? item.createdAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="contest-feed-review-modal-close inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#1a1a1a] bg-white text-ink"
            aria-label="Fermer la critique"
          >
            <X size={20} />
          </button>
        </div>

        <p className="mt-5 rounded border-2 border-[#1a1a1a] bg-white p-4 text-base leading-relaxed text-charcoal">
          {item.comment}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => onVote(item, 1)}
            className={`inline-flex min-h-[54px] min-w-[96px] items-center justify-center gap-2 rounded border-2 border-[#1a1a1a] px-4 py-3 text-base font-black uppercase tracking-[0.06em] ${
              item.voteSummary?.viewerVote === 1 ? "bg-yellow text-ink" : "bg-[#fffaf0] text-charcoal"
            } disabled:opacity-60`}
            aria-label="Pouce haut"
          >
            <ThumbsUp size={24} />
            {item.voteSummary?.upvoteCount ?? 0}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onVote(item, -1)}
            className={`inline-flex min-h-[54px] min-w-[96px] items-center justify-center gap-2 rounded border-2 border-[#1a1a1a] px-4 py-3 text-base font-black uppercase tracking-[0.06em] ${
              item.voteSummary?.viewerVote === -1 ? "bg-[#f2b6a0] text-ink" : "bg-[#fffaf0] text-charcoal"
            } disabled:opacity-60`}
            aria-label="Pouce bas"
          >
            <ThumbsDown size={24} />
            {item.voteSummary?.downvoteCount ?? 0}
          </button>
          {item.voteSummary?.isContested ? (
            <span className="rounded border-2 border-[#7a1010] bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.06em] text-[#7a1010]">
              Critique signalee
            </span>
          ) : null}
        </div>

        {error ? <p className="mt-2 text-xs font-bold text-[#7a1010]">{error}</p> : null}

        <div className="mt-5 rounded border-2 border-[#1a1a1a] bg-[#fffaf0]">
          <button
            type="button"
            onClick={() => setIsDetailsOpen((current) => !current)}
            className="flex min-h-[48px] w-full items-center justify-between gap-3 px-4 py-3 text-left text-xs font-black uppercase tracking-[0.1em] text-ink"
            aria-expanded={isDetailsOpen}
          >
            Details de la critique
            <ChevronDown
              size={18}
              aria-hidden="true"
              className={`shrink-0 transition-transform ${isDetailsOpen ? "rotate-180" : ""}`}
            />
          </button>

          {isDetailsOpen ? (
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
                      {scoreByCriterion.get(criterion) ?? "-"} / {CONTEST_SCORE_MAX}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {item.aromaTags.map((tag) => (
                  <span
                    key={`${item.reviewId}-${tag.tag}-${tag.customLabel ?? ""}`}
                    className="rounded-full border border-[#1a1a1a] bg-yellow px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-ink"
                  >
                    {tag.tag === "other" ? tag.customLabel : CONTEST_AROMA_TAG_LABELS[tag.tag]}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ContestTesterProfileCard({
  progress,
  isAuthenticated,
  onMascotClick,
  onMascotHover,
  onMascotLeave,
}: {
  progress: PublicContestTesterProgress | null;
  isAuthenticated: boolean;
  onMascotClick?: () => void;
  onMascotHover?: () => void;
  onMascotLeave?: () => void;
}) {
  const [placardProgress, setPlacardProgress] = useState<PlacardPlayerProgress | null>(null);
  const [placardProgressLoaded, setPlacardProgressLoaded] = useState(false);
  const [generalProgress, setGeneralProgress] = useState<ArenaRankingEntry | null>(null);
  const [generalProgressLoaded, setGeneralProgressLoaded] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || placardProgressLoaded) return;
    const controller = new AbortController();
    let cancelled = false;
    void fetch("/api/arena/placard/me", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Progression indisponible");
        const payload = await response.json() as { progress?: PlacardPlayerProgress | null };
        if (!cancelled) setPlacardProgress(payload.progress ?? null);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
      })
      .finally(() => {
        if (!cancelled) setPlacardProgressLoaded(true);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isAuthenticated, placardProgressLoaded]);

  useEffect(() => {
    if (!isAuthenticated || !progress || generalProgressLoaded) return;
    const controller = new AbortController();
    let cancelled = false;
    void fetch("/api/arena/rankings", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Classement général indisponible");
        const payload = await response.json() as { entries?: ArenaRankingEntry[] };
        const entry = Array.isArray(payload.entries)
          ? payload.entries.find((item) => item.pseudo === progress.pseudo) ?? null
          : null;
        if (!cancelled) setGeneralProgress(entry);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
      })
      .finally(() => {
        if (!cancelled) setGeneralProgressLoaded(true);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [generalProgressLoaded, isAuthenticated, progress]);

  if (!isAuthenticated) {
    return (
      <div className="cartoon-border bg-cream p-5 md:p-6">
        <div className="contest-illustrated-card-header">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">Profil testeur</p>
            <h2 className="mt-1 font-display text-3xl leading-none text-ink">Connecte-toi</h2>
          </div>
          <ArenaCharacter
            variant="profile"
            ariaLabel="Ouvrir le profil testeur"
            onClick={onMascotClick}
            onHoverPreview={onMascotHover}
            onHoverEnd={onMascotLeave}
          />
        </div>
        <Link
          href="/compte/connexion?next=%2Farene"
          className="btn-cartoon btn-primary mt-4 inline-flex min-h-[42px] items-center justify-center px-4 text-xs leading-none"
        >
          Voir mon profil
        </Link>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="cartoon-border bg-cream p-5 md:p-6">
        <div className="contest-illustrated-card-header">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">Profil testeur</p>
            <h2 className="mt-1 font-display text-3xl leading-none text-ink">Pseudo requis</h2>
          </div>
          <ArenaCharacter
            variant="profile"
            ariaLabel="Ouvrir le profil testeur"
            onClick={onMascotClick}
            onHoverPreview={onMascotHover}
            onHoverEnd={onMascotLeave}
          />
        </div>
        <ContestProfileSetupForm className="mt-4" />
      </div>
    );
  }

  return (
    <div className="cartoon-border bg-cream p-5 md:p-6">
      <div className="contest-profile-illustrated-layout">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">Mon profil testeur</p>
          <h2 className="mt-1 font-display text-3xl leading-none text-ink">{progress.pseudo}</h2>
          <p className="mt-2 text-sm font-bold text-charcoal">{progress.currentLevel.label}</p>
        </div>
        <ArenaCharacter
          variant="profile"
          ariaLabel="Ouvrir le profil testeur"
          onClick={onMascotClick}
          onHoverPreview={onMascotHover}
          onHoverEnd={onMascotLeave}
        />
      </div>

      <div className={arenaStyles.personalRankingsGrid}>
        <section className={arenaStyles.personalRankingCard} data-ranking="tasting">
          <p>Classement personnel</p>
          <h3>Dégustation</h3>
          <dl>
            <div><dt>Points</dt><dd>{progress.totalPoints}</dd></div>
            <div><dt>Rang saison</dt><dd>{progress.seasonRank ? `#${progress.seasonRank}` : "—"}</dd></div>
            <div><dt>Rang global</dt><dd>{progress.globalRank ? `#${progress.globalRank}` : "—"}</dd></div>
          </dl>
        </section>

        <section className={arenaStyles.personalRankingCard} data-ranking="placard">
          <p>Classement personnel</p>
          <h3>Placard</h3>
          <dl>
            <div><dt>Cote</dt><dd>{placardProgress?.rating ?? "—"}</dd></div>
            <div><dt>Rang saison</dt><dd>{placardProgress?.rank ? `#${placardProgress.rank}` : placardProgressLoaded ? "Non classé" : "…"}</dd></div>
            <div><dt>Ligue</dt><dd>{placardProgress?.league ?? "—"}</dd></div>
          </dl>
        </section>

        <section className={arenaStyles.personalRankingCard} data-ranking="general">
          <p>Classement personnel</p>
          <h3>Général</h3>
          <dl>
            <div><dt>Score Arène</dt><dd>{generalProgress?.score ?? "—"}</dd></div>
            <div><dt>Rang général</dt><dd>{generalProgress?.rank ? `#${generalProgress.rank}` : generalProgressLoaded ? "Non classé" : "…"}</dd></div>
          </dl>
        </section>
      </div>

      <div className={arenaStyles.tastingProgressSummary}>
        <div className="flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.08em] text-charcoal">
          <span>{progress.currentLevel.label}</span>
          <span>{progress.nextLevel ? progress.nextLevel.label : "Niveau max"}</span>
        </div>
        <div className="mt-2 h-5 overflow-hidden rounded-full border-2 border-[#1a1a1a] bg-white">
          <div
            className="h-full bg-yellow"
            style={{ width: `${progress.progressPercent}%` }}
            aria-label={`Progression ${progress.progressPercent}%`}
          />
        </div>
        <p className="mt-2 text-sm font-semibold text-charcoal">
          {progress.nextLevel
            ? `${progress.pointsToNextLevel} point(s) avant ${progress.nextLevel.label}.`
            : "Tous les niveaux de points sont atteints."}
        </p>
      </div>

      <div className={arenaStyles.placardProfileSummary}>
        <div>
          <p>Progression Placard</p>
          <strong>{placardProgress ? `${placardProgress.league} · ${placardProgress.wins} V / ${placardProgress.losses} D` : "Saison de culture"}</strong>
          <small>{placardProgress ? `${placardProgress.pointsToNextLeague} point(s) de cote avant le palier suivant · ${placardProgress.burnedFlowers} Fleur(s) passée(s) au jury.` : "Crée des Fleurs, relève les défis et affronte les autres joueurs pour entrer au classement."}</small>
        </div>
      </div>
    </div>
  );
}

function ContestTesterLeaderboard({
  seasonItems,
  globalItems,
  profileSeasonCode,
  profileTrack,
  compact = false,
}: {
  seasonItems: PublicContestTesterRankingItem[];
  globalItems: PublicContestTesterRankingItem[];
  profileSeasonCode?: string;
  profileTrack: ContestEntryTrack;
  compact?: boolean;
}) {
  const [scope, setScope] = useState<"season" | "global">("season");
  const [rankingType, setRankingType] = useState<"general" | "tasting" | "placard">("general");
  const [arenaEntries, setArenaEntries] = useState<ArenaRankingEntry[]>([]);
  const [arenaRankingLoaded, setArenaRankingLoaded] = useState(false);
  const [arenaRankingUnavailable, setArenaRankingUnavailable] = useState(false);
  const [arenaRankingRetry, setArenaRankingRetry] = useState(0);
  const [remoteTastingItems, setRemoteTastingItems] = useState({ season: seasonItems, global: globalItems });
  const [tastingLoaded, setTastingLoaded] = useState({ season: seasonItems.length > 0, global: globalItems.length > 0 });
  const [placardEntries, setPlacardEntries] = useState<PlacardRankingEntry[]>([]);
  const [placardRankingLoaded, setPlacardRankingLoaded] = useState(false);
  const [placardRankingUnavailable, setPlacardRankingUnavailable] = useState(false);
  const rankingWindowRef = useRef<HTMLDivElement | null>(null);
  const items = remoteTastingItems[scope];
  const isPlacardRanking = rankingType === "placard";
  const isGeneralRanking = rankingType === "general";

  useEffect(() => {
    if (rankingType !== "tasting" || tastingLoaded[scope]) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ scope, limit: "10" });
    if (scope === "season" && profileSeasonCode) params.set("season", profileSeasonCode);
    void fetch(`/api/contest/testers/rankings?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Classement dégustation indisponible");
        const payload = await response.json() as { items?: PublicContestTesterRankingItem[] };
        setRemoteTastingItems((current) => ({ ...current, [scope]: Array.isArray(payload.items) ? payload.items : [] }));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
      })
      .finally(() => setTastingLoaded((current) => ({ ...current, [scope]: true })));
    return () => controller.abort();
  }, [profileSeasonCode, rankingType, scope, tastingLoaded]);

  useEffect(() => {
    if (!isGeneralRanking || arenaRankingLoaded) return;
    const controller = new AbortController();
    let cancelled = false;
    void fetch("/api/arena/rankings", { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { entries?: ArenaRankingEntry[] };
        if (!response.ok) throw new Error("Classement indisponible");
        if (cancelled) return;
        setArenaEntries(Array.isArray(payload.entries) ? payload.entries : []);
        setArenaRankingUnavailable(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (cancelled) return;
        setArenaRankingUnavailable(true);
        if (arenaRankingRetry < 3) {
          window.setTimeout(() => {
            setArenaRankingLoaded(false);
            setArenaRankingRetry((current) => current + 1);
          }, 2_000);
        }
      })
      .finally(() => {
        if (!cancelled) setArenaRankingLoaded(true);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [arenaRankingLoaded, arenaRankingRetry, isGeneralRanking]);

  useEffect(() => {
    if (!isPlacardRanking || placardRankingLoaded) return;
    const controller = new AbortController();
    let cancelled = false;
    void fetch("/api/arena/placard/rankings", { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { entries?: PlacardRankingEntry[] };
        if (!response.ok) throw new Error("Classement indisponible");
        setPlacardEntries(Array.isArray(payload.entries) ? payload.entries : []);
        setPlacardRankingUnavailable(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPlacardRankingUnavailable(true);
      })
      .finally(() => {
        if (!cancelled) setPlacardRankingLoaded(true);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isPlacardRanking, placardRankingLoaded]);

  const limit = compact ? 5 : 10;
  const rankingRows = isGeneralRanking
    ? arenaEntries.slice(0, limit).map((item) => ({
        key: `arena-${item.rank}-${item.pseudo}`,
        rank: item.rank,
        pseudo: item.pseudo,
        detail: `Carnet ${item.notebookScore} · Placard ${item.placardScore}`,
        score: String(item.score),
        scoreLabel: "pts Arène",
        href: "",
      }))
    : isPlacardRanking
      ? placardEntries.slice(0, limit).map((item) => ({
          key: `placard-${item.rank}-${item.pseudo}`,
          rank: item.rank,
          pseudo: item.pseudo,
          detail: `${item.wins} V · ${item.losses} D · série ${item.streak}`,
          score: String(item.rating),
          scoreLabel: `${item.seasonPoints} pts`,
          href: "",
        }))
      : items.slice(0, limit).map((item) => {
          const profileParams = new URLSearchParams();
          if (scope === "season" && profileSeasonCode) profileParams.set("season", profileSeasonCode);
          if (profileTrack !== "regular") profileParams.set("track", profileTrack);
          const query = profileParams.toString();
          return {
            key: `${scope}-${item.pseudo}-${item.rank}`,
            rank: item.rank,
            pseudo: item.pseudo,
            detail: `${item.level.label} · ${item.approvedReviewCount} critique${item.approvedReviewCount > 1 ? "s" : ""}`,
            score: String(item.totalPoints),
            scoreLabel: "points",
            href: `/arene/profils/${encodeURIComponent(item.pseudo)}${query ? `?${query}` : ""}`,
          };
        });
  const rankingLoading = isGeneralRanking
    ? !arenaRankingLoaded
    : isPlacardRanking
      ? !placardRankingLoaded
      : !tastingLoaded[scope];
  const rankingUnavailable = isGeneralRanking ? arenaRankingUnavailable : isPlacardRanking ? placardRankingUnavailable : false;
  const rankingTitle = isGeneralRanking ? "Classement général" : isPlacardRanking ? "Classement Placard" : "Classement dégustation";
  const rankingKicker = isGeneralRanking ? "Top Arène" : isPlacardRanking ? "Top cultivateurs" : "Top testeurs";
  const scrollRanking = (direction: -1 | 1) => {
    rankingWindowRef.current?.scrollBy({ top: direction * 168, behavior: "smooth" });
  };

  return (
    <div className={`${arenaStyles.scorePanel} ${arenaStyles.playerLeaderboardPanel}`}>
      <div className={arenaStyles.playerLeaderboardHeading}>
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">{rankingKicker}</p>
          <h2 className={`font-display leading-none text-ink ${compact ? "text-2xl" : "text-3xl"}`}>
            {rankingTitle}
          </h2>
        </div>
        {rankingType === "tasting" ? <div
          className={`contest-leaderboard-scope-switch rounded border-2 border-[#1a1a1a] bg-white p-1 ${
            compact ? "contest-leaderboard-scope-switch-compact" : ""
          }`}
        >
          {(["season", "global"] as const).map((nextScope) => (
            <button
              key={nextScope}
              type="button"
              onClick={() => setScope(nextScope)}
              className={`contest-leaderboard-scope-button px-3 py-2 text-center text-xs font-black uppercase leading-none tracking-[0.08em] ${
                scope === nextScope ? "bg-yellow text-ink" : "text-charcoal"
              }`}
            >
              {nextScope === "season" ? "Saison" : "Global"}
            </button>
          ))}
        </div> : null}
      </div>

      <div className={arenaStyles.personalRankingTypeSwitch} aria-label="Type de classement">
        <button type="button" aria-pressed={isGeneralRanking} data-active={isGeneralRanking || undefined} onClick={() => setRankingType("general")}>
          Général
          <small>Carnet + Placard</small>
        </button>
        <button type="button" aria-pressed={rankingType === "tasting"} data-active={rankingType === "tasting" || undefined} onClick={() => setRankingType("tasting")}>
          Dégustation
          <small>Avis validés</small>
        </button>
        <button type="button" aria-pressed={isPlacardRanking} data-active={isPlacardRanking || undefined} onClick={() => setRankingType("placard")}>
          Placard
          <small>Cultures &amp; duels</small>
        </button>
      </div>

      {isPlacardRanking ? (
        <p className="mt-3 text-xs font-semibold text-charcoal">
          En cas d’égalité : meilleure cote, puis points de saison, victoires et identifiant stable.
        </p>
      ) : null}

      {isGeneralRanking ? (
        <p className="mt-3 text-xs font-semibold text-charcoal">
          Score sur 1 000 : Carnet 300 points maximum, activité et cote Placard 700. Une partie terminée est requise.
        </p>
      ) : null}

      <div className={`contest-station-board ${arenaStyles.playerStationBoard}`} aria-label={rankingTitle}>
        <div className="contest-station-board-toolbar">
          <strong>{rankingRows.length} joueur{rankingRows.length > 1 ? "s" : ""} classé{rankingRows.length > 1 ? "s" : ""}</strong>
          <span>Fais défiler le tableau pour parcourir les rangs.</span>
          <div>
            <button type="button" onClick={() => scrollRanking(-1)} aria-label="Voir les joueurs précédents"><ChevronUp aria-hidden="true" /></button>
            <button type="button" onClick={() => scrollRanking(1)} aria-label="Voir les joueurs suivants"><ChevronDown aria-hidden="true" /></button>
          </div>
        </div>
        <div className={`contest-station-board-header ${arenaStyles.playerStationHeader}`}>
          <span>Classement joueurs</span>
          <span>Score</span>
        </div>
        <div ref={rankingWindowRef} className="contest-station-board-window" tabIndex={0}>
          {rankingLoading ? (
            <div className={`contest-station-empty ${arenaStyles.playerRankingState}`}>Chargement du classement…</div>
          ) : rankingRows.length > 0 ? (
            <div className="contest-station-board-track">
              {rankingRows.map((row) => {
                const content = <>
                  <span className="contest-station-rank">{String(row.rank).padStart(2, "0")}</span>
                  <span className={`contest-station-title ${arenaStyles.playerStationIdentity}`}><strong>{row.pseudo}</strong><small>{row.detail}</small></span>
                  <span className={`contest-station-score ${arenaStyles.playerStationScore}`}><strong>{row.score}</strong><small>{row.scoreLabel}</small></span>
                </>;
                return row.href ? (
                  <Link key={row.key} href={row.href} className={`contest-station-row ${arenaStyles.playerStationRow}`} aria-label={`Voir le profil de ${row.pseudo}`}>{content}</Link>
                ) : (
                  <div key={row.key} className={`contest-station-row ${arenaStyles.playerStationRow}`}>{content}</div>
                );
              })}
            </div>
          ) : (
            <div className={`contest-station-empty ${arenaStyles.playerRankingState}`}>
              {rankingUnavailable ? "Classement momentanément indisponible." : isPlacardRanking ? "Pas encore de cultivateur classé." : isGeneralRanking ? "Pas encore de joueur classé." : "Aucun testeur classé pour le moment."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ContestBadgeGallery({
  badges,
  isAuthenticated,
  claimingBadgeId,
  onClaim,
  defaultExpanded = false,
  className = "",
}: {
  badges: PublicContestProfileBadge[];
  isAuthenticated: boolean;
  claimingBadgeId: string | null;
  onClaim: (badgeId: string) => void;
  defaultExpanded?: boolean;
  className?: string;
}) {
  const unlockedBadges = new Map(
    badges.map((profileBadge) => [
      profileBadge.badge?.code || profileBadge.badgeId,
      profileBadge,
    ]),
  );
  const unlockedCount = CONTEST_ACHIEVEMENT_BADGE_CATALOG.filter((badge) =>
    unlockedBadges.has(badge.code) || unlockedBadges.has(badge.id),
  ).length;
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const previewBadges = [
    ...CONTEST_ACHIEVEMENT_BADGE_CATALOG.filter((badge) =>
      unlockedBadges.has(badge.code) || unlockedBadges.has(badge.id),
    ),
    ...CONTEST_ACHIEVEMENT_BADGE_CATALOG.filter(
      (badge) => !unlockedBadges.has(badge.code) && !unlockedBadges.has(badge.id),
    ),
  ].slice(0, 6);

  return (
    <div className={`cartoon-border contest-badge-gallery-compact bg-cream p-4 md:p-5 ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#1a1a1a] bg-yellow text-ink shadow-[2px_2px_0_#1a1a1a]">
            <Award size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">
            Galerie des badges
          </p>
          <h2 className="font-display text-3xl leading-none text-ink">Badges dégustateur</h2>
          </div>
        </div>
        <span className="self-start rounded-full border-2 border-[#1a1a1a] bg-[#fffaf0] px-3 py-2 text-sm font-black text-ink sm:self-auto">
          {unlockedCount}/{CONTEST_ACHIEVEMENT_BADGE_CATALOG.length}
        </span>
        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded border-2 border-[#1a1a1a] bg-[#fffaf0] px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-ink shadow-[2px_2px_0_#1a1a1a] transition hover:-translate-y-0.5 sm:w-auto sm:self-auto"
          aria-expanded={isExpanded}
        >
          {isExpanded ? "Masquer" : "Voir les badges"}
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      <div className="contest-badge-gallery-preview mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {previewBadges.map((badge) => {
          const unlocked = unlockedBadges.has(badge.code) || unlockedBadges.has(badge.id);
          return (
            <span
              key={`preview-${badge.id}`}
              className={`inline-flex min-h-[34px] shrink-0 items-center rounded-full border-2 border-[#1a1a1a] px-3 py-1 text-[11px] font-black uppercase tracking-[0.06em] ${
                unlocked ? "bg-yellow text-ink" : "bg-white text-charcoal"
              }`}
            >
              {badge.label}
            </span>
          );
        })}
      </div>

      {isExpanded ? (
      <div className="contest-badge-gallery-grid mt-4 grid max-h-[70vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:max-h-none xl:grid-cols-5">
        {CONTEST_ACHIEVEMENT_BADGE_CATALOG.map((badge) => {
          const unlocked = unlockedBadges.get(badge.code) ?? unlockedBadges.get(badge.id);
          const claimed = Boolean(unlocked?.rewardClaimedAt);

          return (
            <div
              key={badge.id}
              className={`contest-badge-card flex min-h-[170px] flex-col justify-between rounded border-2 border-[#1a1a1a] p-3 shadow-[3px_3px_0_#1a1a1a] ${
                unlocked ? "bg-yellow" : "bg-[#f7f4ee]"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-black uppercase leading-tight tracking-[0.06em] text-ink">
                    {badge.label}
                  </h3>
                  <span className="rounded-full border border-[#1a1a1a] bg-white px-2 py-1 text-[10px] font-black uppercase text-ink">
                    {unlocked ? "Débloqué" : "Verrouillé"}
                  </span>
                </div>
                <p className="mt-2 text-xs font-semibold leading-relaxed text-charcoal">
                  {badge.condition}
                </p>
                <p className={`mt-2 rounded border-2 border-[#1a1a1a] px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-ink ${badge.rewardFamily === "botte" ? "bg-[#e8f4e7]" : "bg-[#fff0a8]"}`}>
                  {badge.rewardLabel}
                </p>
              </div>

              {unlocked ? (badge.rewardFamily === "botte" ? (
                <div className="mt-3 min-h-[38px] rounded border-2 border-[#1a1a1a] bg-[#e8f4e7] px-3 py-2 text-center text-[11px] font-black uppercase text-green">
                  Gain Placard prévu au lancement
                </div>
              ) : claimed ? (
                <div className="mt-3 min-h-[38px] rounded border-2 border-[#1a1a1a] bg-white px-3 py-2 text-center text-[11px] font-black uppercase text-charcoal">
                  Récompense réclamée
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onClaim(badge.id)}
                  disabled={claimingBadgeId === badge.id}
                  className="btn-cartoon btn-primary mt-3 inline-flex min-h-[38px] items-center justify-center px-3 text-[11px] leading-none disabled:opacity-60"
                >
                  {claimingBadgeId === badge.id ? "Attribution..." : "Réclamer les boosters"}
                </button>
              )) : (
                <div className="mt-3 min-h-[38px] rounded border-2 border-dashed border-[#1a1a1a] bg-white/70 px-3 py-2 text-center text-[11px] font-black uppercase text-charcoal">
                  {isAuthenticated ? "Objectif à remplir" : "Connexion requise"}
                </div>
              )}
            </div>
          );
        })}
      </div>
      ) : null}
    </div>
  );
}

export function ContestHubClient({
  seasons,
  selectedSeasonCode,
  selectedTrack,
  activeCategory,
  categoryCounts,
  entries,
  rankings,
  feed,
  notebookUnlocks,
  viewerProfile,
  viewerBadges: initialViewerBadges,
  viewerProgress,
  testerSeasonRankings,
  testerGlobalRankings,
  isAuthenticated,
  isAdminAuthorized,
  isPlacardPlayerEnabled,
  initialView,
  surface = "arena",
}: ContestHubClientProps) {
  const router = useRouter();
  const { addToCart, authLoading } = useCart();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeArenaView, setActiveArenaView] = useState<ContestArenaView>(initialView);
  const isNotebookDetailSurface = surface === "notebook";
  const isFlowerRankingSurface = surface === "notebook-ranking";
  const isNotebookSurface = isNotebookDetailSurface || isFlowerRankingSurface;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [notebookPage, setNotebookPage] = useState<0 | 1>(0);
  const [notebookView, setNotebookView] = useState<ContestNotebookView>("lab");
  const [availableBottePackCount, setAvailableBottePackCount] = useState(0);
  const [isNotesSpreadGuideOpen, setIsNotesSpreadGuideOpen] = useState(false);
  const [lockedQty, setLockedQty] = useState(1);
  const [cartMessage, setCartMessage] = useState<string | null>(null);
  const viewerBadges = initialViewerBadges;
  const [feedItems, setFeedItems] = useState(feed);
  const [selectedFeedReviewId, setSelectedFeedReviewId] = useState<string | null>(null);
  const [selectedRankingEntryId, setSelectedRankingEntryId] = useState<string | null>(null);
  const [rankingModalReviews, setRankingModalReviews] = useState<PublicContestReview[]>([]);
  const [rankingModalLoading, setRankingModalLoading] = useState(false);
  const [rankingModalError, setRankingModalError] = useState<string | null>(null);
  const rankingReviewsRequestRef = useRef<AbortController | null>(null);
  const [activeMascotPanel, setActiveMascotPanel] = useState<ContestMascotPanel | null>(null);
  const [isMobileLeaderboardOpen, setIsMobileLeaderboardOpen] = useState(false);
  const [hoverMascotPanel, setHoverMascotPanel] = useState<ContestMascotPanel | null>(null);
  const [busyFeedVoteReviewId, setBusyFeedVoteReviewId] = useState<string | null>(null);
  const [feedVoteErrorByReviewId, setFeedVoteErrorByReviewId] = useState<Record<string, string>>({});
  const effectiveSelectedIndex = clampIndex(selectedIndex, entries);
  const selectedEntry = entries[effectiveSelectedIndex] ?? null;
  const selectedUnlock = selectedEntry
    ? notebookUnlocks.find((unlock) => unlock.entryId === selectedEntry.id)
    : undefined;

  useEffect(() => {
    setActiveArenaView(initialView);
  }, [initialView]);

  const unlockByEntryId = useMemo(
    () => new Map(notebookUnlocks.map((unlock) => [unlock.entryId, unlock])),
    [notebookUnlocks],
  );
  const testedFlowerCards = useMemo(() => {
    const entryById = new Map(entries.map((entry, index) => [entry.id, { entry, index }]));

    return notebookUnlocks
      .map((unlock) => {
        const review = unlock.review;
        const match = entryById.get(unlock.entryId);

        if (!review || !match) {
          return null;
        }

        return {
          entry: match.entry,
          entryIndex: match.index,
          review,
          unlock,
        };
      })
      .filter((item): item is TestedFlowerCardItem => item !== null)
      .sort((a, b) => {
        const aTimestamp = Date.parse(a.review.updatedAt || a.review.createdAt || a.unlock.unlockedAt);
        const bTimestamp = Date.parse(b.review.updatedAt || b.review.createdAt || b.unlock.unlockedAt);

        return bTimestamp - aTimestamp;
      });
  }, [entries, notebookUnlocks]);
  const selectedProductHref = getContestProductHref(selectedEntry?.product);
  const currentHubPath = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  const loginHref = `/compte/connexion?next=${encodeURIComponent(currentHubPath)}`;
  const selectedNotebookEligibility = getNotebookEligibility({
    entry: selectedEntry,
    unlock: selectedUnlock,
    viewerProfile,
    isAuthenticated,
  });
  const selectedCartProduct = selectedEntry ? toCartProduct(selectedEntry) : null;
  const selectedAnalysisUrl = selectedEntry ? getContestEntryAnalysisUrl(selectedEntry) : null;
  const stationRankingEntries = useMemo(
    () => getStationRankingEntries(rankings, entries),
    [entries, rankings],
  );
  const selectedFeedReview = selectedFeedReviewId
    ? feedItems.find((item) => item.reviewId === selectedFeedReviewId) ?? null
    : null;
  const selectedRankingEntry = selectedRankingEntryId
    ? stationRankingEntries.find((entry) => entry.id === selectedRankingEntryId) ?? null
    : null;
  const unlockedBadgeCount = useMemo(() => getUnlockedContestBadgeCount(viewerBadges), [viewerBadges]);
  const isHubModalOpen = Boolean(selectedFeedReview || selectedRankingEntry);
  const visibleHoverMascotPanel = activeMascotPanel || selectedFeedReview || selectedRankingEntry ? null : hoverMascotPanel;

  useEffect(() => {
    rankingReviewsRequestRef.current?.abort();
    setFeedItems(feed);
    setSelectedFeedReviewId(null);
    setSelectedRankingEntryId(null);
    setRankingModalReviews([]);
    setRankingModalError(null);
  }, [feed]);

  useEffect(() => () => rankingReviewsRequestRef.current?.abort(), []);

  useEffect(() => {
    if (!isAuthenticated) {
      setAvailableBottePackCount(0);
      return;
    }
    const controller = new AbortController();
    const refreshPackCount = async (signal?: AbortSignal) => {
      try {
        const response = await fetch("/api/arena/placard/boosters", { cache: "no-store", signal });
        if (!response.ok) return;
        const payload = await response.json() as {
          availableEntitlements?: Array<{ cardCount?: number }>;
        };
        setAvailableBottePackCount(
          (payload.availableEntitlements ?? []).filter((item) => Number(item.cardCount) === 10).length,
        );
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setAvailableBottePackCount(0);
        }
      }
    };
    const handleUpdate = () => void refreshPackCount();
    window.addEventListener("kq:boosters-updated", handleUpdate);
    void refreshPackCount(controller.signal);
    return () => {
      controller.abort();
      window.removeEventListener("kq:boosters-updated", handleUpdate);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isHubModalOpen) {
      return;
    }

    const scrollY = window.scrollY;
    const originalBodyPosition = document.body.style.position;
    const originalBodyTop = document.body.style.top;
    const originalBodyWidth = document.body.style.width;
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalHtmlOverscrollBehavior = document.documentElement.style.overscrollBehavior;

    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.position = originalBodyPosition;
      document.body.style.top = originalBodyTop;
      document.body.style.width = originalBodyWidth;
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.documentElement.style.overscrollBehavior = originalHtmlOverscrollBehavior;
      window.scrollTo(0, scrollY);
    };
  }, [isHubModalOpen]);

  useEffect(() => {
    setSelectedIndex(0);
    setNotebookPage(0);
    setNotebookView("lab");
    setIsNotesSpreadGuideOpen(false);
    setLockedQty(1);
    setCartMessage(null);
  }, [activeCategory, selectedTrack, selectedSeasonCode]);

  useEffect(() => {
    if (notebookView !== "notes") {
      setIsNotesSpreadGuideOpen(false);
    }
  }, [notebookView]);

  const selectEntryByIndex = (index: number) => {
    setSelectedIndex(index);
    setNotebookPage(0);
    setNotebookView("lab");
    setIsNotesSpreadGuideOpen(false);
    setLockedQty(1);
    setCartMessage(null);
  };

  const changeNotebookPage = (page: 0 | 1) => {
    setNotebookPage(page);
    if (page === 0) {
      setNotebookView("lab");
      setIsNotesSpreadGuideOpen(false);
    }
  };

  const changeNotebookView = (view: ContestNotebookView) => {
    setNotebookPage(1);
    setNotebookView(view);
  };

  const handleLockedAddToCart = () => {
    if (!selectedCartProduct) {
      setCartMessage("Produit lié introuvable pour ce lot.");
      return;
    }

    const result = addToCart(selectedCartProduct, undefined, lockedQty);
    if (result.ok) {
      setCartMessage("Produit ajouté au panier.");
      setLockedQty(1);
      return;
    }

    if (result.reason === "unauthenticated") {
      const nextPath = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
      router.push(`/compte/connexion?next=${encodeURIComponent(nextPath)}`);
      return;
    }

    if (result.reason === "stock_limit") {
      setCartMessage(
        typeof result.maxAvailable === "number"
          ? `Stock maximum atteint (${result.maxAvailable} disponible).`
          : "Stock maximum atteint.",
      );
      return;
    }

    setCartMessage("Impossible d'ajouter ce produit au panier.");
  };

  const updateFeedReviewVoteSummary = (reviewId: string, voteSummary: ContestReviewVoteSummary) => {
    setFeedItems((current) =>
      current.map((item) => (item.reviewId === reviewId ? { ...item, voteSummary } : item)),
    );
  };

  const voteForFeedReview = async (item: ContestFeedItem, value: ContestReviewVoteValue) => {
    if (!isAuthenticated) {
      const nextPath = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
      router.push(`/compte/connexion?next=${encodeURIComponent(nextPath)}`);
      return;
    }

    setBusyFeedVoteReviewId(item.reviewId);
    setFeedVoteErrorByReviewId((current) => ({ ...current, [item.reviewId]: "" }));

    try {
      const response = await fetch(`/api/contest/reviews/${encodeURIComponent(item.reviewId)}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      const payload = (await response.json().catch(() => null)) as {
        voteSummary?: ContestReviewVoteSummary;
        error?: string;
      } | null;

      if (!response.ok || !payload?.voteSummary) {
        setFeedVoteErrorByReviewId((current) => ({
          ...current,
          [item.reviewId]: payload?.error ?? "Vote impossible.",
        }));
        return;
      }

      updateFeedReviewVoteSummary(item.reviewId, payload.voteSummary);
    } catch {
      setFeedVoteErrorByReviewId((current) => ({
        ...current,
        [item.reviewId]: "Erreur reseau pendant le vote.",
      }));
    } finally {
      setBusyFeedVoteReviewId(null);
    }
  };

  const openRankingEntryReviews = async (entryId: string) => {
    const entry = stationRankingEntries.find((item) => item.id === entryId);
    if (!entry) return;

    rankingReviewsRequestRef.current?.abort();
    const controller = new AbortController();
    rankingReviewsRequestRef.current = controller;
    setSelectedRankingEntryId(entry.id);
    setRankingModalReviews([]);
    setRankingModalError(null);
    setRankingModalLoading(true);

    try {
      const response = await fetch(`/api/contest/entries/${encodeURIComponent(entry.slug)}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => null)) as
        | (Partial<PublicContestEntryDetail> & { error?: string })
        | null;

      if (!response.ok || !Array.isArray(payload?.reviews)) {
        setRankingModalError(payload?.error ?? "Impossible de charger les critiques de ce lot.");
        return;
      }

      setRankingModalReviews(payload.reviews);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setRankingModalError("Erreur réseau pendant le chargement des critiques.");
      }
    } finally {
      if (!controller.signal.aborted) setRankingModalLoading(false);
    }
  };

  const closeRankingReviews = () => {
    rankingReviewsRequestRef.current?.abort();
    setSelectedRankingEntryId(null);
    setRankingModalReviews([]);
    setRankingModalLoading(false);
    setRankingModalError(null);
  };

  const openRankingReviewDetail = (review: PublicContestReview) => {
    const entry = selectedRankingEntry;
    if (!entry) return;

    const item: ContestFeedItem = {
      reviewId: review.id,
      entryId: entry.id,
      entrySlug: entry.slug,
      entryTitle: entry.title,
      entryImageUrl: entry.imageUrl || entry.product?.image,
      seasonCode: review.seasonCode ?? selectedSeasonCode ?? "active",
      seasonLabel: review.seasonLabel ?? entry.season?.label ?? "Saison active",
      category: review.category ?? entry.category,
      track: review.track ?? entry.track,
      pseudo: review.pseudo,
      comment: review.comment,
      excerpt: review.comment.length > 180 ? `${review.comment.slice(0, 177)}...` : review.comment,
      consumptionMethod: review.consumptionMethod,
      scores: review.scores,
      aromaTags: review.aromaTags,
      voteSummary: review.voteSummary,
      createdAt: review.createdAt,
      validatedAt: review.reviewedAt ?? review.createdAt,
    };

    setFeedItems((current) => current.some((feedItem) => feedItem.reviewId === item.reviewId) ? current : [...current, item]);
    setSelectedRankingEntryId(null);
    setRankingModalReviews([]);
    setSelectedFeedReviewId(item.reviewId);
  };

  const changeTrack = (nextTrack: ContestEntryTrack) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextTrack === "regular") {
      params.delete("track");
    } else {
      params.set("track", nextTrack);
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const getNotebookTrackHref = (nextTrack: ContestEntryTrack) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("track");
    params.delete("vue");
    const query = params.toString();
    return `/arene/carnet/${nextTrack}${query ? `?${query}` : ""}`;
  };

  const getNotebookRankingHref = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("vue");
    params.set("track", selectedTrack);
    const query = params.toString();
    return `/arene/carnet/classement${query ? `?${query}` : ""}`;
  };

  const changeCategory = (nextCategory: ContestEntryCategory) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("category", nextCategory);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const changeSeason = (nextSeasonCode: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextSeasonCode) params.set("season", nextSeasonCode);
    else params.delete("season");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const openMascotPanel = (panel: ContestMascotPanel) => {
    setHoverMascotPanel(null);
    setActiveMascotPanel(panel);
  };

  const previewMascotPanel = (panel: ContestMascotPanel) => {
    if (selectedFeedReview || selectedRankingEntry || activeMascotPanel) {
      return;
    }

    setHoverMascotPanel(panel);
  };

  const closeMascotPreview = (panel: ContestMascotPanel) => {
    setHoverMascotPanel((current) => (current === panel ? null : current));
  };

  return (
    <section data-world="arena" data-surface={surface} className={arenaStyles.page}>
      {isNotebookSurface ? (
        <header className={arenaStyles.notebookSurfaceHeader}>
          <nav aria-label="Navigation du Carnet">
            <Link href="/arene" className={arenaStyles.notebookSurfaceBack}><ChevronLeft aria-hidden="true" /> Retour à l’Arène</Link>
            <strong>{isFlowerRankingSurface ? "Classement des fleurs" : "Mon Carnet"}</strong>
            {isPlacardPlayerEnabled ? <Link href="/arene/placard" className={arenaStyles.notebookSurfacePlay}>Jouer <Sprout aria-hidden="true" /></Link> : <span />}
          </nav>
          <div className={arenaStyles.notebookSurfaceHero}>
            <span>
              <h1>{isFlowerRankingSurface ? "Classement des fleurs" : "Mon Carnet"}</h1>
              {!isFlowerRankingSurface ? <p>Choisis une fleur, ouvre ton carnet et retrouve toutes tes dégustations au même endroit.</p> : null}
            </span>
            <Image src="/contest/mascot/tasting/tasting-start.png" alt="" width={408} height={771} priority sizes="110px" />
          </div>
          <div className={arenaStyles.notebookSurfaceQuickNav}>
            <nav className={arenaStyles.notebookSurfaceSections} aria-label="Sections du Carnet">
              <Link href={getNotebookTrackHref("regular")} data-active={isNotebookDetailSurface && selectedTrack === "regular" || undefined}>
                <BookOpen aria-hidden="true" />
                <span><strong>Regular</strong></span>
              </Link>
              <Link href={getNotebookTrackHref("concours")} data-active={isNotebookDetailSurface && selectedTrack === "concours" || undefined}>
                <Award aria-hidden="true" />
                <span><strong>Concours</strong></span>
              </Link>
              <Link href={getNotebookRankingHref()} data-active={isFlowerRankingSurface || undefined}>
                <Trophy aria-hidden="true" />
                <span><strong>Fleurs</strong></span>
              </Link>
            </nav>
          </div>
        </header>
      ) : null}
      <header className={arenaStyles.hero}>
        <div className={arenaStyles.noise} aria-hidden="true" />
        <div className={`retro-container ${arenaStyles.heroGrid}`}>
          <div className={arenaStyles.heroCopy}>
            <h1 className={arenaStyles.heroTitle}>
              L&apos;<span className={arenaStyles.heroTitleAccent}>Arène.</span>
            </h1>
            <div className={arenaStyles.heroRule} aria-hidden="true" />
            <p className={arenaStyles.heroLead}>
              Trois espaces, une seule progression : remplis ton Carnet, joue tes cartes dans le
              Placard, puis mesure-toi aux autres dans les classements de la saison.
            </p>
          </div>

          <div className={arenaStyles.heroArt} aria-hidden="true">
            <Image
              src="/contest/mascot/arena-journey-v3.webp"
              alt=""
              width={1254}
              height={1254}
              sizes="(max-width: 767px) 92vw, 620px"
              className={arenaStyles.heroDuo}
            />
          </div>
        </div>
      </header>

      <div className={`retro-container ${arenaStyles.content}`}>
        {!isNotebookSurface ? (
          <ArenaNavigation
            activeView={activeArenaView}
          />
        ) : null}

        <nav hidden className={arenaStyles.arenaHub} aria-labelledby="arena-hub-title">
          <div className={arenaStyles.arenaHubHeading}>
            <p className={arenaStyles.sectionKicker}>Choisis ton espace</p>
            <h2 id="arena-hub-title">Que veux-tu faire ?</h2>
            <p>Tu peux commencer où tu veux. Le Carnet nourrit le Placard, et le Placard te fait entrer dans les classements.</p>
          </div>
          <div className={arenaStyles.arenaHubCards}>
            <a href="#carnet-arene" className={arenaStyles.arenaHubCard} data-space="carnet">
              <span><b>1</b><BookOpen aria-hidden="true" /></span>
              <strong>Mon Carnet</strong>
              <p>Déguster, noter et faire valider mes critiques.</p>
              <small>À gagner : profil, badges et avantages Placard</small>
              <em>Ouvrir le Carnet <ChevronDown aria-hidden="true" /></em>
            </a>
            {isPlacardPlayerEnabled && isAuthenticated ? (
              <Link href="/arene/placard" className={arenaStyles.arenaHubCard} data-space="placard">
                <span><b>2</b><Sprout aria-hidden="true" /></span>
                <strong>Mon Placard</strong>
                <p>Composer mon deck, cultiver et créer une Fleur.</p>
                <small>À gagner : EXP d’Arène et Fleurs de concours</small>
                <em>Jouer maintenant <ChevronRight aria-hidden="true" /></em>
              </Link>
            ) : (
              <a href="#placard-arene" className={arenaStyles.arenaHubCard} data-space="placard">
                <span><b>2</b><Sprout aria-hidden="true" /></span>
                <strong>Le Placard</strong>
                <p>Découvrir le jeu de cartes et la culture.</p>
                <small>{isPlacardPlayerEnabled ? "Connexion requise pour jouer" : "Accès joueur bientôt disponible"}</small>
                <em>Découvrir <ChevronDown aria-hidden="true" /></em>
              </a>
            )}
            <a href="#classement-arene" className={arenaStyles.arenaHubCard} data-space="classements">
              <span><b>3</b><Trophy aria-hidden="true" /></span>
              <strong>Les Classements</strong>
              <p>Voir les meilleurs testeurs, cultivateurs et Fleurs.</p>
              <small>Deux progressions distinctes, une même saison</small>
              <em>Voir les rangs <ChevronDown aria-hidden="true" /></em>
            </a>
          </div>
          <p className={arenaStyles.arenaHubLoop}><strong>Carnet</strong><span>débloque des avantages</span><strong>Placard</strong><span>produit des Fleurs</span><strong>Classements</strong></p>
        </nav>

        <section hidden aria-labelledby="arena-how-title">
          <div className={arenaStyles.sectionHeading}>
            <div>
              <h2 id="arena-how-title" className={arenaStyles.sectionTitle}>
                Une boucle. <span>Trois actions.</span>
              </h2>
            </div>
          </div>
          <div className={arenaStyles.howGrid}>
            {[
              ["1", "Déguste", "Note les fleurs de saison dans ton Carnet."],
              ["2", "Cultive", "Utilise tes avantages et tes cartes dans le Placard."],
              ["3", "Affronte", "Présente ta Fleur au jury et progresse dans les classements."],
            ].map(([number, title, text]) => (
              <article key={number} className={arenaStyles.howCard}>
                <span className={arenaStyles.howNumber}>{number}</span>
                <h3 className={arenaStyles.cardTitle}>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section hidden={activeArenaView !== "jouer"} id="placard-arene" className={arenaStyles.placardSection} aria-labelledby="arena-placard-title">
          <div className={arenaStyles.placardIntro}>
            <div className={arenaStyles.placardCopy}>
              <p className={arenaStyles.sectionKicker}>Le jeu de L’Arène</p>
              <h2 id="arena-placard-title" className={arenaStyles.sectionTitle}>
                Du carnet au <span>Placard.</span>
              </h2>
              <p className={arenaStyles.placardLead}>
                Tes dégustations débloquent des avantages. Utilise-les avec tes cartes pour cultiver
                une Fleur unique, puis présente-la au jury.
              </p>
              <div className={arenaStyles.placardStatus}>
                <span>{isPlacardPlayerEnabled ? "Saison ouverte" : "Accès en test"}</span>
                <p>{isPlacardPlayerEnabled
                  ? "Crée ta Fleur, affronte un joueur ou un bot et gagne de l’EXP d’Arène."
                  : "Le Placard est actuellement réservé à l’administration avant son ouverture aux joueurs."}</p>
              </div>
              {isPlacardPlayerEnabled && isAuthenticated ? (
                <Link href="/arene/placard" className={arenaStyles.placardPlayAction}>
                  Jouer au Placard <ChevronRight size={18} aria-hidden="true" />
                </Link>
              ) : isPlacardPlayerEnabled ? (
                <Link href="/compte/connexion?next=%2Farene%2Fplacard" className={arenaStyles.placardPlayAction}>
                  Se connecter pour jouer <ChevronRight size={18} aria-hidden="true" />
                </Link>
              ) : isAdminAuthorized ? (
                <Link href="/admin/placard" className={arenaStyles.placardPlayAction}>
                  Tester le Placard <ChevronRight size={18} aria-hidden="true" />
                </Link>
              ) : null}
            </div>
            <div className={arenaStyles.placardVisual} aria-hidden="true">
              <span />
              <Image
                src="/sylvain-culture-hero.webp"
                alt=""
                width={1122}
                height={1402}
                sizes="(max-width: 767px) 78vw, 380px"
              />
            </div>
          </div>

          <div className={arenaStyles.placardSummary}>
            <span><Trophy aria-hidden="true" /><strong>Deux façons de briller</strong></span>
            <p><b>Classement testeurs :</b> tes dégustations.</p>
            <p><b>Classement Placard :</b> tes cultures et tes duels.</p>
            <small>Les récompenses de fin de saison seront précisées dans le règlement officiel.</small>
          </div>
        </section>

        <section hidden={activeArenaView !== "classement"} className={arenaStyles.playerRankingSection} aria-labelledby="arena-player-ranking-title">
          <div className={arenaStyles.sectionHeading}>
            <h2 id="arena-player-ranking-title" className={arenaStyles.sectionTitle}>
              Rangs des joueurs
            </h2>
          </div>
          {activeArenaView === "classement" ? <>
            <div className={arenaStyles.personalGrid}>
              <ContestTesterProfileCard
                progress={viewerProgress}
                isAuthenticated={isAuthenticated}
                onMascotClick={() => openMascotPanel("profile")}
                onMascotHover={() => previewMascotPanel("profile")}
                onMascotLeave={() => closeMascotPreview("profile")}
              />
            </div>
            <ContestTesterLeaderboard
              seasonItems={testerSeasonRankings}
              globalItems={testerGlobalRankings}
              profileSeasonCode={selectedSeasonCode}
              profileTrack={selectedTrack}
            />
          </> : null}
        </section>

        <section hidden={activeArenaView !== "carnet" || isNotebookDetailSurface} id="classement-arene" className={arenaStyles.rankingSection} aria-labelledby="arena-ranking-title">
          <div className={arenaStyles.sectionHeading}>
            <div>
              <h2 id="arena-ranking-title" className={arenaStyles.sectionTitle}>
                Palmarès des fleurs. <span>Selon le jury.</span>
              </h2>
            </div>
            <p className={arenaStyles.sectionLead}>
              Les scores viennent des carnets validés. Clique sur un lot ou un avis pour voir le détail.
            </p>
          </div>
          <div className={arenaStyles.rankingFilters}>
            {isFlowerRankingSurface ? (
              <div className={arenaStyles.controlGroup}>
                <span className={arenaStyles.controlLabel}>Carnet</span>
                <div className={arenaStyles.categorySwitch} aria-label="Type de carnet">
                  {CONTEST_ENTRY_TRACKS.map((track) => (
                    <button
                      key={track}
                      type="button"
                      aria-pressed={selectedTrack === track}
                      onClick={() => changeTrack(track)}
                      className={`${arenaStyles.filterButton} ${selectedTrack === track ? arenaStyles.filterButtonActive : ""}`}
                    >
                      <span>{CONTEST_ENTRY_TRACK_LABELS[track]}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className={arenaStyles.controlGroup}>
              <span className={arenaStyles.controlLabel}>Culture</span>
              <div className={arenaStyles.categorySwitch} aria-label="Catégorie de culture">
                {CONTEST_ENTRY_CATEGORIES.map((category) => {
                  const count = categoryCounts[category] ?? 0;
                  const isActive = category === activeCategory;
                  return (
                    <button
                      key={category}
                      type="button"
                      disabled={count === 0 && !isActive}
                      aria-pressed={isActive}
                      onClick={() => changeCategory(category)}
                      className={`${arenaStyles.filterButton} ${isActive ? arenaStyles.filterButtonActive : ""}`}
                    >
                      <span>{CONTEST_ENTRY_CATEGORY_LABELS[category]}</span>
                      <span className={arenaStyles.filterCount}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <label className={arenaStyles.controlGroup}>
              <span className={arenaStyles.controlLabel}>Saison</span>
              <select
                value={selectedSeasonCode ?? ""}
                onChange={(event) => changeSeason(event.target.value)}
                className={arenaStyles.seasonSelect}
              >
                {seasons.map((season) => (
                  <option key={season.id} value={season.code}>{season.label}</option>
                ))}
              </select>
            </label>
          </div>
          <div className={arenaStyles.scoreAndReviews}>
            <div className={arenaStyles.scorePanel}>
              <ContestStationRankingBoard
                entries={stationRankingEntries}
                activeCategory={activeCategory}
                selectedEntryId={selectedRankingEntry?.id}
                onSelectEntry={(entryId) => void openRankingEntryReviews(entryId)}
              />
            </div>
            <div className={arenaStyles.reviewPanel}>
              <ContestReviewMarquee
                items={feedItems}
                onSelectReview={(item) => setSelectedFeedReviewId(item.reviewId)}
              />
            </div>
          </div>
        </section>

        <div hidden={activeArenaView !== "carnet"}>
        </div>

        <section hidden={activeArenaView !== "carnet" || isFlowerRankingSurface} id="carnet-arene" className={arenaStyles.notebookPanel} aria-labelledby="arena-notebook-title">
          <div className={arenaStyles.notebookIntro}>
            <div>
              <h2 id="arena-notebook-title" className={arenaStyles.sectionTitle}>
                Note. <span>Collectionne. Joue.</span>
              </h2>
              <p className={arenaStyles.sectionLead}>
                Note les fleurs que tu achètes, étoffe ta collection de cartes et joue-les dans le Placard. Chaque fleur Concours te rapporte 5 packs de cartes de plus qu’une fleur Regular.
              </p>
            </div>
            <div className={arenaStyles.notebookCharacter} aria-hidden="true">
              <Image
                src="/contest/mascot/tasting/tasting-start.png"
                alt=""
                width={408}
                height={771}
                sizes="92px"
              />
            </div>
          </div>
          {!isNotebookSurface ? (
            <nav className={arenaStyles.notebookTrackTabs} aria-label="Choisir le carnet de dégustation">
              {CONTEST_ENTRY_TRACKS.map((track) => (
                <button
                  key={track}
                  type="button"
                  aria-pressed={selectedTrack === track}
                  onClick={() => changeTrack(track)}
                  className={`${arenaStyles.notebookTrackTab} ${
                    track === "concours" ? arenaStyles.notebookTrackTabContest : arenaStyles.notebookTrackTabRegular
                  }`}
                >
                  <span>{CONTEST_ENTRY_TRACK_LABELS[track]}</span>
                </button>
              ))}
            </nav>
          ) : null}
          {isNotebookSurface ? (
            <div className={arenaStyles.notebookSurfaceFilters}>
              <span>Choisir la culture</span>
              <div aria-label="Catégorie de culture">
                {CONTEST_ENTRY_CATEGORIES.map((category) => {
                  const count = categoryCounts[category] ?? 0;
                  const isActive = category === activeCategory;
                  return (
                    <button
                      key={category}
                      type="button"
                      disabled={count === 0 && !isActive}
                      aria-pressed={isActive}
                      onClick={() => changeCategory(category)}
                    >
                      {CONTEST_ENTRY_CATEGORY_LABELS[category]}
                      <small>{count}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <div className={arenaStyles.notebookStage}>
          {selectedEntry ? (
            <div className="contest-hub-spread-wrap relative">
              <NotebookFlipBook
                className="contest-hub-flipbook contest-lab-notebook"
                variant="editorial"
                tone={selectedTrack === "concours" ? "gold" : "green"}
                leftPageClassName="contest-lab-page-left"
                rightPageClassName="contest-lab-page-right"
                labels={{ previous: "Lot", next: "Onglets", pageLabel: `Pages du carnet ${CONTEST_ENTRY_TRACK_LABELS[selectedTrack]}` }}
                activePage={notebookPage}
                onActivePageChange={changeNotebookPage}
                coverOpenPage={0}
                cover={
                  <>
                    <span className="contest-notebook-cover-shell" aria-hidden="true">
                      <span className="contest-editorial-cover">
                        <span className="contest-editorial-cover-label">
                          <span className="contest-editorial-cover-title">
                            <span>Mon carnet</span>
                            <span>de dégustation</span>
                          </span>
                          <span className="contest-editorial-cover-line" />
                        </span>
                        <span className="contest-editorial-cover-art">
                          <Image
                            src="/contest/mascot/tasting/tasting-start.png"
                            alt=""
                            width={408}
                            height={771}
                            priority
                            sizes="(max-width: 767px) 100px, 132px"
                          />
                        </span>
                        <span className="contest-editorial-cover-footer">
                          <span>{selectedEntry.season?.label ?? "Saison active"}</span>
                          <strong>{CONTEST_ENTRY_TRACK_LABELS[selectedTrack]}</strong>
                        </span>
                      </span>
                    </span>
                    <span className="contest-notebook-cover-hint">Ouvrir mon carnet</span>
                  </>
                }
                spreadOverlay={
                  notebookView === "notes" && isNotesSpreadGuideOpen ? (
                    <div className="contest-notes-desktop-spread">
                      <ContestNotebookPanel
                        key={`desktop-notes-spread-${selectedEntry.id}`}
                        entry={selectedEntry}
                        viewerProfile={viewerProfile}
                        viewerReview={selectedUnlock?.review ?? null}
                        eligibility={selectedNotebookEligibility}
                        loginHref={loginHref}
                        productHref={selectedProductHref}
                        displayMode="spread"
                        defaultGuideOpen
                        onCloseGuide={() => setIsNotesSpreadGuideOpen(false)}
                      />
                    </div>
                  ) : null
                }
                left={
                  <ContestLabEntryPage
                    entry={selectedEntry}
                    imagePriority
                  />
                }
                sideTabs={
                  <ContestNotebookEntryCarousel
                    entries={entries}
                    activeIndex={effectiveSelectedIndex}
                    activeView={notebookView}
                    unlockByEntryId={unlockByEntryId}
                    unlockedBadgeCount={unlockedBadgeCount}
                    onSelectEntry={selectEntryByIndex}
                    onOpenCollection={() => changeNotebookView("collection")}
                  />
                }
                mobileToolbar={
                  <ContestNotebookViewTabs
                    activeView={notebookView}
                    availablePackCount={availableBottePackCount}
                    unlockedBadgeCount={unlockedBadgeCount}
                    onChange={changeNotebookView}
                  />
                }
                right={
                  notebookView === "notes" ? (
                    <div className="contest-notebook-notes-view contest-lab-notes-view !flex h-full min-h-0 flex-col gap-3">
                      <ContestNotebookViewTabs
                        activeView={notebookView}
                        availablePackCount={availableBottePackCount}
                        unlockedBadgeCount={unlockedBadgeCount}
                        onChange={changeNotebookView}
                      />
                      {selectedUnlock?.review ? (
                        <p className="contest-notebook-notes-status px-1 text-[11px] font-semibold leading-relaxed text-charcoal/70">
                          Statut:{" "}
                          <span className="font-black text-ink">
                            {CONTEST_REVIEW_STATUS_LABELS[selectedUnlock.review.status]}
                          </span>
                          {selectedUnlock.review.status === "pending"
                            ? " · modifiable jusqu'a validation."
                            : " · consultation seule apres validation."}
                        </p>
                      ) : null}

                      <div className="contest-notebook-notes-body min-h-0 flex-1 overflow-y-auto pr-1">
                        <ContestNotebookPanel
                          key={selectedEntry.id}
                          entry={selectedEntry}
                          viewerProfile={viewerProfile}
                          viewerReview={selectedUnlock?.review ?? null}
                          eligibility={selectedNotebookEligibility}
                          loginHref={loginHref}
                          productHref={selectedProductHref}
                          displayMode="button"
                          useDesktopSpreadGuide
                          onOpenGuide={() => setIsNotesSpreadGuideOpen(true)}
                        />
                      </div>
                    </div>
                  ) : notebookView === "collection" ? (
                    <div className="contest-lab-dashboard-page">
                      <ContestNotebookViewTabs
                        activeView={notebookView}
                        availablePackCount={availableBottePackCount}
                        unlockedBadgeCount={unlockedBadgeCount}
                        onChange={changeNotebookView}
                      />
                      <ContestNotebookCollectionTab
                        isAuthenticated={isAuthenticated}
                        badges={viewerBadges}
                        entryId={selectedEntry.id}
                        entryTitle={selectedEntry.title}
                        entryTrack={selectedEntry.track}
                        reviewApproved={selectedUnlock?.review?.status === "approved"}
                      />
                    </div>
                  ) : (
                  <div className="contest-lab-dashboard-page">
                    <ContestNotebookViewTabs
                      activeView={notebookView}
                      availablePackCount={availableBottePackCount}
                      unlockedBadgeCount={unlockedBadgeCount}
                      onChange={changeNotebookView}
                    />
                    <div className="contest-lab-sheet-header">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-charcoal">
                          Fiche du lot
                        </p>
                        <h2 className="mt-1 text-xl font-black leading-tight text-ink">
                          {getContestBookmarkLabel(selectedEntry)}
                        </h2>
                      </div>
                      <span
                        className={`contest-lab-unlock-chip ${
                          selectedAnalysisUrl ? "contest-lab-unlock-chip-ok" : "contest-lab-unlock-chip-locked"
                        }`}
                      >
                        {selectedAnalysisUrl ? <FileCheck2 size={14} /> : <CircleHelp size={14} />}
                        {selectedAnalysisUrl ? "Analyse dispo" : "Analyse attente"}
                      </span>
                    </div>

                    <ContestLabDetailsPanel entry={selectedEntry} />

                    {selectedUnlock?.review ? (
                      <div className="contest-lab-status-panel text-sm leading-relaxed text-charcoal">
                        Cette fiche rassemble les informations du lot: origine, producteur, sol et analyse.
                      </div>
                    ) : selectedUnlock ? (
                      <div className="contest-lab-status-panel text-sm leading-relaxed text-charcoal">
                        <span className="font-black text-ink">Fiche du lot.</span>{" "}
                        Origine, producteur, sol et analyse restent consultables ici.
                      </div>
                    ) : (
                      <div className="contest-lab-locked-panel text-center">
                        <p className="mt-3 text-lg font-black text-ink">Lot boutique</p>
                        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-charcoal">
                          Retrouve le lot en boutique pour consulter son produit et le commander.
                        </p>
                        {selectedCartProduct ? (
                          <div className="mx-auto mt-5 max-w-md rounded border-2 border-[#17130e] bg-white p-4 text-left">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-charcoal">
                                  {selectedCartProduct.name}
                                </p>
                                <p className="mt-1 text-2xl font-black text-ink">
                                  {selectedCartProduct.price.toFixed(2)} EUR
                                </p>
                              </div>
                              <QuantitySelector value={lockedQty} onChange={setLockedQty} />
                            </div>
                            <button
                              type="button"
                              onClick={handleLockedAddToCart}
                              disabled={authLoading}
                              className="btn-cartoon btn-primary mt-4 inline-flex min-h-[44px] w-full items-center justify-center px-5 text-xs leading-none disabled:opacity-60"
                            >
                              Ajouter au panier
                            </button>
                            {cartMessage ? (
                              <p className="mt-3 text-sm font-semibold text-charcoal">{cartMessage}</p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )}

                    {selectedProductHref ? (
                      <div className="contest-lab-action-grid">
                        <Link
                          href={selectedProductHref}
                          className="btn-cartoon btn-secondary inline-flex min-h-[44px] items-center justify-center px-5 text-xs leading-none"
                        >
                          Voir le produit
                        </Link>
                      </div>
                    ) : null}

                  </div>
                  )
                }
              />

            </div>
          ) : (
            <div className="rounded border-2 border-dashed border-[#17130e] bg-[#fff7df] p-8 text-center text-sm text-charcoal">
              Aucune fleur {CONTEST_ENTRY_CATEGORY_LABELS[activeCategory]} publiee pour cette saison.
            </div>
          )}
          </div>
        </section>

        <section hidden={activeArenaView !== "carnet" || isFlowerRankingSurface} className={arenaStyles.testedPanel} aria-label="Fleurs déjà dégustées">
          <ContestTestedFlowerCarousel
            items={testedFlowerCards}
            selectedEntryId={selectedEntry?.id}
            onOpenEntryNotes={(item) => {
              selectEntryByIndex(item.entryIndex);
              changeNotebookView("notes");
            }}
          />
        </section>
      </div>

      {visibleHoverMascotPanel === "intro" ? (
        <ContestHubHoverPreview eyebrow="Mode d'emploi" title="L'Arène">
          <ContestIntroPopupContent />
        </ContestHubHoverPreview>
      ) : null}

      {visibleHoverMascotPanel === "profile" ? (
        <ContestHubHoverPreview eyebrow="Profil testeur" title="Progression">
          <ContestTesterProfileDetails progress={viewerProgress} isAuthenticated={isAuthenticated} />
        </ContestHubHoverPreview>
      ) : null}

      {visibleHoverMascotPanel === "leaderboard" ? (
        <ContestHubHoverPreview eyebrow="Top testeurs" title="Classement">
          <ContestTesterLeaderboardDetails />
        </ContestHubHoverPreview>
      ) : null}

      {activeMascotPanel === "intro" ? (
        <ContestHubPanelModal
          eyebrow="Mode d'emploi"
          title="L'Arène"
          onClose={() => setActiveMascotPanel(null)}
        >
          <ContestIntroPopupContent />
        </ContestHubPanelModal>
      ) : null}

      {activeMascotPanel === "profile" ? (
        <ContestHubPanelModal
          eyebrow="Profil testeur"
          title="Progression"
          onClose={() => setActiveMascotPanel(null)}
        >
          <ContestTesterProfileDetails
            progress={viewerProgress}
            isAuthenticated={isAuthenticated}
            showSetupForm
          />
        </ContestHubPanelModal>
      ) : null}

      {activeMascotPanel === "leaderboard" ? (
        <ContestHubPanelModal
          eyebrow="Top testeurs"
          title="Classement"
          onClose={() => setActiveMascotPanel(null)}
        >
          <ContestTesterLeaderboardDetails />
        </ContestHubPanelModal>
      ) : null}

      {isMobileLeaderboardOpen ? (
        <ContestHubPanelModal
          eyebrow="Top testeurs"
          title="Classement testeurs"
          onClose={() => setIsMobileLeaderboardOpen(false)}
        >
          <div className="grid gap-4">
            <ContestLeaderboardHelpDropdown />
            <ContestTesterLeaderboard
              seasonItems={testerSeasonRankings}
              globalItems={testerGlobalRankings}
              profileSeasonCode={selectedSeasonCode}
              profileTrack={selectedTrack}
              compact
            />
          </div>
        </ContestHubPanelModal>
      ) : null}

      {selectedRankingEntry ? (
        <ContestRankingReviewsModal
          entry={selectedRankingEntry}
          reviews={rankingModalReviews}
          loading={rankingModalLoading}
          error={rankingModalError}
          onClose={closeRankingReviews}
          onSelectReview={openRankingReviewDetail}
        />
      ) : null}

      {selectedFeedReview ? (
        <ContestFeedReviewModal
          item={selectedFeedReview}
          busy={busyFeedVoteReviewId === selectedFeedReview.reviewId}
          error={feedVoteErrorByReviewId[selectedFeedReview.reviewId]}
          onClose={() => setSelectedFeedReviewId(null)}
          onVote={(item, value) => void voteForFeedReview(item, value)}
        />
      ) : null}

    </section>
  );
}
