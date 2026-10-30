"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Bug, ChevronDown, Leaf, RefreshCw, Wallet } from "lucide-react";
import { KQ_CARE_PRODUCTS, canApplyKqCareProduct } from "@/lib/kanab-quest-care";
import { getKqCareProductArtwork } from "@/lib/kanab-quest-care-artwork";
import { getKqRemoteCareShop, purchaseKqRemoteCareProduct } from "@/lib/kanab-quest-api";
import { buyKqLocalCare, loadKqLocalCare, type KqCareStorage } from "@/lib/kanab-quest-care-local";
import { createClientRequestKey } from "@/lib/client-request-key";
import type { KqGameState } from "@/lib/kanab-quest-game";
import { getKqCareReserveProducts, parseKqCareReserveSnapshot, type KqCareReserveSnapshot } from "@/lib/kanab-quest-care-reserve";
import styles from "./KqCareShop.module.css";

const TARGET_LABELS: Record<string, string> = {
  roots: "Racines", nutrition: "Nutrition", stress: "Stress",
  aphids: "Pucerons", mites: "Tétranyques", thrips: "Thrips",
};
const formatPrice = (cents: number) => (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export function KqCareShop({ request, storage, state, disabled, embedded, refreshKey, onApply, onBusyChange, onPurchased, onClose }: {
  request: typeof fetch; storage?: KqCareStorage; state?: KqGameState; disabled?: boolean;
  embedded?: boolean; refreshKey?: number; onPurchased?: (cashCents: number) => void;
  onApply?: (productCode: string) => Promise<void>; onBusyChange?: (busy: boolean) => void; onClose?: () => void;
}) {
  const reserveView = Boolean(state && onApply);
  const [view, setView] = useState<"context" | "input" | "pbi">(reserveView ? "context" : "input");
  const [wallet, setWallet] = useState<KqCareReserveSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  const refreshGeneration = useRef(0);
  const receipts = useRef(new Map<string, string>());
  const [applyReceipt, setApplyReceipt] = useState<{ code: string; scope: string } | null>(null);
  const applyScope = `${state?.seed}:${state?.stageIndex}:${state?.phase}`;
  const retryApply = applyReceipt?.scope === applyScope ? applyReceipt.code : null;
  const refresh = useCallback(async () => {
    const generation = ++refreshGeneration.current;
    setLoading(true); setLoadError(""); setWallet(null);
    try {
      const local = storage ? loadKqLocalCare(storage) : null;
      const result = local ? { ...local, inventory: Object.entries(local.inventory).map(([productCode, quantity]) => ({ productCode, quantity })), catalog: KQ_CARE_PRODUCTS } : await getKqRemoteCareShop(request);
      const next = parseKqCareReserveSnapshot(result);
      if (!next) throw new Error("Réserve incomplète. Actualise pour vérifier les stocks et la trésorerie.");
      if (generation === refreshGeneration.current) setWallet(next);
    } catch (error) {
      if (generation === refreshGeneration.current) setLoadError(error instanceof Error ? error.message : "Réserve indisponible. Actualise pour réessayer.");
    } finally {
      if (generation === refreshGeneration.current) setLoading(false);
    }
  }, [request, storage]);
  useEffect(() => {
    void refresh();
    return () => { refreshGeneration.current += 1; };
  }, [refresh, refreshKey, state?.care?.applications.length]);
  const act = async (code: string, apply: boolean) => {
    if (lock.current || disabled) return;
    const retry = apply ? retryApply === code : receipts.current.has(code);
    if (!retry) {
      if (!wallet || loading || loadError) return;
      if (apply) {
        if (!onApply || !state || retryApply || !(wallet.inventory[code] > 0) || !canApplyKqCareProduct(state, code).allowed) return;
      } else if (wallet.prices[code] === undefined || wallet.cashCents < wallet.prices[code]) return;
    }
    refreshGeneration.current += 1;
    lock.current = true; setPending(code); setNotice(""); onBusyChange?.(true);
    try {
      let replayedPurchase = false;
      if (apply) {
        try { await onApply?.(code); setApplyReceipt(null); }
        catch (error) { setApplyReceipt({ code, scope: applyScope }); throw error; }
        await refresh();
      }
      else if (storage) {
        const result = buyKqLocalCare(storage, code);
        refreshGeneration.current += 1;
        setWallet({ ...result, prices: Object.fromEntries(KQ_CARE_PRODUCTS.map(product => [product.code, product.priceCents])) });
        setLoadError(""); setLoading(false);
        onPurchased?.(result.cashCents);
      }
      else {
        const key = receipts.current.get(code) ?? createClientRequestKey();
        receipts.current.set(code, key);
        const result = await purchaseKqRemoteCareProduct({ productCode: code, quantity: 1, requestKey: key }, request);
        replayedPurchase = result.replayed;
        receipts.current.delete(code);
        refreshGeneration.current += 1;
        const next = parseKqCareReserveSnapshot({ ...result, catalog: Object.entries(wallet?.prices ?? {}).map(([productCode, priceCents]) => ({ code: productCode, priceCents })) });
        if (next && wallet) { setWallet(next); setLoadError(""); setLoading(false); }
        else await refresh();
        if (Number.isSafeInteger(result.cashCents) && result.cashCents >= 0) onPurchased?.(result.cashCents);
      }
      setNotice(apply ? "Intervention engagée. Son effet sera évalué au prochain bilan." : replayedPurchase ? "Achat déjà enregistré. Aucun nouveau débit." : "Une charge ajoutée à ta réserve.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Opération impossible. Réessaie."); await refresh(); }
    finally { lock.current = false; setPending(null); onBusyChange?.(false); }
  };
  const matches = getKqCareReserveProducts(state);
  const products = view === "context" ? matches.map(match => match.product) : KQ_CARE_PRODUCTS.filter(product => product.kind === view);
  const known = !!wallet && !loading && !loadError;
  return <section className={styles.shop} data-embedded={embedded || undefined} data-reserve={reserveView || undefined} data-care-view={view} data-care-reserve-status={loading ? "loading" : loadError ? "error" : "ready"} aria-label="Intrants et protection biologique" aria-busy={!!pending || loading}>
    <header className={styles.heading}>
      <div className={styles.title}>
        <h2>{reserveView ? "Mes produits de soin" : "Intrants & PBI"}</h2>
      </div>
      <p className={styles.balance}><Wallet size={17} aria-hidden="true" /><span><small>{storage ? "Budget de simulation" : "Trésorerie"}</small><strong>{known ? formatPrice(wallet.cashCents) : "À vérifier"}</strong></span></p>
      <button type="button" data-care-shop-refresh onClick={() => void refresh()} disabled={!!pending} aria-label="Actualiser la réserve"><RefreshCw size={16} aria-hidden="true" /></button>
      {onClose ? <button type="button" className={styles.close} onClick={onClose} disabled={!!pending}>Fermer</button> : null}
    </header>
    <p className={styles.intro}>{reserveView ? "Utiliser consomme une charge de ta réserve. Acheter ajoute une charge, sans l’utiliser." : "Achète tes charges ici, puis utilise-les depuis le suivi de ta culture."}</p>
    {loading ? <p role="status">Vérification des stocks et de la trésorerie…</p> : loadError ? <p role="alert" className={styles.error}>{loadError}</p> : null}
    {notice ? <p role="status" className={styles.notice}>{notice}</p> : null}
    <div className={styles.tabs} role="group" aria-label="Rayon">
      {reserveView ? <button type="button" disabled={!!pending} aria-pressed={view === "context"} onClick={() => setView("context")}><span>Pour cette culture · {matches.length}</span></button> : null}
      <button type="button" disabled={!!pending} aria-pressed={view === "input"} onClick={() => setView("input")}><Leaf size={17} aria-hidden="true" /><span>Intrants du sol vivant</span></button>
      <button type="button" disabled={!!pending} aria-pressed={view === "pbi"} onClick={() => setView("pbi")}><Bug size={17} aria-hidden="true" /><span>Protection biologique</span></button>
    </div>
    <p className={styles.rayonHint}>{view === "context" ? "Produits ciblant les problèmes observés. Vérifie leurs conditions d’utilisation." : view === "input" ? "Soutiens du sol et de la plante" : "PBI · deux bilans, à engager au plus tard en floraison"}<span>{state?.campaign ? "Une charge pour les cultures réunies" : "Effets évalués aux validations"}</span></p>
    {view === "context" && !products.length ? <p className={styles.empty}>{state?.care?.problems.length ? "Aucun produit ne cible les problèmes observés. Les autres rayons restent consultables." : "Aucun problème observé. Tu peux continuer ta culture et consulter les autres rayons si besoin."}</p> : null}
    <div className={styles.products}>{products.map(product => {
      const permission = state ? canApplyKqCareProduct(state, product.code) : null;
      const stock = known ? wallet.inventory[product.code] ?? 0 : null;
      const price = known ? wallet.prices[product.code] : undefined;
      const artwork = getKqCareProductArtwork(product.code);
      const insufficientCash = known && price !== undefined && wallet.cashCents < price;
      const retryBuy = receipts.current.has(product.code);
      const verifyUse = retryApply === product.code;
      const canUse = Boolean(onApply && permission);
      return <article className={styles.product} key={product.code} data-care-product={product.code} data-stocked={stock !== null && stock > 0 || undefined}>
        <div className={styles.productMain}>
          <div className={styles.illustration}>{artwork ? <Image src={artwork.src} alt={artwork.alt} width={72} height={72} sizes="72px" className={styles.productImage} /> : <Leaf aria-hidden="true" />}</div>
          <div className={styles.productIdentity}>
            <small className={styles.stock} data-stocked={stock !== null && stock > 0 || undefined}>{stock === null ? "Stock à vérifier" : `${stock} en réserve`}</small>
            <h3>{product.name}</h3>
            <span className={styles.target}><span>Cible</span>{product.targets.map(target => TARGET_LABELS[target] ?? target).join(" · ")}</span>
            {product.pbi ? <small className={styles.role}>{product.pbi.role}</small> : null}
          </div>
        </div>
        <footer className={styles.productActions}>
          {canUse ? <button type="button" data-care-product-use className={styles.use} disabled={disabled || !!pending || (!verifyUse && (!known || !stock || !permission?.allowed || !!retryApply))} onClick={() => void act(product.code, true)}>{verifyUse ? "Vérifier l’intervention" : "Utiliser · 1 charge"}</button> : null}
          <span className={styles.price}><strong>{price === undefined ? "Prix à vérifier" : formatPrice(price)}</strong><small>pour acheter 1 charge</small></span>
          <button type="button" data-care-product-buy className={styles.buy} disabled={disabled || !!pending || (!retryBuy && (!known || price === undefined || insufficientCash))} onClick={() => void act(product.code, false)}>{retryBuy ? "Vérifier l’achat" : "Acheter 1 charge"}</button>
        </footer>
        {permission ? <small className={styles.reason} data-available={stock !== null && stock > 0 && permission.allowed || undefined}>{verifyUse ? "Vérifie la demande déjà envoyée, sans consommer une deuxième charge." : !permission.allowed ? permission.reason : stock === null ? "Vérifie ta réserve avant de choisir une intervention." : !stock ? "Aucune charge en réserve. L’achat et l’utilisation sont deux actions distinctes." : permission.reason}</small> : null}
        {retryBuy ? <small className={styles.reason}>Une demande d’achat reste à vérifier. La même demande ne sera pas débitée deux fois.</small> : null}
        {insufficientCash ? <small className={styles.cashHint}>Trésorerie insuffisante pour cet achat.</small> : null}
        <details className={styles.details}>
          <summary>Comprendre son rôle <ChevronDown size={14} aria-hidden="true" /></summary>
          <p>{product.description}</p>
        </details>
      </article>;
    })}</div>
  </section>;
}
