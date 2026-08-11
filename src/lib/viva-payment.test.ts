import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cancelVivaPaymentOrder,
  createVivaCheckoutOrder,
  extractVivaOrderCodeFromJson,
  getVivaConfig,
  retrieveVivaTransaction,
} from "@/lib/viva-payment";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function configureViva(environment: "demo" | "live" = "demo") {
  vi.stubEnv("NODE_ENV", environment === "live" ? "production" : "test");
  vi.stubEnv("VIVA_ENV", environment);
  vi.stubEnv("VIVA_CLIENT_ID", "client-id");
  vi.stubEnv("VIVA_CLIENT_SECRET", "client-secret");
  vi.stubEnv("VIVA_SOURCE_CODE", "3891");
  vi.stubEnv("VIVA_MERCHANT_ID", "merchant-id");
  vi.stubEnv("VIVA_API_KEY", "api-key");
}

describe("Viva payment hardening", () => {
  it("preserves a 16-digit order code from unquoted JSON", () => {
    expect(extractVivaOrderCodeFromJson('{"orderCode":6810910170372602}')).toBe(
      "6810910170372602",
    );
  });

  it("fails closed when demo is selected in production", () => {
    configureViva("demo");
    vi.stubEnv("NODE_ENV", "production");
    expect(getVivaConfig()).toMatchObject({
      isConfigured: false,
      configurationError: "Le mode Viva demo est interdit en production.",
    });
  });

  it("sends minor units when creating an order and preserves its code", async () => {
    configureViva();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response('{"orderCode":6810910170372602}', { status: 200 }),
    );
    const config = getVivaConfig();
    const orderCode = await createVivaCheckoutOrder({
      config,
      accessToken: "token",
      amount: 21.1,
      customerName: "Client Test",
      customerEmail: "client@example.com",
      customerPhone: "+33102030405",
      customerCountryCode: "FR",
      merchantTrns: "Commande test",
      customerTrns: "Articles test",
    });

    expect(orderCode).toBe("6810910170372602");
    const request = fetchMock.mock.calls[0]?.[1];
    expect(JSON.parse(String(request?.body))).toMatchObject({ amount: 2110, sourceCode: "3891" });
  });

  it("converts the retrieved major-unit amount back to minor units", async () => {
    configureViva();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "token" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          '{"amount":21.1,"orderCode":6810910170372602,"sourceCode":"3891","statusId":"F","currencyCode":"978"}',
          { status: 200 },
        ),
      );

    const transaction = await retrieveVivaTransaction({
      config: getVivaConfig(),
      transactionId: "b1a3067c-321b-4ec6-bc9d-1778aef2a19d",
    });
    expect(transaction).toMatchObject({
      orderCode: "6810910170372602",
      amountInMinorUnits: 2110,
      currencyCode: "978",
      statusId: "F",
    });
  });

  it("cancels an unpaid order with the server-only Viva credentials", async () => {
    configureViva();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response('{"Success":true}', { status: 200 }),
    );

    await cancelVivaPaymentOrder({
      config: getVivaConfig(),
      orderCode: "6810910170372602",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://demo.vivapayments.com/api/orders/6810910170372602",
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "DELETE",
      headers: { Authorization: expect.stringMatching(/^Basic /) },
    });
  });

  it("does not accept an unconfirmed Viva cancellation", async () => {
    configureViva();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response('{"Success":false}', { status: 200 }),
    );

    await expect(
      cancelVivaPaymentOrder({
        config: getVivaConfig(),
        orderCode: "6810910170372602",
      }),
    ).rejects.toThrow("Viva n'a pas confirme l'annulation");
  });
});
