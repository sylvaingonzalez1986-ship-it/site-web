"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronRight, LockKeyhole } from "lucide-react";
import type { KqCommerceSnapshot } from "@/lib/kanab-quest-commerce";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { KQ_MERCH_MODULES, KQ_MERCH_PRODUCTS, getKqMerchSlots, type KqMerchProductCode } from "@/lib/kanab-quest-merch";
import { KQ_ONLINE_SITE_TIERS } from "@/lib/kanab-quest-online";
import { getKqShopActivity } from "@/lib/kanab-quest-shop-activity";
import { KqProgressMeter } from "./KqVisuals";
import { KqMerchProductEditor } from "./KqMerchProductEditor";
import styles from "./KqMerchWorkshop.module.css";

type Ask = (title: string, description: string, body: Record<string, unknown>, cost?: number) => void;
type Props = { data: KqCommerceSnapshot; busy: boolean; onAsk: Ask; onOpenBrand: () => void; onOpenSite: () => void };
type Product = typeof KQ_MERCH_PRODUCTS[number];
const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const moduleLabels = { paper: "Papeterie", textile: "Textile", objects: "Objets" };
const amount = (value: number | null) => value === null ? "À confirmer" : number(value);

function ProductArt({ code }: { code: KqMerchProductCode }) {
  return <span className={styles.productArt} data-art={code} aria-hidden="true" />;
}

export function KqMerchWorkshop(props: Props) {
  const { data, busy, onOpenSite } = props;
  const [selected, setSelected] = useState<KqMerchProductCode>(() => {
    const initial = getKqShopActivity(data).merch;
    return initial.paused?.find(row => row.quantity! > 0)?.code ?? initial.active?.[0]?.code
      ?? KQ_MERCH_PRODUCTS.find(product => Array.isArray(data.online?.merch?.modules) && data.online.merch.modules.includes(product.module))?.code ?? "stickers";
  });
  const buttons = useRef<Partial<Record<KqMerchProductCode, HTMLButtonElement | null>>>({});
  const editorId = useId();
  const online = data.online;
  if (!online) return null;
  const siteActive = online.site.active;
  const merch = online.merch;
  const supported = merch?.version === 1;
  const shopActivity = getKqShopActivity(data);
  const activity = shopActivity.merch;
  const quantitiesReady = activity.remainingUnits !== null && activity.inventory!.every(item => item.quantity !== null && item.quantity <= 500);
  const remainingUnits = quantitiesReady ? activity.remainingUnits : null;
  const activeUnits = quantitiesReady ? activity.activeUnits : null;
  const inventoryReady = activity.inventory !== null && activity.active !== null
    && activity.inventory.every(item => item.quantity !== null && item.quantity <= 500 && item.priceCents !== null)
    && Array.isArray(merch?.inventory) && merch.inventory.every(item => typeof item.active === "boolean");
  const modulesReady = Array.isArray(merch?.modules) && merch.modules.every(code => KQ_MERCH_MODULES.some(item => item.code === code))
    && new Set(merch.modules).size === merch.modules.length;
  const product = KQ_MERCH_PRODUCTS.find(item => item.code === selected)!;
  const row = activity.inventory?.find(item => item.code === selected);
  const activeCount = quantitiesReady ? activity.active?.length ?? null : null;
  const tierKnown = KQ_ONLINE_SITE_TIERS.some(tier => tier.code === online.site.tier);
  const slots = tierKnown ? getKqMerchSlots(online) : null;
  const ownedProducts = supported && modulesReady ? KQ_MERCH_PRODUCTS.filter(item => merch.modules.includes(item.module)) : [];
  const otherProducts = KQ_MERCH_PRODUCTS.filter(item => !ownedProducts.includes(item));
  const reserveUnits = remainingUnits !== null && activeUnits !== null ? remainingUnits - activeUnits : null;
  const receipts = shopActivity.receipts.filter(receipt => receipt.kind === "merch");
  const rawSales = Array.isArray(merch?.recentSales) ? merch.recentSales : null;
  const incompleteHistory = supported && (rawSales === null || receipts.length !== rawSales.length || receipts.some(receipt => receipt.netPayoutCents === null));
  function navigate(event: KeyboardEvent<HTMLButtonElement>, products: readonly Product[], index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % products.length : event.key === "ArrowLeft" ? (index + products.length - 1) % products.length : event.key === "Home" ? 0 : event.key === "End" ? products.length - 1 : null;
    if (next === null) return;
    event.preventDefault(); setSelected(products[next].code); buttons.current[products[next].code]?.focus();
  }
  const stockValue = quantitiesReady ? activity.inventory!.reduce((sum, item) => sum + item.quantity! * item.product.unitCostCents, 0) : null;
  function catalog(products: readonly Product[], owned: boolean) {
    return <div className={styles.catalog} role="group" aria-label={owned ? "Mes produits" : "Collections à découvrir"}>{products.map((item, index) => {
      const stock = activity.inventory?.find(row => row.code === item.code);
      const collection = KQ_MERCH_MODULES.find(collection => collection.code === item.module)!;
      return <button type="button" key={item.code} ref={node => { buttons.current[item.code] = node; }} data-merch-product={item.code} aria-pressed={selected === item.code} aria-controls={editorId} className={styles.product} onClick={() => setSelected(item.code)} onKeyDown={event => navigate(event, products, index)}>
        <ProductArt code={item.code} /><span><strong>{item.name}</strong><small>{!supported ? "À découvrir" : !modulesReady || !inventoryReady ? "Données à confirmer" : !owned ? <><LockKeyhole size={13} aria-hidden="true" />{moduleLabels[item.module]} · {formatKqCash(collection.costCents)}</> : stock?.status === "active" ? <><Check size={13} aria-hidden="true" />{amount(stock.quantity)} en vitrine{siteActive === false ? " · ventes suspendues" : ""}</> : stock?.quantity ? `${number(stock.quantity)} en réserve` : "À fabriquer"}</small>{owned && stock?.priceCents !== null && stock?.priceCents !== undefined ? <small>{formatKqCash(stock.priceCents)} / article</small> : null}</span>
      </button>;
    })}</div>;
  }
  return <section className={styles.workshop} data-merch-workshop aria-label="Produits dérivés et collections">
    <header className={styles.heading}><h2>Produits dérivés</h2></header>
    {!supported ? <p className={styles.notice}>Ce rayon n’est pas encore disponible dans cette partie. Les collections et leurs coûts restent consultables.</p> : null}
    {supported && (!inventoryReady || !modulesReady) ? <p className={styles.notice}>Certaines données du stock ou des collections sont à confirmer. Actualise la boutique avant de fabriquer ou de modifier une offre.</p> : null}
    <dl className={styles.metrics} data-merch-stock-summary>
      <div><dt>Articles en stock</dt><dd>{amount(remainingUnits)}</dd></div>
      <div><dt>En vitrine</dt><dd>{amount(activeUnits)}</dd><small>{online.site.active === false ? "Ventes suspendues" : "Articles proposés"}</small></div>
      <div><dt>En réserve</dt><dd>{amount(reserveUnits)}</dd><small>Articles hors vitrine</small></div>
    </dl>
    <div className={styles.vitrine}>
      {supported && activeCount !== null && slots !== null ? <KqProgressMeter label="Places en vitrine" value={activeCount} max={slots} valueLabel={`${activeCount} / ${slots} références`} /> : <p>{supported ? "Occupation de la vitrine à confirmer." : "Vitrine disponible à partir du site niveau 2."}</p>}
      {slots !== null && slots < KQ_ONLINE_SITE_TIERS.length ? <button type="button" className={styles.textButton} disabled={busy} onClick={onOpenSite}>Voir les places avec mon site<ChevronRight size={16} aria-hidden="true" /></button> : null}
    </div>
    <details className={styles.chooser} data-merch-catalog-details>
      <summary>Choisir un produit · {product.name}</summary>
      {ownedProducts.length > 0 ? <><h3>Mes produits</h3>{catalog(ownedProducts, true)}</> : null}
      {otherProducts.length > 0 ? <><h3>{supported && modulesReady ? "Collections à débloquer" : "Les collections"}</h3>{catalog(otherProducts, false)}</> : null}
    </details>
    <div id={editorId}>
      <KqMerchProductEditor key={`${selected}:${row?.priceCents}:${row?.status}`} {...props} online={online} product={product} inventoryReady={inventoryReady} art={<ProductArt code={product.code} />} />
    </div>
    <details className={styles.details} data-merch-history>
      <summary>Ventes et valeur du stock</summary>
      <dl className={styles.historyMetrics}>
        <div><dt>Articles vendus</dt><dd>{amount(activity.unitsSold)}</dd></div>
        <div><dt>Chiffre d’affaires</dt><dd>{activity.revenueCents === null ? "À confirmer" : formatKqCash(activity.revenueCents)}</dd></div>
        <div><dt>Valeur du stock au coût de fabrication</dt><dd>{stockValue === null ? "À confirmer" : formatKqCash(stockValue)}</dd></div>
      </dl>
      <p>La fabrication a déjà été payée. La valeur du stock n’est pas un montant récupérable : les invendus ne sont pas rachetés.</p>
      {incompleteHistory ? <p className={styles.notice}>Certaines ventes récentes sont indisponibles. Seuls les reçus lisibles sont affichés.</p> : null}
      {receipts.length > 0 ? <ul className={styles.sales}>{receipts.slice(0, 6).map(sale => <li key={sale.id}><ProductArt code={sale.code} /><div><strong>{sale.quantity} × {sale.name}</strong><small>{new Date(sale.soldAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small></div><div><strong>{sale.netPayoutCents === null ? "À confirmer" : formatKqCash(sale.netPayoutCents)}</strong><small>versés après prélèvements</small></div></li>)}</ul> : <p>{supported && !incompleteHistory ? "Aucune vente récente de produits dérivés." : "Historique des ventes à confirmer."}</p>}
      <p>Le chiffre d’affaires et les versements ne sont pas le bénéfice. Les collections et la fabrication sont payées séparément.</p>
    </details>
    <details className={styles.details}><summary>Comment le rayon fonctionne</summary>
      <p>Débloque une collection, fabrique une série, puis choisis son prix et sa mise en vitrine. La fabrication est payée d’avance. Les ventes continuent hors connexion tant que ta boutique est ouverte, avec du stock en vitrine.</p>
      <p>Chaque référence occupe une place et partage l’audience existante. Un rayon plus grand n’ajoute pas de visiteurs. Les articles ne consomment pas la place réservée aux fleurs.</p>
      <p>Le prix et la confiance font varier la demande. Les campagnes de récoltes n’ajoutent pas de visites aux produits dérivés ; leurs ventes ne comptent pas dans les commandes de récoltes nécessaires aux déblocages.</p>
      <p>Mettre en réserve conserve le stock. Changer le prix ou la mise en vitrine remet à zéro la progression vers la prochaine vente. Réapprovisionner conserve cette progression. À épuisement, la référence sort de la vitrine.</p>
    </details>
    {busy ? <span className={styles.srOnly} role="status">Opération en cours.</span> : null}
  </section>;
}
