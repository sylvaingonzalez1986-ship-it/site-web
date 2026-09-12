"use client";

import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, Flower2, Gift, Leaf, List, LockKeyhole, Sprout, Sun, Trophy, Warehouse, X } from "lucide-react";
import type { PublicContestNotebookUnlock, PublicContestProfile, PublicContestProfileBadge } from "@/lib/contest-public-api";
import { getContestProductHref } from "@/lib/contest-ui";
import { getContestEntryAnalysisUrl } from "@/lib/contest-analysis";
import { CONTEST_ENTRY_CATEGORIES, CONTEST_ENTRY_CATEGORY_LABELS, CONTEST_ENTRY_TRACKS, CONTEST_ENTRY_TRACK_LABELS, type ContestEntryCategory, type ContestEntrySummary, type ContestEntryTrack, type ContestReviewEligibility } from "@/types/contest";
import styles from "./ContestTastingBook.module.css";

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
};
const CULTURES = {
  outdoor: { icon: Sun, description: "Sous le soleil", subtitle: "Les fleurs de plein air." },
  greenhouse: { icon: Sprout, description: "À l’abri des serres", subtitle: "La lumière naturelle, sous serre." },
  indoor: { icon: Warehouse, description: "En culture intérieure", subtitle: "Un environnement maîtrisé." },
};
const CHAPTERS = CONTEST_ENTRY_TRACKS.flatMap((track) => CONTEST_ENTRY_CATEGORIES.map((category) => ({ track, category })));

export function ContestTastingBook({ entries, unlocks, viewerProfile, badges, isAuthenticated, seasonLabel, initialTrack, initialCategory }: Props) {
  const [open, setOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const [view, setView] = useState<View>("contents");
  const [chapter, setChapter] = useState<Chapter>({ track: initialTrack, category: initialCategory });
  const [entryId, setEntryId] = useState<string | null>(null);
  const [visitedNotes, setVisitedNotes] = useState<string[]>([]);
  const [turn, setTurn] = useState(0);
  const deskRef = useRef<HTMLElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const coverRef = useRef<HTMLButtonElement>(null);
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const unlockById = useMemo(() => new Map(unlocks.map((unlock) => [unlock.entryId, unlock])), [unlocks]);
  const flowers = useMemo(() => entries.filter((entry) => entry.track === chapter.track && entry.category === chapter.category), [entries, chapter]);
  const entry = entries.find((item) => item.id === entryId);
  const chapterIndex = CHAPTERS.findIndex((item) => item.track === chapter.track && item.category === chapter.category);
  const flowerIndex = flowers.findIndex((item) => item.id === entryId);
  const CultureIcon = CULTURES[chapter.category].icon;
  const inFlower = view === "flower" || view === "tasting" || view === "rewards";
  const pageTitle = view === "contents" ? "Table des matières" : view === "flowers" ? CONTEST_ENTRY_CATEGORY_LABELS[chapter.category] : entry?.title ?? "Ta fleur";

  useBodyScrollLock(true);

  useEffect(() => {
    const alreadyOpen = document.body.classList.contains("contest-notebook-open");
    document.body.classList.add("contest-notebook-open");
    const syncViewport = () => {
      const viewport = window.visualViewport;
      deskRef.current?.style.setProperty("--book-height", `${viewport?.height ?? window.innerHeight}px`);
      deskRef.current?.style.setProperty("--book-top", `${viewport?.offsetTop ?? 0}px`);
    };
    syncViewport();
    window.visualViewport?.addEventListener("resize", syncViewport);
    window.visualViewport?.addEventListener("scroll", syncViewport);
    window.addEventListener("resize", syncViewport);
    return () => {
      if (!alreadyOpen) document.body.classList.remove("contest-notebook-open");
      window.visualViewport?.removeEventListener("resize", syncViewport);
      window.visualViewport?.removeEventListener("scroll", syncViewport);
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
  const openChapter = (next: Chapter) => { setChapter(next); go("flowers"); };
  const openFlower = (id: string) => { setEntryId(id); go("flower"); };
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

  return <section ref={deskRef} className={styles.desk} data-world="arena" data-tasting-book data-open={open || undefined}
    onKeyDown={(event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      if (!open) return;
      if (view === "contents") close();
      else go(view === "tasting" || view === "rewards" ? "flower" : view === "flower" ? "flowers" : "contents");
    }}>
    <header className={styles.deskHeader}>
      <Link href="/arene"><ArrowLeft size={17} aria-hidden="true" /> L’Arène</Link>
      <span>Les Chanvriers Bretons</span>
      {open ? <button type="button" onClick={close} aria-label="Fermer le carnet"><X size={18} aria-hidden="true" /></button> : <BookOpen size={18} aria-hidden="true" />}
    </header>

    <h1 className={styles.srOnly}>Mon carnet de dégustation</h1>
    {!open || opening ? <div className={styles.closedStage} data-opening={opening || undefined} aria-hidden={open || undefined}>
      <button ref={coverRef} type="button" className={styles.cover} tabIndex={open ? -1 : 0} onClick={() => { setOpening(true); setOpen(true); go("contents"); }} aria-label="Ouvrir mon carnet de dégustation">
        <span className={styles.coverBorder}>
          <span className={styles.coverKicker}>L’Arène · Carnet de dégustation</span>
          <span className={styles.coverEmblem}><Image src="/contest/mascot/tasting/tasting-start.png" alt="La mascotte avec son carnet" width={408} height={771} sizes="120px" priority /><span aria-hidden="true">À toi de jouer !</span></span>
          <span className={styles.coverTitle}>Mon carnet<span>de dégustation</span></span>
          <span className={styles.coverSubtitle}>Tes fleurs. Tes notes. Tes découvertes.</span>
          <span className={styles.coverSignature}>{viewerProfile?.pseudo || "À toi d’écrire la suite"}</span>
          <span className={styles.coverAction}>Ouvrir le carnet <ArrowRight size={18} aria-hidden="true" /></span>
        </span>
      </button>
      <p className={styles.closedHint}>{seasonLabel}</p>
    </div> : null}

    <div className={styles.bookStage} hidden={!open}>
      <div className={styles.book} data-tone={chapter.track}>
        <aside className={styles.frontispiece} aria-label="Repères du carnet">
          <span className={styles.imprint}>Le carnet de l’Arène</span>
          <span className={styles.guideBadge}><BookOpen size={16} aria-hidden="true" /> À toi de jouer</span>
          <p className={styles.asideTitle}>{view === "contents" ? <>À chaque fleur,<br />sa découverte !</> : <>{CONTEST_ENTRY_TRACK_LABELS[chapter.track]}<br /><em>{CONTEST_ENTRY_CATEGORY_LABELS[chapter.category]}</em></>}</p>
          <p>{view === "contents" ? "Une fleur, cinq étapes, tes propres impressions. Chaque dégustation écrit une nouvelle page." : CULTURES[chapter.category].subtitle}</p>
          <Image src="/contest/mascot/tasting/tasting-start.png" alt="" width={408} height={771} sizes="180px" className={styles.mascot} />
          <span className={styles.asideSignature}>{viewerProfile?.pseudo ? `Le carnet de ${viewerProfile.pseudo}` : "Observer · Sentir · Déguster"}</span>
          <span className={styles.ribbon} aria-hidden="true" />
        </aside>
        <div className={styles.page} onTouchStart={touchStart} onTouchEnd={touchEnd} onTouchCancel={() => { touchRef.current = null; }}>
          <header className={styles.pageHeader}>
            <button type="button" onClick={() => view === "contents" ? close() : go(inFlower ? "flowers" : "contents")} aria-label={view === "contents" ? "Fermer le carnet" : inFlower ? "Revenir aux fleurs" : "Revenir au sommaire"}><ChevronLeft size={20} aria-hidden="true" /></button>
            <span>{view === "contents" ? "Première page" : `${CONTEST_ENTRY_TRACK_LABELS[chapter.track]} · ${CONTEST_ENTRY_CATEGORY_LABELS[chapter.category]}`}</span>
            <button type="button" onClick={() => go("contents")} aria-label="Table des matières"><List size={19} aria-hidden="true" /></button>
          </header>
          <div className={styles.pageHeading}>
            <p>{view === "contents" ? "Choisis ta prochaine dégustation" : view === "flowers" ? CULTURES[chapter.category].description : view === "tasting" ? "Les pages de dégustation" : view === "rewards" ? "Tes découvertes récompensées" : "La fiche botanique"}</p>
            <h2 ref={headingRef} tabIndex={-1}>{pageTitle}</h2>
          </div>
          <div ref={pageRef} className={`${styles.pageContent} ${view === "tasting" ? styles.tastingContent : ""}`} data-book-scroll>
            {view === "contents" ? <div key={`contents-${turn}`} className={styles.pageTurn}>
              <div className={styles.sylvainWelcome}>
                <Image src="/contest/mascot/tasting/tasting-start.png" alt="Ton guide de dégustation" width={408} height={771} sizes="64px" />
                <p><strong>On déguste ensemble ?</strong><span>Choisis ta culture, je te guide pour la suite.</span></p>
              </div>
              {CONTEST_ENTRY_TRACKS.map((track, trackIndex) => <section key={track} className={styles.chapterGroup} data-track={track} aria-label={`Dégustations ${CONTEST_ENTRY_TRACK_LABELS[track]}`}>
                <h3><span>{track === "concours" ? <Trophy size={15} /> : <Leaf size={15} />} {CONTEST_ENTRY_TRACK_LABELS[track]}</span><small>{track === "concours" ? "Les fleurs en compétition" : "Les découvertes du quotidien"}</small></h3>
                {CONTEST_ENTRY_CATEGORIES.map((category, index) => {
                  const count = entries.filter((item) => item.track === track && item.category === category).length;
                  const Icon = CULTURES[category].icon;
                  return <button type="button" key={category} className={styles.contentsRow} data-culture={category} onClick={() => openChapter({ track, category })} aria-label={`${CONTEST_ENTRY_TRACK_LABELS[track]} ${CONTEST_ENTRY_CATEGORY_LABELS[category]}, ${count} fleurs`}>
                    <Icon size={20} aria-hidden="true" /><span>{CONTEST_ENTRY_CATEGORY_LABELS[category]}</span><span className={styles.dots} aria-hidden="true" /><small>{count} {count === 1 ? "fleur" : "fleurs"}</small><span className={styles.pageNumber}>{String(2 + trackIndex * 3 + index).padStart(2, "0")}</span>
                  </button>;
                })}
              </section>)}
              <nav className={styles.appendix} aria-label="Les annexes du carnet"><Link href="/profil/collection"><Gift size={16} aria-hidden="true" /> Ma collection</Link><Link href="/arene/carnet/classement"><Trophy size={16} aria-hidden="true" /> Classement des fleurs</Link></nav>
            </div> : null}

            {view === "flowers" ? <div key={`flowers-${turn}`} className={styles.pageTurn}>
              <p className={styles.caption}>{flowers.length ? "Choisis une fleur pour retrouver sa fiche et écrire tes impressions." : "Ce chapitre attend ses premières fleurs. Reviens bientôt ou explore une autre culture."}</p>
              {!flowers.length ? <div className={styles.empty}><CultureIcon size={44} strokeWidth={1} aria-hidden="true" /><p>La prochaine découverte<br />est encore en culture.</p><button type="button" onClick={() => go("contents")}>Explorer le sommaire <ArrowRight size={16} /></button></div> : <div className={styles.flowerList}>{flowers.map((item, index) => {
                const unlock = unlockById.get(item.id);
                return <button type="button" key={item.id} className={styles.flowerRow} onClick={() => openFlower(item.id)}>
                  <span className={styles.flowerImage}>{item.imageUrl || item.product?.image ? <Image src={item.imageUrl || item.product!.image} alt="" fill sizes="80px" /> : <Flower2 size={32} aria-hidden="true" />}</span>
                  <span className={styles.flowerCopy}><small>Fleur {String(index + 1).padStart(2, "0")} · {item.producer?.name || CONTEST_ENTRY_CATEGORY_LABELS[item.category]}</small><strong>{item.title}</strong><span className={styles.flowerStatus}>{unlock?.review ? <><Check size={13} /> Mes notes</> : unlock ? <><BookOpen size={13} /> À déguster</> : <><LockKeyhole size={12} /> À découvrir</>}</span></span><ChevronRight size={18} aria-hidden="true" />
                </button>;
              })}</div>}
            </div> : null}

            {view === "flower" && entry ? <article key={`flower-${turn}`} className={`${styles.flowerPage} ${styles.pageTurn}`}>
              <div className={styles.specimen}>{entry.imageUrl || entry.product?.image ? <Image src={entry.imageUrl || entry.product!.image} alt={entry.title} fill sizes="(max-width: 767px) 85vw, 450px" /> : <Flower2 size={90} strokeWidth={1} />}<span><CultureIcon size={14} /> {CONTEST_ENTRY_CATEGORY_LABELS[entry.category]}</span></div>
              <div className={styles.flowerActions}><button type="button" className={styles.primary} onClick={startNotes}><BookOpen size={18} />{unlockById.get(entry.id)?.review ? "Retrouver mes notes" : "Déguster cette fleur"}<ArrowRight size={18} /></button><button type="button" className={styles.rewardButton} onClick={() => go("rewards")} aria-label="Voir les récompenses de cette fleur"><Gift size={19} /></button></div>
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
              <nav className={styles.flowerLinks} aria-label="Informations de la fleur">{getContestProductHref(entry.product) ? <Link href={getContestProductHref(entry.product)!}>Voir en boutique <ArrowRight size={14} /></Link> : null}{getContestEntryAnalysisUrl(entry) ? <a href={getContestEntryAnalysisUrl(entry)!} target="_blank" rel="noopener noreferrer">Analyse du lot ↗</a> : null}</nav>
            </article> : null}

            {/* Keep visited forms mounted so turning back to a flower never discards notes. */}
            {visitedNotes.map((id) => {
              const item = entries.find((candidate) => candidate.id === id);
              if (!item) return null;
              return <div key={id} hidden={view !== "tasting" || entryId !== id} className={styles.notesPage}>
                <NotebookPanel entry={item} viewerProfile={viewerProfile} viewerReview={unlockById.get(id)?.review ?? null} eligibility={eligibilityFor(item)} loginHref={`/compte/connexion?next=${encodeURIComponent(`/arene/carnet/${item.track}?category=${item.category}`)}`} productHref={getContestProductHref(item.product)} displayMode="book" defaultGuideOpen={!unlockById.get(id)?.review} onCloseGuide={() => go("flower")} />
              </div>;
            })}
            {view === "rewards" && entry ? <div className={styles.rewardsPage}><NotebookRewards isAuthenticated={isAuthenticated} badges={badges} entryId={entry.id} entryTitle={entry.title} entryTrack={entry.track} reviewApproved={unlockById.get(entry.id)?.review?.status === "approved"} /></div> : null}
          </div>
          {view !== "tasting" ? <footer className={styles.pageFooter}>
            <button type="button" onClick={() => flip(-1)} disabled={view === "contents" || view === "rewards" || (view === "flowers" ? chapterIndex === 0 : flowerIndex <= 0)} aria-label={view === "flower" ? "Fleur précédente" : "Chapitre précédent"}><ChevronLeft size={18} /></button>
            <button type="button" className={styles.footerIndex} onClick={() => go("contents")}><span>{view === "contents" ? "01 · Sommaire" : view === "flowers" ? `${String(chapterIndex + 2).padStart(2, "0")} · ${CONTEST_ENTRY_TRACK_LABELS[chapter.track]}` : `${Math.max(1, flowerIndex + 1)} / ${flowers.length} · ${view === "rewards" ? "Récompenses" : "Fleurs"}`}</span><small>{view === "contents" ? "Six chapitres à explorer" : "Revenir au sommaire"}</small></button>
            <button type="button" onClick={() => view === "contents" ? openChapter(chapter) : flip(1)} disabled={view === "rewards" || (view === "flowers" ? chapterIndex === CHAPTERS.length - 1 : view === "flower" && flowerIndex >= flowers.length - 1)} aria-label={view === "contents" ? "Explorer les fleurs" : view === "flower" ? "Fleur suivante" : "Chapitre suivant"}><ChevronRight size={18} /></button>
          </footer> : null}
        </div>
      </div>
    </div>
  </section>;
}
