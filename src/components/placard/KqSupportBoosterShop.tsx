"use client";

import Image from "next/image";
import { Flame, PackageOpen, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getKqCardArtwork } from "@/lib/kanab-quest-artwork";
import { openKqSupportBooster } from "@/lib/kanab-quest-booster";
import styles from "./KqSupportBoosterShop.module.css";

type ShopPayload = {
  collectionActive: boolean;
  costPerPack: number;
  spendablePoints: number;
  availableEntitlements: Array<{ id: string; source: string; cardCount: number; createdAt: string }>;
  welcomeClaimed: boolean;
};

type OpenedCard = { code: string; name: string; rarity: string; imageUrl?: string };

export function KqSupportBoosterShop({
  autoOpen = false,
  onExit,
}: {
  autoOpen?: boolean;
  onExit?: () => void;
} = {}) {
  const [shop, setShop] = useState<ShopPayload | null>(null);
  const [openedCards, setOpenedCards] = useState<OpenedCard[]>([]);
  const [pending, setPending] = useState<"load" | "claim" | "buy" | "open" | null>("load");
  const [notice, setNotice] = useState("");
  const [localPreview, setLocalPreview] = useState(false);
  const [welcomeChecked, setWelcomeChecked] = useState(false);
  const [shopOpen, setShopOpen] = useState(autoOpen);

  const closeShop = useCallback(() => {
    setOpenedCards([]);
    setNotice("");
    setShopOpen(false);
    onExit?.();
  }, [onExit]);

  useEffect(() => {
    if (!shopOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (openedCards.length > 0) setOpenedCards([]);
      else closeShop();
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [closeShop, openedCards.length, shopOpen]);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/arena/placard/boosters", { cache: "no-store" });
    const payload = await response.json() as ShopPayload & { error?: string };
    if (!response.ok) throw new Error(payload.error || "Boutique La Botte indisponible.");
    setShop(payload);
  }, []);

  useEffect(() => {
    setLocalPreview(["localhost", "127.0.0.1"].includes(window.location.hostname));
    const handleBoosterUpdate = () => void refresh();
    window.addEventListener("kq:boosters-updated", handleBoosterUpdate);
    refresh()
      .catch((error: unknown) => setNotice(error instanceof Error ? error.message : "Boutique indisponible."))
      .finally(() => setPending(null));
    return () => window.removeEventListener("kq:boosters-updated", handleBoosterUpdate);
  }, [refresh]);

  const purchase = async () => {
    setPending("buy");
    setNotice("");
    try {
      const response = await fetch("/api/arena/placard/boosters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packCount: 1, requestKey: crypto.randomUUID() }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Achat impossible.");
      await refresh();
      setNotice("Booster La Botte ajouté. Tu peux maintenant l’ouvrir.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Achat impossible.");
    } finally {
      setPending(null);
    }
  };

  const claimWelcome = async () => {
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
      setPending(null);
    }
  };

  useEffect(() => {
    if (!shop || welcomeChecked || !shop.collectionActive || shop.welcomeClaimed) return;
    setWelcomeChecked(true);
    void claimWelcome();
    // The welcome grant is idempotent server-side and intentionally runs only once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop, welcomeChecked]);

  const open = async () => {
    const entitlement = shop?.availableEntitlements[0];
    if (!entitlement) return;
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
  const nextEntitlement = welcomeEntitlement ?? shop?.availableEntitlements[0];

  return (
    <section id="boutique-la-botte" className="mx-auto mt-8 max-w-5xl">
      <button type="button" onClick={() => setShopOpen(true)} aria-haspopup="dialog" className="group relative block aspect-[3/2] w-full overflow-hidden border-2 border-ink bg-green text-left shadow-[6px_6px_0_#1a1a1a] transition-transform hover:-translate-y-1 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-green">
        <Image src="/placard/booster-shop-front-v2.webp" alt="Façade de la boutique La Botte" fill priority sizes="(max-width: 768px) 100vw, 1024px" className="object-cover transition-transform duration-500 group-hover:scale-[1.025]" />
        <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/90 via-black/55 to-transparent p-4 pt-16 text-white sm:p-6">
          <span><small className="block text-xs font-black uppercase tracking-[.16em] text-yellow">Boutique de l’Arène</small><strong className="mt-1 block font-display text-3xl uppercase sm:text-5xl">Entre dans La Botte</strong></span>
          <b className="shrink-0 border-2 border-white bg-green px-4 py-3 text-xs font-black uppercase shadow-[3px_3px_0_#fff]">Ouvrir la boutique</b>
        </span>
      </button>

      {shopOpen ? <div className="fixed inset-0 z-[150] flex items-center justify-center overflow-hidden bg-[#10201b] p-0 backdrop-blur-sm sm:p-4" role="presentation" onClick={closeShop}><section role="dialog" aria-modal="true" aria-labelledby="kq-shop-title" onClick={(event) => event.stopPropagation()} className="relative h-[100dvh] w-full max-w-6xl overflow-hidden border-0 border-ink bg-[#f6f0e6] shadow-[9px_9px_0_#f4c43d] sm:aspect-[3/2] sm:h-auto sm:max-h-[calc(100vh-2rem)] sm:border-2">
        <Image src="/placard/booster-shop-interior-v3.webp" alt="Intérieur de la boutique La Botte avec les cartes Kanab Quest exposées" fill priority sizes="(max-width: 768px) 100vw, 1152px" className={`${styles.interior} object-cover object-center sm:object-cover`} />
        <h2 id="kq-shop-title" className="sr-only">Boutique Booster La Botte</h2>
        <button type="button" aria-label="Quitter la boutique" onClick={closeShop} className="absolute right-2 top-2 z-40 grid h-10 w-10 place-items-center border-2 border-ink bg-white shadow-[3px_3px_0_#1a1a1a] sm:right-3 sm:top-3 sm:h-12 sm:w-12"><X /></button>
        <div className="absolute left-2 top-2 z-20 border-2 border-ink bg-yellow px-2 py-1 text-center shadow-[3px_3px_0_#1a1a1a] sm:left-3 sm:top-3 sm:px-4 sm:py-2"><b className="block text-lg sm:text-2xl">{shop?.spendablePoints ?? 0}</b><small className="text-[9px] font-black uppercase sm:text-xs">Tes points</small></div>
        <div className="absolute inset-0 z-20 sm:contents">
          <button type="button" title={shop?.welcomeClaimed ? "Cadeau déjà récupéré" : "Récupérer le booster offert"} aria-label={shop?.welcomeClaimed ? "Cadeau booster déjà récupéré" : "Récupérer le booster offert"} disabled={shop?.welcomeClaimed || !shop?.collectionActive || pending !== null} onClick={() => void claimWelcome()} className={`${styles.item} ${styles.itemGift} group absolute aspect-square border-0 bg-transparent p-0 drop-shadow-[0_8px_5px_rgba(0,0,0,.55)] transition-all duration-200 active:-translate-y-2 focus-visible:rounded-full focus-visible:outline-4 focus-visible:outline-yellow disabled:grayscale disabled:opacity-55 sm:bottom-[23%] sm:left-[16%] sm:w-[17%] sm:hover:-translate-y-2`}><Image src="/placard/shop-item-gift-v2.webp" alt="" fill sizes="(max-width: 640px) 128px, 190px" className="object-contain" /></button>
          <button type="button" title={nextEntitlement ? `Ouvrir un pack parmi ${shop?.availableEntitlements.length ?? 0}` : "Aucun pack disponible"} aria-label={nextEntitlement ? `Ouvrir un pack, ${shop?.availableEntitlements.length ?? 0} disponible(s)` : "Aucun pack disponible"} disabled={!shop?.collectionActive || pending !== null || !nextEntitlement} onClick={() => void open()} className={`${styles.item} ${styles.itemPacks} group absolute aspect-square border-0 bg-transparent p-0 drop-shadow-[0_8px_5px_rgba(0,0,0,.55)] transition-all duration-200 active:-translate-y-2 focus-visible:rounded-full focus-visible:outline-4 focus-visible:outline-yellow disabled:grayscale disabled:opacity-55 sm:bottom-[22%] sm:left-1/2 sm:w-[20%] sm:-translate-x-1/2 sm:hover:-translate-x-1/2 sm:hover:-translate-y-2`}><Image src="/placard/shop-item-packs-v2.webp" alt="" fill sizes="(max-width: 640px) 142px, 220px" className="object-contain" /></button>
          <button type="button" title={`Acheter un booster pour ${shop?.costPerPack ?? 5} points`} aria-label={`Acheter un booster pour ${shop?.costPerPack ?? 5} points`} disabled={!shop?.collectionActive || pending !== null || (shop?.spendablePoints ?? 0) < (shop?.costPerPack ?? 5)} onClick={() => void purchase()} className={`${styles.item} ${styles.itemRegister} group absolute aspect-square border-0 bg-transparent p-0 drop-shadow-[0_8px_5px_rgba(0,0,0,.55)] transition-all duration-200 active:-translate-y-2 focus-visible:rounded-full focus-visible:outline-4 focus-visible:outline-yellow disabled:grayscale disabled:opacity-55 sm:bottom-[23%] sm:right-[15%] sm:w-[18%] sm:hover:-translate-y-2`}><Image src="/placard/shop-item-register-v2.webp" alt="" fill sizes="(max-width: 640px) 128px, 200px" className="object-contain" /></button>
        </div>
        {!shop?.collectionActive && localPreview ? <button type="button" onClick={openPreview} className="absolute left-3 top-24 z-20 border-2 border-ink bg-white px-3 py-2 text-xs font-black uppercase"><PackageOpen className="mr-1 inline w-4" />Test local</button> : null}
        {notice ? <p className="absolute left-1/2 top-20 z-20 w-[min(90%,520px)] -translate-x-1/2 border-2 border-ink bg-white/95 px-4 py-3 text-center text-sm font-bold shadow-[3px_3px_0_#1a1a1a]" role="status">{notice}</p> : null}
        {!shop?.collectionActive ? <p className="absolute bottom-24 left-1/2 z-10 -translate-x-1/2 text-sm font-bold text-white"><Flame className="mr-1 inline w-4" />Boutique fermée pendant les tests.</p> : null}
        {openedCards.length > 0 ? <div className="absolute inset-0 z-50 flex flex-col bg-[#081a14]/95 p-3 backdrop-blur-sm sm:p-6"><button type="button" aria-label="Fermer le pack ouvert" onClick={() => setOpenedCards([])} className="absolute right-3 top-3 z-10 grid h-11 w-11 place-items-center border-2 border-ink bg-white shadow-[3px_3px_0_#f4c43d]"><X /></button><header className="shrink-0 pr-14 text-center text-white"><small className="font-black uppercase tracking-[.14em] text-yellow">Pack débloqué</small><h3 className="font-display text-3xl uppercase sm:text-5xl">Tes nouvelles cartes</h3></header><div className="my-3 flex min-h-0 flex-1 items-center gap-2 overflow-x-auto px-1 pb-2 sm:gap-3">{openedCards.map((card, index) => { const src = getKqCardArtwork(card.code) ?? card.imageUrl; return <article key={`${card.code}-${index}`} className="w-28 shrink-0 border-2 border-[#d5a72d] bg-white p-1 shadow-[3px_3px_0_#d5a72d] sm:w-40">{src ? <div className="relative aspect-[2/3] overflow-hidden"><Image src={src} alt={card.name} fill sizes="160px" className="object-cover" /></div> : null}<small className="mt-1 block text-[9px] font-black uppercase text-green sm:text-xs">{card.rarity}</small><strong className="block text-[10px] sm:text-sm">{card.name}</strong></article>; })}</div><button type="button" onClick={() => { setOpenedCards([]); setNotice(""); }} className="mx-auto min-h-12 shrink-0 border-2 border-ink bg-yellow px-6 font-black uppercase shadow-[4px_4px_0_#fff]">Retour à la boutique</button></div> : null}
      </section></div> : null}
    </section>
  );
}
