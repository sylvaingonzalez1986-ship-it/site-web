import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";
import {
  getCurrentCustomerSessionByBackend,
  isAtLeast18,
  previewPromoCodeByBackend,
} from "@/lib/customer-backend";
import { readPublicStoreByBackend } from "@/lib/data-backend";
import { INVOICE_SETTINGS } from "@/lib/invoice-config";
import { buildLoyaltySummaryWithBonus } from "@/lib/loyalty";
import {
  getBadgeDiscountPercent,
  getBadgeFreeShippingThreshold,
} from "@/lib/loyalty-tier-benefits";
import { computeLotteryTicketBreakdown } from "@/lib/lottery-ticket-calculations";
import {
  getRedeemableLotteryRewardClaimBenefitByBackend,
  getLotteryConfigByBackend,
  reserveLotteryRewardClaimForOrderByBackend,
} from "@/lib/lottery-backend";
import { appendOrderByBackend, getCustomerOrdersForLoyaltyByBackend } from "@/lib/order-backend";
import { getAvailableQuantity } from "@/lib/product-stock";
import {
  computeReferralFirstOrderDiscountAmount,
  REFERRAL_FIRST_ORDER_AUTO_DISCOUNT_CODE,
  REFERRAL_FIRST_ORDER_AUTO_DISCOUNT_PERCENT,
} from "@/lib/referral-first-order-discount";
import { isReferralFirstOrderDiscountEligibleByBackend } from "@/lib/referral-backend";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";
import {
  computeShippingFee,
  getShippingPricingConfig,
  type DeliveryMethod,
} from "@/lib/shipping";
import { applyDiscountOnLines, computeFromTtc, computeOrderTaxTotals, distributePackDiscount, sanitizeOrderVatRate } from "@/lib/tax";
import type { CmsStore } from "@/types/store";

type CheckoutItemPayload = {
  id: string;
  quantity: number;
  name?: string;
  price?: number;
};

type CheckoutPayload = {
  action?: "checkout" | "validate_promo" | "validate_reward_claim";
  amount?: number;
  itemsCount?: number;
  items?: CheckoutItemPayload[];
  shippingName?: string;
  shippingEmail?: string;
  shippingPhone?: string;
  shippingAddress?: string;
  shippingCity?: string;
  shippingPostalCode?: string;
  shippingCountry?: string;
  deliveryMethod?: DeliveryMethod;
  deliveryFeeEur?: number;
  relayId?: string;
  relayName?: string;
  relayAddress?: string;
  relayPostalCode?: string;
  relayCity?: string;
  relayCountry?: string;
  promoCode?: string;
  lotteryRewardClaimId?: string;
};

type VivaTokenResponse = {
  access_token?: string;
};

type VivaCreateOrderResponse = {
  orderCode?: number;
};

type VivaSummaryItem = {
  name: string;
  quantity: number;
};

function buildVivaItemSummary(items: VivaSummaryItem[]): {
  customerTrns: string;
  merchantTrns: string;
} {
  const lines = items
    .map((item) => `${Math.max(1, item.quantity)}x ${sanitizeText(item.name, 80) || "Article"}`)
    .filter(Boolean);

  const joined = lines.join(" | ");
  const customerTrns = `Articles: ${joined}`.slice(0, 255);
  const merchantTrns = `Panier: ${joined}`.slice(0, 512);

  return {
    customerTrns: customerTrns || "Articles boutique",
    merchantTrns: merchantTrns || "Commande boutique",
  };
}

type ResolvedCheckoutItem = {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  vatRate: 5.5 | 20;
  bonusPoints?: number;
  parentPackId?: string;
  parentPackName?: string;
};

async function resolveCheckoutItems(
  items: CheckoutItemPayload[],
  storeOverride?: Pick<CmsStore, "products">,
): Promise<ResolvedCheckoutItem[]> {
  const normalizedPayloadItems = items
    .map((item) => ({
      id: sanitizeText(item.id, 120),
      quantity:
        Number.isFinite(item.quantity) && Number(item.quantity) > 0
          ? Math.floor(Number(item.quantity))
          : 0,
    }))
    .filter((item) => item.id && item.quantity > 0);

  if (normalizedPayloadItems.length === 0) {
    return [];
  }

  const store = storeOverride ?? (await readPublicStoreByBackend());
  const productsById = new Map(store.products.map((product) => [product.id, product]));

  const resolvedItems: ResolvedCheckoutItem[] = [];
  for (const item of normalizedPayloadItems) {
    const [baseProductIdRaw, variantIdRaw] = item.id.split("::", 2);
    const baseProductId = sanitizeText(baseProductIdRaw, 120);
    const selectedVariantId = sanitizeText(variantIdRaw, 120);
    const product = productsById.get(baseProductId);
    if (!product) {
      throw new Error(`Produit inconnu: ${item.id}`);
    }

    const selectedVariant =
      selectedVariantId && Array.isArray(product.variantOptions)
        ? product.variantOptions.find((variant) => variant.id === selectedVariantId)
        : undefined;

    if (selectedVariantId && !selectedVariant) {
      throw new Error(`Variante inconnue pour le produit: ${product.name}`);
    }

    if (selectedVariant && (selectedVariant.enabled === false || selectedVariant.inStock === false)) {
      throw new Error(`Variante en rupture pour le produit: ${product.name}`);
    }

    const unitPrice = selectedVariant
      ? Number(selectedVariant.price)
      : Number.isFinite(product.price)
        ? Number(product.price)
        : 0;
    if (unitPrice <= 0) {
      throw new Error(`Prix invalide pour le produit: ${product.name}`);
    }

    if (product.isPack && Array.isArray(product.packProductIds) && product.packProductIds.length > 0) {
      const components = product.packProductIds
        .map((componentId) => productsById.get(componentId))
        .filter((component): component is NonNullable<typeof component> => Boolean(component && !component.isPack));

      if (components.length > 0) {
        const distributedComponents = distributePackDiscount(
          components.map((component) => ({
            price: component.price,
            vatRate: sanitizeOrderVatRate(component.vatRate),
          })),
          unitPrice,
        );

        for (let componentIndex = 0; componentIndex < components.length; componentIndex += 1) {
          const component = components[componentIndex];
          const distributed = distributedComponents[componentIndex];
          if (!distributed || distributed.priceTtc <= 0) {
            continue;
          }

          const availableComponentQuantity = getAvailableQuantity(component, "");
          if (availableComponentQuantity !== null && availableComponentQuantity < item.quantity) {
            throw new Error(`Stock insuffisant pour ${component.name}.`);
          }

          const safeComponentUnitPrice = Number(distributed.priceTtc.toFixed(2));
          resolvedItems.push({
            id: component.id,
            name: sanitizeText(component.name, 120) || "Produit",
            unitPrice: safeComponentUnitPrice,
            quantity: item.quantity,
            lineTotal: Number((safeComponentUnitPrice * item.quantity).toFixed(2)),
            vatRate: sanitizeOrderVatRate(distributed.vatRate),
            bonusPoints: component.bonusPoints,
            parentPackId: product.id,
            parentPackName: sanitizeText(product.name, 120) || "Pack",
          });
        }
        continue;
      }
    }

    const availableQuantity = getAvailableQuantity(product, selectedVariantId);
    if (availableQuantity !== null && availableQuantity < item.quantity) {
      throw new Error(`Stock insuffisant pour ${product.name}.`);
    }

    resolvedItems.push({
      id: selectedVariantId ? `${product.id}::${selectedVariantId}` : product.id,
      name: sanitizeText(
        selectedVariant ? `${product.name} - ${selectedVariant.label}` : product.name,
        120,
      ) || "Produit",
      unitPrice,
      quantity: item.quantity,
      lineTotal: Number((unitPrice * item.quantity).toFixed(2)),
      vatRate: sanitizeOrderVatRate(product.vatRate),
      bonusPoints: product.bonusPoints,
    });
  }

  return resolvedItems;
}

function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function sanitizePhone(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .replace(/[^\d+().\-\s]/g, "")
    .slice(0, 40);
}

function sanitizePromoCode(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toUpperCase().slice(0, 24);
}

function sanitizeLotteryRewardClaimId(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function sanitizeDeliveryMethod(value: unknown): DeliveryMethod {
  return value === "relay" ? "relay" : "home";
}

type VivaEndpointConfig = {
  mode: "live" | "demo";
  apiBase: string;
  accountsBase: string;
  checkoutBase: string;
};

type VivaConfig = {
  isConfigured: boolean;
  clientId: string;
  clientSecret: string;
  sourceCode: string;
  candidates: VivaEndpointConfig[];
};

function getVivaConfig(): VivaConfig {
  const env = process.env.VIVA_ENV?.trim().toLowerCase() || "auto";
  const clientId = process.env.VIVA_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.VIVA_CLIENT_SECRET?.trim() || "";
  const sourceCode = process.env.VIVA_SOURCE_CODE?.trim() || "";

  const live: VivaEndpointConfig = {
    mode: "live",
    apiBase: "https://api.vivapayments.com",
    accountsBase: "https://accounts.vivapayments.com",
    checkoutBase: "https://www.vivapayments.com",
  };

  const demo: VivaEndpointConfig = {
    mode: "demo",
    apiBase: "https://demo-api.vivapayments.com",
    accountsBase: "https://demo-accounts.vivapayments.com",
    checkoutBase: "https://demo.vivapayments.com",
  };

  let candidates: VivaEndpointConfig[];
  if (env === "live" || env === "production") {
    candidates = [live];
  } else if (env === "demo" || env === "sandbox") {
    candidates = [demo];
  } else {
    // Auto mode: try live first, then demo.
    candidates = [live, demo];
  }

  return {
    isConfigured: Boolean(clientId && clientSecret && sourceCode),
    clientId,
    clientSecret,
    sourceCode,
    candidates,
  };
}

function toCountryCode(country: string): string {
  const value = country.trim().toUpperCase();
  if (value.length === 2 && /^[A-Z]{2}$/.test(value)) {
    return value;
  }

  if (value === "FRANCE") {
    return "FR";
  }

  return "FR";
}

async function getVivaAccessToken(
  config: VivaConfig,
  endpoint: VivaEndpointConfig,
): Promise<string> {
  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  const response = await fetch(`${endpoint.accountsBase}/connect/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!response.ok) {
    const vivaError = await response.text().catch(() => "");
    throw new Error(
      `Echec authentification Viva (${endpoint.mode}, ${response.status}). ${vivaError.slice(0, 220)}`,
    );
  }

  const data = (await response.json()) as VivaTokenResponse;
  if (!data.access_token) {
    throw new Error("Token Viva manquant.");
  }

  return data.access_token;
}

async function createVivaCheckoutOrder(input: {
  config: VivaConfig;
  endpoint: VivaEndpointConfig;
  accessToken: string;
  amount: number;
  sourceCode: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCountry: string;
  merchantTrns: string;
  customerTrns: string;
}): Promise<number> {
  const amountInMinorUnits = Math.round(input.amount * 100);
  if (!Number.isFinite(amountInMinorUnits) || amountInMinorUnits <= 0) {
    throw new Error("Montant Viva invalide.");
  }

  const response = await fetch(`${input.endpoint.apiBase}/checkout/v2/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountInMinorUnits,
      sourceCode: input.sourceCode,
      customerTrns: input.customerTrns,
      merchantTrns: input.merchantTrns,
      customer: {
        email: input.customerEmail,
        fullName: input.customerName,
        phone: input.customerPhone,
        countryCode: toCountryCode(input.customerCountry),
        requestLang: "fr-FR",
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const vivaError = await response.text().catch(() => "");
    throw new Error(
      `Creation commande Viva impossible (${input.endpoint.mode}, ${response.status}). ${vivaError.slice(0, 220)}`,
    );
  }

  const data = (await response.json()) as VivaCreateOrderResponse;
  if (!data.orderCode || !Number.isFinite(data.orderCode)) {
    throw new Error("orderCode Viva introuvable.");
  }

  return data.orderCode;
}

export async function POST(request: Request) {
  const payload = (await request.json()) as CheckoutPayload;
  const action = payload.action ?? "checkout";
  const isTaxable = INVOICE_SETTINGS.vatMode === "taxable";
  const session = await getCurrentCustomerSessionByBackend();
  const customerId = session?.customerId;
  const customer = session?.customer ?? null;
  const promoCode = sanitizePromoCode(payload.promoCode);
  const lotteryRewardClaimId = sanitizeLotteryRewardClaimId(payload.lotteryRewardClaimId);
  const ip = getRequestIp(request);

  if (action === "validate_promo") {
    if (!promoCode) {
      return NextResponse.json({ error: "Code promo manquant." }, { status: 400 });
    }
    if (!customerId) {
      return NextResponse.json(
        { error: "Connecte-toi pour utiliser un code promo personnel." },
        { status: 401 },
      );
    }

    const promo = await previewPromoCodeByBackend(customerId, promoCode);
    if (!promo) {
      return NextResponse.json({ error: "Code promo invalide ou déjà utilisé." }, { status: 400 });
    }

    const store = await readPublicStoreByBackend();
    const customerOrders = await getCustomerOrdersForLoyaltyByBackend({
      customerId,
      customerEmail: customer?.email ?? "",
    });
    const loyaltySummary = buildLoyaltySummaryWithBonus(
      customerOrders,
      customer?.loyaltyPoints ?? 0,
      customer?.loyaltyPointsSpent ?? 0,
    );
    const badgeDiscountPercent = loyaltySummary.currentBadge.unlocked
      ? getBadgeDiscountPercent(store.content.profile, loyaltySummary.currentBadge.id)
      : 0;

    const payloadItems = Array.isArray(payload.items) ? payload.items : [];
    let subtotal = Number.isFinite(payload.amount) ? Number(payload.amount) : 0;

    if (payloadItems.length > 0) {
      try {
        const resolvedItems = await resolveCheckoutItems(payloadItems, store);
        subtotal = resolvedItems.reduce((total, item) => total + item.lineTotal, 0);
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Panier invalide." },
          { status: 400 },
        );
      }
    }

    if (!Number.isFinite(subtotal) || subtotal <= 0) {
      return NextResponse.json({ error: "Montant invalide." }, { status: 400 });
    }

    const safeSubtotal = Number(subtotal.toFixed(2));
    const badgeDiscountAmount = Number(((safeSubtotal * badgeDiscountPercent) / 100).toFixed(2));
    const subtotalAfterBadge = Number(Math.max(safeSubtotal - badgeDiscountAmount, 0).toFixed(2));
    const promoDiscountAmount = Number(((subtotalAfterBadge * promo.discountPercent) / 100).toFixed(2));
    const discountedTotal = Number(Math.max(subtotalAfterBadge - promoDiscountAmount, 0).toFixed(2));

    return NextResponse.json({
      valid: true,
      code: promo.code,
      promoDiscountPercent: promo.discountPercent,
      promoDiscountAmount,
      badgeDiscountPercent,
      badgeDiscountAmount,
      discountPercent: promo.discountPercent,
      discountAmount: Number((promoDiscountAmount + badgeDiscountAmount).toFixed(2)),
      discountedTotal,
    });
  }

  if (action === "validate_reward_claim") {
    if (!customerId) {
      return NextResponse.json(
        { error: "Connecte-toi pour utiliser un ticket gagnant." },
        { status: 401 },
      );
    }

    if (!lotteryRewardClaimId) {
      return NextResponse.json({ error: "Lot manquant." }, { status: 400 });
    }

    const store = await readPublicStoreByBackend();
    const customerOrders = await getCustomerOrdersForLoyaltyByBackend({
      customerId,
      customerEmail: customer?.email ?? "",
    });
    const loyaltySummary = buildLoyaltySummaryWithBonus(
      customerOrders,
      customer?.loyaltyPoints ?? 0,
      customer?.loyaltyPointsSpent ?? 0,
    );
    const badgeDiscountPercent = loyaltySummary.currentBadge.unlocked
      ? getBadgeDiscountPercent(store.content.profile, loyaltySummary.currentBadge.id)
      : 0;

    const payloadItems = Array.isArray(payload.items) ? payload.items : [];
    let subtotal = Number.isFinite(payload.amount) ? Number(payload.amount) : 0;

    if (payloadItems.length > 0) {
      try {
        const resolvedItems = await resolveCheckoutItems(payloadItems, store);
        subtotal = resolvedItems.reduce((total, item) => total + item.lineTotal, 0);
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Panier invalide." },
          { status: 400 },
        );
      }
    }

    if (!Number.isFinite(subtotal) || subtotal <= 0) {
      return NextResponse.json({ error: "Montant invalide." }, { status: 400 });
    }

    const rewardClaimBenefit = await getRedeemableLotteryRewardClaimBenefitByBackend({
      userId: customerId,
      claimId: lotteryRewardClaimId,
    });
    if (!rewardClaimBenefit) {
      return NextResponse.json({ error: "Ticket gagnant invalide ou déjà utilise." }, { status: 400 });
    }

    const safeSubtotal = Number(subtotal.toFixed(2));
    const badgeDiscountAmount = Number(((safeSubtotal * badgeDiscountPercent) / 100).toFixed(2));
    const subtotalAfterBadge = Number(Math.max(safeSubtotal - badgeDiscountAmount, 0).toFixed(2));
    const isDiscount = rewardClaimBenefit.rewardType === "discount";
    const lotteryDiscountPercent = isDiscount
      ? (rewardClaimBenefit.discountPercent ?? 0)
      : 0;
    const lotteryDiscountAmount = Number(
      ((subtotalAfterBadge * lotteryDiscountPercent) / 100).toFixed(2),
    );
    const discountedTotal = Number(Math.max(subtotalAfterBadge - lotteryDiscountAmount, 0).toFixed(2));

    return NextResponse.json({
      valid: true,
      claimId: rewardClaimBenefit.claimId,
      rewardType: rewardClaimBenefit.rewardType,
      rewardTitle: rewardClaimBenefit.title,
      rewardDescription: rewardClaimBenefit.description,
      generatedCode: rewardClaimBenefit.generatedCode,
      giftLabel:
        rewardClaimBenefit.rewardType === "gift"
          ? rewardClaimBenefit.giftLabel
          : undefined,
      lotteryDiscountPercent,
      lotteryDiscountAmount,
      badgeDiscountPercent,
      badgeDiscountAmount,
      discountedTotal,
    });
  }

  const payloadItems = Array.isArray(payload.items) ? payload.items : [];
  if (payloadItems.length === 0) {
    return NextResponse.json({ error: "Panier invalide." }, { status: 400 });
  }
  if (!customerId || !customer) {
    return NextResponse.json({ error: "Connexion requise pour commander." }, { status: 401 });
  }

  const rateLimitKey = `checkout_viva:${customerId}:${ip}`;
  const rl = await hitRateLimit({ key: rateLimitKey, windowSeconds: 60, maxHits: 5 });
  if (!rl.allowed) {
    logRateLimitRejection({
      endpoint: "POST /api/checkout/viva",
      key: rateLimitKey,
      ip,
      actorEmail: customer.email,
      retryAfterSeconds: rl.retryAfterSeconds,
      maxHits: 5,
      windowSeconds: 60,
    });

    return NextResponse.json({ error: "Trop de requetes." }, { status: 429 });
  }

  if (!customer.dateOfBirth) {
    return NextResponse.json(
      { error: "Date de naissance requise pour commander (18+)." },
      { status: 403 },
    );
  }
  if (!isAtLeast18(customer.dateOfBirth)) {
    return NextResponse.json(
      { error: "Commande reservee aux personnes majeures (18+)." },
      { status: 403 },
    );
  }

  const store = await readPublicStoreByBackend();

  let resolvedItems: ResolvedCheckoutItem[];
  try {
    resolvedItems = await resolveCheckoutItems(payloadItems, store);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Panier invalide." },
      { status: 400 },
    );
  }

  if (resolvedItems.length === 0) {
    return NextResponse.json({ error: "Panier invalide." }, { status: 400 });
  }

  const customerOrders = await getCustomerOrdersForLoyaltyByBackend({
    customerId,
    customerEmail: customer.email,
  });
  const loyaltySummary = buildLoyaltySummaryWithBonus(
    customerOrders,
    customer.loyaltyPoints ?? 0,
    customer.loyaltyPointsSpent ?? 0,
  );
  const badgeDiscountPercent = loyaltySummary.currentBadge.unlocked
    ? getBadgeDiscountPercent(store.content.profile, loyaltySummary.currentBadge.id)
    : 0;
  const badgeFreeShippingThreshold = getBadgeFreeShippingThreshold(
    loyaltySummary.currentBadge.id,
    loyaltySummary.currentBadge.unlocked,
  );

  const preDiscountSubtotal = Number(
    resolvedItems.reduce((total, item) => total + item.lineTotal, 0).toFixed(2),
  );
  const serverItemsCount = resolvedItems.reduce((total, item) => total + item.quantity, 0);

  if (preDiscountSubtotal <= 0 || serverItemsCount <= 0) {
    return NextResponse.json({ error: "Panier invalide." }, { status: 400 });
  }

  const shippingName =
    sanitizeText(payload.shippingName, 120) ||
    (customer ? `${customer.firstName} ${customer.lastName}`.trim() : "");
  const shippingEmail = sanitizeText(payload.shippingEmail, 120) || customer?.email || "";
  const shippingPhone = sanitizePhone(payload.shippingPhone) || customer?.phone || "";
  const requestedDeliveryMethod = sanitizeDeliveryMethod(payload.deliveryMethod);
  const shippingAddressInput = sanitizeText(payload.shippingAddress, 180) || customer?.address || "";
  const shippingCity = sanitizeText(payload.shippingCity, 120) || customer?.city || "";
  const shippingPostalCode =
    sanitizeText(payload.shippingPostalCode, 16) || customer?.postalCode || "";
  const shippingCountry =
    sanitizeText(payload.shippingCountry, 80) || customer?.country || "France";
  const relayId = sanitizeText(payload.relayId, 120);
  const relayName = sanitizeText(payload.relayName, 180);
  const relayAddress = sanitizeText(payload.relayAddress, 200);
  const relayCity = sanitizeText(payload.relayCity, 120);
  const relayPostalCode = sanitizeText(payload.relayPostalCode, 16);
  const relayCountry = sanitizeText(payload.relayCountry, 80) || shippingCountry;

  if (
    !shippingName ||
    !shippingEmail ||
    !shippingPhone ||
    !shippingCity ||
    !shippingPostalCode ||
    !shippingCountry
  ) {
    return NextResponse.json(
      { error: "Informations de livraison manquantes." },
      { status: 400 },
    );
  }

  if (requestedDeliveryMethod === "home" && !shippingAddressInput) {
    return NextResponse.json(
      { error: "Adresse de livraison manquante." },
      { status: 400 },
    );
  }

  if (
    requestedDeliveryMethod === "relay" &&
    (!relayId || !relayName || !relayAddress || !relayCity || !relayPostalCode)
  ) {
    return NextResponse.json(
      { error: "Point Relais incomplet. Selectionne un relais avant paiement." },
      { status: 400 },
    );
  }

  const shippingAddress =
    requestedDeliveryMethod === "relay" ? relayAddress : shippingAddressInput;

  const config = getVivaConfig();
  const legacyConfigured = Boolean(
    process.env.VIVA_MERCHANT_ID?.trim() && process.env.VIVA_API_KEY?.trim(),
  );

  if (!config.isConfigured) {
    const message = legacyConfigured
      ? "Configuration Viva obsolete detectee (merchant/api key). Configure VIVA_CLIENT_ID, VIVA_CLIENT_SECRET et VIVA_SOURCE_CODE."
      : "Paiement carte indisponible: Viva Smart Checkout non configure.";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  if (promoCode && lotteryRewardClaimId) {
    return NextResponse.json(
      { error: "Le code promo et le ticket gagnant ne sont pas cumulables." },
      { status: 400 },
    );
  }

  let appliedPromo:
    | {
        code: string;
        discountPercent: number;
        discountAmount: number;
        consumeCode?: boolean;
      }
    | null = null;
  let appliedRewardClaim:
    | {
        claimId: string;
        title: string;
        description: string;
        rewardType: "discount" | "gift";
        discountPercent: number;
        discountAmount: number;
        giftLabel?: string;
      }
    | null = null;
  let requestedDiscountAmount = 0;
  const requestedBadgeDiscountAmount = Number(
    ((preDiscountSubtotal * badgeDiscountPercent) / 100).toFixed(2),
  );
  requestedDiscountAmount = requestedBadgeDiscountAmount;
  const subtotalAfterBadge = Number(
    Math.max(preDiscountSubtotal - requestedBadgeDiscountAmount, 0).toFixed(2),
  );

  if (promoCode) {
    if (!customerId) {
      return NextResponse.json(
        { error: "Connecte-toi pour utiliser un code promo personnel." },
        { status: 401 },
      );
    }

    const promo = await previewPromoCodeByBackend(customerId, promoCode);
    if (!promo) {
      return NextResponse.json(
        { error: "Code promo invalide ou déjà utilisé." },
        { status: 400 },
      );
    }

    const discountAmount = Number(((subtotalAfterBadge * promo.discountPercent) / 100).toFixed(2));
    appliedPromo = {
      code: promo.code,
      discountPercent: promo.discountPercent,
      discountAmount,
    };
    requestedDiscountAmount = Number((requestedBadgeDiscountAmount + discountAmount).toFixed(2));
  }

  if (lotteryRewardClaimId) {
    if (!customerId) {
      return NextResponse.json(
        { error: "Connecte-toi pour utiliser un ticket gagnant." },
        { status: 401 },
      );
    }

    const rewardClaimBenefit = await getRedeemableLotteryRewardClaimBenefitByBackend({
      userId: customerId,
      claimId: lotteryRewardClaimId,
    });
    if (!rewardClaimBenefit) {
      return NextResponse.json(
        { error: "Ticket gagnant invalide ou déjà utilisé." },
        { status: 400 },
      );
    }

    const isDiscount = rewardClaimBenefit.rewardType === "discount";
    const discountPercent = isDiscount
      ? (rewardClaimBenefit.discountPercent ?? 0)
      : 0;
    const discountAmount = Number(((subtotalAfterBadge * discountPercent) / 100).toFixed(2));
    appliedRewardClaim = {
      claimId: rewardClaimBenefit.claimId,
      title: rewardClaimBenefit.title,
      description: rewardClaimBenefit.description,
      rewardType: rewardClaimBenefit.rewardType,
      discountPercent,
      discountAmount,
      giftLabel: rewardClaimBenefit.rewardType === "gift"
        ? rewardClaimBenefit.giftLabel
        : undefined,
    };
    requestedDiscountAmount = Number((requestedBadgeDiscountAmount + discountAmount).toFixed(2));
  }

  if (!appliedPromo && !appliedRewardClaim && customerId) {
    const isReferralAutoDiscountEligible = await isReferralFirstOrderDiscountEligibleByBackend({
      userId: customerId,
      hasManualDiscount: false,
    });

    if (isReferralAutoDiscountEligible) {
      const discountAmount = computeReferralFirstOrderDiscountAmount(
        subtotalAfterBadge,
        REFERRAL_FIRST_ORDER_AUTO_DISCOUNT_PERCENT,
      );
      appliedPromo = {
        code: REFERRAL_FIRST_ORDER_AUTO_DISCOUNT_CODE,
        discountPercent: REFERRAL_FIRST_ORDER_AUTO_DISCOUNT_PERCENT,
        discountAmount,
        consumeCode: false,
      };
      requestedDiscountAmount = Number((requestedBadgeDiscountAmount + discountAmount).toFixed(2));
    }
  }

  let finalizedItems = resolvedItems;
  if (requestedDiscountAmount > 0) {
    const discountedLineTotals = applyDiscountOnLines(
      resolvedItems.map((item) => ({ lineTotal: item.lineTotal })),
      requestedDiscountAmount,
    );
    finalizedItems = resolvedItems.map((item, index) => {
      const lineTotal = discountedLineTotals[index] ?? item.lineTotal;
      return {
        ...item,
        lineTotal,
        unitPrice: Number((lineTotal / item.quantity).toFixed(4)),
      };
    });
  }

  const itemsTotalAmount = Number(
    finalizedItems.reduce((total, item) => total + item.lineTotal, 0).toFixed(2),
  );
  const effectiveDiscountAmount = Number(
    Math.max(preDiscountSubtotal - itemsTotalAmount, 0).toFixed(2),
  );
  const shippingPricingConfig = getShippingPricingConfig();
  const shippingFee = computeShippingFee({
    method: requestedDeliveryMethod,
    subtotalAfterDiscount: itemsTotalAmount,
    config: shippingPricingConfig,
    badgeFreeShippingThresholdEur: badgeFreeShippingThreshold,
  });
  const totalAmount = Number((itemsTotalAmount + shippingFee).toFixed(2));
  const lotteryConfig = await getLotteryConfigByBackend();
  const ticketBreakdown = computeLotteryTicketBreakdown({
    orderAmount: totalAmount,
    config: lotteryConfig,
    badgeId: loyaltySummary.currentBadge.id,
    badgeUnlocked: loyaltySummary.currentBadge.unlocked,
  });
  if (appliedPromo) {
    appliedPromo = {
      ...appliedPromo,
      discountAmount: effectiveDiscountAmount,
    };
  }
  if (appliedRewardClaim && appliedRewardClaim.rewardType === "discount") {
    appliedRewardClaim = {
      ...appliedRewardClaim,
      discountAmount: effectiveDiscountAmount,
    };
  }

  const finalizedItemsWithTax = finalizedItems.map((item) => {
    const taxSplit = computeFromTtc(item.lineTotal, item.vatRate, { taxable: isTaxable });
    return {
      ...item,
      unitPriceHt: Number((taxSplit.ht / item.quantity).toFixed(4)),
      lineTotalHt: taxSplit.ht,
      lineVatAmount: taxSplit.vat,
    };
  });
  if (appliedRewardClaim && appliedRewardClaim.rewardType === "gift") {
    finalizedItemsWithTax.push({
      id: `gift-reward-${appliedRewardClaim.claimId}`,
      name: `Lot ticket: ${appliedRewardClaim.giftLabel ?? appliedRewardClaim.title}`,
      unitPrice: 0,
      quantity: 1,
      lineTotal: 0,
      vatRate: 20,
      unitPriceHt: 0,
      lineTotalHt: 0,
      lineVatAmount: 0,
    });
  }

  const taxComputationItems = [...finalizedItemsWithTax];
  if (shippingFee > 0) {
    const shippingTaxSplit = computeFromTtc(shippingFee, 20, { taxable: isTaxable });
    taxComputationItems.push({
      id: "delivery-fee",
      name: requestedDeliveryMethod === "relay" ? "Livraison point relais" : "Livraison domicile",
      unitPrice: shippingFee,
      quantity: 1,
      lineTotal: shippingFee,
      vatRate: 20,
      unitPriceHt: shippingTaxSplit.ht,
      lineTotalHt: shippingTaxSplit.ht,
      lineVatAmount: shippingTaxSplit.vat,
    });
  }

  const taxTotals = computeOrderTaxTotals(
    taxComputationItems.map((item) => ({
      productId: item.id,
      name: item.name,
      unitPrice: item.unitPrice,
      unitPriceHt: item.unitPriceHt,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
      lineTotalHt: item.lineTotalHt,
      lineVatAmount: item.lineVatAmount,
      vatRate: item.vatRate,
      parentPackId: item.parentPackId,
      parentPackName: item.parentPackName,
    })),
    { taxable: isTaxable },
  );
  const taxConsistentTotal = Number((taxTotals.totalHt + taxTotals.totalVat).toFixed(2));
  if (Math.abs(taxConsistentTotal - totalAmount) > 0.01) {
    return NextResponse.json(
      { error: "Incoherence fiscale sur le total de commande." },
      { status: 500 },
    );
  }

  try {
    const vivaSummary = buildVivaItemSummary(
      finalizedItemsWithTax.map((item) => ({ name: item.name, quantity: item.quantity })),
    );
    let selectedEndpoint: VivaEndpointConfig | null = null;
    let orderCode: number | null = null;
    const errors: string[] = [];

    for (const endpoint of config.candidates) {
      try {
        const accessToken = await getVivaAccessToken(config, endpoint);
        orderCode = await createVivaCheckoutOrder({
          config,
          endpoint,
          accessToken,
          amount: totalAmount,
          sourceCode: config.sourceCode,
          customerName: shippingName,
          customerEmail: shippingEmail,
          customerPhone: shippingPhone,
          customerCountry: shippingCountry,
          merchantTrns: `${vivaSummary.merchantTrns} - ${new Date().toISOString()}`.slice(0, 512),
          customerTrns: vivaSummary.customerTrns,
        });
        selectedEndpoint = endpoint;
        break;
      } catch (attemptError) {
        errors.push(attemptError instanceof Error ? attemptError.message : "Erreur Viva inconnue.");
      }
    }

    if (!selectedEndpoint || !orderCode) {
      throw new Error(errors.join(" | ") || "Echec connexion Viva Smart Checkout.");
    }

    const order = await appendOrderByBackend({
      items: finalizedItemsWithTax.map((item) => ({
        productId: item.id,
        name: item.name,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        vatRate: item.vatRate,
        unitPriceHt: item.unitPriceHt,
        lineTotalHt: item.lineTotalHt,
        lineVatAmount: item.lineVatAmount,
        bonusPoints: item.bonusPoints,
        parentPackId: item.parentPackId,
        parentPackName: item.parentPackName,
        quantity: item.quantity,
      })),
      totalAmount,
      itemsCount: serverItemsCount,
      totalHt: taxTotals.totalHt,
      totalVat: taxTotals.totalVat,
      vatBreakdown: taxTotals.vatBreakdown,
      paymentState: "pending",
      status: "pending_payment",
      customer: {
        id: customer?.id,
        email: shippingEmail,
        name: shippingName,
      },
      shipping: {
        address: shippingAddress,
        city: requestedDeliveryMethod === "relay" ? relayCity : shippingCity,
        postalCode:
          requestedDeliveryMethod === "relay" ? relayPostalCode : shippingPostalCode,
        country: requestedDeliveryMethod === "relay" ? relayCountry : shippingCountry,
        phone: shippingPhone,
        deliveryMethod: requestedDeliveryMethod,
        deliveryFee: shippingFee,
        relayProvider:
          requestedDeliveryMethod === "relay" ? "mondial_relay" : undefined,
        relayId: requestedDeliveryMethod === "relay" ? relayId : undefined,
        relayName: requestedDeliveryMethod === "relay" ? relayName : undefined,
        relayAddress:
          requestedDeliveryMethod === "relay" ? relayAddress : undefined,
        relayPostalCode:
          requestedDeliveryMethod === "relay" ? relayPostalCode : undefined,
        relayCity: requestedDeliveryMethod === "relay" ? relayCity : undefined,
        relayCountry: requestedDeliveryMethod === "relay" ? relayCountry : undefined,
      },
      promo: appliedPromo,
      loyaltySnapshot: {
        badgeId: loyaltySummary.currentBadge.id,
        extraLotteryTickets: ticketBreakdown.bonusTickets,
      },
      viva: {
        orderCode,
      },
    });

    if (appliedRewardClaim && customerId) {
      try {
        await reserveLotteryRewardClaimForOrderByBackend({
          userId: customerId,
          claimId: appliedRewardClaim.claimId,
          orderId: order.id,
        });
      } catch (claimError) {
        console.error("Reward claim reservation error:", claimError);
      }
    }

    return NextResponse.json({
      message: "Commande enregistrée. Redirection vers Viva.",
      orderId: order.id,
      redirectUrl: `${selectedEndpoint.checkoutBase}/web/checkout?ref=${orderCode}`,
    });
  } catch (error) {
    console.error("Checkout Viva error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Échec connexion Viva Smart Checkout.";
    const status = message.includes("Code promo invalide ou déjà utilisé.") ? 409 : 502;
    return NextResponse.json(
      {
        error: message,
      },
      { status },
    );
  }
}
