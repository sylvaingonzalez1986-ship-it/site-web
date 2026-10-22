"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { ArrowRight, Check, ChevronRight, CircleHelp, LockKeyhole, Package, Paintbrush, ShoppingBag, Store } from "lucide-react";
import type { KqCommerceSnapshot } from "@/lib/kanab-quest-commerce";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { KQ_MERCH_MODULES, KQ_MERCH_PRODUCTS, estimateKqMerchOffer, getKqMerchModuleEligibility, getKqMerchSlots, type KqMerchProductCode } from "@/lib/kanab-quest-merch";
import { KQ_ONLINE_SITE_TIERS, type KqOnlineSnapshot } from "@/lib/kanab-quest-online";
import { getKqShopActivity } from "@/lib/kanab-quest-shop-activity";
import { KqAllocationBar, KqProgressMeter } from "./KqVisuals";
import styles from "./KqMerchWorkshop.module.css";

type Ask = (title: string, description: string, body: Record<string, unknown>, cost?: number) => void;
type Props = { data: KqCommerceSnapshot; busy: boolean; onAsk: Ask; onOpenBrand: () => void; onOpenSite: () => void };
type Product = typeof KQ_MERCH_PRODUCTS[number];
const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const moduleLabels = { paper: "Papeterie", textile: "Textile", objects: "Objets" };
const parsePrice = (value: string) => /^\d{1,4}(?:[.,]\d{1,2})?$/.test(value.trim()) ? Math.round(Number(value.replace(",", ".")) * 100) : NaN;

function ProductArt({ code }: { code: KqMerchProductCode }) {
  return <span className={styles.productArt} data-art={code} aria-hidden="true" />;
}

function MerchProductEditor({ data, online, product, inventoryReady, busy, onAsk, onOpenBrand, onOpenSite }: Props & { online: KqOnlineSnapshot; product: Product; inventoryReady: boolean }) {
  const id = useId();
  const merch = online.merch;
  const supported = merch?.version === 1;
  const row = Array.isArray(merch?.inventory) ? merch.inventory.find(item => item?.code === product.code) : undefined;
  const collection = KQ_MERCH_MODULES.find(item => item.code === product.module)!;
  const ready = supported && inventoryReady && Array.isArray(merch.modules);
  const owned = supported && Array.isArray(merch.modules) && merch.modules.includes(collection.code);
  const eligibility = ready ? getKqMerchModuleEligibility(online, collection.code, data.cashCents) : { allowed: false, blockers: ["Le stock et les collections doivent être actualisés avant cet achat."] };
  const level = KQ_ONLINE_SITE_TIERS.find(tier => tier.code === online.site.tier)?.level ?? 0;
  const [quantity, setQuantity] = useState(10);
  const [price, setPrice] = useState(((row?.priceCents ?? product.referencePriceCents) / 100).toFixed(2).replace(".", ","));
  const [active, setActive] = useState(row?.active ?? false);
  const priceCents = parsePrice(price);
  const validPrice = Number.isSafeInteger(priceCents) && priceCents >= 1 && priceCents <= 100_000;
  const slots = getKqMerchSlots(online);
  const otherActive = inventoryReady ? merch!.inventory.filter(item => item.code !== product.code && item.active && item.quantity > 0).length : 0;
  const capacityBlocked = active && otherActive >= slots;
  const stockCostCents = quantity * product.unitCostCents;
  const stockQuantity = inventoryReady ? row?.quantity ?? 0 : null;
  const buyBlock = !supported ? "Rayon indisponible" : !ready || stockQuantity === null ? "Stock indisponible · actualisation requise" : !owned ? "Débloque d’abord cet atelier" : !online.site.active ? "Réactive ta boutique" : !online.upgrades.branding ? "Identité de marque requise" : stockQuantity + quantity > 500 ? "Maximum 500 articles en stock" : data.cashCents < stockCostCents ? "Trésorerie insuffisante" : null;
  const changed = Boolean(row) && (priceCents !== row!.priceCents || active !== row!.active);
  const activationBlocked = active && (!online.site.active || !online.upgrades.branding || !stockQuantity || capacityBlocked);
  const canSave = ready && owned && Boolean(row) && validPrice && changed && !activationBlocked && !busy;
  // A proposed placement shares the existing audience with the other active references.
  const estimate = ready && owned && validPrice ? estimateKqMerchOffer({ online, code: product.code, priceCents, reputation: data.reputation, clients: data.clients, activeProductCount: otherActive + 1 }) : null;
  const fees = validPrice ? Math.round(priceCents * .025) : null;
  const margin = fees === null ? null : priceCents - product.unitCostCents - fees;
  const order = (title: string, description: string, command: string, payload: Record<string, unknown>, cost = 0) => onAsk(title, description, { action: "online", command, payload }, cost);
  const prerequisites = [
    { label: `Site niveau ${collection.minimumLevel}`, met: level >= collection.minimumLevel },
    { label: `${collection.minimumOrders} commandes de récoltes`, met: online.stats.orders >= collection.minimumOrders },
    { label: `${collection.minimumConfidence}/100 confiance`, met: online.confidence >= collection.minimumConfidence },
    { label: "Identité de marque", met: online.upgrades.branding },
  ];
  return <article className={styles.editor} data-merch-editor={product.code} aria-label={`Gérer : ${product.name}`}>
    <header className={styles.productHeading}><ProductArt code={product.code} /><div><small>{moduleLabels[product.module]} · ta collection</small><h3>{product.name}</h3><p>{product.description}</p></div></header>
    <div className={styles.module} data-merch-module={collection.code} data-owned={owned}>
      <div className={styles.moduleTitle}><span>{owned ? <Check size={17} aria-hidden="true" /> : <LockKeyhole size={17} aria-hidden="true" />}<strong>{collection.name}</strong></span><b>{owned ? "Débloqué" : formatKqCash(collection.costCents)}</b></div>
      {!owned ? <>
        <p>Ouvre {KQ_MERCH_PRODUCTS.filter(item => item.module === collection.code).map(item => item.name.toLocaleLowerCase("fr-FR")).join(" + ")}. Achat unique, fabrication des articles en supplément.</p>
        <ul className={styles.requirements}>{prerequisites.map(item => <li key={item.label} data-met={item.met}>{item.met ? <Check size={13} aria-hidden="true" /> : <LockKeyhole size={13} aria-hidden="true" />}{item.label}</li>)}</ul>
        {!online.upgrades.branding ? <button type="button" className={styles.textButton} onClick={onOpenBrand}><Paintbrush size={14} aria-hidden="true" />Créer ma marque · 700 €<ArrowRight size={14} aria-hidden="true" /></button> : null}
        {level < collection.minimumLevel ? <button type="button" className={styles.textButton} onClick={onOpenSite}>Voir les niveaux du site<ArrowRight size={14} aria-hidden="true" /></button> : null}
        <button type="button" className={styles.primary} data-merch-buy-module={collection.code} disabled={busy || !eligibility.allowed} onClick={() => order(`Débloquer : ${collection.name}`, `${formatKqCash(collection.costCents)} pour cet atelier permanent. Les articles se fabriquent ensuite à l’unité, avec paiement du stock à la commande. Aucun abonnement supplémentaire.`, "buy-merch-module", { code: collection.code }, collection.costCents)}>Débloquer · {formatKqCash(collection.costCents)}<ArrowRight size={16} aria-hidden="true" /></button>
        {!eligibility.allowed ? <small className={styles.hint}>{eligibility.blockers[0]}</small> : null}
      </> : null}
    </div>

    <div className={styles.stock}>
      <div className={styles.sectionHeading}><h4><Package size={16} aria-hidden="true" />Fabriquer une série</h4><span>{supported && stockQuantity !== null ? `${number(stockQuantity)} en stock` : "Stock indisponible"}</span></div>
      <div className={styles.stockControls}><label htmlFor={`${id}-quantity`}>Quantité<select id={`${id}-quantity`} data-merch-quantity value={quantity} onChange={event => setQuantity(Number(event.target.value))} disabled={busy || !ready || !owned}>{[1, 5, 10, 25, 50, 100].map(amount => <option key={amount} value={amount}>{amount} article{amount > 1 ? "s" : ""}</option>)}</select></label><div><small>{formatKqCash(product.unitCostCents)} / article</small><strong>{formatKqCash(stockCostCents)}</strong><small>à payer maintenant</small></div></div>
      <button type="button" className={styles.secondary} data-merch-buy-stock disabled={busy || Boolean(buyBlock)} onClick={() => order(`Fabriquer ${quantity} × ${product.name}`, `${quantity} articles à ${formatKqCash(product.unitCostCents)}, soit ${formatKqCash(stockCostCents)} débités maintenant. Stock disponible immédiatement ; aucun rachat des invendus. ${row?.active ? "La référence reste en vitrine au prix actuel." : "Choisis ensuite ton prix et mets la référence en vitrine."}`, "buy-merch-stock", { code: product.code, quantity }, stockCostCents)}>{buyBlock ?? `Fabriquer · ${formatKqCash(stockCostCents)}`}</button>
    </div>

    <form className={styles.pricing} onSubmit={event => {
      event.preventDefault();
      if (!canSave) return;
      order(active ? `Mettre ${product.name} en vitrine` : `Enregistrer : ${product.name}`, `Prix : ${formatKqCash(priceCents)} par article. ${active ? "La vente utilise une place en vitrine ; sa cadence dépend de ton audience et de ce prix." : "Cette référence restera hors vitrine, son stock sera conservé."} Frais : 2,5 %, en plus de la TVA et des éventuelles dettes du jeu. Changer le prix ou la mise en vitrine remet à zéro la progression vers la prochaine vente de cet article.`, "update-merch", { code: product.code, priceCents, active });
    }}>
      <div className={styles.sectionHeading}><h4><Store size={16} aria-hidden="true" />Choisir ton offre</h4>{row ? <span>{!inventoryReady ? "État indisponible" : row.active ? "En vitrine" : "Hors vitrine"}</span> : null}</div>
      <div className={styles.priceChoices} role="group" aria-label="Suggestions de prix">{[{ label: "Accessible", factor: .85 }, { label: "Équilibré", factor: 1 }, { label: "Collection", factor: 1.2 }].map(choice => {
        const amount = Math.round(product.referencePriceCents * choice.factor);
        return <button type="button" key={choice.label} aria-pressed={priceCents === amount} disabled={busy || !ready} onClick={() => setPrice((amount / 100).toFixed(2).replace(".", ","))}><span>{choice.label}</span><strong>{formatKqCash(amount)}</strong></button>;
      })}</div>
      <label className={styles.priceInput} htmlFor={`${id}-price`}>Ton prix par article <span><input id={`${id}-price`} data-merch-price type="text" inputMode="decimal" value={price} maxLength={8} onChange={event => setPrice(event.target.value)} disabled={busy || !ready} aria-invalid={!validPrice} aria-describedby={`${id}-price-help`} /> €</span></label>
      <small id={`${id}-price-help`} className={styles.hint}>{validPrice ? `Repère du marché : ${formatKqCash(product.referencePriceCents)}. Tu restes libre de ton prix.` : "Saisis un prix entre 0,01 € et 1 000 €, avec 2 décimales au maximum."}</small>
      <div className={styles.forecast} aria-live="polite" data-merch-forecast>
        <div><span>Marge estimée / article</span><strong data-negative={margin !== null && margin < 0}>{margin === null ? "—" : formatKqCash(margin)}</strong><small>après fabrication et frais, avant TVA et autres charges</small></div>
        <div><span>Cadence estimée</span><strong>{estimate ? `${number(estimate.unitsPerDay)} / jour` : "—"}</strong><small>{supported && !ready ? "stock ou collections indisponibles" : !supported || !owned ? "après déblocage de l’atelier" : !online.site.active ? "boutique suspendue" : "si cet article est en vitrine · non garantie"}</small></div>
      </div>
      {validPrice && margin !== null && margin >= 0 ? <details className={styles.details}><summary>Décomposer le prix</summary><KqAllocationBar label="Répartition d’un prix de vente" items={[{ label: "Fabrication déjà payée", value: product.unitCostCents, displayValue: formatKqCash(product.unitCostCents), tone: "ink" }, { label: "Frais de vente", value: fees!, displayValue: formatKqCash(fees!), tone: "gold" }, { label: "Marge avant TVA et charges", value: margin, displayValue: formatKqCash(margin), tone: "teal" }]} /></details> : null}
      {margin !== null && margin < 0 ? <p className={styles.warning}>Ce prix ne couvre pas la fabrication et les frais de vente.</p> : null}
      <label className={styles.publish}><input type="checkbox" data-merch-active checked={active} onChange={event => setActive(event.target.checked)} disabled={busy || !ready || !row} /><span>Proposer en vitrine<small>{stockQuantity === null ? "Stock indisponible" : row ? `${number(stockQuantity)} article${stockQuantity > 1 ? "s" : ""} disponible${stockQuantity > 1 ? "s" : ""}` : "Fabrique d’abord une série"}</small></span></label>
      {!ready ? null : active && capacityBlocked ? <p className={styles.warning}>Vitrine complète : retire une référence ou améliore ton site pour ajouter une place.</p> : active && !stockQuantity ? <p className={styles.warning}>Fabrique une série avant la mise en vitrine.</p> : active && !online.site.active ? <p className={styles.warning}>Réactive ta boutique pour proposer cet article.</p> : null}
      <button type="submit" className={styles.primary} data-merch-save disabled={!canSave}>{!ready ? "Offre indisponible" : changed ? active ? "Enregistrer et mettre en vitrine" : "Enregistrer hors vitrine" : row ? "Offre enregistrée" : "Fabrique d’abord une série"}<ArrowRight size={16} aria-hidden="true" /></button>
    </form>
  </article>;
}

export function KqMerchWorkshop(props: Props) {
  const { data, busy, onOpenSite } = props;
  const [selected, setSelected] = useState<KqMerchProductCode>("stickers");
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const online = data.online;
  if (!online) return null;
  const merch = online.merch;
  const supported = merch?.version === 1;
  const activity = getKqShopActivity(data).merch;
  const inventoryReady = activity.inventory !== null && activity.active !== null;
  const modulesReady = Array.isArray(merch?.modules);
  const product = KQ_MERCH_PRODUCTS.find(item => item.code === selected)!;
  const row = activity.inventory?.find(item => item.code === selected);
  const activeCount = activity.active?.length ?? null;
  const slots = getKqMerchSlots(online);
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % KQ_MERCH_PRODUCTS.length : event.key === "ArrowLeft" ? (index + KQ_MERCH_PRODUCTS.length - 1) % KQ_MERCH_PRODUCTS.length : event.key === "Home" ? 0 : event.key === "End" ? KQ_MERCH_PRODUCTS.length - 1 : null;
    if (next === null) return;
    event.preventDefault(); setSelected(KQ_MERCH_PRODUCTS[next].code); buttons.current[next]?.focus();
  }
  const stockValue = inventoryReady ? activity.inventory!.reduce((sum, item) => sum + item.quantity! * item.product.unitCostCents, 0) : null;
  return <section className={styles.workshop} data-merch-workshop aria-label="Merch et collections">
    <header className={styles.heading}><div><span className={styles.eyebrow}><ShoppingBag size={16} aria-hidden="true" />Les petites séries du quartier</span><h2>Ta marque, à emporter.</h2><p>Choisis tes collections, engage ton stock et trouve le bon prix.</p></div><span className={styles.stamp}>3 ateliers<br /><strong>6 produits</strong></span></header>
    {!supported ? <p className={styles.notice}>Ce rayon n’est pas encore disponible dans cette partie. Tu peux découvrir les collections et leurs coûts.</p> : null}
    {supported && (!inventoryReady || !modulesReady) ? <p className={styles.notice}>Le stock ou les collections sont indisponibles. Actualise la boutique avant de fabriquer ou de modifier une offre. Les coûts restent consultables.</p> : null}
    <dl className={styles.metrics}><div><dt>Articles vendus</dt><dd>{activity.unitsSold === null ? "—" : number(activity.unitsSold)}</dd></div><div><dt>Chiffre d’affaires merch</dt><dd>{activity.revenueCents === null ? "—" : formatKqCash(activity.revenueCents)}</dd></div><div><dt>Valeur du stock au coût d’achat</dt><dd>{stockValue === null ? "—" : formatKqCash(stockValue)}</dd></div></dl>
    <div className={styles.layout}>
      <div className={styles.collection}>
        <div className={styles.sectionHeading}><h3>Composer ta collection</h3><small>Choisis un article</small></div>
        <div className={styles.catalog} role="group" aria-label="Choisir un produit merch">{KQ_MERCH_PRODUCTS.map((item, index) => {
          const stock = activity.inventory?.find(row => row.code === item.code);
          const owned = supported && modulesReady && merch.modules.includes(item.module);
          const collection = KQ_MERCH_MODULES.find(collection => collection.code === item.module)!;
          return <button type="button" key={item.code} ref={node => { buttons.current[index] = node; }} data-merch-product={item.code} aria-pressed={selected === item.code} className={styles.product} onClick={() => setSelected(item.code)} onKeyDown={event => navigate(event, index)}><small>{moduleLabels[item.module]}</small><ProductArt code={item.code} /><strong>{item.name}</strong><span>{!supported ? "À découvrir" : !inventoryReady || !modulesReady ? "Stock indisponible" : !owned ? <><LockKeyhole size={11} aria-hidden="true" />Atelier niv. {collection.minimumLevel}</> : stock?.status === "active" ? <><Check size={11} aria-hidden="true" />{stock.quantity} en vitrine</> : `${stock?.quantity ?? 0} en réserve`}</span></button>;
        })}</div>
        <div className={styles.vitrine}>
          {supported && activeCount !== null ? <KqProgressMeter label="Places en vitrine" value={activeCount} max={slots} valueLabel={`${activeCount} / ${slots} références`} hint="Chaque référence partage la même audience. Un rayon plus grand ne crée pas de visiteurs." /> : <p>{supported ? "Occupation de la vitrine indisponible." : "Places en vitrine : disponibles à partir du site niveau 2."}</p>}
          <button type="button" className={styles.textButton} onClick={onOpenSite}>Agrandir avec le site<ChevronRight size={16} aria-hidden="true" /></button>
        </div>
        <details className={styles.details}><summary><CircleHelp size={15} aria-hidden="true" />Comment le rayon fonctionne</summary><p>La fabrication est payée d’avance. Les ventes continuent hors connexion tant que ta boutique est ouverte, avec du stock en vitrine. Les articles ne consomment pas la place réservée aux fleurs.</p><p>L’audience naturelle et la confiance alimentent la demande ; un prix trop élevé peut l’arrêter. Les campagnes de récoltes n’apportent pas de visites supplémentaires au merch. Ses ventes ne débloquent pas les paliers fondés sur les commandes de récoltes : fleurs, résines et autres produits préparés.</p><p>Tu peux mettre une référence en réserve sans perdre le stock. Un changement de prix ou de mise en vitrine remet à zéro sa progression vers la prochaine vente. À épuisement, la référence sort de la vitrine.</p></details>
      </div>
      <MerchProductEditor key={`${selected}:${row?.priceCents}:${row?.status}`} {...props} online={online} product={product} inventoryReady={inventoryReady} />
    </div>
    {supported && Array.isArray(merch.recentSales) && merch.recentSales.length > 0 ? <details className={`${styles.details} ${styles.sales}`}><summary>Dernières ventes merch <span>{activity.unitsSold === null ? "Cumul indisponible" : `${number(activity.unitsSold)} article${activity.unitsSold > 1 ? "s" : ""} vendu${activity.unitsSold > 1 ? "s" : ""}`}</span></summary><ul>{merch.recentSales.slice(0, 6).map(sale => <li key={sale.id}><ProductArt code={sale.code} /><div><strong>{sale.quantity} × {KQ_MERCH_PRODUCTS.find(product => product.code === sale.code)!.name}</strong><small>{new Date(sale.soldAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small></div><div><strong>{formatKqCash(sale.netPayoutCents)}</strong><small>versés après prélèvements</small></div></li>)}</ul><p>La fabrication a déjà été payée à la commande du stock ; le montant versé n’est pas le bénéfice.</p></details> : null}
    {busy ? <span className={styles.srOnly} role="status">Opération en cours.</span> : null}
  </section>;
}
