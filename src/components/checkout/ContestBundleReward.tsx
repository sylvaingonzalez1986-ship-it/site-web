"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Check, Gift, Sparkles } from "lucide-react";
import Link from "@/components/navigation/NavigationLink";
import {
  getContestBundleCartProgress,
  type ContestBundleCartItem,
  type ContestBundleRewards,
} from "@/lib/contest-bundle-rewards";
import type { CmsOrder } from "@/types/store";
import styles from "./ContestBundleReward.module.css";

const rewardsUrl = "/api/account/contest-bundle-rewards";
const formatGrams = (grams: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(grams);

async function loadRewards(signal: AbortSignal, method: "GET" | "POST") {
  const response = await fetch(rewardsUrl, { method, credentials: "include", cache: "no-store", signal });
  if (!response.ok) return null;
  const payload = await response.json() as { rewards?: ContestBundleRewards };
  return payload.rewards ?? null;
}

export function ContestBundleRewardPreview({ items, active }: { items: ContestBundleCartItem[]; active: boolean }) {
  const titleId = useId();
  const [rewards, setRewards] = useState<ContestBundleRewards | null>(null);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    void loadRewards(controller.signal, "GET")
      .then((result) => { if (!controller.signal.aborted) setRewards(result); })
      .catch(() => { if (!controller.signal.aborted) setRewards(null); });
    return () => controller.abort();
  }, [active]);

  const progress = useMemo(() => getContestBundleCartProgress(rewards?.flowers ?? [], items, rewards?.progress?.flowers ?? []), [rewards?.flowers, rewards?.progress?.flowers, items]);
  if (!active || !rewards) return null;
  if (rewards.progress?.rewarded) return <aside className={styles.card} aria-labelledby={titleId}>
    <p className={styles.title} id={titleId}><Check size={18} aria-hidden="true" /> Bonus Concours déjà débloqué</p>
    <p>Ta carte épique et tes packs ont été crédités. Ce bonus est unique pour ton compte.</p>
    <nav className={styles.links} aria-label="Mes récompenses Concours"><Link href="/profil/collection">Mes Buddies</Link><Link href="/arene/placard?view=shop">Mes packs Botte du Chanvrier</Link></nav>
  </aside>;
  if (!rewards.available || progress.requiredCount === 0) return null;

  return (
    <aside className={styles.card} aria-labelledby={titleId} data-complete={progress.eligible || undefined}>
      <p className={styles.title} id={titleId}><Gift size={18} aria-hidden="true" /> Le grand tour des fleurs concours</p>
      <p>Cumule au moins <strong>{formatGrams(rewards.minGrams)} g de chaque fleur concours</strong> sur une ou plusieurs commandes payées pour recevoir :</p>
      <ul className={styles.rewards} aria-label="Bonus du grand tour">
        <li><strong>1</strong><span>carte Buddies <b>épique</b><small>Tirée au sort</small></span></li>
        <li><strong>{rewards.buddiesPacks}</strong><span>packs <b>Buddies</b><small>3 cartes par pack</small></span></li>
        <li><strong>{rewards.bottePacks}</strong><span>packs <b>Botte du Chanvrier</b><small>10 cartes par pack</small></span></li>
      </ul>
      <div className={styles.progress}>
        <p className={styles.progressLabel} aria-live="polite">{rewards.progress?.eligible ? <><Check size={16} aria-hidden="true" /> Tes achats payés remplissent déjà les conditions</> : progress.eligible ? <><Check size={16} aria-hidden="true" /> Objectif atteint après paiement de ce panier</> : `${progress.completedCount} / ${progress.requiredCount} fleurs à ${formatGrams(rewards.minGrams)} g avec ce panier`}</p>
        <progress max={progress.requiredCount} value={progress.completedCount} aria-label="Fleurs concours complétées" />
      </div>
      <details className={styles.requirements} open>
        <summary>Voir les fleurs et les quantités</summary>
        <ul>{progress.flowers.map((flower) => <li key={flower.productId} data-contest-bundle-product={flower.productId} data-complete={flower.complete || undefined}>
          <span><strong>{flower.title}</strong><small>{rewards.progress ? `${formatGrams(flower.purchasedGrams)} g déjà payés + ` : ""}{formatGrams(flower.cartGrams)} g dans ce panier</small><small>{formatGrams(flower.grams)} / {formatGrams(rewards.minGrams)} g {rewards.progress ? "cumulés après paiement" : "dans ce panier"}</small></span>
          <span className={styles.flowerStatus}>{flower.complete ? <><Check size={14} aria-hidden="true" /> OK</> : `Encore ${formatGrams(flower.missingGrams)} g`}</span>
        </li>)}</ul>
      </details>
      {!rewards.progress && <p className={styles.detail}><Link href="/compte/connexion?next=%2Farene%2Fcarnet%2Fconcours">Connecte-toi</Link> pour inclure tes achats déjà payés dans la progression.</p>}
      {rewards.progress?.eligible && <Link className={styles.claimLink} href="/arene/carnet/concours">Débloquer mon bonus dans le Carnet</Link>}
      <p className={styles.detail}>Estimation : seuls les achats payés comptent. Tes commandes précédentes s’ajoutent aux prochaines, jusqu’à atteindre le seuil de chaque fleur.</p>
      <p className={styles.detail}>Un seul bonus par compte, sans avis à déposer. Tes récompenses habituelles s’y ajoutent.</p>
    </aside>
  );
}

export function ContestBundleRewardReceipt({ orderId, paymentState }: { orderId: string; paymentState: CmsOrder["paymentState"] }) {
  const titleId = useId();
  const [loaded, setLoaded] = useState<{ orderId: string; receipt: ContestBundleRewards["receipts"][number] | null } | null>(null);

  useEffect(() => {
    if (paymentState !== "paid") return;
    const controller = new AbortController();
    void loadRewards(controller.signal, "POST")
      .then((result) => {
        if (!controller.signal.aborted) setLoaded({ orderId, receipt: result?.receipts.find((receipt) => receipt.orderId === orderId) ?? null });
      })
      .catch(() => { if (!controller.signal.aborted) setLoaded({ orderId, receipt: null }); });
    return () => controller.abort();
  }, [orderId, paymentState]);

  const receipt = loaded?.orderId === orderId ? loaded.receipt : null;
  if (paymentState !== "paid" || !receipt) return null;

  return (
    <aside className={styles.card} aria-labelledby={titleId}>
      <p className={styles.title} id={titleId}><Gift size={18} aria-hidden="true" /> Ton bonus concours</p>
      <p className={styles.credited}><Check size={17} aria-hidden="true" /> Récompenses Concours créditées</p>
      <p>Tes achats payés ont complété le cumul requis des fleurs concours. Ton bonus a été ajouté à tes collections :</p>
      <div className={styles.epicCard}><Sparkles size={22} aria-hidden="true" /><span><small>1 carte Buddies épique</small><strong>{receipt.card.name}</strong></span></div>
      <ul className={styles.receiptPacks} aria-label="Packs crédités">
        <li><strong>{receipt.buddiesPacks} pack{receipt.buddiesPacks > 1 ? "s" : ""} Buddies</strong><span>3 cartes par pack</span></li>
        <li><strong>{receipt.bottePacks} pack{receipt.bottePacks > 1 ? "s" : ""} Botte du Chanvrier</strong><span>10 cartes par pack</span></li>
      </ul>
      <p>Ce bonus s’ajoute à tes récompenses habituelles. Il est attribué une seule fois par compte.</p>
      <nav className={styles.links} aria-label="Retrouver mes récompenses concours"><Link href="/profil/collection">Mes cartes et packs Buddies</Link><Link href="/arene/placard?view=shop">Mes packs Botte du Chanvrier</Link></nav>
    </aside>
  );
}
