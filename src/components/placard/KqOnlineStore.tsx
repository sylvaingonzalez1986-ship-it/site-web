"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useState } from "react";
import { ArrowRight, Check, Clock3, Frown, Globe2, Info, Meh, PackageOpen, Pause, Play, Settings2, ShoppingBag, Smile, Trash2 } from "lucide-react";
import { getKqCommerceStockQuality, isKqCommerceStockMature, type KqCommerceSnapshot } from "@/lib/kanab-quest-commerce";
import { getKqAdvertisingMultiplier } from "@/lib/kanab-quest-business";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { KQ_ONLINE_PACKAGING, estimateKqOnlineOffer, getKqOnlineSaleableHours } from "@/lib/kanab-quest-online";
import styles from "./KqOnlineStore.module.css";

type Ask = (title: string, description: string, body: Record<string, unknown>, cost?: number) => void;
type Online = NonNullable<KqCommerceSnapshot["online"]>;
type Listing = Online["listings"][number];
type Packaging = typeof KQ_ONLINE_PACKAGING[number];
const number = (value: number, digits = 1) => value.toLocaleString("fr-FR", { maximumFractionDigits: digits });
const eurosToCents = (value: string) => Math.round(Number(value.replace(",", ".")) * 100);
const realDuration = (hours: number) => hours < 48 ? `${number(hours)} h réelles` : `${number(hours / 24)} jours réels`;
const statusLabels: Record<Listing["status"], string> = { active: "En vente", paused: "En pause", closed: "Retirée du rayon", "sold-out": "Tout vendu", "quality-blocked": "Qualité insuffisante", discarded: "Paquets jetés" };

function Satisfaction({ label }: { label: "satisfied" | "neutral" | "disappointed" }) {
  const Icon = label === "satisfied" ? Smile : label === "neutral" ? Meh : Frown;
  return <span className={styles.satisfaction} data-tone={label}><Icon size={18} aria-hidden="true" />{label === "satisfied" ? "Bon rapport qualité-prix" : label === "neutral" ? "Rapport qualité-prix correct" : "Risque de déception"}</span>;
}

function ListingCard({ listing, data, busy, onAsk }: { listing: Listing; data: KqCommerceSnapshot; busy: boolean; onAsk: Ask }) {
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState((listing.packetPriceCents / 100).toFixed(2));
  const online = data.online!;
  const pack = KQ_ONLINE_PACKAGING.find(item => item.code === listing.packagingCode);
  const cents = eurosToCents(price);
  const priceValid = Number.isSafeInteger(cents) && cents >= 1 && cents <= 1_000_000;
  const isActive = listing.status === "active";
  const resumable = listing.status === "paused" || listing.status === "closed";
  const qualityEligible = listing.qualityScore >= 5.8;
  const finished = listing.status === "sold-out" || listing.remainingPackets === 0;
  const forecast = estimateKqOnlineOffer({ quality: listing.qualityScore, baseUnitCents: listing.baseUnitCents, formatGrams: listing.formatGrams, packagingCode: listing.packagingCode, packetPriceCents: editing && priceValid ? cents : listing.packetPriceCents, reputation: data.reputation, clients: data.clients, online, activeListingCount: Math.max(1, online.listings.filter(item => item.status === "active").length), advertisingMultiplier: getKqAdvertisingMultiplier(data.business, Date.parse(online.serverNow)) });
  const ordersPerDay = !editing && listing.offer ? listing.offer.ordersPerDay : forecast.ordersPerDay;
  const command = (title: string, description: string, name: string, payload: Record<string, unknown>) => onAsk(title, description, { action: "online", command: name, payload }, 0);
  return <li className={styles.listing}>
    <div className={styles.listingHeader}>{pack ? <Image src={pack.image} width={64} height={74} sizes="64px" alt="" /> : <PackageOpen size={32} aria-hidden="true" />}<div><strong>{listing.name}</strong><small>{listing.formatGrams} g · {pack?.name ?? "Emballage"} · qualité {number(listing.qualityScore, 2)}/10</small></div><span className={styles.status} data-state={isActive && online.site.active ? "active" : listing.status === "quality-blocked" ? "attention" : "paused"}>{isActive && online.site.active ? <Globe2 size={13} aria-hidden="true" /> : listing.status === "discarded" ? <Trash2 size={13} aria-hidden="true" /> : finished ? <Check size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}{isActive && !online.site.active ? "Ventes suspendues" : statusLabels[listing.status]}</span></div>
    <dl className={styles.listingNumbers}><div><dt>Prix TTC / paquet</dt><dd>{formatKqCash(listing.packetPriceCents)} <small>· {formatKqCash(Math.round(listing.packetPriceCents / listing.formatGrams))}/g</small></dd></div><div><dt>Paquets restants</dt><dd>{number(listing.remainingPackets, 0)} / {number(listing.initialPackets, 0)} <small>· {number(listing.remainingPackets * listing.formatGrams)} g</small></dd></div><div><dt>Ventes réalisées</dt><dd>{number(listing.soldPackets, 0)} paquet{listing.soldPackets > 1 ? "s" : ""}</dd></div></dl>
    {!finished ? <>
      {isActive && online.site.active ? <p>{number(ordersPerDay)} commande{ordersPerDay > 1 ? "s" : ""} / jour réel estimée{ordersPerDay > 1 ? "s" : ""}. {forecast.priceLabel} La demande est partagée entre tes annonces.</p> : <p>{!qualityEligible ? "La qualité actuelle ne permet plus la vente en ligne. Les paquets restent conservés, aucune nouvelle commande n’est acceptée." : isActive && !online.site.active ? "Les commandes attendent la réactivation du site. Les paquets restent préparés et continuent de vieillir." : "Ces paquets restent préparés et conservés. Ils ne sont pas vendus tant que l’annonce reste arrêtée."}</p>}
      {editing ? <form className={styles.priceForm} onSubmit={event => {
        event.preventDefault();
        if (!priceValid || busy) return;
        command("Modifier ton prix", `${formatKqCash(cents)} TTC le paquet de ${listing.formatGrams} g (${formatKqCash(Math.round(cents / listing.formatGrams))}/g). Le nouveau prix s’applique aux prochaines commandes ; les ventes déjà passées gardent leur prix.`, "update-listing", { listingId: listing.id, packetPriceCents: cents });
        setEditing(false);
      }}><label>Prix TTC du paquet (€)<input type="number" inputMode="decimal" min="0.01" max="10000" step="0.01" value={price} onChange={event => setPrice(event.target.value)} disabled={busy} autoFocus /></label><button className={styles.primary} disabled={busy || !priceValid || cents === listing.packetPriceCents}>Enregistrer</button><button type="button" className={styles.secondary} disabled={busy} onClick={() => setEditing(false)}>Annuler</button></form> : null}
      <div className={styles.actions}><button className={styles.secondary} disabled={busy} onClick={() => { setPrice((listing.packetPriceCents / 100).toFixed(2)); setEditing(value => !value); }}><Settings2 size={15} aria-hidden="true" />Modifier le prix</button>{isActive ? <button className={styles.secondary} disabled={busy} onClick={() => command("Mettre l’annonce en pause", "Les commandes déjà passées sont conservées. Les paquets invendus restent préparés et continuent de vieillir dans leur emballage.", "pause-listing", { listingId: listing.id })}><Pause size={15} aria-hidden="true" />Mettre en pause</button> : resumable ? <button className={styles.primary} disabled={busy || !online.site.active || !qualityEligible} onClick={() => command("Remettre les paquets en vente", `Les ${listing.remainingPackets} paquets restants seront à nouveau proposés au prix de ${formatKqCash(listing.packetPriceCents)} TTC l’unité.`, "resume-listing", { listingId: listing.id })}><Play size={15} aria-hidden="true" />{!qualityEligible ? "Qualité insuffisante" : !online.site.active ? "Boutique à réactiver" : "Reprendre les ventes"}</button> : null}{listing.status !== "closed" ? <button className={styles.secondary} disabled={busy} onClick={() => command("Retirer du rayon", "L’annonce quitte le rayon. Les paquets invendus restent préparés et pourront être remis en vente si leur qualité le permet ; ils ne retournent pas dans le stock en vrac. Les emballages utilisés ne sont pas remboursés.", "close-listing", { listingId: listing.id })}>Retirer du rayon</button> : null}<button className={styles.danger} disabled={busy} onClick={() => command("Jeter définitivement les paquets", `${listing.name} : les ${listing.remainingPackets} paquets invendus (${listing.remainingPackets * listing.formatGrams} g) seront définitivement jetés. Le produit et les emballages seront perdus, sans remboursement ni retour au stock. Cette action est irréversible.`, "discard-listing", { listingId: listing.id })}><Trash2 size={15} aria-hidden="true" />Jeter les paquets</button></div>
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
  const pendingEstimate = stock ? { quality, baseUnitCents: stock.baseUnitCents, formatGrams, packagingCode: packaging.code, reputation: data.reputation, clients: data.clients, online, activeListingCount: activeListings.length + 1, advertisingMultiplier: getKqAdvertisingMultiplier(data.business, Date.parse(online.serverNow)) } : null;
  const initialEstimate = pendingEstimate ? estimateKqOnlineOffer({ ...pendingEstimate, packetPriceCents: Math.round(stock!.baseUnitCents * formatGrams) }) : null;
  const cents = price === "" ? initialEstimate?.referencePacketPriceCents ?? 0 : eurosToCents(price);
  const validPrice = Number.isSafeInteger(cents) && cents >= 1 && cents <= 1_000_000;
  const forecast = pendingEstimate && validPrice ? estimateKqOnlineOffer({ ...pendingEstimate, packetPriceCents: cents }) : null;
  const saleableHours = stock ? getKqOnlineSaleableHours(quality, packaging.code) : 0;
  const expectedSaleHours = forecast && forecast.ordersPerDay > 0 && validCount ? count / forecast.ordersPerDay * 24 : Infinity;
  const conservationRisk = Boolean(stock && online.site.active && validCount && validPrice && quality >= 5.8 && expectedSaleHours > saleableHours);
  const reason = !data.computerOwned ? "Un ordinateur est nécessaire pour gérer tes commandes."
    : !online.site.createdAt ? "Ouvre d’abord ta boutique gratuite dans « Ma boutique » au Marché."
      : !online.site.active ? "Réactive ton site dans « Ma boutique » au Marché pour accepter les commandes."
        : !stock ? selectedStockId ? "Ce lot n’est plus disponible. Reviens au choix des lots pour préparer une autre annonce." : "Prépare un lot au Marché pour mettre tes premiers paquets en vente."
          : stock.route === "biomass" ? "La biomasse ne se vend pas en paquets en ligne. Choisis le circuit grossiste pour ce lot."
          : maxPackets < 1 ? `Il faut au moins ${formatGrams} g disponibles dans ce lot pour préparer un paquet de ce format.`
          : !isKqCommerceStockMature(stock, now) ? "Le curing de ce lot doit être terminé avant sa mise en vente."
            : (stock.storage?.capacity?.overflowUnits ?? 0) > 0 ? "Règle le manque de contenants de ce lot dans l’entrepôt avant de le préparer."
              : quality < 5.8 ? "La qualité actuelle est insuffisante pour la vente en ligne."
                : packaging.requiresBranding && !online.upgrades.branding ? "L’identité de marque, disponible dans « Ma boutique », débloque le doypack imprimé."
                  : !validCount ? `Choisis entre 1 et ${maxPackets} paquet${maxPackets > 1 ? "s" : ""}.`
                    : count > inventory ? `Il te manque ${count - inventory} emballage${count - inventory > 1 ? "s" : ""} de ce format. Achète-les ci-dessus.`
                      : !validPrice ? "Choisis un prix de paquet entre 0,01 € et 10 000 €." : null;
  const command = (title: string, description: string, name: string, payload: Record<string, unknown>, cost = 0) => onAsk(title, description, { action: "online", command: name, payload }, cost);
  return <section className={styles.store} aria-label="Préparer des paquets pour la vente en ligne">
    <header className={styles.heading}><div><span className={styles.eyebrow}><Globe2 size={16} aria-hidden="true" /> Circuit choisi · vente en ligne</span><h2 id={`${id}-title`}>Préparer mes paquets</h2><p>Choisis ton emballage, une quantité et ton prix. Les paquets de 5 ou 10 g rejoindront ta boutique et se vendront progressivement, même hors connexion.</p></div><span className={styles.status} data-state={online.site.active ? "active" : "paused"}>{online.site.active ? <><Check size={14} aria-hidden="true" />Boutique ouverte</> : online.site.createdAt ? "Boutique suspendue" : "Boutique à ouvrir"}</span></header>
    <div className={styles.actions}><Link className={styles.secondary} href="/arene/placard?view=market&section=management" prefetch={false} onClick={event => { if (onOpenBusiness) { event.preventDefault(); onOpenBusiness(); } }}><Settings2 size={16} aria-hidden="true" />Développer ma boutique<ArrowRight size={15} aria-hidden="true" /></Link></div>
    {!online.site.createdAt || !online.site.active ? <div className={styles.notice}><Info size={19} aria-hidden="true" /><div><p>{!online.site.createdAt ? "La boutique de base ouvre gratuitement, sans abonnement. Elle prélève 2,5 % de frais sur les ventes. Au départ, les clients sont peu nombreux : construis progressivement ton audience dans « Ma boutique »." : "Ton site est suspendu. Les paquets et les annonces sont conservés ; réactive la boutique pour reprendre les commandes."}</p>{!data.computerOwned ? <button className={styles.secondary} disabled={busy} onClick={onOpenShop}>Voir l’ordinateur · 450 €</button> : null}</div></div> : null}

    <section className={styles.preparation} aria-labelledby={`${id}-prepare`}><div className={styles.sectionHeading}><h3 id={`${id}-prepare`}><span className={styles.benchNumber} aria-hidden="true">01</span>Préparer une annonce</h3><small>Les emballages sont consommés à la préparation.</small></div>
      <div className={styles.form}>
        <div className={styles.formGrid}>{selectedStockId ? <div className={styles.field}><span>Le lot à conditionner</span><strong className={styles.selectedLot}>{stock ? `${stock.name} · ${number(stock.remainingUnits / 10)} g en vrac` : "Ce lot n’a plus assez de vrac disponible."}</strong><small className={styles.help}>{stock ? `Qualité actuelle : ${number(quality, 2)}/10 · Les grammes mis en rayon sont séparés de ce stock.` : "Reviens au choix des lots pour préparer une autre annonce."}</small></div> : <label>Le lot à conditionner<select value={stock?.id ?? ""} disabled={busy || !availableStocks.length} onChange={event => { setStockId(event.target.value); setPrice(""); }}><option value="" disabled>Aucun lot préparé disponible</option>{availableStocks.map(item => <option key={item.id} value={item.id}>{item.name} · {number(item.remainingUnits / 10)} g en vrac</option>)}</select><small>{stock ? `Qualité actuelle : ${number(quality, 2)}/10 · Les grammes mis en rayon sont séparés de ce stock.` : "Transforme une récolte ou prépare des fleurs entières au Marché."}</small></label>}<label>Format d’un paquet<select value={formatGrams} disabled={busy} onChange={event => { setFormatGrams(Number(event.target.value) as 5 | 10); setPrice(""); }}><option value={5}>5 g · petit format</option><option value={10}>10 g · grand format</option></select><small>Un emballage par paquet.</small></label></div>
        <fieldset className={styles.choices}><legend>Choisis ta présentation</legend><div className={styles.packagingGrid}>{KQ_ONLINE_PACKAGING.filter(item => item.formatGrams === formatGrams).map(item => {
          const quantity = online.packaging.find(owned => owned.code === item.code)?.quantity ?? 0;
          const locked = item.requiresBranding && !online.upgrades.branding;
          const buyValue = purchases[item.code] ?? "10";
          const buyCount = Number(buyValue);
          const validBuy = Number.isSafeInteger(buyCount) && buyCount > 0 && buyCount <= 1000;
          const buyCost = validBuy ? item.unitCostCents * buyCount : 0;
          return <article key={item.code} className={styles.package} data-selected={packaging.code === item.code}><label><span className={styles.packageArt}><Image src={item.image} alt="" fill sizes="(max-width: 600px) 115px, 280px" /></span><span className={styles.packageTitle}><input type="radio" name={`${id}-packaging`} value={item.family} checked={packaging.code === item.code} disabled={busy} onChange={() => setFamily(item.family)} />{item.name}</span><span className={styles.packageCopy}><strong>{formatKqCash(item.unitCostCents)} / emballage</strong><span>{item.family === "kraft" ? "Artisanal, simple et accessible." : item.family === "printed" ? "Une présentation aux couleurs de ta marque." : "Une présentation premium pour tes plus beaux lots."}</span><span>{item.protectionRate < 1 ? `Vieillissement ralenti de ${Math.round((1 - item.protectionRate) * 100)} % une fois conditionné.` : "Protection de base, adaptée aux ventes rapides."}</span><span>{item.satisfactionBonus ? `Présentation : jusqu’à +${item.satisfactionBonus} points de satisfaction.` : "La qualité et le prix font la différence."}</span></span></label><div className={styles.purchase}><small>{locked ? "Identité de marque requise dans « Ma boutique »" : `${quantity} emballage${quantity > 1 ? "s" : ""} disponible${quantity > 1 ? "s" : ""}`}</small><input aria-label={`Quantité de ${item.name} à acheter`} type="number" inputMode="numeric" min="1" max="1000" step="1" value={buyValue} disabled={busy || locked} onChange={event => setPurchases(previous => ({ ...previous, [item.code]: event.target.value }))} /><button type="button" className={styles.secondary} disabled={busy || locked || !validBuy || data.cashCents < buyCost} onClick={() => command("Acheter des emballages", `${buyCount} × ${item.name} (${formatGrams} g), soit ${formatKqCash(buyCost)}. Ils rejoignent ton stock d’emballages vides et seront consommés à la préparation des paquets.`, "buy-packaging", { code: item.code, quantity: buyCount }, buyCost)}>Acheter · {formatKqCash(buyCost)}</button></div></article>;
        })}</div></fieldset>
        <div className={styles.priceGrid}><label>Nombre de paquets<input type="number" inputMode="numeric" min="1" max={Math.max(1, maxPackets)} step="1" value={packets} disabled={busy} onChange={event => setPackets(event.target.value)} /><small>{validCount ? `${number(count * formatGrams)} g réservés à cette annonce.` : `${maxPackets} paquets possibles dans ce lot.`}</small></label><label>Ton prix TTC par paquet (€)<input type="number" inputMode="decimal" min="0.01" max="10000" step="0.01" value={price} placeholder={initialEstimate ? (initialEstimate.referencePacketPriceCents / 100).toFixed(2) : "0,00"} disabled={busy} onChange={event => setPrice(event.target.value)} /><small>{validPrice ? `${formatKqCash(Math.round(cents / formatGrams))}/g TTC.` : "Saisis un montant positif."}</small></label><div className={styles.field}><span>Repère pour ce produit</span><button type="button" className={styles.secondary} disabled={busy || !initialEstimate} onClick={() => setPrice(((initialEstimate?.referencePacketPriceCents ?? 0) / 100).toFixed(2))}>{initialEstimate ? formatKqCash(initialEstimate.referencePacketPriceCents) : "—"} / paquet</button><small className={styles.help}>Un repère de valeur, sans garantie de vente. Tu choisis le prix final.</small></div></div>
        {forecast ? <div className={styles.preview} aria-live="polite"><div className={styles.previewTop}><div><strong>{number(forecast.ordersPerDay)} commande{forecast.ordersPerDay > 1 ? "s" : ""}<small>par jour réel estimée{forecast.ordersPerDay > 1 ? "s" : ""} · {number(forecast.gramsPerDay)} g / jour réel</small></strong></div><Satisfaction label={forecast.satisfactionLabel} /></div><p>{forecast.priceLabel} {forecast.ordersPerDay > 0 && validCount ? `À ce rythme, environ ${number(count / forecast.ordersPerDay)} jours réels pour écouler ces paquets.` : "Un prix plus adapté ou davantage de visiteurs peut aider."}</p><dl className={styles.breakdown}><div><dt>Prix TTC d’un paquet</dt><dd>{formatKqCash(cents)}</dd></div><div><dt>TVA de jeu estimée</dt><dd>−{formatKqCash(Math.round(cents / 6))}</dd></div><div><dt>Frais de vente du site</dt><dd>−{formatKqCash(forecast.feeCents)}</dd></div><div><dt>Emballage consommé, déjà acheté</dt><dd>−{formatKqCash(forecast.packagingCostCents)}</dd></div><div><dt>Reste avant coût de culture</dt><dd>{formatKqCash(forecast.netBeforeProductionCents)}</dd></div></dl><p>Cette estimation n’est pas une marge : elle exclut la culture, les abonnements et les remboursements de dettes. Les annonces partagent les visiteurs ; qualité, confiance et demande évoluent avec le temps.</p></div> : null}
        {conservationRisk ? <div className={styles.notice} role="status"><Clock3 size={19} aria-hidden="true" /><p><strong>Cette quantité risque de rester trop longtemps en rayon.</strong> Avec cet emballage, la qualité passerait sous le seuil de vente de 5,8/10 après environ {realDuration(saleableHours)}. {Number.isFinite(expectedSaleHours) ? `Au rythme actuellement estimé, l’écoulement demanderait environ ${realDuration(expectedSaleHours)}.` : "Aucune commande n’est actuellement estimée à ce prix."} Prépare moins de paquets ou adapte ton prix. L’écoulement reste incertain ; les paquets continuent de vieillir même en pause.</p></div> : null}
        {reason ? <p className={styles.error} role="status">{reason}</p> : null}
        <button className={styles.primary} disabled={busy || Boolean(reason)} onClick={() => {
          if (!stock || reason) return;
          command("Préparer et mettre en vente", `${stock.name} : ${count} paquets de ${formatGrams} g dans ${packaging.name}. ${count * formatGrams} g quittent le vrac et ${count} emballages sont consommés. Prix libre : ${formatKqCash(cents)} TTC par paquet. Les ventes seront progressives, même hors connexion. Le retrait d’une annonce conserve les paquets préparés.`, "create-listing", { stockId: stock.id, formatGrams, packagingCode: packaging.code, packets: count, packetPriceCents: cents });
        }}><ShoppingBag size={18} aria-hidden="true" />Préparer {validCount ? `${count} paquet${count > 1 ? "s" : ""}` : "les paquets"} et mettre en vente<ArrowRight size={17} aria-hidden="true" /></button>
        <small className={styles.help}>Le conditionnement préserve la qualité actuelle ; il ne rajeunit pas le lot. Les paquets restent préparés si tu mets l’annonce en pause.</small>
      </div>
    </section>

  </section>;
}

type ListingFilter = "all" | "active" | "paused" | "closed" | "blocked" | "finished";
const listingFilters: Array<{ code: ListingFilter; name: string }> = [
  { code: "all", name: "Toutes" }, { code: "active", name: "En vente" },
  { code: "paused", name: "En pause" }, { code: "closed", name: "Retirées" },
  { code: "blocked", name: "À vérifier" }, { code: "finished", name: "Terminées" },
];
function listingGroup(listing: Listing, siteActive: boolean): Exclude<ListingFilter, "all"> {
  if (listing.remainingPackets === 0 || listing.status === "sold-out" || listing.status === "discarded") return "finished";
  if (listing.status === "closed") return "closed";
  if (listing.status === "paused") return "paused";
  if (listing.status === "quality-blocked" || listing.qualityScore < 5.8) return "blocked";
  return siteActive ? "active" : "paused";
}

export function KqOnlineDashboard({ data, busy, onAsk, onOpenBusiness, onOpenShop, onPrepareStock }: {
  data: KqCommerceSnapshot; now?: number; busy: boolean; onAsk: Ask;
  onOpenBusiness?: () => void; onOpenShop: () => void; onPrepareStock: () => void;
}) {
  const id = useId();
  const [filter, setFilter] = useState<ListingFilter>("all");
  const online = data.online;
  if (!online) return null;
  const groups = Object.fromEntries(listingFilters.map(item => [item.code, online.listings.filter(listing => item.code === "all" || listingGroup(listing, online.site.active) === item.code)])) as Record<ListingFilter, Listing[]>;
  const sumPackets = (listings: Listing[]) => listings.reduce((sum, listing) => sum + listing.remainingPackets, 0);
  const soldPackets = online.listings.reduce((sum, listing) => sum + listing.soldPackets, 0);
  const remainingPackets = sumPackets(online.listings);
  const remainingGrams = online.listings.reduce((sum, listing) => sum + listing.remainingPackets * listing.formatGrams, 0);
  const discardedPackets = online.listings.filter(listing => listing.status === "discarded").reduce((sum, listing) => sum + Math.max(0, listing.initialPackets - listing.soldPackets), 0);
  const displayedListings = groups[filter];
  return <section className={`${styles.store} ${styles.dashboard}`} aria-label="Mes ventes en ligne">
    <header className={`${styles.heading} ${styles.dashboardHeading}`}>
      <div><span className={styles.eyebrow}><ShoppingBag size={16} aria-hidden="true" /> Le registre de ta boutique</span><h2>Mes ventes en ligne</h2><p>Suis tes paquets et tes commandes. Ajuste les prix ou retire une annonce du rayon depuis cet espace.</p><span className={styles.status} data-state={online.site.active ? "active" : "paused"}>{online.site.active ? <><Check size={14} aria-hidden="true" />Boutique ouverte</> : online.site.createdAt ? "Boutique suspendue" : "Boutique à ouvrir"}</span></div>
      <div className={styles.dashboardArt} aria-hidden="true"><Image src="/placard/market-brand-studio-v2.webp" alt="" fill sizes="(max-width: 600px) 100vw, 320px" /></div>
    </header>

    <div className={styles.dashboardActions}><button className={styles.primary} disabled={busy} onClick={onPrepareStock}><ShoppingBag size={17} aria-hidden="true" />Préparer une nouvelle annonce<ArrowRight size={17} aria-hidden="true" /></button><Link className={styles.secondary} href="/arene/placard?view=market&section=management" prefetch={false} onClick={event => { if (onOpenBusiness) { event.preventDefault(); onOpenBusiness(); } }}><Settings2 size={16} aria-hidden="true" />Développer ma boutique</Link></div>
    {!online.site.active ? <div className={styles.notice}><Info size={19} aria-hidden="true" /><div><p>{online.site.createdAt ? "Les commandes sont suspendues. Tes annonces et leurs paquets restent ici ; réactive la boutique dans « Ma boutique » pour reprendre les ventes." : "Ouvre gratuitement ta boutique dans « Ma boutique », puis choisis un lot et le circuit de vente en ligne pour préparer ta première annonce."}</p>{!data.computerOwned ? <button className={styles.secondary} disabled={busy} onClick={onOpenShop}>Voir l’ordinateur · 450 €</button> : null}</div></div> : null}

    <section className={styles.packetLedger} aria-labelledby={`${id}-packets`}>
      <div className={styles.sectionHeading}><h3 id={`${id}-packets`}>Où en sont tes paquets ?</h3><small>Les stocks en vrac restent dans « Vendre mes récoltes ».</small></div>
      <dl className={styles.packetTotals} aria-label="Stock des paquets">
        <div><dt>Paquets vendus</dt><dd>{number(soldPackets, 0)}</dd><small>depuis l’ouverture</small></div>
        <div><dt>Paquets restants</dt><dd>{number(remainingPackets, 0)}</dd><small>{number(remainingGrams)} g conditionnés</small></div>
        <div><dt>En vente</dt><dd>{number(sumPackets(groups.active), 0)}</dd><small>{groups.active.length} annonce{groups.active.length > 1 ? "s" : ""} ouverte{groups.active.length > 1 ? "s" : ""}</small></div>
        <div><dt>En pause / suspendus</dt><dd>{number(sumPackets(groups.paused), 0)}</dd><small>conservés sans vente</small></div>
        <div><dt>Retirés du rayon</dt><dd>{number(sumPackets(groups.closed), 0)}</dd><small>reprise selon la qualité</small></div>
        <div><dt>Qualité insuffisante</dt><dd>{number(sumPackets(groups.blocked), 0)}</dd><small>vente bloquée</small></div>
      </dl>
      <p className={styles.ledgerNote}>Les paquets restants comprennent ceux en vente, en pause, retirés ou bloqués. Ils continuent de vieillir. Le retrait conserve le produit et l’emballage.{discardedPackets > 0 ? ` ${number(discardedPackets, 0)} paquet${discardedPackets > 1 ? "s ont" : " a"} été jeté${discardedPackets > 1 ? "s" : ""} définitivement.` : ""}</p>
    </section>

    <section className={styles.results} aria-labelledby={`${id}-results`}>
      <div className={styles.sectionHeading}><h3 id={`${id}-results`}>Depuis l’ouverture</h3><small>Ventes réellement enregistrées, même hors connexion.</small></div>
      <dl className={styles.stats} aria-label="Résultats depuis l’ouverture"><div><dt>Commandes</dt><dd>{number(online.stats.orders, 0)}</dd></div><div><dt>Ventes TTC</dt><dd>{formatKqCash(online.stats.revenueCents)}</dd></div><div><dt>Versé en trésorerie</dt><dd>{formatKqCash(online.stats.netRevenueCents)}</dd></div><div><dt>Quantité vendue</dt><dd>{number(online.stats.soldGrams)} <small>g</small></dd></div></dl>
      <p className={styles.ledgerNote}>Les versements sont ceux réellement crédités après les retenues de jeu et les éventuels remboursements automatiques. Ce n’est pas un bénéfice : la culture et les emballages ont leurs propres coûts. Frais de vente cumulés : {formatKqCash(online.stats.feesCents)}.</p>
      <dl className={styles.audienceStrip}><div><dt>Confiance commerciale</dt><dd>{number(online.confidence)} / 100</dd></div><div><dt>Audience de ta marque</dt><dd>{number(online.followers, 0)} abonnés</dd></div><div><dt>Visites cumulées</dt><dd>{number(online.stats.visitors, 0)}</dd></div></dl>
    </section>

    <section className={styles.preparation} aria-labelledby={`${id}-listings`}>
      <div className={styles.sectionHeading}><h3 id={`${id}-listings`}>Mes annonces</h3><small>{online.listings.length} annonce{online.listings.length > 1 ? "s" : ""} au total</small></div>
      <div className={styles.filters} role="group" aria-label="Filtrer les annonces">{listingFilters.map(item => <button key={item.code} type="button" aria-pressed={filter === item.code} onClick={() => setFilter(item.code)}>{item.name}<span aria-label={`${groups[item.code].length} annonces`}>{groups[item.code].length}</span></button>)}</div>
      <p className={styles.filterResult} role="status">{displayedListings.length} annonce{displayedListings.length > 1 ? "s" : ""} affichée{displayedListings.length > 1 ? "s" : ""}{filter !== "all" ? ` · ${listingFilters.find(item => item.code === filter)?.name}` : ""}.</p>
      {displayedListings.length ? <ul className={styles.listings}>{displayedListings.map(listing => <ListingCard key={listing.id} listing={listing} data={data} busy={busy} onAsk={onAsk} />)}</ul> : <div className={styles.empty}><PackageOpen size={34} aria-hidden="true" /><p>{online.listings.length ? "Aucune annonce dans ce filtre. Tes autres paquets restent accessibles dans « Toutes »." : "Ton rayon attend ses premiers paquets. Choisis un lot, puis le circuit de vente en ligne pour préparer ta première annonce."}</p>{online.listings.length ? <button className={styles.secondary} onClick={() => setFilter("all")}>Voir toutes les annonces</button> : null}</div>}
    </section>

    <details className={styles.history} open><summary>Dernières commandes automatiques</summary>{online.recentSales.length ? <><p className={styles.ledgerNote}>{online.recentSales.length} commande{online.recentSales.length > 1 ? "s" : ""} récente{online.recentSales.length > 1 ? "s" : ""} affichée{online.recentSales.length > 1 ? "s" : ""} sur {number(online.stats.orders, 0)} au total.</p><ul>{online.recentSales.map(sale => <li key={sale.id}><span><strong>{sale.name} · {sale.packets} × {sale.formatGrams} g</strong><small>{new Date(sale.soldAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {formatKqCash(sale.payoutCents)} TTC · satisfaction {number(sale.satisfaction)}/100</small><small>Frais du site : {formatKqCash(sale.feesCents)}. Emballages déjà payés à la préparation.</small></span><strong>{formatKqCash(sale.netPayoutCents)} versés</strong></li>)}</ul></> : <p className={styles.ledgerNote}>Aucune commande pour le moment. Les ventes enregistrées apparaîtront ici.</p>}</details>
  </section>;
}
