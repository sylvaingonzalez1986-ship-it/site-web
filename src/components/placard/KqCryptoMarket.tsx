"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowDownLeft, ArrowUpRight, ChartNoAxesCombined, RefreshCw, Search, Wallet, X } from "lucide-react";
import { formatKqCryptoQuantity, getKqCryptoRefreshDelayMs, isKqCryptoOrder, isKqCryptoQuoteFresh, isKqCryptoSnapshot, isKqCryptoTrade, isRecord, parseKqCryptoEuros, type KqCryptoAsset, type KqCryptoOrder, type KqCryptoSnapshot } from "@/lib/kanab-quest-crypto";
import styles from "./KqCryptoMarket.module.css";
const euros = (cents: number) => (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const price = (value: string) => Number(value).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: Number(value) < 1 ? 18 : 2 });
const quantityLabel = formatKqCryptoQuantity;
const dateLabel = (value: string) => new Date(value).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
function CryptoLogo({ asset }: { asset: Pick<KqCryptoAsset, "id" | "symbol"> }) {
 const [failedId, setFailedId] = useState<number | null>(null);
 const hasLogo = Number.isSafeInteger(asset.id) && asset.id > 0 && failedId !== asset.id;
 return <span className={styles.coin} aria-hidden="true" data-crypto-logo={asset.id}>
  {hasLogo ? <Image src={`https://s2.coinmarketcap.com/static/img/coins/64x64/${asset.id}.png`} width={64} height={64} alt="" unoptimized loading="lazy" onError={() => setFailedId(asset.id)} /> : <span className={styles.coinFallback}>{asset.symbol}</span>}
 </span>;
}
export function KqCryptoMarket({ onWalletRefresh }: { onWalletRefresh?: () => void } = {}) {
 const [data, setData] = useState<KqCryptoSnapshot | null>(null);
 const [error, setError] = useState("");
 const [orderError, setOrderError] = useState("");
 const dialog = useRef<HTMLDialogElement>(null);
 const orderTrigger = useRef<HTMLButtonElement | null>(null);
 const [message, setMessage] = useState("");
 const [loading, setLoading] = useState(false);
 const [busy, setBusy] = useState(false);
 const [tab, setTab] = useState<"market" | "portfolio">("market");
 const [search, setSearch] = useState("");
 const [page, setPage] = useState(0);
 const [selected, setSelected] = useState<{ asset: KqCryptoAsset; side: "buy" | "sell" } | null>(null);
 const [amount, setAmount] = useState("100");
 const [quantity, setQuantity] = useState("");
 const [order, setOrder] = useState<KqCryptoOrder | null>(null);
 const [confirmAttempted, setConfirmAttempted] = useState(false);
 const [clock, setClock] = useState(() => Date.now());
 const [serverOffset, setServerOffset] = useState(0);
 const mutationInFlight = useRef(false);
 const loadVersion = useRef(0);
 const cashCentsRef = useRef<number | null>(null);
 const notifyingWallet = useRef(false);
 const reload = useCallback(async (signal?: AbortSignal) => {
  if (mutationInFlight.current) return;
  const version = ++loadVersion.current;
  setLoading(true);
  try {
   const response = await fetch("/api/arena/placard/crypto", { cache: "no-store", signal });
   const body: unknown = await response.json();
   if (!response.ok || !isKqCryptoSnapshot(body)) throw new Error(isRecord(body) && typeof body.error === "string" ? body.error : "Le marché crypto est indisponible.");
   if (!signal?.aborted && version === loadVersion.current && !mutationInFlight.current) {
    const cashChanged = cashCentsRef.current !== null && cashCentsRef.current !== body.cashCents;
    cashCentsRef.current = body.cashCents;
    setData(body); setServerOffset(Date.parse(body.serverNow) - Date.now()); setError("");
    if (cashChanged) {
     // A polling read can settle due loan instalments. Notify the other panels
     // after updating our reference, without fetching our own snapshot again.
     notifyingWallet.current = true;
     try { window.dispatchEvent(new Event("kq:equipment-updated")); window.dispatchEvent(new Event("kq:treasury-updated")); }
     finally { notifyingWallet.current = false; }
    }
   }
  } catch (cause) { if (!signal?.aborted && version === loadVersion.current && !mutationInFlight.current) setError(cause instanceof Error ? cause.message : "Le marché crypto est indisponible."); }
  finally { if (version === loadVersion.current && !mutationInFlight.current) setLoading(false); }
 }, []);
 useEffect(() => { const controller = new AbortController(); void reload(controller.signal);
  const update = () => { if (!notifyingWallet.current && !document.hidden && !dialog.current?.open) void reload(controller.signal); };
  const resume = () => { if (!document.hidden && !dialog.current?.open) { setClock(Date.now()); void reload(controller.signal); } };
  window.addEventListener("kq:equipment-updated", update);
  window.addEventListener("focus", resume);
  document.addEventListener("visibilitychange", resume);
  return () => { controller.abort(); window.removeEventListener("kq:equipment-updated", update); window.removeEventListener("focus", resume); document.removeEventListener("visibilitychange", resume); };
 }, [reload]);
 useEffect(() => {
  if (selected || busy) return;
  const controller = new AbortController();
  let timeout: number;
  const schedule = () => {
   if (controller.signal.aborted) return;
   timeout = window.setTimeout(async () => {
    if (!document.hidden && !dialog.current?.open && !mutationInFlight.current) await reload(controller.signal);
    schedule();
   }, getKqCryptoRefreshDelayMs(data, Date.now() + serverOffset));
  };
  schedule();
  return () => { controller.abort(); window.clearTimeout(timeout); };
 }, [data, reload, selected, busy, serverOffset]);
 useEffect(() => { const interval = window.setInterval(() => setClock(Date.now()), 1000); return () => window.clearInterval(interval); }, []);
 useEffect(() => {
  if (!selected) return;
  const element = dialog.current;
  if (!element) return;
  const rootOverflow = document.documentElement.style.overflow;
  const bodyOverflow = document.body.style.overflow;
  const scrollbarGap = window.innerWidth - document.documentElement.clientWidth;
  const bodyPadding = document.body.style.paddingRight;
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
  if (scrollbarGap > 0) document.body.style.paddingRight = `${parseFloat(getComputedStyle(document.body).paddingRight) + scrollbarGap}px`;
  element.showModal();
  return () => {
   element.close();
   document.documentElement.style.overflow = rootOverflow;
   document.body.style.overflow = bodyOverflow;
   document.body.style.paddingRight = bodyPadding;
  };
 }, [selected]);
 useEffect(() => {
  if (!selected) return;
  const element = dialog.current;
  if (busy) { element?.focus({ preventScroll: true }); return; }
  if (!order) element?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
  else if (document.activeElement === element || !element?.contains(document.activeElement)) {
   const confirmButton = element?.querySelector<HTMLButtonElement>("[data-crypto-confirm]");
   (confirmButton && !confirmButton.disabled ? confirmButton : element)?.focus({ preventScroll: true });
  }
 }, [selected, order, busy]);
 useEffect(() => {
  if (!selected && !busy && orderTrigger.current) {
   const trigger = orderTrigger.current;
   const target = trigger.isConnected && !trigger.disabled ? trigger : document.getElementById(`crypto-${tab}-tab`);
   target?.focus({ preventScroll: true });
   orderTrigger.current = null;
  }
 }, [selected, busy, tab]);
 function closeOrder() {
  if (mutationInFlight.current) return;
  setSelected(null); setOrder(null); setConfirmAttempted(false); setOrderError("");
 }
 const now = clock + serverOffset;
 const positionFor = (assetId: number) => data?.positions.find(p => p.assetId === assetId);
 const canTrade = (asset: KqCryptoAsset) => Boolean(data && ["live", "stale"].includes(data.marketStatus) && isKqCryptoQuoteFresh(asset.quotedAt, now));
 const select = (asset: KqCryptoAsset, side: "buy" | "sell", trigger: HTMLButtonElement) => {
  orderTrigger.current = trigger; setOrderError("");
  setSelected({ asset, side }); setOrder(null); setConfirmAttempted(false); setQuantity(positionFor(asset.id)?.quantity ?? "");
 };
 async function preview() {
  if (!selected || mutationInFlight.current) return;
  const amountCents = parseKqCryptoEuros(amount);
  if (selected.side === "buy" && amountCents === null) { setOrderError("Entre un montant entre 1 € et 1 000 000 €, avec deux décimales au maximum."); return; }
  mutationInFlight.current = true; ++loadVersion.current; setLoading(false);
  setBusy(true); setOrderError("");
  try {
   const response = await fetch("/api/arena/placard/crypto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "preview", side: selected.side, assetId: selected.asset.id, ...(selected.side === "buy" ? { amountCents } : { quantity: quantity.replace(",", ".") }) }) });
   const body: unknown = await response.json();
   if (!response.ok || !isKqCryptoOrder(body)) throw new Error(isRecord(body) && typeof body.error === "string" ? body.error : "L’ordre n’a pas pu être préparé.");
   setOrder(body); setConfirmAttempted(false);
  } catch (cause) { setOrderError(cause instanceof Error ? cause.message : "L’ordre n’a pas pu être préparé."); }
  finally { mutationInFlight.current = false; setBusy(false); }
 }
 async function confirm() {
  if (!order || mutationInFlight.current) return;
  mutationInFlight.current = true; ++loadVersion.current; setLoading(false);
  setBusy(true); setConfirmAttempted(true); setOrderError("");
  try {
   const response = await fetch("/api/arena/placard/crypto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "confirm", orderId: order.orderId }) });
   const body: unknown = await response.json();
   if (!response.ok || !isRecord(body) || !isKqCryptoTrade(body.trade)) throw new Error(isRecord(body) && typeof body.error === "string" ? body.error : "Confirmation non reçue. Réessaie cet ordre pour vérifier son exécution.");
   setMessage(`${body.trade.side === "buy" ? "Achat" : "Vente"} enregistré : ${euros(body.trade.amountCents)} de jeu.`);
   setOrder(null); setSelected(null); setConfirmAttempted(false);
   cashCentsRef.current = body.trade.cashAfterCents;
   window.dispatchEvent(new Event("kq:equipment-updated")); window.dispatchEvent(new Event("kq:treasury-updated")); onWalletRefresh?.(); mutationInFlight.current = false; await reload();
  } catch (cause) { setOrderError(cause instanceof Error ? cause.message : "Confirmation non reçue. Réessaie cet ordre."); }
  finally { mutationInFlight.current = false; setBusy(false); }
 }
 const rows = data?.assets.filter(asset => asset.inTop100 && `${asset.name} ${asset.symbol}`.toLocaleLowerCase("fr").includes(search.toLocaleLowerCase("fr"))) ?? [];
 const pages = Math.max(1, Math.ceil(rows.length / 10));
 const secondsLeft = order ? Math.max(0, Math.ceil((Date.parse(order.expiresAt) - now) / 1000)) : 0;
 const totalValue = data?.positions.every(p => p.valueCents !== null) ? data.positions.reduce((sum, p) => sum + (p.valueCents ?? 0), 0) : null;
 return <section className={styles.market} aria-label="Comptoir crypto" data-testid="crypto-market">
  <header className={styles.header}><div className={styles.icon}><ChartNoAxesCombined size={36} aria-hidden="true" /></div><div><small>Les placements du placard</small><h3>Le comptoir crypto</h3><p>Les vrais cours. Ton argent de jeu.</p></div><span className={styles.stamp}>TOP 100<br />COINMARKETCAP</span></header>
  <p className={styles.disclaimer}>Portefeuille virtuel : tu places uniquement tes euros de jeu. Les cours réels en euros peuvent monter ou baisser ; aucun achat de cryptomonnaie réelle.</p>
  <div className={styles.status}><span><i data-live={data?.marketStatus === "live"} />{data?.marketStatus === "live" ? "Cours disponibles" : data?.marketStatus === "stale" ? "Derniers cours connus · certaines opérations suspendues" : "Connexion au marché en attente"}{data?.updatedAt ? <small>Actualisé le {dateLabel(data.updatedAt)} · relevé toutes les 5 min</small> : null}</span><button type="button" aria-label="Actualiser les cours crypto" disabled={loading || busy} onClick={() => void reload()}><RefreshCw size={16} aria-hidden="true" /> {loading ? "Actualisation…" : "Actualiser"}</button></div>
  {error ? <p role="alert" className={styles.error}>{error}</p> : null}
  {message ? <p role="status" className={styles.success}>{message}</p> : null}
  {!data && loading ? <p role="status">Connexion au comptoir…</p> : null}
  {data ? <><div className={styles.summary}><div><small>Disponible</small><strong>{euros(data.cashCents)}</strong></div><div><small>Valeur du portefeuille</small><strong>{totalValue === null ? "Cours à actualiser" : euros(totalValue)}</strong></div><div><small>Montant investi</small><strong>{euros(data.positions.reduce((sum, p) => sum + p.costBasisCents, 0))}</strong></div></div>
   {data.marketStatus !== "live" ? <p role="status" className={styles.empty}>{data.refresh?.refreshing ? "Actualisation des cours en cours." : <>{data.refresh?.lastFailureCode === "rate_limited" ? "Le fournisseur demande une pause." : data.marketStatus === "stale" && !data.refresh?.lastFailureCode ? "Certains cours sont en attente d’actualisation." : "Le fournisseur de cours ne répond pas pour le moment."} Nouvelle tentative automatique{data.refresh?.nextAttemptAt ? ` le ${dateLabel(data.refresh.nextAttemptAt)}` : " dans quelques instants"}.</>} Tes positions restent consultables ; les échanges suspendus reprendront automatiquement dès réception de cours récents.</p> : null}
   <div className={styles.tabs} role="tablist" onKeyDown={event => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault(); const next = event.key === "Home" ? "market" : event.key === "End" ? "portfolio" : tab === "market" ? "portfolio" : "market";
    setTab(next); document.getElementById(`crypto-${next}-tab`)?.focus();
   }} aria-label="Consultation du marché crypto"><button role="tab" aria-selected={tab === "market"} tabIndex={tab === "market" ? 0 : -1} aria-controls="crypto-market-list" id="crypto-market-tab" type="button" onClick={() => setTab("market")}>Marché · Top 100</button><button role="tab" aria-selected={tab === "portfolio"} tabIndex={tab === "portfolio" ? 0 : -1} aria-controls="crypto-portfolio-list" id="crypto-portfolio-tab" type="button" onClick={() => setTab("portfolio")}><Wallet size={16} aria-hidden="true" /> Mes positions ({data.positions.length})</button></div>
   {tab === "market" ? <div role="tabpanel" id="crypto-market-list" aria-labelledby="crypto-market-tab"><label className={styles.search}><Search size={17} aria-hidden="true" /><input type="search" placeholder="Bitcoin, ETH…" aria-label="Rechercher une crypto" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} /></label>
    <div className={styles.listHeading} aria-hidden="true"><span>#</span><span>Cryptomonnaie</span><span>Cours · variation 24 h</span><span>Placement</span></div>
    <div className={styles.list}>{rows.slice(Math.min(page, pages - 1) * 10, (Math.min(page, pages - 1) + 1) * 10).map(asset => <div key={asset.id} className={styles.row}><span className={styles.rank}>#{asset.rank}</span><div className={styles.asset}><CryptoLogo asset={asset} /><span><strong>{asset.name}</strong><small>{asset.symbol}</small></span></div><div className={styles.quote}><strong>{price(asset.priceEur)}</strong><small data-positive={(asset.change24h ?? 0) >= 0}>{asset.change24h === null ? "—" : `${asset.change24h >= 0 ? "+" : ""}${asset.change24h.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`} / 24 h</small></div><button type="button" disabled={busy || Boolean(order) || !canTrade(asset)} onClick={event => select(asset, "buy", event.currentTarget)} aria-label={`Acheter ${asset.name}`}><ArrowDownLeft size={16} aria-hidden="true" /> Acheter</button></div>)}</div>
    {!rows.length ? <p className={styles.empty}>{data.assets.length ? "Aucune crypto ne correspond à ta recherche." : "Les 100 premières cryptos apparaîtront dès réception des cours."}</p> : null}
    {pages > 1 ? <nav className={styles.pagination} aria-label="Pages des cryptomonnaies"><button type="button" disabled={page <= 0} onClick={() => setPage(p => p - 1)}>Précédent</button><span>{Math.min(page + 1, pages)} / {pages}</span><button type="button" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}>Suivant</button></nav> : null}
   </div> : <div role="tabpanel" id="crypto-portfolio-list" aria-labelledby="crypto-portfolio-tab" className={styles.positions}>{data.positions.length ? data.positions.map(position => { const asset = data.assets.find(a => a.id === position.assetId); if (!asset) return null; const pnl = position.valueCents === null ? null : position.valueCents - position.costBasisCents; return <article key={position.assetId} className={styles.position}><header><div className={styles.asset}><CryptoLogo asset={asset} /><span><strong>{asset.name}</strong><small>{quantityLabel(position.quantity)} {asset.symbol}{!asset.inTop100 ? " · hors top 100" : ""}</small></span></div><button type="button" disabled={busy || Boolean(order) || !canTrade(asset)} onClick={event => select(asset, "sell", event.currentTarget)} aria-label={`Vendre ${asset.name}`}><ArrowUpRight size={15} aria-hidden="true" /> Vendre</button></header><dl><div><dt>Coût d’achat</dt><dd>{euros(position.costBasisCents)}</dd></div><div><dt>Valeur actuelle</dt><dd>{position.valueCents === null ? "Cours à actualiser" : euros(position.valueCents)}</dd></div><div><dt>Gain / perte latent</dt><dd data-positive={(pnl ?? 0) >= 0}>{pnl === null ? "—" : `${pnl > 0 ? "+" : ""}${euros(pnl)}`}</dd></div></dl></article>; }) : <p className={styles.empty}>Ton portefeuille est vide. Choisis une crypto dans le marché pour préparer ton premier placement.</p>}</div>}
   {selected ? <dialog ref={dialog} id="crypto-order-dialog" className={styles.order} aria-labelledby="crypto-order-title" aria-describedby="crypto-order-description" data-testid="crypto-order" tabIndex={-1} onCancel={event => { event.preventDefault(); closeOrder(); }} onKeyDown={event => {
     if (event.key !== "Tab") return;
     const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href],[tabindex="0"]')].filter(element => element.getClientRects().length > 0);
     const first = focusable[0], last = focusable.at(-1);
     if (!first) { event.preventDefault(); event.currentTarget.focus({ preventScroll: true }); }
     else if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last?.focus({ preventScroll: true }); }
     else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus({ preventScroll: true }); }
    }}>
    <header className={styles.orderHeader}><div className={styles.orderIdentity}><CryptoLogo asset={selected.asset} /><div><small>{order ? "02 / Confirmer le placement" : "01 / Préparer le placement"}</small><h4 id="crypto-order-title">{selected.side === "buy" ? "Acheter" : "Vendre"} {selected.asset.name}</h4></div></div><button type="button" className={styles.close} aria-label="Fermer la fenêtre crypto" disabled={busy} onClick={closeOrder}><X size={22} aria-hidden="true" /></button></header>
    <div className={styles.orderBody} aria-busy={busy}>
     <p id="crypto-order-description">{selected.side === "buy" ? "Place tes euros de jeu. Tu confirmes le montant avant tout achat." : "Revends tes cryptos pour récupérer des euros de jeu."}</p>
     {orderError ? <p role="alert" className={styles.error}>{orderError}</p> : null}
     {!order ? <form onSubmit={event => { event.preventDefault(); void preview(); }}>
      <div className={styles.orderContext}><span>Cours indicatif<strong>{price(selected.asset.priceEur)}</strong></span><span>{selected.side === "buy" ? "Disponible" : "Ta position"}<strong>{selected.side === "buy" ? euros(data.cashCents) : `${quantityLabel(positionFor(selected.asset.id)?.quantity ?? "0")} ${selected.asset.symbol}`}</strong></span></div>
      <label htmlFor="crypto-order-amount">{selected.side === "buy" ? "Montant en euros de jeu" : `Quantité de ${selected.asset.symbol}`}<div className={styles.amountField}><input id="crypto-order-amount" inputMode="decimal" value={selected.side === "buy" ? amount : quantity} onChange={event => selected.side === "buy" ? setAmount(event.target.value) : setQuantity(event.target.value)} disabled={busy} aria-describedby="crypto-amount-help" /><span aria-hidden="true">{selected.side === "buy" ? "€" : selected.asset.symbol}</span></div></label>
      <small id="crypto-amount-help">Le cours exact et le montant total apparaîtront avant ta confirmation.</small>
      <div className={styles.actions}><button type="submit" disabled={busy}>{busy ? "Préparation…" : "Préparer l’offre"}</button><button type="button" disabled={busy} onClick={closeOrder}>Annuler</button></div>
     </form> : <div>
      <dl className={styles.orderTotals}><div><dt>Quantité</dt><dd>{quantityLabel(order.quantity)} {selected.asset.symbol}</dd></div><div><dt>Cours bloqué</dt><dd>{price(order.priceEur)}</dd></div><div className={styles.orderTotal}><dt>{order.side === "buy" ? "À débiter" : "À recevoir"}</dt><dd>{euros(order.amountCents)}<small>euros de jeu</small></dd></div></dl>
      <p className={styles.expiry} data-expired={secondsLeft === 0}>Cours du {dateLabel(order.quotedAt)}.<br />{secondsLeft > 0 ? `Offre valable encore ${secondsLeft} s. Le montant confirmé sera exactement celui affiché.` : "Offre expirée : prépare une nouvelle offre."}</p>
      <div className={styles.actions}><button type="button" data-crypto-confirm disabled={busy || (secondsLeft === 0 && !confirmAttempted)} onClick={() => void confirm()}>{busy ? "Confirmation…" : confirmAttempted ? "Vérifier / réessayer cet ordre" : `Confirmer ${order.side === "buy" ? "l’achat" : "la vente"}`}</button><button type="button" disabled={busy} onClick={() => { setOrder(null); setConfirmAttempted(false); setOrderError(""); }}>Modifier l’ordre</button></div>
      {confirmAttempted ? <small>En cas de réponse perdue, réessaie le même ordre : il ne sera exécuté qu’une seule fois.</small> : null}
     </div>}
    </div>
   </dialog> : null}
   {data.recentTrades.length ? <details className={styles.history}><summary>Les derniers mouvements ({data.recentTrades.length})</summary>{data.recentTrades.map(trade => <div key={trade.orderId}><span>{trade.side === "buy" ? "Achat" : "Vente"} {data.assets.find(a => a.id === trade.assetId)?.symbol ?? `#${trade.assetId}`}<small>{dateLabel(trade.createdAt)}</small></span><strong>{euros(trade.amountCents)}</strong></div>)}</details> : null}
  </> : null}
  <footer className={styles.source}>Cours EUR fournis par <a href="https://coinmarketcap.com/" target="_blank" rel="noreferrer">CoinMarketCap</a>. Valeurs arrondies à l’affichage. Les gains et pertes réalisés rejoignent ta comptabilité.</footer>
 </section>;
}
