"use client";

import Image from "next/image";
import { BookOpen, Check, Search, X, ZoomIn } from "lucide-react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { KQ_CARDS, type KqSupportCard } from "@/lib/kanab-quest-game";
import { getKqCardArtwork } from "@/lib/kanab-quest-artwork";
import { getKqCardGuide, getKqCardRole, KQ_CARD_ROLES } from "@/lib/kanab-quest-card-guide";
import styles from "./KqBotteCollection.module.css";

const RARITIES = { common: "Commune", uncommon: "Peu commune", rare: "Rare", epic: "Épique" };
type Ownership = "all" | "owned" | "missing";

function useCardDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  useBodyScrollLock(true);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      dialog?.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return ref;
}

function clickedBackdrop(event: MouseEvent<HTMLDialogElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  return event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom);
}

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
        <section className={styles.effect}><h3>Ce qu’elle t’apporte</h3><p>{guide.benefit}</p></section>
        <section className={styles.limit}><h3>Sa limite</h3><p>{guide.risk}</p></section>
        <p className={styles.consumable}>Une carte jouée consomme un exemplaire. Les cartes conservées restent dans ta collection.</p>
        <button type="button" className={styles.return} onClick={onClose}>Revenir aux cartes</button>
      </section>
    </div>
  </dialog>, document.body);
}

export function KqBotteCollection({ onClose }: { onClose: () => void }) {
  const dialog = useCardDialog();
  const request = useRef<AbortController | null>(null);
  const [inventory, setInventory] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [ownership, setOwnership] = useState<Ownership>("all");
  const [utility, setUtility] = useState("all");
  const [selected, setSelected] = useState<KqSupportCard | null>(null);
  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/arena/placard/collection", { cache: "no-store", signal: controller.signal });
      const payload = await response.json() as { error?: string; collection?: { cards?: Array<{ code: string; ownedCopies: number }> } };
      if (!response.ok) throw new Error(response.status === 401 ? "Connecte-toi pour retrouver ta collection La Botte." : payload.error || "Impossible de charger ta collection.");
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
    const search = `${card.name} ${card.code} ${role.label} ${getKqCardGuide(card).scope}`.toLocaleLowerCase("fr-FR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return (ownership === "all" || (ownership === "owned" ? count > 0 : count === 0)) && (utility === "all" || role.key === utility) && (!normalized || search.includes(normalized));
  });
  if (typeof document === "undefined") return null;
  return createPortal(<>
    <dialog ref={dialog} className={styles.collectionDialog} aria-labelledby="botte-collection-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }} onClick={(event) => { if (clickedBackdrop(event)) onClose(); }}>
      <div className={styles.albumLayout}>
        <header className={styles.header}><div><small><BookOpen size={16} aria-hidden="true" /> Ton album du Placard</small><h2 id="botte-collection-title">Ma collection La Botte</h2><p>Tes cartes, tes doublons et celles qu’il te manque.</p></div><button type="button" className={styles.close} onClick={onClose} aria-label="Fermer la collection"><X aria-hidden="true" /></button></header>
        <section className={styles.progress} aria-label="État de ta collection"><div><strong>{inventory ? `${owned} / ${KQ_CARDS.length}` : "…"}</strong><span>cartes différentes en stock</span></div><progress value={inventory ? owned : 0} max={KQ_CARDS.length} aria-label="Cartes différentes possédées" /><div><strong>{inventory ? copies : "…"}</strong><span>exemplaires disponibles</span></div></section>
        <div className={styles.filters}>
          <nav aria-label="Afficher les cartes"><button type="button" aria-pressed={ownership === "all"} onClick={() => setOwnership("all")}>Toutes <b>{KQ_CARDS.length}</b></button><button type="button" aria-pressed={ownership === "owned"} disabled={!inventory} onClick={() => setOwnership("owned")}>Possédées <b>{inventory ? owned : "…"}</b></button><button type="button" aria-pressed={ownership === "missing"} disabled={!inventory} onClick={() => setOwnership("missing")}>Manquantes <b>{inventory ? KQ_CARDS.length - owned : "…"}</b></button></nav>
          <div><label className={styles.search}><Search size={17} aria-hidden="true" /><input aria-label="Rechercher une carte" placeholder="Nom, situation…" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className={styles.utility}><span>Utilité</span><select aria-label="Filtrer par utilité" value={utility} onChange={(event) => setUtility(event.target.value)}><option value="all">Toutes</option>{Object.entries(KQ_CARD_ROLES).map(([key, role]) => <option key={key} value={key}>{role.label}</option>)}</select></label></div>
        </div>
        <div className={styles.cardsArea} aria-busy={loading}>
          {loading ? <p role="status" className={styles.notice}>{inventory ? "Actualisation de tes cartes…" : "Ouverture de ton album…"}</p> : null}
          {error ? <div role="alert" className={styles.error}><p>{error}</p><button type="button" onClick={() => void refresh()}>Réessayer</button></div> : null}
          {inventory ? <><p className={styles.hint}><ZoomIn size={16} aria-hidden="true" /> Clique sur une carte pour l’agrandir, même si elle te manque.</p><div className={styles.grid}>{visible.map((card) => {
            const count = inventory[card.code] ?? 0, role = getKqCardRole(card), artwork = getKqCardArtwork(card.code);
            return <button type="button" key={card.code} className={styles.card} data-owned={count > 0} style={{ "--card-role": role.color } as CSSProperties} onClick={() => setSelected(card)} aria-label={`Voir ${card.name} : ${count > 0 ? `${count} exemplaire(s)` : "manquante"}`} aria-haspopup="dialog">
              <span className={styles.thumbnail}>{artwork ? <Image src={artwork} alt="" width={1024} height={1536} sizes="(max-width: 480px) 42vw, (max-width: 800px) 28vw, 210px" /> : null}</span>
              <span className={styles.cardInfo}><strong>{card.name}</strong><small>{role.label} · {card.xpCost} XP</small><b>{count > 0 ? <><Check size={14} aria-hidden="true" /> ×{count} en stock</> : "À trouver"}<ZoomIn size={15} aria-hidden="true" /></b></span>
            </button>;
          })}</div>{visible.length === 0 ? <p className={styles.empty}>{ownership === "missing" && owned === KQ_CARDS.length ? "Tu possèdes toutes les cartes La Botte !" : "Aucune carte ne correspond à ces filtres."}<button type="button" onClick={() => { setOwnership("all"); setUtility("all"); setQuery(""); }}>Voir toutes les cartes</button></p> : null}</> : null}
        </div>
        <footer className={styles.footer}>La Botte contient des cartes consommables : ton stock diminue quand tu les joues.</footer>
      </div>
    </dialog>
    {selected ? <KqBotteCardDetail card={selected} copies={inventory ? inventory[selected.code] ?? 0 : null} onClose={() => setSelected(null)} /> : null}
  </>, document.body);
}
