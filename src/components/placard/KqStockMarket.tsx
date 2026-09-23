"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ChartNoAxesCombined, Clock3, RefreshCw, Search, Wallet, X } from "lucide-react";
import { KQ_STOCK_INSTRUMENTS, canTradeKqStockAsset, formatKqStockQuantity, isKqStockOrder, isKqStockSnapshot, isKqStockTrade, isRecord, parseKqStockEuros, type KqStockAsset, type KqStockOrder, type KqStockSnapshot } from "@/lib/kanab-quest-stocks";
import stockCatalog from "@/lib/stock-market-catalog.json";
import styles from "./KqStockMarket.module.css";

const euros = (cents: number) => (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const price = (value: string, currency = "EUR") => Number(value).toLocaleString("fr-FR", { style: "currency", currency, maximumFractionDigits: Number(value) < 1 ? 8 : 2 });
const date = (value: string) => new Date(value).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
type Instrument = (typeof KQ_STOCK_INSTRUMENTS)[number];
type StockTab = "cac40" | "sp500" | "portfolio";
const cacSource = stockCatalog.sources.find(source => source.type === "index-constituents");
const usSource = stockCatalog.sources.find(source => source.type === "tracking-fund-holdings");
const TABS = [{ id: "cac40", label: "CAC 40" }, { id: "sp500", label: "S&P 500" }, { id: "portfolio", label: "Mes positions" }] as const;

function StockBadge({ instrument }: { instrument: Instrument }) {
  return <span className={styles.badge} data-country={instrument.currency === "USD" ? "US" : "EU"} aria-hidden="true">{instrument.kind === "index" ? <ChartNoAxesCombined size={22} /> : <strong>{instrument.symbol.replace(/\.[A-Z]+$/, "").slice(0, 3)}</strong>}<small>{instrument.currency === "USD" ? "US" : "EU"}</small></span>;
}

function StockQuote({ asset, now }: { asset: KqStockAsset | undefined; now: number }) {
  if (!asset || asset.priceNative === null || asset.priceEur === null) return <div className={styles.quote}><strong>Cours à actualiser</strong><small>Aucune opération disponible</small></div>;
  return <div className={styles.quote}>
    <strong>{asset.kind === "index" ? `${Number(asset.priceNative).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} points` : price(asset.priceNative, asset.currency)}</strong>
    {asset.currency === "USD" || asset.kind === "index" ? <span>{asset.kind === "index" ? "Part virtuelle" : "En euros"} : {price(asset.priceEur)}</span> : null}
    <small data-positive={(asset.changePercent ?? 0) >= 0}>{asset.changePercent === null ? "Variation indisponible" : `${asset.changePercent >= 0 ? "+" : ""}${asset.changePercent.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`}</small>
    <span className={styles.quoteDate}>{asset.quotedAt ? date(asset.quotedAt) : "Heure du cours indisponible"}{asset.marketState === "closed" ? " · marché fermé" : asset.marketState === "open" ? " · marché ouvert" : ""}</span>
    {!canTradeKqStockAsset(asset, now) ? <span className={styles.quoteWarning}>Actualisation nécessaire</span> : null}
  </div>;
}

export function KqStockMarket({ onWalletRefresh }: { onWalletRefresh?: () => void } = {}) {
  const [data, setData] = useState<KqStockSnapshot | null>(null);
  const [tab, setTab] = useState<StockTab>("cac40");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [orderError, setOrderError] = useState("");
  const [selected, setSelected] = useState<{ asset: KqStockAsset; side: "buy" | "sell" } | null>(null);
  const [amount, setAmount] = useState("100");
  const [quantity, setQuantity] = useState("");
  const [order, setOrder] = useState<KqStockOrder | null>(null);
  const [confirmAttempted, setConfirmAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const [serverOffset, setServerOffset] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const orderTrigger = useRef<HTMLButtonElement | null>(null);
  const mutationInFlight = useRef(false);
  const loadVersion = useRef(0);
  const cashCentsRef = useRef<number | null>(null);
  const notifyingWallet = useRef(false);
  const market = tab === "sp500" ? "sp500" : "cac40";
  const index = KQ_STOCK_INSTRUMENTS.find(instrument => instrument.kind === "index" && instrument.markets.includes(market));
  const instruments = KQ_STOCK_INSTRUMENTS.filter(instrument => instrument.kind === "stock" && instrument.markets.includes(market) && normalized(`${instrument.name} ${instrument.symbol}`).includes(normalized(debouncedSearch)));
  const pages = Math.max(1, Math.ceil(instruments.length / 10));
  const visible = instruments.slice(Math.min(page, pages - 1) * 10, (Math.min(page, pages - 1) + 1) * 10);
  const positionPages = Math.max(1, Math.ceil((data?.positions.length ?? 0) / 10));
  const visiblePositions = data?.positions.slice(Math.min(page, positionPages - 1) * 10, (Math.min(page, positionPages - 1) + 1) * 10) ?? [];
  const requestedIds = (tab === "portfolio" ? visiblePositions.map(position => position.assetId) : [...(index ? [index.id] : []), ...visible.map(instrument => instrument.id)]).join(",");
  const reload = useCallback(async (signal?: AbortSignal) => {
    if (mutationInFlight.current) return;
    const version = ++loadVersion.current;
    setLoading(true);
    try {
      const query = `?${new URLSearchParams({ ids: requestedIds })}`;
      const response = await fetch(`/api/arena/placard/stocks${query}`, { cache: "no-store", signal });
      const body: unknown = await response.json();
      if (!response.ok || !isKqStockSnapshot(body)) throw new Error(isRecord(body) && typeof body.error === "string" ? body.error : "Le comptoir boursier ne répond pas. Réessaie dans un instant.");
      if (!signal?.aborted && version === loadVersion.current && !mutationInFlight.current) {
        const cashChanged = cashCentsRef.current !== null && cashCentsRef.current !== body.cashCents;
        cashCentsRef.current = body.cashCents;
        setData(body); setServerOffset(Date.parse(body.serverNow) - Date.now()); setError("");
        if (cashChanged) {
          notifyingWallet.current = true;
          try { window.dispatchEvent(new Event("kq:equipment-updated")); window.dispatchEvent(new Event("kq:treasury-updated")); }
          finally { notifyingWallet.current = false; }
        }
      }
    } catch (cause) { if (!signal?.aborted && version === loadVersion.current && !mutationInFlight.current) setError(cause instanceof Error ? cause.message : "Le comptoir boursier est indisponible."); }
    finally { if (!signal?.aborted && version === loadVersion.current && !mutationInFlight.current) setLoading(false); }
  }, [requestedIds]);
  useEffect(() => {
    const timeout = window.setTimeout(() => { setDebouncedSearch(search); setPage(0); }, 300);
    return () => window.clearTimeout(timeout);
  }, [search]);
  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal);
    const update = () => { if (!document.hidden && !dialog.current?.open && !notifyingWallet.current) void reload(controller.signal); };
    const interval = window.setInterval(update, 60_000);
    window.addEventListener("kq:equipment-updated", update);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    return () => { controller.abort(); window.clearInterval(interval); window.removeEventListener("kq:equipment-updated", update); document.removeEventListener("visibilitychange", update); window.removeEventListener("focus", update); };
  }, [reload]);
  useEffect(() => { const interval = window.setInterval(() => setClock(Date.now()), 1000); return () => window.clearInterval(interval); }, []);
  useEffect(() => {
    if (!selected || !dialog.current) return;
    const element = dialog.current;
    const rootOverflow = document.documentElement.style.overflow, bodyOverflow = document.body.style.overflow, bodyPadding = document.body.style.paddingRight;
    const scrollbarGap = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.overflow = "hidden"; document.body.style.overflow = "hidden";
    if (scrollbarGap > 0) document.body.style.paddingRight = `${parseFloat(getComputedStyle(document.body).paddingRight) + scrollbarGap}px`;
    element.showModal();
    return () => { element.close(); document.documentElement.style.overflow = rootOverflow; document.body.style.overflow = bodyOverflow; document.body.style.paddingRight = bodyPadding; };
  }, [selected]);
  useEffect(() => {
    if (!selected) return;
    const element = dialog.current;
    if (busy) { element?.focus({ preventScroll: true }); return; }
    if (!order) element?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
    else if (document.activeElement === element || !element?.contains(document.activeElement)) {
      const button = element?.querySelector<HTMLButtonElement>("[data-stock-confirm]");
      (button && !button.disabled ? button : element)?.focus({ preventScroll: true });
    }
  }, [selected, order, busy]);
  useEffect(() => {
    if (!selected && !busy && orderTrigger.current) {
      const trigger = orderTrigger.current;
      (trigger.isConnected && !trigger.disabled ? trigger : document.getElementById(`stock-${tab}-tab`))?.focus({ preventScroll: true });
      orderTrigger.current = null;
    }
  }, [selected, busy, tab]);
  const now = clock + serverOffset;
  const positionFor = (assetId: string) => data?.positions.find(position => position.assetId === assetId);
  const assetFor = (assetId: string) => data?.assets.find(asset => asset.id === assetId);
  function select(asset: KqStockAsset, side: "buy" | "sell", trigger: HTMLButtonElement) {
    orderTrigger.current = trigger; setSelected({ asset, side }); setOrder(null); setOrderError(""); setConfirmAttempted(false); setQuantity(positionFor(asset.id)?.quantity ?? "");
  }
  function closeOrder() {
    if (mutationInFlight.current) return;
    setSelected(null); setOrder(null); setConfirmAttempted(false); setOrderError("");
  }
  async function preview() {
    if (!selected || mutationInFlight.current) return;
    const amountCents = parseKqStockEuros(amount);
    if (selected.side === "buy" && amountCents === null) { setOrderError("Entre un montant valide en euros de jeu, avec deux décimales au maximum."); return; }
    mutationInFlight.current = true; ++loadVersion.current; setLoading(false); setBusy(true); setOrderError("");
    try {
      const response = await fetch("/api/arena/placard/stocks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "preview", side: selected.side, assetId: selected.asset.id, ...(selected.side === "buy" ? { amountCents } : { quantity: quantity.replace(",", ".") }) }) });
      const body: unknown = await response.json();
      if (!response.ok || !isKqStockOrder(body)) throw new Error(isRecord(body) && typeof body.error === "string" ? body.error : "L’offre n’a pas pu être préparée. Actualise les cours et réessaie.");
      setOrder(body); setConfirmAttempted(false);
    } catch (cause) { setOrderError(cause instanceof Error ? cause.message : "L’offre n’a pas pu être préparée."); }
    finally { mutationInFlight.current = false; setBusy(false); }
  }
  async function confirm() {
    if (!order || mutationInFlight.current) return;
    mutationInFlight.current = true; ++loadVersion.current; setLoading(false); setBusy(true); setConfirmAttempted(true); setOrderError("");
    try {
      const response = await fetch("/api/arena/placard/stocks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "confirm", orderId: order.orderId }) });
      const body: unknown = await response.json();
      if (!response.ok || !isRecord(body) || !isKqStockTrade(body.trade)) throw new Error(isRecord(body) && typeof body.error === "string" ? body.error : "Confirmation non reçue. Réessaie cet ordre pour vérifier son exécution.");
      setNotice(`${body.trade.side === "buy" ? "Achat" : "Vente"} enregistré : ${euros(body.trade.amountCents)} de jeu.`);
      setOrder(null); setSelected(null); setConfirmAttempted(false); cashCentsRef.current = body.trade.cashAfterCents;
      window.dispatchEvent(new Event("kq:equipment-updated")); window.dispatchEvent(new Event("kq:treasury-updated")); onWalletRefresh?.();
      mutationInFlight.current = false; await reload();
    } catch (cause) { setOrderError(cause instanceof Error ? cause.message : "Confirmation non reçue. Réessaie le même ordre."); }
    finally { mutationInFlight.current = false; setBusy(false); }
  }
  const totalValue = data?.positions.every(position => position.valueCents !== null) ? data.positions.reduce((sum, position) => sum + (position.valueCents ?? 0), 0) : null;
  const secondsLeft = order ? Math.max(0, Math.ceil((Date.parse(order.expiresAt) - now) / 1000)) : 0;
  const indexAsset = index ? assetFor(index.id) : undefined;
  function changeTab(next: StockTab) { setTab(next); setPage(0); }
  return <section className={styles.market} aria-label="Comptoir boursier" data-testid="stocks-market">
    <header className={styles.header}><div className={styles.icon}><ChartNoAxesCombined size={36} aria-hidden="true" /></div><div><small>Les placements du placard</small><h3>Le comptoir boursier</h3><p>Paris, New York. Ton portefeuille de jeu.</p></div><span className={styles.stamp}>CAC 40<br />S&amp;P 500</span></header>
    <p className={styles.disclaimer}>Actions et parts virtuelles d’indices avec tes euros de jeu. Cours Yahoo Finance pouvant être différés ; la date est indiquée pour chaque titre. Hors séance, le dernier cours connu peut servir aux échanges du jeu.</p>
    <div className={styles.status}><span><Clock3 size={16} aria-hidden="true" />{loading ? "Actualisation des cours…" : "Cours datés, prix confirmés avant l’ordre"}<small>État du marché au dernier relevé. Les titres américains sont convertis en euros au taux de change du marché.</small></span><button type="button" disabled={loading || busy} aria-label="Actualiser les cours boursiers" onClick={() => void reload()}><RefreshCw size={16} aria-hidden="true" /> Actualiser</button></div>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {notice ? <p className={styles.success} role="status">{notice}</p> : null}
    <div className={styles.summary}><div><small>Disponible</small><strong>{data ? euros(data.cashCents) : "—"}</strong></div><div><small>Valeur du portefeuille</small><strong>{totalValue === null ? "Cours à actualiser" : euros(totalValue)}</strong></div><div><small>Montant investi</small><strong>{data ? euros(data.positions.reduce((sum, position) => sum + position.costBasisCents, 0)) : "—"}</strong></div></div>
    <div className={styles.tabs} role="tablist" aria-label="Marchés boursiers">{TABS.map((item, i) => <button type="button" key={item.id} id={`stock-${item.id}-tab`} role="tab" aria-selected={tab === item.id} aria-controls={`stock-${item.id}-list`} tabIndex={tab === item.id ? 0 : -1} onClick={() => changeTab(item.id)} onKeyDown={event => {
      const next = event.key === "ArrowRight" ? (i + 1) % TABS.length : event.key === "ArrowLeft" ? (i + TABS.length - 1) % TABS.length : event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1 : null;
      if (next === null) return; event.preventDefault(); changeTab(TABS[next].id); document.getElementById(`stock-${TABS[next].id}-tab`)?.focus();
    }}>{item.id === "portfolio" ? <Wallet size={16} aria-hidden="true" /> : null}{item.label}{item.id === "portfolio" ? ` (${data?.positions.length ?? 0})` : ""}</button>)}</div>
    <div role="tabpanel" id={`stock-${tab}-list`} aria-labelledby={`stock-${tab}-tab`}>
      {tab !== "portfolio" ? <>
        {index ? <article className={styles.indexCard}><div className={styles.asset}><StockBadge instrument={index} /><span><small>Le repère du marché</small><h4>{index.name}</h4><span className={styles.indexLabel}>Indice · parts virtuelles</span></span></div><StockQuote asset={indexAsset} now={now} /><button type="button" disabled={busy || !indexAsset || !canTradeKqStockAsset(indexAsset, now)} aria-label={`Acheter ${index.name}`} onClick={event => { if (indexAsset) select(indexAsset, "buy", event.currentTarget); }}><ArrowDownLeft size={16} aria-hidden="true" /> Acheter des parts</button><p>Une part virtuelle vaut le niveau de l’indice en {index.currency === "USD" ? "dollars, converti en euros au taux du marché" : "euros"}.</p></article> : null}
        <div className={styles.listIntro}><h4>Les actions du {tab === "cac40" ? "CAC 40" : "S&P 500"}</h4><span>{instruments.length} titre{instruments.length > 1 ? "s" : ""}</span></div>
        <label className={styles.search}><Search size={17} aria-hidden="true" /><input type="search" aria-label="Rechercher un titre" placeholder={tab === "cac40" ? "LVMH, Air Liquide…" : "Apple, Microsoft…"} value={search} onChange={event => setSearch(event.target.value)} /></label>
        <div className={styles.listHeading} aria-hidden="true"><span>Titre</span><span>Cours · variation</span><span>Placement</span></div>
        <div className={styles.list}>{visible.map(instrument => { const asset = assetFor(instrument.id); return <div key={instrument.id} className={styles.row}><div className={styles.asset}><StockBadge instrument={instrument} /><span><strong>{instrument.name}</strong><small>{instrument.symbol} · action</small></span></div><StockQuote asset={asset} now={now} /><button type="button" aria-label={`Acheter ${instrument.name}`} disabled={busy || !asset || !canTradeKqStockAsset(asset, now)} onClick={event => { if (asset) select(asset, "buy", event.currentTarget); }}><ArrowDownLeft size={16} aria-hidden="true" /> Acheter</button></div>; })}</div>
        {!visible.length ? <p className={styles.empty}>Aucun titre ne correspond à ta recherche dans ce marché.</p> : null}
        {pages > 1 ? <nav className={styles.pagination} aria-label="Pages des actions"><button type="button" disabled={page <= 0} onClick={() => setPage(value => value - 1)}>Précédent</button><span>{Math.min(page + 1, pages)} / {pages}</span><button type="button" disabled={page >= pages - 1} onClick={() => setPage(value => value + 1)}>Suivant</button></nav> : null}
      </> : <div className={styles.positions}>{!data ? <p className={styles.empty}>Chargement de ton portefeuille…</p> : data.positions.length ? visiblePositions.map(position => {
        const asset = assetFor(position.assetId), instrument = KQ_STOCK_INSTRUMENTS.find(item => item.id === position.assetId);
        const pnl = position.valueCents === null ? null : position.valueCents - position.costBasisCents;
        return <article key={position.assetId} className={styles.position}><header><div className={styles.asset}>{instrument ? <StockBadge instrument={instrument} /> : null}<span><strong>{instrument?.name ?? position.assetId}</strong><small>{formatKqStockQuantity(position.quantity)} {instrument?.symbol ?? position.assetId}{instrument?.kind === "index" ? " · parts virtuelles d’indice" : " · actions virtuelles"}</small></span></div><button type="button" disabled={busy || !asset || !canTradeKqStockAsset(asset, now)} aria-label={`Vendre ${instrument?.name ?? position.assetId}`} onClick={event => { if (asset) select(asset, "sell", event.currentTarget); }}><ArrowUpRight size={16} aria-hidden="true" /> Vendre</button></header><dl><div><dt>Coût d’achat</dt><dd>{euros(position.costBasisCents)}</dd></div><div><dt>Valeur actuelle</dt><dd>{position.valueCents === null ? "Cours à actualiser" : euros(position.valueCents)}</dd></div><div><dt>Gain / perte latent</dt><dd data-positive={(pnl ?? 0) >= 0}>{pnl === null ? "—" : `${pnl > 0 ? "+" : ""}${euros(pnl)}`}</dd></div></dl><StockQuote asset={asset} now={now} /></article>;
      }) : <p className={styles.empty}>Ton portefeuille boursier est vide. Choisis une action ou un indice pour préparer ton premier placement.</p>}{positionPages > 1 ? <nav className={styles.pagination} aria-label="Pages du portefeuille"><button type="button" disabled={page <= 0} onClick={() => setPage(value => value - 1)}>Précédent</button><span>{Math.min(page + 1, positionPages)} / {positionPages}</span><button type="button" disabled={page >= positionPages - 1} onClick={() => setPage(value => value + 1)}>Suivant</button></nav> : null}</div>}
    </div>
    {selected && data ? <dialog ref={dialog} className={styles.order} id="stock-order-dialog" aria-labelledby="stock-order-title" aria-describedby="stock-order-description" tabIndex={-1} onCancel={event => { event.preventDefault(); closeOrder(); }} onKeyDown={event => {
      if (event.key !== "Tab") return;
      const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href],[tabindex="0"]')].filter(element => element.getClientRects().length > 0);
      const first = focusable[0], last = focusable.at(-1);
      if (!first) { event.preventDefault(); event.currentTarget.focus({ preventScroll: true }); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last?.focus({ preventScroll: true }); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus({ preventScroll: true }); }
    }}><header className={styles.orderHeader}><div className={styles.orderIdentity}><StockBadge instrument={selected.asset} /><div><small>{order ? "02 / Confirmer le placement" : "01 / Préparer le placement"}</small><h4 id="stock-order-title">{selected.side === "buy" ? "Acheter" : "Vendre"} {selected.asset.name}</h4></div></div><button type="button" className={styles.close} aria-label="Fermer la fenêtre boursière" disabled={busy} onClick={closeOrder}><X size={22} aria-hidden="true" /></button></header><div className={styles.orderBody} aria-busy={busy}>
      <p id="stock-order-description">{selected.asset.kind === "index" ? "Indice · parts virtuelles. " : "Actions virtuelles. "}{selected.side === "buy" ? "Ton placement utilise uniquement tes euros de jeu." : "La vente revient dans ta trésorerie de jeu."}</p>
      <div className={styles.nativeQuote}><StockQuote asset={selected.asset} now={now} />{selected.asset.currency === "USD" && selected.asset.fxRate ? <p>Change : 1 EUR = {Number(selected.asset.fxRate).toLocaleString("fr-FR", { maximumFractionDigits: 6 })} USD{selected.asset.fxQuotedAt ? ` · relevé du ${date(selected.asset.fxQuotedAt)}` : ""}.</p> : null}</div>
      {orderError ? <p className={styles.error} role="alert">{orderError}</p> : null}
      {!order ? <form onSubmit={event => { event.preventDefault(); void preview(); }}><div className={styles.orderContext}><span>Prix indicatif en euros<strong>{selected.asset.priceEur ? price(selected.asset.priceEur) : "Cours à actualiser"}</strong></span><span>{selected.side === "buy" ? "Disponible" : "Ta position"}<strong>{selected.side === "buy" ? euros(data.cashCents) : `${formatKqStockQuantity(positionFor(selected.asset.id)?.quantity ?? "0")} ${selected.asset.symbol}`}</strong></span></div><label htmlFor="stock-order-amount">{selected.side === "buy" ? "Montant en euros de jeu" : "Quantité à vendre"}<div className={styles.amountField}><input id="stock-order-amount" inputMode="decimal" value={selected.side === "buy" ? amount : quantity} onChange={event => selected.side === "buy" ? setAmount(event.target.value) : setQuantity(event.target.value)} disabled={busy} aria-describedby="stock-amount-help" /><span aria-hidden="true">{selected.side === "buy" ? "€" : selected.asset.symbol}</span></div></label><small id="stock-amount-help">Vérifie le prix et le total en euros avant de confirmer.</small><div className={styles.actions}><button type="submit" disabled={busy}>{busy ? "Préparation…" : "Préparer l’offre"}</button><button type="button" disabled={busy} onClick={closeOrder}>Annuler</button></div></form> : <div><dl className={styles.orderTotals}><div><dt>Quantité</dt><dd>{formatKqStockQuantity(order.quantity)} {selected.asset.symbol}</dd></div><div><dt>Prix bloqué en euros</dt><dd>{price(order.priceEur)}</dd></div><div className={styles.orderTotal}><dt>{order.side === "buy" ? "À débiter" : "À recevoir"}</dt><dd>{euros(order.amountCents)}<small>euros de jeu</small></dd></div></dl><p className={styles.expiry} data-expired={secondsLeft === 0}>Cours du {date(order.quotedAt)}.<br />{secondsLeft > 0 ? `Offre valable encore ${secondsLeft} s. Le montant confirmé sera exactement celui affiché.` : "Offre expirée : prépare une nouvelle offre."}</p><div className={styles.actions}><button type="button" data-stock-confirm disabled={busy || (secondsLeft === 0 && !confirmAttempted)} onClick={() => void confirm()}>{busy ? "Confirmation…" : confirmAttempted ? "Vérifier / réessayer cet ordre" : `Confirmer ${order.side === "buy" ? "l’achat" : "la vente"}`}</button><button type="button" disabled={busy} onClick={() => { setOrder(null); setConfirmAttempted(false); setOrderError(""); }}>Modifier l’ordre</button></div>{confirmAttempted ? <small>Si la réponse se perd, réessaie cet ordre : il ne sera exécuté qu’une seule fois.</small> : null}</div>}
    </div></dialog> : null}
    {data?.recentTrades.length ? <details className={styles.history}><summary>Les derniers mouvements ({data.recentTrades.length})</summary>{data.recentTrades.map(trade => <div key={trade.orderId}><span>{trade.side === "buy" ? "Achat" : "Vente"} {KQ_STOCK_INSTRUMENTS.find(instrument => instrument.id === trade.assetId)?.symbol ?? trade.assetId}<small>{date(trade.createdAt)}</small></span><strong>{euros(trade.amountCents)}</strong></div>)}</details> : null}
    <footer className={styles.source}><p>Cours et change fournis par <a href="https://finance.yahoo.com/" target="_blank" rel="noreferrer">Yahoo Finance</a>. Tous les placements sont virtuels et suivent uniquement les prix ; les dividendes ne sont pas versés. Les gains et pertes réalisés rejoignent ta comptabilité.</p><p>{cacSource ? <>Composition CAC 40 : <a href={cacSource.url} target="_blank" rel="noreferrer">Euronext</a>. </> : null}{usSource ? <>Univers S&amp;P 500 : actions cotées du portefeuille <a href={usSource.url} target="_blank" rel="noreferrer">iShares IVV</a>, relevé du {new Date(usSource.asOf).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}.</> : null}</p></footer>
  </section>;
}
