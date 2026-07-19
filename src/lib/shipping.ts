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

export function getRelayFreeShippingThreshold(input: {
  config: ShippingPricingConfig;
  badgeRelayFreeShippingThresholdEur?: number | null;
}): number | null {
  if (input.badgeRelayFreeShippingThresholdEur === null) {
    return null;
  }

  if (typeof input.badgeRelayFreeShippingThresholdEur === "number") {
    return Math.max(0, input.badgeRelayFreeShippingThresholdEur);
  }

  return input.config.freeShippingThresholdEur;
}

export function computeShippingFee(input: {
  method: DeliveryMethod;
  subtotalAfterDiscount: number;
  config: ShippingPricingConfig;
  badgeRelayFreeShippingThresholdEur?: number | null;
  badgeHomeFeeEur?: number;
}): number {
  const config = input.config || getShippingPricingConfig();
  const safeSubtotal = Math.max(0, Number(input.subtotalAfterDiscount) || 0);

  if (input.method === "home") {
    if (typeof input.badgeHomeFeeEur === "number") {
      const badgeThreshold = getRelayFreeShippingThreshold({
        config,
        badgeRelayFreeShippingThresholdEur: input.badgeRelayFreeShippingThresholdEur,
      });
      if (badgeThreshold === null || safeSubtotal >= badgeThreshold) {
        return toMoney(Math.max(0, input.badgeHomeFeeEur));
      }
    }

    return toMoney(config.homeFeeEur);
  }

  const effectiveThreshold = getRelayFreeShippingThreshold({
    config,
    badgeRelayFreeShippingThresholdEur: input.badgeRelayFreeShippingThresholdEur,
  });

  if (effectiveThreshold === null || safeSubtotal >= effectiveThreshold) {
    return 0;
  }

  return toMoney(config.relayFeeEur);
}

export function getRelayFreeShippingProgressMessage(input: {
  shippingFee: number;
  shippingRemainingAmount: number;
  badgeRelayFreeShippingThresholdEur?: number | null;
}): string {
  if (input.badgeRelayFreeShippingThresholdEur === null) {
    return "Ton badge t'offre le point relais.";
  }

  if (input.shippingFee <= 0) {
    return "Le point relais est offert.";
  }

  return `Plus que ${formatThresholdAmount(input.shippingRemainingAmount)} avant le point relais offert.`;
}

export function getDeliveryMethodLabel(method: DeliveryMethod): string {
  return method === "relay" ? "Point Relais Mondial Relay" : "Livraison à domicile";
}


