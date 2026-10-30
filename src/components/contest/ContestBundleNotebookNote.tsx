"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Gift } from "lucide-react";
import Link from "@/components/navigation/NavigationLink";
import { ContestBundleCardReveal } from "@/components/checkout/ContestBundleCardReveal";
import type { ContestBundleOffer, ContestBundleReceipt, ContestBundleRewards } from "@/lib/contest-bundle-rewards";
import styles from "./ContestBundleNotebookNote.module.css";

type Props = {
  offer?: ContestBundleOffer | null;
  flowerEntries?: readonly { productId: string; entryId: string }[];
  onSelectFlower?: (entryId: string) => void;
  onOfferChange?: (offer: ContestBundleOffer) => void;
  loginHref?: string;
  compact?: boolean;
};

export function ContestBundleNotebookNote({ offer: initialOffer, flowerEntries = [], onSelectFlower, onOfferChange, loginHref = "/compte/connexion?next=%2Farene%2Fcarnet%2Fconcours", compact = false }: Props) {
  const [updated, setUpdated] = useState<{ source: typeof initialOffer; value: ContestBundleOffer } | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState("");
  const [receiptRead, setReceiptRead] = useState<{
    grantedAt: string;
    receipt: ContestBundleReceipt | null;
    error: string;
    autoOpen: boolean;
  } | null>(null);
  const [receiptAttempt, setReceiptAttempt] = useState(0);
  const busyRef = useRef(false);
  const mountedRef = useRef(false);
  const offer = updated && updated.source === initialOffer ? updated.value : initialOffer;
  const grantedAt = offer?.progress?.rewarded ? offer.progress.grantedAt : null;
  const currentReceipt = grantedAt && receiptRead?.grantedAt === grantedAt ? receiptRead : null;
  const hasReceipt = Boolean(currentReceipt?.receipt);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!grantedAt || hasReceipt) return;
    const controller = new AbortController();
    void (async () => {
      try {
        // The reward is already owned. A read retrieves the original draw without granting again.
        const response = await fetch("/api/account/contest-bundle-rewards", { credentials: "include", cache: "no-store", signal: controller.signal });
        const payload = await response.json().catch(() => null) as { rewards?: ContestBundleRewards } | null;
        const receipt = payload?.rewards?.receipts.find((item) => item.grantedAt === grantedAt);
        if (!response.ok || !receipt) throw new Error(response.status === 401
          ? "Reconnecte-toi pour retrouver ta carte Concours."
          : "Ta carte est créditée, mais son aperçu est indisponible. Tu peux réessayer.");
        if (!controller.signal.aborted) setReceiptRead({ grantedAt, receipt, error: "", autoOpen: false });
      } catch (cause) {
        if (!controller.signal.aborted) setReceiptRead({ grantedAt, receipt: null, error: cause instanceof Error ? cause.message : "Impossible de retrouver ta carte. Tu peux réessayer.", autoOpen: false });
      }
    })();
    return () => controller.abort();
  }, [grantedAt, hasReceipt, receiptAttempt]);

  const offerActive = Boolean(offer?.available && offer.flowers.length > 0);
  if (!offer || (!offerActive && !offer.progress?.rewarded)) return null;
  const entryByProduct = new Map(flowerEntries.map((entry) => [entry.productId, entry.entryId]));
  const formatGrams = (value: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value);
  const minGrams = formatGrams(offer.minGrams);
  const progress = offer.progress;
  const progressByProduct = new Map(progress?.flowers.map((flower) => [flower.productId, flower]) ?? []);

  const claimBonus = async () => {
    if (busyRef.current || !progress?.eligible || progress.rewarded) return;
    busyRef.current = true;
    setClaiming(true);
    setError("");
    try {
      const response = await fetch("/api/account/contest-bundle-rewards", { method: "POST", credentials: "include", cache: "no-store" });
      const payload = await response.json().catch(() => null) as { rewards?: ContestBundleRewards; error?: string } | null;
      if (!response.ok || !payload?.rewards?.progress) {
        throw new Error(response.status === 401 ? "Reconnecte-toi pour débloquer ton bonus." : payload?.error || "Le bonus n’a pas pu être débloqué. Tu peux réessayer.");
      }
      const { available, startsAt, minGrams, buddiesPacks, bottePacks, flowers, progress: nextProgress } = payload.rewards;
      const nextOffer: ContestBundleOffer = { available, startsAt, minGrams, buddiesPacks, bottePacks, flowers, progress: nextProgress };
      const receipt = payload.rewards.receipts.find((item) => item.grantedAt === nextProgress.grantedAt);
      if (mountedRef.current && nextProgress.rewarded && nextProgress.grantedAt && receipt) {
        setReceiptRead({ grantedAt: nextProgress.grantedAt, receipt, error: "", autoOpen: true });
      }
      onOfferChange?.(nextOffer);
      if (!mountedRef.current) return;
      setUpdated({ source: initialOffer, value: nextOffer });
      if (!nextProgress.rewarded) setError(nextProgress.eligible ? "Le bonus n’a pas encore été attribué. Réessaie dans un instant." : "Ta progression a été actualisée. Toutes les fleurs doivent atteindre le seuil pour débloquer le bonus.");
    } catch (cause) {
      if (mountedRef.current) setError(cause instanceof Error ? cause.message : "Impossible de débloquer le bonus. Tu peux réessayer.");
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setClaiming(false);
    }
  };

  return (
    <aside className={styles.note} data-contest-bundle-note data-compact={compact || undefined} aria-label="Bonus du grand tour des fleurs concours">
      <p className={styles.title}><Gift size={17} aria-hidden="true" /><strong>Ton bonus Concours</strong></p>
      {offerActive ? <>
      <p className={styles.condition}>Cumule au moins <strong>{minGrams} g de chaque fleur concours</strong>, toutes cultures confondues, <strong>sur une ou plusieurs commandes payées</strong> :</p>
      <ul className={styles.rewards} aria-label="Les récompenses du grand tour">
        <li><strong>1 carte Buddies épique</strong> aléatoire</li>
        <li><strong>{offer.buddiesPacks} packs Buddies</strong> + <strong>{offer.bottePacks} packs Botte du Chanvrier</strong></li>
      </ul>
      <p className={styles.rule}>Tes achats payés, y compris les précédents, s’additionnent. Sans avis à déposer. Ce bonus se débloque une seule fois par compte.</p>
      {progress ? <div className={styles.progress} role="status">
        <p><strong>{progress.rewarded ? "Bonus déjà débloqué" : progress.eligible ? "Ton bonus est prêt à être débloqué" : `${progress.completedCount} / ${progress.requiredCount} fleurs complétées`}</strong></p>
        <progress max={Math.max(1, progress.requiredCount)} value={progress.completedCount} aria-label="Fleurs achetées au seuil requis" />
      </div> : <p className={styles.login}><Link href={loginHref}>Connecte-toi pour voir ta progression</Link> et cumuler tes achats.</p>}
      <ul className={styles.checklist} data-contest-bundle-checklist aria-label="Progression des achats par fleur">{offer.flowers.map((flower) => {
          const entryId = entryByProduct.get(flower.productId);
          const purchase = progressByProduct.get(flower.productId);
          const missing = purchase ? Math.max(0, Math.round((offer.minGrams - purchase.purchasedGrams) * 10) / 10) : null;
          return <li key={flower.productId} data-contest-bundle-product={flower.productId} data-complete={purchase?.complete || undefined}>
            {purchase ? <input type="checkbox" checked={purchase.complete} disabled aria-label={`${flower.title} : ${purchase.complete ? "objectif atteint" : "objectif à compléter"}`} /> : <span className={styles.unknown} aria-hidden="true" />}
            <div>{entryId && onSelectFlower
              ? <button type="button" onClick={() => onSelectFlower(entryId)} aria-label={`Voir la fleur ${flower.title}`}><span>{flower.title}</span><ChevronRight size={15} aria-hidden="true" /></button>
              : <span className={styles.flowerName}>{flower.title}</span>}
              <p>{purchase ? <>{formatGrams(purchase.purchasedGrams)} / {minGrams} g achetés · {purchase.complete ? "Objectif atteint" : `Encore ${formatGrams(missing ?? 0)} g`}</> : progress ? "Progression indisponible pour cette fleur" : `Objectif : ${minGrams} g après connexion`}</p>
            </div>
          </li>;
        })}</ul>
      </> : <p>Ton bonus est déjà débloqué. Ta carte et tes packs restent disponibles.</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {progress?.eligible && !progress.rewarded && <button type="button" className={styles.claim} onClick={() => void claimBonus()} disabled={claiming}><Gift size={16} aria-hidden="true" />{claiming ? "Déblocage en cours…" : "Débloquer mon bonus"}</button>}
      {progress?.rewarded && <div className={styles.success}>
        <p><Check size={16} aria-hidden="true" /> Ta carte et tes packs ont été crédités.</p>
        {currentReceipt?.receipt
          ? <ContestBundleCardReveal receipt={currentReceipt.receipt} autoOpen={currentReceipt.autoOpen} />
          : currentReceipt?.error
            ? <><p className={styles.error} role="alert">{currentReceipt.error}</p><button type="button" className={styles.claim} onClick={() => { setReceiptRead(null); setReceiptAttempt((attempt) => attempt + 1); }}>Réessayer de retrouver ma carte</button></>
            : <p role="status">Recherche de ta carte Concours…</p>}
        <nav aria-label="Mes récompenses Concours"><Link href="/profil/collection">Mes Buddies</Link><Link href="/arene/placard?view=shop">Mes packs Botte du Chanvrier</Link></nav>
      </div>}
      <p className={styles.rule}>Chaque pack Buddies contient 3 cartes ; chaque pack Botte du Chanvrier, 10 cartes. Tes récompenses habituelles s’ajoutent à ce bonus.</p>
    </aside>
  );
}
