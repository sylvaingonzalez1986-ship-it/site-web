import { afterEach, describe, expect, it } from "vitest";

import {
  computeShippingFee,
  getRelayFreeShippingProgressMessage,
  getRelayFreeShippingThreshold,
  getShippingPricingConfig,
} from "@/lib/shipping";

const ORIGINAL_ENV = {
  SHIPPING_HOME_FEE_EUR: process.env.SHIPPING_HOME_FEE_EUR,
  SHIPPING_RELAY_FEE_EUR: process.env.SHIPPING_RELAY_FEE_EUR,
  SHIPPING_FREE_THRESHOLD_EUR: process.env.SHIPPING_FREE_THRESHOLD_EUR,
  NEXT_PUBLIC_SHIPPING_HOME_FEE_EUR: process.env.NEXT_PUBLIC_SHIPPING_HOME_FEE_EUR,
  NEXT_PUBLIC_SHIPPING_RELAY_FEE_EUR: process.env.NEXT_PUBLIC_SHIPPING_RELAY_FEE_EUR,
  NEXT_PUBLIC_SHIPPING_FREE_THRESHOLD_EUR: process.env.NEXT_PUBLIC_SHIPPING_FREE_THRESHOLD_EUR,
};

afterEach(() => {
  Object.assign(process.env, ORIGINAL_ENV);
});

describe("shipping", () => {
  it("uses configured fallbacks when env vars are missing", () => {
    delete process.env.SHIPPING_HOME_FEE_EUR;
    delete process.env.SHIPPING_RELAY_FEE_EUR;
    delete process.env.SHIPPING_FREE_THRESHOLD_EUR;
    delete process.env.NEXT_PUBLIC_SHIPPING_HOME_FEE_EUR;
    delete process.env.NEXT_PUBLIC_SHIPPING_RELAY_FEE_EUR;
    delete process.env.NEXT_PUBLIC_SHIPPING_FREE_THRESHOLD_EUR;

    expect(getShippingPricingConfig()).toEqual({
      homeFeeEur: 6.9,
      relayFeeEur: 4.9,
      freeShippingThresholdEur: 89,
    });
  });

  it("returns home delivery fee below threshold", () => {
    expect(
      computeShippingFee({
        method: "home",
        subtotalAfterDiscount: 40,
        config: { homeFeeEur: 6.9, relayFeeEur: 4.9, freeShippingThresholdEur: 89 },
      }),
    ).toBe(6.9);
  });

  it("keeps the standard home fee below the badge threshold", () => {
    expect(
      computeShippingFee({
        method: "home",
        subtotalAfterDiscount: 40,
        config: { homeFeeEur: 6.9, relayFeeEur: 4.9, freeShippingThresholdEur: 89 },
        badgeRelayFreeShippingThresholdEur: 45,
        badgeHomeFeeEur: 2.5,
      }),
    ).toBe(6.9);
  });

  it("returns the badge home fee once its threshold is reached", () => {
    expect(
      computeShippingFee({
        method: "home",
        subtotalAfterDiscount: 45,
        config: { homeFeeEur: 6.9, relayFeeEur: 4.9, freeShippingThresholdEur: 89 },
        badgeRelayFreeShippingThresholdEur: 45,
        badgeHomeFeeEur: 2.5,
      }),
    ).toBe(2.5);
  });

  it("returns free home delivery for eligible badges", () => {
    expect(
      computeShippingFee({
        method: "home",
        subtotalAfterDiscount: 10,
        config: { homeFeeEur: 6.9, relayFeeEur: 4.9, freeShippingThresholdEur: 89 },
        badgeRelayFreeShippingThresholdEur: null,
        badgeHomeFeeEur: 0,
      }),
    ).toBe(0);
  });

  it("returns relay fee below threshold", () => {
    expect(
      computeShippingFee({
        method: "relay",
        subtotalAfterDiscount: 40,
        config: { homeFeeEur: 6.9, relayFeeEur: 4.9, freeShippingThresholdEur: 89 },
      }),
    ).toBe(4.9);
  });

  it("returns free relay shipping once threshold is reached", () => {
    expect(
      computeShippingFee({
        method: "relay",
        subtotalAfterDiscount: 89,
        config: { homeFeeEur: 6.9, relayFeeEur: 4.9, freeShippingThresholdEur: 89 },
      }),
    ).toBe(0);
  });

  it("returns free relay shipping for eligible members regardless of subtotal", () => {
    expect(
      computeShippingFee({
        method: "relay",
        subtotalAfterDiscount: 10,
        config: { homeFeeEur: 6.9, relayFeeEur: 4.9, freeShippingThresholdEur: 89 },
        badgeRelayFreeShippingThresholdEur: null,
      }),
    ).toBe(0);
  });

  it("uses badge relay threshold when provided", () => {
    expect(
      computeShippingFee({
        method: "relay",
        subtotalAfterDiscount: 44.99,
        config: { homeFeeEur: 6.9, relayFeeEur: 4.9, freeShippingThresholdEur: 89 },
        badgeRelayFreeShippingThresholdEur: 45,
      }),
    ).toBe(4.9);

    expect(
      computeShippingFee({
        method: "relay",
        subtotalAfterDiscount: 45,
        config: { homeFeeEur: 6.9, relayFeeEur: 4.9, freeShippingThresholdEur: 89 },
        badgeRelayFreeShippingThresholdEur: 45,
      }),
    ).toBe(0);
  });

  it("returns the effective relay threshold for standard and badge levels", () => {
    expect(
      getRelayFreeShippingThreshold({
        config: { homeFeeEur: 6.9, relayFeeEur: 4.9, freeShippingThresholdEur: 89 },
      }),
    ).toBe(89);

    expect(
      getRelayFreeShippingThreshold({
        config: { homeFeeEur: 6.9, relayFeeEur: 4.9, freeShippingThresholdEur: 89 },
        badgeRelayFreeShippingThresholdEur: 45,
      }),
    ).toBe(45);

    expect(
      getRelayFreeShippingThreshold({
        config: { homeFeeEur: 6.9, relayFeeEur: 4.9, freeShippingThresholdEur: 89 },
        badgeRelayFreeShippingThresholdEur: null,
      }),
    ).toBeNull();
  });

  it("formats the remaining amount before relay free shipping", () => {
    expect(
      getRelayFreeShippingProgressMessage({
        shippingFee: 4.9,
        shippingRemainingAmount: 39,
      }),
    ).toBe("Plus que 39 EUR avant le point relais offert.");
  });

  it("reports free relay shipping when the threshold is reached", () => {
    expect(
      getRelayFreeShippingProgressMessage({
        shippingFee: 0,
        shippingRemainingAmount: 0,
      }),
    ).toBe("Le point relais est offert.");
  });

  it("reports badge-based free relay shipping", () => {
    expect(
      getRelayFreeShippingProgressMessage({
        shippingFee: 0,
        shippingRemainingAmount: 0,
        badgeRelayFreeShippingThresholdEur: null,
      }),
    ).toBe("Ton badge t'offre le point relais.");
  });
});
