"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import Image from "next/image";
import { ArrowRight, Camera, Check, ChevronRight, Feather, Leaf, LockKeyhole, Paintbrush, Sparkles } from "lucide-react";
import type { KqCommerceSnapshot } from "@/lib/kanab-quest-commerce";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { getKqAdvertisingMultiplier } from "@/lib/kanab-quest-business";
import { estimateKqMerchOffer } from "@/lib/kanab-quest-merch";
import { getKqShopActivity } from "@/lib/kanab-quest-shop-activity";
import { estimateKqOnlineOffer, getKqOnlineSiteTier, type KqOnlineSnapshot } from "@/lib/kanab-quest-online";
import { KQ_STUDIO_LEVELS, KQ_STUDIO_STYLES, KQ_STUDIO_TRACKS, getKqStudioEditorialFit, getKqStudioEligibility, getKqStudioFlowerMultiplier, getKqStudioLevels, getKqStudioStyle, type KqStudioLevelDefinition, type KqStudioStyle, type KqStudioTrack } from "@/lib/kanab-quest-studio";
import { KqBarChart, KqProgressMeter } from "./KqVisuals";
import styles from "./KqBrandStudio.module.css";

type Ask = (title: string, description: string, body: Record<string, unknown>, cost?: number) => void;
type Props = { data: KqCommerceSnapshot; busy: boolean; onAsk: Ask; onOpenSite: () => void; onOpenMerch: () => void };
const icons = { photography: Camera, branding: Paintbrush, editorial: Feather };
const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const percent = (multiplier: number) => `${multiplier >= 1 ? "+" : ""}${number(Math.round((multiplier - 1) * 10_000) / 100)} %`;
const styleLabels = { clear: "Clair", craft: "Atelier", signature: "Signature" };
const known = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const artCaptions: Record<KqStudioTrack, readonly string[]> = {
  photography: ["Tes fleurs CBD sous l’objectif", "Le studio photo des récoltes", "Les trichomes en gros plan"],
  branding: ["Une identité pour tes fleurs CBD", "Bocaux et sachets à ta marque", "La signature de tes collections CBD"],
  editorial: ["Le portrait de chaque variété", "L’histoire de tes collections CBD", "Le catalogue de tes fleurs CBD"],
};

function AtelierArt({ track, level = 1 }: { track: KqStudioTrack; level?: number }) {
  return <span className={styles.art} data-track={track} data-level={Math.max(1, Math.min(3, level))} aria-hidden="true" />;
}

/** Compare the same real offers. No placeholder stock or historical results. */
function compareOffers(data: KqCommerceSnapshot, candidate: KqOnlineSnapshot) {
  const online = data.online!;
  const flowers = online.listings.filter(row => row.status === "active" && row.remainingPackets > 0 && row.qualityScore >= 5.8);
  const flowerRows = flowers.map(row => {
    const estimate = estimateKqOnlineOffer({ online, listingId: row.id, route: row.route, varietyCode: row.varietyCode, customerDemand: data.customerDemand,
      quality: row.qualityScore, baseUnitCents: row.baseUnitCents, formatGrams: row.formatGrams, packagingCode: row.packagingCode,
      packetPriceCents: row.packetPriceCents, reputation: data.reputation, clients: data.clients, activeListingCount: flowers.length,
      advertisingMultiplier: getKqAdvertisingMultiplier(data.business, Date.parse(online.serverNow)) });
    const ratio = known(row.offer?.valueRatio) ? row.offer.valueRatio : estimate.priceRatio;
    const before = online.site.active ? known(row.offer?.ordersPerDay) ? row.offer.ordersPerDay : estimate.ordersPerDay : 0;
    const after = before * getKqStudioFlowerMultiplier(candidate, row.qualityScore, ratio) / getKqStudioFlowerMultiplier(online, row.qualityScore, ratio);
    return { id: row.id, name: row.name, unit: "paquets / jour", before, after,
      fit: getKqStudioEditorialFit(candidate, { quality: row.qualityScore, priceRatio: ratio }),
      detail: `${number(row.qualityScore)}/10 · ${formatKqCash(row.packetPriceCents)} / ${row.formatGrams} g`,
      reference: `Prix de référence : ${formatKqCash(row.offer?.referencePacketCents ?? estimate.referencePacketPriceCents)}` };
  });
  const activity = getKqShopActivity(data).merch;
  const merchUnavailable = !activity.available || activity.active === null || activity.estimatedUnitsPerDay === null
    || !Array.isArray(online.merch?.modules) || activity.active.some(row => row.priceCents === null || row.quantity === null);
  const merch = merchUnavailable ? [] : activity.active!;
  return { merchUnavailable, offers: [...flowerRows, ...merch.map(row => {
    const product = row.product;
    const priceCents = row.priceCents!;
    const quote = (snapshot: KqOnlineSnapshot) => estimateKqMerchOffer({ online: snapshot, code: row.code, priceCents, reputation: data.reputation, clients: data.clients, activeProductCount: merch.length }).unitsPerDay;
    return { id: `merch-${row.code}`, name: product.name, unit: "articles / jour", before: quote(online), after: quote(candidate),
      fit: getKqStudioEditorialFit(candidate, { merchCode: row.code, priceRatio: priceCents / product.referencePriceCents }),
      detail: `${row.quantity} en stock · ${formatKqCash(priceCents)} / article`, reference: `Prix de référence : ${formatKqCash(product.referencePriceCents)}` };
  })] };
}

function DirectionPreview({ name, style, online }: { name: string; style: KqStudioStyle; online: KqOnlineSnapshot }) {
  const levels = getKqStudioLevels(online);
  const headline = style === "clear" ? "Les récoltes, simplement." : style === "craft" ? "Les gestes font la différence." : "La sélection de la maison.";
  return <figure className={styles.maquette} data-studio-preview data-direction={style}>
    <div className={styles.previewBrand}><Leaf size={levels.branding >= 2 ? 27 : 20} aria-hidden="true" /><strong>{name}</strong><small>{styleLabels[style]}</small></div>
    <div className={styles.previewBody} data-photo-level={levels.photography}><Image src="/placard/market-brand-studio-sylvain-v3.webp" alt="" width={600} height={400} sizes="(max-width: 700px) 280px, 400px" /><div><small>{levels.branding >= 3 ? "Une maison, une signature" : "Les Chanvriers bretons"}</small><h4>{headline}</h4>{levels.editorial > 0 ? <p>{style === "clear" ? "Des informations lisibles pour choisir à ton rythme." : style === "craft" ? "De l’atelier à la récolte, notre travail en images." : "Des pièces choisies avec attention, présentées dans le détail."}</p> : null}</div></div>
    {levels.branding >= 2 ? <div className={styles.previewSeal}><Leaf size={14} aria-hidden="true" />{levels.branding === 3 ? "Collection de la maison" : "L’identité de notre atelier"}</div> : null}
    <figcaption>Maquette de présentation · {styleLabels[style]}<br />Les images et le texte illustrent une mise en page.</figcaption>
  </figure>;
}

function BrandDirection({ data, online, busy, onAsk, onChooseTrack }: Props & { online: KqOnlineSnapshot; onChooseTrack: (track: KqStudioTrack) => void }) {
  const id = useId();
  const [draft, setDraft] = useState<KqStudioStyle | null>(null);
  const [selection, setSelection] = useState("");
  const current = getKqStudioStyle(online);
  const selected = draft ?? current;
  const levels = getKqStudioLevels(online);
  const supported = online.studio?.version === 1;
  const enabled = supported && data.computerOwned && Boolean(online.site.createdAt) && (levels.branding >= 1 || levels.editorial >= 1);
  const candidate: KqOnlineSnapshot = { ...online, studio: { version: 1, levels, style: selected } };
  const direction = KQ_STUDIO_STYLES.find(item => item.code === selected)!;
  const { offers, merchUnavailable } = compareOffers(data, candidate);
  const offer = offers.find(item => item.id === selection) ?? offers[0];
  return <section className={styles.direction} aria-label="Direction de la boutique">
    <header className={styles.subheading}><div><span>Un ton, une gamme, une cohérence</span><h3>Donner du caractère à ta marque</h3></div><span className={styles.free}>Changement gratuit</span></header>
    <div className={styles.styleChoices} role="group" aria-label="Explorer les directions de marque">{KQ_STUDIO_STYLES.map(item => <button type="button" key={item.code} data-studio-style={item.code} data-direction={item.code} aria-pressed={selected === item.code} onClick={() => setDraft(item.code)}><span className={styles.swatches} aria-hidden="true"><i /><i /><i /></span><strong>{styleLabels[item.code]}</strong><small>{supported && current === item.code ? <><Check size={12} aria-hidden="true" />Appliquée</> : "Voir l’aperçu"}</small></button>)}</div>
    <div className={styles.directionLayout}>
      <DirectionPreview name={data.business?.shop.name ?? "Ma boutique"} style={selected} online={online} />
      <div className={styles.directionDecision}>
        <h4>{direction.name}</h4><p>{direction.description}</p>
        <div className={styles.fitRules}><span><Leaf size={15} aria-hidden="true" /><strong>Récoltes</strong></span><p>{direction.flowerHint}</p><span><Paintbrush size={15} aria-hidden="true" /><strong>Merch</strong></span><p>{direction.merchHint}</p></div>
        <p className={styles.effectNote}>{levels.editorial > 0 ? `Fiches & récits niveau ${levels.editorial} : ${percent([1, 1.04, 1.08, 1.12][levels.editorial])} de conversion si l’offre correspond, ${percent([1, .98, .96, .94][levels.editorial])} sinon. Les autres bonus restent acquis.` : "La direction change l’apparence de ta boutique. Les effets liés au type de produits se débloquent avec Fiches & récits."}</p>
        {merchUnavailable ? <p className={styles.empty}>Aperçu du merch indisponible. Les comparaisons de récoltes restent accessibles.</p> : null}
        {offer ? <div className={styles.offerComparison} data-studio-style-comparison data-before={offer.before} data-after={offer.after}>
          <label htmlFor={`${id}-offer`}>Observer un produit en vente<select id={`${id}-offer`} value={offer.id} onChange={event => setSelection(event.target.value)}>{offers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <small>{offer.detail}<br />{offer.reference}</small>
          <KqBarChart title={`Cadence estimée · ${offer.unit}`} items={[{ label: "Direction actuelle", value: offer.before, displayValue: number(offer.before), tone: "ink" }, { label: `Avec ${styleLabels[selected]}`, value: offer.after, displayValue: number(offer.after), tone: offer.after < offer.before ? "red" : "teal" }]} />
          <p className={styles.match} data-match={offer.fit.matched}>{offer.fit.matched ? <Check size={14} aria-hidden="true" /> : <LockKeyhole size={14} aria-hidden="true" />}{offer.fit.matched ? "Ce produit correspond à cette direction." : "Ce produit ne correspond pas à cette direction."}</p>
        </div> : !merchUnavailable ? <p className={styles.empty}>Mets un produit en vente pour comparer la cadence sur ton offre réelle.</p> : null}
        <button type="button" className={styles.primary} data-studio-apply-style disabled={busy || !enabled || selected === current} onClick={() => onAsk(`Adopter la direction ${styleLabels[selected]}`, `${direction.description} Changement gratuit appliqué à toute la boutique. ${levels.editorial > 0 ? "Les produits qui correspondent au ton choisi gagnent en conversion, les autres en perdent : les stocks et prix restent identiques." : "Pour l’instant, seule la présentation change ; Fiches & récits débloquera les effets sur la conversion."} Aucun visiteur ni point de qualité n’est ajouté.`, { action: "online", command: "choose-studio-style", payload: { style: selected } }, 0)}>{supported && selected === current ? "Direction appliquée" : "Appliquer cette direction"}<ArrowRight size={16} aria-hidden="true" /></button>
        {!supported ? <small className={styles.hint}>Les directions ne sont pas encore disponibles dans cette partie.</small> : !enabled ? <button type="button" className={styles.textButton} onClick={() => onChooseTrack("branding")}>Débloquer l’identité de marque<ChevronRight size={15} aria-hidden="true" /></button> : null}
        <small className={styles.hint}>Même audience, mêmes prix et stocks. Les prévisions ne garantissent aucune vente.</small>
      </div>
    </div>
  </section>;
}

export function KqBrandStudio(props: Props) {
  const { data, busy, onAsk, onOpenSite, onOpenMerch } = props;
  const [track, setTrack] = useState<KqStudioTrack>("photography");
  const [selection, setSelection] = useState<number | null>(null);
  const tracks = useRef<Array<HTMLButtonElement | null>>([]);
  const levelsButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const online = data.online;
  if (!online) return null;
  const levels = getKqStudioLevels(online);
  const currentStyle = getKqStudioStyle(online);
  const supported = online.studio?.version === 1;
  const level = selection ?? Math.min(3, levels[track] + 1);
  const target: KqStudioLevelDefinition = KQ_STUDIO_LEVELS.find(item => item.track === track && item.level === level)!;
  const eligibility = getKqStudioEligibility(online, track, level, data.cashCents);
  const owned = level <= levels[track];
  const candidate = { ...online, studio: { version: 1 as const, levels: { ...levels, [track]: Math.max(level, levels[track]) }, style: currentStyle } };
  const { offers: impacts } = compareOffers(data, candidate);
  const currentSite = getKqOnlineSiteTier(online.site.tier).level;
  const total = Object.values(levels).reduce((sum, value) => sum + value, 0);
  function chooseTrack(next: KqStudioTrack, focus = false) {
    setTrack(next); setSelection(null);
    if (focus) tracks.current[KQ_STUDIO_TRACKS.findIndex(item => item.code === next)]?.focus();
  }
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number, mode: "tracks" | "levels") {
    const next = event.key === "ArrowRight" ? (index + 1) % 3 : event.key === "ArrowLeft" ? (index + 2) % 3 : event.key === "Home" ? 0 : event.key === "End" ? 2 : null;
    if (next === null) return;
    event.preventDefault();
    if (mode === "tracks") chooseTrack(KQ_STUDIO_TRACKS[next].code, true);
    else { setSelection(next + 1); levelsButtons.current[next]?.focus(); }
  }
  const requirements = [
    { label: "Niveau du site", value: currentSite, goal: target.minimumSiteLevel },
    ...(target.minimumOrders ? [{ label: "Commandes de récoltes", value: online.stats.orders, goal: target.minimumOrders }] : []),
    ...(target.minimumConfidence ? [{ label: "Confiance /100", value: online.confidence, goal: target.minimumConfidence }] : []),
  ];
  const prerequisites = KQ_STUDIO_TRACKS.flatMap(item => target.requiredLevels[item.code] ? [{ ...item, level: target.requiredLevels[item.code]! }] : []);
  function purchase() {
    if (busy || !eligibility.allowed || !eligibility.costCents) return;
    const legacy = !supported && target.level === 1 && target.track !== "editorial";
    onAsk(`${target.name} · niveau ${target.level}`, `${formatKqCash(target.costCents)} pour ce palier, sans abonnement. ${target.description} Les niveaux précédents restent acquis. La direction ${styleLabels[currentStyle]} reste appliquée. Aucun visiteur ni point de qualité n’est ajouté.`, { action: "online", command: legacy ? "buy-upgrade" : "buy-studio-level", payload: legacy ? { code: target.track } : { track: target.track, level: target.level } }, target.costCents);
  }
  return <section className={styles.studio} data-brand-studio aria-label="Atelier photo et identité de marque">
    <header className={styles.heading}><div><span className={styles.eyebrow}><Sparkles size={15} aria-hidden="true" />L’atelier de Sylvain</span><h2>Une marque qui se reconnaît.</h2><p>Soigne tes images, construis ton identité, trouve le ton juste.</p></div><div className={styles.completed}><strong>{total}<small> / 9</small></strong><span>paliers acquis</span></div></header>
    <div className={styles.tracks} role="group" aria-label="Choisir un atelier">{KQ_STUDIO_TRACKS.map((item, index) => {
      const Icon = icons[item.code];
      return <button type="button" key={item.code} ref={node => { tracks.current[index] = node; }} data-studio-track={item.code} aria-pressed={track === item.code} onClick={() => chooseTrack(item.code)} onKeyDown={event => navigate(event, index, "tracks")}><AtelierArt track={item.code} level={levels[item.code]} /><span><strong><Icon size={15} aria-hidden="true" />{item.name}</strong><small>Niveau {levels[item.code]} / 3</small><span className={styles.steps} aria-hidden="true">{[1, 2, 3].map(value => <i key={value} data-owned={levels[item.code] >= value} />)}</span></span></button>;
    })}</div>
    <div className={styles.workbench}>
      <div className={styles.levels} role="group" aria-label="Explorer les paliers">{KQ_STUDIO_LEVELS.filter(item => item.track === track).map((item, index) => <button type="button" key={item.level} ref={node => { levelsButtons.current[index] = node; }} data-studio-level={item.level} aria-pressed={item.level === level} data-owned={item.level <= levels[track]} onClick={() => setSelection(item.level)} onKeyDown={event => navigate(event, index, "levels")}><span>{item.level <= levels[track] ? <Check size={15} aria-hidden="true" /> : item.level}</span><div><strong>{item.name}</strong><small>{item.level <= levels[track] ? "Acquis" : formatKqCash(item.costCents)}</small></div></button>)}</div>
      <article className={styles.investment} data-studio-investment={track} data-level={level}>
        <div className={styles.illustration}><AtelierArt track={track} level={level} /><span>{artCaptions[track][level - 1]}</span></div>
        <div className={styles.decision}><span className={styles.eyebrow}>Niveau {level} · {owned ? "acquis" : "à développer"}</span><h3>{target.name}</h3><p>{target.description.replaceAll("fleurs", "récoltes")}</p>
          <div className={styles.cost}><span>{owned ? "Investissement déjà acquis" : "Achat unique de ce palier"}<strong>{formatKqCash(target.costCents)}</strong></span><small>Trésorerie : {formatKqCash(data.cashCents)}</small></div>
          {!owned ? <>
            <div className={styles.requirements}>{requirements.map(item => <KqProgressMeter key={item.label} label={item.label} value={item.value} max={item.goal} valueLabel={`${number(item.value)} / ${item.goal}`} tone={item.value >= item.goal ? "teal" : "gold"} />)}</div>
            {prerequisites.length ? <ul className={styles.prerequisites}>{prerequisites.map(item => <li key={item.code}><span>{levels[item.code] >= item.level ? <Check size={14} aria-hidden="true" /> : <LockKeyhole size={14} aria-hidden="true" />}{item.name} · niveau {item.level}</span>{levels[item.code] < item.level ? <button type="button" className={styles.textButton} onClick={() => chooseTrack(item.code, true)}>Voir<ChevronRight size={14} aria-hidden="true" /></button> : <strong>Acquis</strong>}</li>)}</ul> : null}
            {currentSite < target.minimumSiteLevel ? <button type="button" className={styles.textButton} onClick={onOpenSite}>Développer le site<ArrowRight size={14} aria-hidden="true" /></button> : null}
            <button type="button" className={styles.primary} data-studio-buy disabled={busy || !eligibility.allowed} onClick={purchase}>Investir · {formatKqCash(target.costCents)}<ArrowRight size={16} aria-hidden="true" /></button>
            {eligibility.blockers.length ? <p className={styles.blocked}><LockKeyhole size={14} aria-hidden="true" />{eligibility.blockers[0]}</p> : null}
          </> : <div className={styles.acquired}><Check size={17} aria-hidden="true" />Ce palier est acquis.{levels[track] < 3 ? <button type="button" className={styles.textButton} onClick={() => setSelection(levels[track] + 1)}>Prochain palier<ChevronRight size={14} aria-hidden="true" /></button> : null}</div>}
          {track === "branding" && levels.branding >= 1 ? <button type="button" className={styles.textButton} onClick={onOpenMerch}>Décliner la marque en merch<ArrowRight size={14} aria-hidden="true" /></button> : null}
        </div>
      </article>
      {!owned && impacts.length ? <details className={styles.impactDetails}><summary>Effet estimé sur mes produits en vente<span>{impacts.length} référence{impacts.length > 1 ? "s" : ""}</span></summary><div>{impacts.map(item => <div className={styles.impactRow} key={item.id}><span><strong>{item.name}</strong><small>{item.unit}</small></span><span>{number(item.before)}<ArrowRight size={13} aria-hidden="true" /><strong>{number(item.after)}</strong></span></div>)}</div><p>Même audience, mêmes prix et direction actuelle. Les paliers manquants restent nécessaires avant cet achat.</p></details> : null}
    </div>
    <BrandDirection {...props} online={online} onChooseTrack={next => chooseTrack(next, true)} />
  </section>;
}
