"use client";

import Image from "next/image";
import { Check, ChevronDown, LockKeyhole, ShoppingBag, Star, Store, Trophy, Users } from "lucide-react";
import { KQ_CHANNELS, getKqShopNetworkBonus, type KqCommerceReceipt, type KqCommerceSnapshot } from "@/lib/kanab-quest-commerce";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { getKqMarketReputationProgress, KQ_MARKET_REPUTATION_TIERS } from "@/lib/kanab-quest-market-demand";
import { KqBarChart, KqProgressMeter } from "./KqVisuals";
import styles from "./KqCommerceOverview.module.css";

const officeArt = "/placard/commerce-office-sylvain-v3.webp";
const number = (value: number) => value.toLocaleString("fr-FR");
const signed = (value: number) => `${value > 0 ? "+" : "−"}${number(Math.abs(value))}`;

function SaleRow({ receipt }: { receipt: KqCommerceReceipt }) {
  const channel = receipt.channel ? KQ_CHANNELS[receipt.channel] : null;
  const reputation = receipt.reputationGain;
  const networkChange = receipt.channel === "cbd-shop" ? receipt.shopPartnersDelta
    : receipt.channel === "online" && receipt.clientsBefore !== undefined && receipt.clientsAfter !== undefined ? receipt.clientsAfter - receipt.clientsBefore : undefined;
  return <li className={styles.saleRow}>
    {channel ? <Image src={channel.image} alt="" width={56} height={56} sizes="56px" /> : <ShoppingBag size={24} aria-hidden="true" />}
    <div><strong>{channel?.name ?? "Vente"}</strong><span>{receipt.units === undefined ? "Volume indisponible" : `${number(receipt.units / 10)} g vendus`}</span>
      <small>{reputation === undefined ? "Réputation non renseignée" : reputation ? `${signed(reputation)} réputation` : "Réputation stable"}{networkChange ? ` · ${signed(networkChange)} ${receipt.channel === "cbd-shop" ? "partenaire(s)" : "client(s)"}` : ""}</small>
      <details className={styles.saleDetails}><summary>Détail du versement</summary><dl>{[
        ["Vente TTC", receipt.payoutCents], ["TVA", receipt.vatCents], ["Laboratoire", receipt.labPaidCents], ["Électricité et soins", receipt.electricityPaidCents],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{typeof value === "number" ? formatKqCash(value) : "Non renseigné"}</dd></div>)}</dl></details></div>
    <span className={styles.saleAmount}><strong>{receipt.netPayoutCents === undefined ? "—" : formatKqCash(receipt.netPayoutCents)}</strong><small>{receipt.netPayoutCents === undefined ? "indisponible" : "versés"}</small></span>
  </li>;
}

export function KqCommerceOverview({ data, onOpenShop }: {
  data: KqCommerceSnapshot; onOpenShop: () => void;
}) {
  const progress = getKqMarketReputationProgress(data.reputation);
  const partners = data.shopPartners;
  const networkBonus = data.campaign?.shopPartnersStart === undefined ? null : getKqShopNetworkBonus(data.campaign.shopPartnersStart);
  const nextNetwork = partners === undefined ? undefined : [1, 4, 8, 12].find(threshold => threshold > partners);
  const sales = data.receipts.filter(receipt => receipt.action === "sell");
  return <details className={styles.overview} aria-label="Mon commerce">
    <summary className={styles.summary}>
      <Image src={officeArt} width={88} height={68} sizes="88px" alt="" />
      <span><strong>Mon commerce</strong><small>Ta réputation, tes clients, tes résultats.</small></span>
      <span className={styles.summaryRank}><Trophy size={16} aria-hidden="true" /> {progress.tier.name}</span>
      <ChevronDown className={styles.chevron} size={22} aria-hidden="true" />
    </summary>
    <div className={styles.content}>
      <section className={styles.reputation} aria-label="Ta réputation">
        <div className={styles.officeArt}><Image src={officeArt} alt="Sylvain prépare ses commandes dans l’espace de gestion du Marché, entouré de colis et des portraits de ses partenaires" fill sizes="(max-width: 700px) 100vw, 400px" /></div>
        <div className={styles.rankProgress}>
          <small className={styles.eyebrow}><Trophy size={17} aria-hidden="true" /> Ta réputation</small>
          <h2>{progress.tier.name}</h2>
          <div className={styles.rankNumbers}><strong>{number(data.reputation)} <small>points</small></strong><span>{data.online ? `${number(data.online.confidence)}/100` : `+${progress.tier.priceBonusPercent} %`}<small>{data.online ? "de confiance commerciale" : "sur tes prix en ligne"}</small></span></div>
          <KqProgressMeter label={progress.nextTier ? `Vers ${progress.nextTier.name}` : "Dernier palier atteint"} value={progress.progressPercent} max={100} valueLabel={progress.nextTier ? `${number(progress.pointsToNext)} points restants` : "Rang maximal"} hint={progress.nextTier ? `Objectif : ${number(progress.nextTier.minimum)} points` : undefined} tone="gold" />
        </div>
      </section>
      <details className={styles.rankDetails}><summary>Voir les paliers et leurs avantages <ChevronDown size={16} aria-hidden="true" /></summary>
        <ol className={styles.rankTrack}>{KQ_MARKET_REPUTATION_TIERS.map(tier => {
          const current = tier.code === progress.tier.code;
          const reached = data.reputation >= tier.minimum;
          const Icon = current ? Star : reached ? Check : LockKeyhole;
          return <li key={tier.code} data-state={current ? "current" : reached ? "reached" : "locked"} aria-current={current ? "step" : undefined}><Icon size={19} aria-hidden="true" /><small>{number(tier.minimum)} points · {current ? "Ton rang" : reached ? "Débloqué" : "À atteindre"}</small><strong>{tier.name}</strong><span>{data.online ? "Une notoriété qui développe ton audience" : `+${tier.priceBonusPercent} % sur les prix en ligne`}</span></li>;
        })}</ol><p>{data.online ? "La réputation attire des visiteurs. La confiance dépend des ventes réellement livrées, de la qualité et du prix demandé. Même une marque connue doit proposer un bon rapport qualité-prix." : "La réputation améliore les prix et la demande en ligne. Les commandes restent limitées."}</p>
      </details>
      <div className={styles.audiences}>
        <section aria-label="Clientèle en ligne"><Users size={28} aria-hidden="true" /><div><h3>Clients en ligne</h3>{data.online ? <div className={styles.visuals}><KqBarChart title="Ton audience" items={[{ label: "Abonnés", value: data.online.followers, displayValue: number(data.online.followers), tone: "gold" }, { label: "Clients fidèles", value: data.clients, displayValue: number(data.clients), tone: "teal" }]} /><KqProgressMeter label="Confiance commerciale" value={data.online.confidence} max={100} valueLabel={`${number(data.online.confidence)} / 100`} /></div> : <strong className={styles.stat}>{number(data.clients)} <span>fidèles</span></strong>}<details className={styles.explanation}><summary>Comment fidéliser</summary><p>Les commandes satisfaisantes construisent la fidélité. Les visiteurs ne deviennent pas automatiquement des clients ; une qualité décevante peut les faire partir.</p></details></div></section>
        <section aria-label="Boutiques partenaires"><Store size={28} aria-hidden="true" /><div><h3>Boutiques partenaires</h3>{partners === undefined ? <p>Réseau indisponible</p> : <KqProgressMeter label="Ton réseau" value={partners} max={20} valueLabel={`${number(partners)} / 20 partenaires`} tone="gold" hint={nextNetwork ? `${nextNetwork - partners} avant le prochain bonus` : "Bonus réseau maximal"} />}<details className={styles.explanation}><summary>Tarifs et bonus du réseau</summary><p>{data.online ? "Le réseau développe les volumes de reprise. Fleurs indoor : 3 €/g en shop et 2,10 €/g chez les grossistes, hors demande temporaire. Les extraits ont leurs propres barèmes." : networkBonus === null ? "Bonus de la période indisponible." : `+${networkBonus} points de reprise sur cette période de 24 heures.`}</p></details></div></section>
      </div>
      <section className={styles.history} aria-label="Dernières ventes"><header><div><h3>Dernières ventes</h3></div><button className={styles.shopLink} onClick={onOpenShop}><ShoppingBag size={17} aria-hidden="true" /> Équiper l’Entrepôt</button></header>
        {sales.length ? <><ul className={styles.sales}>{sales.slice(0,3).map((receipt,index)=><SaleRow key={index} receipt={receipt} />)}</ul>
          {sales.length > 3 ? <details className={styles.moreSales}><summary>{sales.length === 4 ? "Voir l’autre vente" : `Voir les ${sales.length - 3} autres ventes`} <ChevronDown size={16} aria-hidden="true" /></summary><ul className={styles.sales}>{sales.slice(3).map((receipt,index)=><SaleRow key={index} receipt={receipt} />)}</ul></details> : null}
        </> : <p className={styles.emptyHistory}>Ta première vente apparaîtra ici, avec le montant versé et son effet sur ta réputation.</p>}
      </section>
    </div>
  </details>;
}
