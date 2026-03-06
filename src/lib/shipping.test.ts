import { afterEach, describe, expect, it } from "vitest";

import {
  computeShippingFee,
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
      freeShippingThresholdEur: 69,
    });
  });

  it("returns home delivery fee below threshold", () => {
    expect(
      computeShippingFee({
        method: "home",
        subtotalAfterDiscount: 40,
        config: { homeFeeEur: 6.9, relayFeeEur: 4.9, freeShippingThresholdEur: 69 },
      }),
    ).toBe(6.9);
  });

  it("returns relay fee below threshold", () => {
    expect(
      computeShippingFee({
        method: "relay",
        subtotalAfterDiscount: 40,
        config: { homeFeeEur: 6.9, relayFeeEur: 4.9, freeShippingThresholdEur: 69 },
      }),
    ).toBe(4.9);
  });

  it("returns free shipping once threshold is reached", () => {
    expect(
      computeShippingFee({
        method: "home",
        subtotalAfterDiscount: 69,
        config: { homeFeeEur: 6.9, relayFeeEur: 4.9, freeShippingThresholdEur: 69 },
      }),
    ).toBe(0);
  });

  it("returns free shipping for eligible members regardless of subtotal", () => {
    expect(
      computeShippingFee({
        method: "relay",
        subtotalAfterDiscount: 10,
        config: { homeFeeEur: 6.9, relayFeeEur: 4.9, freeShippingThresholdEur: 69 },
        badgeFreeShippingThresholdEur: null,
      }),
    ).toBe(0);
  });

  it("uses badge threshold when provided", () => {
    expect(
      computeShippingFee({
        method: "home",
        subtotalAfterDiscount: 44.99,
        config: { homeFeeEur: 6.9, relayFeeEur: 4.9, freeShippingThresholdEur: 69 },
        badgeFreeShippingThresholdEur: 45,
      }),
    ).toBe(6.9);

    expect(
      computeShippingFee({
        method: "home",
        subtotalAfterDiscount: 45,
        config: { homeFeeEur: 6.9, relayFeeEur: 4.9, freeShippingThresholdEur: 69 },
        badgeFreeShippingThresholdEur: 45,
      }),
    ).toBe(0);
  });
});
