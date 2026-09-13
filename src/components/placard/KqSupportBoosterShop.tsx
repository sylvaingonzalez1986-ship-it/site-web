"use client";

import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

import Image from "next/image";
import { BookOpen, Flame, PackageOpen, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getKqCardArtwork } from "@/lib/kanab-quest-artwork";
import { openKqSupportBooster } from "@/lib/kanab-quest-booster";
import { createClientRequestKey } from "@/lib/client-request-key";
import { KqEquipmentCatalogModal } from "./KqEquipmentCatalogModal";
import styles from "./KqSupportBoosterShop.module.css";

type ShopPayload = {
  collectionActive: boolean;
  costPerPack: number;
  spendablePoints: number;
  availableEntitlements: Array<{ id: string; source: string; cardCount: number; createdAt: string }>;
  welcomeClaimed: boolean;
};

type OpenedCard = { code: string; name: string; rarity: string; imageUrl?: string };
type ShopEntitlement = ShopPayload["availableEntitlements"][number];

export function splitShopEntitlements(entitlements: ShopEntitlement[]) {
  return {
    duelRewards: entitlements.filter((entitlement) => entitlement.source === "pvp_win"),
    shopPacks: entitlements.filter((entitlement) => entitlement.source !== "pvp_win"),
  };
}

export function KqSupportBoosterShop({
  autoOpen = false,
  autoOpenEquipment = false,
  initialEquipmentCode = null,
  onExit,
  onOpenCollection,
  autoClaimWelcome = true,
  onOpenWorkshop,
}: {
  autoOpen?: boolean;
  autoOpenEquipment?: boolean;
  initialEquipmentCode?: string | null;
  onExit?: () => void;
  onOpenCollection?: () => void;
  autoClaimWelcome?: boolean;
  onOpenWorkshop?: (equipmentCode?:string)=>void;
} = {}) {
  const dialogRef = useRef<HTMLElement>(null);
  const actionLock = useRef(false);
  const [shop, setShop] = useState<ShopPayload | null>(null);
  const [openedCards, setOpenedCards] = useState<OpenedCard[]>([]);
  const [pending, setPending] = useState<"load" | "claim" | "buy" | "open" | null>("load");
  const [notice, setNotice] = useState("");
  const [localPreview, setLocalPreview] = useState(false);
  const [welcomeChecked, setWelcomeChecked] = useState(false);
  const [shopOpen, setShopOpen] = useState(autoOpen);
  const [equipmentCatalogOpen, setEquipmentCatalogOpen] = useState(autoOpenEquipment);

  const closeShop = useCallback(() => {
    setOpenedCards([]);
    setNotice("");
    setEquipmentCatalogOpen(false);
    setShopOpen(false);
    onExit?.();
  }, [onExit]);

  useBodyScrollLock(shopOpen);

  useEffect(() => {
    if (!shopOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (equipmentCatalogOpen) setEquipmentCatalogOpen(false);
      else if (openedCards.length > 0) setOpenedCards([]);
      else closeShop();
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [closeShop, equipmentCatalogOpen, openedCards.length, shopOpen]);

  useEffect(() => {
    if (!shopOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => previous?.focus();
  }, [shopOpen]);

  useEffect(() => {
    if (!openedCards.length) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLButtonElement>('[aria-label="Fermer le pack ouvert"]')?.focus();
    return () => { requestAnimationFrame(() => previous?.focus()); };
  }, [openedCards.length]);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/arena/placard/boosters", { cache: "no-store" });
    const payload = await response.json() as ShopPayload & { error?: string };
    if (!response.ok) throw new Error(payload.error || "Boutique La Botte indisponible.");
    setShop(payload);
  }, []);

  useEffect(() => {
    setLocalPreview(["localhost", "127.0.0.1"].includes(window.location.hostname));
    const handleBoosterUpdate = () => void refresh().catch(() => setNotice("Impossible d’actualiser les packs. Réessaie dans un instant."));
    window.addEventListener("kq:boosters-updated", handleBoosterUpdate);
    refresh()
      .catch((error: unknown) => setNotice(error instanceof Error ? error.message : "Boutique indisponible."))
      .finally(() => setPending(null));
    return () => window.removeEventListener("kq:boosters-updated", handleBoosterUpdate);
  }, [refresh]);

  const purchase = async () => {
    if (actionLock.current) return;
    actionLock.current = true;
    setPending("buy");
    setNotice("");
    try {
      const response = await fetch("/api/arena/placard/boosters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packCount: 1, requestKey: createClientRequestKey() }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Achat impossible.");
      await refresh();
      setNotice("Booster La Botte ajouté. Tu peux maintenant l’ouvrir.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Achat impossible.");
    } finally {
      actionLock.current = false;
      setPending(null);
    }
  };

  const claimWelcome = async () => {
    if (actionLock.current) return;
    actionLock.current = true;
    setPending("claim");
    setNotice("");
    try {
      const response = await fetch("/api/arena/placard/boosters", { method: "PUT" });
      const payload = await response.json() as { claimed?: boolean; replayed?: boolean; error?: string };
      if (!response.ok) throw new Error(payload.error || "Réclamation impossible.");
      await refresh();
      setNotice(payload.claimed ? "Ton booster de bienvenue est prêt à être ouvert." : "Ton booster de bienvenue avait déjà été réclamé.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Réclamation impossible.");
    } finally {
      actionLock.current = false;
      setPending(null);
    }
  };

  useEffect(() => {
    if (!autoClaimWelcome || !shop || welcomeChecked || !shop.collectionActive || shop.welcomeClaimed) return;
    setWelcomeChecked(true);
    void claimWelcome();
    // The welcome grant is idempotent server-side and intentionally runs only once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop, welcomeChecked, autoClaimWelcome]);

  const openEntitlement = async (entitlement?: ShopEntitlement) => {
    if (!entitlement || actionLock.current) return;
    actionLock.current = true;
    setPending("open");
    setNotice("");
    try {
      const response = await fetch("/api/arena/placard/boosters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entitlementId: entitlement.id }),
      });
      const payload = await response.json() as { cards?: OpenedCard[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Ouverture impossible.");
      setOpenedCards(payload.cards ?? []);
      await refresh();
      window.dispatchEvent(new Event("kq:collection-updated"));
      setNotice(`${payload.cards?.length ?? entitlement.cardCount} cartes La Botte ont rejoint ta collection.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Ouverture impossible.");
    } finally {
      actionLock.current = false;
      setPending(null);
    }
  };

  const openPreview = () => {
    setOpenedCards(openKqSupportBooster(Date.now()).map((card) => ({
      code: card.code,
      name: card.name,
      rarity: card.rarity,
      imageUrl: getKqCardArtwork(card.code) ?? undefined,
    })));
    setNotice("Prévisualisation locale : aucun point débité et aucune carte enregistrée.");
  };

  const welcomeEntitlement = shop?.availableEntitlements.find((item) => item.source === "welcome_pack");
  const { duelRewards, shopPacks } = splitShopEntitlements(shop?.availableEntitlements ?? []);
  const nextDuelReward = duelRewards[0];
  const nextShopPack = welcomeEntitlement ?? shopPacks[0];

  return (
    <section id="boutique-la-botte" className="mx-auto mt-8 max-w-5xl">
      <button type="button" onClick={() => setShopOpen(true)} aria-haspopup="dialog" className="group relative block aspect-[3/2] w-full overflow-hidden border-2 border-ink bg-green text-left shadow-[6px_6px_0_#1a1a1a] transition-transform hover:-translate-y-1 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-green">
        <Image src="/placard/booster-shop-front-v2.webp" alt="Façade de la boutique La Botte" fill priority sizes="(max-width: 768px) 100vw, 1024px" className="object-cover transition-transform duration-500 group-hover:scale-[1.025]" />
        <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/90 via-black/55 to-transparent p-4 pt-16 text-white sm:p-6">
          <span><small className="block text-xs font-black uppercase tracking-[.16em] text-yellow">Boutique de l’Arène</small><strong className="mt-1 block font-display text-3xl uppercase sm:text-5xl">Entre dans La Botte</strong></span>
          <b className="shrink-0 border-2 border-white bg-green px-4 py-3 text-xs font-black uppercase shadow-[3px_3px_0_#fff]">Ouvrir la boutique</b>
        </span>
      </button>

      {shopOpen ? <div className={styles.backdrop} role="presentation" onClick={closeShop}>
        <section ref={dialogRef} data-arena-tour-surface="shop" data-arena-tour-blocked={openedCards.length>0||undefined} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="kq-shop-title" className={styles.shopDialog} data-equipment-open={equipmentCatalogOpen || undefined} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, [tabindex="0"]')).filter((node) => !node.closest('[inert]') && node.getClientRects().length > 0);
          const first = buttons[0], last = buttons.at(-1);
          if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && (document.activeElement === last || document.activeElement === event.currentTarget)) { event.preventDefault(); first?.focus(); }
        }}>
        <div className={styles.scene} inert={openedCards.length > 0 || equipmentCatalogOpen}>
          <picture>
            <source media="(max-width: 639px) and (orientation: portrait)" srcSet="/placard/booster-shop-counter-mobile-v1.webp" />
            <Image src="/placard/booster-shop-counter-v5.webp" alt="Sylvain au comptoir, avec les récompenses de duel, les boîtes de packs, la caisse et le livre du matériel." fill unoptimized priority sizes="(max-width: 768px) 100vw, 1152px" className={styles.interior} />
          </picture>
          <h2 id="kq-shop-title" className="sr-only">La Botte · Boutique de l’Arène</h2>
          <button type="button" aria-label="Quitter la boutique" onClick={closeShop} className={styles.exit}><X aria-hidden="true" /></button>
          {onOpenCollection ? <button type="button" className={styles.collectionButton} onClick={onOpenCollection} aria-haspopup="dialog"><BookOpen size={17} aria-hidden="true" /><span>Ma collection</span></button> : null}
          <div className={styles.wallet}><small>Ta cagnotte</small><b>{shop ? shop.spendablePoints.toLocaleString("fr-FR") : "…"}<span> points</span></b></div>
          <p className={styles.shopHint}>Touche un objet pour découvrir le rayon.</p>
          <button type="button" className={`${styles.hotspot} ${styles.duels}`} aria-label={nextDuelReward ? `Ouvrir un pack de duel, ${duelRewards.length} en attente` : "Aucun gain de duel à récupérer"} disabled={!shop?.collectionActive || pending !== null || !nextDuelReward} onClick={() => void openEntitlement(nextDuelReward)}>
            <span className={styles.objectOutline} aria-hidden="true" /><span className={styles.label}><strong>Gains de duel</strong><small>{duelRewards.length ? `${duelRewards.length} pack${duelRewards.length > 1 ? "s" : ""} à ouvrir` : "Gagne un duel"}</small></span>
          </button>
          <button type="button" className={`${styles.hotspot} ${styles.packs}`} aria-label={nextShopPack ? `Ouvrir un pack, ${shopPacks.length} disponible(s)` : "Aucun pack disponible"} disabled={!shop?.collectionActive || pending !== null || !nextShopPack} onClick={() => void openEntitlement(nextShopPack)}>
            <span className={styles.objectOutline} aria-hidden="true" /><span className={styles.label}><strong>Mes packs</strong><small>{pending === "open" ? "Ouverture…" : shopPacks.length ? `${shopPacks.length} à ouvrir · ${nextShopPack?.cardCount} cartes` : "Passe à la caisse"}</small></span>
          </button>
          <button type="button" className={`${styles.hotspot} ${styles.register}`} aria-label={`Acheter un booster pour ${shop?.costPerPack ?? 5} points`} disabled={!shop?.collectionActive || pending !== null || (shop?.spendablePoints ?? 0) < (shop?.costPerPack ?? 5)} onClick={() => void purchase()}>
            <span className={styles.objectOutline} aria-hidden="true" /><span className={styles.label}><strong>{pending === "buy" ? "Achat…" : "Acheter un pack"}</strong><small>{shop?.costPerPack ?? 5} points{shop && shop.spendablePoints < shop.costPerPack ? " · solde insuffisant" : " · 10 cartes"}</small></span>
          </button>
          <button type="button" data-arena-tour="equipment-book" className={`${styles.hotspot} ${styles.catalogBook}`} onClick={() => setEquipmentCatalogOpen(true)} aria-label="Ouvrir le rayon matériel" aria-haspopup="dialog">
            <span className={styles.objectOutline} aria-hidden="true" /><span className={styles.label}><strong>Le matériel</strong><small>Machines & installation →</small></span>
          </button>
          {!shop?.collectionActive && localPreview ? <button type="button" onClick={openPreview} className={styles.preview}><PackageOpen size={16} />Test local</button> : null}
          {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
          {!shop?.collectionActive && pending !== "load" && !notice ? <p className={styles.notice}><Flame size={16} />La vente de packs est momentanément fermée. Le matériel reste consultable.</p> : null}
        </div>
        {openedCards.length > 0 ? <div className="absolute inset-0 z-50 flex flex-col bg-[#081a14]/95 p-3 backdrop-blur-sm sm:p-6"><button type="button" aria-label="Fermer le pack ouvert" onClick={() => setOpenedCards([])} className="absolute right-3 top-3 z-10 grid h-11 w-11 place-items-center border-2 border-ink bg-white shadow-[3px_3px_0_#f4c43d]"><X /></button><header className="shrink-0 pr-14 text-center text-white"><small className="font-black uppercase tracking-[.14em] text-yellow">Pack débloqué</small><h3 className="font-display text-3xl uppercase sm:text-5xl">Tes nouvelles cartes</h3></header><div className="my-3 flex min-h-0 flex-1 items-center gap-2 overflow-x-auto px-1 pb-2 sm:gap-3">{openedCards.map((card, index) => { const src = getKqCardArtwork(card.code) ?? card.imageUrl; return <article key={`${card.code}-${index}`} className="w-28 shrink-0 border-2 border-[#d5a72d] bg-white p-1 shadow-[3px_3px_0_#d5a72d] sm:w-40">{src ? <div className="relative aspect-[2/3] overflow-hidden"><Image src={src} alt={card.name} fill sizes="160px" className="object-cover" /></div> : null}<small className="mt-1 block text-[9px] font-black uppercase text-green sm:text-xs">{card.rarity}</small><strong className="block text-[10px] sm:text-sm">{card.name}</strong></article>; })}</div><button type="button" onClick={() => { setOpenedCards([]); setNotice(""); }} className="mx-auto min-h-12 shrink-0 border-2 border-ink bg-yellow px-6 font-black uppercase shadow-[4px_4px_0_#fff]">Retour à la boutique</button></div> : null}
        {equipmentCatalogOpen ? <KqEquipmentCatalogModal initialEquipmentCode={initialEquipmentCode} onClose={() => setEquipmentCatalogOpen(false)} onOpenWorkshop={onOpenWorkshop}/> : null}
      </section></div> : null}
    </section>
  );
}
