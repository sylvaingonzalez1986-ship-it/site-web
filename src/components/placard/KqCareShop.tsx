"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Bug, ChevronDown, Leaf, RefreshCw, Wallet } from "lucide-react";
import { KQ_CARE_PRODUCTS, canApplyKqCareProduct } from "@/lib/kanab-quest-care";
import { getKqCareProductArtwork } from "@/lib/kanab-quest-care-artwork";
import { getKqRemoteCareShop, purchaseKqRemoteCareProduct } from "@/lib/kanab-quest-api";
import { buyKqLocalCare, getKqLocalCareSnapshot, type KqCareStorage } from "@/lib/kanab-quest-care-local";
import { createClientRequestKey } from "@/lib/client-request-key";
import type { KqGameState } from "@/lib/kanab-quest-game";
import { getKqCareActionAvailability, getKqCareAvailabilityScope, getKqCareReserveProducts, parseKqCareReserveSnapshot, type KqCareReserveSnapshot } from "@/lib/kanab-quest-care-reserve";
import styles from "./KqCareShop.module.css";
import { KqHelpDashboard, KqHelpGrid, KqHelpNote, KqHelpSteps } from "./KqHelpDashboard";
import { KqActionBadge } from "./KqActionBadge";

const TARGET_LABELS: Record<string, string> = {
  roots: "Racines", nutrition: "Nutrition", stress: "Stress",
  aphids: "Pucerons", mites: "Tétranyques", thrips: "Thrips",
};
const formatPrice = (cents: number) => (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export function KqCareShop({ request, storage, state, runId, disabled, embedded, refreshKey, reserveState, onApply, onBusyChange, onPurchased, onClose, onRecoveryChange }: {
  request: typeof fetch; storage?: KqCareStorage; state?: KqGameState; runId?: string | null; disabled?: boolean;
  embedded?: boolean; refreshKey?: number; onPurchased?: (cashCents: number) => void;
  onApply?: (productCode: string) => Promise<void>; onBusyChange?: (busy: boolean) => void; onClose?: () => void;
  onRecoveryChange?: (recovering: boolean) => void;
  reserveState?: { snapshot: KqCareReserveSnapshot | null; loading: boolean; error: string; recovering?: boolean; refresh: () => Promise<void> };
}) {
  const reserveView = Boolean(state && onApply);
  const [view, setView] = useState<"context" | "input" | "pbi">(reserveView ? "context" : "input");
  const [localWallet, setWallet] = useState<KqCareReserveSnapshot | null>(null);
  const [localLoading, setLoading] = useState(true);
  const [localError, setLoadError] = useState("");
  const [walletScope, setWalletScope] = useState<string | null>(null);
  const snapshotScope = state ? getKqCareAvailabilityScope(state, runId) : runId ?? "shop";
  const wallet = reserveState ? reserveState.snapshot : walletScope === snapshotScope ? localWallet : null;
  const loading = reserveState ? reserveState.loading : localLoading;
  const loadError = reserveState ? reserveState.error : localError;
  const sharedRefresh = reserveState?.refresh;
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  const refreshGeneration = useRef(0);
  const receipts = useRef(new Map<string, { requestKey: string; runId?: string; expectedPriceCents: number }>());
  const [applyReceipt, setApplyReceipt] = useState<{ code: string; scope: string } | null>(null);
  const applyScope = `${state?.seed}:${state?.stageIndex}:${state?.phase}`;
  const retryApply = applyReceipt?.scope === applyScope ? applyReceipt.code : null;
  const recovering = !!retryApply || receipts.current.size > 0;
  useEffect(() => { onRecoveryChange?.(recovering); }, [onRecoveryChange, recovering]);
  const refresh = useCallback(async () => {
    if (sharedRefresh) return sharedRefresh();
    const generation = ++refreshGeneration.current;
    setLoading(true); setLoadError(""); setWallet(null);
    try {
      const result = storage ? getKqLocalCareSnapshot(storage, state) : await getKqRemoteCareShop(request, state?.campaign?.leaderRunId ?? runId ?? undefined);
      const next = parseKqCareReserveSnapshot(result);
      if (!next) throw new Error("Réserve incomplète. Actualise pour vérifier les stocks et la trésorerie.");
      if (generation === refreshGeneration.current) { setWallet(next); setWalletScope(snapshotScope); }
    } catch (error) {
      if (generation === refreshGeneration.current) setLoadError(error instanceof Error ? error.message : "Réserve indisponible. Actualise pour réessayer.");
    } finally {
      if (generation === refreshGeneration.current) setLoading(false);
    }
  }, [request, storage, state, runId, sharedRefresh, snapshotScope]);
  useEffect(() => {
    if (!sharedRefresh) void refresh();
    return () => { refreshGeneration.current += 1; };
  }, [refresh, sharedRefresh, refreshKey, state?.care?.applications.length]);
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
        if (!sharedRefresh) await refresh();
      }
      else if (storage) {
        const result = buyKqLocalCare(storage, code, state);
        await refresh();
        onPurchased?.(result.cashCents);
      }
      else {
        const receipt = receipts.current.get(code) ?? { requestKey: createClientRequestKey(), runId: state?.campaign?.leaderRunId ?? runId ?? undefined, expectedPriceCents: wallet!.prices[code] };
        receipts.current.set(code, receipt);
        const result = await purchaseKqRemoteCareProduct({ productCode: code, quantity: 1, ...receipt }, request);
        replayedPurchase = result.replayed;
        receipts.current.delete(code);
        await refresh();
        if (Number.isSafeInteger(result.cashCents) && result.cashCents >= 0) onPurchased?.(result.cashCents);
      }
      setNotice(apply ? "Intervention engagée. Son effet sera évalué au prochain bilan." : replayedPurchase ? "Achat déjà enregistré. Aucun nouveau débit." : "Produit ajouté à la réserve. Achat réglé.");
    } catch (error) {
      // This explicit server rejection is raised before any purchase is recorded.
      if (!apply && error instanceof Error && error.message === "Le prix ou la surface a changé. Actualise le suivi avant de confirmer.") receipts.current.delete(code);
      setNotice(error instanceof Error ? error.message : "Opération impossible. Réessaie."); await refresh();
    }
    finally { lock.current = false; setPending(null); onBusyChange?.(false); }
  };
  const matches = getKqCareReserveProducts(state);
  const products = view === "context" ? matches.map(match => match.product) : KQ_CARE_PRODUCTS.filter(product => product.kind === view);
  const known = !!wallet && !loading && !loadError;
  const actions = getKqCareActionAvailability(known && !disabled && !pending && !recovering && !reserveState?.recovering ? wallet : null, state);
  const rayonCounts = reserveView ? actions?.usable : actions?.affordable;
  const badgeLabel = (count?: number) => reserveView ? count === 1 ? "produit utilisable" : "produits utilisables" : count === 1 ? "achat possible" : "achats possibles";
  return <section className={styles.shop} data-embedded={embedded || undefined} data-reserve={reserveView || undefined} data-care-view={view} data-care-reserve-status={loading ? "loading" : loadError ? "error" : "ready"} aria-label="Intrants et protection biologique" aria-busy={!!pending || loading}>
    <header className={styles.heading}>
      <div className={styles.title}>
        <h2>{reserveView ? "Mes produits de soin" : "Intrants & PBI"}</h2>
      </div>
      <p className={styles.balance}><Wallet size={17} aria-hidden="true" /><span><small>{storage ? "Budget de simulation" : "Trésorerie"}</small><strong>{known ? formatPrice(wallet.cashCents) : "À vérifier"}</strong></span></p>
      <button type="button" data-care-shop-refresh onClick={() => void refresh()} disabled={!!pending} aria-label="Actualiser la réserve"><RefreshCw size={16} aria-hidden="true" /></button>
      {onClose ? <button type="button" className={styles.close} onClick={onClose} disabled={!!pending}>Fermer</button> : null}
    </header>
    <p className={styles.intro}>{reserveView ? "Un passage couvre cette culture. L’achat ajoute le produit à ta réserve ; son utilisation reste une action séparée." : "Achète de la couverture en m², puis utilise tes produits depuis le suivi de la culture."}</p>
    {loading ? <p role="status">Vérification des stocks et de la trésorerie…</p> : loadError ? <p role="alert" className={styles.error}>{loadError}</p> : null}
    {notice ? <p role="status" className={styles.notice}>{notice}</p> : null}
    <div className={styles.tabs} role="group" aria-label="Rayon">
      {reserveView ? <button type="button" data-care-rayon="context" disabled={!!pending} aria-pressed={view === "context"} onClick={() => setView("context")}><span>Pour cette culture</span><KqActionBadge count={actions?.usable.context} label={badgeLabel(actions?.usable.context)} /></button> : null}
      <button type="button" data-care-rayon="input" disabled={!!pending} aria-pressed={view === "input"} onClick={() => setView("input")}><Leaf size={17} aria-hidden="true" /><span>Intrants du sol vivant</span><KqActionBadge count={rayonCounts?.input} label={badgeLabel(rayonCounts?.input)} /></button>
      <button type="button" data-care-rayon="pbi" disabled={!!pending} aria-pressed={view === "pbi"} onClick={() => setView("pbi")}><Bug size={17} aria-hidden="true" /><span>Protection biologique</span><KqActionBadge count={rayonCounts?.pbi} label={badgeLabel(rayonCounts?.pbi)} /></button>
    </div>
    <p className={styles.rayonHint}>{view === "context" ? "Produits ciblant les problèmes observés. Vérifie leurs conditions d’utilisation." : view === "input" ? "Soutiens du sol et de la plante" : "PBI · deux bilans, à engager au plus tard en floraison"}<span>{!known ? "Surface et tarifs à vérifier" : wallet.areaM2 != null ? `Prix pour ${wallet.areaM2.toLocaleString("fr-FR")} m²${state?.campaign ? " de cultures réunies" : ""} · un passage` : state ? "Prix pour cette culture · surface non enregistrée" : "Achat de réserve · couverture de 1 m²"}</span></p>
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
            <small className={styles.stock} data-stocked={stock !== null && stock > 0 || undefined}>{stock === null ? "Stock à vérifier" : `${stock} passage${stock > 1 ? "s" : ""} disponible${stock > 1 ? "s" : ""}`}</small>
            <h3>{product.name}</h3>
            <span className={styles.target}><span>Cible</span>{product.targets.map(target => TARGET_LABELS[target] ?? target).join(" · ")}</span>
            {product.pbi ? <small className={styles.role}>{product.pbi.role}</small> : null}
          </div>
        </div>
        <footer className={styles.productActions}>
          {canUse ? <button type="button" data-care-product-use className={styles.use} disabled={disabled || !!pending || (!verifyUse && (!known || !stock || !permission?.allowed || !!retryApply))} onClick={() => void act(product.code, true)}>{verifyUse ? "Vérifier l’intervention" : "Utiliser · 1 passage"}</button> : null}
          <span className={styles.price}><strong>{price === undefined ? "Prix à vérifier" : formatPrice(price)}</strong><small>{known && wallet.areaM2 != null ? `pour ${wallet.areaM2.toLocaleString("fr-FR")} m²` : "pour 1 passage"}</small></span>
          <button type="button" data-care-product-buy className={styles.buy} disabled={disabled || !!pending || (!retryBuy && (!known || price === undefined || insufficientCash))} onClick={() => void act(product.code, false)}>{retryBuy ? "Vérifier l’achat" : "Acheter 1 passage"}</button>
        </footer>
        {permission ? <small className={styles.reason} data-available={stock !== null && stock > 0 && permission.allowed || undefined}>{verifyUse ? "Vérifie la demande déjà envoyée, sans consommer une deuxième charge." : !permission.allowed ? permission.reason : stock === null ? "Vérifie ta réserve avant de choisir une intervention." : !stock ? "Aucune charge en réserve. L’achat et l’utilisation sont deux actions distinctes." : permission.reason}</small> : null}
        {retryBuy ? <small className={styles.reason}>Une demande d’achat reste à vérifier. La même demande ne sera pas débitée deux fois.</small> : null}
        {insufficientCash ? <small className={styles.cashHint}>Trésorerie insuffisante pour cet achat.</small> : null}
        <details className={styles.details}>
          <summary>Comprendre son rôle <ChevronDown size={14} aria-hidden="true" /></summary>
          <KqHelpDashboard>
            {known && (wallet.legacyInventory || wallet.areaInventory) ? <KqHelpNote>Réserve : {wallet.legacyInventory?.[product.code] ?? 0} ancien{(wallet.legacyInventory?.[product.code] ?? 0) > 1 ? "s" : ""} passage{(wallet.legacyInventory?.[product.code] ?? 0) > 1 ? "s" : ""} complet{(wallet.legacyInventory?.[product.code] ?? 0) > 1 ? "s" : ""}, et {(wallet.areaInventory?.[product.code] ?? 0).toLocaleString("fr-FR")} m² de couverture. Les nouveaux achats couvrent la surface indiquée ; le stock reste utilisable sur les autres cultures, selon leur surface.</KqHelpNote> : null}
            {product.pbi ? <KqHelpSteps art="help-care" steps={product.pbi.reductions.map((reduction, index) => ({
              label: `${index + 1}${index === 0 ? "er" : "e"} bilan de jeu`,
              detail: reduction ? `Gravité : −${reduction} niveau${reduction > 1 ? "x" : ""}.` : "Foyer contenu.",
            }))} /> : <KqHelpGrid art="help-care" items={[{ label: "Soutien ciblé", value: product.targets.map(target => TARGET_LABELS[target] ?? target).join(" · "), detail: "Effet évalué à la validation." }]} />}
            <KqHelpNote>{product.description}</KqHelpNote>
          </KqHelpDashboard>
        </details>
      </article>;
    })}</div>
  </section>;
}
