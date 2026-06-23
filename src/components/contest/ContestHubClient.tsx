"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FileCheck2,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { PackOpeningFlowModal } from "@/components/account/PackOpeningFlowModal";
import { NotebookFlipBook } from "@/components/contest/NotebookFlipBook";
import { ContestNotebookPanel } from "@/components/contest/ContestNotebookPanel";
import { ContestReviewSkillRadar } from "@/components/contest/ContestReviewSkillRadar";
import { QuantitySelector } from "@/components/QuantitySelector";
import { useCart } from "@/context/CartContext";
import { categoryLabels, type Product, type ProductCategory } from "@/data/products";
import { useLotteryExperience } from "@/hooks/useLotteryExperience";
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
  PublicContestProfile,
  PublicContestProfileBadge,
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
import type { LotteryTicket, ScratchResult } from "@/types/lottery";

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

const BOOKMARK_COLORS = [
  "bg-[#ffd447] text-[#17130e]",
  "bg-[#18c58f] text-[#06251f]",
  "bg-[#ff8a4c] text-[#2b1206]",
  "bg-[#7d63ff] text-[#fffaf0]",
  "bg-[#15b8d6] text-[#062833]",
  "bg-[#ff5f87] text-[#fffaf0]",
];

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
  { id: "contest-badge-premier-carnet", code: "premier-carnet", label: "Premier Carnet", condition: "Fais valider ta premiere critique concours.", rewardPacks: 1 },
  { id: "contest-badge-gouteur-regulier", code: "gouteur-regulier", label: "Gouteur Regulier", condition: "Fais valider 3 critiques concours.", rewardPacks: 2 },
  { id: "contest-badge-marathon-des-lots", code: "marathon-des-lots", label: "Marathon des Lots", condition: "Fais valider 10 critiques concours.", rewardPacks: 4 },
  { id: "contest-badge-premiere-piste", code: "premiere-piste", label: "Premiere Piste", condition: "Trouve 1 terpene dominant sur une fleur concours.", rewardPacks: 1 },
  { id: "contest-badge-combo-aromatique", code: "combo-aromatique", label: "Combo Aromatique", condition: "Trouve 3 terpenes corrects sur une critique concours.", rewardPacks: 3 },
  { id: "contest-badge-nez-absolu", code: "nez-absolu", label: "Nez Absolu", condition: "Trouve tous les terpenes dominants d'une fleur concours.", rewardPacks: 3 },
  { id: "contest-badge-nez-divin", code: "nez-divin", label: "Nez Divin", condition: "Obtiens Nez Absolu sur 3 critiques concours.", rewardPacks: 6 },
  { id: "contest-badge-tour-de-saison", code: "tour-de-saison", label: "Tour de Saison", condition: "Fais valider 3 critiques concours sur une meme saison.", rewardPacks: 2 },
  { id: "contest-badge-expert-outdoor", code: "expert-outdoor", label: "Expert Outdoor", condition: "Fais valider 3 critiques concours outdoor.", rewardPacks: 1 },
  { id: "contest-badge-expert-greenhouse", code: "expert-greenhouse", label: "Expert Greenhouse", condition: "Fais valider 3 critiques concours greenhouse.", rewardPacks: 1 },
  { id: "contest-badge-expert-indoor", code: "expert-indoor", label: "Expert Indoor", condition: "Fais valider 3 critiques concours indoor.", rewardPacks: 1 },
  { id: "contest-badge-critique-utile", code: "critique-utile", label: "Critique Utile", condition: "Une critique concours est marquee utile par l'admin.", rewardPacks: 1 },
  { id: "contest-badge-plume-dor", code: "plume-dor", label: "Plume d'Or", condition: "Une critique concours est marquee excellente.", rewardPacks: 3 },
  { id: "contest-badge-voix-respectee", code: "voix-respectee", label: "Voix Respectee", condition: "Recois 25 pouces haut sur des critiques concours.", rewardPacks: 2 },
  { id: "contest-badge-validateur-serieux", code: "validateur-serieux", label: "Validateur Serieux", condition: "Vote sur 25 critiques concours d'autres testeurs.", rewardPacks: 1 },
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

function ContestMascotButton({
  variant,
  ariaLabel,
  caption,
  className = "",
  sceneClassName = "",
  onClick,
  onHoverPreview,
  onHoverEnd,
}: {
  variant: keyof typeof CONTEST_MASCOT_SCENES;
  ariaLabel: string;
  caption?: string;
  className?: string;
  sceneClassName?: string;
  onClick: () => void;
  onHoverPreview?: () => void;
  onHoverEnd?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") {
          onHoverPreview?.();
        }
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") {
          onHoverEnd?.();
        }
      }}
      className={`contest-mascot-button ${className}`}
      aria-label={ariaLabel}
    >
      <ContestMascotScene variant={variant} className={sceneClassName} />
      {caption ? <span className="contest-mascot-button-label">{caption}</span> : null}
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
          href="/compte/connexion?next=%2Fbete-de-concours"
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
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded border-2 border-[#1a1a1a] bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-charcoal">Niveau actuel</p>
          <p className="mt-1 text-lg font-black text-ink">{progress.currentLevel.label}</p>
        </div>
        <div className="rounded border-2 border-[#1a1a1a] bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-charcoal">Prochain palier</p>
          <p className="mt-1 text-lg font-black text-ink">
            {progress.nextLevel ? `${progress.pointsToNextLevel} pts` : "Niveau max"}
          </p>
        </div>
        <div className="rounded border-2 border-[#1a1a1a] bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-charcoal">Rang saison</p>
          <p className="mt-1 text-lg font-black text-ink">{progress.seasonRank ? `#${progress.seasonRank}` : "-"}</p>
        </div>
        <div className="rounded border-2 border-[#1a1a1a] bg-white p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-charcoal">Rang global</p>
          <p className="mt-1 text-lg font-black text-ink">{progress.globalRank ? `#${progress.globalRank}` : "-"}</p>
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

function ContestNotebookCollectionDashboard({
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
            Kanab Quest Lab
          </p>
          <h3 className="mt-1 text-xl font-black leading-tight text-ink">Dashboard collection</h3>
          <p className="mt-1 truncate text-xs font-semibold text-charcoal">{collectionTitle}</p>
        </div>
        <span className="contest-notebook-collection-chip">{completionPercent}%</span>
      </div>

      <div className="mt-3 h-4 overflow-hidden rounded-full border-2 border-[#17130e] bg-white">
        <div className="h-full bg-[#118575]" style={{ width: `${completionPercent}%` }} />
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
            href="/compte/connexion?next=%2Fbete-de-concours"
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
  availableTicketCount,
  unlockedBadgeCount,
  onChange,
}: {
  activeView: ContestNotebookView;
  availableTicketCount: number;
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
              {availableTicketCount > 0
                ? `${availableTicketCount} pack${availableTicketCount > 1 ? "s" : ""}`
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

function ContestNotebookCollectionTab({
  lottery,
  isAuthenticated,
  availableTicketCount,
  status,
  badges,
  claimingBadgeId,
  badgeMessage,
  badgeError,
  onOpenNextPack,
  onClaimBadge,
}: {
  lottery: ContestLotteryExperience;
  isAuthenticated: boolean;
  availableTicketCount: number;
  status: string | null;
  badges: PublicContestProfileBadge[];
  claimingBadgeId: string | null;
  badgeMessage: string | null;
  badgeError: string | null;
  onOpenNextPack: () => void;
  onClaimBadge: (badgeId: string) => void;
}) {
  const unlockedBadgeCount = getUnlockedContestBadgeCount(badges);

  return (
    <div className="contest-notebook-collection-tab">
      <div className="contest-lab-sheet-header">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-charcoal">
            Collection et badges
          </p>
          <h2 className="mt-1 text-xl font-black leading-tight text-ink">Dashboard collection</h2>
        </div>
        <span className="contest-lab-unlock-chip contest-lab-unlock-chip-ok">
          <Award size={14} />
          {unlockedBadgeCount}/{CONTEST_ACHIEVEMENT_BADGE_CATALOG.length}
        </span>
      </div>

      <div className="contest-notebook-booster-guide">
        <div className="contest-notebook-booster-guide-main">
          <span>Objectif gros lot</span>
          <strong>Jusqu&apos;a 1 an de conso</strong>
          <p>
            Les packs boosters se gagnent avec tes actions de testeur sur les varietes Concours.
            Plus tes critiques Concours sont utiles et precises, plus tu debloques de badges,
            de packs et de chances d&apos;avancer dans la collection.
          </p>
        </div>
        <div className="contest-notebook-booster-guide-steps" aria-label="Comment gagner des packs booster">
          <div>
            <span>Critique Concours validee</span>
            <strong>+20 pts</strong>
          </div>
          <div>
            <span>Terpenes Concours</span>
            <strong>+10 / +50 pts</strong>
          </div>
          <div>
            <span>Badges debloques</span>
            <strong>Packs a reclamer</strong>
          </div>
        </div>
      </div>

      <ContestNotebookCollectionDashboard
        lottery={lottery}
        isAuthenticated={isAuthenticated}
        availableTicketCount={availableTicketCount}
        status={status}
        onOpenNextPack={onOpenNextPack}
      />

      <ContestBadgeGallery
        badges={badges}
        isAuthenticated={isAuthenticated}
        claimingBadgeId={claimingBadgeId}
        onClaim={onClaimBadge}
        defaultExpanded
        className="contest-notebook-badge-gallery"
      />
      {badgeMessage ? <p className="text-sm font-semibold text-[#1f5a2f]">{badgeMessage}</p> : null}
      {badgeError ? <p className="text-sm font-semibold text-[#7a1010]">{badgeError}</p> : null}
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
          const color = BOOKMARK_COLORS[index % BOOKMARK_COLORS.length];
          const isActive = activeView !== "collection" && index === activeIndex;

          return (
            <button
              key={entry.id}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              type="button"
              onClick={() => onSelectEntry(index)}
              className={`contest-notebook-carousel-card ${color} ${
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
        <span>Kanab Quest Lab</span>
        <span>{CONTEST_ENTRY_CATEGORY_LABELS[entry.category]}</span>
      </div>

      <article className="contest-lab-specimen-card contest-lab-specimen-card-identity">
        <div className="contest-lab-specimen-header">
          <div className="min-w-0">
            <p>Specimen card</p>
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
  const loopEntries = displayEntries.length > 0 ? [...displayEntries, ...displayEntries] : [];
  const categoryLabel = CONTEST_ENTRY_CATEGORY_LABELS[activeCategory];

  return (
    <div className="contest-station-board" aria-label={`Classement ${categoryLabel}`}>
      <div className="contest-station-board-header">
        <span>Classement {categoryLabel}</span>
        <span>Score /{CONTEST_SCORE_MAX}</span>
        <span>Avis</span>
      </div>
      <div className="contest-station-board-window">
        {loopEntries.length > 0 ? (
          <div className="contest-station-board-track">
            {loopEntries.map((entry, index) => {
              const rank = getContestCategoryRank(entry, index % displayEntries.length);
              const selected = entry.id === selectedEntryId;

              return (
                <button
                  key={`${entry.id}-${index}`}
                  type="button"
                  onClick={() => onSelectEntry(entry.id)}
                  className={`contest-station-row ${selected ? "contest-station-row-active" : ""}`}
                  aria-label={`Ouvrir ${entry.title} dans le carnet`}
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
  if (!isAuthenticated) {
    return (
      <div className="cartoon-border bg-cream p-5 md:p-6">
        <div className="contest-illustrated-card-header">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">Profil testeur</p>
            <h2 className="mt-1 font-display text-3xl leading-none text-ink">Connecte-toi</h2>
          </div>
          {onMascotClick ? (
            <ContestMascotButton
              variant="profile"
              ariaLabel="Ouvrir le profil testeur"
              sceneClassName="contest-mascot-scene-compact"
              onClick={onMascotClick}
              onHoverPreview={onMascotHover}
              onHoverEnd={onMascotLeave}
            />
          ) : (
            <ContestMascotScene
              variant="profile"
              className="contest-mascot-scene-compact"
            />
          )}
        </div>
        <Link
          href="/compte/connexion?next=%2Fbete-de-concours"
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
          {onMascotClick ? (
            <ContestMascotButton
              variant="profile"
              ariaLabel="Ouvrir le profil testeur"
              sceneClassName="contest-mascot-scene-compact"
              onClick={onMascotClick}
              onHoverPreview={onMascotHover}
              onHoverEnd={onMascotLeave}
            />
          ) : (
            <ContestMascotScene
              variant="profile"
              className="contest-mascot-scene-compact"
            />
          )}
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
        {onMascotClick ? (
          <ContestMascotButton
            variant="profile"
            ariaLabel="Ouvrir le profil testeur"
            sceneClassName="contest-mascot-scene-compact sm:contest-mascot-scene-auto"
            onClick={onMascotClick}
            onHoverPreview={onMascotHover}
            onHoverEnd={onMascotLeave}
          />
        ) : (
          <ContestMascotScene variant="profile" className="contest-mascot-scene-compact sm:contest-mascot-scene-auto" />
        )}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded border-2 border-[#1a1a1a] bg-white px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-charcoal">Points</p>
            <p className="text-lg font-black text-ink">{progress.totalPoints}</p>
          </div>
          <div className="rounded border-2 border-[#1a1a1a] bg-white px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-charcoal">Saison</p>
            <p className="text-lg font-black text-ink">{progress.seasonRank ? `#${progress.seasonRank}` : "-"}</p>
          </div>
          <div className="rounded border-2 border-[#1a1a1a] bg-white px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-charcoal">Global</p>
            <p className="text-lg font-black text-ink">{progress.globalRank ? `#${progress.globalRank}` : "-"}</p>
          </div>
        </div>
      </div>

      <div className="mt-5">
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
    </div>
  );
}

function ContestTesterLeaderboard({
  seasonItems,
  globalItems,
  profileSeasonCode,
  profileTrack,
  onMascotClick,
  onMascotHover,
  onMascotLeave,
  compact = false,
}: {
  seasonItems: PublicContestTesterRankingItem[];
  globalItems: PublicContestTesterRankingItem[];
  profileSeasonCode?: string;
  profileTrack: ContestEntryTrack;
  onMascotClick?: () => void;
  onMascotHover?: () => void;
  onMascotLeave?: () => void;
  compact?: boolean;
}) {
  const [scope, setScope] = useState<"season" | "global">("season");
  const items = scope === "season" ? seasonItems : globalItems;

  return (
    <div className="cartoon-border bg-cream p-4 md:p-6">
      <div className={compact ? "grid gap-3" : "contest-leaderboard-illustrated-header"}>
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">Top testeurs</p>
          <h2 className={`font-display leading-none text-ink ${compact ? "text-2xl" : "text-3xl"}`}>
            Classement testeurs
          </h2>
        </div>
        {compact ? null : onMascotClick ? (
            <ContestMascotButton
              variant="leaderboard"
              ariaLabel="Ouvrir le classement testeurs"
              sceneClassName="contest-mascot-scene-compact"
              onClick={onMascotClick}
              onHoverPreview={onMascotHover}
              onHoverEnd={onMascotLeave}
            />
          ) : (
            <ContestMascotScene
              variant="leaderboard"
              className="contest-mascot-scene-compact"
            />
          )}
        <div
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
        </div>
      </div>

      <div className="mt-5 grid gap-2">
        {items.length > 0 ? (
          items.map((item) => {
            const profileParams = new URLSearchParams();
            if (scope === "season" && profileSeasonCode) {
              profileParams.set("season", profileSeasonCode);
            }
            if (profileTrack !== "regular") {
              profileParams.set("track", profileTrack);
            }
            const query = profileParams.toString();
            const profileHref = `/bete-de-concours/profils/${encodeURIComponent(item.pseudo)}${query ? `?${query}` : ""}`;

            return (
              <Link
                key={`${scope}-${item.pseudo}-${item.rank}`}
                href={profileHref}
                className="grid grid-cols-[48px_minmax(0,1fr)_72px] items-center gap-3 rounded border-2 border-[#1a1a1a] bg-white px-3 py-3 shadow-[2px_2px_0_#1a1a1a]"
              >
                <span className="rounded-full border-2 border-[#1a1a1a] bg-yellow px-2 py-1 text-center text-sm font-black text-ink">
                  #{item.rank}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black text-ink">{item.pseudo}</span>
                  <span className="block truncate text-xs font-semibold text-charcoal">
                    {item.level.label} / {item.approvedReviewCount} critique(s)
                  </span>
                </span>
                <span className="text-right text-sm font-black text-ink">{item.totalPoints} pts</span>
              </Link>
            );
          })
        ) : (
          <div className="rounded border-2 border-dashed border-[#1a1a1a] bg-white p-5 text-sm text-charcoal">
            Aucun testeur classe pour le moment.
          </div>
        )}
      </div>
    </div>
  );
}

function ContestBadgeGallery({
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
          const rewardPacks = unlocked?.rewardPackCount || badge.rewardPacks;

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
                <p className="mt-2 rounded border-2 border-[#1a1a1a] bg-white px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-ink">
                  {rewardPacks} pack{rewardPacks > 1 ? "s" : ""} booster offert{rewardPacks > 1 ? "s" : ""}
                </p>
              </div>

              {unlocked ? (
                claimed ? (
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
                    {claimingBadgeId === badge.id ? "Attribution..." : "Réclamer les packs"}
                  </button>
                )
              ) : (
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
}: ContestHubClientProps) {
  const router = useRouter();
  const { addToCart, authLoading } = useCart();
  const lottery = useLotteryExperience();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [notebookPage, setNotebookPage] = useState<0 | 1>(0);
  const [notebookView, setNotebookView] = useState<ContestNotebookView>("lab");
  const [isNotesSpreadGuideOpen, setIsNotesSpreadGuideOpen] = useState(false);
  const [lockedQty, setLockedQty] = useState(1);
  const [cartMessage, setCartMessage] = useState<string | null>(null);
  const [viewerBadges, setViewerBadges] = useState(initialViewerBadges);
  const [feedItems, setFeedItems] = useState(feed);
  const [selectedFeedReviewId, setSelectedFeedReviewId] = useState<string | null>(null);
  const [activeMascotPanel, setActiveMascotPanel] = useState<ContestMascotPanel | null>(null);
  const [isMobileLeaderboardOpen, setIsMobileLeaderboardOpen] = useState(false);
  const [hoverMascotPanel, setHoverMascotPanel] = useState<ContestMascotPanel | null>(null);
  const [busyFeedVoteReviewId, setBusyFeedVoteReviewId] = useState<string | null>(null);
  const [feedVoteErrorByReviewId, setFeedVoteErrorByReviewId] = useState<Record<string, string>>({});
  const [claimingBadgeId, setClaimingBadgeId] = useState<string | null>(null);
  const [badgeMessage, setBadgeMessage] = useState<string | null>(null);
  const [badgeError, setBadgeError] = useState<string | null>(null);
  const [selectedContestPackTicket, setSelectedContestPackTicket] = useState<LotteryTicket | null>(null);
  const [contestPackStatus, setContestPackStatus] = useState<string | null>(null);
  const effectiveSelectedIndex = clampIndex(selectedIndex, entries);
  const selectedEntry = entries[effectiveSelectedIndex] ?? null;
  const selectedUnlock = selectedEntry
    ? notebookUnlocks.find((unlock) => unlock.entryId === selectedEntry.id)
    : undefined;

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
  const availableContestPackTickets = useMemo(
    () => lottery.tickets.filter((ticket) => ticket.status === "available"),
    [lottery.tickets],
  );
  const unlockedBadgeCount = useMemo(() => getUnlockedContestBadgeCount(viewerBadges), [viewerBadges]);
  const isHubModalOpen = Boolean(selectedFeedReview);
  const visibleHoverMascotPanel = activeMascotPanel || selectedFeedReview ? null : hoverMascotPanel;

  useEffect(() => {
    setFeedItems(feed);
    setSelectedFeedReviewId(null);
  }, [feed]);

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

  const openNextContestPack = () => {
    if (!isAuthenticated) {
      const nextPath = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
      router.push(`/compte/connexion?next=${encodeURIComponent(nextPath)}`);
      return;
    }

    const nextTicket = availableContestPackTickets[0];
    if (!nextTicket) {
      setContestPackStatus("Aucun booster disponible pour le moment.");
      return;
    }

    setContestPackStatus(null);
    setSelectedContestPackTicket(nextTicket);
  };

  const handleContestPackOpen = async (ticketId: string): Promise<ScratchResult> => {
    const payload = await lottery.openPack(ticketId);
    const newCardsCount = payload.cards.filter((card) => card.ownedCount <= 1).length;
    const duplicateCardsCount = payload.cards.length - newCardsCount;

    setContestPackStatus(
      `Booster ouvert: ${payload.cards.length} cartes, ${newCardsCount} nouvelle(s), ${duplicateCardsCount} doublon(s).`,
    );

    return payload;
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

  const claimBadgeReward = async (badgeId: string) => {
    setBadgeMessage(null);
    setBadgeError(null);
    setClaimingBadgeId(badgeId);

    try {
      const response = await fetch("/api/contest/badges/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ badgeId }),
      });
      const payload = (await response.json().catch(() => null)) as {
        badges?: PublicContestProfileBadge[];
        message?: string;
        error?: string;
      } | null;

      if (!response.ok) {
        setBadgeError(payload?.error ?? "Récompense impossible à réclamer.");
        return;
      }

      if (payload?.badges) {
        setViewerBadges(payload.badges);
      }
      setBadgeMessage(payload?.message ?? "Packs booster ajoutés à ton album.");
      router.refresh();
    } catch {
      setBadgeError("Erreur réseau pendant la réclamation du badge.");
    } finally {
      setClaimingBadgeId(null);
    }
  };

  const changeSeason = (nextSeasonCode: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextSeasonCode) {
      params.set("season", nextSeasonCode);
    } else {
      params.delete("season");
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
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

  const changeCategory = (nextCategory: ContestEntryCategory) => {
    if (nextCategory === activeCategory && searchParams.get("category") === nextCategory) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("category", nextCategory);

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const openMascotPanel = (panel: ContestMascotPanel) => {
    setHoverMascotPanel(null);
    setActiveMascotPanel(panel);
  };

  const previewMascotPanel = (panel: ContestMascotPanel) => {
    if (selectedFeedReview || activeMascotPanel) {
      return;
    }

    setHoverMascotPanel(panel);
  };

  const closeMascotPreview = (panel: ContestMascotPanel) => {
    setHoverMascotPanel((current) => (current === panel ? null : current));
  };

  return (
    <section className="section-band bg-mint halftone-overlay paper-grain pt-36 pb-20">
      <div className="retro-container contest-hub-page-shell flex flex-col gap-8">
        <div className="contest-hub-intro space-y-4">
          <div className="contest-hub-title-lockup">
            <h1 className="contest-hub-title" data-text="Bête de concours">
              Bête de concours
            </h1>
          </div>
          <div className="contest-hub-intro-panel cartoon-border bg-cream p-5 md:p-6">
            <div className="contest-hub-intro-grid grid gap-5 sm:grid-cols-[minmax(0,1fr)_132px] lg:grid-cols-[170px_minmax(0,1fr)] lg:items-center lg:justify-start">
              <div className="contest-hub-intro-copy space-y-3">
                <p className="text-sm leading-relaxed text-charcoal md:text-base">
                  Ici, tu goûtes des pépites de saison, tu donnes ton avis dans ton carnet de
                  dégustation. Les boosters se gagnent uniquement avec tes critiques validées sur les
                  variétés Concours.
                </p>
              </div>

              <ContestMascotButton
                variant="intro"
                ariaLabel="Ouvrir le mode d'emploi Bete de concours"
                className="contest-hub-intro-mascot mx-auto sm:mx-0 lg:justify-self-center"
                onClick={() => openMascotPanel("intro")}
                onHoverPreview={() => previewMascotPanel("intro")}
                onHoverEnd={() => closeMascotPreview("intro")}
              />

              <div className="contest-hub-intro-controls">
                <div className="contest-filter-stack">
                  <div className="contest-track-switch grid grid-cols-2 rounded border-2 border-[#1a1a1a] bg-white p-1">
                    {CONTEST_ENTRY_TRACKS.map((track) => (
                      <button
                        key={track}
                        type="button"
                        onClick={() => changeTrack(track)}
                        className={`contest-track-switch-button min-h-[38px] px-3 text-xs font-black uppercase tracking-[0.08em] ${
                          selectedTrack === track ? "bg-yellow text-ink" : "text-charcoal"
                        }`}
                      >
                        {CONTEST_ENTRY_TRACK_LABELS[track]}
                      </button>
                    ))}
                  </div>
                  <div className="contest-category-control">
                    <span className="contest-category-control-label">Culture</span>
                    <div className="contest-category-switch" aria-label="Categorie de culture">
                      {CONTEST_ENTRY_CATEGORIES.map((category) => {
                        const count = categoryCounts[category] ?? 0;
                        const isActive = category === activeCategory;
                        const isDisabled = count === 0 && !isActive;

                        return (
                          <button
                            key={category}
                            type="button"
                            disabled={isDisabled}
                            aria-pressed={isActive}
                            aria-label={`Afficher les lots ${CONTEST_ENTRY_CATEGORY_LABELS[category]}`}
                            onClick={() => changeCategory(category)}
                            className={`contest-category-button contest-category-button--${category} ${
                              isActive ? "contest-category-button-active" : ""
                            }`}
                          >
                            <span>{CONTEST_ENTRY_CATEGORY_LABELS[category]}</span>
                            <span className="contest-category-count">{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="contest-season-control">
                <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-charcoal">
                  Saison de récolte
                </label>
                <select
                  value={selectedSeasonCode ?? ""}
                  onChange={(event) => changeSeason(event.target.value)}
                  className="h-12 w-full border-2 border-[#1a1a1a] bg-white px-3 text-sm font-semibold text-ink"
                >
                  {seasons.map((season) => (
                    <option key={season.id} value={season.code}>
                      {season.label}
                    </option>
                  ))}
                </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="contest-hub-mobile-actions grid grid-cols-2 gap-3 md:hidden">
          <ContestMascotButton
            variant="profile"
            ariaLabel="Ouvrir le profil testeur"
            caption="Profil"
            sceneClassName="contest-mascot-scene-compact"
            onClick={() => openMascotPanel("profile")}
          />
          <ContestMascotButton
            variant="leaderboard"
            ariaLabel="Ouvrir le classement testeurs"
            caption="Classement"
            sceneClassName="contest-mascot-scene-compact"
            onClick={() => setIsMobileLeaderboardOpen(true)}
          />
        </div>

        <div className="contest-hub-dashboard-cards hidden gap-6 md:grid xl:grid-cols-[minmax(0,1fr)_420px]">
          <ContestTesterProfileCard
            progress={viewerProgress}
            isAuthenticated={isAuthenticated}
            onMascotClick={() => openMascotPanel("profile")}
            onMascotHover={() => previewMascotPanel("profile")}
            onMascotLeave={() => closeMascotPreview("profile")}
          />
          <ContestTesterLeaderboard
            seasonItems={testerSeasonRankings}
            globalItems={testerGlobalRankings}
            profileSeasonCode={selectedSeasonCode}
            profileTrack={selectedTrack}
            onMascotClick={() => openMascotPanel("leaderboard")}
            onMascotHover={() => previewMascotPanel("leaderboard")}
            onMascotLeave={() => closeMascotPreview("leaderboard")}
          />
        </div>

        <div className="contest-hub-overview-block cartoon-border bg-[#f2dfbd] p-4 md:p-6">
          <div className="contest-hub-overview-row grid gap-3">
            <div className="min-w-0 space-y-3">
              <ContestStationRankingBoard
                entries={stationRankingEntries}
                activeCategory={activeCategory}
                selectedEntryId={selectedEntry?.id}
                onSelectEntry={(entryId) => {
                  const nextIndex = entries.findIndex((entry) => entry.id === entryId);
                  if (nextIndex >= 0) {
                    selectEntryByIndex(nextIndex);
                  }
                }}
              />
              <ContestReviewMarquee
                items={feedItems}
                onSelectReview={(item) => setSelectedFeedReviewId(item.reviewId)}
              />
            </div>
          </div>
        </div>

        <div className="contest-hub-main-block cartoon-border bg-[#f2dfbd] p-4 md:p-6">
          {selectedEntry ? (
            <div className="contest-hub-spread-wrap relative">
              <NotebookFlipBook
                className="contest-hub-flipbook contest-lab-notebook"
                leftPageClassName="contest-lab-page-left"
                rightPageClassName="contest-lab-page-right"
                labels={{ previous: "Lot", next: "Onglets", pageLabel: "Pages du carnet concours" }}
                activePage={notebookPage}
                onActivePageChange={changeNotebookPage}
                coverOpenPage={0}
                cover={
                  <>
                    <span className="contest-notebook-cover-shell" aria-hidden="true">
                      <Image
                        src="/contest/notebook-cover-lab-gaming-cutout.png"
                        alt=""
                        width={863}
                        height={1330}
                        priority
                        className="contest-notebook-cover-image"
                      />
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
                dialogOverlay={
                  <PackOpeningFlowModal
                    inline
                    ticket={selectedContestPackTicket}
                    onClose={() => setSelectedContestPackTicket(null)}
                    onOpen={handleContestPackOpen}
                  />
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
                right={
                  notebookView === "notes" ? (
                    <div className="contest-notebook-notes-view contest-lab-notes-view !flex h-full min-h-0 flex-col gap-3">
                      <ContestNotebookViewTabs
                        activeView={notebookView}
                        availableTicketCount={availableContestPackTickets.length}
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
                        availableTicketCount={availableContestPackTickets.length}
                        unlockedBadgeCount={unlockedBadgeCount}
                        onChange={changeNotebookView}
                      />
                      <ContestNotebookCollectionTab
                        lottery={lottery}
                        isAuthenticated={isAuthenticated}
                        availableTicketCount={availableContestPackTickets.length}
                        status={contestPackStatus}
                        badges={viewerBadges}
                        claimingBadgeId={claimingBadgeId}
                        badgeMessage={badgeMessage}
                        badgeError={badgeError}
                        onOpenNextPack={openNextContestPack}
                        onClaimBadge={claimBadgeReward}
                      />
                    </div>
                  ) : (
                  <div className="contest-lab-dashboard-page">
                    <ContestNotebookViewTabs
                      activeView={notebookView}
                      availableTicketCount={availableContestPackTickets.length}
                      unlockedBadgeCount={unlockedBadgeCount}
                      onChange={changeNotebookView}
                    />
                    <div className="contest-lab-sheet-header">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-charcoal">
                          Fiche de lab
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

        <ContestTestedFlowerCarousel
          items={testedFlowerCards}
          selectedEntryId={selectedEntry?.id}
          onOpenEntryNotes={(item) => {
            selectEntryByIndex(item.entryIndex);
            changeNotebookView("notes");
          }}
        />
      </div>

      {visibleHoverMascotPanel === "intro" ? (
        <ContestHubHoverPreview eyebrow="Mode d'emploi" title="Bete de concours">
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
          title="Bete de concours"
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
