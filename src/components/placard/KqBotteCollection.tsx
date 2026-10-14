"use client";

import Image from "next/image";
import { BookOpen, Check, Leaf, Search, ShoppingBag, X, ZoomIn } from "lucide-react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { KQ_ACTIVE_CARDS as KQ_CARDS, type KqSupportCard } from "@/lib/kanab-quest-game";
import { getKqCardArtwork } from "@/lib/kanab-quest-artwork";
import { getKqCardGuide, getKqCardRole, KQ_CARD_ROLES, KQ_CARD_RARITY_LABELS } from "@/lib/kanab-quest-card-guide";
import { useKqCollectionDialog as useCardDialog, clickedCollectionBackdrop as clickedBackdrop } from "./KqCollectionDialog";
import { KqBuddiesCollection } from "./KqBuddiesCollection";
import styles from "./KqBotteCollection.module.css";

const RARITIES = KQ_CARD_RARITY_LABELS;
type Ownership = "all" | "owned" | "missing";

export function KqBotteCardDetail({ card, copies, onClose }: { card: KqSupportCard; copies: number | null; onClose: () => void }) {
  const dialog = useCardDialog();
  const guide = getKqCardGuide(card), role = getKqCardRole(card);
  const artwork = getKqCardArtwork(card.code);
  if (typeof document === "undefined") return null;
  return createPortal(<dialog ref={dialog} className={styles.detailDialog} aria-labelledby="botte-detail-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }} onClick={(event) => { if (clickedBackdrop(event)) onClose(); }} style={{ "--card-role": role.color } as CSSProperties}>
    <button type="button" className={styles.close} onClick={onClose} aria-label="Fermer la carte agrandie"><X aria-hidden="true" /></button>
    <div className={styles.detailLayout}>
      <div className={styles.enlargedCard}>{artwork ? <Image src={artwork} alt={`Carte ${card.name} agrandie`} width={1024} height={1536} sizes="(max-width: 700px) 85vw, 480px" priority /> : null}</div>
      <section className={styles.detailCopy}>
        <span className={styles.role}>{role.label}</span>
        <h2 id="botte-detail-title">{card.name}</h2>
        <p className={styles.detailStock}>{copies === null ? "Stock indisponible" : copies > 0 ? `${copies} exemplaire${copies > 1 ? "s" : ""} en stock` : "Cette carte te manque"}</p>
        <dl className={styles.facts}><div><dt>Rareté</dt><dd>{RARITIES[card.rarity]}</dd></div><div><dt>Coût</dt><dd>{card.xpCost} XP</dd></div><div><dt>Quand la jouer</dt><dd>{guide.timing}</dd></div><div><dt>Situations</dt><dd>{guide.scope}</dd></div></dl>
        {guide.examples.length ? <section className={styles.examples}><h3>Elle répond à ces problèmes</h3><ul>{guide.examples.map(name => <li key={name}>{name}</li>)}</ul></section> : null}
        <section className={styles.effect}><h3>Ce qu’elle t’apporte</h3><p>{guide.benefit}</p></section>
        <section className={styles.limit}><h3>Sa limite</h3><p>{guide.risk}</p></section>
        {card.rarity === "epic" ? <p className={styles.epicLimit}>Une seule carte épique peut être jouée par culture. Choisis le moment où son secours compte le plus.</p> : null}
        <p className={styles.consumable}>Une carte jouée consomme un exemplaire. Les cartes conservées restent dans ta collection.</p>
        <button type="button" className={styles.return} onClick={onClose}>Revenir aux cartes</button>
      </section>
    </div>
  </dialog>, document.body);
}

export type KqCollectionKind = "botte" | "buddies";

export function KqBotteCollection({ onClose, onOpenShop, initialSection = "botte" }: { onClose: () => void; onOpenShop?: (collection?: KqCollectionKind) => void; initialSection?: KqCollectionKind }) {
  const dialog = useCardDialog();
  const [album, setAlbum] = useState<KqCollectionKind>(initialSection);
  const request = useRef<AbortController | null>(null);
  const [inventory, setInventory] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [ownership, setOwnership] = useState<Ownership>("owned");
  const [utility, setUtility] = useState("all");
  const [rarity, setRarity] = useState("all");
  const [selected, setSelected] = useState<KqSupportCard | null>(null);
  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/arena/placard/collection", { cache: "no-store", signal: controller.signal });
      const payload = await response.json() as { error?: string; collection?: { cards?: Array<{ code: string; ownedCopies: number }> } };
      if (!response.ok) throw new Error(response.status === 401 ? "Connecte-toi pour retrouver ta collection Botte du Chanvrier." : payload.error || "Impossible de charger ta collection.");
      if (!Array.isArray(payload.collection?.cards)) throw new Error("Les informations de ta collection sont indisponibles.");
      const counts = Object.fromEntries(payload.collection.cards.map((card) => [card.code, Number.isFinite(card.ownedCopies) ? Math.max(0, Math.floor(card.ownedCopies)) : 0]));
      if (!controller.signal.aborted) setInventory(counts);
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Collection indisponible.");
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const updated = () => { void refresh(); };
    window.addEventListener("kq:collection-updated", updated);
    return () => { request.current?.abort(); window.removeEventListener("kq:collection-updated", updated); };
  }, [refresh]);

  const owned = KQ_CARDS.filter((card) => (inventory?.[card.code] ?? 0) > 0).length;
  const copies = KQ_CARDS.reduce((total, card) => total + (inventory?.[card.code] ?? 0), 0);
  const normalized = query.trim().toLocaleLowerCase("fr-FR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const visible = KQ_CARDS.filter((card) => {
    const count = inventory?.[card.code] ?? 0, role = getKqCardRole(card);
    const guide = getKqCardGuide(card);
    const search = `${card.name} ${card.code} ${role.label} ${guide.scope} ${guide.examples.join(" ")} ${RARITIES[card.rarity]}`.toLocaleLowerCase("fr-FR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return (ownership === "all" || (ownership === "owned" ? count > 0 : count === 0)) && (utility === "all" || role.key === utility) && (rarity === "all" || rarity === card.rarity) && (!normalized || search.includes(normalized));
  });
  if (typeof document === "undefined") return null;
  return createPortal(<>
    <dialog ref={dialog} className={styles.collectionDialog} data-placard-collections aria-labelledby="botte-collection-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }} onClick={(event) => { if (clickedBackdrop(event)) onClose(); }}>
      <div className={styles.albumLayout}>
        <header className={styles.header}><div><small><BookOpen size={16} aria-hidden="true" /> Les albums du quartier</small><h2 id="botte-collection-title">Collections</h2><p>Tes cartes, tes Buddies et tes prochaines découvertes.</p></div><button type="button" className={styles.close} onClick={onClose} aria-label="Fermer la collection"><X aria-hidden="true" /></button></header>
        <div className={styles.albumTabs} role="tablist" aria-label="Choisir une collection">
          {(["botte", "buddies"] as const).map(kind => <button key={kind} type="button" role="tab" id={`collection-tab-${kind}`} data-collection-tab={kind} aria-selected={album === kind} aria-controls={`collection-panel-${kind}`} tabIndex={album === kind ? 0 : -1} onClick={() => setAlbum(kind)} onKeyDown={event => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === "Home" ? "botte" : event.key === "End" ? "buddies" : kind === "botte" ? "buddies" : "botte";
            setAlbum(next);
            event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-collection-tab="${next}"]`)?.focus();
          }}>{kind === "botte" ? <BookOpen size={18} aria-hidden="true" /> : <Leaf size={18} aria-hidden="true" />}{kind === "botte" ? "Botte du Chanvrier" : "Buddies"}</button>)}
        </div>
        <div className={styles.albumPanel} hidden={album !== "botte"} role="tabpanel" id="collection-panel-botte" aria-labelledby="collection-tab-botte" data-collection-panel="botte">
        <section className={styles.progress} aria-label="État de ta collection"><div><strong>{inventory ? `${owned} / ${KQ_CARDS.length}` : "…"}</strong><span>cartes différentes en stock</span></div><progress value={inventory ? owned : 0} max={KQ_CARDS.length} aria-label="Cartes différentes possédées" /><div><strong>{inventory ? copies : "…"}</strong><span>exemplaires disponibles</span></div></section>
        <div className={styles.filters}>
          <nav aria-label="Afficher les cartes"><button type="button" aria-pressed={ownership === "owned"} disabled={!inventory} onClick={() => setOwnership("owned")}>Mes cartes <b>{inventory ? owned : "…"}</b></button><button type="button" aria-pressed={ownership === "all"} onClick={() => setOwnership("all")}>Album complet <b>{KQ_CARDS.length}</b></button><button type="button" aria-pressed={ownership === "missing"} disabled={!inventory} onClick={() => setOwnership("missing")}>Manquantes <b>{inventory ? KQ_CARDS.length - owned : "…"}</b></button></nav>
          <div><label className={styles.search}><Search size={17} aria-hidden="true" /><input aria-label="Rechercher une carte" placeholder="Nom, situation…" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className={styles.utility}><span>Utilité</span><select aria-label="Filtrer par utilité" value={utility} onChange={(event) => setUtility(event.target.value)}><option value="all">Toutes les utilités</option>{Object.entries(KQ_CARD_ROLES).map(([key, role]) => <option key={key} value={key}>{role.label}</option>)}</select></label><label className={styles.utility}><span>Rareté</span><select aria-label="Filtrer par rareté" value={rarity} onChange={(event) => setRarity(event.target.value)}><option value="all">Toutes les raretés</option>{Object.entries(RARITIES).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label></div>
        </div>
        <div className={styles.cardsArea} aria-busy={loading}>
          {loading ? <p role="status" className={styles.notice}>{inventory ? "Actualisation de tes cartes…" : "Ouverture de ton album…"}</p> : null}
          {error ? <div role="alert" className={styles.error}><p>{error}</p><button type="button" onClick={() => void refresh()}>Réessayer</button></div> : null}
          {inventory ? <><p className={styles.hint}><ZoomIn size={16} aria-hidden="true" /> Clique sur une carte pour l’agrandir, même si elle te manque.</p><div className={styles.grid}>{visible.map((card) => {
            const count = inventory[card.code] ?? 0, role = getKqCardRole(card), artwork = getKqCardArtwork(card.code);
            return <button type="button" key={card.code} className={styles.card} data-owned={count > 0} data-rarity={card.rarity} data-card-code={card.code} style={{ "--card-role": role.color } as CSSProperties} onClick={() => setSelected(card)} aria-label={`Voir ${card.name}, ${RARITIES[card.rarity]} : ${count > 0 ? `${count} exemplaire(s)` : "manquante"}`} aria-haspopup="dialog">
              <span className={styles.thumbnail}>{artwork ? <Image src={artwork} alt="" width={1024} height={1536} sizes="(max-width: 480px) 42vw, (max-width: 800px) 28vw, 210px" /> : null}</span>
              <span className={styles.cardInfo}><strong>{card.name}</strong><span className={styles.rarity} data-rarity={card.rarity}>{RARITIES[card.rarity]}</span><small>{role.label} · {card.xpCost} XP</small><b>{count > 0 ? <><Check size={14} aria-hidden="true" /> ×{count} en stock</> : "À trouver"}<ZoomIn size={15} aria-hidden="true" /></b></span>
            </button>;
          })}</div>{visible.length === 0 ? <p className={styles.empty}>{ownership === "owned" && owned === 0 ? "Tu n’as pas encore de carte en stock. Gagne des packs avec tes objectifs ou retrouve-les dans la boutique." : ownership === "missing" && owned === KQ_CARDS.length ? "Tu possèdes toutes les cartes Botte du Chanvrier !" : "Aucune carte ne correspond à ces filtres."}<button type="button" onClick={() => { setOwnership("all"); setUtility("all"); setRarity("all"); setQuery(""); }}>Voir l’album complet</button></p> : null}</> : null}
        </div>
        <footer className={styles.footer}><span>Une carte jouée consomme un exemplaire. Les cartes conservées restent dans ta collection.</span>{onOpenShop ? <button type="button" className={styles.shopLink} onClick={() => onOpenShop("botte")}><ShoppingBag size={18} aria-hidden="true" /><span>La Boutique <small>Packs et nouvelles cartes</small></span></button> : null}</footer>
        </div>
        <KqBuddiesCollection active={album === "buddies"} onOpenShop={onOpenShop ? () => onOpenShop("buddies") : undefined} />
      </div>
    </dialog>
    {selected ? <KqBotteCardDetail card={selected} copies={inventory ? inventory[selected.code] ?? 0 : null} onClose={() => setSelected(null)} /> : null}
  </>, document.body);
}
