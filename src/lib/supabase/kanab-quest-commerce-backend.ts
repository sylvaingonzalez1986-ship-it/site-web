import "server-only";
import { randomUUID } from "node:crypto";
import { createSupabaseServiceClient } from "./admin";
import { getKqMarketSnapshot } from "./kanab-quest-market-backend";
import { getKqEnergySummary } from "./kanab-quest-energy-backend";
import { KQ_SALES_CHANNELS, quoteKqCommerce, type KqCommerceState, type KqSalesChannel, type KqOnlinePrice } from "../kanab-quest-commerce";
import { isKqAdvertisingKind, normalizeKqShopName, previewKqBusinessPayment } from "../kanab-quest-business";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function uuid(value: unknown) { if (typeof value !== "string" || !UUID.test(value)) throw new Error("Identifiant invalide. Actualise le marché."); return value; }
function integer(value: unknown) { if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("Montant ou quantité invalide."); return value; }
function databaseError(message: string): never {
  const errors: Record<string, string> = {
    commerce_machine_maintenance: "Une machine de cette filière doit être réparée dans ton entrepôt.",
    commerce_demand_exhausted: "Ces commandes viennent d’être prises. Actualise l’offre ou attends leur renouvellement.",
    commerce_offer_changed: "Les conditions ont changé. Recalcule l’offre avant de confirmer.",
    commerce_cash: "Trésorerie insuffisante. Les grossistes restent disponibles pour vendre ton stock.",
    commerce_lot_unavailable: "Ce lot a déjà été préparé ou vendu. Actualise le stock.",
    commerce_route_unavailable: "Cette transformation n’est plus accessible avec ton atelier actuel.",
    commerce_computer_owned: "Tu possèdes déjà cet ordinateur.",
    commerce_computer_required: "Achète d’abord l’ordinateur dans la boutique.",
    commerce_internet_required: "Internet doit être actif pour vendre en ligne.",
    commerce_cycle_required: "Termine une culture pour ouvrir les commandes de ton premier cycle.",
    commerce_request_mismatch: "Cette demande a déjà servi pour une autre opération. Actualise le marché.",
    commerce_shop_required: "Économise 1 000 € et crée ton shop avant de vendre en ligne.",
    commerce_shop_exists: "Ton site existe déjà. Tu peux modifier son nom dans Mon commerce.",
    commerce_shop_inactive: "Ton site est suspendu. Réactive-le pour 100 € afin de vendre en ligne.",
    commerce_shop_active: "La période actuelle de ton site est déjà payée.",
    commerce_shop_name: "Le nom du shop doit contenir entre 3 et 40 caractères visibles.",
    commerce_ad_active: "Une campagne publicitaire est déjà en cours.",
    commerce_ad_kind: "Cette campagne publicitaire n’existe pas.",
    commerce_lab_unavailable: "Cette analyse est déjà réglée ou ne t’appartient pas.",
    commerce_legacy_internet: "L’accès en ligne passe désormais par la création de ton shop.",
    commerce_domiciliation_mode: "Choisis une domiciliation à domicile ou à une adresse extérieure.",
    commerce_legacy_sale: "Actualise le marché pour choisir ton circuit de vente.",
  };
  for (const [code, explanation] of Object.entries(errors)) if (message.includes(code)) throw new Error(explanation);
  throw new Error(`[supabase:commerce] ${message}`);
}
async function state(userId: string): Promise<KqCommerceState> {
  const result = await createSupabaseServiceClient().rpc("rpc_kq_commerce_state", { p_user_id: uuid(userId) });
  if (result.error) databaseError(result.error.message);
  const current = result.data as KqCommerceState;
  if (current.business?.version !== 1) throw new Error("[supabase:commerce] business_calendar_migration_required");
  return current;
}
export async function getKqCommerceSnapshot(userId: string, shopOnly = false) {
  // Settle elapsed billing periods before reading the spendable wallet.
  const initial = await state(userId);
  const ids = initial.rawFlowerIds ?? [];
  const rawLots = [];
  if (!shopOnly) for (let offset = 0; offset < ids.length; offset += 100) {
    const market = await getKqMarketSnapshot(userId, ids.slice(offset, offset + 100), { previewOnly: true });
    rawLots.push(...market.lots.filter(lot => lot.status === "ready"));
  }
  // Previewing raw lots does not change the account, so reuse its fresh snapshot.
  const energy = await getKqEnergySummary(userId);
  return { ...initial, rawLots, electricityOutstandingCents: energy.outstandingCents };
}
export async function handleKqCommerceAction(userId: string, body: Record<string, unknown>) {
  uuid(userId);
  const action = String(body.action ?? "");
  const db = createSupabaseServiceClient();
  if (action === "quote") {
    const stockId = uuid(body.stockId);
    if (!KQ_SALES_CHANNELS.includes(body.channel as KqSalesChannel) || !["discovery", "advised", "premium"].includes(String(body.policy))) throw new Error("Circuit ou prix invalide.");
    const units = body.units === undefined ? undefined : integer(body.units);
    const current = await state(userId);
    const stock = current.stocks.find(s => s.id === stockId);
    if (!stock) throw new Error("Ce stock n’est plus disponible.");
    const offer = quoteKqCommerce(current, stock, body.channel as KqSalesChannel, body.policy as KqOnlinePrice, units);
    const quoteId = randomUUID();
    const business = current.business!;
    const serverNow = Date.parse(business.serverNow);
    const growthReset = current.demand?.growthResetsAt ? Date.parse(current.demand.growthResetsAt) : Infinity;
    const businessDeadline = business.nextEventAt ? Date.parse(business.nextEventAt) : Infinity;
    const expiresAt = new Date(Math.min(serverNow + 10 * 60 * 1000, growthReset, businessDeadline)).toISOString();
    const energy = await getKqEnergySummary(userId);
    const payment = previewKqBusinessPayment(offer.payoutCents, business, energy.outstandingCents);
    Object.assign(offer, payment);
    if (!offer.reason && offer.units > 0) {
      const stored = await db.from("kq_commerce_quotes").insert({ id: quoteId, user_id: userId, stock_id: stock.id,
        account_revision: current.revision, campaign_id: current.campaign?.id ?? null, campaign_revision: current.campaign?.revision ?? null,
        stock_units: stock.remainingUnits, reputation: current.reputation, energy_outstanding_cents: energy.outstandingCents, offer, expires_at: expiresAt });
      if (stored.error) databaseError(stored.error.message);
    }
    return { quoteId, offer, expiresAt, ...payment };
  }
  const requestKey = uuid(body.requestKey);
  let payload: Record<string, unknown>;
  if (action === "prepare") {
    payload = { flowerId: uuid(body.flowerId), route: String(body.route ?? ""), expectedCostCents: integer(body.expectedCostCents) };
    await getKqMarketSnapshot(userId, [String(payload.flowerId)]);
  } else if (action === "sell") {
    payload = { quoteId: uuid(body.quoteId), expectedPayoutCents: integer(body.expectedPayoutCents) };
  } else if (action === "create-shop" || action === "rename-shop") {
    payload = { name: normalizeKqShopName(body.name) };
  } else if (action === "shop-renewal") {
    if (typeof body.enabled !== "boolean") throw new Error("Réglage de reconduction invalide.");
    payload = { enabled: body.enabled };
  } else if (action === "advertise") {
    if (!isKqAdvertisingKind(body.kind)) throw new Error("Campagne publicitaire invalide.");
    payload = { kind: body.kind };
  } else if (action === "pay-lab") {
    payload = { invoiceId: uuid(body.invoiceId) };
  } else if (action === "domiciliation") {
    if (body.mode !== "home" && body.mode !== "external") throw new Error("Domiciliation invalide.");
    payload = { mode: body.mode };
  } else if (action === "internet") {
    throw new Error("L’accès en ligne passe désormais par la création de ton shop.");
  } else if (action === "buy-computer" || action === "renew-shop") payload = {};
  else throw new Error("Opération commerciale inconnue.");
  const result = await db.rpc("rpc_kq_commerce_command", { p_user_id: userId, p_action: action, p_payload: payload, p_request_key: requestKey });
  if (result.error) databaseError(result.error.message);
  return result.data;
}
