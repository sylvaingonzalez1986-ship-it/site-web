import "server-only";

import { Buffer } from "node:buffer";

export type VivaEndpointConfig = {
  mode: "live" | "demo";
  apiBase: string;
  accountsBase: string;
  checkoutBase: string;
};

export type VivaConfig = {
  isConfigured: boolean;
  configurationError?: string;
  clientId: string;
  clientSecret: string;
  sourceCode: string;
  endpoint: VivaEndpointConfig;
};

export type VivaVerifiedTransaction = {
  orderCode: string;
  transactionId: string;
  sourceCode: string;
  statusId: string;
  amountInMinorUnits: number;
  currencyCode: string;
};

const LIVE_ENDPOINT: VivaEndpointConfig = {
  mode: "live",
  apiBase: "https://api.vivapayments.com",
  accountsBase: "https://accounts.vivapayments.com",
  checkoutBase: "https://www.vivapayments.com",
};

const DEMO_ENDPOINT: VivaEndpointConfig = {
  mode: "demo",
  apiBase: "https://demo-api.vivapayments.com",
  accountsBase: "https://demo-accounts.vivapayments.com",
  checkoutBase: "https://demo.vivapayments.com",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown, maxLength: number): string {
  if (typeof value === "string") {
    return value.trim().slice(0, maxLength);
  }
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return String(value);
  }
  return "";
}

function readFiniteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(readString(value, 32));
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeVivaOrderCode(value: unknown): string {
  const text = readString(value, 32);
  if (!/^\d{1,32}$/.test(text)) {
    return "";
  }
  return text.replace(/^0+(?=\d)/, "");
}

/** Preserve a large JSON integer before JSON.parse can round it in JavaScript. */
export function extractVivaOrderCodeFromJson(rawBody: string): string {
  const match = rawBody.match(/"(?:OrderCode|orderCode)"\s*:\s*(?:"(\d{1,32})"|(\d{1,32}))/);
  return normalizeVivaOrderCode(match?.[1] ?? match?.[2]);
}

export function getVivaConfig(): VivaConfig {
  const requestedEnvironment = process.env.VIVA_ENV?.trim().toLowerCase() ?? "";
  const clientId = process.env.VIVA_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.VIVA_CLIENT_SECRET?.trim() ?? "";
  const sourceCode = process.env.VIVA_SOURCE_CODE?.trim() ?? "";
  const isProduction = process.env.NODE_ENV === "production";

  const wantsLive = requestedEnvironment === "live" || requestedEnvironment === "production";
  const wantsDemo = requestedEnvironment === "demo" || requestedEnvironment === "sandbox";
  const endpoint = wantsDemo ? DEMO_ENDPOINT : LIVE_ENDPOINT;

  let configurationError: string | undefined;
  if (!wantsLive && !wantsDemo) {
    configurationError = "VIVA_ENV doit etre explicitement defini sur live ou demo.";
  } else if (isProduction && !wantsLive) {
    configurationError = "Le mode Viva demo est interdit en production.";
  } else if (!clientId || !clientSecret || !sourceCode) {
    configurationError = "Identifiants Viva Smart Checkout incomplets.";
  }

  return {
    isConfigured: !configurationError,
    configurationError,
    clientId,
    clientSecret,
    sourceCode,
    endpoint,
  };
}

export function buildVivaCheckoutUrl(orderCode: string, config = getVivaConfig()): string {
  const safeOrderCode = normalizeVivaOrderCode(orderCode);
  if (!config.isConfigured || !safeOrderCode) {
    return "";
  }
  return `${config.endpoint.checkoutBase}/web/checkout?ref=${encodeURIComponent(safeOrderCode)}`;
}

export async function getVivaAccessToken(
  config: VivaConfig,
  endpoint = config.endpoint,
): Promise<string> {
  if (!config.isConfigured) {
    throw new Error(config.configurationError ?? "Configuration Viva invalide.");
  }

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
    throw new Error(`Authentification Viva impossible (${endpoint.mode}, HTTP ${response.status}).`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("Token Viva manquant.");
  }
  return data.access_token;
}

export async function createVivaCheckoutOrder(input: {
  config: VivaConfig;
  accessToken: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCountryCode: string;
  merchantTrns: string;
  customerTrns: string;
}): Promise<string> {
  const amountInMinorUnits = Math.round(input.amount * 100);
  if (!Number.isSafeInteger(amountInMinorUnits) || amountInMinorUnits <= 0) {
    throw new Error("Montant Viva invalide.");
  }

  const endpoint = input.config.endpoint;
  const response = await fetch(`${endpoint.apiBase}/checkout/v2/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountInMinorUnits,
      sourceCode: input.config.sourceCode,
      paymentTimeout: 1800,
      customerTrns: input.customerTrns,
      merchantTrns: input.merchantTrns,
      customer: {
        email: input.customerEmail,
        fullName: input.customerName,
        phone: input.customerPhone,
        countryCode: input.customerCountryCode,
        requestLang: "fr-FR",
      },
    }),
    cache: "no-store",
  });
  const rawBody = await response.text();
  if (!response.ok) {
    throw new Error(`Creation de la session Viva impossible (${endpoint.mode}, HTTP ${response.status}).`);
  }

  const orderCode = extractVivaOrderCodeFromJson(rawBody);
  if (!orderCode) {
    throw new Error("Reference de paiement Viva manquante.");
  }
  return orderCode;
}

export async function cancelVivaPaymentOrder(input: {
  config: VivaConfig;
  orderCode: string;
}): Promise<void> {
  const orderCode = normalizeVivaOrderCode(input.orderCode);
  const merchantId = process.env.VIVA_MERCHANT_ID?.trim() ?? "";
  const apiKey = process.env.VIVA_API_KEY?.trim() ?? "";
  if (!input.config.isConfigured || !orderCode || !merchantId || !apiKey) {
    throw new Error("Configuration d'annulation Viva incomplete.");
  }

  const credentials = Buffer.from(`${merchantId}:${apiKey}`).toString("base64");
  const response = await fetch(
    `${input.config.endpoint.checkoutBase}/api/orders/${encodeURIComponent(orderCode)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Basic ${credentials}` },
      cache: "no-store",
    },
  );

  if (response.status === 404) {
    // An expired/already cancelled payment order cannot be paid anymore.
    return;
  }
  if (!response.ok) {
    throw new Error(`Annulation Viva refusee (HTTP ${response.status}).`);
  }

  const rawBody = await response.text();
  if (!rawBody.trim()) return;
  try {
    const payload = JSON.parse(rawBody) as { Success?: boolean; success?: boolean };
    if (payload.Success === false || payload.success === false) {
      throw new Error("Viva n'a pas confirme l'annulation de la session.");
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Reponse d'annulation Viva invalide.");
    }
    throw error;
  }
}

export async function retrieveVivaTransaction(input: {
  config: VivaConfig;
  transactionId: string;
}): Promise<VivaVerifiedTransaction> {
  const transactionId = input.transactionId.trim();
  if (!/^[0-9a-f-]{20,64}$/i.test(transactionId)) {
    throw new Error("Identifiant de transaction Viva invalide.");
  }

  const accessToken = await getVivaAccessToken(input.config);
  const response = await fetch(
    `${input.config.endpoint.apiBase}/checkout/v2/transactions/${encodeURIComponent(transactionId)}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
  );
  const rawBody = await response.text();
  if (!response.ok) {
    throw new Error(`Verification de la transaction Viva impossible (HTTP ${response.status}).`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new Error("Reponse de verification Viva invalide.");
  }
  const data = isRecord(parsed) ? parsed : {};
  const amount = readFiniteNumber(data.amount ?? data.Amount);
  const orderCode = extractVivaOrderCodeFromJson(rawBody);
  const verifiedTransactionId =
    readString(data.transactionId ?? data.TransactionId, 64) || transactionId;

  if (!orderCode || amount === null || amount < 0) {
    throw new Error("Transaction Viva incomplete.");
  }

  return {
    orderCode,
    transactionId: verifiedTransactionId,
    sourceCode: readString(data.sourceCode ?? data.SourceCode, 64),
    statusId: readString(data.statusId ?? data.StatusId, 16).toUpperCase(),
    // Retrieve Transaction returns the amount in the currency's major unit
    // (for example 21.10 EUR), unlike Create Order which accepts minor units.
    amountInMinorUnits: Math.round(amount * 100),
    currencyCode: readString(data.currencyCode ?? data.CurrencyCode, 8),
  };
}
