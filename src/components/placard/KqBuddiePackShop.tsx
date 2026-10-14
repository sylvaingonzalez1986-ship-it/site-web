"use client";

import Image from "next/image";
import Link from "@/components/navigation/NavigationLink";
import { BookOpen, Gift, PackageOpen, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PackOpeningFlowModal } from "@/components/account/PackOpeningFlowModal";
import { QuantitySelector } from "@/components/QuantitySelector";
import { useCart } from "@/context/CartContext";
import { useLotteryExperience } from "@/hooks/useLotteryExperience";
import { LOTTERY_POINTS_PACK_COST, LOTTERY_POINTS_PACK_MAX_PER_PURCHASE } from "@/lib/lottery-collection";
import type { LotteryTicket } from "@/types/lottery";
import { BuddiePackPurchaseError, createBuddiePackOpener, isBuddiePackPurchaseConfirmed, purchaseBuddiePacks, readBuddiePackPurchaseCheck, readBuddiePackSnapshot, saveBuddiePackPurchaseCheck } from "./KqBuddiePackShop.client";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import styles from "./KqBuddiePackShop.module.css";

type KqBuddiePackShopProps = {
  embedded?: boolean;
  onOpenCollection?: () => void;
  onBusyChange?: (busy: boolean) => void;
};

/** Tutorial surfaces never mount the account hooks or issue account mutations. */
export function KqBuddiePackShop(props: KqBuddiePackShopProps = {}) {
  const api = useKqTutorialApi();
  const { user } = useCart();
  if (api.isTutorial) return null;
  return <BuddiePackCounter key={user?.id ?? "guest"} {...props} userId={user?.id ?? "guest"} />;
}

function BuddiePackCounter({ embedded = false, onOpenCollection, onBusyChange, userId }: KqBuddiePackShopProps & { userId: string }) {
  const api = useKqTutorialApi();
  const { isAuthenticated, authLoading, refreshSession } = useCart();
  const { tickets, inventory, config, loyalty, loading, error, acting, refreshAll, openPack } = useLotteryExperience();
  const [quantity, setQuantity] = useState(1);
  const [selectedTicket, setSelectedTicket] = useState<LotteryTicket | null>(null);
  const [pending, setPending] = useState<"buy" | "verify" | "welcome" | "open" | null>(null);
  const [purchaseCheck, setPurchaseCheck] = useState(() => readBuddiePackPurchaseCheck(userId));
  const [welcomeEligible, setWelcomeEligible] = useState(false);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const actionLock = useRef(false);
  const mounted = useRef(false);
  const busy = pending !== null || acting || selectedTicket !== null;
  const opener = useMemo(() => createBuddiePackOpener(openPack), [openPack]);
  const available = tickets.filter(ticket => ticket.status === "available");
  const maxPacks = Math.max(0, Math.min(LOTTERY_POINTS_PACK_MAX_PER_PURCHASE, Math.floor(loyalty.spendablePoints / LOTTERY_POINTS_PACK_COST)));
  const count = Math.min(quantity, Math.max(1, maxPacks));
  const totalPoints = count * LOTTERY_POINTS_PACK_COST;
  const unavailable = authLoading || loading || !isAuthenticated || !config?.isActive;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    onBusyChange?.(busy);
    return () => { onBusyChange?.(false); };
  }, [busy, onBusyChange]);

  useEffect(() => api.subscribe(["kq:boosters-updated"], () => {
    if (!actionLock.current) void refreshAll({ silent: true });
  }), [api, refreshAll]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    const controller = new AbortController();
    void fetch("/api/account/welcome-pack", { cache: "no-store", signal: controller.signal })
      .then(async response => response.ok ? response.json() as Promise<{ eligible?: boolean }> : null)
      .then(payload => { if (!controller.signal.aborted) setWelcomeEligible(payload?.eligible === true); })
      .catch(() => { /* The ordinary purchase/open actions remain available. */ });
    return () => controller.abort();
  }, [authLoading, isAuthenticated]);

  const notifyBalances = () => {
    api.notify("kq:boosters-updated");
    void refreshSession({ silent: true, force: true }).catch(() => {});
  };

  const buy = async () => {
    if (actionLock.current || unavailable || error || purchaseCheck || maxPacks < count) return;
    actionLock.current = true;
    const check = { packCount: count, pointsBefore: loyalty.spendablePoints, availableBefore: available.length, ticketIdsBefore: tickets.map(ticket => ticket.id) };
    // POST /account/tickets has no idempotency key: an uncertain result must be read, never replayed.
    saveBuddiePackPurchaseCheck(userId, check);
    setPurchaseCheck(check); setPending("buy"); setNotice(""); setActionError("");
    try {
      const granted = await purchaseBuddiePacks(count);
      await refreshAll({ silent: true });
      saveBuddiePackPurchaseCheck(userId, null);
      if (mounted.current) {
        setPurchaseCheck(null);
        setNotice(`${granted} pack${granted > 1 ? "s" : ""} Buddies ajouté${granted > 1 ? "s" : ""}. Prêt${granted > 1 ? "s" : ""} à ouvrir !`);
      }
      notifyBalances();
    } catch (cause) {
      const definitive = cause instanceof BuddiePackPurchaseError && cause.definitive;
      if (definitive) saveBuddiePackPurchaseCheck(userId, null);
      if (mounted.current) {
        if (definitive) setPurchaseCheck(null);
        setActionError(`${cause instanceof Error ? cause.message : "La réponse d’achat n’est pas arrivée."}${definitive ? "" : " Vérifie tes packs avant un nouvel achat."}`);
      }
    } finally {
      actionLock.current = false;
      if (mounted.current) setPending(null);
    }
  };

  const verifyPurchase = async () => {
    if (actionLock.current || !purchaseCheck) return;
    actionLock.current = true;
    setPending("verify"); setActionError("");
    try {
      const snapshot = await readBuddiePackSnapshot();
      await refreshAll({ silent: true });
      if (!isBuddiePackPurchaseConfirmed(purchaseCheck, snapshot)) {
        if (mounted.current) setActionError("L’attribution et le débit ne sont pas encore confirmés. Aucun nouvel achat n’a été lancé ; vérifie à nouveau dans un instant.");
        return;
      }
      saveBuddiePackPurchaseCheck(userId, null);
      if (mounted.current) {
        const ready = snapshot.tickets.filter(ticket => ticket.status === "available").length;
        setPurchaseCheck(null);
        setNotice(`Vérification faite : ${ready} pack${ready > 1 ? "s" : ""} disponible${ready > 1 ? "s" : ""}, ${snapshot.loyalty.spendablePoints.toLocaleString("fr-FR")} points fidélité. Aucun nouvel achat effectué.`);
      }
      notifyBalances();
    } catch (cause) {
      if (mounted.current) setActionError(cause instanceof Error ? cause.message : "Vérification impossible. Réessaie dans un instant.");
    } finally {
      actionLock.current = false;
      if (mounted.current) setPending(null);
    }
  };

  const claimWelcome = async () => {
    if (actionLock.current || unavailable || !welcomeEligible) return;
    actionLock.current = true;
    setPending("welcome"); setNotice(""); setActionError("");
    try {
      const response = await fetch("/api/account/welcome-pack", { method: "POST" });
      const payload = await response.json() as { granted?: boolean; error?: string };
      if (!response.ok || typeof payload.granted !== "boolean") throw new Error(payload.error || "Ton pack de bienvenue n’a pas pu être récupéré.");
      if (mounted.current) {
        setWelcomeEligible(false);
        setNotice(payload.granted ? "Ton pack de bienvenue est prêt à ouvrir !" : "Ton pack de bienvenue avait déjà été récupéré.");
      }
      window.dispatchEvent(new Event("welcome-pack-claimed"));
      await refreshAll({ silent: true });
      notifyBalances();
    } catch (cause) {
      if (mounted.current) setActionError(cause instanceof Error ? cause.message : "Réclamation impossible.");
    } finally {
      actionLock.current = false;
      if (mounted.current) setPending(null);
    }
  };

  const reveal = async (ticketId: string) => {
    if (actionLock.current) throw new Error("Une action est déjà en cours.");
    actionLock.current = true;
    setPending("open"); setActionError("");
    try {
      const result = await opener(ticketId);
      if (mounted.current) setNotice(`${result.cards.length} cartes découvertes et rangées dans ton album.`);
      api.notify("kq:collection-updated");
      await refreshAll({ silent: true });
      notifyBalances();
      return result;
    } finally {
      actionLock.current = false;
      if (mounted.current) setPending(null);
    }
  };

  const collectionLink = onOpenCollection
    ? <button type="button" className={styles.album} disabled={busy} onClick={onOpenCollection}><BookOpen size={17} aria-hidden="true" /> Mon album Buddies</button>
    : <Link className={styles.album} href="/profil/collection"><BookOpen size={17} aria-hidden="true" /> Mon album Buddies</Link>;

  return <section className={styles.shop} data-buddie-pack-shop data-embedded={embedded || undefined} aria-label="Packs Buddies" aria-busy={loading || pending !== null}>
    <div className={styles.presentation}>
      <div className={styles.packArt} aria-hidden="true"><Image src="/app/lottery/sealed-booster-pack-sylvain-v3.webp" alt="" width={220} height={310} sizes="(max-width: 640px) 112px, 190px" /><span>3 cartes</span></div>
      <div className={styles.intro}><h3>Buddies</h3><p>Tes compagnons de culture.</p><span className={styles.price}>{LOTTERY_POINTS_PACK_COST} points<small>le pack de 3 cartes</small></span></div>
    </div>
    <div className={styles.counter}>
      <div className={styles.summary}><span><small>Ta cagnotte</small><strong data-buddie-pack-points>{authLoading || loading ? "…" : loyalty.spendablePoints.toLocaleString("fr-FR")} <small>points fidélité</small></strong></span><span><small>Dans ton album</small><strong>{loading ? "…" : `${inventory?.uniqueOwned ?? 0} / ${inventory?.totalCards || 52}`}</strong></span></div>
      {authLoading || loading ? <p className={styles.notice} role="status">Sylvain retrouve tes packs…</p> : !isAuthenticated ? <Link className={styles.primary} href="/compte/connexion?next=/arene/placard%3Fview%3Dshop">Me connecter</Link> : <>
        {!config?.isActive && <p className={styles.notice} role="status">Les packs Buddies sont momentanément indisponibles.</p>}
        <div className={styles.purchase}><div role="group" aria-label="Nombre de packs Buddies"><QuantitySelector value={count} max={Math.max(1, maxPacks)} onChange={setQuantity} disabled={unavailable || busy || !!purchaseCheck || !!error} /></div><button type="button" className={styles.primary} data-buddie-pack-purchase disabled={unavailable || busy || !!error || !!purchaseCheck || maxPacks < 1} onClick={() => void buy()}>{pending === "buy" ? "Achat…" : `Acheter ${count} pack${count > 1 ? "s" : ""}`}<small>{totalPoints.toLocaleString("fr-FR")} points fidélité</small></button></div>
        {!unavailable && maxPacks < 1 && !purchaseCheck && <p className={styles.hint}>Il te manque {Math.max(0, LOTTERY_POINTS_PACK_COST - loyalty.spendablePoints)} points pour ce pack.</p>}
        {purchaseCheck && pending !== "buy" && <div className={styles.verification}><p>L’achat de {purchaseCheck.packCount} pack{purchaseCheck.packCount > 1 ? "s" : ""} reste à vérifier.</p><button type="button" data-buddie-pack-verify disabled={busy} onClick={() => void verifyPurchase()}><RefreshCw size={16} aria-hidden="true" />{pending === "verify" ? "Vérification…" : "Vérifier mes packs"}</button></div>}
        <div className={styles.ready}><span><strong data-buddie-pack-available>{available.length}</strong> pack{available.length > 1 ? "s" : ""} à ouvrir</span><button type="button" data-buddie-pack-open className={styles.open} disabled={unavailable || busy || available.length === 0} onClick={() => { if (!actionLock.current && available[0]) setSelectedTicket(available[0]); }}><PackageOpen size={19} aria-hidden="true" /> Ouvrir un pack</button></div>
        {welcomeEligible && <button type="button" className={styles.welcome} data-buddie-pack-welcome disabled={unavailable || busy} onClick={() => void claimWelcome()}><Gift size={18} aria-hidden="true" />{pending === "welcome" ? "Récupération…" : "Récupérer mon pack offert"}</button>}
      </>}
      {actionError && <p className={styles.error} role="alert">{actionError}</p>}
      {error && <p className={styles.error} role="alert">{error} <button type="button" disabled={busy} onClick={() => void refreshAll()}>Actualiser</button></p>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      <footer className={styles.footer}>{collectionLink}<Link href="/reglement-jeu-promo">Règles des packs</Link></footer>
    </div>
    <PackOpeningFlowModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} onOpen={reveal} />
  </section>;
}
