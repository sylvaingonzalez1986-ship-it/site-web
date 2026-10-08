import { getKqBankTerms, KQ_BANK_INSTALLMENT_MS, KQ_BANK_TERM_DAYS, parseKqBankCommand, type KqBankLoan, type KqBankSnapshot } from "./kanab-quest-bank";
import { createKqBusinessPreview, isKqAdvertisingKind, KQ_ADVERTISING, KQ_DOMICILIATION_MONTHLY_CENTS, KQ_GAME_DAY_MS, KQ_GAME_MONTH_MS, KQ_SHOP_CREATION_CENTS, KQ_SHOP_MONTHLY_CENTS, normalizeKqShopName } from "./kanab-quest-business";
import { parseSavingsCommand, type ChanvrierSavings } from "./chanvrier-savings";
import type { KqCommerceSnapshot } from "./kanab-quest-commerce";
import { quoteKqEnergy, type KqEnergySnapshot } from "./kanab-quest-energy";
import { parseKqCryptoAction, type KqCryptoSnapshot, type KqCryptoOrder, type KqCryptoTrade } from "./kanab-quest-crypto";
import { KQ_STOCK_INSTRUMENTS, parseKqStockAction, parseKqStockAssetIds, type KqStockSnapshot, type KqStockOrder, type KqStockTrade } from "./kanab-quest-stocks";
import type { KqTreasuryBalances, KqTreasuryEntry, KqTreasuryPosting, KqTreasurySnapshot } from "./kanab-quest-treasury";

export type KqTreasuryTutorialLesson = "bank" | "investments" | "business";
export type KqTreasuryTutorialProgress = { instruction: string; complete: boolean };
type Position = { quantity: bigint; costBasisCents: number };
type PendingOrder = { market: "stocks" | "crypto"; order: KqStockOrder | KqCryptoOrder };
const QUANTITY_SCALE = BigInt(100_000_000);
const DEMO_PRICE_CENTS = 10_000;
const INITIAL_CASH = 500_000;
const SITE_ORIGIN = "https://tutorial.invalid";
const quantityText = (quantity: bigint) => `${quantity / QUANTITY_SCALE}.${String(quantity % QUANTITY_SCALE).padStart(8, "0")}`;
function quantityUnits(value: string) {
  if (!/^\d+(?:\.\d{1,8})?$/.test(value)) throw new Error("Entre une quantité avec 8 décimales au maximum dans cet essai.");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * QUANTITY_SCALE + BigInt(fraction.padEnd(8, "0"));
}

/** Isolated transport for the real Bureau screens. It has no network fallback,
 * storage, session or customer identifiers. Every amount and price is fictitious.
 * Shared production parsers and loan/calendar rules keep the practice consistent.
 */
export function createKqTreasuryTutorial(options: { now?: () => number } = {}) {
  const clock = options.now ?? Date.now;
  const started = clock();
  const stamp = () => new Date(clock()).toISOString();
  let serial = 0;
  const id = () => `71000000-0000-4000-8000-${(++serial).toString(16).padStart(12, "0")}`;
  const marketId = id();
  const labId = id();
  const runId = id();
  const business = createKqBusinessPreview(started);
  business.lab = { outstandingCents: 4500, overdueCents: 0, invoices: [{ id: labId, runId, issuedAt: stamp(), dueAt: new Date(started + KQ_GAME_MONTH_MS).toISOString(), amountCents: 4500, remainingCents: 4500 }] };
  let energyDue = 414;
  let loan: KqBankLoan | null = null;
  const loans: KqBankLoan[] = [];
  let firstDepositAt: string | null = null;
  const initial: KqTreasuryBalances = { cash: INITIAL_CASH, opening_equity: -INITIAL_CASH, lab_payable: -4500, expense_lab: 4500, energy_payable: -414, expense_energy: 414 };
  const balances = { ...initial };
  const journal: KqTreasuryEntry[] = [];
  const positions = new Map<string, Position>();
  const orders = new Map<string, PendingOrder>();
  const trades = new Map<string, { market: "stocks" | "crypto"; trade: KqStockTrade | KqCryptoTrade }>();
  const replayed = new Map<string, string>();
  const actions = new Set<string>();
  const listeners = new Set<() => void>();
  const cash = () => balances.cash ?? 0;
  const afford = (cents: number) => { if (cents > cash()) throw new Error("Le budget fictif ne suffit pas pour cette opération."); };
  function post(kind: string, postings: KqTreasuryPosting[]) {
    if (postings.reduce((sum, item) => sum + item.deltaCents, 0) !== 0) throw new Error("Écriture d’essai déséquilibrée.");
    for (const item of postings) balances[item.account] = (balances[item.account] ?? 0) + item.deltaCents;
    journal.unshift({ id: id(), occurredAt: stamp(), kind, reference: "Didacticiel · opération fictive", postings });
    actions.add(kind);
  }
  const spend = (kind: string, cents: number, account: KqTreasuryPosting["account"]) => {
    afford(cents);
    post(kind, [{ account: "cash", deltaCents: -cents }, { account, deltaCents: cents }]);
  };
  function bankSnapshot(): KqBankSnapshot {
    return {
      version: 1, serverNow: stamp(), cashCents: cash(), reputation: 600,
      eligibleAt: new Date(started - 86_400_000).toISOString(),
      market: { id: marketId, scenario: "steady", rateBps: 500, changeBps: 0, startsAt: new Date(started).toISOString(), expiresAt: new Date(clock() + 86_400_000).toISOString() },
      offer: loan ? null : { quoteId: marketId, minCents: 10000, maxCents: 2500000, rateBps: 450, termDays: KQ_BANK_TERM_DAYS, expiresAt: new Date(clock() + 86_400_000).toISOString() },
      blockedReason: loan ? "active" : null, loan, history: loans, autoPaidCents: 0, replayed: false,
    };
  }
  function savingsSnapshot(): ChanvrierSavings {
    return { cashCents: cash(), balanceCents: balances.savings ?? 0, interestCreditedCents: 0, nextInterestAt: firstDepositAt,
      ratePercent: 5, periodHours: 24, maxBalanceCents: 2_000_000_000, replayed: false };
  }
  function commerceSnapshot(): KqCommerceSnapshot {
    business.serverNow = stamp();
    return { business, strength: "treasurer", revision: journal.length, cashCents: cash(), reputation: 600, clients: 8, shopPartners: 2,
      computerOwned: true, internetRenew: business.shop.renew, campaign: null, stocks: [], receipts: [], rawLots: [],
      marketVolumes: {}, ownVolumes: {}, routeSales: {}, electricityOutstandingCents: energyDue };
  }
  function energySnapshot(): KqEnergySnapshot {
    const codes = ["LED-150-STARTER"];
    const quotes = { eco: quoteKqEnergy(codes, {}, "eco"), balanced: quoteKqEnergy(codes), intensive: quoteKqEnergy(codes, {}, "intensive") };
    return { cashCents: cash(), productionUnits: 1, outstandingCents: energyDue, invoiceCount: 1, bestGramsPerKwh: null, quotes,
      invoices: [{ runId, createdAt: new Date(started).toISOString(), totalCents: 414, remainingCents: energyDue, harvestGrams: 120, quote: quotes.balanced }] };
  }
  function treasurySnapshot(url: URL): KqTreasurySnapshot {
    const period = url.searchParams.get("period");
    const key = period === "all" || period === "previous" ? period : "current";
    const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
    const rows = key === "previous" ? [] : journal;
    const closing = key === "previous" ? initial : balances;
    return { version: 1, serverNow: stamp(), startedAt: new Date(started).toISOString(), businessStartedAt: new Date(started).toISOString(),
      period: { key, from: new Date(started).toISOString(), to: key === "previous" ? new Date(started).toISOString() : stamp() },
      openingBalances: { ...initial }, closingBalances: { ...closing },
      series: [{ from: new Date(started).toISOString(), to: stamp(), cashOpeningCents: INITIAL_CASH, cashClosingCents: closing.cash ?? 0,
        inflowsCents: rows.reduce((sum, row) => sum + Math.max(0, row.postings.find(item => item.account === "cash")?.deltaCents ?? 0), 0),
        outflowsCents: rows.reduce((sum, row) => sum + Math.max(0, -(row.postings.find(item => item.account === "cash")?.deltaCents ?? 0)), 0), revenueCents: 0, expenseCents: 0 }],
      journal: { items: rows.slice(offset, offset + 25), total: rows.length, offset, limit: 25 },
      checks: { walletCashCents: cash(), vatReserveCents: 0, savingsCents: balances.savings ?? 0, labDebtCents: business.lab.outstandingCents,
        energyDebtCents: energyDue, vatDebtCents: 0, loanDebtCents: loan?.remainingCents ?? 0,
        cryptoCostCents: balances.crypto_assets ?? 0, securitiesCostCents: balances.securities_assets ?? 0 } };
  }
  function positionRows(market: "stocks" | "crypto") {
    return [...positions.entries()].filter(([key]) => key.startsWith(`${market}:`)).map(([key, value]) => ({
      assetId: market === "crypto" ? Number(key.slice(7)) : key.slice(7), quantity: quantityText(value.quantity), costBasisCents: value.costBasisCents,
      valueCents: Number(value.quantity * BigInt(DEMO_PRICE_CENTS) / QUANTITY_SCALE),
    }));
  }
  function cryptoSnapshot(): KqCryptoSnapshot {
    return { version: 1, serverNow: stamp(), marketStatus: "live", updatedAt: stamp(), cashCents: cash(),
      assets: [{ id: 1, rank: 1, name: "Bitcoin", symbol: "BTC", priceEur: "100", change24h: 0, quotedAt: stamp(), inTop100: true },
        { id: 1027, rank: 2, name: "Ethereum", symbol: "ETH", priceEur: "100", change24h: 0, quotedAt: stamp(), inTop100: true }],
      positions: positionRows("crypto") as KqCryptoSnapshot["positions"],
      recentTrades: [...trades.values()].filter(item => item.market === "crypto").map(item => item.trade as KqCryptoTrade).slice(-20).reverse() };
  }
  function stockSnapshot(url: URL): KqStockSnapshot {
    const ids = parseKqStockAssetIds(url.searchParams.get("ids"));
    return { version: 1, serverNow: stamp(), cashCents: cash(),
      assets: KQ_STOCK_INSTRUMENTS.filter(item => ids.includes(item.id)).map(item => ({ ...item, priceNative: "100", priceEur: "100", changePercent: 0,
        quotedAt: stamp(), refreshedAt: stamp(), marketState: "open", fxRate: "1", fxQuotedAt: item.currency === "USD" ? stamp() : null })),
      positions: positionRows("stocks") as KqStockSnapshot["positions"],
      recentTrades: [...trades.values()].filter(item => item.market === "stocks").map(item => item.trade as KqStockTrade).slice(-20).reverse() };
  }
  function tradeCommand(market: "stocks" | "crypto", body: unknown) {
    const command = market === "stocks" ? parseKqStockAction(body) : parseKqCryptoAction(body);
    if (command.action === "confirm") {
      const existing = trades.get(command.orderId);
      if (existing?.market === market) return { trade: existing.trade };
      const pending = orders.get(command.orderId);
      if (!pending || pending.market !== market || Date.parse(pending.order.expiresAt) <= clock()) throw new Error("Cet ordre d’essai a expiré. Prépare une nouvelle offre.");
      const order = pending.order;
      const key = `${market}:${order.assetId}`;
      const held = positions.get(key) ?? { quantity: BigInt(0), costBasisCents: 0 };
      const units = quantityUnits(order.quantity);
      let costBasisCents = order.amountCents;
      if (order.side === "buy") {
        afford(order.amountCents);
        positions.set(key, { quantity: held.quantity + units, costBasisCents: held.costBasisCents + order.amountCents });
      } else {
        if (units > held.quantity) throw new Error("Cette quantité n’est plus disponible dans ton portefeuille fictif.");
        costBasisCents = Number(BigInt(held.costBasisCents) * units / held.quantity);
        if (units === held.quantity) positions.delete(key);
        else positions.set(key, { quantity: held.quantity - units, costBasisCents: held.costBasisCents - costBasisCents });
      }
      const account = market === "stocks" ? "securities_assets" : "crypto_assets";
      const signed = order.side === "buy" ? -order.amountCents : order.amountCents;
      const pnl = order.side === "sell" ? order.amountCents - costBasisCents : 0;
      post(`${market === "stocks" ? "stock" : "crypto"}-${order.side}`, [
        { account: "cash", deltaCents: signed },
        { account, deltaCents: order.side === "buy" ? order.amountCents : -costBasisCents },
        ...(pnl ? [{ account: market === "stocks" ? "revenue_stock_gains" as const : "revenue_crypto_gains" as const, deltaCents: -pnl }] : []),
      ]);
      const trade = { ...order, costBasisCents, realizedPnlCents: pnl, cashAfterCents: cash(), createdAt: stamp() };
      trades.set(order.orderId, { market, trade });
      orders.delete(order.orderId);
      return { trade };
    }
    if (market === "crypto" && ![1, 1027].includes(Number(command.assetId))) throw new Error("Crypto absente de cet essai.");
    const units = command.side === "buy" ? BigInt(command.amountCents) * QUANTITY_SCALE / BigInt(DEMO_PRICE_CENTS) : quantityUnits(command.quantity);
    const cents = command.side === "buy" ? command.amountCents : Number(units * BigInt(DEMO_PRICE_CENTS) / QUANTITY_SCALE);
    if (units <= BigInt(0) || cents < 1) throw new Error("Quantité trop petite.");
    if (command.side === "buy") afford(cents);
    else if (units > (positions.get(`${market}:${command.assetId}`)?.quantity ?? BigInt(0))) throw new Error("Tu ne possèdes pas cette quantité dans cet essai.");
    const order = { orderId: id(), assetId: command.assetId, side: command.side, quantity: quantityText(units), priceEur: "100", amountCents: cents,
      expiresAt: new Date(clock() + 60_000).toISOString(), quotedAt: stamp() };
    orders.set(order.orderId, { market, order: order as KqStockOrder | KqCryptoOrder });
    return order;
  }
  function command(path: string, body: Record<string, unknown>) {
    if (path.endsWith("/bank")) {
      const value = parseKqBankCommand(body);
      if (!value) throw new Error("Contrat d’essai invalide.");
      if (value.action === "borrow") {
        if (loan || value.quoteId !== marketId || value.expectedRateBps !== 450 || value.amountCents > 2500000) throw new Error("Consulte l’offre bancaire disponible.");
        const terms = getKqBankTerms(value.amountCents, value.expectedRateBps);
        const accepted = clock();
        loan = { id: id(), principalCents: value.amountCents, interestCents: terms.interestCents, totalCents: terms.totalCents, paidCents: 0,
          remainingCents: terms.totalCents, rateBps: value.expectedRateBps, acceptedAt: new Date(accepted).toISOString(), dueAt: new Date(accepted + terms.installments.length * KQ_BANK_INSTALLMENT_MS).toISOString(), paidAt: null, overdueCents: 0,
          schedule: terms.installments.map((cents, index) => ({ at: new Date(accepted + (index + 1) * KQ_BANK_INSTALLMENT_MS).toISOString(), amountCents: cents, paidCents: 0 })) };
        post("loan-issued", [{ account: "cash", deltaCents: value.amountCents }, { account: "loan_payable", deltaCents: -terms.totalCents }, { account: "expense_loan_interest", deltaCents: terms.interestCents }]);
      } else {
        if (!loan || value.loanId !== loan.id || value.amountCents !== loan.remainingCents) throw new Error("Vérifie le solde de ton prêt fictif.");
        spend("loan-repayment", value.amountCents, "loan_payable");
        loans.unshift({ ...loan, remainingCents: 0, paidCents: loan.totalCents, paidAt: stamp(), schedule: loan.schedule.map(item => ({ ...item, paidCents: item.amountCents })) });
        loan = null;
      }
      return bankSnapshot();
    }
    if (path.endsWith("/savings")) {
      const value = parseSavingsCommand(body);
      if (!value) throw new Error("Virement d’essai invalide.");
      if (value.action === "deposit") {
        spend("savings-deposit", value.amountCents, "savings");
        firstDepositAt ??= new Date(clock() + 86_400_000).toISOString();
      } else {
        if (value.amountCents > (balances.savings ?? 0)) throw new Error("Ton épargne fictive ne suffit pas.");
        post("savings-withdraw", [{ account: "cash", deltaCents: value.amountCents }, { account: "savings", deltaCents: -value.amountCents }]);
        if (!balances.savings) firstDepositAt = null;
      }
      return savingsSnapshot();
    }
    if (path.endsWith("/stocks") || path.endsWith("/crypto")) return tradeCommand(path.endsWith("/stocks") ? "stocks" : "crypto", body);
    if (path.endsWith("/energy")) {
      if (body.expectedCents !== energyDue || !energyDue) throw new Error("Cette facture d’essai est déjà réglée ou a changé.");
      spend("energy-paid", energyDue, "energy_payable"); energyDue = 0;
      return energySnapshot();
    }
    if (!path.endsWith("/commerce")) throw new Error("Cette action n’est pas disponible dans cet atelier.");
    if (body.action === "create-shop") {
      if (business.shop.createdAt) throw new Error("Le site d’essai existe déjà.");
      const name = normalizeKqShopName(body.name);
      spend("shop-created", KQ_SHOP_CREATION_CENTS, "website");
      business.shop = { name, createdAt: stamp(), paidUntil: new Date(clock() + KQ_GAME_MONTH_MS).toISOString(), active: true, renew: true };
    } else if (body.action === "rename-shop") {
      if (!business.shop.createdAt) throw new Error("Crée d’abord ton site.");
      business.shop.name = normalizeKqShopName(body.name); actions.add("shop-renamed");
    } else if (body.action === "shop-renewal") {
      if (!business.shop.createdAt || typeof body.enabled !== "boolean") throw new Error("Réglage du site invalide.");
      business.shop.renew = body.enabled; actions.add("shop-renewal");
    } else if (body.action === "renew-shop") {
      if (!business.shop.createdAt || business.shop.active) throw new Error("Le site d’essai n’a pas besoin d’être réactivé.");
      spend("shop-renewed", KQ_SHOP_MONTHLY_CENTS, "expense_hosting");
      business.shop.active = true; business.shop.paidUntil = new Date(clock() + KQ_GAME_MONTH_MS).toISOString();
    } else if (body.action === "advertise") {
      if (!business.shop.active || business.advertising || !isKqAdvertisingKind(body.kind)) throw new Error("Un site actif et aucune autre campagne sont nécessaires.");
      const ad = KQ_ADVERTISING[body.kind];
      spend("advertising-started", ad.costCents, "expense_advertising");
      business.advertising = { id: id(), kind: body.kind, startedAt: stamp(), endsAt: new Date(clock() + ad.durationDays * KQ_GAME_DAY_MS).toISOString(), boostPercent: ad.boostPercent };
    } else if (body.action === "domiciliation") {
      if (body.mode !== "home" && body.mode !== "external") throw new Error("Adresse invalide.");
      if (body.mode === "external") {
        const paid = business.domiciliation.paidUntil && Date.parse(business.domiciliation.paidUntil) > clock();
        if (!paid) spend("domicile-paid", KQ_DOMICILIATION_MONTHLY_CENTS, "expense_domiciliation");
        business.domiciliation = { mode: "external", paidUntil: paid ? business.domiciliation.paidUntil : new Date(clock() + KQ_GAME_MONTH_MS).toISOString(), renew: true, active: true };
      } else business.domiciliation = { ...business.domiciliation, mode: "home", active: false, renew: false };
      actions.add("domiciliation");
    } else if (body.action === "pay-lab") {
      const invoice = business.lab.invoices.find(item => item.id === body.invoiceId && item.remainingCents > 0);
      if (!invoice) throw new Error("Cette analyse d’essai est déjà réglée.");
      spend("lab-paid", invoice.remainingCents, "lab_payable");
      business.lab.outstandingCents -= invoice.remainingCents; invoice.remainingCents = 0;
    } else throw new Error("Cette action n’est pas disponible dans cet atelier.");
    return commerceSnapshot();
  }
  const paths = new Set(["/api/arena/chanvrier", "/api/arena/chanvrier/savings", ...["bank", "commerce", "energy", "treasury", "stocks", "crypto"].map(name => `/api/arena/placard/${name}`)]);
  const request: typeof fetch = async (input, init) => {
    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    signal?.throwIfAborted();
    const url = new URL(input instanceof Request ? input.url : String(input), SITE_ORIGIN);
    if (url.origin !== SITE_ORIGIN || !paths.has(url.pathname)) return Response.json({ error: "Cet atelier ne contacte aucun compte réel. Ouvre l’autre atelier pour cette action." }, { status: 404 });
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    try {
      if (method === "POST") {
        const raw = init?.body ?? (input instanceof Request ? await input.text() : null);
        const body: unknown = typeof raw === "string" ? JSON.parse(raw) : null;
        if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Action d’essai invalide.");
        const record = body as Record<string, unknown>;
        const key = typeof record.requestKey === "string" ? `${url.pathname}:${record.requestKey}` : null;
        if (key && replayed.has(key)) return new Response(replayed.get(key), { headers: { "content-type": "application/json" } });
        const result = command(url.pathname, record);
        const encoded = JSON.stringify(result);
        if (key) replayed.set(key, encoded);
        listeners.forEach(listener => listener());
        return new Response(encoded, { headers: { "content-type": "application/json" } });
      }
      if (method !== "GET") throw new Error("Méthode indisponible dans cet atelier.");
      if (url.pathname === "/api/arena/chanvrier") return Response.json({ profile: { nickname: "SylvainEssai", gender: "male", clothing: "ochre", skin: "ivory", strength: "treasurer" } });
      const result = url.pathname.endsWith("/bank") ? bankSnapshot() : url.pathname.endsWith("/savings") ? savingsSnapshot()
        : url.pathname.endsWith("/commerce") ? commerceSnapshot() : url.pathname.endsWith("/energy") ? energySnapshot()
          : url.pathname.endsWith("/treasury") ? treasurySnapshot(url) : url.pathname.endsWith("/stocks") ? stockSnapshot(url) : cryptoSnapshot();
      return Response.json(result);
    } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Action d’essai indisponible." }, { status: 400 }); }
  };
  function progress(lesson: KqTreasuryTutorialLesson): KqTreasuryTutorialProgress {
    if (lesson === "bank") {
      if (!actions.has("loan-issued")) return { instruction: "Au guichet Prêts, choisis un montant, examine le contrat puis signe ce prêt fictif.", complete: false };
      if (!actions.has("savings-deposit")) return { instruction: "Le capital est arrivé. Ouvre Livret d’épargne et dépose une partie du budget fictif.", complete: false };
      if (!actions.has("savings-withdraw")) return { instruction: "Ton dépôt est enregistré. Retire une petite somme pour voir revenir l’argent au disponible.", complete: false };
      return { instruction: "Tu as signé un prêt, déposé puis retiré de l’épargne. Tu peux explorer les échéances et le remboursement.", complete: true };
    }
    if (lesson === "investments") {
      if (!actions.has("stock-buy")) return { instruction: "En Bourse, choisis un titre, examine l’ordre puis confirme un achat fictif. Les cours d’essai sont fixes à 100 €.", complete: false };
      if (!actions.has("stock-sell")) return { instruction: "Ouvre Mes positions et revends tout ou partie du titre pour retrouver du disponible.", complete: false };
      if (!actions.has("crypto-buy")) return { instruction: "Passe au guichet Crypto et confirme un achat fictif pour découvrir le second portefeuille.", complete: false };
      return { instruction: "Tu as acheté et vendu un titre, puis essayé la crypto. Les cours d’essai sont fictifs et ne prédisent aucun rendement.", complete: true };
    }
    if (!actions.has("shop-created")) return { instruction: "Dans Gestion, donne un nom à ton site et crée-le. L’ordinateur est déjà prêté pour cet essai.", complete: false };
    if (!actions.has("advertising-started")) return { instruction: "Ton site est ouvert. Compare les campagnes, choisis-en une et confirme son lancement fictif.", complete: false };
    if (!actions.has("lab-paid")) return { instruction: "Ouvre Comptabilité → Factures et règle l’analyse fictive. Observe le nouveau solde.", complete: false };
    return { instruction: "Site créé, publicité lancée, analyse réglée : retrouve ces mouvements dans le journal du Bureau.", complete: true };
  }
  return { request, progress, subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; } };
}
