import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";
import {
  getCurrentCustomerSessionByBackend,
  isAtLeast18,
  previewPromoCodeByBackend,
} from "@/lib/customer-backend";
import { readStoreByBackend } from "@/lib/data-backend";
import { INVOICE_SETTINGS } from "@/lib/invoice-config";
import { appendOrderByBackend } from "@/lib/order-backend";
import { applyDiscountOnLines, computeFromTtc, computeOrderTaxTotals, distributePackDiscount, sanitizeOrderVatRate } from "@/lib/tax";

type CheckoutItemPayload = {
  id: string;
  quantity: number;
  name?: string;
  price?: number;
};

type CheckoutPayload = {
  action?: "checkout" | "validate_promo";
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
  promoCode?: string;
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
  parentPackId?: string;
  parentPackName?: string;
};

async function resolveCheckoutItems(items: CheckoutItemPayload[]): Promise<ResolvedCheckoutItem[]> {
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

  const store = await readStoreByBackend();
  const productsById = new Map(store.products.map((product) => [product.id, product]));

  const resolvedItems: ResolvedCheckoutItem[] = [];
  for (const item of normalizedPayloadItems) {
    const product = productsById.get(item.id);
    if (!product) {
      throw new Error(`Produit inconnu: ${item.id}`);
    }

    const unitPrice = Number.isFinite(product.price) ? Number(product.price) : 0;
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

          const safeComponentUnitPrice = Number(distributed.priceTtc.toFixed(2));
          resolvedItems.push({
            id: component.id,
            name: sanitizeText(component.name, 120) || "Produit",
            unitPrice: safeComponentUnitPrice,
            quantity: item.quantity,
            lineTotal: Number((safeComponentUnitPrice * item.quantity).toFixed(2)),
            vatRate: sanitizeOrderVatRate(distributed.vatRate),
            parentPackId: product.id,
            parentPackName: sanitizeText(product.name, 120) || "Pack",
          });
        }
        continue;
      }
    }

    resolvedItems.push({
      id: product.id,
      name: sanitizeText(product.name, 120) || "Produit",
      unitPrice,
      quantity: item.quantity,
      lineTotal: Number((unitPrice * item.quantity).toFixed(2)),
      vatRate: sanitizeOrderVatRate(product.vatRate),
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
      return NextResponse.json({ error: "Code promo invalide ou deja utilise." }, { status: 400 });
    }

    const payloadItems = Array.isArray(payload.items) ? payload.items : [];
    let subtotal = Number.isFinite(payload.amount) ? Number(payload.amount) : 0;

    if (payloadItems.length > 0) {
      try {
        const resolvedItems = await resolveCheckoutItems(payloadItems);
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
    const discountAmount = Number(((safeSubtotal * promo.discountPercent) / 100).toFixed(2));
    const discountedTotal = Number(Math.max(safeSubtotal - discountAmount, 0).toFixed(2));

    return NextResponse.json({
      valid: true,
      code: promo.code,
      discountPercent: promo.discountPercent,
      discountAmount,
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

  let resolvedItems: ResolvedCheckoutItem[];
  try {
    resolvedItems = await resolveCheckoutItems(payloadItems);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Panier invalide." },
      { status: 400 },
    );
  }

  if (resolvedItems.length === 0) {
    return NextResponse.json({ error: "Panier invalide." }, { status: 400 });
  }

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
  const shippingAddress = sanitizeText(payload.shippingAddress, 180) || customer?.address || "";
  const shippingCity = sanitizeText(payload.shippingCity, 120) || customer?.city || "";
  const shippingPostalCode =
    sanitizeText(payload.shippingPostalCode, 16) || customer?.postalCode || "";
  const shippingCountry =
    sanitizeText(payload.shippingCountry, 80) || customer?.country || "France";

  if (
    !shippingName ||
    !shippingEmail ||
    !shippingPhone ||
    !shippingAddress ||
    !shippingCity ||
    !shippingPostalCode ||
    !shippingCountry
  ) {
    return NextResponse.json(
      { error: "Informations de livraison manquantes." },
      { status: 400 },
    );
  }

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

  let appliedPromo:
    | {
        code: string;
        discountPercent: number;
        discountAmount: number;
      }
    | null = null;

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
        { error: "Code promo invalide ou deja utilise." },
        { status: 400 },
      );
    }

    const discountAmount = Number(((preDiscountSubtotal * promo.discountPercent) / 100).toFixed(2));
    appliedPromo = {
      code: promo.code,
      discountPercent: promo.discountPercent,
      discountAmount,
    };
  }

  let finalizedItems = resolvedItems;
  if (appliedPromo && appliedPromo.discountAmount > 0) {
    const discountedLineTotals = applyDiscountOnLines(
      resolvedItems.map((item) => ({ lineTotal: item.lineTotal })),
      appliedPromo.discountAmount,
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

  const totalAmount = Number(
    finalizedItems.reduce((total, item) => total + item.lineTotal, 0).toFixed(2),
  );
  if (appliedPromo) {
    appliedPromo = {
      ...appliedPromo,
      discountAmount: Number(Math.max(preDiscountSubtotal - totalAmount, 0).toFixed(2)),
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

  const taxTotals = computeOrderTaxTotals(
    finalizedItemsWithTax.map((item) => ({
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
        city: shippingCity,
        postalCode: shippingPostalCode,
        country: shippingCountry,
        phone: shippingPhone,
      },
      promo: appliedPromo,
      viva: {
        orderCode,
      },
    });

    return NextResponse.json({
      message: "Commande enregistree. Redirection vers Viva.",
      orderId: order.id,
      redirectUrl: `${selectedEndpoint.checkoutBase}/web/checkout?ref=${orderCode}`,
    });
  } catch (error) {
    console.error("Checkout Viva error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Echec connexion Viva Smart Checkout.";
    const status = message.includes("Code promo invalide ou deja utilise.") ? 409 : 502;
    return NextResponse.json(
      {
        error: message,
      },
      { status },
    );
  }
}
