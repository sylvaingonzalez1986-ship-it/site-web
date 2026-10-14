import "server-only";
import { randomUUID } from "node:crypto";
import { createSupabaseServiceClient } from "./admin";
import { getKqMarketSnapshot } from "./kanab-quest-market-backend";
import { getKqEnergySummary } from "./kanab-quest-energy-backend";
import { KQ_SALES_CHANNELS, quoteKqCommerce, type KqCommerceState, type KqSalesChannel, type KqOnlinePrice } from "../kanab-quest-commerce";
import { isKqAdvertisingKind, normalizeKqShopName, previewKqBusinessPayment } from "../kanab-quest-business";
import { isKqStorageLot, projectKqStorageLot } from "../kanab-quest-storage";
import { KQ_ONLINE_MARKETING_MISSIONS, KQ_ONLINE_PACKAGING, KQ_ONLINE_SITE_TIERS, KQ_ONLINE_UPGRADES } from "../kanab-quest-online";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function uuid(value: unknown) { if (typeof value !== "string" || !UUID.test(value)) throw new Error("Identifiant invalide. Actualise le marché."); return value; }
function integer(value: unknown) { if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("Montant ou quantité invalide."); return value; }
function boundedInteger(value: unknown, maximum: number) {
  const parsed = integer(value);
  if (parsed < 1 || parsed > maximum) throw new Error("Montant ou quantité hors limites.");
  return parsed;
}
function onlinePayload(command: unknown, value: unknown): { command: string; payload: Record<string, unknown> } {
  if (typeof command !== "string" || !value || typeof value !== "object" || Array.isArray(value)) throw new Error("Opération de boutique invalide.");
  const input = value as Record<string, unknown>;
  let payload: Record<string, unknown>;
  if (command === "buy-packaging") {
    if (!KQ_ONLINE_PACKAGING.some(item => item.code === input.code)) throw new Error("Emballage inconnu.");
    payload = { code: input.code, quantity: boundedInteger(input.quantity, 100_000) };
  } else if (command === "create-listing") {
    if (input.formatGrams !== 5 && input.formatGrams !== 10) throw new Error("Choisis un paquet de 5 g ou 10 g.");
    const packaging = KQ_ONLINE_PACKAGING.find(item => item.code === input.packagingCode);
    if (!packaging || packaging.formatGrams !== input.formatGrams) throw new Error("L’emballage ne correspond pas au format choisi.");
    payload = { stockId: uuid(input.stockId), formatGrams: input.formatGrams, packagingCode: packaging.code,
      packets: boundedInteger(input.packets, 100_000), packetPriceCents: boundedInteger(input.packetPriceCents, 1_000_000) };
  } else if (command === "update-listing") {
    payload = { listingId: uuid(input.listingId), packetPriceCents: boundedInteger(input.packetPriceCents, 1_000_000) };
  } else if (["pause-listing", "resume-listing", "close-listing", "discard-listing"].includes(command)) {
    payload = { listingId: uuid(input.listingId) };
  } else if (command === "upgrade-site") {
    if (!KQ_ONLINE_SITE_TIERS.some(item => item.code === input.tier)) throw new Error("Formule de site inconnue.");
    payload = { tier: input.tier };
    if (input.name !== undefined) payload.name = normalizeKqShopName(input.name);
  } else if (command === "buy-upgrade") {
    if (!KQ_ONLINE_UPGRADES.some(item => item.code === input.code)) throw new Error("Amélioration inconnue.");
    payload = { code: input.code };
  } else if (command === "start-marketing") {
    const mission = KQ_ONLINE_MARKETING_MISSIONS.find(item => item.code === input.code);
    if (!mission || typeof input.angle !== "string" || !["value", "craft", "premium"].includes(input.angle)) throw new Error("Choisis une mission et un angle valides.");
    payload = { code: mission.code, angle: input.angle };
    if (mission.requiresStock || input.stockId !== undefined) payload.stockId = uuid(input.stockId);
  } else throw new Error("Opération de boutique inconnue.");
  return { command, payload };
}
function databaseError(message: string, operation?: string): never {
  const errors: Record<string, string> = {
    online_invalid_request: "Cette opération de boutique est invalide. Actualise ton commerce.",
    online_packaging_unknown: "Cet emballage n’existe pas dans le catalogue.",
    online_packaging_shortage: "Achète suffisamment d’emballages avant de conditionner ce lot.",
    online_stock_unavailable: "Ce stock n’est plus disponible. Actualise ton commerce.",
    online_storage_not_ready: "Termine le curing et range le surplus avant de proposer ce lot en ligne.",
    online_stock_reserved: "Une partie de ce lot est déjà conditionnée. Actualise le stock de vrac disponible.",
    online_price_invalid: "Choisis un prix par paquet compris entre 0,01 € et 10 000 €, avec deux décimales au maximum.",
    online_site_required: "Crée ou réactive ton site avant de publier tes produits.",
    online_computer_required: "Achète d’abord l’ordinateur dans la boutique.",
    online_cash: "Trésorerie insuffisante pour cette opération.",
    online_listing_unknown: "Cette annonce n’existe plus ou ne t’appartient pas.",
    online_listing_inactive: "Cette annonce ne peut pas être modifiée dans son état actuel.",
    online_tier_unknown: "Cette formule de site n’existe pas.",
    online_progression_required: operation === "start-marketing" ? "Cette mission n’est pas encore disponible : respecte son délai et ses commandes requises. Chaque récolte et la présentation de marque se publient une seule fois." : "Développe encore ton commerce avant cette amélioration.",
    online_branding_required: "Fais créer ton identité de marque avant d’utiliser cet emballage.",
    online_marketing_unknown: "Cette mission commerciale n’existe pas.",
    online_marketing_active: "Une mission commerciale est déjà en cours.",
    online_request_mismatch: "Cette demande a déjà servi pour une autre opération. Actualise ton commerce.",
    online_legacy_sale: "La vente en ligne passe désormais par les annonces : conditionne tes paquets et choisis leur prix.",
    commerce_storage_overflow: "Une partie de cette récolte manque de contenants. Achète du stockage ou vends son surplus aux grossistes avant de la préparer.",
    commerce_curing_required: "Ce lot termine son curing. Les grossistes restent disponibles avant son échéance.",
    commerce_storage_changed: "La conservation de ce lot a évolué. Recalcule l’offre.",
    commerce_machine_maintenance: "Une machine de cette filière doit être réparée dans ton entrepôt.",
    commerce_demand_exhausted: "Ces commandes viennent d’être prises. Actualise l’offre ou attends leur renouvellement.",
    warehouse_wholesale_exhausted: "Le volume de reprise des grossistes est épuisé pour cette période. Attends son renouvellement ou développe tes autres débouchés.",
    warehouse_processing_pending: "La transformation est en cours. Ce stock sera disponible à la fin du travail de l’atelier.",
    warehouse_drying_required: "Séchage et maturation en cours : attends la fin de cette étape dans Séchage et stockage avant de transformer ce lot.",
    commerce_offer_changed: "Les conditions ont changé. Recalcule l’offre avant de confirmer.",
    commerce_cash: "Trésorerie insuffisante. Les grossistes restent disponibles pour vendre ton stock.",
    commerce_lot_unavailable: "Ce lot a déjà été préparé ou vendu. Actualise le stock.",
    commerce_route_unavailable: "Cette transformation n’est plus accessible avec ton atelier actuel.",
    commerce_computer_owned: "Tu possèdes déjà cet ordinateur.",
    commerce_computer_required: "Achète d’abord l’ordinateur dans la boutique.",
    commerce_internet_required: "Internet doit être actif pour vendre en ligne.",
    commerce_cycle_required: "Termine une culture pour ouvrir les commandes de ton premier cycle.",
    commerce_request_mismatch: "Cette demande a déjà servi pour une autre opération. Actualise le marché.",
    commerce_shop_required: "Crée gratuitement ta boutique de base avant de vendre en ligne.",
    commerce_shop_exists: "Ton site existe déjà. Tu peux modifier son nom dans Mon commerce.",
    commerce_shop_inactive: "Ton site est suspendu. Réactive-le au tarif de ta formule pour reprendre les ventes en ligne.",
    commerce_shop_active: "La période actuelle de ton site est déjà payée.",
    commerce_shop_name: "Le nom du shop doit contenir entre 3 et 40 caractères visibles.",
    commerce_ad_active: "Une campagne publicitaire est déjà en cours.",
    commerce_ad_kind: "Cette campagne publicitaire n’existe pas.",
    commerce_lab_unavailable: "Cette analyse est déjà réglée ou ne t’appartient pas.",
    commerce_supplier_unavailable: "Cette facture fournisseur est déjà réglée ou ne t’appartient pas.",
    commerce_supplier_cash: "Trésorerie insuffisante pour solder cette facture. Le solde échu sera réglé progressivement sur les ventes.",
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
  if (current.online && current.online.version !== 1) throw new Error("[supabase:commerce] online_migration_required");
  const nowMs = Date.parse(current.business.serverNow);
  current.stocks = current.stocks.map(stock => {
    const { storageState, ...publicStock } = stock as typeof stock & { storageState?: unknown };
    if (!isKqStorageLot(storageState) || !Number.isSafeInteger(stock.storageRevision)) throw new Error("[supabase:commerce] storage_migration_required");
    return { ...publicStock, storage: projectKqStorageLot(storageState, nowMs, stock.juryScore) };
  });
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
    // A newer app must not store new indoor prices against an older SQL tariff.
    if (current.online?.version === 1 && current.customerDemand?.version !== 1) throw new Error("[supabase:commerce] customer_demand_migration_required");
    if (body.channel === "online" && current.online?.version === 1) databaseError("online_legacy_sale");
    const stock = current.stocks.find(s => s.id === stockId);
    if (!stock) throw new Error("Ce stock n’est plus disponible.");
    const offer = quoteKqCommerce(current, stock, body.channel as KqSalesChannel, body.policy as KqOnlinePrice, units);
    const quoteId = randomUUID();
    const business = current.business!;
    const serverNow = Date.parse(business.serverNow);
    const growthReset = current.demand?.growthResetsAt ? Date.parse(current.demand.growthResetsAt) : Infinity;
    const businessDeadline = business.nextEventAt ? Date.parse(business.nextEventAt) : Infinity;
    const storageDeadline = stock.storage ? Date.parse(stock.storage.nextChangeAt) : Infinity;
    const customerDemandDeadline = current.customerDemand ? Date.parse(current.customerDemand.endsAt) : Infinity;
    const expiresAt = new Date(Math.min(serverNow + 10 * 60 * 1000, growthReset, businessDeadline, storageDeadline, customerDemandDeadline)).toISOString();
    const energy = await getKqEnergySummary(userId);
    const payment = previewKqBusinessPayment(offer.payoutCents, business, energy.outstandingCents);
    Object.assign(offer, payment);
    if (!offer.reason && offer.units > 0) {
      const stored = await db.from("kq_commerce_quotes").insert({ id: quoteId, user_id: userId, stock_id: stock.id,
        account_revision: current.revision, campaign_id: current.campaign?.id ?? null, campaign_revision: current.campaign?.revision ?? null,
        stock_units: stock.remainingUnits, reputation: current.reputation, energy_outstanding_cents: energy.outstandingCents,
        storage_revision: stock.storageRevision, offer, expires_at: expiresAt });
      if (stored.error) databaseError(stored.error.message);
    }
    return { quoteId, offer, expiresAt, ...payment };
  }
  const requestKey = uuid(body.requestKey);
  if (action === "online") {
    const operation = onlinePayload(body.command, body.payload);
    const result = await db.rpc("rpc_kq_online_command", { p_user_id: userId, p_action: operation.command,
      p_payload: operation.payload, p_request_key: requestKey });
    if (result.error) databaseError(result.error.message, operation.command);
    return result.data;
  }
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
  } else if (action === "pay-lab" || action === "pay-supplier") {
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
