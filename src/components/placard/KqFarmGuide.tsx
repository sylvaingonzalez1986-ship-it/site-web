"use client";

import Image from "next/image";
import { BookOpen, Check, ChevronDown, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { FARM_GUIDE_CHAPTERS, KQ_FARM_GUIDE_KEY, KQ_FARM_GUIDE_OPEN_EVENT, getFarmGuideAdvice, getFarmGuideChapter, type FarmGuideDestination, type FarmGuideFacts } from "@/lib/kanab-quest-farm-guide";
import { FARM_GUIDE_STEPS, emptyFarmProgress, farmStepAdvice, farmStepChapter, followFarmHarvest, getFarmStep, observeFarmProgress, parseFarmProgress, type FarmEvidence, type FarmProgress, type FarmVisitId } from "@/lib/kanab-quest-farm-progress";
import { FARM_STORY_SCENES } from "@/lib/kanab-quest-farm-story";
import { KqProgressMeter } from "./KqVisuals";
import styles from "./KqFarmGuide.module.css";

function visible(selector: string, scope: ParentNode = document): HTMLElement | null {
  return Array.from(scope.querySelectorAll<HTMLElement>(selector)).find(element => {
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
  if (destination.view === "hub" && visible("[data-placard-next-action]", scope)) visits.push("welcome");
  if (destination.view === "collection" && facts.album === "buddies") visits.push("buddies");
  if (destination.view === "collection" && facts.album === "botte") visits.push("cards");
  if (destination.view === "shop" && visible("[data-arena-tour-surface=shop]", scope) && !visible("[aria-busy=true]", scope)) visits.push("packs");
  if (visible("[data-guide-finances-ready=true]", scope)) visits.push("accounts");
  if (visible("[data-online-listings-heading]", scope)) visits.push("listings");
  if (destination.view === "treasury" && destination.pole === "bank" && visible("[id^=bank-panel-]", scope)) visits.push("bank");
  const businessVisits = { site: "site", brand: "studio", merch: "merch", marketing: "promotion" } as const;
  if (facts.business && facts.business in businessVisits) visits.push(businessVisits[facts.business as keyof typeof businessVisits]);
  if (facts.social === "story") visits.push("adventure");
  if (facts.social === "sponsors") visits.push("partners");
  if (destination.view === "missions" && visible("[data-mission-summary]", scope)) visits.push("missions");
  if (destination.view === "staff" && visible("[data-guide-staff-ready=true]", scope)) {
    if (visible("[data-staff-hire-form], [data-staff-candidates-empty=true]", scope)) visits.push("staff-candidate");
    if (visible("[data-staff-guide=planning][open]", scope)) visits.push("staff-planning");
    if (visible("[data-staff-guide=development][open]", scope)) visits.push("staff-development");
    if (visible("[data-staff-panel=payroll]", scope)) visits.push("staff-payroll");
  }
  const juryIds = Array.from(document.querySelectorAll<HTMLElement>("[data-guide-jury-verdict=true][data-guide-flower-id]"))
    .filter(node => node.checkVisibility() && !node.closest("[hidden],[inert]"))
    .map(node => node.dataset.guideFlowerId!);
  const trimNode = visible(followedFlowerId ? `[data-guide-trim-flower-id="${followedFlowerId}"][data-guide-trim-state]` : "[data-guide-trim-flower-id][data-guide-trim-state]", scope);
  const trimState = trimNode?.dataset.guideTrimState ?? (followedFlowerId && facts.trimState === "not-required" ? "not-required" : undefined);
  return {
    error: facts.error, visits,
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

export function KqFarmGuide({ ownerId, initialOpen = false, destination, onNavigate, onActiveChange }: {
  ownerId?: string; initialOpen?: boolean; destination: FarmGuideDestination;
  onNavigate: (destination: FarmGuideDestination & { flowerId?: string }) => void; onActiveChange: (active: boolean, started: boolean, completed: boolean) => void;
}) {
  const [initial] = useState(() => {
    try {
      const saved = parseFarmProgress(localStorage.getItem(`${KQ_FARM_GUIDE_KEY}:${ownerId ?? "guest"}`));
      return { state: { ...(saved ?? emptyFarmProgress()), ...(initialOpen ? { active: true, started: true } : {}) }, writable: saved !== null, warning: saved === null };
    } catch { return { state: { ...emptyFarmProgress(), active: initialOpen, started: initialOpen }, writable: true, warning: true }; }
  });
  const [state, setState] = useState<FarmProgress>(initial.state);
  const stateRef = useRef(state);
  const [warning, setWarning] = useState(initial.warning);
  const [facts, setFacts] = useState<FarmGuideFacts>({});
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [targetAvailable, setTargetAvailable] = useState(false);
  const [harvestChoices, setHarvestChoices] = useState<{ id: string; label: string }[]>([]);
  const [headerOffset, setHeaderOffset] = useState(8);
  const anchor = useRef<HTMLDivElement>(null), heading = useRef<HTMLButtonElement>(null), marked = useRef<HTMLElement | null>(null);
  const titleId = useId(), bodyId = useId();
  const { view, section, pole } = destination;
  const step = getFarmStep(state), currentChapter = getFarmGuideChapter(destination);
  const completed = step === undefined;
  const chapter = step ? farmStepChapter(step) : FARM_GUIDE_CHAPTERS[FARM_GUIDE_CHAPTERS.length - 1];
  const advice = step ? farmStepAdvice(step, facts, currentChapter.id) : { line: "La ferme est entre tes mains. Tu peux fermer ce guide et continuer ta partie. Les aides des écrans restent disponibles.", target: "[data-mission-summary]" };
  const scene = FARM_STORY_SCENES[facts.cultureDead && chapter.id === "culture" ? "warehouse" : chapter.id];
  const here = currentChapter.id === chapter.id && (step?.id !== "trim" || facts.room === "processing");
  const targetFor = (progress: FarmProgress, fresh: FarmGuideFacts) => {
    const objective = getFarmStep(progress);
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
    if (!initial.writable) return;
    try { localStorage.setItem(`${KQ_FARM_GUIDE_KEY}:${ownerId ?? "guest"}`, JSON.stringify(next)); }
    catch { setWarning(true); }
  }, [initial.writable, ownerId]);
  const scope = useCallback(() => (destination.view === "collection" ? document.querySelector("[data-farm-guide-host]")?.closest("dialog") : null) ?? anchor.current?.closest("[data-placard-view]"), [destination.view]);
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
    const open = () => { save({ ...stateRef.current, active: true, started: true, collapsed: false }); requestAnimationFrame(() => { heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView({ block: "nearest" }); }); };
    window.addEventListener(KQ_FARM_GUIDE_OPEN_EVENT, open);
    return () => window.removeEventListener(KQ_FARM_GUIDE_OPEN_EVENT, open);
  }, [save]);
  useEffect(() => {
    if (!initialOpen || !initial.writable) return;
    const frame = requestAnimationFrame(() => save(stateRef.current));
    return () => cancelAnimationFrame(frame);
  }, [initialOpen, initial.writable, save]);
  useEffect(() => {
    let frame = 0;
    const scan = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const collectionHost = view === "collection" ? document.querySelector<HTMLElement>("[data-farm-guide-host]") : null;
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
        const next = observeFarmProgress(stateRef.current, readEvidence(currentScope, fresh, { view, section, pole }, stateRef.current.flowerId));
        if (next !== stateRef.current) save(next);
        const nextStep = getFarmStep(next);
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
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-selected", "aria-pressed", "aria-busy", "open", "hidden", "disabled", "data-culture-phase", "data-screen", "class", "data-guide-culture-started", "data-guide-turn-resolved", "data-guide-saved-zone-count", "data-guide-assigned-zone-count", "data-guide-harvest-confirmed", "data-guide-flower-id", "data-guide-lot-protected", "data-guide-curing-ready", "data-guide-jury-verdict", "data-guide-sale-confirmed", "data-guide-finances-ready", "data-guide-staff-ready", "data-guide-trim-state", "data-guide-trim-flower-id", "data-guide-trim-ready"] });
    window.addEventListener("resize", scan); document.addEventListener("toggle", scan, true); scan();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener("resize", scan); document.removeEventListener("toggle", scan, true); };
  }, [state.started, state.flowerId, view, pole, section, currentChapter.id, scope, save]);
  useEffect(() => () => { marked.current?.removeAttribute("data-farm-guide-target"); }, [step?.id, state.active]);
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
    save({ ...stateRef.current, active: false, collapsed: true });
    requestAnimationFrame(() => {
      const collection = host?.closest("dialog");
      const target = (collection ? visible("[aria-label='Fermer la collection']", collection) : null)
        ?? visible("[data-arena-learning-trigger]") ?? visible("#placard-content h1, #placard-content [data-placard-back]") ?? visible("#placard-content");
      if (target) { if (!target.matches("button,a,[tabindex]")) target.tabIndex = -1; target.focus({ preventScroll: true }); }
    });
  };
  const goToGoal = () => {
    if ((here || facts.error) && targetAvailable) { showTarget(); return; }
    const goal = step ? farmStepChapter(step) : chapter;
    onNavigate({ ...goal, ...(state.flowerId && (step?.id === "trim" || ["storage", "jury", "sale"].includes(goal.id)) ? { flowerId: state.flowerId } : {}) });
  };
  if (!state.active) return <div ref={anchor} data-farm-guide-anchor />;
  const groupSteps = FARM_GUIDE_STEPS.filter(item => item.group === step?.group);
  const completedInGroup = groupSteps.filter(item => state.completed.includes(item.id)).length;
  const currentAdvice = getFarmGuideAdvice(currentChapter, facts);
  const content = <aside className={styles.guide} data-farm-guide data-guide-chapter={chapter.id} data-guide-step={step?.id ?? "complete"} data-expanded={!state.collapsed} aria-labelledby={titleId}>
    <div className={styles.heading}>
      <button ref={heading} type="button" id={titleId} className={styles.toggle} aria-expanded={!state.collapsed} aria-controls={bodyId} title={state.collapsed ? "Déplier le guide" : "Réduire le guide"} onClick={() => save({ ...stateRef.current, collapsed: !stateRef.current.collapsed })}>
        <Image src="/sylvain.png" alt="" width={32} height={32} /><span>{step?.title ?? "La ferme est entre tes mains"}</span><ChevronDown size={16} aria-hidden="true" />
      </button>
      <button type="button" className={styles.close} data-farm-guide-close aria-label="Fermer le guide" title={completed ? "Fermer le guide" : "Fermer · retrouver dans Apprendre à jouer"} onClick={close}><X size={18} aria-hidden="true" /></button>
    </div>
    <div role="status" className="sr-only">{step ? `Objectif : ${step.title}. ${state.completed.length} objectifs accomplis.` : "Les objectifs du guide sont accomplis."}</div>
    <div id={bodyId} hidden={state.collapsed} className={styles.body}>
      <figure className={styles.scene} data-farm-story-scene>
        <Image key={scene.image} src={scene.image} alt={scene.alt} width={1536} height={1024} sizes="(max-width: 600px) 104px, 220px" />
        <figcaption className={styles.dialogue}><span>{scene.speaker}</span><p data-farm-story-line>{advice.line}</p></figcaption>
      </figure>
      {step ? <>
        <KqProgressMeter label={step.group} value={completedInGroup} max={groupSteps.length} valueLabel={`${completedInGroup} / ${groupSteps.length} objectifs`} />
        <div className={styles.actions}><button type="button" className={styles.play} data-farm-guide-action onClick={goToGoal}>{facts.error && targetAvailable ? "Voir le message du jeu" : here && targetAvailable ? "Montrer dans le jeu" : `Aller à ${chapter.tab}`}</button>
          {step.id === "cure" ? <button type="button" onClick={() => onNavigate(FARM_GUIDE_CHAPTERS.find(item => item.id === "accounts")!)}>Voir les comptes en attendant</button> : null}
        </div>
        <p className={styles.status}>L’objectif avance avec tes actions dans le jeu.</p>
      </> : <div className={styles.actions}><button type="button" className={styles.play} onClick={close}>Jouer librement</button></div>}
      <details key={step?.id} className={styles.notebook}><summary><BookOpen size={16} aria-hidden="true" />Le carnet de grand-père</summary>
        <p><strong>{currentChapter.tab}</strong> · {currentAdvice.instruction}</p><p>{currentChapter.story}</p>
        <p>Tu peux explorer librement pendant une attente. Une visite ne valide pas une culture ou une vente. Aucun achat ni paiement n’est effectué par le guide.</p>
        {harvestChoices.length > 0 && (harvestChoices.length > 1 || harvestChoices[0].id !== state.flowerId) ? <label className={styles.harvestChoice}>Récolte à accompagner<select value={state.flowerId ?? ""} onChange={event => save(followFarmHarvest(stateRef.current, event.target.value))}>{!harvestChoices.some(item => item.id === state.flowerId) ? <option value={state.flowerId ?? ""} disabled>Choisir un lot disponible</option> : null}{harvestChoices.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select><small>Changer de lot reprend son rangement, son trim, son affinage, son jury et sa vente dans le guide.</small></label> : null}
        <ol>{FARM_GUIDE_CHAPTERS.map(item => <li key={item.id}><button type="button" aria-current={item.id === currentChapter.id ? "page" : undefined} onClick={() => onNavigate(item)}><span>{item.tab}</span></button></li>)}</ol>
        <details><summary>Mes objectifs · {state.completed.length}/{FARM_GUIDE_STEPS.length}</summary><ul className={styles.checklist}>{FARM_GUIDE_STEPS.map(item => <li key={item.id}>{state.completed.includes(item.id) ? <Check size={15} aria-label="Accompli" /> : <span aria-hidden="true">○</span>}<span>{item.title}{item.id === step?.id ? " · En cours" : ""}</span></li>)}</ul></details>
        <p>{completed ? "Le tutoriel est terminé. Les aides des écrans restent disponibles." : "Réduis le guide pour garder seulement l’objectif, ou ferme-le avec ×. Retrouve-le dans Apprendre à jouer."} Ton choix et ta progression sont conservés dans ce navigateur pour ce compte.</p>
      </details>
      {warning ? <p role="status">La progression du guide ne peut pas être enregistrée correctement. Tes actions de jeu restent enregistrées par le jeu.</p> : null}
    </div>
  </aside>;
  return <div ref={anchor} className={styles.anchor} data-farm-guide-anchor data-expanded={!state.collapsed} style={{ "--farm-guide-top": `${headerOffset}px` } as CSSProperties}>{host ? createPortal(content, host) : content}</div>;
}
