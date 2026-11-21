import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSwissBitcoinInvoice,
  createSwissBitcoinSupportInvoice,
  fetchSwissBitcoinInvoice,
  inspectSwissBitcoinInvoice,
  isSwissBitcoinPayEnabled,
  isSwissBitcoinSupportEnabled,
  matchesSwissBitcoinSecret,
  swissBitcoinCheckoutUrl,
} from "@/lib/swiss-bitcoin-pay";

const invoiceId = "10111111-1111-4111-8111-111111111111";
const attemptId = "20222222-2222-4222-8222-222222222222";
const orderId = "ORD-20261121-4321";
const checkoutUrl = `https://pay.swiss-bitcoin-pay.ch/${invoiceId}`;
const paymentHash = "a".repeat(64);
const paidInvoice = {
  id: invoiceId,
  status: "paid",
  createdAt: 1795260000000,
  delay: 10,
  extra: { reference: attemptId },
  input: { amount: 21.50, unit: "EUR" },
  paymentDetails: [{ network: "lightning", paidAt: 1795260010000, hash: paymentHash, amount: 12_345 }],
};

function configure() {
  vi.stubEnv("SWISS_BITCOIN_PAY_ENABLED", "true");
  vi.stubEnv("SWISS_BITCOIN_PAY_API_KEY", "api-key");
  vi.stubEnv("SWISS_BITCOIN_PAY_WEBHOOK_SECRET", "webhook-secret");
  vi.stubEnv("CRON_SECRET", "cron-secret");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example.test/path?ignored=1");
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("Swiss Bitcoin Pay merchant API", () => {
  it("sends webhooks and returning customers straight to the canonical shop host", async () => {
    configure();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://leschanvriersbretons.com");
    const request = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ id: invoiceId, checkoutUrl }, { status: 201 }));
    await createSwissBitcoinInvoice(orderId, attemptId, 90);
    expect(JSON.parse(String(request.mock.calls[0][1]?.body))).toMatchObject({
      webhook: { url: "https://www.leschanvriersbretons.com/api/checkout/bitcoin/webhook" },
      redirectAfterPaid: `https://www.leschanvriersbretons.com/checkout/bitcoin/${orderId}`,
    });
  });

  it("creates a Lightning invoice for the exact order total without customer data", async () => {
    configure();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ id: invoiceId, checkoutUrl, pr: "invoice-private-unneeded" }, { status: 201 }),
    );
    expect(await createSwissBitcoinInvoice(orderId, attemptId, 2150)).toEqual({ invoiceId, checkoutUrl });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.swiss-bitcoin-pay.ch/checkout");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      redirect: "error",
      headers: { "api-key": "api-key" },
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      amount: 21.50,
      unit: "EUR",
      onChain: false,
      delay: 10,
      redirect: false,
      redirectAfterPaid: `https://shop.example.test/checkout/bitcoin/${orderId}`,
      webhook: {
        url: "https://shop.example.test/api/checkout/bitcoin/webhook",
        headers: { "x-sbp-webhook-secret": "webhook-secret" },
      },
      extra: { reference: attemptId },
    });
  });

  it("uses the merchant key already configured as swiss_bitcoin on Vercel", async () => {
    configure();
    vi.stubEnv("SWISS_BITCOIN_PAY_API_KEY", "");
    vi.stubEnv("swiss_bitcoin", "existing-key");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ id: invoiceId, checkoutUrl }, { status: 201 }),
    );
    await createSwissBitcoinInvoice(orderId, attemptId, 2150);
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ "api-key": "existing-key" });
  });

  it("uses a separate Lightning support return and webhook with the existing merchant secrets", async () => {
    configure();
    vi.stubEnv("SWISS_BITCOIN_PAY_ENABLED", "false");
    vi.stubEnv("SWISS_BITCOIN_PAY_SUPPORT_ENABLED", "true");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ id: invoiceId, checkoutUrl }, { status: 201 }));
    expect(isSwissBitcoinPayEnabled()).toBe(false);
    expect(isSwissBitcoinSupportEnabled()).toBe(true);
    await createSwissBitcoinSupportInvoice(attemptId, 2150);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      amount: 21.50, unit: "EUR", onChain: false, delay: 10,
      redirectAfterPaid: `https://shop.example.test/soutenir/retour?support=${attemptId}`,
      webhook: { url: "https://shop.example.test/api/support/swiss-bitcoin-pay/webhook", headers: { "x-sbp-webhook-secret": "webhook-secret" } },
      extra: { reference: attemptId, purpose: "producer-support" },
    });
  });

  it("checks existing invoices after disabling creation and omits the api key", async () => {
    configure();
    vi.stubEnv("SWISS_BITCOIN_PAY_ENABLED", "false");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(paidInvoice));
    expect(isSwissBitcoinPayEnabled()).toBe(false);
    expect(await fetchSwissBitcoinInvoice(invoiceId)).toEqual(paidInvoice);
    expect(fetchMock.mock.calls[0][0]).toBe(`https://api.swiss-bitcoin-pay.ch/checkout/${invoiceId}`);
    expect(fetchMock.mock.calls[0][1]?.headers).toBeUndefined();
  });

  it("distinguishes explicit API denial from an ambiguous create failure", async () => {
    configure();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));
    await expect(createSwissBitcoinInvoice(orderId, attemptId, 2150)).rejects.toMatchObject({ definitive: true });
    await expect(createSwissBitcoinInvoice(orderId, attemptId, 2150)).rejects.toMatchObject({ definitive: false });
  });

  it.each([
    [Response.json({ error: "Api key not provided", details: "private-token" }, { status: 403 }), "missing_api_key", 403],
    [Response.json({ code: "INVALID_API_KEY", message: "welcome alice@example.test" }, { status: 500 }), "invalid_api_key", 500],
    [Response.json({ message: "Too many requests" }, { status: 429 }), "rate_limited", 429],
    [new Response(" Forbidden\n", { status: 403 }), "forbidden", 403],
  ])("logs only status, order and an allowlisted provider category", async (response, category, status) => {
    configure();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response);

    await expect(createSwissBitcoinInvoice(orderId, attemptId, 2150)).rejects.toMatchObject({ definitive: status === 403 });
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      "[swiss-bitcoin-pay] invoice creation refused",
      { status, orderId, category, format: response.headers.get("content-type")?.includes("json") ? "json" : "text" },
    );
  });

  it.each([
    [Response.json({
      error: "Invalid API key: private-token",
      code: "new_private_reason",
      message: "Call alice@example.test or https://shop.example.test/private",
    }, { status: 403, headers: { "api-key": "response-secret" } }), "json", ["invalid", "key"]],
    [new Response("Forbidden: private-token", { status: 403 }), "text", ["forbidden"]],
  ])("omits details, headers and unknown provider messages", async (response, format, terms) => {
    configure();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response);

    await expect(createSwissBitcoinInvoice(orderId, attemptId, 2150)).rejects.toMatchObject({ definitive: true });
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      "[swiss-bitcoin-pay] invoice creation refused", { status: 403, orderId, format, terms },
    );
  });

  it("cancels oversized responses and safely diagnoses an HTML challenge from the prefix", async () => {
    configure();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const cancel = vi.fn();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('<!DOCTYPE html><script src="/cdn-cgi/challenge-platform/private-key"></script>' + " ".repeat(4096)));
      },
      cancel,
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(body, { status: 403 }));

    await expect(createSwissBitcoinInvoice(orderId, attemptId, 2150)).rejects.toMatchObject({ definitive: true });
    expect(cancel).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      "[swiss-bitcoin-pay] invoice creation refused", { status: 403, orderId, format: "html", truncated: true, edgePage: "challenge" },
    );
  });

  it("extracts bounded vocabulary from nested provider errors and ignores reflected request fields", async () => {
    configure();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({
      error: {
        code: "merchant_account_suspended",
        detail: "Webhook domain rejected for this merchant. Contact alice@example.test.",
      },
      reason: "region policy",
      message: 'Request: {"webhook":{"headers":{"Authorization":"forbidden"}}}',
      request: { error: "invalid_api_key" },
    }, { status: 403 }));
    await expect(createSwissBitcoinInvoice(orderId, attemptId, 2150)).rejects.toMatchObject({ definitive: true });
    expect(warn).toHaveBeenCalledExactlyOnceWith("[swiss-bitcoin-pay] invoice creation refused", {
      status: 403, orderId, format: "json", terms: ["merchant", "account", "suspended", "webhook", "domain", "region"],
    });
  });

  it.each([
    [new Response(null, { status: 403 }), "empty"],
    [new Response('Request: {"webhook":{"headers":{"Authorization":"forbidden"}}}', { status: 403 }), "text"],
    [Response.json({ webhook: { url: "https://forbidden.test" }, error: { request: { code: "invalid_api_key" } } }, { status: 403 }), "json"],
  ])("does not draw diagnostic conclusions from absent or reflected content", async (response, format) => {
    configure();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response);
    await expect(createSwissBitcoinInvoice(orderId, attemptId, 2150)).rejects.toMatchObject({ definitive: true });
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      "[swiss-bitcoin-pay] invoice creation refused", { status: 403, orderId, format },
    );
  });

  it("does not enable creation with an insecure canonical origin", () => {
    configure();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://shop.example.test");
    expect(isSwissBitcoinPayEnabled()).toBe(false);
  });

  it("does not enable creation while scheduled recovery is unconfigured", () => {
    configure();
    vi.stubEnv("CRON_SECRET", " ");
    expect(isSwissBitcoinPayEnabled()).toBe(false);
  });

  it.each([
    "http://pay.swiss-bitcoin-pay.ch/",
    "https://swiss-bitcoin-pay.ch.example.test/",
    "https://swiss-bitcoin-pay.ch@example.test/",
    "https://example.test@swiss-bitcoin-pay.ch/",
    "https://swiss-bitcoin-pay.ch:8080/",
  ])("rejects unsafe checkout URL %s", (url) => {
    expect(swissBitcoinCheckoutUrl(url)).toBeNull();
  });

  it("requires the webhook secret to match exactly", () => {
    expect(matchesSwissBitcoinSecret("shared", "shared")).toBe(true);
    expect(matchesSwissBitcoinSecret("SHARED", "shared")).toBe(false);
    expect(matchesSwissBitcoinSecret("", undefined)).toBe(false);
  });
});

describe("Swiss Bitcoin Pay invoice observations", () => {
  it("accepts a settled Lightning invoice with Unix timestamps and a matching EUR amount and reference", () => {
    const createdAt = 1795267693;
    const paidAt = createdAt + 44;
    const settled = {
      ...paidInvoice, status: "settled", paymentMethod: "lightning",
      input: { amount: 0.9, unit: "EUR" }, createdAt, paidAt, expiry: createdAt + 600, delay: 600,
      paymentDetails: [{ network: "lightning", hash: paymentHash, paidAt }],
    };
    expect(inspectSwissBitcoinInvoice(settled, invoiceId, attemptId, 90)).toMatchObject({
      associationVerified: true, state: "paid", providerStatus: "settled", issue: null, eurMinor: 90,
      paidAt: new Date(paidAt * 1000).toISOString(), paymentReference: paymentHash,
    });
    expect(inspectSwissBitcoinInvoice(settled, invoiceId, attemptId, 91)).toMatchObject({
      state: "review", issue: "invoice_amount_mismatch", paidAt: null,
    });
  });

  it("uses the requested EUR amount, settled status and paid Lightning reference", () => {
    expect(inspectSwissBitcoinInvoice(paidInvoice, invoiceId, attemptId, 2150)).toEqual({
      associationVerified: true,
      state: "paid",
      issue: null,
      currency: "EUR",
      eurMinor: 2150,
      providerStatus: "paid",
      expiresAt: new Date(paidInvoice.createdAt + 600_000).toISOString(),
      paidAt: new Date(paidInvoice.paymentDetails[0].paidAt).toISOString(),
      paidSats: null,
      paymentReference: paymentHash,
    });
  });

  it.each([
    [{ input: { unit: "USD", amount: 21.50 } }, "invoice_amount_mismatch"],
    [{ input: { unit: "EUR", amount: 21.499 } }, "invoice_amount_mismatch"],
    [{ input: { unit: "EUR", amount: "21.50" } }, "invoice_amount_mismatch"],
    [{ input: { unit: "EUR", amount: 21.51 } }, "invoice_amount_mismatch"],
    [{ input: { unit: "eur", amount: 21.50 } }, "invoice_amount_mismatch"],
    [{ extra: { reference: invoiceId } }, "invoice_reference_mismatch"],
    [{ id: attemptId }, "invoice_id_mismatch"],
    [{ status: "unknown" }, "invoice_status_unknown"],
  ])("requires manual review when %j conflicts with the stored attempt", (changes, issue) => {
    expect(inspectSwissBitcoinInvoice({ ...paidInvoice, ...changes }, invoiceId, attemptId, 2150))
      .toMatchObject({ state: "review", issue, paidAt: null, paidSats: null, paymentReference: null });
  });

  it("never treats obsolete flags as settlement", () => {
    expect(inspectSwissBitcoinInvoice({ ...paidInvoice, status: "unconfirmed", isPaid: true }, invoiceId, attemptId, 2150))
      .toMatchObject({ state: "confirming", paidAt: null });
  });

  it("interprets the provider's response delay in seconds and preserves the observed paid time", () => {
    const createdAt = 1795260000;
    const expiresAt = new Date((createdAt + 600) * 1000).toISOString();
    expect(inspectSwissBitcoinInvoice({ ...paidInvoice, createdAt, delay: 600 }, invoiceId, attemptId, 2150))
      .toMatchObject({ state: "paid", expiresAt });
  });

  it("asks for review when settlement time or invoice expiry cannot be established", () => {
    expect(inspectSwissBitcoinInvoice({ ...paidInvoice, paymentDetails: [] }, invoiceId, attemptId, 2150))
      .toMatchObject({ state: "review", issue: "invoice_timing_unverified" });
    expect(inspectSwissBitcoinInvoice({ ...paidInvoice, delay: undefined }, invoiceId, attemptId, 2150))
      .toMatchObject({ state: "review", issue: "invoice_timing_unverified" });
  });

  it("records a verified payment reported on-chain for review", () => {
    expect(inspectSwissBitcoinInvoice({ ...paidInvoice, paymentMethod: "onchain" }, invoiceId, attemptId, 2150))
      .toMatchObject({ associationVerified: true, state: "review", issue: "invoice_network_mismatch" });
  });
});
