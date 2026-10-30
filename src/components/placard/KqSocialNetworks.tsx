"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowRight, BatteryCharging, BookOpen, Brain, Check, Clock3, Handshake, Instagram, RefreshCw, ShieldAlert, Sparkles, Users } from "lucide-react";
import { AppDialog } from "@/components/ui/AppDialog";
import { createClientRequestKey } from "@/lib/client-request-key";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { getKqSocialChoicePreview, getKqSocialFame, getKqSponsorOffers, getKqSponsorPostPreview, isKqSocialSnapshot, KQ_SOCIAL_SCENARIOS, KQ_SOCIAL_SPONSOR_REGISTRY, KQ_SOCIAL_TAG_LABELS, type KqSocialChoice, type KqSocialChoicePreview, type KqSocialCommand, type KqSocialHistoryEntry, type KqSocialPlatform, type KqSocialSnapshot, type KqSocialSponsorOffer, type KqSocialTag } from "@/lib/kanab-quest-social";
import { getKqSocialAdventure } from "@/lib/kanab-quest-social-adventure";
import { KqBarChart, KqProgressMeter } from "./KqVisuals";
import { getKqSocialFeed } from "@/lib/kanab-quest-social-feed";
import { KqSocialDraft, KqSocialFeed, KqSocialPublishedPost } from "./KqSocialFeed";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import { useKqSocialPlayer } from "./useKqSocialPlayer";
import styles from "./KqSocialNetworks.module.css";

type Pending = { command: KqSocialCommand; title: string; description: string; facts: string[]; risk: string; attempted: boolean };
const number = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${number(Math.abs(n))}`;
const networkName = (p: KqSocialPlatform) => p === "instagram" ? "Instagram" : "X";
const date = (v: string) => new Date(v).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const intentions = { reach: "Se faire voir", craft: "Soigner le fond", care: "Garder le lien" } as const;
const formatDescriptions: Record<KqSocialTag, string> = { visual: "Une mise en scène soignée qui montre le produit et annonce le partenariat.", craft: "Un essai à l’atelier, avec ses qualités, ses limites et la mention du partenariat.", dialogue: "Des réponses aux questions du public, en annonçant clairement le partenariat.", community: "Un rendez-vous avec ta communauté où le soutien du sponsor est annoncé." };
function remaining(until: string | null, now: number) {
  const seconds = until ? Math.max(0, Math.ceil((Date.parse(until) - now) / 1000)) : 0;
  return !seconds ? "" : seconds >= 3600 ? `${Math.floor(seconds / 3600)} h ${Math.ceil(seconds % 3600 / 60)} min` : `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")} s`;
}
function Changes({ entry }: { entry: KqSocialHistoryEntry }) {
  const items = [{ label: "Abonnés", value: entry.followersDelta, suffix: "" }, { label: "Confiance", value: entry.trustDelta, suffix: " pts" }, { label: "Pression des haters", value: entry.hatersDelta, suffix: " pts" }, { label: "Alertes", value: entry.moderationDelta, suffix: "" }, { label: "Mental", value: entry.energyDelta, suffix: " pts" }].filter((i): i is { label: string; value: number; suffix: string } => typeof i.value === "number" && i.value !== 0);
  return <dl className={styles.changes}>{items.map(i => <div key={i.label}><dt>{i.label}</dt><dd>{signed(i.value)}{i.suffix}</dd></div>)}{entry.rewardCents ? <div><dt>Honoraires versés</dt><dd>+{formatKqCash(entry.rewardCents)}</dd></div> : null}</dl>;
}
function Forecast({ preview }: { preview: KqSocialChoicePreview }) {
  return <details className={styles.forecast}><summary>Comprendre les enjeux</summary><p>Audience estimée : {signed(preview.followersMin)} à {signed(preview.followersMax)} abonnés. Le résultat sera connu après ton choix.</p>{preview.reasons.length ? <ul>{preview.reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul> : null}</details>;
}
function SponsorPricing({ pricing, signedContract = false }: { pricing: NonNullable<KqSocialSponsorOffer["pricing"]>; signedContract?: boolean }) {
  return <div className={styles.sponsorPricing} data-social-pricing={signedContract ? "signed" : "current"}>
    <p>{signedContract ? "À la signature" : "Sur ce réseau"} : <strong>{number(pricing.followers)} abonnés</strong> · pression des haters <strong>{pricing.haters} / 100</strong>.</p>
    <details className={styles.forecast}><summary>{signedContract ? "Voir le calcul convenu" : "Comment cette prime est calculée"}</summary>
      <dl className={styles.pricingLines}>
        <div><dt>Base de la proposition</dt><dd>{formatKqCash(pricing.baseCents)}</dd></div>
        <div><dt>Bonus d’audience</dt><dd>+{formatKqCash(pricing.audienceBonusCents)}</dd></div>
        <div><dt>Réduction liée aux haters</dt><dd>{pricing.hatersPenaltyCents > 0 ? "−" : ""}{formatKqCash(pricing.hatersPenaltyCents)}</dd></div>
        {pricing.roundingCents > 0 ? <div><dt>Arrondi aux 5 € inférieurs</dt><dd>−{formatKqCash(pricing.roundingCents)}</dd></div> : null}
      </dl><p>{signedContract ? "Ce calcul est celui de la signature. Les changements de tes abonnés, de la confiance ou des haters ne modifient plus les honoraires convenus." : "Plus d’abonnés augmente la prime, jusqu’au plafond de la marque. La pression des haters la réduit. La confiance conditionne l’accès à la proposition."}</p>
    </details>
  </div>;
}
type Props = { busy?: boolean; initialTutorialResultId?: string; onTutorialResultRead?: (entryId: string) => Promise<void>; onTutorialPartnershipRead?: (sponsorId: string) => Promise<void> };
export function KqSocialNetworks({ busy: parentBusy = false, initialTutorialResultId, onTutorialResultRead, onTutorialPartnershipRead }: Props) {
  const api = useKqTutorialApi(), id = useId(), timeKind = api.isTutorial ? "fictives" : "réelles";
  const player = useKqSocialPlayer();
  const [snapshot, setSnapshot] = useState<KqSocialSnapshot | null>(null);
  const [platform, setPlatform] = useState<KqSocialPlatform>("instagram");
  const [subjectSelection, setSubjectSelection] = useState<{ sceneId: string; subjectId: string } | null>(null);
  const [view, setView] = useState<"story" | "sponsors">("story");
  const [loading, setLoading] = useState(true), [refreshing, setRefreshing] = useState(false), [mutating, setMutating] = useState(false);
  const [loadError, setLoadError] = useState(""), [actionError, setActionError] = useState(""), [notice, setNotice] = useState("");
  const [pending, setPending] = useState<Pending | null>(null), [confirmationOpen, setConfirmationOpen] = useState(false);
  const [spotlightId, setSpotlightId] = useState<string | null>(api.isTutorial ? initialTutorialResultId ?? null : null), [now, setNow] = useState(0);
  const [reading, setReading] = useState(false), [publicationNow, setPublicationNow] = useState(0);
  const resultRef = useRef<HTMLElement>(null), sceneRef = useRef<HTMLElement>(null), sponsorsRef = useRef<HTMLButtonElement>(null);
  const clock = useRef<{ server: number; publication: number; received: number } | null>(null), requestNumber = useRef(0);
  const refreshedBoundaries = useRef(new Set<string>()), inFlight = useRef(false), mounted = useRef(true);
  const acceptSnapshot = useCallback((data: KqSocialSnapshot) => {
    clock.current = { server: Date.parse(data.serverNow), publication: Date.parse(data.publicationNow ?? data.serverNow), received: performance.now() };
    setNow(clock.current.server); setPublicationNow(clock.current.publication);
    setSnapshot(current => current && current.revision > data.revision ? current : data);
  }, []);
  const load = useCallback(async () => {
    if (inFlight.current) return;
    const sequence = ++requestNumber.current; setRefreshing(true);
    try {
      const response = await api.request("/api/arena/placard/social", { cache: "no-store" });
      const data: unknown = await response.json();
      if (!response.ok) throw new Error(data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : "Ton fil ne répond pas. Réessaie.");
      if (!isKqSocialSnapshot(data)) throw new Error(data && typeof data === "object" && "version" in data && data.version === 1 ? "La nouvelle aventure attend la mise à jour du jeu. Tes abonnés sont conservés. Réessaie dans un moment." : "Les données de tes réseaux sont incomplètes. Réessaie.");
      if (mounted.current && sequence === requestNumber.current) { acceptSnapshot(data); setLoadError(""); }
    } catch (error) { if (mounted.current && sequence === requestNumber.current) setLoadError(error instanceof Error ? error.message : "Impossible de charger tes réseaux."); }
    finally { if (mounted.current && sequence === requestNumber.current) { setLoading(false); setRefreshing(false); } }
  }, [api, acceptSnapshot]);
  useEffect(() => {
    mounted.current = true; void load();
    const tick = window.setInterval(() => {
      if (!document.hidden && clock.current) {
        const elapsed = Math.max(0, performance.now() - clock.current.received);
        setPublicationNow(clock.current.publication + elapsed);
        if (!api.isTutorial) setNow(clock.current.server + elapsed);
      }
    }, 1000);
    const refresh = api.isTutorial ? null : window.setInterval(() => { if (!document.hidden) void load(); }, 300000);
    const resume = () => { if (!document.hidden) void load(); }; document.addEventListener("visibilitychange", resume);
    const unsubscribe = api.subscribe(["kq:social-updated"], () => void load());
    return () => { mounted.current = false; if (tick !== null) window.clearInterval(tick); if (refresh !== null) window.clearInterval(refresh); document.removeEventListener("visibilitychange", resume); unsubscribe(); };
  }, [api, load]);
  useEffect(() => {
    if (!snapshot || refreshing || inFlight.current) return;
    const boundaries = [
      ...[snapshot.platforms.instagram.nextPostAt, snapshot.platforms.x.nextPostAt].map(at => ({ at, now: publicationNow, start: snapshot.publicationNow ?? snapshot.serverNow, kind: "publication" })),
      ...(!api.isTutorial ? [snapshot.recoverReadyAt, snapshot.energy < 100 ? new Date(Date.parse(snapshot.energyUpdatedAt) + 300000).toISOString() : null].map(at => ({ at, now, start: snapshot.serverNow, kind: "mental" })) : []),
    ];
    const crossed = boundaries.filter(boundary => boundary.at && Date.parse(boundary.at) <= boundary.now && Date.parse(boundary.at) > Date.parse(boundary.start) && !refreshedBoundaries.current.has(`${boundary.kind}:${boundary.at}`));
    if (crossed.length) { crossed.forEach(boundary => refreshedBoundaries.current.add(`${boundary.kind}:${boundary.at}`)); void load(); }
  }, [snapshot, now, publicationNow, refreshing, load, api.isTutorial]);
  useEffect(() => { if (spotlightId) resultRef.current?.focus({ preventScroll: false }); }, [spotlightId]);
  const closeConfirmation = () => { setConfirmationOpen(false); if (!pending?.attempted) setPending(null); };
  async function readTutorial(callback: () => Promise<void>, after?: () => void) {
    if (reading) return;
    setReading(true); setActionError('');
    try { await callback(); after?.(); }
    catch (error) { setActionError(error instanceof Error ? error.message : 'La lecture n’a pas été enregistrée. Réessaie.'); }
    finally { setReading(false); }
  }
  function continueResult() {
    const close = () => { setSpotlightId(null); requestAnimationFrame(() => { if (view === 'sponsors') sponsorsRef.current?.focus(); else sceneRef.current?.focus(); }); };
    if (api.isTutorial && onTutorialResultRead && spotlight?.narrativeVersion === 3 && spotlight.subject && (spotlight.action ?? "publish") === "publish") void readTutorial(() => onTutorialResultRead(spotlight.id), close);
    else close();
  }
  async function execute(action: Pending) {
    if (inFlight.current || parentBusy) return;
    inFlight.current = true; requestNumber.current++; setMutating(true); setRefreshing(false); setActionError(""); setNotice(""); setPending({ ...action, attempted: true });
    let receivedSnapshot = false;
    try {
      const response = await api.request("/api/arena/placard/social", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action.command) });
      const data: unknown = await response.json();
      if (!response.ok) {
        if (mounted.current && response.status >= 400 && response.status < 500) { setPending(null); setConfirmationOpen(false); }
        throw new Error(data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : "Le résultat n’a pas pu être confirmé. Vérifie la même action.");
      }
      if (!isKqSocialSnapshot(data)) throw new Error("Le résultat n’a pas pu être confirmé. Vérifie la même action.");
      receivedSnapshot = true;
      if (mounted.current) {
        acceptSnapshot(data); setLoadError(""); setPending(null); setConfirmationOpen(false);
        const result = data.history.find(entry => entry.id === action.command.requestKey);
        if (result) setSpotlightId(result.id); else setNotice("Ton action est enregistrée. Tes réseaux et ton journal sont à jour.");
      }
      api.notify("kq:commerce-updated"); api.notify("kq:social-updated"); if (action.command.action === "sponsor-claim") api.notify("kq:treasury-updated");
    } catch (error) { if (mounted.current) setActionError(error instanceof Error ? error.message : "Ton choix n’a pas pu être confirmé."); }
    finally { inFlight.current = false; if (mounted.current) { setMutating(false); if (!receivedSnapshot) void load(); } }
  }
  if (!snapshot) return <section className={styles.social} aria-label="Réseaux sociaux" aria-busy={loading} data-social-networks><header className={styles.header}><div><h3>Dans le fil.</h3></div></header>{loading ? <p role="status">Ton fil se prépare…</p> : <div className={styles.error} role="alert"><p>{loadError}</p><button type="button" className={styles.secondary} disabled={refreshing} onClick={() => void load()}><RefreshCw size={16} aria-hidden="true" />{refreshing ? "Chargement…" : "Réessayer"}</button></div>}</section>;
  const availableAdventure = getKqSocialAdventure(snapshot, platform);
  const adventure = subjectSelection?.sceneId === availableAdventure.scene.id && availableAdventure.subjects.some(subject => subject.id === subjectSelection.subjectId)
    ? getKqSocialAdventure(snapshot, platform, subjectSelection.subjectId) : availableAdventure;
  const state = snapshot.platforms[platform], scenario = adventure.scene, fame = getKqSocialFame(snapshot.socialFollowers);
  const feed = getKqSocialFeed(scenario, state.memory, player);
  const postWait = remaining(state.nextPostAt, publicationNow), recoverWait = remaining(snapshot.recoverReadyAt, now);
  const disabled = parentBusy || mutating || refreshing || reading || !!pending;
  const offers = getKqSponsorOffers(snapshot), availableOffers = offers.filter(o => o.status === "available").length;
  const active = snapshot.sponsors.active, sponsor = active ? KQ_SOCIAL_SPONSOR_REGISTRY.find(s => s.id === active.sponsorId) : undefined;
  const partnershipReady = !!(active && sponsor && sponsor.requiredTags.every(tag => active.progressTags.includes(tag)));
  const sponsorWait = active ? remaining(snapshot.platforms[active.platform].nextPostAt, publicationNow) : "";
  const spotlight = snapshot.history.find(entry => entry.id === spotlightId);
  const followup = scenario.followups?.some(item => state.memory[item.fromScenarioId] === item.fromChoiceId);
  const baseCommand = () => ({ modelVersion: 2 as const, requestKey: createClientRequestKey(), expectedRevision: snapshot.revision });
  const openSponsors = () => { setView("sponsors"); sponsorsRef.current?.focus(); };
  function start(command: KqSocialCommand, title: string, description = "", facts: string[] = [], risk = "", confirm = false) {
    if (disabled || inFlight.current) return;
    const action: Pending = { command, title, description, facts, risk, attempted: false }; setActionError(""); setNotice("");
    if (confirm) { setPending(action); setConfirmationOpen(true); } else void execute(action);
  }
  function choose(choice: KqSocialChoice) {
    if (((choice.action ?? "publish") === "publish" && postWait) || !snapshot || !adventure.subject) return;
    if (snapshot.energy + getKqSocialChoicePreview(snapshot, platform, choice).energy < 0) return;
    start({ ...baseCommand(), action: "choose", platform, scenarioId: scenario.id, choiceId: choice.id,
      narrativeVersion: 3, subjectId: adventure.subject.id, contextKey: adventure.contextKey }, choice.label);
  }
  function acceptOffer(offer: KqSocialSponsorOffer) {
    if (!offer.eligible || offer.rewardCents === null) return;
    const def = offer.sponsor;
    start({ ...baseCommand(), action: "sponsor-accept", sponsorId: def.id, expectedRewardCents: offer.rewardCents }, `Travailler avec ${def.name}`, def.brief,
      [`${formatKqCash(offer.rewardCents)} à réclamer après les deux contenus. Ce montant sera fixé à la signature, même si tes statistiques changent ensuite.`, `${networkName(def.platform)} : ${def.requiredTags.map(tag => def.deliverables?.[tag]?.title ?? KQ_SOCIAL_TAG_LABELS[tag]).join(" + ")}.`, `À livrer dans tes ${def.publicationBudget} prochaines publications sur ce réseau. Les publications ordinaires comptent aussi.`, "Chaque contenu porte la mention de partenariat et utilise ton post du jour sur ce réseau. Aucun délai hors connexion.", "Si les deux contenus ne sont pas livrés dans les quatre publications, le partenariat se clôt sans honoraires et sans dette."], def.tradeoff, true);
  }
  function sponsorPost(tag: KqSocialTag) {
    if (!snapshot || !active || sponsorWait || partnershipReady || active.progressTags.includes(tag)) return;
    if (snapshot.energy + getKqSponsorPostPreview(snapshot, tag).energy < 0) return;
    start({ ...baseCommand(), action: "sponsor-post", tag }, KQ_SOCIAL_TAG_LABELS[tag]);
  }
  const contractCard = active && sponsor ? <section className={`${styles.railCard} ${styles.contract}`} aria-label="Partenariat en cours" data-social-active-summary><span className={styles.eyebrow}><Handshake size={15} aria-hidden="true" />Ton engagement</span><h4>{sponsor.name}</h4>{sponsor.sector ? <small>{sponsor.sector}</small> : null}<KqProgressMeter label="Contenus livrés" value={active.progressTags.length} max={sponsor.requiredTags.length} valueLabel={`${active.progressTags.length} / ${sponsor.requiredTags.length}`} tone="teal" /><div className={styles.contractValue}><strong data-social-signed-amount={active.rewardCents}>{formatKqCash(active.rewardCents)}</strong><small>Montant fixé à la signature</small><small>{partnershipReady ? "Honoraires à réclamer" : "Honoraires après livraison"}</small></div><span className={styles.contractStatus}>{partnershipReady ? "Tes deux contenus sont validés." : `${active.publicationsLeft} publications restantes sur ${networkName(active.platform)} pour remplir l’engagement.`}</span><button type="button" className={styles.primary} onClick={openSponsors}>{partnershipReady ? "Réclamer mes honoraires" : "Voir mon engagement"}<ArrowRight size={15} aria-hidden="true" /></button></section> : null;
  return <section className={styles.social} aria-label="Réseaux sociaux" data-social-networks>
    <header className={styles.header}><div><h3>Dans le fil.</h3></div><span className={styles.fame}><Sparkles size={15} aria-hidden="true" />{fame.label}</span></header>
    <div className={styles.overview}><div className={styles.audience}><div className={styles.metric}><strong>{number(snapshot.socialFollowers)}</strong><span>abonnés sur tes réseaux</span></div><small>+{number(snapshot.additionalVisitsPerDay)} visites potentielles / jour{snapshot.siteActive ? " vers ta boutique" : " · site suspendu"}</small></div><div className={styles.energy}><KqProgressMeter label="Énergie mentale" value={snapshot.energy} max={100} valueLabel={`${snapshot.energy} / 100`} tone={snapshot.energy < 25 ? "red" : "teal"} /><div className={styles.energyActions}><button type="button" className={styles.textButton} disabled={disabled || !!recoverWait || snapshot.energy >= 100} onClick={() => start({ ...baseCommand(), action: "recover" }, "Faire une pause")} data-social-recover><BatteryCharging size={15} aria-hidden="true" />{snapshot.energy >= 100 ? "Mental au maximum" : `Pause · +${Math.min(30, 100 - snapshot.energy)} pts`}</button><small>{recoverWait ? `Pause dans ${recoverWait}` : `+1 pt / 5 min ${timeKind}`}</small></div></div></div>
    {loadError ? <div className={styles.error} role="alert"><p>{loadError} Les dernières données confirmées restent affichées.</p><button type="button" className={styles.secondary} disabled={mutating || refreshing} onClick={() => void load()}>{refreshing ? "Actualisation…" : "Actualiser"}</button></div> : null}
    {snapshot.culture?.source === "unknown" ? <div className={styles.notice} role="status"><p>Le suivi de ta culture ne s’est pas chargé. Les sujets de métier restent disponibles ; les nouvelles de tes plantes reviendront après actualisation.</p><button type="button" className={styles.secondary} disabled={mutating || refreshing} onClick={() => void load()}>Actualiser la culture</button></div> : null}
    {notice ? <p className={styles.notice} role="status"><Check size={17} aria-hidden="true" />{notice}</p> : null}
    {actionError && !confirmationOpen ? <p className={styles.error} role="alert">{actionError}</p> : null}
    {pending && !confirmationOpen ? <div className={styles.notice}><p>{mutating ? "Ton choix est en cours d’enregistrement." : "Le résultat reste à vérifier. Reprendre cette action ne la compte pas une seconde fois."}</p><button type="button" className={styles.secondary} disabled={mutating || parentBusy} onClick={() => void execute(pending)} data-social-retry>{mutating ? "Enregistrement…" : "Vérifier le résultat"}</button></div> : null}
    <div className={styles.modes} role="group" aria-label="Explorer les réseaux"><button type="button" aria-pressed={view === "story"} onClick={() => setView("story")} data-social-view="story"><BookOpen size={16} aria-hidden="true" />L’aventure</button><button type="button" ref={sponsorsRef} aria-pressed={view === "sponsors"} onClick={() => setView("sponsors")} data-social-view="sponsors"><Handshake size={16} aria-hidden="true" />Partenariats{availableOffers || active ? <span className={styles.modeCount}>{availableOffers + (active ? 1 : 0)}</span> : null}</button></div>
    {spotlight ? <section ref={resultRef} tabIndex={-1} className={styles.result} aria-label="Conséquences de ton choix" data-social-result data-social-result-id={spotlight.id} data-social-result-platform={spotlight.platform ?? undefined}><div className={styles.resultHeader}><Check size={18} aria-hidden="true" />Ce que ton choix a changé</div><p>{spotlight.outcome}</p><Changes entry={spotlight} /><KqSocialPublishedPost entry={spotlight} player={player} />{spotlight.reasons?.length ? <ul className={styles.reasons}>{spotlight.reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul> : null}<div className={styles.resultActions}><small>Résultat enregistré · {date(spotlight.createdAt)}</small><button type="button" className={styles.secondary} disabled={reading || parentBusy} data-social-result-continue onClick={continueResult}>Continuer<ArrowRight size={15} aria-hidden="true" /></button></div></section> : null}
    {view === "story" ? <>
      <div className={styles.networkTabs} role="group" aria-label="Choisir ton réseau">{(["instagram", "x"] as const).map(network => <button type="button" key={network} aria-pressed={platform === network} onClick={() => setPlatform(network)} data-platform={network}><span className={styles.networkIcon} aria-hidden="true">{network === "instagram" ? <Instagram size={23} /> : "𝕏"}</span><span className={styles.networkData}><strong>{networkName(network)}</strong><small>{number(snapshot.platforms[network].followers)} abonnés</small></span>{platform === network ? <Check size={16} aria-hidden="true" /> : null}</button>)}</div>
      <div className={styles.layout}><div className={styles.main}><section ref={sceneRef} tabIndex={-1} className={styles.scene} data-network={platform} aria-labelledby={`${id}-story`} data-social-scene={scenario.id}>
        <header className={styles.sceneHeading}><div className={styles.speaker}><span>{scenario.arc}{followup ? " · la suite de tes choix" : ""}</span><h4 id={`${id}-story`}>{scenario.title}</h4></div><div className={styles.episode} aria-label={`Épisode ${scenario.episode} sur 3`}>{[1, 2, 3].map(e => <span key={e} data-current={e === scenario.episode} data-done={e < scenario.episode} aria-hidden="true">{e < scenario.episode ? <Check size={12} /> : e}</span>)}</div></header>
        {adventure.subjects.length > 1 ? <fieldset className={styles.subjects} disabled={disabled} data-social-subjects><legend>Quelle culture veux-tu raconter ?</legend>{adventure.subjects.map(subject => <button key={subject.id} data-social-subject={subject.id} type="button" className={styles.secondary} aria-pressed={adventure.subject?.id === subject.id} onClick={() => setSubjectSelection({ sceneId: scenario.id, subjectId: subject.id })}>{subject.variety}{subject.zone ? ` · ${subject.zone}` : ""}{subject.stage ? ` · ${subject.stage}` : ""}{subject.harvestedAt ? ` · Récolte du ${date(subject.harvestedAt)}` : ""}</button>)}</fieldset> : null}
        <div className={styles.sceneContext} data-social-context><h5>La situation</h5>{adventure.subject?.variety ? <strong>{adventure.subject.variety}{adventure.subject.zone ? ` · ${adventure.subject.zone}` : ""}</strong> : null}<div className={styles.prose}>{scenario.body.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}</div><span className={styles.audienceHint}><Users size={14} aria-hidden="true" />{scenario.audience}</span></div>
        <p className={styles.cooldown} role="status" data-social-cooldown={postWait || undefined}><Clock3 size={16} aria-hidden="true" />{postWait ? `Post du jour déjà publié sur ${networkName(platform)}. Prochain post à minuit, heure de Paris (dans ${postWait}). Tu peux encore répondre aux commentaires.` : `Ton post du jour est disponible sur ${networkName(platform)}. Plusieurs réponses aux commentaires sont possibles dans la journée.`}</p>
        <KqSocialFeed player={player} platform={platform} scenarioId={scenario.id} media={feed}>{scenario.choices.map(choice => {
          const preview = getKqSocialChoicePreview(snapshot, platform, choice), tooTired = snapshot.energy + preview.energy < 0;
          const action = choice.action ?? "publish";
          const waitingToPublish = action === "publish" && !!postWait;
          const reason = !adventure.subject ? "Choisis la culture à raconter avant de publier."
            : waitingToPublish ? `Prochain post à minuit, heure de Paris, dans ${postWait} réelles.`
            : tooTired ? `Il manque ${Math.abs(snapshot.energy + preview.energy)} points d’énergie mentale.`
            : action === "ignore" ? "Aucun message publié. Le commentaire reste visible."
            : action === "reply" ? "Ta réponse restera sous ce post. Elle ne compte pas comme une publication de partenariat."
            : active?.platform === platform && !partnershipReady ? `Compte dans les ${active.publicationsLeft} publications restantes de ton partenariat.`
            : "Ce brouillon sera publié seulement si tu le choisis.";
          return <KqSocialDraft player={player} key={`${scenario.id}-${choice.id}`} platform={platform} text={feed.choicePosts[choice.id]} choice={choice} cost={Math.abs(preview.energy)} disabled={disabled || waitingToPublish || tooTired || !adventure.subject} reason={reason} replyTo={feed.thread?.comments.find(comment => comment.id === feed.thread?.targetCommentId)?.author.handle} onPublish={() => choose(choice)}><Forecast preview={preview} /></KqSocialDraft>;
        })}</KqSocialFeed>
      </section></div><aside className={styles.rail} aria-label="Ta communauté et tes engagements">{contractCard}
        <section className={styles.railCard} aria-label={`État de ton compte ${networkName(platform)}`}><div className={styles.profileTop}><strong>{networkName(platform)}</strong><span>{number(state.followers)} abonnés</span></div><KqProgressMeter label="Confiance" value={state.trust} max={100} valueLabel={`${state.trust} / 100`} tone="teal" /><KqProgressMeter label="Pression des haters" value={state.haters} max={100} valueLabel={`${state.haters} / 100`} tone={state.haters >= 40 ? "red" : "gold"} />{platform === "instagram" ? <span className={styles.moderation}><ShieldAlert size={15} aria-hidden="true" /><span>{state.moderation} / 5 alertes de modération{state.moderation >= 3 ? " · visibilité réduite" : ""}</span></span> : null}<p>{platform === "instagram" ? "Les images attirent l’œil. La confiance donne envie de rester ; le cannabis risque la modération du jeu." : "Les abonnés se gagnent par les échanges. La polémique accroît la pression et coûte davantage de mental."}</p>{state.intentStreak >= 2 ? <p>Tu as choisi « {intentions[state.lastIntent ?? "care"]} » {state.intentStreak} fois de suite. Ton public remarque la répétition.</p> : null}</section>
        {!active ? <section className={styles.railCard}><span className={styles.eyebrow}><Handshake size={15} aria-hidden="true" />Des marques te lisent</span><p>{availableOffers ? `${availableOffers} proposition${availableOffers > 1 ? "s" : ""} correspond${availableOffers > 1 ? "ent" : ""} à ta communauté.` : "Construis une audience et sa confiance pour intéresser les premières marques."}</p><button type="button" className={styles.textButton} onClick={openSponsors}>Voir les partenariats<ArrowRight size={14} aria-hidden="true" /></button></section> : null}
      </aside></div>
    </> : <>
      <header className={styles.sponsorsHeading}><div><h4>Ils veulent travailler avec toi.</h4><p>Des entreprises fictives de la filière chanvre te proposent des collaborations. Leurs primes suivent tes abonnés et la pression des haters sur le réseau concerné. Choisis les engagements que tu peux tenir.</p></div><div className={styles.earned}><strong>{formatKqCash(snapshot.sponsors.earnedCents)}</strong><small>Honoraires déjà versés</small></div></header>
      {active && sponsor ? <section className={styles.activeSponsor} aria-label="Livrer le partenariat" data-social-partnership><div><span className={styles.eyebrow}><Handshake size={15} aria-hidden="true" />Engagement en cours · {networkName(active.platform)}</span><h4>{sponsor.name}</h4>{sponsor.sector ? <p className={styles.sponsorSector}>{sponsor.sector}</p> : null}<p>{sponsor.brief}</p><div className={styles.contractValue}><strong data-social-signed-amount={active.rewardCents}>{formatKqCash(active.rewardCents)}</strong><small>Montant fixé à la signature</small><small>{partnershipReady ? "Prêts à être versés" : "À réclamer après les deux contenus"}</small></div>{active.pricing ? <SponsorPricing pricing={active.pricing} signedContract /> : null}<KqProgressMeter label="Contenus livrés" value={active.progressTags.length} max={sponsor.requiredTags.length} valueLabel={`${active.progressTags.length} / ${sponsor.requiredTags.length}`} /><p>{partnershipReady ? "L’engagement est rempli. Tu peux réclamer tes honoraires." : `${active.publicationsLeft} publications restantes sur ${networkName(active.platform)}. Une publication ordinaire consomme aussi une place.`}</p><p>{sponsor.tradeoff}</p><div className={styles.sponsorDisclosure}>Mention de partenariat toujours affichée. Aucun délai hors connexion. Un engagement non livré ne paie pas et ne crée aucune dette.</div><button type="button" className={styles.textButton} disabled={disabled} onClick={() => start({ ...baseCommand(), action: "sponsor-cancel" }, "Arrêter ce partenariat", `Tu mets fin à la collaboration avec ${sponsor.name}.`, ["Aucune dette ni pénalité financière.", "Les contenus déjà publiés restent dans ton histoire."], `${formatKqCash(active.rewardCents)} d’honoraires ne seront pas versés.`, true)} data-social-sponsor-cancel>Arrêter le partenariat</button></div><div className={styles.formats}>
        {partnershipReady ? <div className={styles.format}><strong>Les deux contenus sont validés.</strong><small>Les deux contenus sont livrés. Réclame les honoraires convenus pour les recevoir dans ta trésorerie.</small><button type="button" className={styles.primary} disabled={disabled} onClick={() => start({ ...baseCommand(), action: "sponsor-claim" }, "Réclamer mes honoraires")} data-social-sponsor-claim>Recevoir {formatKqCash(active.rewardCents)}<ArrowRight size={15} aria-hidden="true" /></button></div> : sponsor.requiredTags.map(tag => {
          const complete = active.progressTags.includes(tag), preview = getKqSponsorPostPreview(snapshot, tag), tooTired = snapshot.energy + preview.energy < 0;
          return <article key={tag} className={styles.format}><strong>{sponsor.deliverables?.[tag]?.title ?? KQ_SOCIAL_TAG_LABELS[tag]}</strong><small>{sponsor.deliverables?.[tag]?.description ?? formatDescriptions[tag]}</small>{complete ? <span className={styles.done}><Check size={15} aria-hidden="true" />Contenu livré</span> : <><small><Brain size={13} aria-hidden="true" /> Coût : {Math.abs(preview.energy)} points d’énergie mentale.</small>{tooTired ? <small>Il manque {Math.abs(snapshot.energy + preview.energy)} points.</small> : null}<small>{sponsorWait ? `Prochain post à minuit, heure de Paris, dans ${sponsorWait}.` : "Ce partenariat utilisera ton post du jour sur ce réseau."}</small><button type="button" className={styles.primary} disabled={disabled || !!sponsorWait || tooTired || active.publicationsLeft <= 0} onClick={() => sponsorPost(tag)} data-social-sponsored-post={tag}>Publier avec la mention partenariat</button><Forecast preview={preview} /></>}</article>;
        })}
      </div></section> : null}
      <div className={styles.offerGrid}>{offers.filter(o => o.status !== "active").map((offer, index) => <article key={offer.sponsor.id} className={styles.offer} data-status={offer.status} data-social-offer={offer.sponsor.id}><header className={styles.offerHeading}><span className={styles.brandLogo} aria-hidden="true">{offer.sponsor.name.slice(0, 1)}</span><div><h5>{offer.sponsor.name}</h5>{offer.sponsor.sector ? <span className={styles.sponsorSector}>{offer.sponsor.sector}</span> : null}<small>{offer.sponsor.contact} · {networkName(offer.sponsor.platform)}</small></div></header><p>{offer.sponsor.brief}</p>{offer.rewardCents !== null ? <div className={styles.offerFee}><strong data-social-offer-amount={offer.rewardCents}>{formatKqCash(offer.rewardCents)}</strong><span>{offer.status === "completed" ? "Honoraires versés" : offer.status === "locked" ? "Proposition sous conditions" : "Offre actuelle · après livraison"}</span></div> : null}{offer.pricing && (offer.status === "available" || offer.status === "locked") ? <SponsorPricing pricing={offer.pricing} /> : null}<ul className={styles.requirements}><li><Users size={14} aria-hidden="true" />{number(offer.sponsor.minimumFollowers)} abonnés et {offer.sponsor.minimumTrust} / 100 de confiance sur {networkName(offer.sponsor.platform)}</li><li><BookOpen size={14} aria-hidden="true" />{offer.sponsor.requiredTags.map(tag => offer.sponsor.deliverables?.[tag]?.title ?? KQ_SOCIAL_TAG_LABELS[tag]).join(" + ")}</li><li><Clock3 size={14} aria-hidden="true" />Deux contenus parmi tes {offer.sponsor.publicationBudget} prochaines publications sur ce réseau</li></ul><p>{offer.sponsor.tradeoff}</p>{offer.blockers.length && offer.status !== "completed" && offer.status !== "declined" ? <ul className={styles.blockers}>{offer.blockers.map((b, i) => <li key={i}>{b}</li>)}</ul> : null}{offer.status === "completed" ? <span className={styles.offerState}><Check size={15} aria-hidden="true" />Partenariat terminé et payé</span> : offer.status === "declined" ? <span className={styles.offerState}>Proposition close</span> : <div className={styles.offerActions}><button type="button" className={styles.primary} disabled={disabled || !offer.eligible} onClick={() => acceptOffer(offer)} data-social-sponsor-accept={offer.sponsor.id}>{offer.eligible ? "Étudier la proposition" : "Conditions à remplir"}</button><button type="button" className={styles.textButton} disabled={disabled || !offer.eligible} onClick={() => start({ ...baseCommand(), action: "sponsor-decline", sponsorId: offer.sponsor.id }, "Décliner cette proposition ?", `Tu réponds à ${offer.sponsor.name} que tu ne souhaites pas cette collaboration.`, ["Aucun coût et aucun changement de tes abonnés.", "Cette proposition sera définitivement close et ne reviendra pas."], "Tu pourras toujours étudier les autres marques.", true)} data-social-sponsor-decline={offer.sponsor.id}>Décliner définitivement</button></div>}{api.isTutorial && onTutorialPartnershipRead && index === 0 ? <button type="button" className={styles.secondary} data-releve-guide="read-social-partnerships" disabled={disabled} onClick={() => void readTutorial(() => onTutorialPartnershipRead(offer.sponsor.id))}>J’ai lu ces conditions · essai</button> : null}</article>)}</div>
    </>}
    <details className={styles.details}><summary>Ton audience et ses effets</summary><div className={styles.audienceDetails}><KqBarChart title="Abonnés par réseau" items={[{ label: "Instagram", value: snapshot.platforms.instagram.followers, displayValue: `${number(snapshot.platforms.instagram.followers)} abonnés`, tone: "gold" }, { label: "X", value: snapshot.platforms.x.followers, displayValue: `${number(snapshot.platforms.x.followers)} abonnés`, tone: "teal" }]} /><div>{fame.nextGoal ? <KqProgressMeter label="Prochain palier de notoriété" value={snapshot.socialFollowers} max={fame.nextGoal} valueLabel={`${number(snapshot.socialFollowers)} / ${number(fame.nextGoal)} abonnés`} tone="gold" /> : <p>Dernier palier de notoriété atteint.</p>}<p>Ta boutique compte {number(snapshot.audienceFollowers)} abonnés au total. Les réseaux contribuent à un potentiel de +{number(snapshot.additionalVisitsPerDay)} visites par jour. Les stocks, les prix et le site déterminent ensuite les ventes.</p></div></div></details>
    <details className={styles.details} data-social-journal><summary>Ton journal · {snapshot.history.length} événement{snapshot.history.length > 1 ? "s" : ""}</summary>{snapshot.history.length ? <ol className={styles.journal}>{snapshot.history.map(entry => <li key={entry.id}><div className={styles.historyTop}><span>{entry.platform ? networkName(entry.platform) : "Dans les coulisses"}</span><time dateTime={entry.createdAt}>{date(entry.createdAt)}</time></div><p>{entry.outcome}</p><Changes entry={entry} />{entry.scenarioId.includes("-debate-") ? <details><summary>Revoir {entry.action === "reply" || entry.action === "ignore" ? "la discussion" : "la publication"}</summary><KqSocialPublishedPost entry={entry} player={player} /></details> : null}{entry.reasons?.length ? <ul className={styles.reasons}>{entry.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul> : null}</li>)}</ol> : <p className={styles.empty}>Ton premier choix ouvrira ce journal.</p>}</details>
    <details className={styles.details}><summary>Comment se joue cette aventure</summary><p>{KQ_SOCIAL_SCENARIOS.filter(scene => scene.episode === 1).length} histoires en trois épisodes, soit {KQ_SOCIAL_SCENARIOS.length} situations : {KQ_SOCIAL_SCENARIOS.filter(scene => scene.platform === "instagram").length} sur Instagram et {KQ_SOCIAL_SCENARIOS.filter(scene => scene.platform === "x").length} sur X. Chaque situation propose trois choix et tes décisions changent la suite des échanges.</p><p>Tu peux publier un post Instagram et un post X par jour réel, partenariat compris. Un nouveau post devient disponible à minuit, heure de Paris. Les réponses aux commentaires peuvent être multiples dans la journée, selon ton mental disponible. Ignorer un commentaire n’utilise pas ton post du jour.{api.isTutorial ? " Avancer le temps fictif de cet essai ne débloque pas un autre post." : ""}</p><p>Les réactions dépendent du contenu, de la confiance, de la modération et de tes habitudes. Les estimations annoncent une fourchette, puis le journal garde le résultat réel. La pression des haters est un indice sur 100, pas un nombre de personnes ; elle baisse de 2 points par heure {api.isTutorial ? "fictive" : "réelle"}.</p><p>Ton mental récupère 1 point toutes les 5 minutes {timeKind}. Une pause rend jusqu’à 30 points toutes les 4 heures {timeKind}.</p><p>Instagram, X et les marques sont simulés dans Kanab Quest. Aucun compte externe n’est connecté et rien n’est publié sur les vrais réseaux.</p></details>
    <AppDialog open={confirmationOpen && !!pending} onClose={closeConfirmation} title="Confirmer ta décision" className={styles.dialog} bodyClassName={styles.dialogBody} dialogProps={{ "data-social-confirm": true }} footer={<div className={styles.dialogActions}><button type="button" className={styles.secondary} onClick={closeConfirmation}>{pending?.attempted ? "Fermer" : "Revenir"}</button><button type="button" className={styles.primary} disabled={mutating || parentBusy} onClick={() => { if (pending) void execute(pending); }} data-social-confirm-action>{mutating ? "Enregistrement…" : pending?.attempted ? "Vérifier le résultat" : "Confirmer"}</button></div>}>
      {pending ? <><h4>{pending.title}</h4><p>{pending.description}</p>{pending.facts.length ? <ul>{pending.facts.map((f, i) => <li key={i}>{f}</li>)}</ul> : null}{pending.risk ? <p className={styles.confirmRisk}>{pending.risk}</p> : null}{pending.attempted && !mutating ? <p>Le résultat reste à vérifier. Réessayer vérifie la même action.</p> : null}{actionError ? <p className={styles.error} role="alert">{actionError}</p> : null}{mutating ? <p role="status">Tu peux fermer cette fenêtre ; l’enregistrement continue.</p> : null}</> : null}
    </AppDialog>
  </section>;
}


