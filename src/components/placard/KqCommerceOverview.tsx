"use client";

import Image from "next/image";
import { Check, ChevronDown, LockKeyhole, Monitor, ShoppingBag, Star, Store, Trophy, Users, Wifi, WifiOff } from "lucide-react";
import { KQ_CHANNELS, KQ_COMPUTER_PRICE_CENTS, KQ_INTERNET_PRICE_CENTS, getKqShopNetworkBonus, type KqCommerceReceipt, type KqCommerceSnapshot } from "@/lib/kanab-quest-commerce";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { getKqMarketReputationProgress, KQ_MARKET_REPUTATION_TIERS } from "@/lib/kanab-quest-market-demand";
import styles from "./KqCommerceOverview.module.css";

const officeArt = "/placard/commerce-office-v2.webp";
const number = (value: number) => value.toLocaleString("fr-FR");
const signed = (value: number) => `${value > 0 ? "+" : "−"}${number(Math.abs(value))}`;

function SaleRow({ receipt }: { receipt: KqCommerceReceipt }) {
  const channel = receipt.channel ? KQ_CHANNELS[receipt.channel] : null;
  const reputation = receipt.reputationGain ?? 0;
  const networkChange = receipt.channel === "cbd-shop" ? receipt.shopPartnersDelta
    : receipt.channel === "online" && receipt.clientsBefore !== undefined && receipt.clientsAfter !== undefined ? receipt.clientsAfter - receipt.clientsBefore : undefined;
  return <li className={styles.saleRow}>
    {channel ? <Image src={channel.image} alt="" width={56} height={56} sizes="56px" /> : <ShoppingBag size={24} aria-hidden="true" />}
    <div><strong>{channel?.name ?? "Vente"}</strong><span>{number((receipt.units ?? 0) / 10)} g vendus</span>
      <small>{reputation ? `${signed(reputation)} réputation` : "Réputation stable"}{networkChange ? ` · ${signed(networkChange)} ${receipt.channel === "cbd-shop" ? "partenaire(s)" : "client(s)"}` : ""}</small></div>
    <span className={styles.saleAmount}><strong>{formatKqCash(receipt.netPayoutCents ?? 0)}</strong><small>versés</small></span>
  </li>;
}

export function KqCommerceOverview({ data, busy, onOpenShop, onInternetChange }: {
  data: KqCommerceSnapshot; busy: boolean; onOpenShop: () => void; onInternetChange: (enabled: boolean) => void;
}) {
  const progress = getKqMarketReputationProgress(data.reputation);
  const partners = data.shopPartners ?? 0;
  const networkBonus = getKqShopNetworkBonus(data.campaign?.shopPartnersStart ?? 0);
  const nextNetwork = [1, 4, 8, 12].find(threshold => threshold > partners);
  const sales = data.receipts.filter(receipt => receipt.action === "sell");
  const internetActive = data.computerOwned && Boolean(data.campaign?.internetPaid);
  const InternetIcon = internetActive ? Wifi : WifiOff;
  return <details className={styles.overview} aria-label="Mon commerce">
    <summary className={styles.summary}>
      <Image src={officeArt} width={88} height={68} sizes="88px" alt="" />
      <span><strong>Mon commerce</strong><small>Ta réputation, tes clients, tes résultats.</small></span>
      <span className={styles.summaryRank}><Trophy size={16} aria-hidden="true" /> {progress.tier.name}</span>
      <ChevronDown className={styles.chevron} size={22} aria-hidden="true" />
    </summary>
    <div className={styles.content}>
      <section className={styles.reputation} aria-label="Ta réputation">
        <div className={styles.officeArt}><Image src={officeArt} alt="Sylvain prépare ses commandes dans son bureau, entouré de colis et des portraits de ses partenaires" fill sizes="(max-width: 700px) 100vw, 400px" /></div>
        <div className={styles.rankProgress}>
          <small className={styles.eyebrow}><Trophy size={17} aria-hidden="true" /> Ta réputation</small>
          <h2>{progress.tier.name}</h2>
          <div className={styles.rankNumbers}><strong>{number(data.reputation)} <small>points</small></strong><span>+{progress.tier.priceBonusPercent} %<small>sur tes prix en ligne</small></span></div>
          <div className={styles.nextRank}><span>{progress.nextTier ? "Prochain palier" : "Progression accomplie"}</span><strong>{progress.nextTier?.name ?? "Dernier palier atteint"}</strong></div>
          <progress value={progress.progressPercent} max={100} aria-label={progress.nextTier ? `Progression vers ${progress.nextTier.name}` : "Dernier palier atteint"} />
          <p>{progress.nextTier ? <><strong>{number(progress.pointsToNext)} points</strong> à gagner pour atteindre {number(progress.nextTier.minimum)}.</> : "Tu as atteint le plus haut rang du marché."}</p>
        </div>
      </section>
      <details className={styles.rankDetails}><summary>Voir les paliers et leurs avantages <ChevronDown size={16} aria-hidden="true" /></summary>
        <ol className={styles.rankTrack}>{KQ_MARKET_REPUTATION_TIERS.map(tier => {
          const current = tier.code === progress.tier.code;
          const reached = data.reputation >= tier.minimum;
          const Icon = current ? Star : reached ? Check : LockKeyhole;
          return <li key={tier.code} data-state={current ? "current" : reached ? "reached" : "locked"} aria-current={current ? "step" : undefined}><Icon size={19} aria-hidden="true" /><small>{number(tier.minimum)} points · {current ? "Ton rang" : reached ? "Débloqué" : "À atteindre"}</small><strong>{tier.name}</strong><span>+{tier.priceBonusPercent} % sur les prix en ligne</span></li>;
        })}</ol><p>La réputation améliore les prix et la demande en ligne. Les commandes restent limitées.</p>
      </details>
      <div className={styles.audiences}>
        <section aria-label="Clientèle en ligne"><Users size={28} aria-hidden="true" /><div><h3>Clients en ligne</h3><strong className={styles.stat}>{number(data.clients)} <span>fidèles</span></strong><p>{data.clients ? "Les bonnes livraisons fidélisent. Une qualité décevante peut faire partir tes clients." : "Tes premières bonnes livraisons en ligne construiront ta clientèle."}</p></div></section>
        <section aria-label="Boutiques partenaires"><Store size={28} aria-hidden="true" /><div><h3>Boutiques partenaires</h3><strong className={styles.stat}>{number(partners)} <span>sur 20</span></strong><p>+{networkBonus} points de reprise sur cette période de 24 heures. {nextNetwork ? `Encore ${nextNetwork - partners} boutique${nextNetwork - partners > 1 ? "s" : ""} pour le prochain bonus réseau.` : "Bonus réseau maximal atteint."}</p></div></section>
      </div>
      <section className={styles.internet} aria-label="Connexion Internet" data-active={internetActive ? "true" : undefined}>
        <InternetIcon size={26} aria-hidden="true" />
        <div><h3>{internetActive ? "Internet actif" : data.computerOwned ? "Internet inactif" : "Débloque la vente en ligne"}</h3><p>{data.computerOwned ? `${formatKqCash(KQ_INTERNET_PRICE_CENTS)} par culture terminée · ${data.internetRenew ? "Reconduction activée" : "Reconduction désactivée"}` : `Ordinateur : ${formatKqCash(KQ_COMPUTER_PRICE_CENTS)} · Internet : ${formatKqCash(KQ_INTERNET_PRICE_CENTS)} par cycle`}</p>{internetActive ? <small>Ce cycle est payé, ton accès reste ouvert.</small> : data.computerOwned && !data.campaign ? <small>Termine une culture pour ouvrir les commandes.</small> : null}</div>
        <div className={styles.internetActions}>{!data.computerOwned ? <button className={styles.action} onClick={onOpenShop}><Monitor size={16} aria-hidden="true" /> Voir l’ordinateur</button> : <>
          {!internetActive && data.campaign ? <button className={styles.action} disabled={busy || data.cashCents < KQ_INTERNET_PRICE_CENTS} onClick={() => onInternetChange(true)}>Activer Internet · 15 €</button> : null}
          {data.internetRenew ? <button className={styles.secondaryAction} disabled={busy} onClick={() => onInternetChange(false)}>Couper la reconduction</button> : internetActive ? <button className={styles.secondaryAction} disabled={busy} onClick={() => onInternetChange(true)}>Réactiver la reconduction</button> : null}
        </>}</div>
      </section>
      <section className={styles.history} aria-label="Dernières ventes"><header><div><small className={styles.eyebrow}>Tes résultats</small><h3>Dernières ventes</h3></div><button className={styles.shopLink} onClick={onOpenShop}><ShoppingBag size={17} aria-hidden="true" /> Boutique</button></header>
        {sales.length ? <><ul className={styles.sales}>{sales.slice(0,3).map((receipt,index)=><SaleRow key={index} receipt={receipt} />)}</ul>
          {sales.length > 3 ? <details className={styles.moreSales}><summary>{sales.length === 4 ? "Voir l’autre vente" : `Voir les ${sales.length - 3} autres ventes`} <ChevronDown size={16} aria-hidden="true" /></summary><ul className={styles.sales}>{sales.slice(3).map((receipt,index)=><SaleRow key={index} receipt={receipt} />)}</ul></details> : null}
        </> : <p className={styles.emptyHistory}>Ta première vente apparaîtra ici, avec le montant versé et son effet sur ta réputation.</p>}
      </section>
    </div>
  </details>;
}
