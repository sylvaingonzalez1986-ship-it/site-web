"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { BookOpen, Check, ChevronDown, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { FARM_GUIDE_CHAPTERS, KQ_FARM_GUIDE_OPEN_EVENT, getFarmGuideAdvice, getFarmGuideChapter, type FarmGuideDestination, type FarmGuideFacts } from "@/lib/kanab-quest-farm-guide";
import { FARM_GUIDE_STEPS, farmStepAdvice, farmStepChapter, followFarmHarvest, getFarmStep, observeFarmProgress, isFarmProgressComplete, type FarmEvidence, type FarmProgress, type FarmVisitId } from "@/lib/kanab-quest-farm-progress";
import { getFarmStepState, selectFarmStep, replayFarmStep, resumeFarmProgress, pauseFarmProgress, type FarmStepId } from "@/lib/kanab-quest-farm-progress";
import { farmProgressStorageKey, farmPreferenceStorageKey, loadFarmProgress, saveFarmProgress } from "@/lib/kanab-quest-farm-persistence";
import { collectFarmResumeEvidence } from "@/lib/kanab-quest-farm-resume";
import { type ArenaPlayableLessonId } from "@/lib/arena-playable-learning";
import { KqTutorialLibrary } from "./KqTutorialLibrary";
import { KqProgressMeter } from "./KqVisuals";
import styles from "./KqFarmGuide.module.css";

const browserGuideStorage = { getItem: (key: string) => window.localStorage.getItem(key), setItem: (key: string, value: string) => window.localStorage.setItem(key, value) };
const Practice = dynamic(() => import("../contest/ArenaPlayableLesson").then(module => module.ArenaPlayableLesson), { ssr: false });

function visible(selector: string, scope: ParentNode = document): HTMLElement | null {
  return [...(scope instanceof HTMLElement && scope.matches(selector) ? [scope] : []), ...scope.querySelectorAll<HTMLElement>(selector)].find(element => {
    if (!element.checkVisibility() || element.closest("[hidden],[inert]")) return false;
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      if (parent.matches("details:not([open])") && !parent.querySelector(":scope > summary")?.contains(element)) return false;
    }
    return true;
  }) ?? null;
}
function readFacts(scope: ParentNode, flowerId?: string): FarmGuideFacts {
  const attr = (selector: string, key: string) => visible(selector, scope)?.getAttribute(key) ?? undefined;
  return {
    phase: attr("[data-culture-play]", "data-culture-phase"), preparation: !!visible("[data-culture-start-review]", scope),
    harvested: !!visible("[data-harvest-moment][data-outcome=harvest]", scope),
    cultureDead: !!visible("[data-culture-recovery], [data-harvest-moment][data-outcome=dead], [data-harvest-moment][data-outcome=empty]", scope),
    room: attr("[data-warehouse-room][aria-selected=true]", "data-warehouse-room"),
    emptyPlan: !!visible("[data-warehouse-map]", scope) && !scope.querySelector("[data-warehouse-zone-chip]"),
    planDraft: !!visible("[data-warehouse-draft=true]", scope),
    album: attr("[data-collection-tab][aria-selected=true]", "data-collection-tab"), commerce: attr("[data-screen]", "data-screen"),
    social: attr("[data-social-view][aria-pressed=true]", "data-social-view"), business: attr("[data-shop-view][aria-selected=true]", "data-shop-view"),
    bank: attr("[id^=bank-desk-][aria-selected=true]", "id")?.replace("bank-desk-", ""),
    staffTab: attr("[data-staff-tab][aria-selected=true]", "data-staff-tab"),
    trimState: flowerId ? attr(`[data-guide-trim-flower-id="${flowerId}"]`, "data-guide-trim-state") ?? (visible('[data-guide-trim-ready="true"]', scope) && !scope.querySelector(`[data-guide-trim-flower-id="${flowerId}"]`) ? "not-required" : undefined) : undefined,
    storageEmpty: attr("[data-storage-lot-count]", "data-storage-lot-count") === "0",
    curing: !!visible("[data-culture-curing]", scope) && !visible("[data-culture-ranked-flower]:not(:disabled), [data-culture-training-flower]:not(:disabled)", scope),
    error: !!visible("[role=alert]", scope),
  };
}
/** Evidence attributes use confirmed snapshots, never draft forms or navigation URLs. */
function readEvidence(scope: ParentNode, facts: FarmGuideFacts, destination: FarmGuideDestination, followedFlowerId?: string): FarmEvidence {
  const attr = (selector: string, key: string) => visible(selector, scope)?.getAttribute(key) ?? undefined;
  const count = (name: string) => { const value = attr(`[${name}]`, name); return value !== undefined && /^\d+$/.test(value) ? Number(value) : undefined; };
  const visits: FarmVisitId[] = [];
  if (visible("[data-buddie-collection-profile]", scope)) visits.push("buddies");
  if (visible("[data-tutorial-card-detail]", scope)) visits.push("cards");
  if (visible("[data-arena-tour-surface=shop][data-guide-pack-count] [data-shop-panel=botte] details[open]", scope) && !visible("[aria-busy=true]", scope)) visits.push("packs");
  if (visible("[data-guide-finances-ready=true]", scope)) visits.push("accounts");
  if (visible("[data-online-listings-heading]", scope)) visits.push("listings");
  if (visible("[data-bank-schedule-details][open], [data-bank-blocked-reason]", scope)) visits.push("bank");
  const discoveries = {
    site: '[data-online-preview-details][open], [data-online-hosting=active][open]',
    studio: '[data-studio-levels-details][open], [data-studio-art-details][open]',
    merch: '[data-merch-catalog-details][open]',
    promotion: '[data-marketing-forecast-details][open], [data-advertising-rules-details][open]',
    adventure: '[data-social-scene] [data-social-context], [data-social-result]',
    partners: '[data-social-offer] [data-social-pricing] details[open], [data-social-contract-details][open], [data-social-locked-offers][open]',
    missions: '[data-mission-track] details[open]',
    'culture-health': '[data-culture-care] [data-care-content] details[open]',
    'care-reserve': '[data-care-reserve-status=ready] [data-care-product]',
    'equipment-plan': '[data-warehouse-plan-quote]:has([data-warehouse-plan-payable-cents]) [data-warehouse-plan-quote-details][open]',
    'equipment-upgrades': '[data-workshop-tiers] [data-workshop-tier][data-selected=true], [data-workshop-tiers] [data-workshop-tier] details[open]',
    energy: '[data-campaign-energy][aria-busy=false] details[open]',
    'product-preparation': '[data-preparation-details][open]',
    suppliers: '[data-player-work-form][data-player-work-kind=administration]',
    'school-motion': '[data-school-tournament][data-motion=off]',

  } as const;
  for (const [id, selector] of Object.entries(discoveries)) if (visible(selector, scope)) visits.push(id as FarmVisitId);
  if (destination.view === "staff" && visible("[data-guide-staff-ready=true]", scope)) {
    if (visible("[data-staff-hire-form]", scope)) visits.push("staff-candidate");
    if (visible("[data-staff-guide=planning][open]", scope)) visits.push("staff-planning");
    if (visible("[data-staff-guide=development][open]", scope)) visits.push("staff-development");
    if (visible("[data-staff-guide=week][open]", scope)) visits.push("staff-week");
    if (visible("[data-staff-panel=payroll]", scope)) visits.push("staff-payroll");
  }
  const observed = [...(scope instanceof HTMLElement && scope.hasAttribute("data-tutorial-observation") ? [scope] : []), ...scope.querySelectorAll<HTMLElement>("[data-tutorial-observation]")];
  for (const node of observed) {
    if (node.checkVisibility() && !node.closest("[hidden],[inert],details:not([open])") && !node.closest('[aria-busy="true"]')) {
      const id = node.dataset.tutorialObservation;
      if (FARM_GUIDE_STEPS.some(step => step.id === id)) visits.push(id as FarmVisitId);
    }
  }
  if (visible('[data-player-work-status][data-tutorial-ready=true] details[open]', scope)) visits.push('work-hours');
  if (visible('[data-library-diagram][open], [data-cannabis-article] details[open]', scope)) visits.push('school-learn');
  if (visible('[data-chanvrier-profile][data-profile-step="review"]:not([aria-busy="true"])', scope)) visits.push('profile');
  if (visible('[data-notebook-mode-details][open]', scope)) visits.push('notebook');
  if (visible('[data-culture-launch-cards][open], [data-deck-preparation][data-tutorial-ready=true] [data-deck-compatibility][open]', scope)) visits.push('deck');
  if (visible('[data-school-tournament][data-tutorial-ready=true] > details[open]', scope)) visits.push('school-tournament');
  if (visible('[data-arena-ranking-board][data-tutorial-ready=true] > details[open]', scope)) visits.push('arena-ranking');
  const jurySelector = "[data-guide-jury-verdict=true][data-guide-flower-id]";
  const juryIds = [...(scope instanceof HTMLElement && scope.matches(jurySelector) ? [scope] : []), ...scope.querySelectorAll<HTMLElement>(jurySelector)]
    .filter(node => node.checkVisibility() && !node.closest("[hidden],[inert]"))
    .map(node => node.dataset.guideFlowerId!);
  const trimNode = visible(followedFlowerId ? `[data-guide-trim-flower-id="${followedFlowerId}"][data-guide-trim-state]` : "[data-guide-trim-flower-id][data-guide-trim-state]", scope);
  const trimState = trimNode?.dataset.guideTrimState ?? (followedFlowerId && facts.trimState === "not-required" ? "not-required" : undefined);
  const unavailable: FarmEvidence['unavailable'] = {};
  if (count('data-guide-pack-count') === 0) unavailable['pack-open'] = 'Aucun pack disponible. Reviens après une récompense ; aucun achat n’est nécessaire pour poursuivre les autres chapitres.';
  if (visible('[data-staff-candidates-empty=true]', scope)) unavailable['staff-candidate'] = 'Aucun candidat disponible. Reviens lors du renouvellement indiqué dans Personnel.';
  return {
    error: facts.error, visits, unavailable,
    openedPack: !!visible('[data-guide-pack-opened=true]', scope),
    cardPlayed: !!visible('[data-guide-card-played=true]', scope),
    schoolAnswered: !!visible('[data-guide-school-answered=true]', scope),
    savedZones: count("data-guide-saved-zone-count"), assignedZones: count("data-guide-assigned-zone-count"),
    cultureStarted: !!visible("[data-guide-culture-started=true]", scope), rolled: facts.phase === "rolled" || facts.phase === "resolved",
    turnResolved: !!visible("[data-guide-turn-resolved=true]", scope),
    harvestId: attr("[data-guide-harvest-confirmed=true]", "data-guide-flower-id"),
    lots: Array.from(scope.querySelectorAll<HTMLElement>("[data-conservation-lot][data-guide-flower-id]"))
      .filter(node => node.checkVisibility() && !node.closest("[hidden],[inert]"))
      .map(node => ({ id: node.dataset.guideFlowerId!, protected: node.dataset.guideLotProtected === "true", ready: node.dataset.guideCuringReady === "true" })),
    juryIds, saleId: attr("[data-guide-sale-confirmed=true]", "data-guide-flower-id"),
    ...(["required", "running", "queued", "complete", "not-required"].includes(trimState ?? "") ? { trim: { id: followedFlowerId ?? trimNode!.dataset.guideTrimFlowerId!, state: trimState as NonNullable<FarmEvidence["trim"]>["state"] } } : {}),
  };
}

export function KqFarmGuide({ ownerId, initialOpen = false, initialStep, destination, onNavigate, onActiveChange }: {
  ownerId?: string; initialOpen?: boolean; initialStep?: FarmStepId; destination: FarmGuideDestination;
  onNavigate: (destination: FarmGuideDestination & { flowerId?: string }) => void; onActiveChange: (active: boolean, started: boolean, completed: boolean) => void;
}) {
  const [initial] = useState(() => {
    const loaded = loadFarmProgress(browserGuideStorage, ownerId ?? "guest", initialOpen);
    return initialOpen && initialStep ? { ...loaded, state: selectFarmStep(loaded.state, initialStep) } : loaded;
  });
  const [state, setState] = useState<FarmProgress>(initial.state);
  const stateRef = useRef(state);
  const [warning, setWarning] = useState(initial.warning);
  const [facts, setFacts] = useState<FarmGuideFacts>({});
  const [evidence, setEvidence] = useState<FarmEvidence>({});
  const [feedback, setFeedback] = useState("");
  const [reconciling, setReconciling] = useState(false);
  const [resumeError, setResumeError] = useState(false);
  const [resumeRequest, setResumeRequest] = useState(0);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [practice, setPractice] = useState<ArenaPlayableLessonId | null>(null);
  const navigationFrom = useRef<string | null>(null);
  const openedFromLoic = useRef(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [targetAvailable, setTargetAvailable] = useState(false);
  const [harvestChoices, setHarvestChoices] = useState<{ id: string; label: string }[]>([]);
  const [headerOffset, setHeaderOffset] = useState(8);
  const anchor = useRef<HTMLDivElement>(null), heading = useRef<HTMLButtonElement>(null), marked = useRef<HTMLElement | null>(null);
  const titleId = useId(), bodyId = useId();
  const { view, section, pole } = destination;
  const step = getFarmStep(state, evidence), currentChapter = getFarmGuideChapter(destination);
  const completed = isFarmProgressComplete(state);
  const replaying = Boolean(state.replayStepId);
  const stepState = step ? getFarmStepState(state, step.id, evidence) : undefined;
  const chapter = step ? farmStepChapter(step) : FARM_GUIDE_CHAPTERS[FARM_GUIDE_CHAPTERS.length - 1];
  const advice = step ? farmStepAdvice(step, facts, currentChapter.id) : { line: "La ferme est entre tes mains. Tu peux fermer ce guide et continuer ta partie. Les aides des écrans restent disponibles.", target: "[data-mission-summary]" };
  const portrait = ["school", "tournament", "school-ranking", "notebook"].includes(chapter.id) ? "savoir" : ["jury", "missions", "ranking"].includes(chapter.id) ? "defi" : ["warehouse", "processing", "accounts", "bank", "business", "staff"].includes(chapter.id) ? "atelier" : "culture";
  const here = currentChapter.id === chapter.id && (step?.id !== "trim" || facts.room === "processing");
  const targetFor = (progress: FarmProgress, fresh: FarmGuideFacts) => {
    const objective = getFarmStep(progress, evidence);
    if (!objective) return "[data-mission-summary]";
    const fallback = farmStepAdvice(objective, fresh, currentChapter.id).target;
    if (fresh.error || !progress.flowerId) return fallback;
    if (["store", "cure"].includes(objective.id)) return `[data-conservation-lot="${progress.flowerId}"]`;
    if (objective.id === "trim") return `[data-guide-trim-flower-id="${progress.flowerId}"]`;
    if (objective.id === "jury") return `[data-culture-ranked-flower="${progress.flowerId}"], [data-culture-training-flower="${progress.flowerId}"], [data-culture-open-storage="${progress.flowerId}"]`;
    return fallback;
  };
  const targetSelector = targetFor(state, facts);
  const save = useCallback((next: FarmProgress) => {
    stateRef.current = next; setState(next);
    if (!saveFarmProgress(browserGuideStorage, ownerId ?? "guest", next, initial.writable)) setWarning(true);
  }, [initial.writable, ownerId]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== farmProgressStorageKey(ownerId) && event.key !== farmPreferenceStorageKey(ownerId)) return;
      const loaded = loadFarmProgress(browserGuideStorage, ownerId);
      stateRef.current = loaded.state; setState(loaded.state);
      if (loaded.warning) setWarning(true);
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [ownerId]);
  const scope = useCallback(() => visible('dialog[open]:has([data-farm-guide-host]), [role=dialog][aria-modal=true]:has([data-farm-guide-host])') ?? anchor.current?.closest("[data-placard-view]"), []);
  useEffect(() => {
    const header = anchor.current?.parentElement?.querySelector(":scope > header");
    if (!header) {
      const frame = requestAnimationFrame(() => setHeaderOffset(8));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new ResizeObserver(() => setHeaderOffset(Math.ceil(header.getBoundingClientRect().height) + 8));
    observer.observe(header);
    return () => observer.disconnect();
  }, [view]);
  useEffect(() => { onActiveChange(state.active, state.started, completed); }, [state.active, state.started, completed, onActiveChange]);
  useEffect(() => {
    const open = (event: Event) => {
      const fromLoic = event instanceof CustomEvent && event.detail?.source === "loic";
      // Repeated physical taps cannot restart reconciliation or alter a review.
      if (fromLoic && stateRef.current.active) { heading.current?.focus({ preventScroll: true }); return; }
      openedFromLoic.current = fromLoic;
      save(resumeFarmProgress(stateRef.current)); setLibraryOpen(false); setResumeRequest(value => value + 1);
      requestAnimationFrame(() => { heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView({ block: "nearest" }); });
    };
    window.addEventListener(KQ_FARM_GUIDE_OPEN_EVENT, open);
    return () => window.removeEventListener(KQ_FARM_GUIDE_OPEN_EVENT, open);
  }, [save]);
  useEffect(() => {
    if (!state.active || !ownerId) return;
    let cancelled = false;
    const controller = new AbortController();
    const frame = requestAnimationFrame(() => {
      setReconciling(true); setResumeError(false);
      void collectFarmResumeEvidence(fetch, AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])).then(result => {
        if (cancelled) return;
        const next = observeFarmProgress(stateRef.current, result);
        if (next !== stateRef.current) save(next);
      }).catch(() => { if (!cancelled) setResumeError(true); }).finally(() => { if (!cancelled) setReconciling(false); });
    });
    return () => { cancelled = true; cancelAnimationFrame(frame); controller.abort(); };
  }, [state.active, ownerId, resumeRequest, save]);
  useEffect(() => {
    const rememberNavigation = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('[data-placard-nav], [data-map-building], [data-placard-next-action] button, [data-placard-next-action] a')) navigationFrom.current = view;
    };
    document.addEventListener('click', rememberNavigation, true);
    return () => document.removeEventListener('click', rememberNavigation, true);
  }, [view]);
  useEffect(() => {
    if (!initialOpen || !initial.writable) return;
    const frame = requestAnimationFrame(() => save(stateRef.current));
    return () => cancelAnimationFrame(frame);
  }, [initialOpen, initial.writable, save]);
  useEffect(() => {
    if (practice || libraryOpen) return;
    let frame = 0;
    const scan = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const collectionHost = visible('dialog[open] [data-farm-guide-host], [role=dialog][aria-modal=true] [data-farm-guide-host]');
        setHost(current => current === collectionHost ? current : collectionHost);
        if (!stateRef.current.started) return;
        const currentScope = scope();
        if (!currentScope) return;
        const fresh = readFacts(currentScope, stateRef.current.flowerId);
        const choices = Array.from(currentScope.querySelectorAll<HTMLElement>("[data-conservation-lot][data-guide-flower-id]"))
          .filter(node => node.checkVisibility() && !node.closest("[hidden],[inert]"))
          .map(node => ({ id: node.dataset.guideFlowerId!, label: node.getAttribute("aria-label") ?? node.dataset.guideFlowerId! }));
        setHarvestChoices(current => JSON.stringify(current) === JSON.stringify(choices) ? current : choices);
        setFacts(current => JSON.stringify(current) === JSON.stringify(fresh) ? current : fresh);
        const observed = readEvidence(currentScope, fresh, { view, section, pole }, stateRef.current.flowerId);
        if (navigationFrom.current && navigationFrom.current !== view && visible('[data-placard-stage], [data-warehouse-map], [data-culture-selection]', currentScope)) {
          observed.visits = [...(observed.visits ?? []), 'welcome']; navigationFrom.current = null;
        }
        setEvidence(current => JSON.stringify(current) === JSON.stringify(observed) ? current : observed);
        const next = observeFarmProgress(stateRef.current, observed);
        const finished = FARM_GUIDE_STEPS.find(item => next.completed.includes(item.id) && !stateRef.current.completed.includes(item.id));
        if (finished && stateRef.current.active) setFeedback(`${finished.title} : confirmé. ${finished.success}`);
        if (next !== stateRef.current) save(next);
        const nextStep = getFarmStep(next, observed);
        const selector = fresh.error ? "[role=alert]" : nextStep && next.flowerId && ["store", "cure"].includes(nextStep.id) ? `[data-conservation-lot="${next.flowerId}"]`
          : nextStep?.id === "trim" && next.flowerId ? `[data-guide-trim-flower-id="${next.flowerId}"]`
          : nextStep?.id === "jury" && next.flowerId ? `[data-culture-ranked-flower="${next.flowerId}"], [data-culture-training-flower="${next.flowerId}"], [data-culture-open-storage="${next.flowerId}"]`
          : nextStep ? farmStepAdvice(nextStep, fresh, currentChapter.id).target : "[data-mission-summary]";
        setTargetAvailable(!!visible(selector, currentScope));
      });
    };
    const observer = new MutationObserver(records => {
      if (records.every(record => record.target instanceof Element && record.target.closest("[data-farm-guide]"))) return;
      scan();
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-selected", "aria-pressed", "aria-busy", "open", "hidden", "disabled", "data-tutorial-observation", "data-tutorial-confirmed", "data-tutorial-ready", "data-guide-card-played", "data-guide-pack-opened", "data-guide-school-answered", "data-profile-step", "data-notebook-page", "data-culture-phase", "data-screen", "class", "data-guide-culture-started", "data-guide-turn-resolved", "data-guide-saved-zone-count", "data-guide-assigned-zone-count", "data-guide-harvest-confirmed", "data-guide-flower-id", "data-guide-lot-protected", "data-guide-curing-ready", "data-guide-jury-verdict", "data-guide-sale-confirmed", "data-guide-finances-ready", "data-guide-staff-ready", "data-guide-trim-state", "data-guide-trim-flower-id", "data-guide-trim-ready"] });
    window.addEventListener("resize", scan); document.addEventListener("toggle", scan, true); scan();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener("resize", scan); document.removeEventListener("toggle", scan, true); };
  }, [practice, libraryOpen, state.started, state.flowerId, state.selectedStepId, state.replayStepId, step?.id, view, pole, section, currentChapter.id, scope, save]);
  useEffect(() => () => { marked.current?.removeAttribute("data-farm-guide-target"); }, [step?.id, state.active]);
  useEffect(() => {
    if (!state.active || replaying || practice || libraryOpen || !targetAvailable) return;
    const currentScope = scope(), target = currentScope && visible(targetSelector, currentScope);
    if (!target) return;
    marked.current?.removeAttribute('data-farm-guide-target'); marked.current = target;
    target.setAttribute('data-farm-guide-target', 'true');
    return () => target.removeAttribute('data-farm-guide-target');
  }, [state.active, replaying, practice, libraryOpen, targetAvailable, targetSelector, view, scope]);
  const openLibrary = () => setLibraryOpen(true);
  const showTarget = () => {
    const currentScope = scope(), target = currentScope && visible(targetSelector, currentScope);
    if (!target) return;
    save({ ...stateRef.current, collapsed: true });
    marked.current?.removeAttribute("data-farm-guide-target"); marked.current = target; target.setAttribute("data-farm-guide-target", "true");
    requestAnimationFrame(() => {
      if (!target.hasAttribute("tabindex") && !target.matches("button,a,input,select,summary,textarea")) { target.tabIndex = -1; target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true }); }
      target.focus({ preventScroll: true }); target.scrollIntoView({ block: "center", behavior: "instant" });
    });
  };
  const close = () => {
    setLibraryOpen(false);
    save(pauseFarmProgress(stateRef.current));
    requestAnimationFrame(() => {
      const collection = host?.closest('dialog,[role=dialog][aria-modal=true]');
      const modalClose = collection ? Array.from(collection.querySelectorAll<HTMLElement>('button:not(:disabled),[tabindex]')).find(node => !node.closest('[data-farm-guide]') && node.checkVisibility()) : null;
      const loic = openedFromLoic.current ? visible('[data-npc-access="loic"]:not(:disabled)') : null;
      openedFromLoic.current = false;
      const target = modalClose ?? loic
        ?? visible("[data-arena-learning-trigger]") ?? visible("#placard-content h1, #placard-content [data-placard-back]") ?? visible('[data-village-integrated] button[aria-label="Ouvrir le menu du quartier"]') ?? visible("#placard-content");
      if (target) { if (!target.matches("button,a,[tabindex]")) target.tabIndex = -1; target.focus({ preventScroll: true }); }
    });
  };
  const goToGoal = () => {
    if ((here || facts.error) && targetAvailable) { showTarget(); return; }
    const goal = step ? farmStepChapter(step) : chapter;
    onNavigate({ ...goal, ...(state.flowerId && (step?.id === "trim" || ["storage", "jury", "sale"].includes(goal.id)) ? { flowerId: state.flowerId } : {}) });
  };
  const choose = (id: FarmStepId, review = false) => {
    const next = review ? replayFarmStep(stateRef.current, id) : selectFarmStep(stateRef.current, id);
    save(next); setFeedback(""); setLibraryOpen(false);
    const selected = FARM_GUIDE_STEPS.find(item => item.id === id)!;
    onNavigate(farmStepChapter(selected));
    requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  };
  if (!state.active) return <div ref={anchor} data-farm-guide-anchor />;
  const groupSteps = FARM_GUIDE_STEPS.filter(item => item.group === step?.group);
  const completedInGroup = groupSteps.filter(item => state.completed.includes(item.id)).length;
  const currentAdvice = getFarmGuideAdvice(currentChapter, facts);
  const content = <aside className={styles.guide} data-farm-guide data-guide-chapter={chapter.id} data-guide-step={step?.id ?? "complete"} data-expanded={!state.collapsed} aria-labelledby={titleId}>
    <div className={styles.heading} data-farm-guide-heading>
      <button ref={heading} type="button" id={titleId} className={styles.toggle} aria-expanded={!state.collapsed} aria-controls={bodyId} title={state.collapsed ? "Déplier le guide" : "Réduire le guide"} onClick={() => save({ ...stateRef.current, collapsed: !stateRef.current.collapsed })}>
        <Image src="/sylvain.png" alt="" width={32} height={32} /><span>{step?.title ?? "La ferme est entre tes mains"}</span><ChevronDown size={16} aria-hidden="true" />
      </button>
      {state.collapsed ? <button type="button" className={styles.close} data-tutorial-library-trigger aria-haspopup="dialog" aria-label="Choisir un chapitre" title="Chapitres" onClick={openLibrary}><BookOpen size={18} aria-hidden="true" /></button> : null}
      <button type="button" className={styles.close} data-farm-guide-close aria-label="Suspendre le tutoriel" title="Suspendre · retrouver dans Tutoriel" onClick={close}><X size={18} aria-hidden="true" /></button>
    </div>
    <div role="status" className="sr-only">{step ? `Objectif : ${step.title}. ${state.completed.length} objectifs accomplis.` : "Les objectifs du guide sont accomplis."}</div>
    <div id={bodyId} hidden={state.collapsed} className={styles.body}>
      <figure className={styles.scene} data-farm-story-scene>
        <Image src={`/placard/tutorial/sylvain-${portrait}-v1.webp`} alt="" width={512} height={512} sizes="76px" />
        <figcaption className={styles.dialogue}><span>Loïc{replaying ? " · Relecture" : ""}</span><p data-farm-story-line>{replaying ? "Retrouve les commandes, les coûts et le résultat de cette étape. Tes acquis sont conservés : observe sans répéter une opération." : advice.line}</p></figcaption>
      </figure>
      {feedback ? <p className={styles.feedback} role="status" data-tutorial-feedback><Check size={16} aria-hidden="true" />{feedback}</p> : null}
      {reconciling ? <p className={styles.status} role="status">Je retrouve ta partie enregistrée…</p> : null}
      {resumeError ? <p className={styles.waiting} role="status">La reprise n’a pas pu vérifier la partie. Tes acquis sont conservés. <button type="button" onClick={() => setResumeRequest(value => value + 1)}>Réessayer la vérification</button></p> : null}
      {step ? <>
        <KqProgressMeter label={step.group} value={completedInGroup} max={groupSteps.length} valueLabel={`${completedInGroup} / ${groupSteps.length} objectifs`} />
        <div className={styles.actions}><button type="button" className={styles.play} data-farm-guide-action onClick={goToGoal}>{facts.error && targetAvailable ? "Voir le message du jeu" : here && targetAvailable ? "Montrer dans le jeu" : `Aller à ${chapter.tab}`}</button>
          <button type="button" data-tutorial-library-trigger aria-haspopup="dialog" onClick={openLibrary}>Choisir un chapitre</button>
        </div>
        {stepState && ["waiting", "locked"].includes(stepState.status) ? <p className={styles.waiting} data-tutorial-waiting>{stepState.status === "locked" ? "Prérequis : " : "En attente : "}{stepState.reason} Tu peux poursuivre un autre chapitre.</p> : null}
        {!targetAvailable && here ? <p className={styles.status}>La cible n’est pas visible ici. {step.recovery} Utilise « Choisir un chapitre » pour changer d’activité.</p> : null}
        <p className={styles.status}>{replaying ? "Relecture : aucune action économique à refaire." : step.objectiveKind === "action" ? "Validation après confirmation du jeu." : "Découverte : ouvre et consulte l’information indiquée."}</p>
        {replaying ? <button type="button" onClick={() => save(resumeFarmProgress(stateRef.current))}>Reprendre mon parcours</button> : null}
      </> : <div className={styles.actions}><button type="button" className={styles.play} onClick={close}>Jouer librement</button><button type="button" data-tutorial-library-trigger aria-haspopup="dialog" onClick={openLibrary}>Chapitres</button></div>}
      {warning ? <p role="status">La progression du guide ne peut pas être enregistrée correctement. Tes actions de jeu restent enregistrées par le jeu.</p> : null}
    </div>
  </aside>;
  return <><div ref={anchor} className={styles.anchor} data-farm-guide-anchor data-expanded={!state.collapsed} style={{ "--farm-guide-top": `${headerOffset}px` } as CSSProperties}>{host ? createPortal(content, host) : content}</div>
    <KqTutorialLibrary open={libraryOpen} onClose={() => setLibraryOpen(false)} state={state} evidence={evidence} stepId={step?.id} replaying={replaying} currentChapter={currentChapter} currentAdvice={currentAdvice} harvestChoices={harvestChoices}
      onChoose={choose} onFollowHarvest={id => save(followFarmHarvest(stateRef.current, id))} onPractice={setPractice} onPause={close} />
    {practice ? <Practice lesson={practice} onClose={() => { setPractice(null); requestAnimationFrame(() => heading.current?.focus({ preventScroll: true })); }} onCompleted={() => setFeedback("Essai réussi. Ce résultat reste dans l’entraînement ; ta partie et ses objectifs sont conservés.")} /> : null}
  </>;
}
