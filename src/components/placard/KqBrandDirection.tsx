"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import Image from "next/image";
import { ArrowRight, Check, ChevronRight, Leaf, LockKeyhole, Paintbrush } from "lucide-react";
import type { KqCommerceSnapshot } from "@/lib/kanab-quest-commerce";
import type { KqOnlineSnapshot } from "@/lib/kanab-quest-online";
import { KQ_STUDIO_STYLES, KQ_STUDIO_TRACKS, getKqStudioLevels, getKqStudioStyle, type KqStudioStyle, type KqStudioTrack } from "@/lib/kanab-quest-studio";
import { KqBarChart } from "./KqVisuals";
import { compareKqStudioOffers, kqStudioStyleLabels } from "./kq-studio-preview";
import styles from "./KqBrandDirection.module.css";

type Props = {
  data: KqCommerceSnapshot;
  online: KqOnlineSnapshot;
  busy: boolean;
  onAsk: (title: string, description: string, body: Record<string, unknown>, cost?: number) => void;
  onChooseTrack: (track: KqStudioTrack) => void;
};
const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

function DirectionPreview({ name, style, online }: { name: string; style: KqStudioStyle; online: KqOnlineSnapshot }) {
  const levels = getKqStudioLevels(online);
  const headline = style === "clear" ? "Les récoltes, simplement." : style === "craft" ? "Les gestes font la différence." : "La sélection de la maison.";
  return <figure className={styles.maquette} data-studio-preview data-direction={style}>
    <div className={styles.previewBrand}><Leaf size={levels.branding >= 2 ? 27 : 20} aria-hidden="true" /><strong>{name}</strong><small>{kqStudioStyleLabels[style]}</small></div>
    <div className={styles.previewBody} data-photo-level={levels.photography}>
      <Image src="/placard/market-brand-studio-sylvain-v3.webp" alt="" width={600} height={400} sizes="(max-width: 700px) 280px, 500px" />
      <div><h4>{headline}</h4>{levels.editorial > 0 ? <p>{style === "clear" ? "Des informations lisibles pour choisir à ton rythme." : style === "craft" ? "De l’atelier à la récolte, notre travail en images." : "Des pièces choisies avec attention, présentées dans le détail."}</p> : null}</div>
    </div>
    {levels.branding >= 2 ? <div className={styles.previewSeal}><Leaf size={14} aria-hidden="true" />{levels.branding === 3 ? "Collection de la maison" : "L’identité de notre atelier"}</div> : null}
    <figcaption>Maquette de présentation · {kqStudioStyleLabels[style]}<br />Les images et le texte illustrent une mise en page.</figcaption>
  </figure>;
}

export function KqBrandDirection({ data, online, busy, onAsk, onChooseTrack }: Props) {
  const id = useId();
  const [draft, setDraft] = useState<KqStudioStyle | null>(null);
  const [selection, setSelection] = useState("");
  const choices = useRef<Array<HTMLButtonElement | null>>([]);
  const supported = online.studio?.version === 1
    && typeof online.upgrades?.photography === "boolean" && typeof online.upgrades?.branding === "boolean"
    && KQ_STUDIO_STYLES.some(item => item.code === online.studio?.style)
    && KQ_STUDIO_TRACKS.every(item => {
      const level = online.studio?.levels?.[item.code];
      return Number.isSafeInteger(level) && level! >= 0 && level! <= 3;
    });
  const current = supported ? getKqStudioStyle(online) : null;
  const selected = draft ?? current ?? "craft";
  const levels = supported ? getKqStudioLevels(online) : { photography: 0, branding: 0, editorial: 0 };
  const enabled = supported && data.computerOwned === true && Boolean(online.site?.createdAt) && (levels.branding >= 1 || levels.editorial >= 1);
  const candidate: KqOnlineSnapshot = { ...online, studio: { version: 1, levels, style: selected } };
  const direction = KQ_STUDIO_STYLES.find(item => item.code === selected)!;
  const comparison = supported ? compareKqStudioOffers(data, candidate) : null;
  const offers = comparison?.offers ?? [];
  const offer = offers.find(item => item.id === selection) ?? offers[0];

  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % KQ_STUDIO_STYLES.length
      : event.key === "ArrowLeft" ? (index + KQ_STUDIO_STYLES.length - 1) % KQ_STUDIO_STYLES.length
        : event.key === "Home" ? 0 : event.key === "End" ? KQ_STUDIO_STYLES.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    setDraft(KQ_STUDIO_STYLES[next].code);
    choices.current[next]?.focus();
  }

  function apply() {
    if (busy || !enabled || selected === current) return;
    onAsk(`Adopter la direction ${kqStudioStyleLabels[selected]}`, `${direction.description} Changement gratuit appliqué à toute la boutique. ${levels.editorial > 0 ? "Les produits qui correspondent au ton choisi gagnent en conversion, les autres en perdent : les stocks et prix restent identiques." : "Pour l’instant, seule la présentation change ; Fiches & récits débloquera les effets sur la conversion."} Aucun visiteur ni point de qualité n’est ajouté.`, { action: "online", command: "choose-studio-style", payload: { style: selected } }, 0);
  }

  return <section className={styles.direction} aria-label="Direction de la boutique">
    <details className={styles.details} data-studio-direction-details>
      <summary><span className={styles.summaryTitle}>Direction de la boutique</span><span className={styles.summaryState}>{current ? `${kqStudioStyleLabels[current]} appliquée` : "Direction actuelle indisponible"}<small>Changement gratuit</small></span></summary>
      <div className={styles.content}>
        <div className={styles.styleChoices} role="group" aria-label="Explorer les directions de marque">
          {KQ_STUDIO_STYLES.map((item, index) => <button type="button" key={item.code} ref={node => { choices.current[index] = node; }} data-studio-style={item.code} data-direction={item.code} aria-pressed={selected === item.code} onClick={() => setDraft(item.code)} onKeyDown={event => navigate(event, index)}>
            <span className={styles.swatches} aria-hidden="true"><i /><i /><i /></span><strong>{kqStudioStyleLabels[item.code]}</strong><small>{current === item.code ? <><Check size={13} aria-hidden="true" />Appliquée</> : selected === item.code ? "À l’étude" : "Comparer"}</small>
          </button>)}
        </div>
        <div className={styles.decision}>
          <h3>{direction.name}</h3><p>{direction.description}</p>
          {!supported ? <p className={styles.notice}>La direction actuelle et ses effets sont indisponibles dans cette partie. Le changement ne peut pas être appliqué.</p> : levels.editorial > 0 ? <div className={styles.effect}>
            <p>Effet de Fiches & récits · niveau {levels.editorial}</p>
            <dl><div><dt>Produit qui correspond</dt><dd>+{[0, 4, 8, 12][levels.editorial]} %</dd></div><div><dt>Autre produit</dt><dd>−{[0, 2, 4, 6][levels.editorial]} %</dd></div></dl>
            <p>Sur la conversion en vente. Les autres bonus restent acquis.</p>
          </div> : <p className={styles.notice}>Pour l’instant, seule l’apparence change. Fiches & récits débloque les bonus et les pénalités selon tes produits.</p>}
          <dl className={styles.fitRules}>
            <div><dt><Leaf size={16} aria-hidden="true" />Récoltes compatibles</dt><dd>{direction.flowerHint}</dd></div>
            <div><dt><Paintbrush size={16} aria-hidden="true" />Produits dérivés compatibles</dt><dd>{direction.merchHint}</dd></div>
          </dl>
          {comparison?.flowersUnavailable ? <p className={styles.notice}>Certaines estimations de récoltes sont indisponibles : des données manquent.</p> : null}
          {comparison?.merchUnavailable ? <p className={styles.notice}>Certaines estimations de produits dérivés sont indisponibles : des données manquent.</p> : null}
          {offer ? <div className={styles.offerComparison} data-studio-style-comparison data-before={offer.before} data-after={offer.after}>
            <label htmlFor={`${id}-offer`}>Comparer un produit en vente<select id={`${id}-offer`} value={offer.id} onChange={event => setSelection(event.target.value)}>{offers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <p>{offer.detail}<br />{offer.reference}</p>
            <KqBarChart title={`Cadence estimée · ${offer.unit}`} items={[{ label: "Direction actuelle", value: offer.before, displayValue: number(offer.before), tone: "ink" }, { label: `Avec ${kqStudioStyleLabels[selected]}`, value: offer.after, displayValue: number(offer.after), tone: offer.after < offer.before ? "red" : "teal" }]} />
            <p className={styles.match} data-match={offer.fit.matched}>{offer.fit.matched ? <Check size={16} aria-hidden="true" /> : <LockKeyhole size={16} aria-hidden="true" />}{offer.fit.matched ? "Ce produit correspond à cette direction." : "Ce produit ne correspond pas à cette direction."}</p>
          </div> : comparison && !comparison.merchUnavailable && !comparison.flowersUnavailable ? <p className={styles.notice}>Mets un produit en vente pour comparer la cadence sur ton offre réelle.</p> : null}
          <button type="button" className={styles.primary} data-studio-apply-style disabled={busy || !enabled || selected === current} onClick={apply}>{selected === current ? "Direction appliquée" : "Appliquer cette direction · gratuit"}<ArrowRight size={17} aria-hidden="true" /></button>
          {supported && !data.computerOwned ? <p className={styles.hint}>Un ordinateur est nécessaire pour changer la direction.</p> : supported && !online.site?.createdAt ? <p className={styles.hint}>Crée ta boutique dans Site pour changer sa direction.</p> : supported && levels.branding < 1 && levels.editorial < 1 ? <><p className={styles.hint}>Il faut Identité ou Fiches & récits au niveau 1.</p><button type="button" className={styles.secondary} onClick={() => onChooseTrack("branding")}>Débloquer l’identité de marque<ChevronRight size={17} aria-hidden="true" /></button></> : null}
          <p className={styles.hint}>Même audience, mêmes prix et stocks. Les prévisions ne garantissent aucune vente.</p>
        </div>
        {supported ? <details className={styles.previewDetails} data-studio-preview-details><summary>Voir la maquette · {kqStudioStyleLabels[selected]}</summary><DirectionPreview name={data.business?.shop?.name ?? "Ma boutique"} style={selected} online={online} /></details> : null}
      </div>
    </details>
  </section>;
}
