"use client";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { ArrowRight, Check, Clock3, Coins, FlaskConical, Frown, Leaf, LoaderCircle, Meh, Minus, PackageOpen, ShoppingBag, Smile, Sparkles, Star, Users, X } from "lucide-react";
import { KQ_CHANNELS, KQ_COMMERCE_EVENTS, KQ_COMPUTER_PRICE_CENTS, KQ_SALES_CHANNELS, KQ_SHOP_QUALITY_BANDS, getKqShopNetworkBonus, getKqShopQualityBand, getKqCommerceMinimumQuality, getKqCommerceReplenishment, getKqCommerceStockQuality, isKqCommerceStockMature, quoteKqCommerce,
  type KqCommerceOffer, type KqCommerceReceipt, type KqCommerceSnapshot, type KqCommerceStock, type KqOnlinePrice, type KqSalesChannel } from "@/lib/kanab-quest-commerce";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { KQ_MARKET_ROUTES, getKqMarketReputationRule, type KqMarketRouteCode } from "@/lib/kanab-quest-market";
import { KqCommerceOverview } from "./KqCommerceOverview";
import { KqCustomerDemandDashboard } from "./KqCustomerDemandDashboard";
import { KqOnlineDashboard, KqOnlineStore } from "./KqOnlineStore";
import { KqStorageStatus } from "./KqStorageStatus";
import { createClientRequestKey } from "@/lib/client-request-key";
import styles from "./KqCommerceDesk.module.css";
import { useKqTutorialApi, type KqTutorialApi } from "./KqTutorialApiContext";
const grams = (units: number) => `${(units / 10).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} g`;
const productName = (route: string) => route === "raw" ? "Fleurs entières" : KQ_MARKET_ROUTES.find(r => r.code === route)?.name ?? route;
const qualityScore = (score: number) => `${score.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}/10`;
function DemandStatus({ data, channel, offer, now, compact = false }: { data: KqCommerceSnapshot; channel: KqSalesChannel; offer: KqCommerceOffer; now?: number; compact?: boolean }) {
  if (channel === "wholesale" && data.wholesale) return <span className={styles.demandStatus}><span><Clock3 size={16} aria-hidden="true" /><strong>{grams(offer.maxUnits)} achetables maintenant</strong></span><small>Quota commun : {grams(data.wholesale.remainingEquivalentUnits)} équivalent fleurs disponibles sur 24 h.</small></span>;
  const refill = getKqCommerceReplenishment(data, channel, now);
  if (!refill) return channel === "wholesale" ? <span className={styles.demandStatus}><Check size={16} /> {grams(offer.maxUnits)} achetables maintenant</span> : null;
  const minutes = Math.ceil(refill.remainingMs / 60000);
  const wait = minutes >= 60 ? `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}` : `${minutes} min`;
  return <span className={styles.demandStatus}>
    <span><Clock3 size={16} aria-hidden="true" /><strong>{grams(offer.maxUnits)} achetables maintenant</strong></span>
    {!compact ? <progress max={1} value={refill.availableFraction} aria-label={`Commandes disponibles : ${KQ_CHANNELS[channel].name}`} /> : null}
    <small>{minutes ? `Commandes au maximum dans ${wait}` : "Commandes au maximum"} · renouvellement en {refill.durationMs / 3600000} h</small>
  </span>;
}
function LotQuality({ stock }: { stock: KqCommerceStock }) {
  const rule = getKqMarketReputationRule(stock.route);
  const quality = getKqCommerceStockQuality(stock);
  return <span className={styles.qualityBadge} data-tone={quality >= rule.gainFrom ? "good" : quality >= rule.neutralFrom ? "neutral" : "warning"}><Star size={18} aria-hidden="true" /><span>Qualité commerciale <strong>{qualityScore(quality)}</strong>{stock.storage ? <small> · Jury : {qualityScore(stock.juryScore)}</small> : null}</span></span>;
}
function ChannelQuality({ stock, channel, now }: { stock: KqCommerceStock; channel: KqSalesChannel; now?: number }) {
  if (stock.processingReadyAt && (now === undefined || Date.parse(stock.processingReadyAt) > now)) return <span className={styles.qualityFit} data-tone="warning"><Clock3 size={15} aria-hidden="true" /><span>Transformation en cours · disponible le {new Date(stock.processingReadyAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span></span>;
  if (channel !== "wholesale" && !isKqCommerceStockMature(stock, now)) return <span className={styles.qualityFit} data-tone="warning"><Clock3 size={15} aria-hidden="true" /><span>Curing en cours · circuit disponible à maturité</span></span>;
  const minimum = getKqCommerceMinimumQuality(stock.route, channel);
  const quality = getKqCommerceStockQuality(stock);
  const accepted = minimum === null || (stock.route !== "biomass" && quality >= minimum);
  const risky = accepted && channel === "cbd-shop" && getKqShopQualityBand(stock.route, quality).churnWeight > 0;
  return <span className={styles.qualityFit} data-tone={!accepted || risky ? "warning" : "good"}>
    {accepted && !risky ? <Check size={15} aria-hidden="true" /> : <Minus size={15} aria-hidden="true" />}
    <span>{minimum === null ? "Toute qualité acceptée" : stock.route === "biomass" ? "Biomasse non acceptée" : `${!accepted ? "Qualité refusée" : risky ? channel === "cbd-shop" ? "Partenaires à risque" : "Clients à risque" : "Qualité suffisante"} · min. ${qualityScore(minimum)}`}</span>
  </span>;
}
async function request<T>(api: KqTutorialApi, body?: Record<string, unknown>, shopOnly = false): Promise<T> {
  const response = await api.request(`/api/arena/placard/commerce${shopOnly ? "?shop=1" : ""}`, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Le comptoir ne répond pas. Réessaie.");
  return payload as T;
}
type PreparedOffer = { quoteId: string; offer: KqCommerceOffer; vatCents?: number; labPaidCents?: number; supplierPaidCents?: number; electricityPaidCents: number; netPayoutCents: number; expiresAt: string };
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
    <div><Users size={25} aria-hidden="true" /><span><strong>{change}</strong><small>{direct ? `${receipt.clientsAfter} clients fidèles au total` : shops ? `${receipt.shopPartnersAfter ?? 0} boutiques partenaires au total` : "La reprise grossiste ne développe pas ton réseau."}</small></span></div>
    {shops && partnersDelta !== 0 ? <small>Ton nouveau réseau ajustera les prix et les volumes au prochain bilan de 24 heures.</small> : null}
  </section>;
}
function Confirm({ confirmation, busy, error, now, onRequote, onClose, onConfirm }: { confirmation: Confirmation; busy: boolean; error: string; now?: number; onRequote: () => void; onClose: () => void; onConfirm: () => void }) {
  const expired = Boolean(confirmation.offer && now && now >= Date.parse(confirmation.offer.expiresAt));
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close(); }, []);
  return <dialog ref={dialog} className={styles.confirm} onCancel={event => { if (busy) event.preventDefault(); else onClose(); }} aria-labelledby="commerce-confirm-title">
    <button className={styles.close} onClick={onClose} disabled={busy} aria-label="Fermer la confirmation"><X /></button>
    <small>Le Placard · Bon de commande</small><h2 id="commerce-confirm-title">{confirmation.title}</h2><p>{confirmation.description}</p>
    {confirmation.offer ? <dl><div><dt>Quantité vendue</dt><dd>{grams(confirmation.offer.offer.units)}</dd></div><div><dt>Recette TTC</dt><dd>{formatKqCash(confirmation.offer.offer.payoutCents)}</dd></div><div><dt>TVA mise de côté</dt><dd>−{formatKqCash(confirmation.offer.vatCents ?? 0)}</dd></div><div><dt>Analyses échues réglées</dt><dd>−{formatKqCash(confirmation.offer.labPaidCents ?? 0)}</dd></div><div><dt>Électricité et soins réglés</dt><dd>−{formatKqCash(confirmation.offer.electricityPaidCents)}</dd></div>{(confirmation.offer.supplierPaidCents ?? 0) > 0 ? <div><dt>Fournisseurs échus réglés</dt><dd>−{formatKqCash(confirmation.offer.supplierPaidCents ?? 0)}</dd></div> : null}<div><dt>Versé au portefeuille</dt><dd>{formatKqCash(confirmation.offer.netPayoutCents)}</dd></div></dl> : <strong className={styles.total}>{confirmation.cost ? formatKqCash(confirmation.cost) : "Aucun débit immédiat"}</strong>}
    {confirmation.offer ? <><p>{confirmation.offer.offer.message}</p><small>Offre valable jusqu’à {new Date(confirmation.offer.expiresAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}. Les nouvelles commandes ne modifient pas ce montant.</small></> : null}
    {expired ? <p className={styles.error}>Cette offre a expiré. Recalcule-la pour voir les commandes actuelles.</p> : null}
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    <footer><button onClick={onClose} disabled={busy}>Revenir</button><button className={styles.primary} disabled={busy} onClick={expired ? onRequote : onConfirm}>{busy ? <LoaderCircle className={styles.spin} /> : <Check />} {busy ? "Validation…" : expired ? "Recalculer l’offre" : "Confirmer"}</button></footer>
  </dialog>;
}

export function KqCommerceComputer({ onBusyChange }: { onBusyChange?: (busy: boolean) => void } = {}) {
  const api = useKqTutorialApi();
  const [data, setData] = useState<KqCommerceSnapshot | null>(null);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [confirm, setConfirm] = useState(false);
  const key = useRef("");
  const load = useCallback(() => { void request<KqCommerceSnapshot>(api, undefined, true).then(setData).catch(e => setError(e.message)); }, [api]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false); }, [busy, onBusyChange]);
  async function buy() {
    setBusy(true); setError("");
    try { await request(api, { action: "buy-computer", requestKey: key.current }); setConfirm(false); load(); api.notify("kq:equipment-updated"); }
    catch (e) { setError(e instanceof Error ? e.message : "Achat indisponible."); } finally { setBusy(false); }
  }
  return <section className={styles.computer} aria-label="Matériel de vente en ligne">
    <Image src={KQ_CHANNELS.online.image} width={1200} height={800} sizes="(max-width: 700px) 100vw, 320px" alt="Ordinateur et routeur installés sur le bureau de préparation des commandes" />
    <div><small>Entrepôt · Développer ton commerce</small><h3>L’ordinateur du Placard</h3><p>Le matériel pour gérer ta boutique. Achat permanent : <strong>{formatKqCash(KQ_COMPUTER_PRICE_CENTS)}</strong>. Ouvre ensuite ton site de base gratuitement dans « Ma boutique » au Marché, sans abonnement, avec 2,5 % de frais sur les ventes. Tu pourras améliorer le site au fil de tes commandes.</p>
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      {data?.computerOwned ? <strong><Check size={18} /> Ordinateur déjà acheté</strong> : confirm ? <div className={styles.actions}><span>Confirmer l’achat à 450 € ?</span><button disabled={busy} onClick={() => void buy()} className={styles.primary}>{busy ? "Achat…" : "Confirmer l’achat"}</button><button disabled={busy} onClick={() => setConfirm(false)}>Annuler</button></div>
        : <button className={styles.primary} disabled={!data || data.cashCents < KQ_COMPUTER_PRICE_CENTS} onClick={() => { key.current = createClientRequestKey(); setConfirm(true); }}>{!data ? "Chargement…" : data.cashCents < KQ_COMPUTER_PRICE_CENTS ? "Trésorerie insuffisante · 450 €" : "Acheter l’ordinateur · 450 €"}</button>}
    </div>
  </section>;
}

const channelTradeoffs: Record<KqSalesChannel, { advantage: string; drawback: string }> = {
  online: { advantage: "Tes prix libres et des ventes même hors connexion.", drawback: "Une audience à construire ; le rapport qualité-prix fidélise ou déçoit." },
  "cbd-shop": { advantage: "De grosses quantités vendues immédiatement.", drawback: "La qualité fidélise ton réseau ; les arômes recherchés peuvent bonifier le tarif des fleurs." },
  wholesale: { advantage: "Toute qualité acceptée dans la limite du quota disponible.", drawback: "Prix bas ; aucun gain de réputation." },
};

export type KqCommerceMode = "demands" | "sales" | "dashboard";

export function KqCommerceDesk({ onOpenShop, onOpenTreasury, onOpenBusiness, onOpenStorage, onOpenCulture, mode, onModeChange, initialFlowerId }: { onOpenShop: (equipmentCode?: string) => void; onOpenTreasury?: () => void; onOpenBusiness?: () => void; onOpenStorage?: () => void; onOpenCulture?: () => void; mode?: KqCommerceMode; onModeChange?: (mode: KqCommerceMode) => void; initialFlowerId?: string }) {
  const api = useKqTutorialApi();
  const heading = useRef<HTMLHeadingElement>(null);
  const focusMode = useRef(false);
  const focusListings = useRef(false);
  const clock = useRef<{ server: number; received: number } | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const refreshedPeriods = useRef(new Set<string>());
  const initialLot = useRef({ flowerId: initialFlowerId, resolved: false });
  const [lotNotice, setLotNotice] = useState("");
  const [liveNow, setLiveNow] = useState<number | undefined>(undefined);
  const [localMode, setLocalMode] = useState<KqCommerceMode>(initialFlowerId ? "sales" : "demands");
  const activeMode = mode ?? localMode;
  const dashboard = activeMode === "dashboard";
  const demands = activeMode === "demands";
  const sales = activeMode === "sales";
  const [data, setData] = useState<KqCommerceSnapshot | null>(null);
  const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [channel, setChannel] = useState<KqSalesChannel | null>(null); const [policy, setPolicy] = useState<KqOnlinePrice>("advised");
  const [selectedId, setSelectedId] = useState(""); const [quantity, setQuantity] = useState(""); const [route, setRoute] = useState<KqMarketRouteCode>("raw");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null); const [receipt, setReceipt] = useState<SaleResult | null>(null);
  const load = useCallback(() => {
    if (inFlight.current) return inFlight.current;
    const pending = (async () => {
      setRefreshing(true);
      try {
        const result = await request<KqCommerceSnapshot>(api);
        if (result.customerDemand || result.business || result.demand) {
          const server = Date.parse(result.customerDemand?.serverNow ?? result.business?.serverNow ?? result.demand!.serverNow);
          clock.current = { server, received: performance.now() }; setLiveNow(server);
        }
        setData(result); setError("");
        if (!initialLot.current.resolved) {
          initialLot.current.resolved = true;
          const flowerId = initialLot.current.flowerId;
          if (flowerId) {
            focusMode.current = true;
            const rawLot = result.rawLots.find(lot => lot.flowerId === flowerId);
            const preparedLot = result.stocks.find(lot => lot.flowerId === flowerId && lot.remainingUnits > 0);
            if (rawLot) setSelectedId(`raw:${rawLot.flowerId}`);
            else if (preparedLot) setSelectedId(preparedLot.id);
            else setLotNotice("Cette récolte n’est plus disponible à la vente. Retrouve tes autres lots ci-dessous.");
          }
        }
      } catch (e) { setError(e instanceof Error ? e.message : "Marché indisponible."); }
      finally { setLoading(false); setRefreshing(false); }
    })();
    inFlight.current = pending;
    void pending.finally(() => { if (inFlight.current === pending) inFlight.current = null; });
    return pending;
  }, [api]);
  useEffect(() => {
    const tick = () => {
      if (!document.hidden && clock.current) setLiveNow(clock.current.server + Math.max(0, performance.now() - clock.current.received));
    };
    const resume = () => { tick(); if (!document.hidden && clock.current && performance.now() - clock.current.received > 60000) void load(); };
    const timer = window.setInterval(tick, 15000);
    document.addEventListener("visibilitychange", resume);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", resume); };
  }, [load]);
  useEffect(() => {
    if (!data?.online && !data?.customerDemand) return;
    const timer = window.setInterval(() => { if (!document.hidden && !busy && !confirmation) void load(); }, 60000);
    return () => window.clearInterval(timer);
  }, [data?.online, data?.customerDemand, busy, confirmation, load]);
  useEffect(() => {
    const demandPreviewAt = data?.customerDemand ? new Date(Date.parse(data.customerDemand.endsAt) - 24 * 60 * 60 * 1000).toISOString() : undefined;
    const events = [data?.customerDemand?.endsAt, demandPreviewAt, data?.demand?.growthResetsAt, data?.business?.nextEventAt, ...(data?.rawLots ?? []).map(lot => lot.storage?.nextChangeAt), ...(data?.stocks ?? []).flatMap(lot => [lot.storage?.nextChangeAt, lot.processingReadyAt])].filter((value): value is string => Boolean(value) && !refreshedPeriods.current.has(value!));
    const reset = events.sort((a, b) => Date.parse(a) - Date.parse(b))[0];
    if (reset && liveNow && liveNow >= Date.parse(reset) && !busy && !confirmation) {
      refreshedPeriods.current.add(reset); void load();
    }
  }, [data, liveNow, busy, confirmation, load]);
  useEffect(() => { void load(); return api.subscribe(["kq:equipment-updated", "kq:storage-updated"], () => { void load(); }); }, [load, api]);
  const stock = data?.stocks.find(s => s.id === selectedId);
  const raw = data?.rawLots.find(l => `raw:${l.flowerId}` === selectedId);
  const saleComplete = sales && receipt?.action === "sell";
  const onlineScreen = sales && channel === "online" && Boolean(data?.online) && Boolean(stock);
  const screen = demands ? "demands" : dashboard ? "dashboard" : saleComplete ? "receipt" : onlineScreen ? "online" : stock ? channel ? "offer" : "distribution" : raw ? "preparation" : "lots";
  useEffect(() => {
    if (focusMode.current && heading.current) {
      heading.current?.focus({ preventScroll: false });
      focusMode.current = false;
    }
  }, [screen, selectedId, saleComplete]);
  useEffect(() => {
    if (dashboard && focusListings.current) {
      document.querySelector<HTMLElement>("[data-online-listings-heading]")?.focus();
      focusListings.current = false;
    }
  }, [dashboard]);
  const activeProduct = raw?.options.find(q => q.route === route) ?? raw?.options.find(q => q.route === "raw");
  const requestedUnits = quantity === "" ? undefined : Math.round(Number(quantity.replace(",", ".")) * 10);
  const offer = data && stock && channel ? quoteKqCommerce(data, stock, channel, policy, requestedUnits, liveNow) : null;
  const inputInvalid = quantity !== "" && (!Number.isFinite(requestedUnits) || requestedUnits! <= 0 || requestedUnits! > (offer?.maxUnits ?? 0));
  const cost = activeProduct?.market?.processingCostCents ?? 0;
  const overflowUnits = raw?.storage?.capacity?.overflowUnits ?? 0;
  const canPrepare = !overflowUnits && activeProduct && (activeProduct.route === "raw" || activeProduct.route === "biomass" || activeProduct.available);
  function choose(id: string) { focusMode.current = true; setSelectedId(id); setQuantity(""); setRoute("raw"); setChannel(null); setPolicy("advised"); setReceipt(null); setError(""); setLotNotice(""); }
  function changeMode(next: KqCommerceMode) { focusMode.current = true; setLocalMode(next); onModeChange?.(next); }
  function chooseChannel(code: KqSalesChannel | null) { focusMode.current = true; setChannel(code); setQuantity(""); setPolicy("advised"); setError(""); }
  function chooseDemandLot(id: string, code: KqSalesChannel) {
    if (!sales) {
      focusMode.current = true;
      setLocalMode("sales");
      onModeChange?.("sales");
    }
    choose(id);
    if (!id.startsWith("raw:")) chooseChannel(code);
  }
  function openDemandListings() {
    if (dashboard) document.querySelector<HTMLElement>("[data-online-listings-heading]")?.focus();
    else {
      focusListings.current = true;
      changeMode("dashboard");
    }
  }
  function browseDemandLots() {
    choose("");
    if (!sales) changeMode("sales");
    else heading.current?.focus();
  }
  function ask(title: string, description: string, body: Record<string, unknown>, cost?: number) {
    setError(""); setConfirmation({ title, description, body: { ...body, requestKey: createClientRequestKey() }, cost });
  }
  function openTreasury(event: MouseEvent<HTMLAnchorElement>) {
    if (onOpenTreasury) { event.preventDefault(); onOpenTreasury(); }
  }
  function openBusiness(event: MouseEvent<HTMLAnchorElement>) {
    if (onOpenBusiness) { event.preventDefault(); onOpenBusiness(); }
  }
  function openStorage(event: MouseEvent<HTMLAnchorElement>) {
    if (onOpenStorage) { event.preventDefault(); onOpenStorage(); }
  }
  async function examineSale() {
    if (!stock || !offer || !channel || offer.reason || inputInvalid) return;
    setBusy(true); setError("");
    try {
      const prepared = await request<PreparedOffer>(api, { action: "quote", stockId: stock.id, channel, policy, units: offer.units });
      if (prepared.offer.reason || prepared.offer.units <= 0) throw new Error(prepared.offer.reason ?? "Aucune commande disponible.");
      setConfirmation({ title: `Vendre · ${KQ_CHANNELS[channel].name}`, description: `${stock.name} · ${productName(stock.route)} · Qualité commerciale ${qualityScore(getKqCommerceStockQuality(stock))}. ${grams(stock.remainingUnits - prepared.offer.units)} resteront en stock.`, offer: prepared,
        body: { action: "sell", quoteId: prepared.quoteId, expectedPayoutCents: prepared.offer.payoutCents, requestKey: createClientRequestKey() } });
    } catch (e) { setError(e instanceof Error ? e.message : "Offre indisponible."); } finally { setBusy(false); }
  }
  async function commit() {
    if (!confirmation || busy) return;
    setBusy(true); setError("");
    try {
      const result = await request<KqCommerceReceipt>(api, confirmation.body);
      // Use the server quote's starting clientele and the committed receipt's final value.
      // Keeping the quote through retries avoids attributing a later sale's gains to this one.
      const quoted = confirmation.offer?.offer;
      const satisfaction = result.satisfaction ?? quoted?.satisfaction;
      const clientsBefore = result.clientsBefore ?? quoted?.clientsBefore;
      const feedback = result.action === "sell" && satisfaction && Number.isFinite(clientsBefore) && Number.isFinite(result.clientsAfter)
        ? { satisfaction, clientsDelta: result.clientsAfter! - clientsBefore! } : undefined;
      focusMode.current = true;
      setConfirmation(null); setReceipt({ ...result, feedback }); setQuantity("");
      if (result.action === "prepare" && result.stockId) { setSelectedId(result.stockId); setChannel(null); }
      await load(); api.notify("kq:equipment-updated");
      if (confirmation.body.action === "online" && confirmation.body.command === "create-listing") changeMode("dashboard");
    } catch (e) { setError(e instanceof Error ? e.message : "Opération indisponible."); } finally { setBusy(false); }
  }
  const title = dashboard ? "Mes ventes" : saleComplete ? "Vente terminée" : onlineScreen ? "Préparer une annonce en ligne" : stock ? channel ? KQ_CHANNELS[channel].name : "Comment veux-tu vendre ?" : raw ? "Préparer ma récolte" : "Quelle récolte veux-tu vendre ?";
  const currentStep = saleComplete ? 4 : stock ? channel ? 3 : 2 : raw ? 1 : 0;
  return <main className={styles.page} data-screen={screen}>
    {!dashboard && <div className={styles.scenery} aria-hidden="true"><Image key={channel ?? "workshop"} src={channel ? KQ_CHANNELS[channel].image : "/placard/market-workshop-sylvain-v2.webp"} alt="" fill sizes="(max-width: 1200px) 100vw, 1120px" priority /></div>}
    <h1 className="sr-only" ref={!sales ? heading : undefined} data-commerce-view-heading={!sales || undefined} tabIndex={-1}>{demands ? "Demandes du moment" : dashboard ? "Mes ventes en ligne" : "Vendre ma production"}</h1>
    {mode === undefined ? <nav className={styles.standaloneNav} aria-label="Mon commerce"><button type="button" aria-pressed={demands} onClick={() => changeMode("demands")}>Demandes du moment</button><button type="button" aria-pressed={sales} onClick={() => changeMode("sales")}>Vendre ma production</button><button type="button" aria-pressed={dashboard} onClick={() => changeMode("dashboard")}>Mes ventes</button>{onOpenBusiness ? <button type="button" onClick={onOpenBusiness}>Ma boutique</button> : null}</nav> : null}
    {error && !confirmation ? <p className={styles.error} role="alert">{error} <button onClick={() => void load()}>Actualiser</button></p> : null}
    {lotNotice && sales ? <p className={styles.dashboardUnavailable} role="status">{lotNotice}</p> : null}
    {!loading && demands ? <KqCustomerDemandDashboard data={data} now={liveNow} busy={busy || refreshing} onRetry={() => void load()} onChooseLot={chooseDemandLot} onOpenCulture={onOpenCulture} onOpenListings={openDemandListings} onBrowseLots={browseDemandLots} /> : null}
    {!demands && (mode === undefined || onModeChange) ? <button type="button" className={styles.back} onClick={() => changeMode("demands")}>← Demandes du moment</button> : null}
    {loading ? <p className={styles.loading}><LoaderCircle className={styles.spin} /> Ouverture du comptoir…</p> : data && !demands ? <section key={screen} className={styles.flow} aria-labelledby={dashboard ? undefined : "commerce-step-title"}>
      {!dashboard ? <ol className={styles.steps} aria-label="Les étapes de la vente">{["Récolte", "Préparation", "Mode de vente", "Validation"].map((step, index) => <li key={step} aria-current={index === currentStep ? "step" : undefined} data-complete={index < currentStep}><span aria-hidden="true">{index < currentStep ? <Check size={13} /> : index + 1}</span>{step}</li>)}</ol> : null}
      {!dashboard && !saleComplete && (raw || stock || onlineScreen) ? <button className={styles.back} onClick={() => stock && channel ? chooseChannel(null) : choose("")}>← {stock && channel ? "Comparer les circuits" : "Retour aux lots"}</button> : null}
      {!dashboard ? <h2 id="commerce-step-title" ref={heading} data-commerce-view-heading tabIndex={-1}>{title}</h2> : null}
      {!dashboard && data.strength === "merchant" ? <p><Sparkles size={16} aria-hidden="true" /> Commercial · capacité de vente +50 % en ligne et en boutique. Recettes et progression du recrutement +50 %.</p> : null}
      {dashboard ? data.online ? <KqOnlineDashboard data={data} now={liveNow} busy={busy} onAsk={ask} onOpenBusiness={onOpenBusiness} onOpenShop={() => onOpenShop("COMPUTER")} onPrepareStock={browseDemandLots} /> : <div className={styles.dashboardUnavailable}><p>Le suivi des annonces en ligne n’est pas disponible dans cet atelier.</p><button className={styles.primary} onClick={browseDemandLots}>Choisir un lot <ArrowRight size={18} aria-hidden="true" /></button></div> : saleComplete ? <div className={styles.saleDone} role="status"><span className={styles.successEmblem}><Coins size={42} aria-hidden="true" /><Sparkles size={22} aria-hidden="true" /></span><small>Dans ta trésorerie</small><strong>{formatKqCash(receipt.netPayoutCents ?? 0)} versés</strong><p>{grams(receipt.units ?? 0)} vendus · {grams(receipt.remainingUnits ?? 0)} restants.</p>
        <dl className={styles.receiptAmounts}><div><dt>Recette TTC</dt><dd>{formatKqCash(receipt.payoutCents ?? 0)}</dd></div><div><dt>TVA mise de côté</dt><dd>−{formatKqCash(receipt.vatCents ?? 0)}</dd></div><div><dt>Analyses échues réglées</dt><dd>−{formatKqCash(receipt.labPaidCents ?? 0)}</dd></div><div><dt>Électricité et soins réglés</dt><dd>−{formatKqCash(receipt.electricityPaidCents ?? 0)}</dd></div>{(receipt.supplierPaidCents ?? 0) > 0 ? <div><dt>Fournisseurs échus réglés</dt><dd>−{formatKqCash(receipt.supplierPaidCents ?? 0)}</dd></div> : null}</dl>
        <CustomerFeedback receipt={receipt} />
        <p>{(receipt.remainingUnits ?? 0) > 0 ? "Le reste est conservé. Tu peux le proposer à un autre circuit." : "Tout ce produit a été vendu."}</p>
        <button className={styles.primary} onClick={() => choose((receipt.remainingUnits ?? 0) > 0 && stock ? stock.id : "")}>{(receipt.remainingUnits ?? 0) > 0 && stock ? "Vendre le reste" : "Retour aux lots"} <ArrowRight size={18} /></button>
      </div> : onlineScreen ? <KqOnlineStore key={stock?.id} data={data} selectedStockId={stock?.id} now={liveNow} busy={busy} onAsk={ask} onOpenBusiness={onOpenBusiness} onOpenShop={() => onOpenShop("COMPUTER")} /> : raw && activeProduct ? <div className={styles.preparation}>
        <div className={styles.workshopArt}><Image src="/placard/market-workshop-sylvain-v2.webp" width={1536} height={1024} alt="Presse, tamis et laveuse de l’atelier du Placard" sizes="(max-width: 700px) 100vw, 450px" /><span className={styles.artLabel}><FlaskConical size={16} aria-hidden="true" /> Atelier de transformation</span></div>
        <div><p className={styles.lotSummary}>{raw.varietyName} · {raw.harvestGrams.toLocaleString("fr-FR")} g · Jury : {qualityScore(raw.juryScore)}</p>
          <KqStorageStatus storage={raw.storage} nowMs={liveNow} />
          {overflowUnits > 0 ? <div role="status"><p className={styles.error}>{grams(overflowUnits)} n’ont pas de contenant. Achète la place nécessaire ou vends uniquement ce surplus avant de préparer le lot.</p><Link prefetch={false} href="/arene/placard?view=workshop&section=storage" className={styles.primary} onClick={openStorage}>Gérer mes contenants et le surplus <ArrowRight size={18} /></Link></div> : null}
          <label className={styles.field}>Que veux-tu obtenir ?<select value={activeProduct.route} onChange={e => setRoute(e.target.value as KqMarketRouteCode)}>{raw.options.map(q => <option key={q.route} value={q.route}>{q.route === "raw" ? "Fleurs entières (sans transformation)" : q.name}{q.available || q.route === "raw" || q.route === "biomass" ? "" : " · verrouillé"}</option>)}</select></label>
          <p>{activeProduct.route === "raw" ? "Garde tes fleurs entières : aucune transformation nécessaire." : activeProduct.description}</p>
          <div className={styles.figures}><span>Produit obtenu<strong>{grams(Math.round(activeProduct.productGrams * 10))}</strong></span><span>Charges d’atelier estimées<strong>{formatKqCash(cost)}</strong></span></div>
          {(activeProduct.processingDurationSeconds ?? 0) > 0 ? <p><Clock3 size={15} aria-hidden="true" /> Temps de travail : {Math.ceil(activeProduct.processingDurationSeconds! / 60).toLocaleString("fr-FR")} minutes réelles, après les lots déjà en attente. Le produit pourra être vendu une fois terminé.</p> : null}
          {activeProduct.remainderGrams > 0 ? <p>{activeProduct.remainderGrams.toLocaleString("fr-FR")} g de fleurs non traitées seront conservés séparément.</p> : null}
          {!canPrepare && !overflowUnits ? <p className={styles.error}>{activeProduct.blockedReason}</p> : null}
          <button className={styles.primary} disabled={busy || !canPrepare || cost > data.cashCents} onClick={() => ask("Préparer ce lot", `${raw.varietyName} : ${activeProduct.name}. Une fois préparé, tu choisiras une offre de distribution.`, { action: "prepare", flowerId: raw.flowerId, route: activeProduct.route, expectedCostCents: cost }, cost)}>{cost > data.cashCents ? "Trésorerie insuffisante" : activeProduct.route === "raw" ? "Préparer les fleurs et continuer" : "Transformer et continuer"} <ArrowRight size={18} /></button>
        </div>
      </div> : stock && !channel ? <>
        <p className={styles.lotSummary}>{stock.name} · {productName(stock.route)} · <strong>{grams(stock.remainingUnits)} en stock</strong></p>
        <LotQuality stock={stock} />
        <KqStorageStatus storage={stock.storage} nowMs={liveNow} compact />
        <p>Les commandes reviennent avec le temps, même hors connexion. Tous tes lots partagent la demande de chaque circuit ; les invendus restent en stock.</p>
        {data.campaign && data.campaign.event !== "normal" ? <p className={styles.event}>{KQ_COMMERCE_EVENTS[data.campaign.event]}</p> : null}
        <div className={styles.offers} aria-label="Circuits de vente">{KQ_SALES_CHANNELS.map(code => {
          if (code === "online" && data.online) return <button key={code} className={styles.offerCard} onClick={() => chooseChannel(code)} aria-label="Préparer des paquets pour ma boutique en ligne">
            <div className={styles.offerHeading}><div className={styles.offerArt}><Image src={KQ_CHANNELS.online.image} alt="" fill sizes="88px" /></div><div className={styles.offerCaption}><span>Ta boutique en ligne</span><strong className={styles.offerAmount}>Prix libres</strong><small>Paquets de 5 ou 10 g</small></div></div>
            <div className={styles.offerCopy}><span className={styles.demandStatus}><span><Clock3 size={16} aria-hidden="true" />Ventes progressives, même hors connexion.</span><small>2,5 % de frais sur les ventes. Une audience à développer.</small></span><ChannelQuality stock={stock} channel="online" now={liveNow} /><span className={styles.offerLink}>Préparer mon rayon <ArrowRight size={16} aria-hidden="true" /></span></div>
          </button>;
          const proposal = quoteKqCommerce(data, stock, code, "advised", undefined, liveNow);
          return <button key={code} className={styles.offerCard} data-unavailable={proposal.reason ? "true" : undefined} onClick={() => chooseChannel(code)} aria-label={`Voir l’offre ${KQ_CHANNELS[code].name}`}>
            <div className={styles.offerHeading}><div className={styles.offerArt}><Image src={KQ_CHANNELS[code].image} alt="" fill sizes="88px" /></div>
              <div className={styles.offerCaption}><span>{KQ_CHANNELS[code].name}</span><strong className={styles.offerAmount}>{proposal.reason ? "Indisponible" : formatKqCash(proposal.payoutCents)}</strong>
                {!proposal.reason ? <small>{grams(proposal.units)} repris · {formatKqCash(Math.round(proposal.unitCents))}/g TTC</small> : null}
              </div>
            </div>
            <div className={styles.offerCopy}>
              {code === "wholesale" || isKqCommerceStockMature(stock, liveNow) ? <DemandStatus data={data} channel={code} offer={proposal} now={liveNow} compact /> : null}
              <ChannelQuality stock={stock} channel={code} now={liveNow} />
              {code === "cbd-shop" ? <small>{proposal.retailPriceCentsPerKg !== undefined ? `${formatKqCash(proposal.retailPriceCentsPerKg)}/kg de fleurs` : `${proposal.shopPricePercent} % de reprise`} · {data.shopPartners ?? 0} boutiques partenaires</small> : null}
              {proposal.reason ? <span className={styles.unavailableReason}>{proposal.reason}</span> : null}
              <small>{code === "wholesale" ? "Prix bas · aucun gain de réputation" : code === "cbd-shop" ? "Paiement immédiat · réseau sensible à la qualité" : "Prix et quantités à choisir à l’étape suivante"}</small>
              <span className={styles.offerLink}>{proposal.reason ? "Voir les conditions" : "Choisir cette offre"} <ArrowRight size={16} /></span>
            </div>
          </button>;
        })}</div><small className={styles.estimateNote}>Prix TTC, avant réserve de TVA et règlement des analyses échues, de l’électricité, des soins et des fournisseurs échus. Le montant net sera confirmé avant la vente.</small>
      </> : stock && offer && channel ? <div className={styles.selectedOffer}>
        <div className={styles.selectedArt}><Image src={KQ_CHANNELS[channel].image} alt="" width={1200} height={800} sizes="(max-width: 700px) 100vw, 400px" /><span className={styles.artLabel}><ShoppingBag size={16} aria-hidden="true" /> {KQ_CHANNELS[channel].name}</span></div>
        <div><p className={styles.lotSummary}>{stock.name} · {productName(stock.route)} · {grams(stock.remainingUnits)} en stock</p>
          <LotQuality stock={stock} /><ChannelQuality stock={stock} channel={channel} now={liveNow} />
          <KqStorageStatus storage={stock.storage} nowMs={liveNow} />
          <p>{channelTradeoffs[channel].advantage} {channelTradeoffs[channel].drawback}</p>
          {channel === "wholesale" || isKqCommerceStockMature(stock, liveNow) ? <DemandStatus data={data} channel={channel} offer={offer} now={liveNow} /> : null}
          {channel === "cbd-shop" && data.online && stock.route === "raw" ? <details className={styles.adjustments}><summary>Tarif indoor des shops · 3 €/g</summary><p>Les fleurs entières mûres sont reprises à 3 €/g TTC, soit 3 000 €/kg, dès 6,5/10. Paiement immédiat, dans la limite des commandes disponibles.</p><ul className={styles.shopScale}><li><strong>3 €/g · tarif professionnel</strong><span>Base des fleurs indoor commercialisables</span></li><li><strong>Jusqu’à +25 % · arômes recherchés</strong><span>Un arôme commun donne la moitié de la prime ; deux donnent la prime complète, sur le volume demandé et à la qualité requise</span></li><li><strong>2,10 €/g · grossistes</strong><span>30 % sous le tarif shop, hors prime temporaire</span></li></ul><p>Le réseau de {data.shopPartners ?? 0} boutiques développe tes volumes de reprise. La qualité des livraisons fidélise les partenaires. Le hash et le rosin gardent leurs propres barèmes.</p></details> : channel === "cbd-shop" ? <details className={styles.adjustments}><summary>Barème des boutiques · {offer.shopPricePercent} % de reprise</summary>
            <p>{data.shopPartners ?? 0} boutiques partenaires · Bonus sur cette période : +{getKqShopNetworkBonus(data.campaign?.shopPartnersStart ?? data.shopPartners ?? 0)} points sur la reprise.</p>
            <ul className={styles.shopScale}>{KQ_SHOP_QUALITY_BANDS.map((band, index) => <li key={band.label}><strong>{qualityScore(stock.route === "raw" ? band.flowerMinimum : band.extractMinimum)}{index === KQ_SHOP_QUALITY_BANDS.length - 1 ? " et plus" : ` à moins de ${qualityScore(stock.route === "raw" ? KQ_SHOP_QUALITY_BANDS[index + 1].flowerMinimum : KQ_SHOP_QUALITY_BANDS[index + 1].extractMinimum)}`} · {band.pricePercent} %</strong><span>{band.recruitmentWeight ? `1 partenaire par ${band.recruitmentWeight === 4 ? "150" : "200"} g équivalents livrés` : band.churnWeight ? "1 partenaire perdu par 100 g équivalents livrés" : "Réseau stable"}</span></li>)}</ul>
            {data.strength === "merchant" ? <p>Les seuils ci-dessus sont indiqués sans bonus Commercial : ton recrutement progresse 50 % plus vite.</p> : null}
            <p>20 partenaires maximum. Au plus {data.strength === "merchant" ? 2 : 1} nouveau{data.strength === "merchant" ? "x" : ""} partenaire{data.strength === "merchant" ? "s" : ""} par période de 24 heures réelles{data.strength === "merchant" ? ", selon la progression reportée" : ""} ; départs limités à 25 % du réseau de début de période, arrondis au supérieur. Les petites livraisons s’additionnent. Pour le hash et le rosin, le volume est ramené à la quantité de fleurs utilisée.</p>
            <p>Bonus réseau : +1 point dès 1 boutique, +2 dès 4, +3 dès 8, +4 dès 12. Sans partenaire, tu peux toujours prospecter. Le bonus réseau et la capacité sont réévalués toutes les 24 heures. Terminer une culture ne renouvelle pas les commandes.</p>
          </details> : null}
          {offer.reason ? <><p className={styles.error}>{offer.reason}</p>
            {channel === "online" && !data.computerOwned ? <button className={styles.primary} onClick={() => onOpenShop("COMPUTER")}>Voir l’ordinateur dans l’Entrepôt · 450 €</button>
              : channel === "online" && data.business && !data.business.shop.active ? <Link prefetch={false} href="/arene/placard?view=market&section=management" className={styles.primary} onClick={openBusiness}>{data.business.shop.createdAt ? "Réactiver mon site au Marché" : "Créer mon site au Marché"}</Link> : null}
            {channel === "online" ? <p>Ordinateur : 450 €. Création du site : 1 000 €, premier mois inclus. Puis 100 € tous les 30 jours de jeu (5 jours réels).</p> : null}
          </> : <>
            <div className={styles.figures}><span>Quantité reprise<strong>{grams(offer.units)}</strong></span><span>Offre TTC proposée<strong>{formatKqCash(offer.payoutCents)}</strong></span></div>
            <p>{offer.message}</p>{offer.customerDemand ? <p><Sparkles size={16} aria-hidden="true" />Demande du moment : +{offer.customerDemand.bonusPercent.toLocaleString("fr-FR")} % sur {grams(offer.customerDemand.units)}. {offer.customerDemand.units < offer.units ? "Le reste de cette vente est repris au tarif habituel ; le prix au gramme affiché est une moyenne." : "La prime est déjà comprise dans cette offre."}</p> : null}{channel === "online" ? <p>Au plus {data.strength === "merchant" ? 7 : 5} nouveaux clients par période de 24 heures réelles, selon les volumes et la qualité livrés.</p> : null}<p>{grams(stock.remainingUnits - offer.units)} resteront en stock.</p>
            <details className={styles.adjustments}><summary>Ajuster {channel === "online" ? "le prix ou la quantité" : "la quantité"}</summary>
              {channel === "online" ? <fieldset className={styles.prices}><legend>Ton prix</legend>{(["discovery", "advised", "premium"] as const).map(value => <button key={value} aria-pressed={policy === value} onClick={() => { setPolicy(value); setQuantity(""); }}>{value === "discovery" ? "Découverte · −10 %" : value === "premium" ? "Ambitieux · +22 %" : "Prix conseillé"}</button>)}</fieldset> : null}
              <label className={styles.field}>Quantité à vendre (g)<input type="number" min="0.1" step="0.1" max={offer.maxUnits / 10} placeholder={String(offer.maxUnits / 10)} value={quantity} onChange={e => setQuantity(e.target.value)} /></label>
              <p>{inputInvalid ? `Choisis une quantité entre 0,1 et ${grams(offer.maxUnits)}.` : `Prix TTC : ${formatKqCash(Math.round(offer.unitCents))}/g · Commandes : ${grams(offer.maxUnits)} maximum.`}</p>
            </details>
            <button disabled={busy || inputInvalid || offer.units <= 0} className={styles.primary} onClick={() => void examineSale()}>{busy ? "Calcul…" : "Vendre ce lot"} <ArrowRight size={18} /></button>
            <small className={styles.estimateNote}>Le montant après réserve de TVA et règlement des charges sera confirmé à l’étape suivante.</small>
          </>}
        </div>
      </div> : data.rawLots.length || data.stocks.length ? <>
        <p>Prépare tes récoltes et suis leur maturité. Pendant le curing, seul le grossiste reprend les lots.</p>
        <div className={styles.inventory}>
        <div className={styles.inventoryArt} aria-hidden="true"><Image src="/placard/market-workshop-sylvain-v2.webp" alt="" width={1536} height={1024} sizes="(max-width: 700px) 100vw, 540px" /><span><PackageOpen size={18} /> Ta réserve</span></div>
        <div className={styles.lotList} aria-label="Tes lots">
          {data.rawLots.map(item => <button key={item.flowerId} onClick={() => choose(`raw:${item.flowerId}`)}><span className={styles.lotIcon}><Leaf size={24} aria-hidden="true" /></span><span className={styles.lotText}><strong>{item.varietyName}</strong><small>{item.harvestGrams.toLocaleString("fr-FR")} g · Jury : {qualityScore(item.juryScore)}</small><KqStorageStatus storage={item.storage} nowMs={liveNow} compact /></span><span>Préparer ou vendre <ArrowRight size={18} /></span></button>)}
          {data.stocks.map(item => <button key={item.id} onClick={() => choose(item.id)}><span className={styles.lotIcon}><PackageOpen size={24} aria-hidden="true" /></span><span className={styles.lotText}><strong>{item.name}</strong><small>{productName(item.route)} · {grams(item.remainingUnits)} · Qualité commerciale {qualityScore(getKqCommerceStockQuality(item))} · Déjà préparé</small><KqStorageStatus storage={item.storage} nowMs={liveNow} compact /></span><span>Vendre <ArrowRight size={18} /></span></button>)}
        </div></div>
      </> : <div className={styles.empty}><Image src="/placard/market-workshop-sylvain-v2.webp" width={1536} height={1024} alt="L’atelier attend la prochaine récolte" sizes="(max-width: 700px) 100vw, 700px" /><div><strong>Ta réserve est vide</strong><p>Termine une culture et son duel pour récupérer un nouveau lot.</p></div></div>}
    </section> : null}
    {data && !dashboard && screen === "lots" ? <KqCommerceOverview data={data} onOpenShop={() => onOpenShop()} /> : null}
    {data ? <Link prefetch={false} href="/arene/placard?view=treasury&pole=accounting" className={styles.back} onClick={openTreasury}>Mes factures dans Finances <ArrowRight size={16} aria-hidden="true" /></Link> : null}
    {confirmation ? <Confirm confirmation={confirmation} busy={busy} error={error} now={liveNow} onRequote={() => void examineSale()} onClose={() => { if (!busy) { setConfirmation(null); setError(""); } }} onConfirm={() => void commit()} /> : null}
  </main>;
}
