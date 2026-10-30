"use client";

import { useId, useState, type ReactNode } from "react";
import { ArrowRight, Check, LockKeyhole, Package, Paintbrush, Store } from "lucide-react";
import type { KqCommerceSnapshot } from "@/lib/kanab-quest-commerce";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { KQ_MERCH_MODULES, KQ_MERCH_PRODUCTS, getKqMerchModuleEligibility, getKqMerchSlots } from "@/lib/kanab-quest-merch";
import { KQ_ONLINE_SITE_TIERS, type KqOnlineSnapshot } from "@/lib/kanab-quest-online";
import { getKqShopActivity } from "@/lib/kanab-quest-shop-activity";
import { KqAllocationBar } from "./KqVisuals";
import styles from "./KqMerchProductEditor.module.css";

type Props = {
  data: KqCommerceSnapshot;
  online: KqOnlineSnapshot;
  product: typeof KQ_MERCH_PRODUCTS[number];
  inventoryReady: boolean;
  busy: boolean;
  art: ReactNode;
  onAsk: (title: string, description: string, body: Record<string, unknown>, cost?: number) => void;
  onOpenBrand: () => void;
  onOpenSite: () => void;
};
const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const parsePrice = (value: string) => /^\d{1,4}(?:[.,]\d{1,2})?$/.test(value.trim()) ? Math.round(Number(value.replace(",", ".")) * 100) : NaN;

export function KqMerchProductEditor({ data, online, product, inventoryReady, busy, art, onAsk, onOpenBrand, onOpenSite }: Props) {
  const id = useId();
  const merch = online.merch;
  const supported = merch?.version === 1;
  const activity = getKqShopActivity({ ...data, online }).merch;
  const entry = activity.inventory?.find(item => item.code === product.code);
  const row = Array.isArray(merch?.inventory) ? merch.inventory.find(item => item?.code === product.code) : undefined;
  const collection = KQ_MERCH_MODULES.find(item => item.code === product.module)!;
  const modulesReady = supported && Array.isArray(merch.modules)
    && merch.modules.every(code => KQ_MERCH_MODULES.some(item => item.code === code))
    && new Set(merch.modules).size === merch.modules.length;
  const ready = modulesReady && inventoryReady && activity.inventory !== null && activity.active !== null;
  const owned = modulesReady && merch.modules.includes(collection.code);
  const cashCents = Number.isSafeInteger(data.cashCents) && data.cashCents >= 0 ? data.cashCents : null;
  const stockQuantity = ready ? entry?.quantity ?? 0 : null;
  const level = KQ_ONLINE_SITE_TIERS.find(tier => tier.code === online.site.tier)?.level ?? null;
  const slots = getKqMerchSlots(online);
  const otherActive = activity.active?.filter(item => item.code !== product.code).length ?? null;
  const [quantity, setQuantity] = useState(10);
  const [price, setPrice] = useState(((entry?.priceCents ?? product.referencePriceCents) / 100).toFixed(2).replace(".", ","));
  const [active, setActive] = useState(row?.active === true);
  const priceCents = parsePrice(price);
  const validPrice = Number.isSafeInteger(priceCents) && priceCents >= 1 && priceCents <= 100_000;
  const validQuantity = Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= 500;
  const stockCostCents = validQuantity ? quantity * product.unitCostCents : null;
  const capacityBlocked = active && (otherActive === null || level === null || otherActive >= slots);
  const changed = Boolean(row) && (priceCents !== entry?.priceCents || active !== row!.active);
  const activationBlocked = active && (online.site.active !== true || online.upgrades?.branding !== true || !stockQuantity || capacityBlocked);
  const canSave = ready && owned && Boolean(row) && entry?.priceCents != null && validPrice && changed && !activationBlocked && !busy;
  const ordersKnown = Number.isSafeInteger(online.stats?.orders) && online.stats.orders >= 0;
  const confidenceKnown = Number.isFinite(online.confidence) && online.confidence >= 0 && online.confidence <= 100;
  const brandingKnown = typeof online.upgrades?.branding === "boolean";
  const siteActiveKnown = typeof online.site.active === "boolean";
  const eligibilityDataReady = ordersKnown && confidenceKnown && brandingKnown && siteActiveKnown && level !== null;
  const eligibility = ready && !owned && eligibilityDataReady ? getKqMerchModuleEligibility(online, collection.code, cashCents ?? NaN)
    : { allowed: false, blockers: [!ready ? "Le stock et les collections doivent être actualisés avant cet achat." : "Certaines conditions sont indisponibles : actualise la boutique avant cet achat."] };
  const buyBlock = !supported ? "Ce rayon n’est pas disponible dans cette partie."
    : !ready || stockQuantity === null ? "Stock indisponible : actualise la boutique."
      : !owned ? "Débloque d’abord cet atelier."
        : !siteActiveKnown ? "État du site indisponible : actualise la boutique."
          : online.site.active !== true ? "Réactive ta boutique pour fabriquer."
            : !brandingKnown ? "Identité de marque indisponible : actualise la boutique."
              : online.upgrades?.branding !== true ? "Crée ton identité de marque avant de fabriquer."
            : !validQuantity || stockCostCents === null ? "Choisis une quantité entre 1 et 500 articles."
              : stockQuantity + quantity > 500 ? `Maximum 500 articles par référence : il reste ${number(Math.max(0, 500 - stockQuantity))} places.`
                : cashCents === null ? "Trésorerie indisponible : actualise la boutique."
                  : cashCents < stockCostCents ? `Il manque ${formatKqCash(stockCostCents - cashCents)} pour cette série.` : null;
  // The activity reader validates audience and studio inputs before returning a forecast.
  // A proposed placement shares the existing audience with every other active reference.
  const forecast = ready && owned && validPrice && row && merch ? getKqShopActivity({
    ...data, online: { ...online, merch: { ...merch, inventory: merch.inventory.map(item => item.code === product.code ? { ...item, priceCents, active: true } : item) } },
  }).merch.inventory?.find(item => item.code === product.code)?.estimatedUnitsPerDay ?? null : null;
  const fees = validPrice ? Math.round(priceCents * .025) : null;
  const margin = fees === null ? null : priceCents - product.unitCostCents - fees;
  const stage = !ready ? "unavailable" : !owned ? "locked" : !stockQuantity ? "stock" : row?.active ? "active" : "offer";
  const status = !ready ? "État indisponible" : !stockQuantity ? "À fabriquer" : row?.active ? online.site.active === false ? "En vitrine · ventes suspendues" : online.site.active !== true ? "En vitrine · état du site indisponible" : "En vitrine" : "En réserve";
  const order = (title: string, description: string, command: string, payload: Record<string, unknown>, cost = 0) => onAsk(title, description, { action: "online", command, payload }, cost);
  const prerequisites = [
    { label: `Site niveau ${collection.minimumLevel}`, known: level !== null, met: level !== null && level >= collection.minimumLevel },
    { label: `${collection.minimumOrders} commandes de récoltes`, known: ordersKnown, met: ordersKnown && online.stats.orders >= collection.minimumOrders },
    { label: `${collection.minimumConfidence}/100 de confiance`, known: confidenceKnown, met: confidenceKnown && online.confidence >= collection.minimumConfidence },
    { label: "Identité de marque", known: brandingKnown, met: online.upgrades?.branding === true },
    { label: "Boutique ouverte", known: siteActiveKnown, met: online.site.active === true },
  ];
  const missingRequirements = prerequisites.filter(item => !item.met);
  const metRequirements = prerequisites.filter(item => item.met);
  const stock = <section className={styles.stock} data-merch-fabrication aria-labelledby={`${id}-stock-title`}>
    <h4 id={`${id}-stock-title`}><Package size={17} aria-hidden="true" />{stockQuantity ? "Renouveler le stock" : "Fabriquer une série"}</h4>
    <div className={styles.stockControls}>
      <label htmlFor={`${id}-quantity`}>Quantité<select id={`${id}-quantity`} data-merch-quantity value={quantity} onChange={event => setQuantity(Number(event.target.value))} disabled={busy || !ready || !owned}>{[1, 5, 10, 25, 50, 100].map(amount => <option key={amount} value={amount}>{amount} article{amount > 1 ? "s" : ""}</option>)}</select></label>
      <div><small>{formatKqCash(product.unitCostCents)} / article</small><strong data-merch-stock-cost>{stockCostCents === null ? "—" : formatKqCash(stockCostCents)}</strong><small>à payer maintenant</small></div>
    </div>
    <p className={styles.hint}>Trésorerie disponible : {cashCents === null ? "indisponible" : formatKqCash(cashCents)}. Stock livré immédiatement.</p>
    {buyBlock ? <p className={styles.warning} data-merch-stock-blocker>{buyBlock}</p> : null}
    <button type="button" className={styles.primary} data-merch-buy-stock disabled={busy || Boolean(buyBlock)} onClick={() => {
      if (busy || buyBlock || stockCostCents === null) return;
      order(`Fabriquer ${quantity} × ${product.name}`, `${quantity} articles à ${formatKqCash(product.unitCostCents)}, soit ${formatKqCash(stockCostCents)} débités maintenant. Stock disponible immédiatement ; aucun rachat des invendus. ${row?.active ? "La référence reste en vitrine au prix actuel." : "Choisis ensuite ton prix et mets la référence en vitrine."}`, "buy-merch-stock", { code: product.code, quantity }, stockCostCents);
    }}>Fabriquer{stockCostCents === null ? "" : ` · ${formatKqCash(stockCostCents)}`}<ArrowRight size={16} aria-hidden="true" /></button>
    <p className={styles.hint}>Fabrication payée d’avance, sans rachat des invendus. {stockQuantity === 0 ? "Ensuite : choisis ton prix et mets l’article en vitrine." : row?.active ? "Le prix en vitrine reste inchangé." : "Le nouveau stock restera en réserve."}</p>
  </section>;
  const pricing = <form className={styles.pricing} aria-labelledby={`${id}-offer-title`} onSubmit={event => {
    event.preventDefault();
    if (!canSave) return;
    order(active ? `Mettre ${product.name} en vitrine` : `Enregistrer : ${product.name}`, `Prix : ${formatKqCash(priceCents)} par article. ${active ? "La vente utilise une place en vitrine ; sa cadence dépend de ton audience et de ce prix." : "Cette référence restera hors vitrine, son stock sera conservé."} Frais : 2,5 %, en plus de la TVA et des éventuelles dettes du jeu. Changer le prix ou la mise en vitrine remet à zéro la progression vers la prochaine vente de cet article.`, "update-merch", { code: product.code, priceCents, active });
  }}>
    <h4 id={`${id}-offer-title`}><Store size={17} aria-hidden="true" />{row?.active ? "Modifier l’offre" : "Choisir le prix et la vitrine"}</h4>
    <label className={styles.priceInput} htmlFor={`${id}-price`}>Prix par article <span><input id={`${id}-price`} data-merch-price type="text" inputMode="decimal" value={price} maxLength={8} onChange={event => setPrice(event.target.value)} disabled={busy || !ready} aria-invalid={!validPrice} aria-describedby={`${id}-price-help`} /> €</span></label>
    <p id={`${id}-price-help`} className={styles.hint}>{validPrice ? `Repère du marché : ${formatKqCash(product.referencePriceCents)}. Tu restes libre de ton prix.` : "Saisis un prix entre 0,01 € et 1 000 €, avec 2 décimales au maximum."}</p>
    <div className={styles.forecast} aria-live="polite" data-merch-forecast>
      <div><span>Marge estimée / article</span><strong data-negative={margin !== null && margin < 0}>{margin === null ? "—" : formatKqCash(margin)}</strong><small>après fabrication et frais de 2,5 %, avant TVA et autres charges</small></div>
      <div><span>Cadence estimée</span><strong>{forecast === null ? "—" : `${number(forecast)} articles / jour réel`}</strong><small>{forecast === null ? "données insuffisantes pour l’estimer" : online.site.active === false ? "ventes suspendues" : "si cet article est en vitrine · non garantie"}</small></div>
    </div>
    {margin !== null && margin < 0 ? <p className={styles.warning}>Ce prix ne couvre pas la fabrication et les frais de vente.</p> : null}
    <label className={styles.publish}><input type="checkbox" data-merch-active checked={active} onChange={event => setActive(event.target.checked)} disabled={busy || !ready || !row} /><span>Proposer en vitrine<small>{stockQuantity === null ? "Stock indisponible" : `${number(stockQuantity)} article${stockQuantity > 1 ? "s" : ""} disponible${stockQuantity > 1 ? "s" : ""}`}</small></span></label>
    {active && capacityBlocked ? <p className={styles.warning}>Vitrine complète ou capacité indisponible : retire une référence ou consulte ton site.</p> : active && (!siteActiveKnown || !brandingKnown) ? <p className={styles.warning}>L’état du site ou de la marque est indisponible. Actualise la boutique avant de proposer cet article.</p> : active && online.site.active !== true ? <p className={styles.warning}>Réactive ta boutique pour proposer cet article. Tu peux aussi le retirer de la vitrine.</p> : active && online.upgrades?.branding !== true ? <p className={styles.warning}>Une identité de marque est requise pour proposer cet article.</p> : null}
    {changed ? <p className={styles.warning} data-merch-reset-warning>Enregistrer cette modification remet à zéro la progression vers la prochaine vente de cet article. Le stock est conservé.</p> : null}
    <button type="submit" className={styles.primary} data-merch-save disabled={!canSave}>{!validPrice ? "Vérifie le prix" : changed ? active ? "Enregistrer et mettre en vitrine" : "Enregistrer hors vitrine" : "Offre enregistrée"}<ArrowRight size={16} aria-hidden="true" /></button>
    <details className={styles.details} data-merch-price-suggestions><summary>Suggestions de prix</summary><div className={styles.priceChoices} role="group" aria-label="Suggestions de prix">{[{ label: "Accessible", factor: .85 }, { label: "Équilibré", factor: 1 }, { label: "Collection", factor: 1.2 }].map(choice => {
      const amount = Math.round(product.referencePriceCents * choice.factor);
      return <button type="button" key={choice.label} aria-pressed={priceCents === amount} disabled={busy || !ready} onClick={() => setPrice((amount / 100).toFixed(2).replace(".", ","))}><span>{choice.label}</span><strong>{formatKqCash(amount)}</strong></button>;
    })}</div></details>
    {validPrice && margin !== null && margin >= 0 ? <details className={styles.details}><summary>Décomposer le prix</summary><KqAllocationBar label="Répartition d’un prix de vente" items={[{ label: "Fabrication déjà payée", value: product.unitCostCents, displayValue: formatKqCash(product.unitCostCents), tone: "ink" }, { label: "Frais de vente", value: fees!, displayValue: formatKqCash(fees!), tone: "gold" }, { label: "Marge avant TVA et charges", value: margin, displayValue: formatKqCash(margin), tone: "teal" }]} /></details> : null}
  </form>;

  return <article className={styles.editor} data-merch-editor={product.code} data-merch-stage={stage} data-merch-state={stage} aria-label={`Gérer : ${product.name}`}>
    <header className={styles.productHeading}><span className={styles.art}>{art}</span><div><h3>{product.name}</h3><p>{product.description}</p></div></header>
    {owned ? <dl className={styles.stockSummary} data-merch-stock-summary><div><dt>Stock disponible</dt><dd>{stockQuantity === null ? "—" : `${number(stockQuantity)} article${stockQuantity > 1 ? "s" : ""}`}</dd></div><div><dt>{row?.active ? "Prix en vitrine" : "Prix enregistré"}</dt><dd>{entry?.priceCents != null ? formatKqCash(entry.priceCents) : row ? "Indisponible" : "À choisir"}</dd></div><div><dt>Situation</dt><dd className={styles.status}>{status}</dd></div></dl> : null}
    {owned && online.site.active === false ? <button type="button" className={styles.secondary} onClick={onOpenSite}>Réactiver ma boutique<ArrowRight size={15} aria-hidden="true" /></button> : null}
    {!owned ? <section className={styles.module} data-merch-module={collection.code} data-owned={false} aria-labelledby={`${id}-module-title`}>
      <div className={styles.moduleTitle}><h4 id={`${id}-module-title`}><LockKeyhole size={17} aria-hidden="true" />Débloquer : {collection.name}</h4><strong>{formatKqCash(collection.costCents)}</strong></div>
      <p>Achat unique pour {KQ_MERCH_PRODUCTS.filter(item => item.module === collection.code).map(item => item.name.toLocaleLowerCase("fr-FR")).join(" et ")}. La fabrication est payée ensuite, dès {formatKqCash(product.unitCostCents)} par {product.name.toLocaleLowerCase("fr-FR")}.</p>
      {missingRequirements.length > 0 ? <div className={styles.requirements}><strong>{missingRequirements.some(item => !item.known) ? "Conditions à remplir ou confirmer" : "À remplir avant de débloquer"}</strong><ul>{missingRequirements.map(item => <li key={item.label}><LockKeyhole size={14} aria-hidden="true" />{item.label}{!item.known ? " · à confirmer" : ""}</li>)}</ul></div> : null}
      {cashCents === null ? <p className={styles.warning}>Trésorerie indisponible : actualise la boutique.</p> : cashCents < collection.costCents ? <p className={styles.warning}>Il manque {formatKqCash(collection.costCents - cashCents)}. Trésorerie : {formatKqCash(cashCents)}.</p> : <p className={styles.hint}>Trésorerie disponible : {formatKqCash(cashCents)}.</p>}
      <button type="button" className={styles.primary} data-merch-buy-module={collection.code} disabled={busy || !eligibility.allowed} onClick={() => {
        if (busy || !eligibility.allowed) return;
        order(`Débloquer : ${collection.name}`, `${formatKqCash(collection.costCents)} pour cet atelier permanent. Les articles se fabriquent ensuite à l’unité, avec paiement du stock à la commande. Aucun abonnement supplémentaire.`, "buy-merch-module", { code: collection.code }, collection.costCents);
      }}>Débloquer · {formatKqCash(collection.costCents)}<ArrowRight size={16} aria-hidden="true" /></button>
      {!ready || !eligibilityDataReady ? <p className={styles.hint}>{eligibility.blockers[0]}</p> : null}
      {online.upgrades?.branding === false ? <button type="button" className={styles.secondary} onClick={onOpenBrand}><Paintbrush size={15} aria-hidden="true" />Créer ma marque · 700 €<ArrowRight size={15} aria-hidden="true" /></button> : null}
      {level === null || level < collection.minimumLevel || online.site.active !== true ? <button type="button" className={styles.secondary} onClick={onOpenSite}>Voir mon site<ArrowRight size={15} aria-hidden="true" /></button> : null}
      {metRequirements.length > 0 ? <details className={styles.details}><summary>Conditions remplies · {metRequirements.length}</summary><ul className={styles.metRequirements}>{metRequirements.map(item => <li key={item.label}><Check size={14} aria-hidden="true" />{item.label}</li>)}</ul></details> : null}
    </section> : !ready ? <p className={styles.unavailable}>Le stock ou l’offre est indisponible. Actualise la boutique avant de fabriquer ou de modifier cet article.</p> : <>
      {stockQuantity === 0 ? stock : <>
        {row?.active ? <details className={styles.actionDetails} data-merch-offer-details data-merch-pricing-details><summary>Modifier le prix ou la vitrine</summary>{pricing}</details> : pricing}
        <details className={styles.actionDetails} data-merch-restock-details><summary>Fabriquer du stock supplémentaire</summary>{stock}</details>
      </>}
      <p className={styles.ownership} data-merch-module={collection.code} data-owned={true}><Check size={14} aria-hidden="true" />Atelier débloqué : {collection.name}</p>
    </>}
  </article>;
}
