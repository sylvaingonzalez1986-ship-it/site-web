"use client";

import { useEffect, useId, useState } from "react";
import { Coins } from "lucide-react";
import Link from "@/components/navigation/NavigationLink";
import {
  estimateOrderCashCents,
  formatOrderCash,
  type KqOrderCashRewards,
} from "@/lib/kanab-quest-order-cash";
import type { CmsOrder } from "@/types/store";
import styles from "./OrderCashReward.module.css";

const rewardsUrl = "/api/account/order-cash-rewards";

async function loadRewards(signal: AbortSignal, method: "GET" | "POST") {
  const response = await fetch(rewardsUrl, {
    method,
    credentials: "include",
    cache: "no-store",
    signal,
  });
  if (!response.ok) return null;
  const payload = await response.json() as { rewards?: KqOrderCashRewards };
  return payload.rewards ?? null;
}

export function OrderCashRewardPreview({
  productsAmount,
  active,
}: {
  productsAmount: number;
  active: boolean;
}) {
  const titleId = useId();
  const [rewards, setRewards] = useState<KqOrderCashRewards | null>(null);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    void loadRewards(controller.signal, "GET")
      .then((result) => { if (!controller.signal.aborted) setRewards(result); })
      .catch(() => { if (!controller.signal.aborted) setRewards(null); });
    return () => controller.abort();
  }, [active]);

  const cashCents = rewards?.available
    ? estimateOrderCashCents(productsAmount, rewards.gameEurosPerEuro)
    : 0;
  if (!active || cashCents <= 0) return null;

  return (
    <aside className={styles.card} aria-labelledby={titleId}>
      <p className={styles.title} id={titleId}>
        <Coins size={18} aria-hidden="true" /> À chaque commande
      </p>
      <p className={styles.amount} aria-live="polite">
        +{formatOrderCash(cashCents)} de jeu
      </p>
      <p>À recevoir dans Kanab Quest après paiement.</p>
      <p className={styles.detail}>
        {formatOrderCash((rewards?.gameEurosPerEuro ?? 0) * 100)} de jeu par euro de produits,
        après remises et hors livraison.
      </p>
      <p className={styles.detail}>
        Cumulable avec tes bonus du Carnet, même si tu recommandes les mêmes fleurs.
      </p>
    </aside>
  );
}

export function OrderCashRewardReceipt({
  orderId,
  paymentState,
}: {
  orderId: string;
  paymentState: CmsOrder["paymentState"];
}) {
  const titleId = useId();
  const [loaded, setLoaded] = useState<{
    orderId: string;
    receipt: KqOrderCashRewards["receipts"][number] | null;
  } | null>(null);

  useEffect(() => {
    if (paymentState !== "paid") return;
    const controller = new AbortController();
    void loadRewards(controller.signal, "POST")
      .then((result) => {
        if (!controller.signal.aborted) {
          setLoaded({
            orderId,
            receipt: result?.receipts.find((receipt) => receipt.orderId === orderId) ?? null,
          });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoaded({ orderId, receipt: null });
      });
    return () => controller.abort();
  }, [orderId, paymentState]);

  const receipt = loaded?.orderId === orderId ? loaded.receipt : null;
  if (paymentState !== "paid" || !receipt || receipt.cashCents <= 0) return null;

  return (
    <aside className={styles.card} aria-labelledby={titleId}>
      <p className={styles.title} id={titleId}>
        <Coins size={18} aria-hidden="true" /> Ton bonus de commande
      </p>
      <p className={styles.amount}>+{formatOrderCash(receipt.cashCents)} de jeu crédités</p>
      <p>Ton portefeuille Kanab Quest a reçu le bonus de cette commande.</p>
      <p className={styles.detail}>
        Tu gagnes de la monnaie de jeu à chaque commande, même en reprenant tes fleurs préférées.
        Tes bonus du Carnet s’ajoutent à cette récompense.
      </p>
      <Link className={styles.link} href="/arene/placard">Retrouver mon portefeuille dans le jeu</Link>
    </aside>
  );
}
