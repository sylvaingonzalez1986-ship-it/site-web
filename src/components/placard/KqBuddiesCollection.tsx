"use client";

import { Check, Search, ShoppingBag, X, ZoomIn } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { BuddieCard } from "@/components/lottery/BuddieCard";
import { KQ_BUDDIES } from "@/lib/kanab-quest-game";
import { getKqBuddieCultivationProfile } from "@/lib/kanab-quest-buddie-cultivation";
import { rarityAccentColor, rarityLabels, RARITY_ORDER } from "@/lib/lottery-card-ui";
import type { LotteryCollectionAlbum, LotteryCollectionCardSlot } from "@/types/lottery";
import { KqBuddieFlavors } from "./KqBuddieFlavors";
import { clickedCollectionBackdrop, useKqCollectionDialog } from "./KqCollectionDialog";
import styles from "./KqBotteCollection.module.css";

type Ownership = "owned" | "all" | "duplicates" | "missing";
const catalog = new Map(KQ_BUDDIES.map(buddie => [buddie.code, buddie]));
const archetypes = { yield: "Rendement", balanced: "Équilibre", expression: "Expression" };
const normalize = (value: string) => value.toLocaleLowerCase("fr-FR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

function BuddieDetail({ slot, onClose }: { slot: LotteryCollectionCardSlot; onClose: () => void }) {
  const dialog = useKqCollectionDialog(onClose);
  const owned = slot.ownedCount > 0;
  const profile = owned ? getKqBuddieCultivationProfile(slot.code) : null;
  const buddie = catalog.get(slot.code);
  return createPortal(<dialog ref={dialog} className={styles.detailDialog} data-buddie-collection-detail={slot.code} aria-labelledby="buddie-collection-detail-title" style={{ "--card-role": rarityAccentColor[slot.rarity] } as CSSProperties}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }} onKeyDown={event => { if (event.key === "Escape") event.stopPropagation(); }} onClick={event => { if (clickedCollectionBackdrop(event)) onClose(); }}>
    <button type="button" className={styles.close} aria-label="Fermer le Buddie agrandi" onClick={onClose}><X aria-hidden="true" /></button>
    <div className={styles.detailLayout}>
      <div className={`${styles.enlargedCard} ${styles.buddieEnlarged}`}><BuddieCard code={slot.code} name={slot.name} rarity={slot.rarity} cardNumber={slot.cardNumber} imageUrl={slot.imageUrl} hidden={!owned} sizes="(max-width: 700px) 85vw, 440px" priority /></div>
      <section className={styles.detailCopy}>
        <span className={styles.role}>Buddie n°{slot.cardNumber} · {rarityLabels[slot.rarity]}</span>
        <h2 id="buddie-collection-detail-title">{owned ? slot.name : "Un Buddie à découvrir"}</h2>
        <p className={styles.detailStock}>{owned ? `${slot.ownedCount} exemplaire${slot.ownedCount > 1 ? "s" : ""} · ${Math.max(0, slot.ownedCount - 1)} doublon${slot.ownedCount > 2 ? "s" : ""}` : "Ce Buddie manque encore à ton album."}</p>
        {owned ? <>
          {slot.description ? <p className={styles.buddieDescription}>{slot.description}</p> : null}
          {buddie ? <section className={styles.effect}><h3>Dans Kanab Quest</h3><p>{buddie.ability}</p></section> : null}
          <KqBuddieFlavors varietyCode={slot.code} />
          {profile ? <section className={styles.buddieProfile} data-buddie-collection-profile={slot.code}><h3>Profil de jeu · {archetypes[profile.archetype]}</h3>
            <dl className={styles.facts}><div><dt>Coefficient de récolte</dt><dd>×{number(profile.yieldFactor)}</dd></div><div><dt>CBD potentiel</dt><dd>{number(profile.cannabinoidTargets.cbd)} %</dd></div><div><dt>Terpènes potentiels</dt><dd>{number(profile.terpenePotentialPercent)} %</dd></div><div><dt>Notes aromatiques</dt><dd>{profile.terpeneNotes.join(" · ")}</dd></div></dl>
            <p className={styles.consumable}>Valeurs fictives de simulation. La partie et l’installation déterminent le résultat final.</p>
          </section> : null}
          {slot.burnableCount > 0 ? <p className={styles.consumable}>{slot.burnableCount} exemplaire{slot.burnableCount > 1 ? "s" : ""} recyclable{slot.burnableCount > 1 ? "s" : ""} dans ton album de compte.</p> : null}
        </> : <p className={styles.buddieDescription}>Son identité et son profil se dévoileront quand tu l’auras obtenu.</p>}
        <button type="button" className={styles.return} onClick={onClose}>Revenir aux Buddies</button>
      </section>
    </div>
  </dialog>, document.body);
}

export function KqBuddiesCollection({ active, onOpenShop }: { active: boolean; onOpenShop?: () => void }) {
  const request = useRef<AbortController | null>(null);
  const loaded = useRef(false);
  const [slots, setSlots] = useState<LotteryCollectionCardSlot[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ownership, setOwnership] = useState<Ownership>("owned");
  const [rarity, setRarity] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/account/collection", { cache: "no-store", signal: controller.signal });
      const payload = await response.json() as LotteryCollectionAlbum & { error?: string };
      if (!response.ok) throw new Error(response.status === 401 ? "Connecte-toi pour retrouver tes Buddies." : payload.error || "Impossible de charger ton album Buddies.");
      if (!Array.isArray(payload.pages) || !payload.pages.every(page => Array.isArray(page.slots))) throw new Error("Les informations de ton album Buddies sont indisponibles.");
      const cards = payload.pages.flatMap(page => page.slots).filter(slot => catalog.has(slot.code));
      if (cards.some(slot => !Number.isInteger(slot.ownedCount) || slot.ownedCount < 0 || !Number.isInteger(slot.burnableCount) || slot.burnableCount < 0 || !(slot.rarity in rarityLabels))
        || new Set(cards.map(slot => slot.code)).size !== cards.length) throw new Error("Le stock de ton album Buddies est indisponible.");
      if (!controller.signal.aborted) { loaded.current = true; setSlots(cards.sort((a, b) => a.cardNumber - b.cardNumber)); }
    } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Album Buddies indisponible."); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    if (active && !loaded.current) void refresh();
  }, [active, refresh]);
  useEffect(() => {
    const updated = () => { loaded.current = false; if (active) void refresh(); };
    window.addEventListener("kq:collection-updated", updated);
    window.addEventListener("welcome-pack-claimed", updated);
    return () => { window.removeEventListener("kq:collection-updated", updated); window.removeEventListener("welcome-pack-claimed", updated); };
  }, [active, refresh]);
  useEffect(() => () => request.current?.abort(), []);

  const cards = slots ?? [];
  const owned = cards.filter(slot => slot.ownedCount > 0).length;
  const duplicates = cards.reduce((sum, slot) => sum + Math.max(0, slot.ownedCount - 1), 0);
  const duplicateCards = cards.filter(slot => slot.ownedCount > 1).length;
  const visible = cards.filter(slot => {
    const search = normalize(`${slot.cardNumber} ${slot.code} ${slot.ownedCount > 0 ? slot.name : "Buddie manquant"} ${rarityLabels[slot.rarity]}`);
    return (ownership === "all" || (ownership === "owned" ? slot.ownedCount > 0 : ownership === "duplicates" ? slot.ownedCount > 1 : slot.ownedCount === 0))
      && (rarity === "all" || slot.rarity === rarity) && (!query.trim() || search.includes(normalize(query.trim())));
  });
  const detail = cards.find(slot => slot.code === selected);
  return <div className={styles.albumPanel} hidden={!active} role="tabpanel" id="collection-panel-buddies" aria-labelledby="collection-tab-buddies" data-collection-panel="buddies">
    <section className={styles.progress} aria-label="État de tes Buddies"><div><strong>{slots ? `${owned} / ${cards.length}` : "…"}</strong><span>Buddies différents</span></div><progress value={owned} max={cards.length || 1} aria-label="Buddies différents possédés" /><div><strong>{slots ? duplicates : "…"}</strong><span>exemplaires en double</span></div></section>
    <div className={styles.filters}>
      <nav className={styles.buddieFilters} aria-label="Afficher les Buddies">{([
        ["owned", "Mes Buddies", owned], ["all", "Album complet", cards.length], ["duplicates", "Doublons", duplicateCards], ["missing", "Manquants", cards.length - owned],
      ] as const).map(([key, label, count]) => <button type="button" key={key} disabled={!slots} data-buddie-collection-filter={key} aria-pressed={ownership === key} onClick={() => setOwnership(key)}>{label}<b>{slots ? count : "…"}</b></button>)}</nav>
      <div><label className={styles.search}><Search size={17} aria-hidden="true" /><input aria-label="Rechercher un Buddie" placeholder="Nom, numéro…" value={query} onChange={event => setQuery(event.target.value)} /></label><label className={styles.utility}><span>Rareté</span><select aria-label="Filtrer les Buddies par rareté" value={rarity} onChange={event => setRarity(event.target.value)}><option value="all">Toutes les raretés</option>{RARITY_ORDER.map(key => <option key={key} value={key}>{rarityLabels[key]}</option>)}</select></label></div>
    </div>
    <div className={styles.cardsArea} aria-busy={loading}>
      {loading ? <p role="status" className={styles.notice}>Ouverture de ton album Buddies…</p> : null}
      {error ? <div role="alert" className={styles.error}><p>{error}</p><button type="button" onClick={() => void refresh()}>Réessayer</button></div> : null}
      {slots ? <><p className={styles.hint}><ZoomIn size={16} aria-hidden="true" /> Ouvre un Buddie pour voir sa carte et son profil de jeu.</p><div className={styles.grid}>{visible.map(slot => <button key={slot.code} type="button" className={styles.card} data-buddie-collection-card={slot.code} data-owned={slot.ownedCount > 0} data-rarity={slot.rarity} aria-haspopup="dialog" aria-label={slot.ownedCount > 0 ? `Voir ${slot.name}, ${rarityLabels[slot.rarity]}, ${slot.ownedCount} exemplaires` : `Voir le Buddie manquant n°${slot.cardNumber}, ${rarityLabels[slot.rarity]}`} onClick={() => setSelected(slot.code)} style={{ "--card-role": rarityAccentColor[slot.rarity] } as CSSProperties}>
        <span className={styles.buddieThumbnail}><BuddieCard code={slot.code} name={slot.name} rarity={slot.rarity} cardNumber={slot.cardNumber} imageUrl={slot.imageUrl} hidden={slot.ownedCount === 0} sizes="(max-width: 480px) 42vw, (max-width: 800px) 28vw, 210px" /></span>
        <span className={styles.cardInfo}><strong>{slot.ownedCount > 0 ? slot.name : `Buddie n°${slot.cardNumber}`}</strong><span className={styles.rarity} data-rarity={slot.rarity}>{rarityLabels[slot.rarity]}</span><b>{slot.ownedCount > 0 ? <><Check size={14} aria-hidden="true" /> ×{slot.ownedCount} possédé{slot.ownedCount > 1 ? "s" : ""}</> : "À découvrir"}<ZoomIn size={15} aria-hidden="true" /></b></span>
      </button>)}</div>{visible.length === 0 ? <div className={styles.empty}>{cards.length === 0 ? "Aucune carte Buddies n’est publiée dans cet album pour le moment." : ownership === "owned" && owned === 0 ? "Tes premiers Buddies t’attendent dans les boosters." : ownership === "duplicates" && duplicateCards === 0 ? "Tu n’as pas encore de Buddie en double." : "Aucun Buddie ne correspond à ces filtres."}<button type="button" onClick={() => { setOwnership("all"); setRarity("all"); setQuery(""); }}>Voir tous les Buddies</button></div> : null}</> : null}
    </div>
    <footer className={styles.footer}><span>Tes Buddies de collection restent dans ton album quand tu les utilises dans Kanab Quest.</span>{onOpenShop ? <button type="button" className={styles.shopLink} onClick={onOpenShop}><ShoppingBag size={18} aria-hidden="true" /><span>La Boutique<small>Boosters Buddies</small></span></button> : null}</footer>
    {active && detail ? <BuddieDetail slot={detail} onClose={() => setSelected(null)} /> : null}
  </div>;
}
