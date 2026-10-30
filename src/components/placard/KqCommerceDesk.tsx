"use client";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { ArrowRight, Check, ChevronDown, Clock3, Coins, Frown, Leaf, LoaderCircle, Meh, Minus, PackageOpen, Smile, Sparkles, Users, X } from "lucide-react";
import { KQ_CHANNELS, KQ_COMMERCE_EVENTS, KQ_COMPUTER_PRICE_CENTS, KQ_SHOP_QUALITY_BANDS, getKqShopNetworkBonus, getKqShopQualityBand, getKqCommerceMinimumQuality, getKqCommerceReplenishment, getKqCommerceStockQuality, isKqCommerceStockMature, quoteKqCommerce,
  type KqCommerceOffer, type KqCommerceReceipt, type KqCommerceSnapshot, type KqCommerceStock, type KqOnlinePrice, type KqSalesChannel } from "@/lib/kanab-quest-commerce";
import { formatKqCash } from "@/lib/kanab-quest-equipment";
import { getKqCommerceFlowerSelection } from "@/lib/kanab-quest-commerce-lot-selection";
import { parseKqSaleQuantity } from "@/lib/kanab-quest-sale-quantity";
import { isKqCommerceOfferChangedCode, KqCommerceOfferChangedError } from "@/lib/kanab-quest-commerce-errors";
import { KQ_MARKET_ROUTES, type KqMarketRouteCode } from "@/lib/kanab-quest-market";
import { KqCommerceOverview } from "./KqCommerceOverview";
import { KqCommerceEmptyState } from "./KqCommerceEmptyState";
import { KqCustomerDemandDashboard } from "./KqCustomerDemandDashboard";
import { KqShopOverview } from "./KqShopOverview";
import { KqOnlineDashboard, KqOnlineStore } from "./KqOnlineStore";
import { KqStorageStatus } from "./KqStorageStatus";
import { KqLotSummary } from "./KqLotSummary";
import { getKqLotSummary } from "@/lib/kanab-quest-lot-summary";
import { KqPreparationSummary, type KqPreparationReview } from "./KqPreparationSummary";
import { KqAllocationBar } from "./KqVisuals";
import { createClientRequestKey } from "@/lib/client-request-key";
import styles from "./KqCommerceDesk.module.css";
import channelStyles from "./KqSalesChannels.module.css";
import offerStyles from "./KqSaleOffer.module.css";
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
function ChannelQuality({ stock, channel, now }: { stock: KqCommerceStock; channel: KqSalesChannel; now?: number }) {
  if (stock.processingReadyAt && (now === undefined || Date.parse(stock.processingReadyAt) > now)) return <span className={styles.qualityFit} data-tone="warning"><Clock3 size={15} aria-hidden="true" /><span>Transformation en cours · disponible le {new Date(stock.processingReadyAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span></span>;
  if (channel !== "wholesale" && !isKqCommerceStockMature(stock, now)) return <span className={styles.qualityFit} data-tone="warning"><Clock3 size={15} aria-hidden="true" /><span>Affinage en cours · circuit disponible à maturité</span></span>;
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
  if (!response.ok) {
    if (isKqCommerceOfferChangedCode(payload.code)) throw new KqCommerceOfferChangedError(payload.error, payload.code);
    throw new Error(payload.error ?? "Le comptoir ne répond pas. Réessaie.");
  }
  return payload as T;
}
type PreparedOffer = { quoteId: string; offer: KqCommerceOffer; vatCents?: number; labPaidCents?: number; supplierPaidCents?: number; electricityPaidCents: number; netPayoutCents: number; expiresAt: string; stock?: Pick<KqCommerceStock, "name" | "route" | "remainingUnits"> & { quality: number } };
type SaleQuoteRequest = { stockId: string; channel: KqSalesChannel; policy: KqOnlinePrice; units: number };
type Confirmation = { title: string; description: string; body: Record<string, unknown>; offer?: PreparedOffer; cost?: number; preparation?: KqPreparationReview; saleQuoteRequest?: SaleQuoteRequest; requoteRequired?: boolean; retrySameSale?: boolean; returnFocus?: HTMLElement };
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
  // A lost receipt may hide a completed sale. Retry its key even after expiry;
  // only an authoritative rejection permits replacing that request.
  const expired = Boolean(confirmation.offer && !confirmation.retrySameSale && now && now >= Date.parse(confirmation.offer.expiresAt));
  const needsRequote = expired || confirmation.requoteRequired;
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    const trigger = confirmation.returnFocus ?? document.activeElement;
    node?.showModal();
    return () => { node?.close(); if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true }); };
  }, [confirmation.returnFocus]);
  return <dialog ref={dialog} className={styles.confirm} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} aria-labelledby="commerce-confirm-title">
    <button className={styles.close} onClick={onClose} disabled={busy} aria-label="Fermer la confirmation"><X /></button>
    <h2 id="commerce-confirm-title">{confirmation.title}</h2><p>{confirmation.description}</p>
    {confirmation.preparation ? <><KqPreparationSummary {...confirmation.preparation} /><p>La vente sera choisie à l’étape suivante{confirmation.preparation.quote.family === "hash" || confirmation.preparation.quote.family === "rosin" ? ", et ne pourra avoir lieu qu’après la transformation" : ""}.</p></> : confirmation.offer ? <dl><div><dt>Quantité vendue</dt><dd>{grams(confirmation.offer.offer.units)}</dd></div><div><dt>Recette TTC</dt><dd>{formatKqCash(confirmation.offer.offer.payoutCents)}</dd></div><div><dt>TVA mise de côté</dt><dd>−{formatKqCash(confirmation.offer.vatCents ?? 0)}</dd></div><div><dt>Analyses échues réglées</dt><dd>−{formatKqCash(confirmation.offer.labPaidCents ?? 0)}</dd></div><div><dt>Électricité et soins réglés</dt><dd>−{formatKqCash(confirmation.offer.electricityPaidCents)}</dd></div>{(confirmation.offer.supplierPaidCents ?? 0) > 0 ? <div><dt>Fournisseurs échus réglés</dt><dd>−{formatKqCash(confirmation.offer.supplierPaidCents ?? 0)}</dd></div> : null}<div><dt>Versé au portefeuille</dt><dd>{formatKqCash(confirmation.offer.netPayoutCents)}</dd></div></dl> : confirmation.body.command === "discard-listing" ? null : <strong className={styles.total}>{confirmation.cost ? formatKqCash(confirmation.cost) : "Aucun débit immédiat"}</strong>}
    {confirmation.offer ? <><p>{confirmation.offer.offer.message}</p><small>Offre valable jusqu’à {new Date(confirmation.offer.expiresAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}. Les nouvelles commandes ne modifient pas ce montant.</small></> : null}
    {expired ? <p className={styles.error}>Cette offre a expiré. Recalcule-la pour voir les commandes actuelles.</p> : null}
    {confirmation.retrySameSale && !needsRequote ? <p role="status">Le résultat de cette vente reste à vérifier. Confirmer à nouveau vérifie la même demande.</p> : null}
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    <footer><button onClick={onClose} disabled={busy}>Revenir</button><button className={styles.primary} disabled={busy} onClick={needsRequote ? onRequote : onConfirm}>{busy ? <LoaderCircle className={styles.spin} /> : <Check />} {busy ? needsRequote ? "Recalcul…" : "Validation…" : needsRequote ? "Recalculer l’offre" : "Confirmer"}</button></footer>
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
    <div><h3>L’ordinateur de Kanab Quest</h3><p>Le matériel pour gérer ta boutique. Achat permanent : <strong>{formatKqCash(KQ_COMPUTER_PRICE_CENTS)}</strong>. Ouvre ensuite ton site de base gratuitement dans Commerce → Développer, sans abonnement, avec 2,5 % de frais sur les ventes. Tu pourras améliorer le site au fil de tes commandes.</p>
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

export type KqCommerceMode = "overview" | "demands" | "sales" | "dashboard";

export function KqCommerceDesk({ onOpenShop, onOpenTreasury, onOpenBusiness, onOpenMerch, onOpenStorage, onOpenCulture, mode, onModeChange, initialFlowerId, initialLotId, onLotSelectionChange, initialReceipt, initialListingId }: { onOpenShop: (equipmentCode?: string, flowerId?: string) => void; onOpenTreasury?: () => void; onOpenBusiness?: () => void; onOpenMerch?: () => void; onOpenStorage?: (flowerId?: string, lotId?: string) => void; onOpenCulture?: () => void; mode?: KqCommerceMode; onModeChange?: (mode: KqCommerceMode, listingId?: string) => void; initialFlowerId?: string; initialLotId?: string; onLotSelectionChange?: (selectedId: string | undefined, flowerId?: string) => void; initialReceipt?: KqCommerceReceipt; initialListingId?: string }) {
  const api = useKqTutorialApi();
  const heading = useRef<HTMLHeadingElement>(null);
  const focusMode = useRef(false);
  const focusListings = useRef(false);
  const clock = useRef<{ server: number; received: number } | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const refreshedPeriods = useRef(new Set<string>());
  const initialLot = useRef({ flowerId: initialFlowerId, lotId: initialLotId, resolved: false });
  const selectionEntry = useRef({ flowerId: initialFlowerId, lotId: initialLotId });
  const [lotNotice, setLotNotice] = useState("");
  const [liveNow, setLiveNow] = useState<number | undefined>(undefined);
  const [localMode, setLocalMode] = useState<KqCommerceMode>(initialFlowerId || initialLotId ? "sales" : "demands");
  const activeMode = mode ?? localMode;
  const dashboard = activeMode === "dashboard";
  const demands = activeMode === "demands";
  const sales = activeMode === "sales";
  const [data, setData] = useState<KqCommerceSnapshot | null>(null);
  const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [channel, setChannel] = useState<KqSalesChannel | null>(null); const [policy, setPolicy] = useState<KqOnlinePrice>("advised");
  const [selectedId, setSelectedId] = useState(""); const [quantity, setQuantity] = useState<string | null>(null); const [route, setRoute] = useState<KqMarketRouteCode>("raw");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null); const [receipt, setReceipt] = useState<SaleResult | null>(initialReceipt ?? null);
  const [pendingSale, setPendingSale] = useState<Confirmation | null>(null);
  const load = useCallback(() => {
    if (inFlight.current) return inFlight.current;
    const pending = (async () => {
      setRefreshing(true);
      try {
        const result = await request<KqCommerceSnapshot>(api);
        if (!Array.isArray(result?.rawLots) || !Array.isArray(result?.stocks)) throw new Error("Le stock du comptoir est incomplet. Actualise pour retrouver ton lot.");
        if (result.customerDemand || result.business || result.demand) {
          const server = Date.parse(result.customerDemand?.serverNow ?? result.business?.serverNow ?? result.demand!.serverNow);
          clock.current = { server, received: performance.now() }; setLiveNow(server);
        }
        setData(result); setLoadError("");
      } catch (e) { setLoadError(e instanceof Error ? e.message : "Marché indisponible."); }
      finally { setLoading(false); setRefreshing(false); }
    })();
    inFlight.current = pending;
    void pending.finally(() => { if (inFlight.current === pending) inFlight.current = null; });
    return pending;
  }, [api]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const changed = selectionEntry.current.flowerId !== initialFlowerId || selectionEntry.current.lotId !== initialLotId;
      if (changed) {
        selectionEntry.current = { flowerId: initialFlowerId, lotId: initialLotId };
        const ownSelection = initialLot.current.resolved && initialLot.current.lotId === initialLotId
          && initialLot.current.flowerId === initialFlowerId;
        if (!ownSelection) {
          initialLot.current = { flowerId: initialFlowerId, lotId: initialLotId, resolved: false };
          setChannel(null); setQuantity(null); setRoute("raw"); setPolicy("advised"); setReceipt(null); setConfirmation(null);
        }
      }
      if (!data || initialLot.current.resolved) return;
      initialLot.current.resolved = true;
      const target = getKqCommerceFlowerSelection(data, initialLot.current.flowerId, initialLot.current.lotId);
      focusMode.current = target.status !== "none";
      setSelectedId(target.status === "selected" ? target.selectedId : "");
      setLotNotice(target.status === "missing" ? "Ce lot n’est pas disponible dans le stock confirmé. Il a pu être vendu ou transformé. Aucun autre produit n’a été sélectionné." : "");
    });
    return () => cancelAnimationFrame(frame);
  }, [data, initialFlowerId, initialLotId]);
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
  const missingRequestedLot = sales && !saleComplete && ((Boolean(lotNotice) && !selectedId) || Boolean(selectedId && data && !raw && !stock));
  const screen = activeMode === "overview" ? "overview" : demands ? "demands" : dashboard ? "dashboard" : missingRequestedLot ? "missing-lot" : saleComplete ? "receipt" : onlineScreen ? "online" : stock ? channel ? "offer" : "distribution" : raw ? "preparation" : "lots";
  useEffect(() => {
    if (focusMode.current && heading.current) {
      // The targeted listing owns focus when opening its price editor.
      if (!dashboard || !initialListingId) heading.current?.focus({ preventScroll: false });
      focusMode.current = false;
    }
  }, [screen, selectedId, saleComplete, dashboard, initialListingId]);
  useEffect(() => {
    if (dashboard && focusListings.current) {
      document.querySelector<HTMLElement>("[data-online-listings-heading]")?.focus();
      focusListings.current = false;
    }
  }, [dashboard]);
  const activeProduct = raw?.options.find(q => q.route === route) ?? raw?.options.find(q => q.route === "raw");
  const saleQuantity = parseKqSaleQuantity(quantity);
  const offer = data && stock && channel ? quoteKqCommerce(data, stock, channel, policy, saleQuantity.units, liveNow) : null;
  const inputInvalid = !saleQuantity.valid || (saleQuantity.units !== undefined && saleQuantity.units > (offer?.maxUnits ?? 0));
  const cost = activeProduct?.market?.processingCostCents ?? 0;
  const overflowUnits = raw?.storage?.capacity?.overflowUnits ?? 0;
  const canPrepare = !overflowUnits && activeProduct && (activeProduct.route === "raw" || activeProduct.route === "biomass" || activeProduct.available);
  const rawSummary = raw ? getKqLotSummary({ kind: "raw", lot: raw }) : null;
  const lotFlowerId = raw?.flowerId ?? stock?.flowerId;
  const storageHref = lotFlowerId ? `/arene/placard?view=harvests&section=storage&flower=${encodeURIComponent(lotFlowerId)}&from=market&fromSection=sales&fromFlower=${encodeURIComponent(lotFlowerId)}&fromLot=${encodeURIComponent(selectedId)}` : "/arene/placard?view=harvests&section=storage";
  function choose(id: string) {
    const flowerId = data?.stocks.find(item => item.id === id)?.flowerId ?? data?.rawLots.find(item => `raw:${item.flowerId}` === id)?.flowerId;
    initialLot.current = { flowerId, lotId: id || undefined, resolved: true };
    focusMode.current = true; setSelectedId(id); setQuantity(null); setRoute("raw"); setChannel(null); setPolicy("advised"); setReceipt(null); setError(""); setLotNotice("");
    onLotSelectionChange?.(id || undefined, flowerId);
  }
  function changeMode(next: KqCommerceMode, listingId?: string) { focusMode.current = true; setLocalMode(next); onModeChange?.(next, listingId); }
  function chooseChannel(code: KqSalesChannel | null) { focusMode.current = true; setChannel(code); setQuantity(null); setPolicy("advised"); setError(""); }
  function chooseDemandLot(id: string, code: KqSalesChannel) {
    if (!sales) {
      focusMode.current = true;
      setLocalMode("sales");
      if (!onLotSelectionChange) onModeChange?.("sales");
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
    if (!sales && !onLotSelectionChange) changeMode("sales");
    else heading.current?.focus();
  }
  function ask(title: string, description: string, body: Record<string, unknown>, cost?: number) {
    setError(""); setConfirmation({ title, description, body: { ...body, requestKey: createClientRequestKey() }, cost });
  }
  function askPreparation() {
    if (!raw || !activeProduct || !canPrepare || busy || loadError || !data || cost > data.cashCents) return;
    setError("");
    setConfirmation({
      title: activeProduct.family === "hash" || activeProduct.family === "rosin" ? "Lancer la transformation" : "Préparer ce lot",
      description: `${raw.varietyName} · Lot ${raw.flowerId.slice(0, 8)} · ${productName(activeProduct.route)}`,
      body: { action: "prepare", flowerId: raw.flowerId, route: activeProduct.route, expectedCostCents: cost, requestKey: createClientRequestKey() },
      cost, preparation: { quote: activeProduct, costCents: cost },
    });
  }
  function openBusiness(event: MouseEvent<HTMLAnchorElement>) {
    if (onOpenBusiness) { event.preventDefault(); onOpenBusiness(); }
  }
  function openStorage(event: MouseEvent<HTMLAnchorElement>) {
    if (onOpenStorage) { event.preventDefault(); onOpenStorage(raw?.flowerId ?? stock?.flowerId, selectedId || undefined); }
  }
  async function examineSale(previous?: Confirmation) {
    if (busy) return;
    if (pendingSale) { setConfirmation(pendingSale); setError(""); return; }
    if (loadError && !previous) return;
    const saleQuoteRequest = previous?.saleQuoteRequest ?? (stock && offer && channel && !offer.reason && !inputInvalid
      ? { stockId: stock.id, channel, policy, units: offer.units } : undefined);
    if (!saleQuoteRequest) return;
    // Capture before disabling the trigger for the asynchronous quote request.
    const trigger = previous?.returnFocus ?? document.activeElement;
    if (previous) setConfirmation({ ...previous, requoteRequired: true });
    setBusy(true); setError("");
    try {
      const prepared = await request<PreparedOffer>(api, { action: "quote", ...saleQuoteRequest });
      if (prepared.offer.reason || prepared.offer.units <= 0) throw new Error(prepared.offer.reason ?? "Aucune commande disponible.");
      const quotedStock = prepared.stock ?? (stock ? { ...stock, quality: getKqCommerceStockQuality(stock) } : undefined);
      const description = quotedStock
        ? `${quotedStock.name} · ${productName(quotedStock.route)} · Qualité commerciale ${qualityScore(quotedStock.quality)}. ${grams(quotedStock.remainingUnits - prepared.offer.units)} resteront en stock.`
        : previous?.description ?? "Vérifie le nouveau montant avant de confirmer.";
      setConfirmation({ title: `Vendre · ${KQ_CHANNELS[saleQuoteRequest.channel].name}`, description, offer: prepared, saleQuoteRequest, returnFocus: trigger instanceof HTMLElement ? trigger : undefined,
        body: { action: "sell", quoteId: prepared.quoteId, expectedPayoutCents: prepared.offer.payoutCents, requestKey: createClientRequestKey() } });
    } catch (e) { setError(e instanceof Error ? e.message : "Offre indisponible."); } finally { setBusy(false); }
  }
  async function commit() {
    if (!confirmation || confirmation.requoteRequired || busy) return;
    setBusy(true); setError("");
    try {
      const result = await request<KqCommerceReceipt>(api, confirmation.body);
      if (confirmation.offer) setPendingSale(null);
      // Use the server quote's starting clientele and the committed receipt's final value.
      // Keeping the quote through retries avoids attributing a later sale's gains to this one.
      const quoted = confirmation.offer?.offer;
      const satisfaction = result.satisfaction ?? quoted?.satisfaction;
      const clientsBefore = result.clientsBefore ?? quoted?.clientsBefore;
      const feedback = result.action === "sell" && satisfaction && Number.isFinite(clientsBefore) && Number.isFinite(result.clientsAfter)
        ? { satisfaction, clientsDelta: result.clientsAfter! - clientsBefore! } : undefined;
      focusMode.current = true;
      setConfirmation(null); setReceipt({ ...result, feedback }); setQuantity(null);
      if (result.action === "prepare" && result.stockId) {
        const flowerId = result.flowerId ?? raw?.flowerId;
        initialLot.current = { flowerId, lotId: result.stockId, resolved: true };
        setSelectedId(result.stockId); setChannel(null);
        onLotSelectionChange?.(result.stockId, flowerId);
      }
      await load(); api.notify("kq:equipment-updated");
      if (confirmation.body.action === "online" && confirmation.body.command === "create-listing") changeMode("dashboard");
    } catch (e) {
      if (e instanceof KqCommerceOfferChangedError && confirmation.offer) {
        setPendingSale(null);
        setConfirmation({ ...confirmation, requoteRequired: true });
      } else if (confirmation.offer) {
        const pending = { ...confirmation, retrySameSale: true };
        setPendingSale(pending); setConfirmation(pending);
      }
      setError(e instanceof Error ? e.message : "Opération indisponible.");
    } finally { setBusy(false); }
  }
  const emptyComptoir = Boolean(data && !data.rawLots.length && !data.stocks.length);
  const title = dashboard ? "Mon stock en vente" : missingRequestedLot ? "Lot indisponible" : saleComplete ? "Vente terminée" : onlineScreen ? "Préparer une annonce en ligne" : stock ? channel ? KQ_CHANNELS[channel].name : "Choisir où vendre" : raw ? "Préparer ma récolte" : emptyComptoir ? "Préparer une vente" : "Quelle récolte veux-tu vendre ?";
  const currentStep = saleComplete ? 4 : stock ? channel ? 3 : 2 : raw ? 1 : 0;
  if (activeMode === "overview") return <KqShopOverview data={data} loading={loading} refreshing={refreshing} error={error || loadError} now={liveNow} headingRef={heading} onRefresh={() => void load()} onPrepareStock={browseDemandLots} onViewSales={listingId => changeMode("dashboard", listingId)} onViewDemands={() => changeMode("demands")} onOpenBusiness={onOpenBusiness} onOpenMerch={onOpenMerch} onOpenTreasury={onOpenTreasury} onOpenCulture={onOpenCulture} />;
  return <main className={styles.page} data-screen={screen} data-commerce-flower={raw?.flowerId ?? stock?.flowerId} data-commerce-lot={raw || stock ? selectedId : undefined} data-commerce-missing-flower={missingRequestedLot ? initialFlowerId : undefined} data-commerce-missing-lot={missingRequestedLot ? initialLotId ?? selectedId : undefined}>
    {!dashboard && mode === undefined && <div className={styles.scenery} aria-hidden="true"><Image key={channel ?? "workshop"} src={channel ? KQ_CHANNELS[channel].image : "/placard/market-workshop-sylvain-v2.webp"} alt="" fill sizes="(max-width: 1200px) 100vw, 1120px" priority /></div>}
    <h1 className="sr-only" ref={!sales || loading || !data ? heading : undefined} data-commerce-view-heading={!sales || loading || !data || undefined} tabIndex={-1}>{demands ? "Demandes du moment" : dashboard ? "Mon stock en vente" : "Vendre"}</h1>
    {mode === undefined ? <nav className={styles.standaloneNav} aria-label="Mon commerce"><button type="button" aria-pressed={demands} onClick={() => changeMode("demands")}>Demandes du moment</button><button type="button" aria-pressed={sales} onClick={() => changeMode("sales")}>Vendre</button><button type="button" aria-pressed={dashboard} onClick={() => changeMode("dashboard")}>Mon stock en vente</button>{onOpenBusiness ? <button type="button" onClick={onOpenBusiness}>Développer</button> : null}</nav> : null}
    {(error || loadError) && !confirmation ? <p className={styles.error} role="alert">{error || loadError} <button onClick={() => void load()}>Actualiser</button></p> : null}
    {pendingSale && !confirmation ? <div role="status" className={styles.error} data-pending-commerce-sale>
      <p>La réponse de ta vente n’a pas été confirmée. Vérifie cette demande avant d’en préparer une autre.</p>
      <button type="button" disabled={busy} onClick={() => { setConfirmation(pendingSale); setError(""); }}>Vérifier la vente</button>
    </div> : null}
    {!loading && data && missingRequestedLot ? <section className={styles.missingLot} aria-labelledby="commerce-step-title">
      <h2 id="commerce-step-title" ref={heading} data-commerce-view-heading tabIndex={-1}>{title}</h2>
      <p>{initialFlowerId ? `Récolte ${initialFlowerId.slice(0, 8)}` : "Produit sélectionné"}{initialLotId ? ` · ${initialLotId.slice(0, 16)}` : ""}</p>
      <p role="status">{lotNotice || "Ce produit n’est plus disponible dans le stock confirmé. Actualise ce lot ou consulte tes autres produits."}</p>
      <button type="button" disabled={refreshing} onClick={() => { initialLot.current.resolved = false; void load(); }}>Actualiser ce lot</button>
      <button type="button" className={styles.primary} data-commerce-other-lots onClick={() => choose("")}>Voir mes autres lots <ArrowRight size={18} aria-hidden="true" /></button>
    </section> : null}
    {!loading && demands ? <KqCustomerDemandDashboard data={data} now={liveNow} busy={busy || refreshing} onRetry={() => void load()} onChooseLot={chooseDemandLot} onOpenCulture={onOpenCulture} onOpenListings={openDemandListings} onBrowseLots={browseDemandLots} /> : null}
    {!demands && mode === undefined ? <button type="button" className={styles.back} onClick={() => changeMode("demands")}>← Demandes du moment</button> : null}
    {loading ? <p className={styles.loading}><LoaderCircle className={styles.spin} /> Ouverture du comptoir…</p> : data && !demands && !missingRequestedLot ? <section key={screen} className={styles.flow} aria-labelledby={dashboard ? undefined : "commerce-step-title"}>
      {!dashboard && (!emptyComptoir || saleComplete) ? <ol className={styles.steps} aria-label="Les étapes de la vente">{["Récolte", "Préparation", "Mode de vente", "Validation"].map((step, index) => <li key={step} aria-current={index === currentStep ? "step" : undefined} data-complete={index < currentStep}><span aria-hidden="true">{index < currentStep ? <Check size={13} /> : index + 1}</span>{step}</li>)}</ol> : null}
      {!dashboard && !saleComplete && (raw || stock || onlineScreen) ? <button className={styles.back} onClick={() => stock && channel ? chooseChannel(null) : choose("")}>← {stock && channel ? "Comparer les circuits" : "Retour aux lots"}</button> : null}
      {!dashboard ? <h2 id="commerce-step-title" ref={heading} data-commerce-view-heading tabIndex={-1}>{title}</h2> : null}
      {!dashboard && !saleComplete && stock ? <div className={styles.lotSheet}><KqLotSummary source={{ kind: "product", stock }} compact={screen === "distribution" || screen === "offer"}>
        <Link prefetch={false} data-commerce-open-lot-storage className={styles.back} href={storageHref} onClick={openStorage}>Stockage de cette récolte <ArrowRight size={16} aria-hidden="true" /></Link>
      </KqLotSummary></div> : null}
      {!dashboard && data.strength === "merchant" ? <p><Sparkles size={16} aria-hidden="true" /> Commercial · capacité de vente +50 % en ligne et en boutique. Recettes et progression du recrutement +50 %.</p> : null}
      {dashboard ? data.online ? <KqOnlineDashboard key={initialListingId ?? "all"} initialListingId={initialListingId} data={data} now={liveNow} busy={busy} onAsk={ask} onOpenBusiness={onOpenBusiness} onOpenMerch={onOpenMerch} onOpenShop={() => onOpenShop("COMPUTER", raw?.flowerId ?? stock?.flowerId)} onPrepareStock={browseDemandLots} /> : <div className={styles.dashboardUnavailable}><p>Le suivi des annonces en ligne n’est pas disponible dans cet atelier.</p><button className={styles.primary} onClick={browseDemandLots}>Choisir un lot <ArrowRight size={18} aria-hidden="true" /></button></div> : saleComplete ? <div className={styles.saleDone} role="status"><span className={styles.successEmblem}><Coins size={42} aria-hidden="true" /><Sparkles size={22} aria-hidden="true" /></span><small>Dans ta trésorerie</small><strong>{formatKqCash(receipt.netPayoutCents ?? 0)} versés</strong><p>{grams(receipt.units ?? 0)} vendus · {grams(receipt.remainingUnits ?? 0)} restants.</p>
        <dl className={styles.receiptAmounts}><div><dt>Recette TTC</dt><dd>{formatKqCash(receipt.payoutCents ?? 0)}</dd></div><div><dt>TVA mise de côté</dt><dd>−{formatKqCash(receipt.vatCents ?? 0)}</dd></div><div><dt>Analyses échues réglées</dt><dd>−{formatKqCash(receipt.labPaidCents ?? 0)}</dd></div><div><dt>Électricité et soins réglés</dt><dd>−{formatKqCash(receipt.electricityPaidCents ?? 0)}</dd></div>{(receipt.supplierPaidCents ?? 0) > 0 ? <div><dt>Fournisseurs échus réglés</dt><dd>−{formatKqCash(receipt.supplierPaidCents ?? 0)}</dd></div> : null}</dl>
        <CustomerFeedback receipt={receipt} />
        <p>{(receipt.remainingUnits ?? 0) > 0 ? "Le reste est conservé. Tu peux le proposer à un autre circuit." : "Tout ce produit a été vendu."}</p>
        <button className={styles.primary} onClick={() => choose((receipt.remainingUnits ?? 0) > 0 && stock ? stock.id : "")}>{(receipt.remainingUnits ?? 0) > 0 && stock ? "Vendre le reste" : "Retour aux lots"} <ArrowRight size={18} /></button>
      </div> : onlineScreen ? <KqOnlineStore key={stock?.id} data={data} selectedStockId={stock?.id} now={liveNow} busy={busy} onAsk={ask} onOpenBusiness={onOpenBusiness} onOpenShop={() => onOpenShop("COMPUTER", raw?.flowerId ?? stock?.flowerId)} /> : raw && activeProduct ? <div className={styles.preparation} data-commerce-preparation>
        <div className={styles.preparationCard}>
          <header className={styles.preparationIdentity}><h3>{raw.varietyName}</h3><p>Lot {raw.flowerId.slice(0, 8)} · Qualité actuelle : {rawSummary?.quality.value == null ? "à confirmer" : qualityScore(rawSummary.quality.value)}</p></header>
          {rawSummary && rawSummary.state !== "Prêt à vendre" && !overflowUnits ? <p role="status">{rawSummary.state} · {rawSummary.next}</p> : null}
          {overflowUnits > 0 ? <div role="status"><p className={styles.error}>{grams(overflowUnits)} n’ont pas de contenant. Range le surplus dans tes contenants disponibles ou consulte sa reprise avant de préparer le lot.</p><Link prefetch={false} href={storageHref} className={styles.primary} onClick={openStorage}>Gérer mes contenants et le surplus <ArrowRight size={18} /></Link></div> : null}
          <label className={styles.field}>Produit à préparer<span className={styles.productChoice}><select value={activeProduct.route} onChange={e => setRoute(e.target.value as KqMarketRouteCode)}>{raw.options.map(q => <option key={q.route} value={q.route}>{productName(q.route)}{q.available || q.route === "raw" || q.route === "biomass" ? "" : " · verrouillé"}</option>)}</select><ChevronDown size={18} aria-hidden="true" /></span></label>
          <KqPreparationSummary quote={activeProduct} costCents={cost} />
          {!canPrepare && !overflowUnits ? <p role="status" className={styles.error}>{activeProduct.blockedReason ?? "Ce produit ne peut pas encore être préparé."}</p> : null}
          {cost > data.cashCents ? <p role="status" className={styles.error}>Il manque {formatKqCash(cost - data.cashCents)}. Trésorerie disponible : {formatKqCash(data.cashCents)}.</p> : null}
          <button className={styles.primary} data-prepare-lot={raw.flowerId} disabled={busy || !!loadError || !canPrepare || cost > data.cashCents} onClick={askPreparation}>{cost > data.cashCents ? "Trésorerie insuffisante" : activeProduct.route === "raw" ? "Préparer les fleurs et continuer" : activeProduct.route === "biomass" ? "Préparer la biomasse et continuer" : "Transformer et continuer"} <ArrowRight size={18} aria-hidden="true" /></button>
          <details className={styles.preparationDetails} data-preparation-details><summary>Détails du produit</summary><p>{activeProduct.route === "raw" ? "Garde tes fleurs entières : aucune transformation nécessaire." : activeProduct.description}</p><p>Tu choisiras ensuite le mode de vente. Un produit transformé pourra être vendu une fois le travail terminé.</p><Image src="/placard/market-workshop-sylvain-v2.webp" width={1536} height={1024} alt="Presse, tamis et laveuse de l’atelier de Kanab Quest" sizes="(max-width: 700px) 100vw, 480px" /></details>
        </div>
        <details className={styles.preparationDetails}><summary>Récolte, qualité et stockage</summary><KqLotSummary source={{ kind: "raw", lot: raw }}><Link prefetch={false} data-commerce-open-lot-storage className={styles.back} href={storageHref} onClick={openStorage}>Stockage de cette récolte <ArrowRight size={16} aria-hidden="true" /></Link></KqLotSummary></details>
      </div> : stock && !channel ? <>
        <p>Montants estimés TTC, avant TVA et factures échues. Le versement net sera confirmé avant la vente.</p>
        {data.campaign && data.campaign.event !== "normal" ? <p className={styles.event}>{KQ_COMMERCE_EVENTS[data.campaign.event]}</p> : null}
        <div className={channelStyles.choices} aria-label="Circuits de vente">{(["cbd-shop", "wholesale", "online"] as const).map(code => {
          if (code === "online" && data.online) {
            const setup = !data.computerOwned ? `Ordinateur requis · ${formatKqCash(KQ_COMPUTER_PRICE_CENTS)}`
              : !data.online.site.createdAt ? "Boutique à ouvrir gratuitement dans Développer."
                : !data.online.site.active ? "Boutique suspendue · à réactiver dans Développer." : null;
            const onlineBlocked = Boolean(setup || stock.route === "biomass" || stock.remainingUnits < 50
              || (stock.processingReadyAt && (liveNow === undefined || Date.parse(stock.processingReadyAt) > liveNow))
              || !isKqCommerceStockMature(stock, liveNow) || (stock.storage?.capacity?.overflowUnits ?? 0) > 0
              || getKqCommerceStockQuality(stock) < getKqCommerceMinimumQuality(stock.route, "online")!);
            return <article key={code} className={channelStyles.choice} data-sales-channel={code} data-unavailable={onlineBlocked ? "true" : undefined}>
              <header className={channelStyles.heading}><Image src={KQ_CHANNELS.online.image} alt="" width={42} height={48} sizes="42px" /><div><h3>Ta boutique en ligne</h3><small>Ventes progressives, même hors connexion</small></div></header>
              <div className={channelStyles.amount}><strong>Prix libres</strong><small>Paquets de 5 ou 10 g · emballages en supplément</small></div>
              <div className={channelStyles.notes}>
                <p>{Number.isFinite(data.online.site.feePercent) ? `${data.online.site.feePercent.toLocaleString("fr-FR")} % de frais sur les ventes.` : "Frais de vente à confirmer."} Une audience à développer.</p>
                {setup ? <p className={channelStyles.warning}>{setup}</p> : null}
                {stock.remainingUnits < 50 ? <p className={channelStyles.warning}>5 g minimum pour préparer un paquet.</p> : null}
                {(stock.storage?.capacity?.overflowUnits ?? 0) > 0 ? <p className={channelStyles.warning}>Range le surplus sans contenant avant de préparer des paquets.</p> : null}
                <ChannelQuality stock={stock} channel="online" now={liveNow} />
              </div>
              <button className={channelStyles.action} onClick={() => chooseChannel(code)} aria-label="Préparer des paquets pour ma boutique en ligne">{onlineBlocked ? "Voir les conditions" : "Préparer mes paquets"}<ArrowRight size={16} aria-hidden="true" /></button>
            </article>;
          }
          const proposal = quoteKqCommerce(data, stock, code, "advised", undefined, liveNow);
          return <article key={code} className={channelStyles.choice} data-sales-channel={code} data-unavailable={proposal.reason ? "true" : undefined}>
            <header className={channelStyles.heading}><Image src={KQ_CHANNELS[code].image} alt="" width={42} height={48} sizes="42px" /><div><h3>{KQ_CHANNELS[code].name}</h3><small>Paiement immédiat à la vente</small></div></header>
            <div className={channelStyles.amount}><strong>{proposal.reason ? "Indisponible" : formatKqCash(proposal.payoutCents)}</strong>{!proposal.reason ? <><span>TTC estimés</span><small>Pour {grams(proposal.units)} sur {grams(stock.remainingUnits)}<br />{formatKqCash(Math.round(proposal.unitCents))}/g{proposal.customerDemand && proposal.customerDemand.units < proposal.units ? " en moyenne" : ""}</small></> : null}</div>
            <div className={channelStyles.notes}>
              {proposal.reason ? <p className={channelStyles.warning}>{proposal.reason}</p> : <ChannelQuality stock={stock} channel={code} now={liveNow} />}
              <p>{code === "wholesale" ? "Prix bas · aucun gain de réputation." : code === "cbd-shop" ? "Ton réseau dépend de la qualité livrée." : "Prix et quantité ajustables à l’étape suivante."}</p>
            </div>
            <button className={channelStyles.action} onClick={() => chooseChannel(code)} aria-label={`Voir l’offre ${KQ_CHANNELS[code].name}`}>{proposal.reason ? "Voir les conditions" : "Voir l’offre"}<ArrowRight size={16} aria-hidden="true" /></button>
          </article>;
        })}</div>
        <details className={channelStyles.explanation}><summary>Comprendre les montants et les commandes</summary><p>Les montants TTC précèdent la réserve de TVA et le règlement des analyses, de l’électricité, des soins et des fournisseurs échus. Le détail du versement net apparaît dans la confirmation.</p><p>Les commandes se renouvellent avec le temps et sont partagées entre tes lots. Les quantités et le délai de renouvellement se consultent dans chaque offre. Les invendus restent en stock.</p></details>
      </> : stock && offer && channel ? <div className={offerStyles.offer}>
        <div><ChannelQuality stock={stock} channel={channel} now={liveNow} />
          {offer.reason ? <><p data-sale-blocked className={styles.error}>{offer.reason}</p>
            {channel === "wholesale" || isKqCommerceStockMature(stock, liveNow) ? <DemandStatus data={data} channel={channel} offer={offer} now={liveNow} /> : null}
            {channel === "online" && !data.computerOwned ? <button className={styles.primary} onClick={() => onOpenShop("COMPUTER", raw?.flowerId ?? stock?.flowerId)}>Voir l’ordinateur dans l’Entrepôt · 450 €</button>
              : channel === "online" && data.business && !data.business.shop.active ? <Link prefetch={false} href="/arene/placard?view=market&section=management" className={styles.primary} onClick={openBusiness}>{data.business.shop.createdAt ? "Réactiver mon site" : "Créer mon site"}</Link> : null}
            {channel === "online" ? <p>Ordinateur : 450 €. Création du site : 1 000 €, premier mois inclus. Puis 100 € tous les 30 jours de jeu (5 jours réels).</p> : null}
          </> : <>
            <div className={offerStyles.quantity}>
              <label htmlFor="kq-sale-quantity">Quantité à vendre (g)</label>
              <div className={offerStyles.inputRow}>
                <input id="kq-sale-quantity" type="number" inputMode="decimal" min="0.1" step="0.1" max={offer.maxUnits / 10} value={quantity ?? String(offer.maxUnits / 10)} onChange={e => setQuantity(e.target.value)} aria-invalid={inputInvalid} aria-describedby="kq-sale-quantity-help" disabled={busy} />
                <button type="button" disabled={busy} onClick={() => setQuantity(null)}>Maximum</button>
              </div>
              <p id="kq-sale-quantity-help" className={inputInvalid ? styles.error : undefined}>{inputInvalid ? `Choisis une quantité entre 0,1 et ${grams(offer.maxUnits)}, par pas de 0,1 g.` : `${grams(offer.maxUnits)} maximum pour ce lot et les commandes disponibles.`}</p>
            </div>
            {channel === "online" ? <details className={styles.adjustments}><summary>Ajuster mon prix</summary><fieldset className={styles.prices}><legend>Ton prix</legend>{(["discovery", "advised", "premium"] as const).map(value => <button key={value} aria-pressed={policy === value} onClick={() => { setPolicy(value); setQuantity(null); }}>{value === "discovery" ? "Découverte · −10 %" : value === "premium" ? "Ambitieux · +22 %" : "Prix conseillé"}</button>)}</fieldset></details> : null}
            {!inputInvalid ? <>
              <div data-sale-estimate className={offerStyles.estimate}>
                <div className={offerStyles.amount}><span>Estimation TTC</span><strong>{formatKqCash(offer.payoutCents)}</strong><small>{formatKqCash(Math.round(offer.unitCents))}/g{offer.customerDemand && offer.customerDemand.units < offer.units ? " en moyenne" : ""}</small></div>
                <KqAllocationBar label="Répartition prévue" items={[
                  { label: "À vendre", value: offer.units / 10, displayValue: grams(offer.units), tone: "teal" },
                  { label: "Restera en stock", value: (stock.remainingUnits - offer.units) / 10, displayValue: grams(stock.remainingUnits - offer.units), tone: "gold" },
                ]} />
              </div>
              <p>{channel === "wholesale" ? "Cette vente ne rapporte pas de réputation." : channel === "cbd-shop" && data.online && stock.route === "raw" ? "La qualité des livraisons fait évoluer ton réseau de boutiques." : offer.message}</p>
              {offer.customerDemand ? <p className={offerStyles.bonus}><Sparkles size={16} aria-hidden="true" /><span>Demande du moment : +{offer.customerDemand.bonusPercent.toLocaleString("fr-FR")} % sur {grams(offer.customerDemand.units)}. {offer.customerDemand.units < offer.units ? "Le reste est repris au tarif habituel ; le prix au gramme est une moyenne." : "La prime est déjà comprise dans cette estimation."}</span></p> : null}
            </> : null}
            <small className={offerStyles.netNote}>La réserve de TVA et les factures échues sont déduites avant le versement. Tu verras le montant net avant de confirmer.</small>
            <button data-sale-review disabled={busy || inputInvalid || offer.units <= 0 || Boolean(loadError && !pendingSale)} className={styles.primary} onClick={() => void examineSale()}>{busy ? "Calcul…" : "Voir le montant net"} <ArrowRight size={18} aria-hidden="true" /></button>
          </>}
        </div>
        <details data-sale-conditions className={offerStyles.conditions}><summary>Commandes et fonctionnement</summary>
          <p>{channelTradeoffs[channel].advantage} {channelTradeoffs[channel].drawback}</p>
          {!offer.reason && (channel === "wholesale" || isKqCommerceStockMature(stock, liveNow)) ? <DemandStatus data={data} channel={channel} offer={offer} now={liveNow} /> : null}
          {channel === "online" ? <p>Au plus {data.strength === "merchant" ? 7 : 5} nouveaux clients par période de 24 heures réelles, selon les volumes et la qualité livrés.</p> : null}
          <Image src={KQ_CHANNELS[channel].image} alt="" width={1200} height={800} sizes="(max-width: 700px) 100vw, 620px" />
        </details>
          {channel === "cbd-shop" && data.online && stock.route === "raw" ? <details className={offerStyles.conditions}><summary>Tarif indoor des shops · 3 €/g</summary><p>Les fleurs entières mûres sont reprises à 3 €/g TTC, soit 3 000 €/kg, dès 6,5/10. Paiement immédiat, dans la limite des commandes disponibles.</p><ul className={styles.shopScale}><li><strong>3 €/g · tarif professionnel</strong><span>Base des fleurs indoor commercialisables</span></li><li><strong>Jusqu’à +25 % · arômes recherchés</strong><span>Un arôme commun donne la moitié de la prime ; deux donnent la prime complète, sur le volume demandé et à la qualité requise</span></li><li><strong>2,10 €/g · grossistes</strong><span>30 % sous le tarif shop, hors prime temporaire</span></li></ul><p>Le réseau de {data.shopPartners ?? 0} boutiques développe tes volumes de reprise. La qualité des livraisons fidélise les partenaires. Le hash et le rosin gardent leurs propres barèmes.</p></details> : channel === "cbd-shop" ? <details className={offerStyles.conditions}><summary>Barème des boutiques · {offer.shopPricePercent} % de reprise</summary>
            <p>{data.shopPartners ?? 0} boutiques partenaires · Bonus sur cette période : +{getKqShopNetworkBonus(data.campaign?.shopPartnersStart ?? data.shopPartners ?? 0)} points sur la reprise.</p>
            <ul className={styles.shopScale}>{KQ_SHOP_QUALITY_BANDS.map((band, index) => <li key={band.label}><strong>{qualityScore(stock.route === "raw" ? band.flowerMinimum : band.extractMinimum)}{index === KQ_SHOP_QUALITY_BANDS.length - 1 ? " et plus" : ` à moins de ${qualityScore(stock.route === "raw" ? KQ_SHOP_QUALITY_BANDS[index + 1].flowerMinimum : KQ_SHOP_QUALITY_BANDS[index + 1].extractMinimum)}`} · {band.pricePercent} %</strong><span>{band.recruitmentWeight ? `1 partenaire par ${band.recruitmentWeight === 4 ? "150" : "200"} g équivalents livrés` : band.churnWeight ? "1 partenaire perdu par 100 g équivalents livrés" : "Réseau stable"}</span></li>)}</ul>
            {data.strength === "merchant" ? <p>Les seuils ci-dessus sont indiqués sans bonus Commercial : ton recrutement progresse 50 % plus vite.</p> : null}
            <p>20 partenaires maximum. Au plus {data.strength === "merchant" ? 2 : 1} nouveau{data.strength === "merchant" ? "x" : ""} partenaire{data.strength === "merchant" ? "s" : ""} par période de 24 heures réelles{data.strength === "merchant" ? ", selon la progression reportée" : ""} ; départs limités à 25 % du réseau de début de période, arrondis au supérieur. Les petites livraisons s’additionnent. Pour le hash et le rosin, le volume est ramené à la quantité de fleurs utilisée.</p>
            <p>Bonus réseau : +1 point dès 1 boutique, +2 dès 4, +3 dès 8, +4 dès 12. Sans partenaire, tu peux toujours prospecter. Le bonus réseau et la capacité sont réévalués toutes les 24 heures. Terminer une culture ne renouvelle pas les commandes.</p>
          </details> : null}
      </div> : data.rawLots.length || data.stocks.length ? <>
        <p>Le verdict du jury ouvre la vente. Si un lot autorisé à la vente est encore en affinage, seul le grossiste peut le reprendre.</p>
        <div className={styles.inventory}>
        <div className={styles.inventoryArt} aria-hidden="true"><Image src="/placard/market-workshop-sylvain-v2.webp" alt="" width={1536} height={1024} sizes="(max-width: 700px) 100vw, 540px" /><span><PackageOpen size={18} /> Ta réserve</span></div>
        <div className={styles.lotList} aria-label="Tes lots">
          {data.rawLots.map(item => <button key={item.flowerId} onClick={() => choose(`raw:${item.flowerId}`)}><span className={styles.lotIcon}><Leaf size={24} aria-hidden="true" /></span><span className={styles.lotText}><strong>{item.varietyName}</strong><small>{item.harvestGrams.toLocaleString("fr-FR")} g · Jury : {qualityScore(item.juryScore)}</small><KqStorageStatus flowerStatus="burned" storage={item.storage} nowMs={liveNow} compact /></span><span>Préparer ou vendre <ArrowRight size={18} /></span></button>)}
          {data.stocks.map(item => <button key={item.id} onClick={() => choose(item.id)}><span className={styles.lotIcon}><PackageOpen size={24} aria-hidden="true" /></span><span className={styles.lotText}><strong>{item.name}</strong><small>{productName(item.route)} · {grams(item.remainingUnits)} · Qualité commerciale {qualityScore(getKqCommerceStockQuality(item))} · Déjà préparé</small><KqStorageStatus flowerStatus="burned" storage={item.storage} nowMs={liveNow} compact /></span><span>Vendre <ArrowRight size={18} /></span></button>)}
        </div></div>
      </> : <KqCommerceEmptyState data={data} onOpenStorage={onOpenStorage} onOpenCulture={onOpenCulture} onViewSales={() => changeMode("dashboard")} />}
    </section> : null}
    {data && !dashboard && screen === "lots" ? <KqCommerceOverview data={data} onOpenShop={() => onOpenShop()} /> : null}
    {confirmation ? <Confirm confirmation={confirmation} busy={busy} error={error} now={liveNow} onRequote={() => void examineSale(confirmation)} onClose={() => { if (!busy) { setConfirmation(null); setError(""); } }} onConfirm={() => void commit()} /> : null}
  </main>;
}
