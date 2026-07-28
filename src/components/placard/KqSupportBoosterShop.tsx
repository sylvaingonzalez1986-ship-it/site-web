"use client";

import Image from "next/image";
import { Flame, Gift, PackageOpen, ShoppingBag } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getKqCardArtwork } from "@/lib/kanab-quest-artwork";
import { openKqSupportBooster } from "@/lib/kanab-quest-booster";

type ShopPayload = {
  collectionActive: boolean;
  costPerPack: number;
  spendablePoints: number;
  availableEntitlements: Array<{ id: string; source: string; cardCount: number; createdAt: string }>;
  welcomeClaimed: boolean;
};

type OpenedCard = { code: string; name: string; rarity: string; imageUrl?: string };

export function KqSupportBoosterShop() {
  const [shop, setShop] = useState<ShopPayload | null>(null);
  const [openedCards, setOpenedCards] = useState<OpenedCard[]>([]);
  const [pending, setPending] = useState<"load" | "claim" | "buy" | "open" | null>("load");
  const [notice, setNotice] = useState("");
  const [localPreview, setLocalPreview] = useState(false);

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
    setNotice("Prévisualisation locale : aucun point débité et aucune carte créée dans Supabase.");
  };

  if (!shop && pending === "load") return null;

  return (
    <section className="mx-auto mt-8 max-w-5xl border-2 border-ink bg-[#fff3c4] p-4 shadow-[5px_5px_0_#1a1a1a]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-green">Boutique de L’Arène</p>
          <h2 className="mt-1 font-display text-3xl uppercase">Booster La Botte</h2>
          <p className="mt-1 max-w-xl text-sm font-semibold text-charcoal">
            Dix cartes jouables pour le Placard. Les boosters Buddies restent dans ton album habituel.
          </p>
        </div>
        <div className="flex gap-2">
          <span className="border-2 border-ink bg-white px-4 py-2 text-center">
            <b className="block text-xl">{shop?.spendablePoints ?? 0}</b>
            <small className="font-black uppercase">Tes points</small>
          </span>
          <span className="border-2 border-ink bg-yellow px-4 py-2 text-center">
            <b className="block text-xl">{shop?.costPerPack ?? 5}</b>
            <small className="font-black uppercase">Le booster</small>
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {!shop?.welcomeClaimed ? (
          <button
            type="button"
            disabled={!shop?.collectionActive || pending !== null}
            onClick={() => void claimWelcome()}
            className="inline-flex min-h-12 items-center gap-2 border-2 border-ink bg-white px-4 font-black uppercase shadow-[3px_3px_0_#1a1a1a] disabled:opacity-45"
          >
            <Gift /> {pending === "claim" ? "Réclamation…" : "Réclamer mon booster offert"}
          </button>
        ) : null}
        <button
          type="button"
          disabled={!shop?.collectionActive || pending !== null || (shop?.spendablePoints ?? 0) < (shop?.costPerPack ?? 5)}
          onClick={() => void purchase()}
          className="inline-flex min-h-12 items-center gap-2 border-2 border-ink bg-yellow px-4 font-black uppercase shadow-[3px_3px_0_#1a1a1a] disabled:opacity-45"
        >
          <ShoppingBag /> {pending === "buy" ? "Achat…" : `Acheter · ${shop?.costPerPack ?? 5} points`}
        </button>
        <button
          type="button"
          disabled={!shop?.collectionActive || pending !== null || (shop?.availableEntitlements.length ?? 0) === 0}
          onClick={() => void open()}
          className="inline-flex min-h-12 items-center gap-2 border-2 border-ink bg-green px-4 font-black uppercase text-white shadow-[3px_3px_0_#1a1a1a] disabled:opacity-45"
        >
          <PackageOpen /> {pending === "open" ? "Ouverture…" : `Ouvrir ${shop?.availableEntitlements[0]?.cardCount ?? 10} cartes · ${shop?.availableEntitlements.length ?? 0} disponible(s)`}
        </button>
        {!shop?.collectionActive && localPreview ? (
          <button
            type="button"
            onClick={openPreview}
            className="inline-flex min-h-12 items-center gap-2 border-2 border-ink bg-white px-4 font-black uppercase shadow-[3px_3px_0_#1a1a1a]"
          >
            <PackageOpen /> Ouvrir un booster test
          </button>
        ) : null}
      </div>

      {!shop?.collectionActive ? <p className="mt-3 text-sm font-bold"><Flame className="mr-1 inline w-4" />Boutique encore fermée pendant les tests de lancement.</p> : null}
      {notice ? <p className="mt-3 text-sm font-bold" role="status">{notice}</p> : null}

      {openedCards.length > 0 ? (
        <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
          {openedCards.map((card, index) => {
            const src = getKqCardArtwork(card.code) ?? card.imageUrl;
            return (
              <article key={`${card.code}-${index}`} className="w-44 shrink-0 border-2 border-ink bg-white p-2 shadow-[3px_3px_0_#1a1a1a]">
                {src ? <div className="relative aspect-[2/3] overflow-hidden"><Image src={src} alt={card.name} fill sizes="176px" className="object-cover" /></div> : null}
                <small className="mt-2 block font-black uppercase text-green">{card.rarity}</small>
                <strong className="block">{card.name}</strong>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
