"use client";

import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

import Image from "next/image";
import Link from "@/components/navigation/NavigationLink";
import dynamic from "next/dynamic";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, Gift, Leaf, List, LockKeyhole, Sprout, Sun, Trophy, Warehouse, X } from "lucide-react";
import type { PublicContestNotebookUnlock, PublicContestProfile, PublicContestProfileBadge } from "@/lib/contest-public-api";
import type { ContestBundleOffer, ContestBundleRewards } from "@/lib/contest-bundle-rewards";
import { getContestProductHref } from "@/lib/contest-ui";
import { getContestEntryAnalysisUrl } from "@/lib/contest-analysis";
import { CONTEST_ENTRY_CATEGORIES, CONTEST_ENTRY_CATEGORY_LABELS, CONTEST_ENTRY_TRACKS, CONTEST_ENTRY_TRACK_LABELS, type ContestEntryCategory, type ContestEntrySummary, type ContestEntryTrack, type ContestReviewEligibility } from "@/types/contest";
import { ContestFlowerImage } from "./ContestFlowerImage";
import { ContestBundleNotebookNote } from "./ContestBundleNotebookNote";
import { ContestNotebookHelp } from "./ContestNotebookHelp";
import styles from "./ContestTastingBook.module.css";
import { useKqTutorialApi } from "../placard/KqTutorialApiContext";

const NotebookPanel = dynamic(() => import("./ContestNotebookPanel").then((module) => module.ContestNotebookPanel), {
  loading: () => <p role="status" className={styles.loading}>Préparation de ta page de dégustation…</p>,
});
const NotebookRewards = dynamic(() => import("./ContestHubClient").then((module) => module.ContestNotebookCollectionTab), {
  loading: () => <p role="status" className={styles.loading}>Ouverture de tes récompenses…</p>,
});

type View = "contents" | "flowers" | "flower" | "tasting" | "rewards";
type Chapter = { track: ContestEntryTrack; category: ContestEntryCategory };
type Props = {
  entries: ContestEntrySummary[];
  unlocks: PublicContestNotebookUnlock[];
  viewerProfile: PublicContestProfile | null;
  badges: PublicContestProfileBadge[];
  isAuthenticated: boolean;
  seasonLabel: string;
  initialTrack: ContestEntryTrack;
  initialCategory: ContestEntryCategory;
  initialEntryId?: string;
  initialEditNotes?: boolean;
  draftOwnerId?: string | null;
  contestBundleOffer?: ContestBundleOffer | null;
  onExitTutorial?: () => void;
};
const CULTURES = {
  outdoor: { icon: Sun, description: "Sous le soleil", subtitle: "Les fleurs de plein air." },
  greenhouse: { icon: Sprout, description: "À l’abri des serres", subtitle: "La lumière naturelle, sous serre." },
  indoor: { icon: Warehouse, description: "En culture intérieure", subtitle: "Un environnement maîtrisé." },
};
const CHAPTERS: Chapter[] = CONTEST_ENTRY_TRACKS.flatMap((track) => CONTEST_ENTRY_CATEGORIES.map((category) => ({ track, category })));
const PRODUCER_REWARD_RULE = "Regular et Concours comptent ensemble : fais valider tes avis sur toutes les fleurs d’un producteur pour débloquer son bonus.";

export function ContestTastingBook({ entries, unlocks, viewerProfile, badges, isAuthenticated, seasonLabel, initialTrack, initialCategory, initialEntryId, initialEditNotes = false, draftOwnerId, contestBundleOffer: initialContestBundleOffer, onExitTutorial }: Props) {
  const api = useKqTutorialApi();
  const initialEntry = entries.find((item) => item.id === initialEntryId);
  const [updatedBundleOffer, setUpdatedBundleOffer] = useState<{ source: typeof initialContestBundleOffer; value: ContestBundleOffer } | null>(null);
  const bundleRequestVersionRef = useRef(0);
  const contestBundleOffer = updatedBundleOffer && updatedBundleOffer.source === initialContestBundleOffer ? updatedBundleOffer.value : initialContestBundleOffer;
  const updateBundleOffer = (value: ContestBundleOffer) => {
    bundleRequestVersionRef.current += 1;
    setUpdatedBundleOffer({ source: initialContestBundleOffer, value });
  };
  const bundleLoginHref = `/compte/connexion?next=${encodeURIComponent(`/arene/carnet/${initialTrack}`)}`;
  const coverBonusId = useId();
  const contentsBonusId = useId();
  const [contentsBonusOpen, setContentsBonusOpen] = useState(false);
  const [open, setOpen] = useState(Boolean(initialEntry));
  const [opening, setOpening] = useState(false);
  const [view, setView] = useState<View>(initialEntry ? initialEditNotes ? "tasting" : "flower" : "contents");
  const [chapter, setChapter] = useState<Chapter>({ track: initialEntry?.track ?? initialTrack, category: initialEntry?.category ?? initialCategory });
  const [entryId, setEntryId] = useState<string | null>(initialEntry?.id ?? null);
  const [visitedNotes, setVisitedNotes] = useState<string[]>(initialEntry && initialEditNotes ? [initialEntry.id] : []);
  const [turn, setTurn] = useState(0);
  const deskRef = useRef<HTMLElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const coverRef = useRef<HTMLButtonElement>(null);
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const unlockById = useMemo(() => new Map(unlocks.map((unlock) => [unlock.entryId, unlock])), [unlocks]);
  const bundleFlowerEntries = useMemo(() => entries.filter((item) => item.track === "concours").map((item) => ({ productId: item.productId, entryId: item.id })), [entries]);
  const flowers = useMemo(() => entries.filter((entry) => entry.track === chapter.track && entry.category === chapter.category), [entries, chapter.track, chapter.category]);
  const entry = flowers.find((item) => item.id === entryId);
  const chapterIndex = CHAPTERS.findIndex((item) => item.track === chapter.track && item.category === chapter.category);
  const chapterLabel = `${CONTEST_ENTRY_TRACK_LABELS[chapter.track]} · ${CONTEST_ENTRY_CATEGORY_LABELS[chapter.category]}`;
  const flowerIndex = flowers.findIndex((item) => item.id === entryId);
  const CultureIcon = CULTURES[chapter.category].icon;
  const hasContestBundleOffer = Boolean(contestBundleOffer?.available && contestBundleOffer.flowers.length > 0);
  const inFlower = view === "flower" || view === "tasting" || view === "rewards";
  const pageTitle = view === "contents" ? "Table des matières" : view === "flowers" ? CONTEST_ENTRY_CATEGORY_LABELS[chapter.category] : entry?.title ?? "Ta fleur";

  useBodyScrollLock(true);

  useEffect(() => {
    if (api.isTutorial) return;
    const url = new URL(window.location.href);
    if (open && entryId && (view === "flower" || view === "tasting" || view === "rewards")) url.searchParams.set("entry", entryId);
    else url.searchParams.delete("entry");
    if (open && view === "tasting") url.searchParams.set("view", "notes");
    else { url.searchParams.delete("view"); url.searchParams.delete("edit"); }
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
  }, [open, view, entryId, api]);

  useEffect(() => {
    if (!initialContestBundleOffer || !isAuthenticated) return;
    const controller = new AbortController();
    const refreshBundle = async () => {
      const requestVersion = ++bundleRequestVersionRef.current;
      try {
        const response = await api.request("/api/account/contest-bundle-rewards", { credentials: "include", cache: "no-store", signal: controller.signal });
        const payload = await response.json().catch(() => null) as { rewards?: ContestBundleRewards } | null;
        if (controller.signal.aborted || requestVersion !== bundleRequestVersionRef.current) return;
        if (response.status === 401) {
          setUpdatedBundleOffer({ source: initialContestBundleOffer, value: { ...initialContestBundleOffer, progress: null } });
          return;
        }
        if (!response.ok || !payload?.rewards) return;
        const { available, startsAt, minGrams, buddiesPacks, bottePacks, flowers, progress } = payload.rewards;
        setUpdatedBundleOffer({ source: initialContestBundleOffer, value: { available, startsAt, minGrams, buddiesPacks, bottePacks, flowers, progress } });
      } catch {
        // Keep the server-rendered offer when a read-only refresh is unavailable.
      }
    };
    const onReturn = () => { void refreshBundle(); };
    onReturn();
    window.addEventListener("focus", onReturn);
    window.addEventListener("pageshow", onReturn);
    return () => {
      controller.abort();
      bundleRequestVersionRef.current += 1;
      window.removeEventListener("focus", onReturn);
      window.removeEventListener("pageshow", onReturn);
    };
  }, [initialContestBundleOffer, isAuthenticated, api]);

  useEffect(() => {
    const alreadyOpen = document.body.classList.contains("contest-notebook-open");
    document.body.classList.add("contest-notebook-open");
    const desk = deskRef.current;
    const viewport = window.visualViewport;
    let restingHeight = viewport?.height ?? window.innerHeight;
    let viewportWidth = window.innerWidth;
    let rotatedDuringInput = false;
    let smallestInputHeight = restingHeight;
    let inputRequested = false;
    let keyboardReduced = false;
    let blurPending = false;
    let revealFrame = 0;
    let blurTimer = 0;
    const getField = () => {
      const active = document.activeElement;
      if (!desk?.contains(active) || !(active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement)) return null;
      if (active.readOnly || active.disabled || (active instanceof HTMLInputElement && !["text", "search", "email", "url", "tel", "number", "password"].includes(active.type))) return null;
      return active;
    };
    const revealField = () => {
      const field = getField();
      const scroll = field?.closest<HTMLElement>("[data-tasting-scroll]") ?? pageRef.current;
      if (!field || !scroll) return;
      const inset = 12;
      if (desk?.dataset.bookInputOpen === "true") {
        desk.style.setProperty("--book-input-height", `${Math.max(28, Math.min(166, scroll.clientHeight - inset * 2))}px`);
      }
      const fieldRect = field.getBoundingClientRect();
      const scrollRect = scroll.getBoundingClientRect();
      // Move only the form's scroll area. Native textarea scrolling keeps the
      // caret visible inside long comments; moving the entire book fights it.
      if (fieldRect.top < scrollRect.top + inset || fieldRect.height > scroll.clientHeight - inset * 2) {
        scroll.scrollTop += fieldRect.top - scrollRect.top - inset;
      } else if (fieldRect.bottom > scrollRect.bottom - inset) {
        scroll.scrollTop += fieldRect.bottom - scrollRect.bottom + inset;
      }
    };
    const syncViewport = () => {
      // Pinch zoom pans the browser's visual viewport; it must not squeeze the
      // book a second time. Keyboard resizing at normal scale still applies.
      const zoomed = Boolean(viewport && Math.abs(viewport.scale - 1) > 0.05);
      const height = viewport?.height ?? window.innerHeight;
      if (!zoomed) {
        desk?.style.setProperty("--book-height", `${height}px`);
        desk?.style.setProperty("--book-top", `${viewport?.offsetTop ?? 0}px`);
        if (window.innerWidth !== viewportWidth) {
          // Rotation changes the resting height too, including on browsers
          // that resize both the layout and visual viewports for the keyboard.
          viewportWidth = window.innerWidth;
          restingHeight = Math.max(height, window.innerHeight);
          smallestInputHeight = height;
          rotatedDuringInput = inputRequested;
          keyboardReduced = false;
        }
        if (inputRequested) smallestInputHeight = Math.min(smallestInputHeight, height);
      }
      const field = getField();
      const finishFocused = document.activeElement?.hasAttribute("data-book-finish-input");
      if (!zoomed && inputRequested && height < restingHeight - 80) keyboardReduced = true;
      // The system keyboard can close while the textarea retains focus.
      if (!zoomed && !blurPending && ((keyboardReduced && height >= restingHeight - 40)
        || (rotatedDuringInput && height >= smallestInputHeight + 100))) {
        inputRequested = false;
        keyboardReduced = false;
        rotatedDuringInput = false;
      }
      // Native dismissal can leave the field focused. Keep following the
      // closing animation so the next keyboard opening uses the full height.
      if (!zoomed && !inputRequested) restingHeight = height;
      const compact = inputRequested && Boolean(field || finishFocused || blurPending)
        && window.matchMedia("(max-width: 899px), (pointer: coarse)").matches;
      if (desk) desk.dataset.bookInputOpen = String(compact);
      window.cancelAnimationFrame(revealFrame);
      if (field && !zoomed) revealFrame = window.requestAnimationFrame(revealField);
    };
    const beginInput = () => {
      if (!getField()) return;
      if (!inputRequested) smallestInputHeight = viewport?.height ?? window.innerHeight;
      inputRequested = true;
      blurPending = false;
      window.clearTimeout(blurTimer);
      syncViewport();
    };
    const endInput = () => {
      window.clearTimeout(blurTimer);
      blurPending = true;
      // Let a tap on Submit/Close finish before restoring the navigation;
      // otherwise the button can move between pointerdown and click.
      blurTimer = window.setTimeout(() => {
        blurPending = false;
        if (!getField() && !document.activeElement?.hasAttribute("data-book-finish-input")) {
          inputRequested = false;
          keyboardReduced = false;
          rotatedDuringInput = false;
        }
        syncViewport();
      }, 150);
    };
    const resumeInput = (event: MouseEvent) => {
      // A native keyboard dismissal can keep focus on the field. Wait until
      // the next tap finishes before moving it, so the browser keeps focus.
      if (event.target === getField() && !inputRequested) beginInput();
    };
    syncViewport();
    desk?.addEventListener("focusin", beginInput);
    desk?.addEventListener("focusout", endInput);
    desk?.addEventListener("click", resumeInput);
    viewport?.addEventListener("resize", syncViewport);
    viewport?.addEventListener("scroll", syncViewport);
    window.addEventListener("resize", syncViewport);
    return () => {
      if (!alreadyOpen) document.body.classList.remove("contest-notebook-open");
      window.cancelAnimationFrame(revealFrame);
      window.clearTimeout(blurTimer);
      desk?.removeEventListener("focusin", beginInput);
      desk?.removeEventListener("focusout", endInput);
      desk?.removeEventListener("click", resumeInput);
      viewport?.removeEventListener("resize", syncViewport);
      viewport?.removeEventListener("scroll", syncViewport);
      window.removeEventListener("resize", syncViewport);
    };
  }, []);

  useLayoutEffect(() => {
    if (pageRef.current) pageRef.current.scrollTop = 0;
    if (open) headingRef.current?.focus({ preventScroll: true });
  }, [open, view, entryId, chapter, turn]);

  useEffect(() => {
    if (!opening) return;
    const timer = window.setTimeout(() => setOpening(false), 650);
    return () => window.clearTimeout(timer);
  }, [opening]);

  const go = (next: View) => { setView(next); setTurn((value) => value + 1); };
  const openChapter = (next: Chapter) => { setChapter(next); setEntryId(null); go("flowers"); };
  const openFlower = (id: string) => {
    const next = entries.find((item) => item.id === id);
    if (!next) return;
    setChapter({ track: next.track, category: next.category });
    setEntryId(id);
    go("flower");
  };
  const close = () => { setOpening(false); setOpen(false); requestAnimationFrame(() => coverRef.current?.focus({ preventScroll: true })); };
  const startNotes = () => {
    if (!entry) return;
    setVisitedNotes((previous) => previous.includes(entry.id) ? previous : [...previous, entry.id]);
    go("tasting");
  };
  const flip = (direction: -1 | 1) => {
    if (view === "flowers") {
      const next = CHAPTERS[chapterIndex + direction];
      if (next) openChapter(next);
    } else if (view === "flower") {
      const next = flowers[flowerIndex + direction];
      if (next) openFlower(next.id);
    }
  };
  const touchStart = (event: TouchEvent) => {
    touchRef.current = null;
    if (view !== "flowers" && view !== "flower") return;
    if ((event.target as HTMLElement).closest("button, a, input, textarea, select, summary")) return;
    if (event.touches.length === 1) touchRef.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  };
  const touchEnd = (event: TouchEvent) => {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start || !event.changedTouches.length) return;
    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > 75 && Math.abs(dy) < 35) flip(dx < 0 ? 1 : -1);
  };
  const eligibilityFor = (item: ContestEntrySummary): ContestReviewEligibility => {
    if (!isAuthenticated) return { eligible: false, reason: "not_authenticated" };
    if (!viewerProfile) return { eligible: false, reason: "missing_profile" };
    const unlock = unlockById.get(item.id);
    if (unlock?.review) return { eligible: false, reason: "already_reviewed" };
    return unlock ? { eligible: true, reason: "ok" } : { eligible: false, reason: "not_purchased" };
  };
  const loginHrefFor = (item: ContestEntrySummary) => {
    const params = new URLSearchParams({ entry: item.id, edit: "notes" });
    if (item.season?.code) params.set("season", item.season.code);
    return `/compte/connexion?next=${encodeURIComponent(`/arene/carnet/${item.track}?${params.toString()}`)}`;
  };

  return <section ref={deskRef} className={styles.desk} data-world="arena" data-tasting-book data-notebook-view={open ? view : "closed"} data-open={open || undefined}
    onKeyDown={(event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      if (deskRef.current?.dataset.bookInputOpen === "true" && document.activeElement instanceof HTMLElement) {
        event.preventDefault();
        document.activeElement.blur();
        return;
      }
      if (!open) return;
      if (view === "contents") close();
      else go(view === "tasting" || view === "rewards" ? "flower" : view === "flower" ? "flowers" : "contents");
    }}>
    <header className={styles.deskHeader}>
      {api.isTutorial ? <button type="button" className={styles.tutorialExit} onClick={onExitTutorial}><ArrowLeft size={17} aria-hidden="true" /> Retour au carnet</button> : <Link href="/arene" className={styles.arenaExit}><ArrowLeft size={17} aria-hidden="true" /> Retour à l’Arène</Link>}
      <span>Les Chanvriers Bretons</span>
      {open ? <button type="button" onClick={close} aria-label="Replier le carnet" title="Replier le carnet"><X size={18} aria-hidden="true" /></button> : <BookOpen size={18} aria-hidden="true" />}
      <button type="button" className={styles.finishInput} data-book-finish-input
        onPointerDown={(event) => event.preventDefault()}
        onClick={(event) => {
          const field = deskRef.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>("textarea:focus, input:focus");
          field?.blur();
          event.currentTarget.blur();
        }}>Fermer le clavier</button>
    </header>

    <h1 className={styles.srOnly}>Mon carnet de dégustation</h1>
    {!open || opening ? <div className={styles.closedStage} data-opening={opening || undefined} aria-hidden={open || undefined}>
      <button ref={coverRef} data-arena-tour="notebook" type="button" className={styles.cover} tabIndex={open ? -1 : 0} onClick={() => { setOpening(true); setOpen(true); go("contents"); }} aria-label="Ouvrir mon carnet de dégustation" aria-describedby={hasContestBundleOffer ? coverBonusId : undefined}>
        <span className={styles.coverBorder}>
          <span className={styles.coverKicker}>L’Arène · Carnet de dégustation</span>
          <span className={styles.coverEmblem}><Image src="/contest/mascot/tasting/tasting-start.png" alt="La mascotte avec son carnet" width={390} height={463} sizes="(max-width: 600px) 140px, 190px" preload /></span>
          <span className={styles.coverTitle}>Mon carnet<span>de dégustation</span></span>
          {hasContestBundleOffer
            ? <span id={coverBonusId} className={styles.coverBonus} data-contest-bundle-cover><Gift size={14} aria-hidden="true" /> Bonus Concours à découvrir</span>
            : <span className={styles.coverSubtitle}>Tes fleurs. Tes notes. Tes découvertes.</span>}
          <span className={styles.coverSignature}>{viewerProfile?.pseudo || "À toi d’écrire la suite"}</span>
          <span className={styles.coverAction}>Ouvrir le carnet <ArrowRight size={18} aria-hidden="true" /></span>
        </span>
      </button>
      <div className={styles.closedActions}>
        {!api.isTutorial && !open ? <ContestNotebookHelp className={styles.helpButton} /> : null}
        <p className={styles.closedHint}>{seasonLabel}</p>
      </div>
    </div> : null}

    <div className={styles.bookStage} hidden={!open}>
      <div className={styles.book}>
        <aside className={styles.frontispiece} aria-label="Repères du carnet">
          <span className={styles.imprint}>Le carnet de l’Arène</span>
          <span className={styles.guideBadge}><BookOpen size={16} aria-hidden="true" /> À toi de jouer</span>
          <p className={styles.asideTitle}>{view === "contents" ? <>À chaque fleur,<br /><em>sa découverte !</em></> : <>Les fleurs {CONTEST_ENTRY_TRACK_LABELS[chapter.track]}<br /><em>{CONTEST_ENTRY_CATEGORY_LABELS[chapter.category]}</em></>}</p>
          <figure className={styles.chapterScene}>
            <Image src="/contest/mascot/arena-scene-carnet-v1.png" alt="Sylvain prend ses notes de dégustation à son bureau, entouré de bocaux et de fiches botaniques." width={1536} height={1024} sizes="(min-width: 900px) 500px, 1px" />
            <figcaption>Prendre le temps. Suivre mes sens.</figcaption>
          </figure>
          <p>{view === "contents" ? PRODUCER_REWARD_RULE : CULTURES[chapter.category].subtitle}</p>
          <span className={styles.asideSignature}>{viewerProfile?.pseudo ? `Le carnet de ${viewerProfile.pseudo}` : "Observer · Sentir · Déguster"}</span>
          <span className={styles.ribbon} aria-hidden="true" />
        </aside>
        <div className={styles.page} onTouchStart={touchStart} onTouchEnd={touchEnd} onTouchCancel={() => { touchRef.current = null; }}>
          <header className={styles.pageHeader}>
            <button type="button" onClick={() => view === "contents" ? close() : go(inFlower ? "flowers" : "contents")} aria-label={view === "contents" ? "Replier le carnet" : inFlower ? "Revenir aux fleurs" : "Revenir au sommaire"}><ChevronLeft size={20} aria-hidden="true" /></button>
            <span>{view === "contents" ? "Première page" : chapterLabel}</span>
            <button type="button" onClick={() => go("contents")} aria-label="Table des matières"><List size={19} aria-hidden="true" /></button>
          </header>
          <div className={styles.pageHeading}>
            <p>{view === "contents" ? "Choisis ta prochaine dégustation" : view === "flowers" ? CULTURES[chapter.category].description : view === "tasting" ? "Les pages de dégustation" : view === "rewards" ? "Tes découvertes récompensées" : "La fiche botanique"}</p>
            <h2 ref={headingRef} tabIndex={-1}>{pageTitle}</h2>
          </div>
          <div ref={pageRef} className={`${styles.pageContent} ${view === "tasting" ? styles.tastingContent : ""}`} data-book-scroll>
            {view === "contents" ? <div key={`contents-${turn}`} className={styles.pageTurn}>
              <div className={styles.sylvainWelcome}>
                <Image src="/contest/mascot/tasting/tasting-start.png" alt="Ton guide de dégustation" width={390} height={463} sizes="84px" />
                <p><strong>On déguste ?</strong><span>Regular ou Concours, puis choisis ta culture.</span><small>{PRODUCER_REWARD_RULE}</small></p>
              </div>
              {CONTEST_ENTRY_TRACKS.map((track) => {
                const TrackIcon = track === "concours" ? Trophy : Leaf;
                const trackCount = entries.filter((item) => item.track === track).length;
                const hasBonus = track === "concours" && hasContestBundleOffer;
                return <section key={track} className={styles.chapterGroup} data-track={track} aria-label={`Dégustations ${CONTEST_ENTRY_TRACK_LABELS[track]} par culture`}>
                  <h3 data-bonus={hasBonus || undefined}>{hasBonus ? <button type="button" className={styles.contestBonusToggle} aria-expanded={contentsBonusOpen} aria-controls={contentsBonusId} onClick={(event) => {
                    const heading = event.currentTarget.parentElement;
                    setContentsBonusOpen(!contentsBonusOpen);
                    if (!contentsBonusOpen) requestAnimationFrame(() => heading?.scrollIntoView({ block: "start" }));
                  }}>
                    <span className={styles.chapterTitle}><TrackIcon size={15} aria-hidden="true" /> {CONTEST_ENTRY_TRACK_LABELS[track]}</span>
                    <ChevronDown size={19} className={styles.bonusChevron} aria-hidden="true" />
                    <small>{trackCount} {trackCount === 1 ? "fleur" : "fleurs"} · 3 cultures</small>
                    <span className={styles.bonusHint}><Gift size={13} aria-hidden="true" /> Bonus cadeau</span>
                  </button> : <><span><TrackIcon size={15} aria-hidden="true" /> {CONTEST_ENTRY_TRACK_LABELS[track]}</span><small>{trackCount} {trackCount === 1 ? "fleur" : "fleurs"} · 3 cultures</small></>}</h3>
                  {hasBonus && <div id={contentsBonusId} className={styles.contentsBonus} hidden={!contentsBonusOpen}>
                    {contentsBonusOpen && <ContestBundleNotebookNote offer={contestBundleOffer} flowerEntries={bundleFlowerEntries} onSelectFlower={openFlower} onOfferChange={updateBundleOffer} loginHref={bundleLoginHref} />}
                  </div>}
                  {CONTEST_ENTRY_CATEGORIES.map((category) => {
                    const count = entries.filter((item) => item.track === track && item.category === category).length;
                    const index = CHAPTERS.findIndex((item) => item.track === track && item.category === category);
                    const Icon = CULTURES[category].icon;
                    return <button type="button" key={category} className={styles.contentsRow} data-track={track} data-culture={category} data-selected={chapter.track === track && chapter.category === category || undefined} aria-current={chapter.track === track && chapter.category === category ? "page" : undefined} onClick={() => openChapter({ track, category })} aria-label={`${CONTEST_ENTRY_TRACK_LABELS[track]} · ${CONTEST_ENTRY_CATEGORY_LABELS[category]}, ${count} ${count === 1 ? "fleur" : "fleurs"}`}>
                      <Icon size={20} aria-hidden="true" /><span className={styles.contentsCopy}><strong>{CONTEST_ENTRY_CATEGORY_LABELS[category]}</strong><small>{CULTURES[category].description}</small></span><small>{count} {count === 1 ? "fleur" : "fleurs"}</small><span className={styles.pageNumber}>{String(2 + index).padStart(2, "0")}</span>
                    </button>;
                  })}
                </section>;
              })}
              <nav className={styles.appendix} aria-label="Les annexes du carnet">{api.isTutorial ? <button type="button" onClick={onExitTutorial}><ArrowLeft size={16} aria-hidden="true" /> Retour au carnet</button> : <><Link href="/profil/collection"><Gift size={16} aria-hidden="true" /> Ma collection</Link><Link href="/arene/carnet/classement"><Trophy size={16} aria-hidden="true" /> Classement des fleurs</Link></>}</nav>
            </div> : null}

            {view === "flowers" ? <div key={`flowers-${turn}`} className={styles.pageTurn}>
              {chapter.track === "concours" && <ContestBundleNotebookNote offer={contestBundleOffer} flowerEntries={bundleFlowerEntries} onSelectFlower={openFlower} onOfferChange={updateBundleOffer} loginHref={bundleLoginHref} />}
              <p className={styles.caption}>{flowers.length ? `${flowers.length} ${flowers.length === 1 ? "fleur" : "fleurs"} dans le chapitre ${chapterLabel}. Choisis une fleur pour retrouver sa fiche et écrire tes impressions.` : `Le chapitre ${chapterLabel} attend ses premières fleurs. Reviens bientôt ou explore une autre culture ou section.`}</p>
              {!flowers.length ? <div className={styles.empty}><CultureIcon size={44} strokeWidth={1} aria-hidden="true" /><p>La prochaine découverte<br />est encore en culture.</p><button type="button" onClick={() => go("contents")}>Explorer le sommaire <ArrowRight size={16} /></button></div> : <div className={styles.flowerList}>{flowers.map((item, index) => {
                const unlock = unlockById.get(item.id);
                return <button type="button" key={item.id} className={styles.flowerRow} data-book-entry={item.id} data-track={item.track} onClick={() => openFlower(item.id)}>
                  <span className={styles.flowerImage}><ContestFlowerImage entry={item} alt="" sizes="80px" /></span>
                  <span className={styles.flowerCopy}><small>Fleur {String(index + 1).padStart(2, "0")} · {item.producer?.name || "Producteur non renseigné"} · {CONTEST_ENTRY_TRACK_LABELS[item.track]}</small><strong>{item.title}</strong><span className={styles.flowerStatus} data-status={unlock?.review ? "reviewed" : unlock ? "unlocked" : "locked"}>{unlock?.review ? <><Check size={13} /> Mes notes</> : unlock ? <><BookOpen size={13} /> À déguster</> : <><LockKeyhole size={12} /> À découvrir</>}</span></span><ChevronRight size={18} aria-hidden="true" />
                </button>;
              })}</div>}
            </div> : null}

            {view === "flower" && entry ? <article key={`flower-${turn}`} className={`${styles.flowerPage} ${styles.pageTurn}`}>
              <div className={styles.specimen}><ContestFlowerImage entry={entry} alt={entry.title} sizes="(max-width: 767px) 85vw, 450px" fallbackSize={90} /><span><CultureIcon size={14} /> {CONTEST_ENTRY_CATEGORY_LABELS[entry.category]}</span></div>
              <div className={styles.flowerActions}><button type="button" className={styles.primary} onClick={startNotes}><BookOpen size={18} />{unlockById.get(entry.id)?.review ? "Retrouver mes notes" : "Déguster cette fleur"}<ArrowRight size={18} /></button><button type="button" className={styles.rewardButton} onClick={() => go("rewards")} aria-label="Voir les récompenses de cette fleur"><Gift size={19} /></button></div>
              {entry.track === "concours" && contestBundleOffer?.flowers.some((flower) => flower.productId === entry.productId) && <ContestBundleNotebookNote offer={contestBundleOffer} flowerEntries={bundleFlowerEntries} onSelectFlower={openFlower} onOfferChange={updateBundleOffer} loginHref={bundleLoginHref} compact />}
              <dl className={styles.facts}>
                <div><dt>Producteur</dt><dd>{entry.producer?.name || "Non renseigné"}</dd></div>
                <div><dt>Origine</dt><dd>{entry.producer?.region || entry.producer?.location || String(entry.technicalSheet.origin || "Non renseignée")}</dd></div>
                <div><dt>Génétique</dt><dd>{entry.technicalSheet.genetics || "Non renseignée"}</dd></div>
                <div><dt>Récolte</dt><dd>{entry.technicalSheet.harvestLabel || entry.technicalSheet.harvestDate || "Non renseignée"}</dd></div>
                {typeof entry.technicalSheet.cbdPercent === "number" ? <div><dt>CBD</dt><dd>{entry.technicalSheet.cbdPercent} %</dd></div> : null}
                {typeof entry.technicalSheet.thcPercent === "number" ? <div><dt>THC</dt><dd>{entry.technicalSheet.thcPercent} %</dd></div> : null}
                {entry.technicalSheet.soil || entry.producer?.soil ? <div><dt>Sol</dt><dd>{entry.technicalSheet.soil || entry.producer?.soil}</dd></div> : null}
              </dl>
              <details className={styles.technicalDetails}>
                <summary>Dans les détails <span aria-hidden="true">+</span></summary>
                <dl className={styles.facts}>
                  {[
                    ["Variété", entry.technicalSheet.variety || entry.title],
                    ["Manucure", entry.technicalSheet.trimMethod],
                    ["Séchage", entry.technicalSheet.dryingMethod],
                    ["Affinage", entry.technicalSheet.curingMethod],
                    ["Culture", entry.technicalSheet.indoorCulture?.join(", ")],
                  ].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
                  {entry.technicalSheet.cannabinoidRates?.map((rate) => <div key={rate.code}><dt>{rate.code}</dt><dd>{rate.rate} %</dd></div>)}
                </dl>
                {entry.technicalSheet.notes ? <p>{entry.technicalSheet.notes}</p> : null}
              </details>
              {entry.story ? <div className={styles.story}><h3>L’histoire de cette fleur</h3><p>{entry.story}</p></div> : null}
              {!api.isTutorial ? <nav className={styles.flowerLinks} aria-label="Informations de la fleur">{getContestProductHref(entry.product) ? <Link href={getContestProductHref(entry.product)!}>Voir en boutique <ArrowRight size={14} /></Link> : null}{getContestEntryAnalysisUrl(entry) ? <a href={getContestEntryAnalysisUrl(entry)!} target="_blank" rel="noopener noreferrer">Analyse du lot ↗</a> : null}</nav> : null}
            </article> : null}

            {/* Keep visited forms mounted so turning back to a flower never discards notes. */}
            {visitedNotes.map((id) => {
              const item = entries.find((candidate) => candidate.id === id);
              if (!item) return null;
              return <div key={id} hidden={view !== "tasting" || entryId !== id} className={styles.notesPage}>
                <NotebookPanel entry={item} draftOwnerId={draftOwnerId} viewerProfile={viewerProfile} viewerReview={unlockById.get(id)?.review ?? null} eligibility={eligibilityFor(item)} loginHref={loginHrefFor(item)} productHref={getContestProductHref(item.product)} displayMode="book" defaultGuideOpen={!unlockById.get(id)?.review} onCloseGuide={() => go("flower")} />
              </div>;
            })}
            {view === "rewards" && entry ? <div className={styles.rewardsPage}><NotebookRewards isAuthenticated={isAuthenticated} badges={badges} entryId={entry.id} entryTitle={entry.title} entryTrack={entry.track} reviewApproved={unlockById.get(entry.id)?.review?.status === "approved"} /></div> : null}
          </div>
          {view !== "tasting" ? <footer className={styles.pageFooter}>
            <button type="button" onClick={() => flip(-1)} disabled={view === "contents" || view === "rewards" || (view === "flowers" ? chapterIndex === 0 : flowerIndex <= 0)} aria-label={view === "flower" ? "Fleur précédente" : "Chapitre précédent"}><ChevronLeft size={18} /></button>
            <button type="button" className={styles.footerIndex} onClick={() => go("contents")}><span>{view === "contents" ? "01 · Sommaire" : view === "flowers" ? `${String(chapterIndex + 2).padStart(2, "0")} · ${chapterLabel}` : `${Math.max(1, flowerIndex + 1)} / ${flowers.length} · ${view === "rewards" ? "Récompenses" : "Fleurs"}`}</span><small>{view === "contents" ? "Deux sections · six chapitres" : inFlower ? `${chapterLabel} · Sommaire` : "Revenir au sommaire"}</small></button>
            <button type="button" onClick={() => view === "contents" ? openChapter(chapter) : flip(1)} disabled={view === "rewards" || (view === "flowers" ? chapterIndex === CHAPTERS.length - 1 : view === "flower" && flowerIndex >= flowers.length - 1)} aria-label={view === "contents" ? `Explorer ${chapterLabel}` : view === "flower" ? "Fleur suivante" : "Chapitre suivant"}><ChevronRight size={18} /></button>
          </footer> : null}
        </div>
      </div>
    </div>
  </section>;
}
