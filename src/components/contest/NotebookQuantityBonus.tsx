"use client";

import { useEffect, useId, useState } from "react";
import Link from "@/components/navigation/NavigationLink";
import { Gift } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { getKqNotebookQuantityReward } from "@/lib/kanab-quest-notebook-quantity";
import type { KqProducerRewardProgress } from "@/lib/kanab-quest-producer-rewards";
import styles from "./NotebookQuantityBonus.module.css";

export const formatNotebookGameEuros = (cents: number) => new Intl.NumberFormat("fr-FR", {
  style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 2,
}).format(cents / 100);

export function NotebookQuantityTiers() {
  return <dl className={styles.tiers} aria-label="Bonus total par fleur en monnaie de jeu">
    {[1, 3, 5, 10].map((grams) => <div key={grams}>
      <dt>{grams} g{grams === 10 ? " et +" : ""}</dt>
      <dd>{formatNotebookGameEuros(getKqNotebookQuantityReward(grams).totalCashCents)}</dd>
    </div>)}
  </dl>;
}

/** The customer's current catalogue is authoritative, including migration readiness. */
export function NotebookQuantityBonusPreview({ productId, grams }: { productId: string; grams: number }) {
  const titleId = useId();
  const { user } = useCart();
  const customerId = user?.id ?? "";
  const [loaded, setLoaded] = useState<{ customerId: string; productId: string; campaign: KqProducerRewardProgress | null } | null>(null);

  useEffect(() => {
    if (!customerId) return;
    const controller = new AbortController();
    const refresh = () => {
      void fetch("/api/contest/producer-rewards", { cache: "no-store", signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) return null;
          const payload = await response.json() as { campaigns?: KqProducerRewardProgress[] };
          return Array.isArray(payload.campaigns)
            ? payload.campaigns.find((campaign) => campaign.quantityRewardsAvailable
              && campaign.entries.some((entry) => entry.productId === productId)) ?? null
            : null;
        })
        .then((campaign) => { if (!controller.signal.aborted) setLoaded({ customerId, productId, campaign }); })
        .catch(() => { if (!controller.signal.aborted) setLoaded({ customerId, productId, campaign: null }); });
    };
    refresh();
    window.addEventListener("kq:producer-rewards-changed", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("kq:producer-rewards-changed", refresh);
    };
  }, [customerId, productId]);

  const campaign = loaded?.customerId === customerId && loaded.productId === productId ? loaded.campaign : null;
  const flower = campaign?.entries.find((entry) => entry.productId === productId);
  if (!campaign || !flower?.quantityReward || !Number.isFinite(grams) || grams <= 0) return null;

  const reward = getKqNotebookQuantityReward(Math.max(grams, flower.quantityReward.bestOrderGrams));
  const unpaidBonusCents = Math.max(0, reward.bonusCashCents - flower.quantityReward.grantedCashCents);
  const nextTier = [3, 5, 10].find((tier) => tier > Math.max(grams, flower.quantityReward.bestOrderGrams));

  return <aside className={styles.preview} aria-labelledby={titleId}>
    <h3 id={titleId}><Gift size={16} aria-hidden="true" /> Ton bonus dans le Carnet</h3>
    <p className={styles.amount} aria-live="polite">Ton bonus total pour cette fleur : <strong>{formatNotebookGameEuros(reward.totalCashCents)} de monnaie de jeu</strong></p>
    <p>{flower.quantityReward.bestOrderGrams > grams
      ? `Ta sélection : ${new Intl.NumberFormat("fr-FR").format(grams)} g. Ton achat précédent de ${new Intl.NumberFormat("fr-FR").format(flower.quantityReward.bestOrderGrams)} g conserve ton meilleur palier.`
      : `Avec ${new Intl.NumberFormat("fr-FR").format(grams)} g de cette fleur regroupés dans une commande.`}</p>
    <p>{unpaidBonusCents > 0
      ? `${formatNotebookGameEuros(unpaidBonusCents)} de supplément restent à récupérer après achat et validation de ton avis.`
      : flower.quantityReward.grantedCashCents > 0
        ? "Le supplément de ce palier a déjà été reçu pour cette fleur."
        : campaign.completionReward.granted
          ? "Le bonus de découverte de ce producteur a déjà été versé."
          : "Les 100 € de découverte sont versés à la fin du parcours producteur."}</p>
    {campaign.completionReward.granted && unpaidBonusCents > 0 ? <p>Le bonus de découverte de ce producteur a déjà été versé ; seul le supplément peut encore évoluer.</p> : null}
    {nextTier ? <p className={styles.nextTier}>À {nextTier} g regroupés : {formatNotebookGameEuros(getKqNotebookQuantityReward(nextTier).totalCashCents)} au total dans le jeu.</p> : null}
    <NotebookQuantityTiers />
    <details className={styles.rules}>
      <summary>Comment obtenir ce bonus ?</summary>
      <p>Le plus gros achat de cette fleur dans une seule commande compte, jusqu’à 10 g. Des commandes séparées ne s’additionnent pas. Les 100 € de découverte sont compris dans le total et versés à la fin du parcours producteur.</p>
      <p>Un achat plus grand améliore ton palier : seule la différence encore due est versée. Un tirage déjà effectué ne peut pas être relancé.</p>
    </details>
    <Link href="/arene" className={styles.link}>Retrouver mes bonus dans le Carnet</Link>
  </aside>;
}
