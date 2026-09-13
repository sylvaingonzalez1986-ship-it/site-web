"use client";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Coins, FlaskConical, Frown, Leaf, LoaderCircle, Meh, Minus, PackageOpen, ShoppingBag, Smile, Sparkles, Star, Users, X } from "lucide-react";
import { KQ_CHANNELS, KQ_COMMERCE_EVENTS, KQ_COMPUTER_PRICE_CENTS, KQ_INTERNET_PRICE_CENTS, KQ_SALES_CHANNELS, KQ_SHOP_QUALITY_BANDS, getKqShopNetworkBonus, getKqShopQualityBand, getKqCommerceMinimumQuality, quoteKqCommerce,
  type KqCommerceOffer, type KqCommerceReceipt, type KqCommerceSnapshot, type KqCommerceStock, type KqOnlinePrice, type KqSalesChannel } from "@/lib/kanab-quest-commerce";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { KQ_MARKET_ROUTES, getKqMarketReputationRule, type KqMarketRouteCode } from "@/lib/kanab-quest-market";
import { KqCommerceOverview } from "./KqCommerceOverview";
import { createClientRequestKey } from "@/lib/client-request-key";
import styles from "./KqCommerceDesk.module.css";
const grams = (units: number) => `${(units / 10).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} g`;
const productName = (route: string) => route === "raw" ? "Fleurs entières" : KQ_MARKET_ROUTES.find(r => r.code === route)?.name ?? route;
const qualityScore = (score: number) => `${score.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}/10`;
function LotQuality({ stock }: { stock: KqCommerceStock }) {
  const rule = getKqMarketReputationRule(stock.route);
  return <span className={styles.qualityBadge} data-tone={stock.juryScore >= rule.gainFrom ? "good" : stock.juryScore >= rule.neutralFrom ? "neutral" : "warning"}><Star size={18} aria-hidden="true" /><span>Qualité du lot <strong>{qualityScore(stock.juryScore)}</strong></span></span>;
}
function ChannelQuality({ stock, channel }: { stock: KqCommerceStock; channel: KqSalesChannel }) {
  const minimum = getKqCommerceMinimumQuality(stock.route, channel);
  const accepted = minimum === null || (stock.route !== "biomass" && stock.juryScore >= minimum);
  const risky = accepted && (channel === "online" ? stock.juryScore < getKqMarketReputationRule(stock.route).neutralFrom : channel === "cbd-shop" && getKqShopQualityBand(stock.route, stock.juryScore).churnWeight > 0);
  return <span className={styles.qualityFit} data-tone={!accepted || risky ? "warning" : "good"}>
    {accepted && !risky ? <Check size={15} aria-hidden="true" /> : <Minus size={15} aria-hidden="true" />}
    <span>{minimum === null ? "Toute qualité acceptée" : stock.route === "biomass" ? "Biomasse non acceptée" : `${!accepted ? "Qualité refusée" : risky ? channel === "cbd-shop" ? "Partenaires à risque" : "Clients à risque" : "Qualité suffisante"} · min. ${qualityScore(minimum)}`}</span>
  </span>;
}
async function request<T>(body?: Record<string, unknown>, shopOnly = false): Promise<T> {
  const response = await fetch(`/api/arena/placard/commerce${shopOnly ? "?shop=1" : ""}`, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Le comptoir ne répond pas. Réessaie.");
  return payload as T;
}
type PreparedOffer = { quoteId: string; offer: KqCommerceOffer; electricityPaidCents: number; netPayoutCents: number; expiresAt: string };
type Confirmation = { title: string; description: string; body: Record<string, unknown>; offer?: PreparedOffer; cost?: number };
type SaleResult = KqCommerceReceipt & { feedback?: { satisfaction: KqCommerceOffer["satisfaction"]; clientsDelta: number } };
function CustomerFeedback({ receipt }: { receipt: SaleResult }) {
  if (!receipt.feedback) return null;
  const { satisfaction, clientsDelta } = receipt.feedback;
  const direct = receipt.channel === "online";
  const shops = receipt.channel === "cbd-shop";
  const partnersDelta = receipt.shopPartnersDelta ?? 0;
  const Icon = satisfaction === "satisfied" ? Smile : satisfaction === "disappointed" ? Frown : satisfaction === "neutral" ? Meh : PackageOpen;
  const label = satisfaction === "not-applicable" ? "Reprise sans évaluation qualité"
    : direct ? satisfaction === "satisfied" ? "Clients satisfaits" : satisfaction === "disappointed" ? "Clients déçus" : "Clients mitigés"
    : satisfaction === "satisfied" ? "Boutiques satisfaites" : satisfaction === "disappointed" ? "Boutiques déçues" : "Boutiques mitigées";
  const change = shops ? partnersDelta > 0 ? `+${partnersDelta} boutique partenaire` : partnersDelta < 0 ? `${Math.abs(partnersDelta)} boutique${partnersDelta < -1 ? "s" : ""} perdue${partnersDelta < -1 ? "s" : ""}` : "Réseau de boutiques inchangé" : !direct ? "Clientèle directe inchangée" : clientsDelta > 0 ? `+${clientsDelta} client${clientsDelta > 1 ? "s" : ""} fidèle${clientsDelta > 1 ? "s" : ""}`
    : clientsDelta < 0 ? `${Math.abs(clientsDelta)} client${clientsDelta < -1 ? "s" : ""} perdu${clientsDelta < -1 ? "s" : ""}` : satisfaction === "disappointed" ? "Aucun client perdu cette fois" : "Aucun nouveau client cette fois";
  return <section className={styles.customerFeedback} aria-label="Bilan clientèle" data-satisfaction={satisfaction}>
    <div><Icon size={28} aria-hidden="true" /><span><small>Satisfaction</small><strong>{label}</strong></span></div>
    <div><Users size={25} aria-hidden="true" /><span><strong>{change}</strong><small>{direct ? `${receipt.clientsAfter} clients fidèles au total` : shops ? `${receipt.shopPartnersAfter ?? 0} boutiques partenaires au total · ${receipt.shopPricePercent ?? 0} % de reprise sur cette vente` : "La reprise grossiste ne développe pas ton réseau."}</small></span></div>
    {shops && partnersDelta !== 0 ? <small>Ton nouveau réseau ajustera les prix et les volumes au prochain cycle.</small> : null}
  </section>;
}
function Confirm({ confirmation, busy, error, onClose, onConfirm }: { confirmation: Confirmation; busy: boolean; error: string; onClose: () => void; onConfirm: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close(); }, []);
  return <dialog ref={dialog} className={styles.confirm} onCancel={event => { if (busy) event.preventDefault(); else onClose(); }} aria-labelledby="commerce-confirm-title">
    <button className={styles.close} onClick={onClose} disabled={busy} aria-label="Fermer la confirmation"><X /></button>
    <small>Le Placard · Bon de commande</small><h2 id="commerce-confirm-title">{confirmation.title}</h2><p>{confirmation.description}</p>
    {confirmation.offer ? <dl><div><dt>Quantité vendue</dt><dd>{grams(confirmation.offer.offer.units)}</dd></div><div><dt>Recette</dt><dd>{formatKqCash(confirmation.offer.offer.payoutCents)}</dd></div><div><dt>Électricité réglée</dt><dd>{formatKqCash(confirmation.offer.electricityPaidCents)}</dd></div><div><dt>Versé au portefeuille</dt><dd>{formatKqCash(confirmation.offer.netPayoutCents)}</dd></div></dl> : <strong className={styles.total}>{formatKqCash(confirmation.cost ?? 0)}</strong>}
    {confirmation.offer ? <p>{confirmation.offer.offer.message}</p> : null}
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    <footer><button onClick={onClose} disabled={busy}>Revenir</button><button className={styles.primary} disabled={busy} onClick={onConfirm}>{busy ? <LoaderCircle className={styles.spin} /> : <Check />} {busy ? "Validation…" : "Confirmer"}</button></footer>
  </dialog>;
}

export function KqCommerceComputer() {
  const [data, setData] = useState<KqCommerceSnapshot | null>(null);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [confirm, setConfirm] = useState(false);
  const key = useRef("");
  const load = useCallback(() => { void request<KqCommerceSnapshot>(undefined, true).then(setData).catch(e => setError(e.message)); }, []);
  useEffect(() => { load(); }, [load]);
  async function buy() {
    setBusy(true); setError("");
    try { await request({ action: "buy-computer", requestKey: key.current }); setConfirm(false); load(); window.dispatchEvent(new Event("kq:equipment-updated")); }
    catch (e) { setError(e instanceof Error ? e.message : "Achat indisponible."); } finally { setBusy(false); }
  }
  return <section className={styles.computer} aria-label="Matériel de vente en ligne">
    <Image src={KQ_CHANNELS.online.image} width={1200} height={800} sizes="(max-width: 700px) 100vw, 320px" alt="Ordinateur et routeur installés sur le bureau de préparation des commandes" />
    <div><small>La boutique · Développer ton commerce</small><h3>L’ordinateur du Placard</h3><p>Ouvre ta vente en ligne. Achat permanent : <strong>{formatKqCash(KQ_COMPUTER_PRICE_CENTS)}</strong>. Internet : 15 € par culture terminée, activable au marché.</p>
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      {data?.computerOwned ? <strong><Check size={18} /> Ordinateur déjà acheté</strong> : confirm ? <div className={styles.actions}><span>Confirmer l’achat à 450 € ?</span><button disabled={busy} onClick={() => void buy()} className={styles.primary}>{busy ? "Achat…" : "Confirmer l’achat"}</button><button disabled={busy} onClick={() => setConfirm(false)}>Annuler</button></div>
        : <button className={styles.primary} disabled={!data || data.cashCents < KQ_COMPUTER_PRICE_CENTS} onClick={() => { key.current = createClientRequestKey(); setConfirm(true); }}>{!data ? "Chargement…" : data.cashCents < KQ_COMPUTER_PRICE_CENTS ? "Trésorerie insuffisante · 450 €" : "Acheter l’ordinateur · 450 €"}</button>}
    </div>
  </section>;
}

const channelTradeoffs: Record<KqSalesChannel, { advantage: string; drawback: string }> = {
  online: { advantage: "Le meilleur prix, porté par ta réputation.", drawback: "Commandes limitées ; une mauvaise qualité fait perdre des clients." },
  "cbd-shop": { advantage: "De grosses quantités vendues immédiatement.", drawback: "La qualité et la fidélité des boutiques font varier la reprise." },
  wholesale: { advantage: "Tout le lot repris, quelle que soit sa qualité.", drawback: "Prix très bas ; aucun gain de réputation." },
};

export function KqCommerceDesk({ onOpenShop }: { onOpenShop: (equipmentCode?: string) => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [data, setData] = useState<KqCommerceSnapshot | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [channel, setChannel] = useState<KqSalesChannel | null>(null); const [policy, setPolicy] = useState<KqOnlinePrice>("advised");
  const [selectedId, setSelectedId] = useState(""); const [quantity, setQuantity] = useState(""); const [route, setRoute] = useState<KqMarketRouteCode>("raw");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null); const [receipt, setReceipt] = useState<SaleResult | null>(null);
  const load = useCallback(async () => { try { const result = await request<KqCommerceSnapshot>(); setData(result); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Marché indisponible."); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); const handler = () => { void load(); }; window.addEventListener("kq:equipment-updated", handler); return () => window.removeEventListener("kq:equipment-updated", handler); }, [load]);
  const stock = data?.stocks.find(s => s.id === selectedId);
  const raw = data?.rawLots.find(l => `raw:${l.flowerId}` === selectedId);
  const saleComplete = receipt?.action === "sell";
  const screen = saleComplete ? "receipt" : stock ? channel ? "offer" : "distribution" : raw ? "preparation" : "lots";
  useEffect(() => { if (selectedId || saleComplete) heading.current?.focus({ preventScroll: false }); }, [screen, selectedId, saleComplete]);
  const activeProduct = raw?.options.find(q => q.route === route) ?? raw?.options.find(q => q.route === "raw");
  const requestedUnits = quantity === "" ? undefined : Math.round(Number(quantity.replace(",", ".")) * 10);
  const offer = data && stock && channel ? quoteKqCommerce(data, stock, channel, policy, requestedUnits) : null;
  const inputInvalid = quantity !== "" && (!Number.isFinite(requestedUnits) || requestedUnits! <= 0 || requestedUnits! > (offer?.maxUnits ?? 0));
  const cost = activeProduct?.market?.processingCostCents ?? 0;
  const canPrepare = activeProduct && (activeProduct.route === "raw" || activeProduct.route === "biomass" || activeProduct.available);
  function choose(id: string) { setSelectedId(id); setQuantity(""); setRoute("raw"); setChannel(null); setPolicy("advised"); setReceipt(null); setError(""); }
  function chooseChannel(code: KqSalesChannel | null) { setChannel(code); setQuantity(""); setPolicy("advised"); setError(""); }
  function ask(title: string, description: string, body: Record<string, unknown>, cost?: number) {
    setError(""); setConfirmation({ title, description, body: { ...body, requestKey: createClientRequestKey() }, cost });
  }
  function internet(enabled: boolean) {
    ask(enabled ? "Activer Internet" : "Couper la reconduction Internet", enabled
      ? data?.campaign?.internetPaid ? "Ce cycle est déjà payé. Internet sera reconduit à 15 € à chaque prochaine culture terminée si ta trésorerie le permet." : "15 € ouvrent les commandes de ce cycle. Reconduction à chaque prochaine culture terminée, désactivable à tout moment."
      : "L’accès déjà payé reste ouvert jusqu’au prochain cycle. Les cycles suivants ne seront pas facturés.",
    { action: "internet", enabled }, enabled && !data?.campaign?.internetPaid ? KQ_INTERNET_PRICE_CENTS : 0);
  }
  async function examineSale() {
    if (!stock || !offer || !channel || offer.reason || inputInvalid) return;
    setBusy(true); setError("");
    try {
      const prepared = await request<PreparedOffer>({ action: "quote", stockId: stock.id, channel, policy, units: offer.units });
      if (prepared.offer.reason || prepared.offer.units <= 0) throw new Error(prepared.offer.reason ?? "Aucune commande disponible.");
      setConfirmation({ title: `Vendre · ${KQ_CHANNELS[channel].name}`, description: `${stock.name} · ${productName(stock.route)} · Qualité ${qualityScore(stock.juryScore)}. ${grams(stock.remainingUnits - prepared.offer.units)} resteront en stock.`, offer: prepared,
        body: { action: "sell", quoteId: prepared.quoteId, expectedPayoutCents: prepared.offer.payoutCents, requestKey: createClientRequestKey() } });
    } catch (e) { setError(e instanceof Error ? e.message : "Offre indisponible."); } finally { setBusy(false); }
  }
  async function commit() {
    if (!confirmation || busy) return;
    setBusy(true); setError("");
    try {
      const result = await request<KqCommerceReceipt>(confirmation.body);
      // Use the server quote's starting clientele and the committed receipt's final value.
      // Keeping the quote through retries avoids attributing a later sale's gains to this one.
      const quoted = confirmation.offer?.offer;
      const satisfaction = result.satisfaction ?? quoted?.satisfaction;
      const clientsBefore = result.clientsBefore ?? quoted?.clientsBefore;
      const feedback = result.action === "sell" && satisfaction && Number.isFinite(clientsBefore) && Number.isFinite(result.clientsAfter)
        ? { satisfaction, clientsDelta: result.clientsAfter! - clientsBefore! } : undefined;
      setConfirmation(null); setReceipt({ ...result, feedback }); setQuantity("");
      if (result.action === "prepare" && result.stockId) { setSelectedId(result.stockId); setChannel(null); }
      await load(); window.dispatchEvent(new Event("kq:equipment-updated"));
    } catch (e) { setError(e instanceof Error ? e.message : "Opération indisponible."); } finally { setBusy(false); }
  }
  const title = saleComplete ? "Vente terminée" : stock ? channel ? KQ_CHANNELS[channel].name : "Choisis ton circuit" : raw ? "Transforme ton lot" : "Choisis ton lot";
  return <main className={styles.page} data-screen={screen}>
    <div className={styles.scenery} aria-hidden="true"><Image key={channel ?? "workshop"} src={channel ? KQ_CHANNELS[channel].image : "/placard/market-workshop-v1.webp"} alt="" fill sizes="100vw" priority /></div>
    <header className={styles.header}><div><small><FlaskConical size={15} aria-hidden="true" /> L’atelier du Placard</small><h1>Le Marché</h1><p>Transforme ton lot, puis choisis où le vendre.</p></div><span className={styles.wallet}><Coins size={22} aria-hidden="true" /><span><small>Trésorerie</small><strong>{data ? formatKqCash(data.cashCents) : "…"}</strong></span></span></header>
    <ol className={styles.steps} aria-label="Étapes de vente"><li aria-current={!stock && !saleComplete ? "step" : undefined}><span>{stock || saleComplete ? <Check size={16} /> : "1"}</span> Transformer le lot</li><li aria-current={stock || saleComplete ? "step" : undefined}><span>2</span> Choisir un circuit</li></ol>
    {error && !confirmation ? <p className={styles.error} role="alert">{error} <button onClick={() => void load()}>Actualiser</button></p> : null}
    {loading ? <p className={styles.loading}><LoaderCircle className={styles.spin} /> Ouverture du comptoir…</p> : data ? <section key={screen} className={styles.flow} aria-labelledby="commerce-step-title">
      {!saleComplete && (raw || stock) ? <button className={styles.back} onClick={() => stock && channel ? chooseChannel(null) : choose("")}>← {stock && channel ? "Comparer les offres" : "Changer de lot"}</button> : null}
      <h2 id="commerce-step-title" ref={heading} tabIndex={-1}>{title}</h2>
      {saleComplete ? <div className={styles.saleDone} role="status"><span className={styles.successEmblem}><Coins size={42} aria-hidden="true" /><Sparkles size={22} aria-hidden="true" /></span><small>Dans ta trésorerie</small><strong>{formatKqCash(receipt.netPayoutCents ?? 0)} versés</strong><p>{grams(receipt.units ?? 0)} vendus · {grams(receipt.remainingUnits ?? 0)} restants.</p>
        <CustomerFeedback receipt={receipt} />
        <p>{(receipt.remainingUnits ?? 0) > 0 ? "Le reste est conservé. Tu peux le proposer à un autre circuit." : "Tout ce produit a été vendu."}</p>
        <button className={styles.primary} onClick={() => choose((receipt.remainingUnits ?? 0) > 0 && stock ? stock.id : "")}>{(receipt.remainingUnits ?? 0) > 0 && stock ? "Vendre le reste" : "Retour aux lots"} <ArrowRight size={18} /></button>
      </div> : raw && activeProduct ? <div className={styles.preparation}>
        <div className={styles.workshopArt}><Image src="/placard/market-workshop-v1.webp" width={1536} height={1024} alt="Presse, tamis et laveuse de l’atelier du Placard" sizes="(max-width: 700px) 100vw, 450px" /><span className={styles.artLabel}><FlaskConical size={16} aria-hidden="true" /> Atelier de transformation</span></div>
        <div><p className={styles.lotSummary}>{raw.varietyName} · {raw.harvestGrams.toLocaleString("fr-FR")} g · {raw.juryScore.toFixed(1)}/10</p>
          <label className={styles.field}>Que veux-tu obtenir ?<select value={activeProduct.route} onChange={e => setRoute(e.target.value as KqMarketRouteCode)}>{raw.options.map(q => <option key={q.route} value={q.route}>{q.route === "raw" ? "Fleurs entières (sans transformation)" : q.name}{q.available || q.route === "raw" || q.route === "biomass" ? "" : " · verrouillé"}</option>)}</select></label>
          <p>{activeProduct.route === "raw" ? "Garde tes fleurs entières : aucune transformation nécessaire." : activeProduct.description}</p>
          <div className={styles.figures}><span>Produit obtenu<strong>{grams(Math.round(activeProduct.productGrams * 10))}</strong></span><span>Coût<strong>{formatKqCash(cost)}</strong></span></div>
          {activeProduct.remainderGrams > 0 ? <p>{activeProduct.remainderGrams.toLocaleString("fr-FR")} g de fleurs non traitées seront conservés séparément.</p> : null}
          {!canPrepare ? <p className={styles.error}>{activeProduct.blockedReason}</p> : null}
          <button className={styles.primary} disabled={busy || !canPrepare || cost > data.cashCents} onClick={() => ask("Préparer ce lot", `${raw.varietyName} : ${activeProduct.name}. Une fois préparé, tu choisiras une offre de distribution.`, { action: "prepare", flowerId: raw.flowerId, route: activeProduct.route, expectedCostCents: cost }, cost)}>{cost > data.cashCents ? "Trésorerie insuffisante" : activeProduct.route === "raw" ? "Préparer les fleurs et continuer" : "Transformer et continuer"} <ArrowRight size={18} /></button>
        </div>
      </div> : stock && !channel ? <>
        <p className={styles.lotSummary}>{stock.name} · {productName(stock.route)} · <strong>{grams(stock.remainingUnits)} prêts à vendre</strong></p>
        <LotQuality stock={stock} />
        <p>Compare les offres pour ce lot. Les invendus restent en stock.</p>
        {data.campaign && data.campaign.event !== "normal" ? <p className={styles.event}>{KQ_COMMERCE_EVENTS[data.campaign.event]}</p> : null}
        <div className={styles.offers} aria-label="Circuits de vente">{KQ_SALES_CHANNELS.map(code => {
          const proposal = quoteKqCommerce(data, stock, code);
          return <button key={code} className={styles.offerCard} data-unavailable={proposal.reason ? "true" : undefined} onClick={() => chooseChannel(code)} aria-label={`Voir l’offre ${KQ_CHANNELS[code].name}`}>
            <div className={styles.offerArt}><Image src={KQ_CHANNELS[code].image} alt="" fill sizes="(max-width: 700px) 100vw, 33vw" />
              <span className={styles.channelTag}>{code === "online" ? "Prix fort" : code === "cbd-shop" ? "Gros volumes" : "Reprise totale"}</span>
              <div className={styles.offerCaption}><span>{KQ_CHANNELS[code].name}</span><strong className={styles.offerAmount}>{proposal.reason ? "Indisponible" : formatKqCash(proposal.payoutCents)}</strong>
                {!proposal.reason ? <small>{grams(proposal.units)} repris · {formatKqCash(Math.round(proposal.unitCents))}/g</small> : null}
              </div>
            </div>
            <div className={styles.offerCopy}>
              <ChannelQuality stock={stock} channel={code} />
              {code === "cbd-shop" ? <small>{proposal.shopPricePercent} % de reprise · {data.shopPartners ?? 0} boutiques partenaires</small> : null}
              {proposal.reason ? <span className={styles.unavailableReason}>{proposal.reason}</span> : null}
              <span className={styles.tradeoff}><Check size={16} aria-hidden="true" /><span><b>Avantage</b> {channelTradeoffs[code].advantage}</span></span><span className={styles.tradeoff}><Minus size={16} aria-hidden="true" /><span><b>À prévoir</b> {channelTradeoffs[code].drawback}</span></span>
              <span className={styles.offerLink}>{proposal.reason ? "Voir les conditions" : "Choisir cette offre"} <ArrowRight size={16} /></span>
            </div>
          </button>;
        })}</div><small className={styles.estimateNote}>Montants avant règlement éventuel de l’électricité. Le montant net sera confirmé avant la vente.</small>
      </> : stock && offer && channel ? <div className={styles.selectedOffer}>
        <div className={styles.selectedArt}><Image src={KQ_CHANNELS[channel].image} alt="" width={1200} height={800} sizes="(max-width: 700px) 100vw, 400px" /><span className={styles.artLabel}><ShoppingBag size={16} aria-hidden="true" /> {KQ_CHANNELS[channel].name}</span></div>
        <div><p className={styles.lotSummary}>{stock.name} · {productName(stock.route)} · {grams(stock.remainingUnits)} en stock</p>
          <LotQuality stock={stock} /><ChannelQuality stock={stock} channel={channel} />
          {channel === "cbd-shop" ? <details className={styles.adjustments}><summary>Barème des boutiques · {offer.shopPricePercent} % de reprise</summary>
            <p>{data.shopPartners ?? 0} boutiques partenaires · Bonus du cycle : +{getKqShopNetworkBonus(data.campaign?.shopPartnersStart ?? data.shopPartners ?? 0)} points sur la reprise.</p>
            <ul className={styles.shopScale}>{KQ_SHOP_QUALITY_BANDS.map((band, index) => <li key={band.label}><strong>{qualityScore(stock.route === "raw" ? band.flowerMinimum : band.extractMinimum)}{index === KQ_SHOP_QUALITY_BANDS.length - 1 ? " et plus" : ` à moins de ${qualityScore(stock.route === "raw" ? KQ_SHOP_QUALITY_BANDS[index + 1].flowerMinimum : KQ_SHOP_QUALITY_BANDS[index + 1].extractMinimum)}`} · {band.pricePercent} %</strong><span>{band.recruitmentWeight ? `1 partenaire par ${band.recruitmentWeight === 4 ? "150" : "200"} g équivalents livrés` : band.churnWeight ? "1 partenaire perdu par 100 g équivalents livrés" : "Réseau stable"}</span></li>)}</ul>
            <p>20 partenaires maximum. Au plus 1 nouveau par cycle ; départs limités à 25 % du réseau de début de cycle, arrondis au supérieur. Les petites livraisons s’additionnent. Pour le hash et le rosin, le volume est ramené à la quantité de fleurs utilisée.</p>
            <p>Bonus réseau : +1 point dès 1 boutique, +2 dès 4, +3 dès 8, +4 dès 12. Sans partenaire, tu peux toujours prospecter. Les prix et volumes du réseau sont fixés pour le cycle.</p>
          </details> : null}
          {offer.reason ? <><p className={styles.error}>{offer.reason}</p>
            {channel === "online" && !data.computerOwned ? <button className={styles.primary} onClick={() => onOpenShop()}>Trouver l’ordinateur en boutique · 450 €</button>
              : channel === "online" && data.campaign && !data.campaign.internetPaid ? <button className={styles.primary} disabled={busy || data.cashCents < KQ_INTERNET_PRICE_CENTS} onClick={() => internet(true)}>Activer Internet · 15 €</button> : null}
            {channel === "online" ? <p>Ordinateur permanent : 450 €. Internet : 15 € par culture terminée, reconduction désactivable.</p> : null}
          </> : <>
            <div className={styles.figures}><span>Quantité reprise<strong>{grams(offer.units)}</strong></span><span>Offre proposée<strong>{formatKqCash(offer.payoutCents)}</strong></span></div>
            <p>{offer.message}</p><p>{grams(stock.remainingUnits - offer.units)} resteront en stock.</p>
            <details className={styles.adjustments}><summary>Ajuster {channel === "online" ? "le prix ou la quantité" : "la quantité"}</summary>
              {channel === "online" ? <fieldset className={styles.prices}><legend>Ton prix</legend>{(["discovery", "advised", "premium"] as const).map(value => <button key={value} aria-pressed={policy === value} onClick={() => { setPolicy(value); setQuantity(""); }}>{value === "discovery" ? "Découverte · −10 %" : value === "premium" ? "Ambitieux · +22 %" : "Prix conseillé"}</button>)}</fieldset> : null}
              <label className={styles.field}>Quantité à vendre (g)<input type="number" min="0.1" step="0.1" max={offer.maxUnits / 10} placeholder={String(offer.maxUnits / 10)} value={quantity} onChange={e => setQuantity(e.target.value)} /></label>
              <p>{inputInvalid ? `Choisis une quantité entre 0,1 et ${grams(offer.maxUnits)}.` : `Prix : ${formatKqCash(Math.round(offer.unitCents))}/g · Commandes : ${grams(offer.maxUnits)} maximum.`}</p>
            </details>
            <button disabled={busy || inputInvalid || offer.units <= 0} className={styles.primary} onClick={() => void examineSale()}>{busy ? "Calcul…" : "Vendre ce lot"} <ArrowRight size={18} /></button>
            <small className={styles.estimateNote}>Le montant net après électricité sera confirmé à l’étape suivante.</small>
          </>}
        </div>
      </div> : data.rawLots.length || data.stocks.length ? <>
        <p>Une récolte à transformer, ou un produit déjà prêt à distribuer.</p>
        <div className={styles.inventory}>
        <div className={styles.inventoryArt} aria-hidden="true"><Image src="/placard/market-workshop-v1.webp" alt="" width={1536} height={1024} sizes="(max-width: 700px) 100vw, 540px" /><span><PackageOpen size={18} /> Ta réserve</span></div>
        <div className={styles.lotList} aria-label="Tes lots">
          {data.rawLots.map(item => <button key={item.flowerId} onClick={() => choose(`raw:${item.flowerId}`)}><span className={styles.lotIcon}><Leaf size={24} aria-hidden="true" /></span><span className={styles.lotText}><strong>{item.varietyName}</strong><small>{item.harvestGrams.toLocaleString("fr-FR")} g · {item.juryScore.toFixed(1)}/10</small></span><span>Transformer <ArrowRight size={18} /></span></button>)}
          {data.stocks.map(item => <button key={item.id} onClick={() => choose(item.id)}><span className={styles.lotIcon}><PackageOpen size={24} aria-hidden="true" /></span><span className={styles.lotText}><strong>{item.name}</strong><small>{productName(item.route)} · {grams(item.remainingUnits)} · Qualité {qualityScore(item.juryScore)} · Déjà préparé</small></span><span>Distribuer <ArrowRight size={18} /></span></button>)}
        </div></div>
      </> : <div className={styles.empty}><Image src="/placard/market-workshop-v1.webp" width={1536} height={1024} alt="L’atelier attend la prochaine récolte" sizes="(max-width: 700px) 100vw, 700px" /><div><strong>Ta réserve est vide</strong><p>Termine une culture et son duel pour récupérer un nouveau lot.</p></div></div>}
    </section> : null}
    {data ? <KqCommerceOverview data={data} busy={busy} onOpenShop={() => onOpenShop()} onInternetChange={internet} /> : null}
    {confirmation ? <Confirm confirmation={confirmation} busy={busy} error={error} onClose={() => { if (!busy) { setConfirmation(null); setError(""); } }} onConfirm={() => void commit()} /> : null}
  </main>;
}
