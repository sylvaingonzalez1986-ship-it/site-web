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
    69,
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
  isMemberFreeShippingEligible?: boolean;
  ignoreFreeThreshold?: boolean;
}): number {
  const config = input.config || getShippingPricingConfig();
  const safeSubtotal = Math.max(0, Number(input.subtotalAfterDiscount) || 0);
  const isMemberFreeShippingEligible = input.isMemberFreeShippingEligible === true;
  const ignoreFreeThreshold = input.ignoreFreeThreshold === true;

  if (isMemberFreeShippingEligible) {
    return 0;
  }

  if (!ignoreFreeThreshold && safeSubtotal >= config.freeShippingThresholdEur) {
    return 0;
  }

  return toMoney(input.method === "relay" ? config.relayFeeEur : config.homeFeeEur);
}

export function getDeliveryMethodLabel(method: DeliveryMethod): string {
  return method === "relay" ? "Point Relais Mondial Relay" : "Livraison à domicile";
}


