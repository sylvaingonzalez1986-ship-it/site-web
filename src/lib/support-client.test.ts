import { afterEach, describe, expect, it, vi } from "vitest";
import { SUPPORT_STORAGE_KEY, type SupportAttempt, type SupportStatus } from "./support-campaign";
import {
  clearSupportAttempt, readSupportAttempt, readSupportGameReturnHref, rememberSupportAttempt,
  supportCheckoutUrl, supportGameReturnHref, supportReturnIdentity, validateSupportStatus,
} from "./support-client";

const id = "ec6d7580-3e11-448f-bc0f-c563ed4e013a";
const otherId = "6db9d90f-87b5-4a2a-9864-e8248556dd37";
const token = "b".repeat(64);
const oldAttempt = { id, token, pseudonym: "Malo", amountCents: 500, publishName: false, publishAmount: false };
const attempt: SupportAttempt = { ...oldAttempt, provider: "swiss-bitcoin-pay" };
const status: SupportStatus = {
  id, provider: "swiss-bitcoin-pay", state: "ready", amountCents: 500, refundedCents: 0,
  checkoutUrl: `https://app.swiss-bitcoin-pay.ch/invoice/${otherId}`, expiresAt: "2026-11-22T12:00:00.000Z",
};

afterEach(() => vi.unstubAllGlobals());

describe("support payment browser state", () => {
  it("reads earlier Viva receipts without a provider and binds the return link to the matching contribution", () => {
    const store = new Map<string, string>([[SUPPORT_STORAGE_KEY, JSON.stringify(oldAttempt)]]);
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
    });
    expect(readSupportAttempt()).toEqual({ ...oldAttempt, provider: "viva" });
    rememberSupportAttempt(attempt, "/arene/placard?view=hub&support=1&token=secret&section=learn");
    expect(readSupportAttempt()).toEqual(attempt);
    expect(readSupportGameReturnHref(id)).toBe("/arene/placard?view=hub&section=learn");
    expect(readSupportGameReturnHref(otherId)).toBe("/arene/placard");
    clearSupportAttempt();
    expect(readSupportAttempt()).toBeNull();
    expect(readSupportGameReturnHref(id)).toBe("/arene/placard");
  });

  it.each([
    "https://example.test/arene/placard?view=hub", "//example.test/arene/placard", "/arene/placard/settings",
    "/arene/placard/../shop", "/arene/placard%2fsettings?view=hub", "/arene\\placard?view=hub",
  ])("rejects a game return outside the canonical local path %s", value => {
    expect(supportGameReturnHref(value)).toBe("/arene/placard");
  });

  it("checks the stored reference before sending a status request for a Swiss return", () => {
    expect(supportReturnIdentity(attempt, id, undefined)).toEqual({ id, token });
    expect(supportReturnIdentity(attempt, id.toUpperCase(), undefined)).toEqual({ id, token });
    expect(supportReturnIdentity(attempt, otherId, undefined)).toBeNull();
    expect(supportReturnIdentity(attempt, [id, otherId], undefined)).toBeNull();
    expect(supportReturnIdentity(attempt, undefined, undefined)).toBeNull();
    expect(supportReturnIdentity(attempt, id, otherId)).toBeNull();
    expect(supportReturnIdentity(attempt, id, undefined, "123")).toBeNull();
  });

  it("hands a Viva return to server verification and also accepts the legacy cancellation route", () => {
    expect(supportReturnIdentity(oldAttempt, undefined, otherId)).toEqual({ id, token, transactionId: otherId });
    expect(supportReturnIdentity(oldAttempt, undefined, undefined, "123")).toEqual({ id, token, orderCode: "123" });
    expect(supportReturnIdentity(oldAttempt, undefined, otherId, "123")).toEqual({ id, token, transactionId: otherId, orderCode: "123" });
    expect(supportReturnIdentity(oldAttempt, undefined, undefined)).toEqual({ id, token });
    expect(supportReturnIdentity(oldAttempt, undefined, [otherId])).toBeNull();
    expect(supportReturnIdentity(oldAttempt, undefined, "paid")).toBeNull();
    expect(supportReturnIdentity(oldAttempt, undefined, undefined, ["123", "456"])).toBeNull();
    expect(supportReturnIdentity(oldAttempt, undefined, undefined, "123x")).toBeNull();
    expect(supportReturnIdentity(oldAttempt, id, otherId)).toBeNull();
  });

  it("requires provider, amount and reference to agree before rendering a server receipt", () => {
    const paid = { ...status, state: "paid" as const, checkoutUrl: null };
    expect(validateSupportStatus(paid, attempt)).toEqual(paid);
    expect(validateSupportStatus({ ...paid, provider: undefined }, oldAttempt).state).toBe("paid");
    for (const change of [{ id: otherId }, { provider: "viva" as const }, { amountCents: 700 }, { provider: undefined }]) {
      expect(() => validateSupportStatus({ ...paid, ...change }, attempt)).toThrow("ne correspond pas");
    }
  });
});

describe("support checkout destinations", () => {
  it("accepts the canonical checkout pages for the intended provider only", () => {
    expect(supportCheckoutUrl(status)).toBe(status.checkoutUrl);
    for (const host of ["www.vivapayments.com", "demo.vivapayments.com"]) {
      const checkoutUrl = `https://${host}/web/checkout?ref=483749`;
      expect(supportCheckoutUrl({ ...status, provider: "viva", checkoutUrl })).toBe(checkoutUrl);
      expect(supportCheckoutUrl({ ...status, provider: undefined, checkoutUrl })).toBe(checkoutUrl);
      expect(() => supportCheckoutUrl({ ...status, checkoutUrl })).toThrow("invalide");
    }
    expect(supportCheckoutUrl({ ...status, state: "paid" })).toBeNull();
    expect(supportCheckoutUrl({ ...status, state: "expired" })).toBeNull();
  });

  it.each([
    `http://app.swiss-bitcoin-pay.ch/invoice/${otherId}`,
    `https://app.swiss-bitcoin-pay.ch.example.test/invoice/${otherId}`,
    `https://swiss-bitcoin-pay.ch/invoice/${otherId}`,
    `https://api.swiss-bitcoin-pay.ch/invoice/${otherId}`,
    `https://guest@app.swiss-bitcoin-pay.ch/invoice/${otherId}`,
    `https://app.swiss-bitcoin-pay.ch:8443/invoice/${otherId}`,
    `https://app.swiss-bitcoin-pay.ch/invoice/${otherId}?redirect=https://example.test`,
    `https://app.swiss-bitcoin-pay.ch/account/${otherId}`,
    "https://app.swiss-bitcoin-pay.ch/invoice/paid",
  ])("rejects an unapproved Swiss checkout %s", checkoutUrl => {
    expect(() => supportCheckoutUrl({ ...status, checkoutUrl })).toThrow("invalide");
  });

  it("rejects duplicate references and extra parameters on Viva", () => {
    for (const query of ["ref=123&ref=456", "ref=123&next=https://example.test", "ref=paid"]) {
      const checkoutUrl = `https://www.vivapayments.com/web/checkout?${query}`;
      expect(() => supportCheckoutUrl({ ...status, provider: "viva", checkoutUrl })).toThrow("invalide");
    }
  });
});
