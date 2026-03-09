export type DeliveryMethod = "home" | "relay";

export type MondialRelayPoint = {
  id: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
};

export type ShippingPricingConfig = {
  homeFeeEur: number;
  relayFeeEur: number;
  freeShippingThresholdEur: number;
};

function toMoney(value: number): number {
  return Number(value.toFixed(2));
}

function formatThresholdAmount(value: number): string {
  const safeValue = toMoney(Math.max(0, value));
  const hasDecimals = !Number.isInteger(safeValue);

  return `${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(safeValue)} EUR`;
}

function parseNonNegativeNumber(value: string | undefined, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    return fallback;
  }

  return num;
}

function resolveEnvValue(serverVar: string, publicVar: string): string | undefined {
  if (typeof window === "undefined") {
    return process.env[serverVar] || process.env[publicVar];
  }

  return process.env[publicVar];
}

export function getShippingPricingConfig(): ShippingPricingConfig {
  const homeFeeEur = parseNonNegativeNumber(
    resolveEnvValue("SHIPPING_HOME_FEE_EUR", "NEXT_PUBLIC_SHIPPING_HOME_FEE_EUR"),
    6.9,
  );
  const relayFeeEur = parseNonNegativeNumber(
    resolveEnvValue("SHIPPING_RELAY_FEE_EUR", "NEXT_PUBLIC_SHIPPING_RELAY_FEE_EUR"),
    4.9,
  );
  const freeShippingThresholdEur = parseNonNegativeNumber(
    resolveEnvValue("SHIPPING_FREE_THRESHOLD_EUR", "NEXT_PUBLIC_SHIPPING_FREE_THRESHOLD_EUR"),
    89,
  );

  return {
    homeFeeEur: toMoney(homeFeeEur),
    relayFeeEur: toMoney(relayFeeEur),
    freeShippingThresholdEur: toMoney(freeShippingThresholdEur),
  };
}

export function computeShippingFee(input: {
  method: DeliveryMethod;
  subtotalAfterDiscount: number;
  config: ShippingPricingConfig;
  badgeFreeShippingThresholdEur?: number | null;
}): number {
  const config = input.config || getShippingPricingConfig();
  const safeSubtotal = Math.max(0, Number(input.subtotalAfterDiscount) || 0);
  const badgeFreeShippingThresholdEur = input.badgeFreeShippingThresholdEur;

  if (badgeFreeShippingThresholdEur === null) {
    return 0;
  }

  const effectiveThreshold =
    typeof badgeFreeShippingThresholdEur === "number"
      ? Math.max(0, badgeFreeShippingThresholdEur)
      : config.freeShippingThresholdEur;

  if (safeSubtotal >= effectiveThreshold) {
    return 0;
  }

  return toMoney(input.method === "relay" ? config.relayFeeEur : config.homeFeeEur);
}

export function getFreeShippingProgressMessage(input: {
  shippingFee: number;
  shippingRemainingAmount: number;
  badgeFreeShippingThresholdEur?: number | null;
}): string {
  if (input.badgeFreeShippingThresholdEur === null) {
    return "Ton badge t'offre la livraison gratuite.";
  }

  if (input.shippingFee <= 0) {
    return "La livraison est offerte.";
  }

  return `Plus que ${formatThresholdAmount(input.shippingRemainingAmount)} avant la livraison gratuite.`;
}

export function getDeliveryMethodLabel(method: DeliveryMethod): string {
  return method === "relay" ? "Point Relais Mondial Relay" : "Livraison à domicile";
}


