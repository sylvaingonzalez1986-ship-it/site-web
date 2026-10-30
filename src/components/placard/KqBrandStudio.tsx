"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { ArrowRight, Check, ChevronRight, LockKeyhole } from "lucide-react";
import type { KqCommerceSnapshot } from "@/lib/kanab-quest-commerce";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { KQ_ONLINE_SITE_TIERS } from "@/lib/kanab-quest-online";
import { KQ_STUDIO_LEVELS, KQ_STUDIO_STYLES, KQ_STUDIO_TRACKS, getKqStudioEligibility, getKqStudioLevels, getKqStudioStyle, type KqStudioLevelDefinition, type KqStudioTrack } from "@/lib/kanab-quest-studio";
import { KqBrandDirection } from "./KqBrandDirection";
import { compareKqStudioOffers, kqStudioStyleLabels } from "./kq-studio-preview";
import { KqProgressMeter } from "./KqVisuals";
import styles from "./KqBrandStudio.module.css";

type Ask = (title: string, description: string, body: Record<string, unknown>, cost?: number) => void;
type Props = { data: KqCommerceSnapshot; busy: boolean; onAsk: Ask; onOpenSite: () => void; onOpenMerch: () => void };
const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const countKnown = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const artCaptions: Record<KqStudioTrack, readonly string[]> = {
  photography: ["Tes récoltes sous l’objectif", "Le studio photo des récoltes", "Les trichomes en gros plan"],
  branding: ["Une identité pour tes récoltes", "Bocaux et sachets à ta marque", "La signature de tes collections"],
  editorial: ["Le portrait de chaque variété", "L’histoire de tes collections", "Le catalogue de tes récoltes"],
};

function AtelierArt({ track, level = 1 }: { track: KqStudioTrack; level?: number }) {
  return <span className={styles.art} data-track={track} data-level={Math.max(1, Math.min(3, level))} aria-hidden="true" />;
}

function initialTrack(data: KqCommerceSnapshot): KqStudioTrack {
  const online = data.online;
  if (!online?.upgrades || !online.site || !online.stats) return "photography";
  const levels = getKqStudioLevels(online);
  return KQ_STUDIO_TRACKS.find(item => levels[item.code] < 3 && getKqStudioEligibility(online, item.code, levels[item.code] + 1, data.cashCents).allowed)?.code
    ?? KQ_STUDIO_TRACKS.find(item => levels[item.code] < 3)?.code ?? "photography";
}

export function KqBrandStudio(props: Props) {
  const { data, busy, onAsk, onOpenSite, onOpenMerch } = props;
  const [track, setTrack] = useState<KqStudioTrack>(() => initialTrack(data));
  // Advance after a confirmed purchase, but preserve choices during a mere refresh.
  const [selection, setSelection] = useState<{ level: number; fromLevel: number } | null>(null);
  const tracks = useRef<Array<HTMLButtonElement | null>>([]);
  const levelsButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const decision = useRef<HTMLHeadingElement>(null);
  const online = data.online;
  if (!online) return null;
  const supported = online.studio?.version === 1;
  const stateKnown = typeof online.upgrades?.photography === "boolean" && typeof online.upgrades?.branding === "boolean"
    && (online.studio === undefined || (supported && KQ_STUDIO_TRACKS.every(item => countKnown(online.studio?.levels?.[item.code]) && online.studio!.levels[item.code] <= 3)
      && KQ_STUDIO_STYLES.some(item => item.code === online.studio?.style)));
  const levels = online.upgrades ? getKqStudioLevels(online) : { photography: 0, branding: 0, editorial: 0 };
  const currentStyle = getKqStudioStyle(online);
  const currentLevel = levels[track];
  const level = selection?.fromLevel === currentLevel ? selection.level : Math.min(3, currentLevel + 1);
  const target: KqStudioLevelDefinition = KQ_STUDIO_LEVELS.find(item => item.track === track && item.level === level)!;
  const owned = level <= currentLevel;
  const future = level > currentLevel + 1;
  const cash = countKnown(data.cashCents) ? data.cashCents : null;
  const currentSite = KQ_ONLINE_SITE_TIERS.find(item => item.code === online.site?.tier)?.level ?? null;
  const orders = countKnown(online.stats?.orders) ? online.stats.orders : null;
  const confidence = typeof online.confidence === "number" && Number.isFinite(online.confidence) && online.confidence >= 0 && online.confidence <= 100 ? online.confidence : null;
  const eligibility = stateKnown && online.site && online.stats
    ? getKqStudioEligibility(online, track, level, data.cashCents)
    : { allowed: false, costCents: null, blockers: [] };
  const allowed = stateKnown && data.computerOwned === true && eligibility.allowed;
  const candidate = { ...online, studio: { version: 1 as const, levels: { ...levels, [track]: Math.max(level, currentLevel) }, style: currentStyle } };
  const { offers: impacts, merchUnavailable, flowersUnavailable } = compareKqStudioOffers(data, candidate);
  const total = Object.values(levels).reduce((sum, value) => sum + value, 0);
  const remainingCost = KQ_STUDIO_LEVELS.filter(item => item.track === track && item.level > currentLevel && item.level <= level).reduce((sum, item) => sum + item.costCents, 0);
  const requirements = [
    { label: "Niveau du site", value: currentSite, goal: target.minimumSiteLevel },
    ...(target.minimumOrders || orders === null ? [{ label: "Commandes de récoltes", value: orders, goal: target.minimumOrders }] : []),
    ...(target.minimumConfidence || confidence === null ? [{ label: "Confiance", value: confidence, goal: target.minimumConfidence }] : []),
  ];
  const missing = requirements.filter(item => item.value === null || item.value < item.goal);
  const met = requirements.filter(item => item.value !== null && item.value >= item.goal);
  const prerequisites = KQ_STUDIO_TRACKS.flatMap(item => target.requiredLevels[item.code] ? [{ ...item, level: target.requiredLevels[item.code]! }] : []);
  const missingTracks = prerequisites.filter(item => levels[item.code] < item.level);
  const metTracks = prerequisites.filter(item => levels[item.code] >= item.level);
  const benefit = target.description.replaceAll("fleurs", "récoltes").replace(/×(\d+,\d+)/g, (_, value: string) => `+${number(Math.round((Number(value.replace(",", ".")) - 1) * 100))} %`);

  function chooseTrack(next: KqStudioTrack, focus = false) {
    setTrack(next); setSelection(null);
    if (focus) tracks.current[KQ_STUDIO_TRACKS.findIndex(item => item.code === next)]?.focus();
  }
  function chooseLevel(next: number, focus = false) {
    setSelection({ level: next, fromLevel: currentLevel });
    if (focus) requestAnimationFrame(() => decision.current?.focus());
  }
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number, mode: "tracks" | "levels") {
    const next = event.key === "ArrowRight" ? (index + 1) % 3 : event.key === "ArrowLeft" ? (index + 2) % 3 : event.key === "Home" ? 0 : event.key === "End" ? 2 : null;
    if (next === null) return;
    event.preventDefault();
    if (mode === "tracks") chooseTrack(KQ_STUDIO_TRACKS[next].code, true);
    else { chooseLevel(next + 1); levelsButtons.current[next]?.focus(); }
  }
  function returnToNext() { setSelection(null); decision.current?.focus(); }
  function purchase() {
    if (busy || !allowed || !eligibility.costCents) return;
    const legacy = !supported && target.level === 1 && target.track !== "editorial";
    onAsk(`${target.name} · niveau ${target.level}`, `${formatKqCash(target.costCents)} pour ce palier, sans abonnement. ${benefit} Les bonus indiqués sont ceux de ce niveau, pas un ajout aux bonus précédents. Les niveaux précédents restent acquis.${supported ? ` La direction ${kqStudioStyleLabels[currentStyle]} reste appliquée.` : ""} Aucun visiteur ni point de qualité n’est ajouté.`, { action: "online", command: legacy ? "buy-upgrade" : "buy-studio-level", payload: legacy ? { code: target.track } : { track: target.track, level: target.level } }, target.costCents);
  }

  return <section className={styles.studio} data-brand-studio aria-label="Atelier photo et identité de marque">
    <header className={styles.heading}><h2>Photos et marque</h2><span>{stateKnown ? <><strong>{total} / 9</strong> paliers acquis</> : "Paliers à confirmer"}</span></header>
    <div className={styles.tracks} role="group" aria-label="Choisir un atelier">{KQ_STUDIO_TRACKS.map((item, index) => <button type="button" key={item.code} ref={node => { tracks.current[index] = node; }} data-studio-track={item.code} aria-pressed={track === item.code} onClick={() => chooseTrack(item.code)} onKeyDown={event => navigate(event, index, "tracks")}>
      <AtelierArt track={item.code} level={levels[item.code]} /><span><strong>{item.name}</strong><small>{stateKnown ? `Niveau ${levels[item.code]} / 3` : "À confirmer"}</small><span className={styles.steps} aria-hidden="true">{[1, 2, 3].map(value => <i key={value} data-owned={stateKnown && levels[item.code] >= value} />)}</span></span>
    </button>)}</div>
    {stateKnown ? <div className={styles.workbench}>
      <article className={styles.investment} data-studio-investment={track} data-level={level}>
        <p className={styles.status}>{KQ_STUDIO_TRACKS.find(item => item.code === track)!.name} · niveau actuel {currentLevel} / 3{owned ? " · palier acquis" : ` → niveau ${level}`}</p>
        <h3 ref={decision} tabIndex={-1}>{target.name}</h3>
        <p className={styles.benefit}>{benefit}</p>
        <p className={styles.hint}>Bonus total de ce niveau. Les ventes dépendent aussi de ton audience et de tes prix.</p>
        {owned ? <div className={styles.acquired}><Check size={18} aria-hidden="true" /><strong>{currentLevel === 3 ? "Atelier au niveau maximal" : "Ce palier est acquis"}</strong>{currentLevel < 3 ? <button type="button" className={styles.secondary} onClick={returnToNext}>Prochain palier<ChevronRight size={16} aria-hidden="true" /></button> : null}</div> : <>
          <div className={styles.cost} data-studio-cost><div><span>{future ? "Ce palier seul" : "Achat unique"}</span><strong>{formatKqCash(target.costCents)}</strong><small>Sans abonnement</small></div><div><span>Trésorerie</span><strong>{cash === null ? "À confirmer" : formatKqCash(cash)}</strong>{cash !== null && cash < target.costCents ? <small>Il manque {formatKqCash(target.costCents - cash)}</small> : null}</div></div>
          {future ? <div className={styles.blocked}><p>Les paliers se débloquent dans l’ordre. Prévois {formatKqCash(remainingCost)} pour les {level - currentLevel} paliers restants de cet atelier.</p><button type="button" className={styles.secondary} onClick={returnToNext}>Voir le prochain palier<ChevronRight size={16} aria-hidden="true" /></button></div> : null}
          {!supported && !(level === 1 && track !== "editorial") ? <p className={styles.blocked}>Ce palier avancé n’est pas encore disponible dans cette partie.</p> : null}
          {data.computerOwned !== true ? <p className={styles.blocked}>Un ordinateur est nécessaire pour gérer le Studio.</p> : null}
          {online.site?.active !== true || !online.site?.createdAt ? <div className={styles.blocked}><p>{online.site?.createdAt ? "Les ventes sont suspendues. Active la boutique avant cet achat." : "Crée et active ta boutique avant cet achat."}</p><button type="button" className={styles.secondary} onClick={onOpenSite}>{online.site?.createdAt ? "Activer ma boutique" : "Créer ma boutique"}<ArrowRight size={16} aria-hidden="true" /></button></div> : null}
          {missing.length || missingTracks.length ? <div className={styles.requirements} data-studio-requirements-missing><h4>Avant cet achat</h4>{missing.map(item => <div key={item.label}>{item.value === null ? <p>{item.label} : à confirmer{item.goal ? ` · requis : ${item.goal}` : ""}</p> : <KqProgressMeter label={item.label} value={item.value} max={item.goal} valueLabel={`${number(item.value)} / ${item.goal}`} tone="gold" />}</div>)}
            {missingTracks.map(item => <div className={styles.prerequisite} key={item.code}><span><LockKeyhole size={16} aria-hidden="true" />{item.name} · niveau {item.level}</span><button type="button" className={styles.secondary} aria-label={`Voir ${item.name}, niveau ${item.level}`} onClick={() => chooseTrack(item.code, true)}>Voir<ChevronRight size={16} aria-hidden="true" /></button></div>)}
            {(currentSite === null || currentSite < target.minimumSiteLevel) && online.site?.active === true ? <button type="button" className={styles.secondary} onClick={onOpenSite}>Développer le site<ArrowRight size={16} aria-hidden="true" /></button> : null}
          </div> : null}
          <button type="button" className={styles.primary} data-studio-buy disabled={busy || !allowed} onClick={purchase}>{busy ? "Validation en cours…" : "Examiner l’amélioration"}<ArrowRight size={17} aria-hidden="true" /></button>
          {cash === null ? <p className={styles.hint}>La trésorerie doit être confirmée avant cet achat.</p> : null}
          {met.length + metTracks.length ? <details className={styles.details} data-studio-requirements-met><summary>Conditions remplies<span>{met.length + metTracks.length}</span></summary><ul className={styles.met}>{met.map(item => <li key={item.label}><Check size={16} aria-hidden="true" />{item.label} : {number(item.value!)} / {item.goal}</li>)}{metTracks.map(item => <li key={item.code}><Check size={16} aria-hidden="true" />{item.name} · niveau {item.level} acquis</li>)}</ul></details> : null}
        </>}
        {track === "branding" && levels.branding >= 1 ? <button type="button" className={styles.secondary} onClick={onOpenMerch}>Voir les produits dérivés<ArrowRight size={16} aria-hidden="true" /></button> : null}
      </article>
      {!owned && (impacts.length || flowersUnavailable || merchUnavailable) ? <details className={styles.details} data-studio-impacts><summary>Effet estimé sur mes produits<span>{impacts.length ? `${impacts.length} référence${impacts.length > 1 ? "s" : ""}` : "À confirmer"}</span></summary><p className={styles.hint}>Cadence actuelle → avec ce niveau. Même audience, mêmes prix et direction actuelle. Les ventes restent estimées ; les paliers précédents sont nécessaires.</p>{impacts.map(item => <div className={styles.impactRow} key={item.id}><span><strong>{item.name}</strong><small>{item.unit}</small></span><span>{number(item.before)}<ArrowRight size={15} aria-hidden="true" /><strong>{number(item.after)}</strong></span></div>)}{flowersUnavailable ? <p className={styles.hint}>Certaines prévisions de récoltes sont indisponibles.</p> : null}{merchUnavailable ? <p className={styles.hint}>Prévisions des produits dérivés indisponibles.</p> : null}</details> : null}
      <details className={styles.details} data-studio-levels-details><summary>Tous les paliers de cet atelier<span>{currentLevel} / 3 acquis</span></summary><div className={styles.levels} role="group" aria-label="Explorer les paliers">{KQ_STUDIO_LEVELS.filter(item => item.track === track).map((item, index) => <button type="button" key={item.level} ref={node => { levelsButtons.current[index] = node; }} data-studio-level={item.level} aria-pressed={item.level === level} data-owned={item.level <= currentLevel} onClick={() => chooseLevel(item.level, true)} onKeyDown={event => navigate(event, index, "levels")}><span>{item.level <= currentLevel ? <Check size={17} aria-hidden="true" /> : item.level}</span><span><strong>{item.name}</strong><small>{item.level <= currentLevel ? "Acquis" : `${formatKqCash(item.costCents)} · ce palier seul`}</small></span></button>)}</div></details>
      <details className={styles.details} data-studio-art-details><summary>Voir l’atelier illustré</summary><figure className={styles.illustration}><AtelierArt track={track} level={level} /><figcaption>{artCaptions[track][level - 1]}</figcaption></figure></details>
    </div> : <p className={styles.unavailable}>Les niveaux de tes ateliers sont à confirmer. Actualise la boutique pour retrouver tes améliorations.</p>}
    <KqBrandDirection data={data} online={online} busy={busy} onAsk={onAsk} onChooseTrack={next => chooseTrack(next, true)} />
  </section>;
}
