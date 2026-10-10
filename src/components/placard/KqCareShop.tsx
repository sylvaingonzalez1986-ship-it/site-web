"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Bug, ChevronDown, Leaf, Wallet } from "lucide-react";
import { KQ_CARE_PRODUCTS, canApplyKqCareProduct } from "@/lib/kanab-quest-care";
import { getKqCareProductArtwork } from "@/lib/kanab-quest-care-artwork";
import { getKqRemoteCareShop, purchaseKqRemoteCareProduct } from "@/lib/kanab-quest-api";
import { buyKqLocalCare, loadKqLocalCare, type KqCareStorage } from "@/lib/kanab-quest-care-local";
import { createClientRequestKey } from "@/lib/client-request-key";
import type { KqGameState } from "@/lib/kanab-quest-game";
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
  const [kind, setKind] = useState<"input" | "pbi">("input");
  const [wallet, setWallet] = useState<{ cashCents: number; inventory: Record<string, number> } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  const refreshGeneration = useRef(0);
  const receipt = useRef<{ code: string; key: string } | null>(null);
  const refresh = useCallback(async () => {
    const generation = ++refreshGeneration.current;
    if (storage) { setWallet(loadKqLocalCare(storage)); return; }
    const result = await getKqRemoteCareShop(request);
    if (generation !== refreshGeneration.current) return;
    setWallet({ cashCents: result.cashCents, inventory: Object.fromEntries(result.inventory.map(item => [item.productCode, item.quantity])) });
  }, [request, storage]);
  useEffect(() => {
    let active = true;
    void refresh().catch(error => { if (active) setNotice(error instanceof Error ? error.message : "Réserve indisponible."); });
    return () => { active = false; refreshGeneration.current += 1; };
  }, [refresh, refreshKey, state?.care?.applications.length]);
  const act = async (code: string, apply: boolean) => {
    if (lock.current || disabled) return;
    refreshGeneration.current += 1;
    lock.current = true; setPending(code); setNotice(""); onBusyChange?.(true);
    try {
      if (apply) { await onApply?.(code); await refresh(); }
      else if (storage) {
        const result = buyKqLocalCare(storage, code);
        refreshGeneration.current += 1;
        setWallet(result);
        onPurchased?.(result.cashCents);
      }
      else {
        if (receipt.current?.code !== code) receipt.current = { code, key: createClientRequestKey() };
        const result = await purchaseKqRemoteCareProduct({ productCode: code, quantity: 1, requestKey: receipt.current.key }, request);
        receipt.current = null;
        refreshGeneration.current += 1;
        setWallet({ cashCents: result.cashCents, inventory: Object.fromEntries(result.inventory.map(item => [item.productCode, item.quantity])) });
        onPurchased?.(result.cashCents);
      }
      setNotice(apply ? "Intervention engagée. Son effet sera évalué au prochain bilan." : "Une charge ajoutée à ta réserve.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Opération impossible. Réessaie."); }
    finally { lock.current = false; setPending(null); onBusyChange?.(false); }
  };
  const reserveView = Boolean(state && onApply);
  return <section className={styles.shop} data-embedded={embedded || undefined} data-reserve={reserveView || undefined} aria-label="Intrants et protection biologique" aria-busy={!!pending}>
    <header className={styles.heading}>
      <div className={styles.title}>
        <small>{reserveView ? "Interventions ciblées" : "Le matériel · soins de culture"}</small>
        <h2>{reserveView ? "Ma réserve" : "Intrants & PBI"}</h2>
      </div>
      <p className={styles.balance}><Wallet size={17} aria-hidden="true" /><span><small>{storage ? "Budget de simulation" : "Trésorerie"}</small><strong>{wallet ? formatPrice(wallet.cashCents) : "…"}</strong></span></p>
      {onClose ? <button type="button" className={styles.close} onClick={onClose} disabled={!!pending}>Fermer</button> : null}
    </header>
    <p className={styles.intro}>{reserveView ? "Choisis une intervention adaptée au problème observé. Acheter une charge ne l’utilise pas." : "Achète tes charges ici, puis utilise-les depuis le suivi de ta culture."}</p>
    <div className={styles.tabs} role="group" aria-label="Rayon">
      <button type="button" disabled={!!pending} aria-pressed={kind === "input"} onClick={() => setKind("input")}><Leaf size={17} aria-hidden="true" /><span>Intrants du sol vivant</span></button>
      <button type="button" disabled={!!pending} aria-pressed={kind === "pbi"} onClick={() => setKind("pbi")}><Bug size={17} aria-hidden="true" /><span>Protection biologique</span></button>
    </div>
    <p className={styles.rayonHint}>{kind === "input" ? "Soutiens du sol et de la plante" : "PBI · deux bilans, à engager au plus tard en floraison"}<span>{embedded ? "Réserve commune aux tentes" : "Effets évalués aux validations"}</span></p>
    <div className={styles.products}>{KQ_CARE_PRODUCTS.filter(product => product.kind === kind).map(product => {
      const permission = state ? canApplyKqCareProduct(state, product.code) : null;
      const stock = wallet?.inventory[product.code] ?? 0;
      const artwork = getKqCareProductArtwork(product.code);
      const insufficientCash = Boolean(wallet && wallet.cashCents < product.priceCents);
      const canUse = Boolean(onApply && permission);
      return <article className={styles.product} key={product.code} data-stocked={stock > 0 || undefined}>
        <div className={styles.productMain}>
          <div className={styles.illustration}><Image src={artwork.src} alt={artwork.alt} width={512} height={512} sizes="(max-width: 480px) 104px, 136px" className={styles.productImage} /></div>
          <div className={styles.productIdentity}>
            <small className={styles.stock} data-stocked={stock > 0 || undefined}>{stock} en réserve</small>
            <h3>{product.name}</h3>
            <span className={styles.target}><span>Cible</span>{product.targets.map(target => TARGET_LABELS[target] ?? target).join(" · ")}</span>
            {product.pbi ? <small className={styles.role}>{product.pbi.role}</small> : null}
          </div>
        </div>
        <details className={styles.details}>
          <summary>Comprendre son rôle <ChevronDown size={14} aria-hidden="true" /></summary>
          <p>{product.description}</p>
        </details>
        <footer className={styles.productActions}>
          <span className={styles.price}><strong>{formatPrice(product.priceCents)}</strong><small>par charge de jeu</small></span>
          <button type="button" className={styles.buy} disabled={disabled || !!pending || !wallet || insufficientCash} onClick={() => void act(product.code, false)}>Acheter 1 charge</button>
          {canUse ? <button type="button" className={styles.use} disabled={disabled || !!pending || !stock || !permission?.allowed} onClick={() => void act(product.code, true)}>Utiliser · 1 charge</button> : null}
        </footer>
        {permission ? <small className={styles.reason} data-available={stock > 0 && permission.allowed || undefined}>{!stock && permission.allowed ? "Achète une charge pour intervenir." : permission.reason}</small> : null}
        {insufficientCash ? <small className={styles.cashHint}>Trésorerie insuffisante pour cet achat.</small> : null}
      </article>;
    })}</div>
    {notice ? <p role="status" className={styles.notice}>{notice}</p> : null}
  </section>;
}
