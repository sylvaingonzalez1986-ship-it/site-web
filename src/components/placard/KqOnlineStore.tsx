"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, Check, Clock3, Frown, Globe2, Info, Meh, PackageOpen, Pause, Play, Settings2, ShoppingBag, Smile, Trash2 } from "lucide-react";
import { getKqCommerceStockQuality, isKqCommerceStockMature, type KqCommerceSnapshot } from "@/lib/kanab-quest-commerce";
import { getKqAdvertisingMultiplier } from "@/lib/kanab-quest-business";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { KQ_ONLINE_PACKAGING, estimateKqOnlineOffer, getKqOnlineSaleableHours } from "@/lib/kanab-quest-online";
import { getKqShopActivity } from "@/lib/kanab-quest-shop-activity";
import { getKqOnlineListingViewState, type KqOnlineListingViewState } from "@/lib/kanab-quest-online-listing-state";
import { KqMerchActivity } from "./KqMerchActivity";
import { KqOnlineSalesJournal } from "./KqOnlineSalesJournal";
import { KqChapterHeading } from "./KqChapterHeading";
import { KqListingPricing } from "./KqListingPricing";
import styles from "./KqOnlineStore.module.css";

type Ask = (title: string, description: string, body: Record<string, unknown>, cost?: number) => void;
type Online = NonNullable<KqCommerceSnapshot["online"]>;
type Listing = Online["listings"][number];
type Packaging = typeof KQ_ONLINE_PACKAGING[number];
const number = (value: number, digits = 1) => value.toLocaleString("fr-FR", { maximumFractionDigits: digits });
const eurosToCents = (value: string) => Math.round(Number(value.replace(",", ".")) * 100);
const realDuration = (hours: number) => hours < 48 ? `${number(hours)} h réelles` : `${number(hours / 24)} jours réels`;
const statusLabels: Record<KqOnlineListingViewState, string> = { active: "En vente", paused: "En pause", suspended: "Ventes suspendues", "sold-out": "Tout vendu", blocked: "Qualité insuffisante", discarded: "Paquets jetés" };

function Satisfaction({ label }: { label: "satisfied" | "neutral" | "disappointed" }) {
  const Icon = label === "satisfied" ? Smile : label === "neutral" ? Meh : Frown;
  return <span className={styles.satisfaction} data-tone={label}><Icon size={18} aria-hidden="true" />{label === "satisfied" ? "Bon rapport qualité-prix" : label === "neutral" ? "Rapport qualité-prix correct" : "Risque de déception"}</span>;
}

function ListingCard({ listing, data, busy, onAsk, initialEditing = false }: { listing: Listing; data: KqCommerceSnapshot; busy: boolean; onAsk: Ask; initialEditing?: boolean }) {
  const [editing, setEditing] = useState(initialEditing);
  const card = useRef<HTMLLIElement>(null);
  const priceToggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (initialEditing) card.current?.scrollIntoView({ block: "start" });
  }, [initialEditing]);
  const online = data.online!;
  const pack = KQ_ONLINE_PACKAGING.find(item => item.code === listing.packagingCode);
  const isActive = listing.status === "active";
  const resumable = listing.status === "paused" || listing.status === "closed";
  const qualityEligible = listing.qualityScore >= 5.8;
  const viewState = getKqOnlineListingViewState(listing, online.site.active);
  const finished = viewState === "sold-out" || viewState === "discarded";
  const forecast = estimateKqOnlineOffer({ listingId: listing.id, quality: listing.qualityScore, route: listing.route, varietyCode: listing.varietyCode, customerDemand: data.customerDemand, baseUnitCents: listing.baseUnitCents, formatGrams: listing.formatGrams, packagingCode: listing.packagingCode, packetPriceCents: listing.packetPriceCents, reputation: data.reputation, clients: data.clients, online, activeListingCount: Math.max(1, online.listings.filter(item => item.status === "active").length), advertisingMultiplier: getKqAdvertisingMultiplier(data.business, Date.parse(online.serverNow)) });
  const ordersPerDay = listing.offer?.ordersPerDay ?? forecast.ordersPerDay;
  const command = (title: string, description: string, name: string, payload: Record<string, unknown>) => onAsk(title, description, { action: "online", command: name, payload }, 0);
  return <li ref={card} className={styles.listing} data-online-listing={listing.id}>
    <div className={styles.listingHeader}>{pack ? <Image src={pack.image} width={64} height={74} sizes="64px" alt="" /> : <PackageOpen size={32} aria-hidden="true" />}<div><strong>{listing.name}</strong><small>{listing.formatGrams} g · {pack?.name ?? "Emballage"} · qualité {number(listing.qualityScore, 2)}/10</small></div><span className={styles.status} data-state={viewState === "active" ? "active" : viewState === "blocked" ? "attention" : "paused"}>{viewState === "active" ? <Globe2 size={13} aria-hidden="true" /> : viewState === "discarded" ? <Trash2 size={13} aria-hidden="true" /> : finished ? <Check size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}{statusLabels[viewState]}</span></div>
    <dl className={styles.listingNumbers}><div><dt>Prix TTC / paquet</dt><dd>{formatKqCash(listing.packetPriceCents)} <small>· {formatKqCash(Math.round(listing.packetPriceCents / listing.formatGrams))}/g</small></dd></div><div><dt>Paquets restants</dt><dd>{number(listing.remainingPackets, 0)} / {number(listing.initialPackets, 0)} <small>· {number(listing.remainingPackets * listing.formatGrams)} g</small></dd></div><div><dt>Ventes réalisées</dt><dd>{number(listing.soldPackets, 0)} paquet{listing.soldPackets > 1 ? "s" : ""}</dd></div></dl>
    {!finished ? <>
      {forecast.customerDemand ? <p><strong>{forecast.customerDemand.matchedFlavorCount} arôme{forecast.customerDemand.matchedFlavorCount > 1 ? "s" : ""} en commun · repère +{number(forecast.customerDemand.bonusPercent)} %.</strong> Ton prix choisi reste inchangé ; le bonus de demande est temporaire et limité en quantité.</p> : null}
      {viewState === "active" ? <p>{number(ordersPerDay)} commande{ordersPerDay > 1 ? "s" : ""} / jour réel estimée{ordersPerDay > 1 ? "s" : ""}. {forecast.priceLabel} La demande est partagée entre tes annonces.</p> : <p>{viewState === "blocked" ? "La qualité actuelle ne permet plus la vente en ligne. Les paquets restent conservés, aucune nouvelle commande n’est acceptée." : viewState === "suspended" ? "Les commandes attendent la réactivation du site. Les paquets restent préparés et continuent de vieillir." : "Ces paquets restent préparés et continuent de vieillir. La vente est en pause."}</p>}
      <div className={styles.actions}><button ref={priceToggle} className={styles.secondary} disabled={busy} aria-expanded={editing} onClick={() => setEditing(value => !value)}><Settings2 size={15} aria-hidden="true" />{editing ? "Fermer les prix" : "Modifier le prix"}</button>{isActive ? <button className={styles.secondary} disabled={busy} onClick={() => command("Mettre l’annonce en pause", "Les commandes déjà passées sont conservées. Les paquets invendus restent préparés et continuent de vieillir dans leur emballage. La progression vers la prochaine commande repart de zéro.", "pause-listing", { listingId: listing.id })}><Pause size={15} aria-hidden="true" />Mettre en pause</button> : resumable ? <button className={styles.primary} disabled={busy || !online.site.active || !qualityEligible} onClick={() => command("Reprendre la vente", `Les ${listing.remainingPackets} paquets restants seront à nouveau proposés au prix de ${formatKqCash(listing.packetPriceCents)} TTC l’unité. La progression vers la prochaine commande repart de zéro. Les ventes déjà réalisées sont conservées.`, "resume-listing", { listingId: listing.id })}><Play size={15} aria-hidden="true" />{!qualityEligible ? "Qualité insuffisante" : !online.site.active ? "Boutique à réactiver" : "Reprendre la vente"}</button> : null}</div>
      {editing ? <KqListingPricing key={`${listing.id}:${listing.packetPriceCents}`} listing={listing} data={data} busy={busy} onAsk={onAsk} onCancel={() => { setEditing(false); priceToggle.current?.focus(); }} /> : null}
      <details className={styles.listingMore}><summary>Jeter les paquets</summary><p>Cette action détruit définitivement les paquets et leurs emballages, sans remboursement ni retour au vrac.</p><div className={styles.actions}><button className={styles.danger} disabled={busy} onClick={() => command("Jeter définitivement les paquets", `${listing.name} : les ${listing.remainingPackets} paquets invendus (${listing.remainingPackets * listing.formatGrams} g) seront définitivement jetés. Le produit et les emballages seront perdus, sans remboursement ni retour au stock. Cette action est irréversible.`, "discard-listing", { listingId: listing.id })}><Trash2 size={15} aria-hidden="true" />Jeter définitivement les paquets</button></div></details>
    </> : null}
    {listing.status === "discarded" ? <p>Les paquets invendus ont été jetés définitivement. Les ventes déjà réalisées restent dans ton historique.</p> : null}
  </li>;
}

export function KqOnlineStore({ data, selectedStockId, now, busy, onAsk, onOpenBusiness, onOpenShop }: { data: KqCommerceSnapshot; selectedStockId?: string; now?: number; busy: boolean; onAsk: Ask; onOpenBusiness?: () => void; onOpenShop: () => void }) {
  const id = useId();
  const [stockId, setStockId] = useState(selectedStockId ?? "");
  const [formatGrams, setFormatGrams] = useState<5 | 10>(5);
  const [family, setFamily] = useState<Packaging["family"]>("kraft");
  const [packets, setPackets] = useState("2");
  const [price, setPrice] = useState("");
  const [purchases, setPurchases] = useState<Record<string, string>>({});
  const online = data.online;
  if (!online) return null;
  const availableStocks = data.stocks.filter(stock => stock.route !== "biomass" && stock.remainingUnits >= 50);
  const stock = selectedStockId ? data.stocks.find(item => item.id === selectedStockId) : availableStocks.find(item => item.id === stockId) ?? availableStocks[0];
  const packaging = KQ_ONLINE_PACKAGING.find(item => item.family === family && item.formatGrams === formatGrams)!;
  const inventory = online.packaging.find(item => item.code === packaging.code)?.quantity ?? 0;
  const maxPackets = stock ? Math.floor(stock.remainingUnits / (formatGrams * 10)) : 0;
  const count = Number(packets);
  const validCount = Number.isSafeInteger(count) && count >= 1 && count <= maxPackets;
  const quality = stock ? getKqCommerceStockQuality(stock) : 0;
  const activeListings = online.listings.filter(listing => listing.status === "active");
  const pendingEstimate = stock ? { quality, route: stock.route, varietyCode: stock.varietyCode, customerDemand: isKqCommerceStockMature(stock, now) ? data.customerDemand : undefined, baseUnitCents: stock.baseUnitCents, formatGrams, packagingCode: packaging.code, reputation: data.reputation, clients: data.clients, online, activeListingCount: activeListings.length + 1, advertisingMultiplier: getKqAdvertisingMultiplier(data.business, Date.parse(online.serverNow)) } : null;
  const initialEstimate = pendingEstimate ? estimateKqOnlineOffer({ ...pendingEstimate, packetPriceCents: Math.round(stock!.baseUnitCents * formatGrams) }) : null;
  const cents = price === "" ? initialEstimate?.referencePacketPriceCents ?? 0 : eurosToCents(price);
  const validPrice = Number.isSafeInteger(cents) && cents >= 1 && cents <= 1_000_000;
  const forecast = pendingEstimate && validPrice ? estimateKqOnlineOffer({ ...pendingEstimate, packetPriceCents: cents }) : null;
  const saleableHours = stock ? getKqOnlineSaleableHours(quality, packaging.code) : 0;
  const expectedSaleHours = forecast && forecast.ordersPerDay > 0 && validCount ? count / forecast.ordersPerDay * 24 : Infinity;
  const conservationRisk = Boolean(stock && online.site.active && validCount && validPrice && quality >= 5.8 && expectedSaleHours > saleableHours);
  const reason = !data.computerOwned ? "Un ordinateur est nécessaire pour gérer tes commandes."
    : !online.site.createdAt ? "Ouvre d’abord ta boutique gratuite dans Commerce → Développer."
      : !online.site.active ? "Réactive ton site dans Commerce → Développer → Site internet pour accepter les commandes."
        : !stock ? selectedStockId ? "Ce lot n’est plus disponible. Reviens au choix des lots pour préparer une autre annonce." : "Prépare un lot dans Commerce → Vendre pour mettre tes premiers paquets en vente."
          : stock.route === "biomass" ? "La biomasse ne se vend pas en paquets en ligne. Choisis le circuit grossiste pour ce lot."
          : maxPackets < 1 ? `Il faut au moins ${formatGrams} g disponibles dans ce lot pour préparer un paquet de ce format.`
          : !isKqCommerceStockMature(stock, now) ? "Le curing de ce lot doit être terminé avant sa mise en vente."
            : (stock.storage?.capacity?.overflowUnits ?? 0) > 0 ? "Règle le manque de contenants de ce lot dans l’entrepôt avant de le préparer."
              : quality < 5.8 ? "La qualité actuelle est insuffisante pour la vente en ligne."
                : packaging.requiresBranding && !online.upgrades.branding ? "L’identité de marque, disponible dans Commerce → Développer → Studio, débloque le doypack imprimé."
                  : !validCount ? `Choisis entre 1 et ${maxPackets} paquet${maxPackets > 1 ? "s" : ""}.`
                    : count > inventory ? `Il te manque ${count - inventory} emballage${count - inventory > 1 ? "s" : ""} de ce format. Achète-les ci-dessus.`
                      : !validPrice ? "Choisis un prix de paquet entre 0,01 € et 10 000 €." : null;
  const command = (title: string, description: string, name: string, payload: Record<string, unknown>, cost = 0) => onAsk(title, description, { action: "online", command: name, payload }, cost);
  return <section className={styles.store} aria-label="Préparer des paquets pour la vente en ligne">
    <header className={styles.heading}><div><span className={styles.eyebrow}><Globe2 size={16} aria-hidden="true" /> Circuit choisi · vente en ligne</span><h2 id={`${id}-title`}>Préparer mes paquets</h2><p>Choisis ton emballage, une quantité et ton prix. Les paquets de 5 ou 10 g rejoindront ta boutique et se vendront progressivement, même hors connexion.</p></div><span className={styles.status} data-state={online.site.active ? "active" : "paused"}>{online.site.active ? <><Check size={14} aria-hidden="true" />Boutique ouverte</> : online.site.createdAt ? "Boutique suspendue" : "Boutique à ouvrir"}</span></header>
    <div className={styles.actions}><Link className={styles.secondary} href="/arene/placard?view=market&section=management" prefetch={false} onClick={event => { if (onOpenBusiness) { event.preventDefault(); onOpenBusiness(); } }}><Settings2 size={16} aria-hidden="true" />Développer ma boutique<ArrowRight size={15} aria-hidden="true" /></Link></div>
    {stock?.route === "raw" ? <div className={styles.notice}><Info size={19} aria-hidden="true" /><p>Repères indoor : <strong>7 €/g</strong> en bonne qualité, <strong>8 €/g</strong> en premium dès 8,5/10, <strong>10 €/g</strong> pour un lot exceptionnel dès 9,5/10. Un arôme recherché donne un bonus de demande ; deux donnent le bonus complet. Tu fixes toujours ton prix et peux vendre sans correspondance.</p></div> : null}
    {!online.site.createdAt || !online.site.active ? <div className={styles.notice}><Info size={19} aria-hidden="true" /><div><p>{!online.site.createdAt ? "La boutique de base ouvre gratuitement, sans abonnement. Elle prélève 2,5 % de frais sur les ventes. Au départ, les clients sont peu nombreux : construis progressivement ton audience dans Commerce → Développer → Promouvoir." : "Ton site est suspendu. Les paquets et les annonces sont conservés ; réactive la boutique pour reprendre les commandes."}</p>{!data.computerOwned ? <button className={styles.secondary} disabled={busy} onClick={onOpenShop}>Voir l’ordinateur · 450 €</button> : null}</div></div> : null}

    <section className={styles.preparation} aria-labelledby={`${id}-prepare`}><div className={styles.sectionHeading}><h3 id={`${id}-prepare`}><span className={styles.benchNumber} aria-hidden="true">01</span>Préparer une annonce</h3><small>Les emballages sont consommés à la préparation.</small></div>
      <div className={styles.form}>
        <div className={styles.formGrid}>{selectedStockId ? <div className={styles.field}><span>Le lot à conditionner</span><strong className={styles.selectedLot}>{stock ? `${stock.name} · ${number(stock.remainingUnits / 10)} g en vrac` : "Ce lot n’a plus assez de vrac disponible."}</strong><small className={styles.help}>{stock ? `Qualité actuelle : ${number(quality, 2)}/10 · Les grammes mis en rayon sont séparés de ce stock.` : "Reviens au choix des lots pour préparer une autre annonce."}</small></div> : <label>Le lot à conditionner<select value={stock?.id ?? ""} disabled={busy || !availableStocks.length} onChange={event => { setStockId(event.target.value); setPrice(""); }}><option value="" disabled>Aucun lot préparé disponible</option>{availableStocks.map(item => <option key={item.id} value={item.id}>{item.name} · {number(item.remainingUnits / 10)} g en vrac</option>)}</select><small>{stock ? `Qualité actuelle : ${number(quality, 2)}/10 · Les grammes mis en rayon sont séparés de ce stock.` : "Transforme une récolte ou prépare des fleurs entières dans Commerce → Vendre."}</small></label>}<label>Format d’un paquet<select value={formatGrams} disabled={busy} onChange={event => { setFormatGrams(Number(event.target.value) as 5 | 10); setPrice(""); }}><option value={5}>5 g · petit format</option><option value={10}>10 g · grand format</option></select><small>Un emballage par paquet.</small></label></div>
        <fieldset className={styles.choices}><legend>Choisis ta présentation</legend><div className={styles.packagingGrid}>{KQ_ONLINE_PACKAGING.filter(item => item.formatGrams === formatGrams).map(item => {
          const quantity = online.packaging.find(owned => owned.code === item.code)?.quantity ?? 0;
          const locked = item.requiresBranding && !online.upgrades.branding;
          const buyValue = purchases[item.code] ?? "10";
          const buyCount = Number(buyValue);
          const validBuy = Number.isSafeInteger(buyCount) && buyCount > 0 && buyCount <= 1000;
          const buyCost = validBuy ? item.unitCostCents * buyCount : 0;
          return <article key={item.code} className={styles.package} data-selected={packaging.code === item.code}><label><span className={styles.packageArt}><Image src={item.image} alt="" fill sizes="(max-width: 600px) 115px, 280px" /></span><span className={styles.packageTitle}><input type="radio" name={`${id}-packaging`} value={item.family} checked={packaging.code === item.code} disabled={busy} onChange={() => setFamily(item.family)} />{item.name}</span><span className={styles.packageCopy}><strong>{formatKqCash(item.unitCostCents)} / emballage</strong><span>{item.family === "kraft" ? "Artisanal, simple et accessible." : item.family === "printed" ? "Une présentation aux couleurs de ta marque." : "Une présentation premium pour tes plus beaux lots."}</span><span>{item.protectionRate < 1 ? `Vieillissement ralenti de ${Math.round((1 - item.protectionRate) * 100)} % une fois conditionné.` : "Protection de base, adaptée aux ventes rapides."}</span><span>{item.satisfactionBonus ? `Présentation : jusqu’à +${item.satisfactionBonus} points de satisfaction.` : "La qualité et le prix font la différence."}</span></span></label><div className={styles.purchase}><small>{locked ? "Identité de marque requise dans Commerce → Développer → Studio" : `${quantity} emballage${quantity > 1 ? "s" : ""} disponible${quantity > 1 ? "s" : ""}`}</small><input aria-label={`Quantité de ${item.name} à acheter`} type="number" inputMode="numeric" min="1" max="1000" step="1" value={buyValue} disabled={busy || locked} onChange={event => setPurchases(previous => ({ ...previous, [item.code]: event.target.value }))} /><button type="button" className={styles.secondary} disabled={busy || locked || !validBuy || data.cashCents < buyCost} onClick={() => command("Acheter des emballages", `${buyCount} × ${item.name} (${formatGrams} g), soit ${formatKqCash(buyCost)}. Ils rejoignent ton stock d’emballages vides et seront consommés à la préparation des paquets.`, "buy-packaging", { code: item.code, quantity: buyCount }, buyCost)}>Acheter · {formatKqCash(buyCost)}</button></div></article>;
        })}</div></fieldset>
        <div className={styles.priceGrid}><label>Nombre de paquets<input type="number" inputMode="numeric" min="1" max={Math.max(1, maxPackets)} step="1" value={packets} disabled={busy} onChange={event => setPackets(event.target.value)} /><small>{validCount ? `${number(count * formatGrams)} g réservés à cette annonce.` : `${maxPackets} paquets possibles dans ce lot.`}</small></label><label>Ton prix TTC par paquet (€)<input type="number" inputMode="decimal" min="0.01" max="10000" step="0.01" value={price} placeholder={initialEstimate ? (initialEstimate.referencePacketPriceCents / 100).toFixed(2) : "0,00"} disabled={busy} onChange={event => setPrice(event.target.value)} /><small>{validPrice ? `${formatKqCash(Math.round(cents / formatGrams))}/g TTC.` : "Saisis un montant positif."}</small></label><div className={styles.field}><span>Repère pour ce produit</span><button type="button" className={styles.secondary} disabled={busy || !initialEstimate} onClick={() => setPrice(((initialEstimate?.referencePacketPriceCents ?? 0) / 100).toFixed(2))}>{initialEstimate ? formatKqCash(initialEstimate.referencePacketPriceCents) : "—"} / paquet</button><small className={styles.help}>Un repère de valeur, sans garantie de vente. Tu choisis le prix final.</small></div></div>
        {forecast ? <div className={styles.preview} aria-live="polite"><div className={styles.previewTop}><div><strong>{number(forecast.ordersPerDay)} commande{forecast.ordersPerDay > 1 ? "s" : ""}<small>par jour réel estimée{forecast.ordersPerDay > 1 ? "s" : ""} · {number(forecast.gramsPerDay)} g / jour réel</small></strong></div><Satisfaction label={forecast.satisfactionLabel} /></div><p>{forecast.priceLabel} {forecast.ordersPerDay > 0 && validCount ? `À ce rythme, environ ${number(count / forecast.ordersPerDay)} jours réels pour écouler ces paquets.` : "Un prix plus adapté ou davantage de visiteurs peut aider."}</p><dl className={styles.breakdown}><div><dt>Prix TTC d’un paquet</dt><dd>{formatKqCash(cents)}</dd></div><div><dt>TVA de jeu estimée</dt><dd>−{formatKqCash(Math.round(cents / 6))}</dd></div><div><dt>Frais de vente du site</dt><dd>−{formatKqCash(forecast.feeCents)}</dd></div><div><dt>Emballage consommé, déjà acheté</dt><dd>−{formatKqCash(forecast.packagingCostCents)}</dd></div><div><dt>Reste avant coût de culture</dt><dd>{formatKqCash(forecast.netBeforeProductionCents)}</dd></div></dl><p>Cette estimation n’est pas une marge : elle exclut la culture, les abonnements et les remboursements de dettes. Les annonces partagent les visiteurs ; qualité, confiance et demande évoluent avec le temps.</p></div> : null}
        {forecast?.customerDemand ? <div className={styles.notice}><Info size={19} aria-hidden="true" /><p><strong>{forecast.customerDemand.matchedFlavorCount} arôme{forecast.customerDemand.matchedFlavorCount > 1 ? "s" : ""} en commun · repère +{number(forecast.customerDemand.bonusPercent)} %.</strong> Le repère affiché comprend ce bonus temporaire, sur le volume encore demandé. Ton prix choisi reste libre et ne changera pas à la fin de la demande.</p></div> : null}
        {conservationRisk ? <div className={styles.notice} role="status"><Clock3 size={19} aria-hidden="true" /><p><strong>Cette quantité risque de rester trop longtemps en rayon.</strong> Avec cet emballage, la qualité passerait sous le seuil de vente de 5,8/10 après environ {realDuration(saleableHours)}. {Number.isFinite(expectedSaleHours) ? `Au rythme actuellement estimé, l’écoulement demanderait environ ${realDuration(expectedSaleHours)}.` : "Aucune commande n’est actuellement estimée à ce prix."} Prépare moins de paquets ou adapte ton prix. L’écoulement reste incertain ; les paquets continuent de vieillir même en pause.</p></div> : null}
        {reason ? <p className={styles.error} role="status">{reason}</p> : null}
        <button className={styles.primary} disabled={busy || Boolean(reason)} onClick={() => {
          if (!stock || reason) return;
          command("Préparer et mettre en vente", `${stock.name} : ${count} paquets de ${formatGrams} g dans ${packaging.name}. ${count * formatGrams} g quittent le vrac et ${count} emballages sont consommés. Prix libre : ${formatKqCash(cents)} TTC par paquet. Les ventes seront progressives, même hors connexion. La mise en pause conserve les paquets préparés.`, "create-listing", { stockId: stock.id, formatGrams, packagingCode: packaging.code, packets: count, packetPriceCents: cents });
        }}><ShoppingBag size={18} aria-hidden="true" />Préparer {validCount ? `${count} paquet${count > 1 ? "s" : ""}` : "les paquets"} et mettre en vente<ArrowRight size={17} aria-hidden="true" /></button>
        <small className={styles.help}>Le conditionnement préserve la qualité actuelle ; il ne rajeunit pas le lot. Les paquets restent préparés si tu mets l’annonce en pause.</small>
      </div>
    </section>

  </section>;
}

type ListingFilter = "all" | "active" | "paused" | "blocked";
const listingFilters: Array<{ code: ListingFilter; name: string }> = [
  { code: "all", name: "Toutes" }, { code: "active", name: "En vente" },
  { code: "paused", name: "En pause" },
  { code: "blocked", name: "À vérifier" },
];
function listingGroup(listing: Listing, siteActive: boolean): Exclude<ListingFilter, "all"> {
  const state = getKqOnlineListingViewState(listing, siteActive);
  return state === "active" ? "active" : state === "blocked" ? "blocked" : "paused";
}

export function KqOnlineDashboard({ data, busy, onAsk, onOpenBusiness, onOpenMerch, onOpenShop, onPrepareStock, initialListingId }: {
  data: KqCommerceSnapshot; now?: number; busy: boolean; onAsk: Ask;
  onOpenBusiness?: () => void; onOpenMerch?: () => void; onOpenShop: () => void; onPrepareStock: () => void; initialListingId?: string;
}) {
  const id = useId();
  const [filter, setFilter] = useState<ListingFilter>("all");
  const [rayon, setRayon] = useState<"flowers" | "merch">(!initialListingId && (data.online?.listings.length ?? 0) === 0 && (data.online?.merch?.inventory?.length ?? 0) > 0 ? "merch" : "flowers");
  const [rayonsOpened, setRayonsOpened] = useState((data.online?.merch?.inventory?.length ?? 0) > 0);
  const merchTab = useRef<HTMLButtonElement>(null);
  const focusMerch = useRef(false);
  const missingListingNotice = useRef<HTMLDivElement>(null);
  const listingResults = useRef<HTMLDivElement>(null);
  const targetListing = initialListingId ? data.online?.listings.find(listing => listing.id === initialListingId) : undefined;
  const missingListing = Boolean(initialListingId && data.online && (!targetListing || targetListing.remainingPackets <= 0 || ["sold-out", "discarded"].includes(targetListing.status)));
  useEffect(() => {
    if (missingListing) missingListingNotice.current?.focus();
  }, [initialListingId, missingListing]);
  useEffect(() => {
    if (focusMerch.current) {
      focusMerch.current = false;
      merchTab.current?.focus();
    }
  }, [rayon]);
  const activity = getKqShopActivity(data);
  const online = data.online;
  if (!online) return null;
  const currentListings = online.listings.filter(listing => listing.remainingPackets > 0 && listing.status !== "sold-out" && listing.status !== "discarded");
  const groups = Object.fromEntries(listingFilters.map(item => [item.code, currentListings.filter(listing => item.code === "all" || listingGroup(listing, online.site.active) === item.code)])) as Record<ListingFilter, Listing[]>;
  const sumPackets = (listings: Listing[]) => listings.reduce((sum, listing) => sum + listing.remainingPackets, 0);
  const soldPackets = online.listings.reduce((sum, listing) => sum + listing.soldPackets, 0);
  const remainingPackets = sumPackets(online.listings);
  const remainingGrams = online.listings.reduce((sum, listing) => sum + listing.remainingPackets * listing.formatGrams, 0);
  const discardedPackets = online.listings.filter(listing => listing.status === "discarded").reduce((sum, listing) => sum + Math.max(0, listing.initialPackets - listing.soldPackets), 0);
  const displayedListings = groups[filter];
  const showRayons = rayonsOpened || (activity.merch.inventory?.length ?? 0) > 0;
  return <section className={`${styles.store} ${styles.dashboard}`} aria-label="Mes ventes en ligne">
    <KqChapterHeading art="commerce" title="Mon stock en vente" titleId={`${id}-title`} compact />
    {!online.site.active ? <div className={styles.notice}><Info size={19} aria-hidden="true" /><div><p>{online.site.createdAt ? "Boutique suspendue : tes paquets sont conservés, les commandes sont à l’arrêt." : "Ouvre gratuitement ta boutique pour commencer les ventes en ligne."}</p><Link className={styles.secondary} href="/arene/placard?view=market&section=management" prefetch={false} onClick={event => { if (onOpenBusiness) { event.preventDefault(); onOpenBusiness(); } }}><Settings2 size={16} aria-hidden="true" />{online.site.createdAt ? "Voir la réactivation" : "Ouvrir ma boutique"}<ArrowRight size={15} aria-hidden="true" /></Link>{!data.computerOwned ? <button className={styles.secondary} disabled={busy} onClick={onOpenShop}>Voir l’ordinateur · 450 €</button> : null}</div></div> : null}

    {showRayons ? <div className={styles.filters} role="group" aria-label="Choisir un rayon"><button type="button" aria-pressed={rayon === "flowers"} onClick={() => { setRayonsOpened(true); setRayon("flowers"); }}>Fleurs et extraits<span>{number(remainingPackets, 0)} paquets</span></button><button ref={merchTab} type="button" data-online-rayon="merch" aria-pressed={rayon === "merch"} onClick={() => { setRayonsOpened(true); setRayon("merch"); }}>Produits dérivés<span>{activity.merch.remainingUnits === null ? "—" : number(activity.merch.remainingUnits, 0)} articles</span></button></div> : null}
    <div hidden={rayon !== "merch"}><KqMerchActivity data={data} onOpenMerch={onOpenMerch ?? onOpenBusiness} /></div>
    <div hidden={rayon !== "flowers"}>
    <section className={styles.currentStock} aria-labelledby={`${id}-title`} data-online-listings-heading tabIndex={-1}>
      {missingListing ? <div ref={missingListingNotice} className={styles.missingListing} data-missing-listing={initialListingId} tabIndex={-1} role="status">
        <h3>{!targetListing ? "Annonce introuvable" : targetListing.status === "discarded" ? "Les paquets ont été jetés" : "Cette annonce est épuisée"}</h3>
        {targetListing ? <p><strong>{targetListing.name}</strong></p> : null}
        <p>{!targetListing ? "L’annonce demandée n’apparaît pas dans les données actuelles. Elle n’a pas été remplacée par une autre annonce."
          : targetListing.status === "discarded" ? "Ses paquets ont été retirés définitivement. Cette annonce ne peut plus reprendre ses ventes."
          : "Aucun paquet ne reste à vendre dans cette annonce. Les ventes enregistrées restent dans le journal des ventes ci-dessous."}</p>
        {currentListings.length > 0 ? <button type="button" className={styles.secondary} onClick={() => { setFilter("all"); listingResults.current?.focus(); }}>Voir les autres annonces<ArrowRight size={16} aria-hidden="true" /></button> : null}
      </div> : null}
      {currentListings.length > 0 ? <p className={styles.stockSummary}><strong>{number(remainingPackets, 0)} paquets · {number(remainingGrams)} g</strong><span>Fleurs et extraits · {currentListings.length} annonce{currentListings.length > 1 ? "s" : ""}</span></p> : null}
      <div ref={listingResults} tabIndex={-1} className={styles.listingResults} aria-label="Annonces disponibles">
      {currentListings.length > 1 || filter !== "all" ? <div className={styles.filters} role="group" aria-label="Filtrer les annonces">{listingFilters.map(item => <button key={item.code} type="button" aria-pressed={filter === item.code} onClick={() => setFilter(item.code)}>{item.name}<span aria-label={`${groups[item.code].length} annonces`}>{groups[item.code].length}</span></button>)}</div> : null}
      {currentListings.length > 0 ? <p className={filter === "all" ? "sr-only" : styles.filterResult} role="status">{displayedListings.length} annonce{displayedListings.length > 1 ? "s" : ""} affichée{displayedListings.length > 1 ? "s" : ""}{filter !== "all" ? ` · ${listingFilters.find(item => item.code === filter)?.name}` : ""}.</p> : null}
      {displayedListings.length ? <ul className={styles.listings}>{displayedListings.map(listing => <ListingCard key={listing.id} listing={listing} data={data} busy={busy} onAsk={onAsk} initialEditing={listing.id === initialListingId} />)}</ul> : <div className={styles.empty}><PackageOpen size={34} aria-hidden="true" /><p>{currentListings.length ? "Aucune annonce dans ce filtre. Tes autres paquets restent accessibles dans « Toutes »." : online.listings.length ? "Aucun sachet restant dans tes annonces. Retrouve les ventes effectuées dans le journal des ventes." : "Ton rayon attend ses premiers paquets. Choisis un lot, puis le circuit de vente en ligne pour préparer ta première annonce."}</p>{currentListings.length ? <button className={styles.secondary} onClick={() => setFilter("all")}>Voir toutes les annonces</button> : <button className={styles.primary} disabled={busy} onClick={onPrepareStock}><ShoppingBag size={17} aria-hidden="true" />Préparer une nouvelle annonce<ArrowRight size={17} aria-hidden="true" /></button>}</div>}
      </div>
    </section>

    {currentListings.length > 0 || !showRayons ? <div className={styles.dashboardActions}>{currentListings.length > 0 ? <button className={styles.secondary} disabled={busy} onClick={onPrepareStock}><ShoppingBag size={17} aria-hidden="true" />Préparer une nouvelle annonce<ArrowRight size={17} aria-hidden="true" /></button> : null}{!showRayons ? <button data-online-rayon="merch" className={styles.secondary} onClick={() => { focusMerch.current = true; setRayonsOpened(true); setRayon("merch"); }}>Produits dérivés<ArrowRight size={17} aria-hidden="true" /></button> : null}</div> : null}

    {online.listings.length || online.stats.orders ? <details className={styles.salesSummary}>
      <summary>Bilan des paquets et des ventes<span>{number(online.stats.orders, 0)} commandes · {formatKqCash(online.stats.netRevenueCents)} versés</span></summary>
    <section className={styles.packetLedger} aria-labelledby={`${id}-packets`}>
      <div className={styles.sectionHeading}><h3 id={`${id}-packets`}>Où en sont tes paquets ?</h3><small>Les stocks en vrac restent dans « Vendre ».</small></div>
      <dl className={styles.packetTotals} aria-label="Stock des paquets">
        <div><dt>Paquets vendus</dt><dd>{number(soldPackets, 0)}</dd><small>depuis l’ouverture</small></div>
        <div><dt>Paquets restants</dt><dd>{number(remainingPackets, 0)}</dd><small>{number(remainingGrams)} g conditionnés</small></div>
        <div><dt>En vente</dt><dd>{number(sumPackets(groups.active), 0)}</dd><small>{groups.active.length} annonce{groups.active.length > 1 ? "s" : ""} ouverte{groups.active.length > 1 ? "s" : ""}</small></div>
        <div><dt>En pause / suspendus</dt><dd>{number(sumPackets(groups.paused), 0)}</dd><small>conservés sans vente</small></div>
        <div><dt>Qualité insuffisante</dt><dd>{number(sumPackets(groups.blocked), 0)}</dd><small>vente bloquée</small></div>
      </dl>
      <p className={styles.ledgerNote}>Les paquets restants comprennent ceux en vente, en pause ou bloqués. Ils continuent de vieillir. La pause conserve le produit et l’emballage.{discardedPackets > 0 ? ` ${number(discardedPackets, 0)} paquet${discardedPackets > 1 ? "s ont" : " a"} été jeté${discardedPackets > 1 ? "s" : ""} définitivement.` : ""}</p>
    </section>

    <section className={styles.results} aria-labelledby={`${id}-results`}>
      <div className={styles.sectionHeading}><h3 id={`${id}-results`}>Fleurs et extraits · depuis l’ouverture</h3><small>Ventes réellement enregistrées, même hors connexion.</small></div>
      <dl className={styles.stats} aria-label="Résultats depuis l’ouverture"><div><dt>Commandes</dt><dd>{number(online.stats.orders, 0)}</dd></div><div><dt>Ventes TTC</dt><dd>{formatKqCash(online.stats.revenueCents)}</dd></div><div><dt>Versé en trésorerie</dt><dd>{formatKqCash(online.stats.netRevenueCents)}</dd></div><div><dt>Quantité vendue</dt><dd>{number(online.stats.soldGrams)} <small>g</small></dd></div></dl>
      <p className={styles.ledgerNote}>Les versements sont ceux réellement crédités après les retenues de jeu et les éventuels remboursements automatiques. Ce n’est pas un bénéfice : la culture et les emballages ont leurs propres coûts. Frais de vente cumulés : {formatKqCash(online.stats.feesCents)}.</p>
      <dl className={styles.audienceStrip}><div><dt>Confiance commerciale</dt><dd>{number(online.confidence)} / 100</dd></div><div><dt>Audience de ta marque</dt><dd>{number(online.followers, 0)} abonnés</dd></div><div><dt>Visites cumulées</dt><dd>{number(online.stats.visitors, 0)}</dd></div></dl>
    </section>

    </details> : null}
    </div>
    <KqOnlineSalesJournal revision={`${online.stats.orders}:${online.merch?.stats.unitsSold ?? ""}`} />
  </section>;
}
