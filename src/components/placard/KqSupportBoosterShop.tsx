"use client";

import Image from "next/image";
import { BookOpen, Gift, PackageOpen, Trophy, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useCart } from "@/context/CartContext";
import { getKqCardArtwork } from "@/lib/kanab-quest-artwork";
import { openKqSupportBooster, KQ_SUPPORT_RARITY_WEIGHTS } from "@/lib/kanab-quest-booster";
import { getKqCardRarityLabel } from "@/lib/kanab-quest-card-guide";
import { createClientRequestKey } from "@/lib/client-request-key";
import { KqBuddiePackShop } from "./KqBuddiePackShop";
import { readSupportPackPurchaseKey, saveSupportPackPurchaseKey } from "./KqSupportBoosterShop.client";
import { useKqTutorialApi } from "./KqTutorialApiContext";
import { KqSupportPackOpening, requestKqSupportPackOpening, type KqOpenedSupportCard } from "./KqSupportPackOpening";
import styles from "./KqSupportBoosterShop.module.css";

type ShopSection = "botte" | "buddies";
type ShopPayload = {
  collectionActive: boolean; costPerPack: number; spendablePoints: number;
  availableEntitlements: Array<{ id: string; source: string; cardCount: number; createdAt: string }>;
  welcomeClaimed: boolean;
};
type ShopEntitlement = ShopPayload["availableEntitlements"][number];

export function splitShopEntitlements(entitlements: ShopEntitlement[]) {
  return {
    duelRewards: entitlements.filter(entitlement => entitlement.source === "pvp_win"),
    shopPacks: entitlements.filter(entitlement => entitlement.source !== "pvp_win"),
  };
}

type KqSupportBoosterShopProps = {
  autoOpen?: boolean; embedded?: boolean; initialSection?: ShopSection;
  onSectionChange?: (section: ShopSection) => void;
  onExit?: () => void; onOpenCollection?: (section?: ShopSection) => void; autoClaimWelcome?: boolean;
};

export function KqSupportBoosterShop(props: KqSupportBoosterShopProps = {}) {
  const api = useKqTutorialApi();
  const { user } = useCart();
  const userId = api.isTutorial ? null : user?.id ?? null;
  return <KqSupportBoosterCounter key={api.isTutorial ? "tutorial" : userId ?? "guest"} {...props} userId={userId} />;
}

function KqSupportBoosterCounter({
  autoOpen = false, embedded = false, initialSection = "botte",
  onSectionChange, onExit, onOpenCollection, autoClaimWelcome = true, userId,
}: KqSupportBoosterShopProps & { userId: string | null }) {
  const api = useKqTutorialApi();
  const dialogRef = useRef<HTMLElement>(null);
  const actionLock = useRef(false);
  const [restoredPurchaseKey] = useState(() => readSupportPackPurchaseKey(userId));
  const purchaseKey = useRef<string | null>(restoredPurchaseKey);
  const [shop, setShop] = useState<ShopPayload | null>(null);
  const [openedCards, setOpenedCards] = useState<KqOpenedSupportCard[]>([]);
  const [pending, setPending] = useState<"load" | "claim" | "buy" | "open" | null>("load");
  const [notice, setNotice] = useState("");
  const [purchaseRetry, setPurchaseRetry] = useState(restoredPurchaseKey !== null);
  const [openingRetry, setOpeningRetry] = useState<ShopEntitlement | null>(null);
  const [localPreview, setLocalPreview] = useState(false);
  const [welcomeChecked, setWelcomeChecked] = useState(false);
  const [shopOpen, setShopOpen] = useState(autoOpen);
  const [localSection, setLocalSection] = useState(initialSection);
  const [buddiesVisited, setBuddiesVisited] = useState(initialSection === "buddies");
  const [buddieBusy, setBuddieBusy] = useState(false);
  const section = api.isTutorial ? "botte" : onSectionChange ? initialSection : localSection;
  const busy = (pending !== null && pending !== "load") || buddieBusy || openedCards.length > 0;

  const closeShop = useCallback(() => {
    if (busy) return;
    setShopOpen(false);
    onExit?.();
  }, [onExit, busy]);
  useBodyScrollLock(shopOpen && !embedded);

  useEffect(() => {
    if (!shopOpen || embedded) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => previous?.focus();
  }, [shopOpen, embedded]);
  useEffect(() => {
    if (!shopOpen || embedded) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented && !busy && !document.querySelector("dialog[open]")) closeShop();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [shopOpen, embedded, closeShop, busy]);

  const refresh = useCallback(async () => {
    const response = await api.request("/api/arena/placard/boosters", { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    const payload = await response.json() as ShopPayload & { error?: string };
    if (!response.ok) throw new Error(payload.error || "Boutique indisponible.");
    setShop(payload);
  }, [api]);
  useEffect(() => {
    setLocalPreview(["localhost", "127.0.0.1"].includes(window.location.hostname));
    const unsubscribe = api.subscribe(["kq:boosters-updated"], () => {
      if (!actionLock.current) void refresh().catch(() => setNotice("Impossible d’actualiser les packs."));
    });
    void refresh().catch((error: unknown) => setNotice(error instanceof Error ? error.message : "Boutique indisponible."))
      .finally(() => setPending(null));
    return unsubscribe;
  }, [refresh, api]);

  const purchase = async () => {
    if (actionLock.current || (!api.isTutorial && !userId)) return;
    actionLock.current = true;
    purchaseKey.current ??= createClientRequestKey();
    saveSupportPackPurchaseKey(userId, purchaseKey.current);
    setPending("buy");
    setNotice("");
    try {
      const response = await api.request("/api/arena/placard/boosters", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packCount: 1, requestKey: purchaseKey.current }),
        signal: AbortSignal.timeout(15_000),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
          purchaseKey.current = null;
          saveSupportPackPurchaseKey(userId, null);
        }
        throw new Error(payload.error || "Achat impossible.");
      }
      await refresh();
      purchaseKey.current = null;
      saveSupportPackPurchaseKey(userId, null);
      setPurchaseRetry(false);
      api.notify("kq:boosters-updated");
      setNotice("Ton pack est prêt à ouvrir.");
    } catch (error) {
      setPurchaseRetry(purchaseKey.current !== null);
      setNotice(purchaseKey.current ? "Achat à confirmer. Vérifie cet achat avant d’en lancer un autre." : error instanceof Error ? error.message : "Achat impossible.");
    } finally { actionLock.current = false; setPending(null); }
  };
  const claimWelcome = async () => {
    if (actionLock.current) return;
    actionLock.current = true;
    setPending("claim");
    setNotice("");
    try {
      const response = await api.request("/api/arena/placard/boosters", { method: "PUT", signal: AbortSignal.timeout(15_000) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Pack de bienvenue indisponible.");
      await refresh();
      setNotice("Ton pack de bienvenue est prêt à ouvrir.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Pack de bienvenue indisponible."); }
    finally { actionLock.current = false; setPending(null); }
  };
  useEffect(() => {
    if (section !== "botte" || !autoClaimWelcome || !shop || welcomeChecked || !shop.collectionActive || shop.welcomeClaimed) return;
    setWelcomeChecked(true);
    void claimWelcome();
    // The welcome grant is idempotent server-side and intentionally runs only once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop, welcomeChecked, autoClaimWelcome, section]);

  const openEntitlement = async (entitlement?: ShopEntitlement) => {
    if (!entitlement || actionLock.current) return;
    actionLock.current = true;
    setPending("open");
    setNotice("");
    try {
      const cards = await requestKqSupportPackOpening(api.request, entitlement.id);
      setOpenedCards(cards);
      setOpeningRetry(null);
      api.notify("kq:collection-updated");
      await refresh().catch(() => setNotice("Cartes reçues. Le nombre de packs sera actualisé à la prochaine visite."));
    } catch (error) {
      setOpeningRetry(entitlement);
      setNotice(error instanceof Error ? error.message : "Ouverture à confirmer.");
    } finally { actionLock.current = false; setPending(null); }
  };
  const selectSection = (next: ShopSection) => {
    if (busy) return;
    if (next === "buddies") setBuddiesVisited(true);
    if (onSectionChange) onSectionChange(next);
    else setLocalSection(next);
  };
  const { duelRewards, shopPacks } = splitShopEntitlements(shop?.availableEntitlements ?? []);
  const nextShopPack = shopPacks.find(item => item.source === "welcome_pack") ?? shopPacks[0];
  const canAct = !!shop?.collectionActive && pending === null && (api.isTutorial || userId !== null);
  const closeReveal = () => setOpenedCards([]);

  return <section id="boutique-la-botte" className={styles.embeddedShop} data-shop-page={embedded || undefined}>
    {!embedded ? <button type="button" onClick={() => setShopOpen(true)} aria-haspopup="dialog" className={styles.front}>
      <Image src="/placard/card-shop-sylvain-v1.webp" alt="Sylvain t’attend dans sa boutique de cartes." width={1536} height={512} sizes="(max-width: 768px) 100vw, 1100px" />
      <span>Ouvrir la boutique <PackageOpen aria-hidden="true" /></span>
    </button> : null}
    {shopOpen ? <div className={styles.backdrop} data-embedded={embedded || undefined} onClick={embedded ? undefined : closeShop}>
      <section ref={dialogRef} data-arena-tour-surface="shop" data-arena-tour-blocked={busy || undefined} tabIndex={-1}
        role={embedded ? "region" : "dialog"} aria-modal={embedded ? undefined : true} aria-labelledby="kq-shop-title"
        className={styles.shopDialog} onClick={event => event.stopPropagation()} onKeyDown={event => {
          if (embedded || event.key !== "Tab" || document.querySelector("dialog[open]")
            || !(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
          const nodes = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, select, summary, [tabindex="0"]')).filter(node => !node.closest('[inert]') && node.getClientRects().length > 0);
          const first = nodes[0], last = nodes.at(-1);
          if (!first) { event.preventDefault(); event.currentTarget.focus(); return; }
          if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && (document.activeElement === last || document.activeElement === event.currentTarget)) { event.preventDefault(); first?.focus(); }
        }}>
        <header className={styles.header}>
          <h2 id="kq-shop-title">Packs de cartes</h2>
          <div className={styles.headerActions}>
            {onOpenCollection ? <button type="button" disabled={busy} onClick={() => onOpenCollection(section)} aria-haspopup="dialog"><BookOpen size={18} aria-hidden="true" /><span>Collections</span></button> : null}
            <button type="button" className={styles.exit} disabled={busy} aria-label="Quitter la boutique" onClick={closeShop}><X aria-hidden="true" /></button>
          </div>
        </header>
        <Image className={styles.interior} src="/placard/card-shop-sylvain-v1.webp" alt="Sylvain et ses cartes au comptoir d’une petite boutique bretonne." width={1536} height={512} priority sizes="(max-width: 768px) 100vw, 1100px" />
        <div className={styles.shelves}>
          <nav className={styles.tabs} aria-label="Rayons de la boutique">
            <button type="button" data-shop-section="botte" aria-pressed={section === "botte"} disabled={busy} onClick={() => selectSection("botte")}>Botte du Chanvrier</button>
            {!api.isTutorial ? <button type="button" data-shop-section="buddies" aria-pressed={section === "buddies"} disabled={busy} onClick={() => selectSection("buddies")}>Buddies</button> : null}
          </nav>
          <div hidden={section !== "botte"} data-shop-panel="botte">
            <div className={styles.counter}>
              <div className={styles.presentation}>
                <div className={styles.cardFan} aria-hidden="true">
                  {["BOTTE-017", "BOTTE-006", "BOTTE-034"].map(code => <Image key={code} src={getKqCardArtwork(code)!} alt="" width={150} height={225} sizes="150px" />)}
                  <span>10 cartes</span>
                </div>
                <div className={styles.intro}><h3>Botte du Chanvrier</h3><p>Des coups de pouce pour tes cultures.</p>
                  <strong className={styles.price}>{shop ? shop.costPerPack + " points" : "…"}<small>le pack de 10 cartes</small></strong>
                </div>
              </div>
              <div className={styles.actions}>
                <div className={styles.wallet}><span>Mes points</span><strong>{shop ? shop.spendablePoints.toLocaleString("fr-FR") : "…"}</strong></div>
                <button type="button" data-support-pack-purchase data-support-pack-verify={purchaseRetry || undefined}
                  className={styles.primary} disabled={!canAct || (!purchaseRetry && (shop?.spendablePoints ?? 0) < (shop?.costPerPack ?? Infinity))} onClick={() => void purchase()}>
                  {pending === "buy" ? "Vérification…" : purchaseRetry ? "Vérifier l’achat" : "Acheter un pack"}
                </button>
                {shop && shop.spendablePoints < shop.costPerPack && !purchaseRetry ? <p className={styles.hint}>Points insuffisants.</p> : null}
                <div className={styles.ready}>
                  <span><PackageOpen size={20} aria-hidden="true" /><strong>{shopPacks.length}</strong> pack{shopPacks.length === 1 ? "" : "s"} à ouvrir</span>
                  <button type="button" data-support-pack-open disabled={!canAct || !nextShopPack || !!openingRetry} onClick={() => void openEntitlement(nextShopPack)}>{pending === "open" ? "Ouverture…" : "Ouvrir"}</button>
                </div>
                <div className={styles.duels}>
                  <span><Trophy size={19} aria-hidden="true" />Gains de duel <b>{duelRewards.length}</b></span>
                  <button type="button" disabled={!canAct || !duelRewards.length || !!openingRetry} onClick={() => void openEntitlement(duelRewards[0])} aria-label="Ouvrir un pack de duel">Ouvrir</button>
                </div>
                {shop?.collectionActive && !shop.welcomeClaimed ? <button type="button" className={styles.welcome} disabled={pending !== null} onClick={() => void claimWelcome()}><Gift size={17} aria-hidden="true" />Mon pack de bienvenue</button> : null}
                {openingRetry ? <button type="button" className={styles.welcome} disabled={pending !== null} onClick={() => void openEntitlement(openingRetry)}>Retrouver mon pack</button> : null}
                {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
                {pending === "load" ? <p role="status" className={styles.hint}>Chargement des packs…</p> : null}
                {!shop && pending === null ? <button type="button" className={styles.welcome} onClick={() => { setPending("load"); void refresh().then(() => setNotice("")).catch(() => setNotice("Boutique indisponible.")).finally(() => setPending(null)); }}>Actualiser</button> : null}
                {shop && !shop.collectionActive ? <p className={styles.hint}>La vente de packs est momentanément fermée.</p> : null}
              </div>
              <footer className={styles.footer}>
                <details className={styles.packOdds}><summary>Raretés des packs</summary><div><strong>Une première carte commune garantie.</strong><p>Pour chaque emplacement suivant :</p><ul>{Object.entries(KQ_SUPPORT_RARITY_WEIGHTS).map(([rarity, weight]) => <li key={rarity}>{getKqCardRarityLabel(rarity)} <b>{weight} %</b></li>)}</ul><p>Doublons possibles. Une seule épique jouée par culture.</p></div></details>
                {onOpenCollection ? <button type="button" disabled={busy} onClick={() => onOpenCollection("botte")}><BookOpen size={17} aria-hidden="true" />Mon album</button> : null}
              </footer>
            </div>
            {!shop?.collectionActive && localPreview ? <button type="button" className={styles.preview} onClick={() => {
              setOpenedCards(openKqSupportBooster(Date.now()).map(card => ({ code: card.code, name: card.name, rarity: card.rarity, imageUrl: getKqCardArtwork(card.code) ?? undefined })));
              setNotice("Aperçu local : aucun point débité, aucune carte enregistrée.");
            }}>Aperçu local</button> : null}
          </div>
          {!api.isTutorial && (buddiesVisited || section === "buddies") ? <div hidden={section !== "buddies"} data-shop-panel="buddies"><KqBuddiePackShop embedded onOpenCollection={onOpenCollection ? () => onOpenCollection("buddies") : undefined} onBusyChange={setBuddieBusy} /></div> : null}
        </div>
      </section>
    </div> : null}
    {openedCards.length ? <KqSupportPackOpening cards={openedCards} cardCount={openedCards.length} busy={false} error="" canRetry={false} onRetry={() => {}} onClose={closeReveal} onContinue={closeReveal} continueLabel="Retour à la boutique" /> : null}
  </section>;
}
