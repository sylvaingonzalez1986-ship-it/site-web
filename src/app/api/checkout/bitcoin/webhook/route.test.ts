import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const receiveNotification = vi.hoisted(() => vi.fn());
vi.mock("@/lib/swiss-bitcoin-pay-service", () => ({ receiveSwissBitcoinNotification: receiveNotification }));

const invoiceId = "10111111-1111-4111-8111-111111111111";
const secret = "test-webhook-secret";

function request(body: unknown, providedSecret?: string) {
  return new Request("https://shop.example.test/api/checkout/bitcoin/webhook", {
    method: "POST",
    headers: providedSecret ? { "x-sbp-webhook-secret": providedSecret } : {},
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  receiveNotification.mockReset();
  vi.stubEnv("SWISS_BITCOIN_PAY_WEBHOOK_SECRET", secret);
  vi.stubEnv("SWISS_BITCOIN_PAY_ENABLED", "false");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Swiss Bitcoin Pay webhook", () => {
  it("does not trust provider status from the notification and accepts existing invoice notices when disabled", async () => {
    const response = await POST(request({ id: invoiceId, status: "paid", input: { amount: 0 } }, secret));
    expect(response.status).toBe(200);
    expect(receiveNotification).toHaveBeenCalledWith(invoiceId);
  });

  it("rejects a missing or invalid secret before reconciliation", async () => {
    expect((await POST(request({ id: invoiceId }))).status).toBe(401);
    expect((await POST(request({ id: invoiceId }, "incorrect"))).status).toBe(401);
    expect(receiveNotification).not.toHaveBeenCalled();
  });

  it("rejects malformed invoice IDs and oversized payloads", async () => {
    expect((await POST(request({ id: "../not-an-invoice" }, secret))).status).toBe(400);
    expect((await POST(request({ id: invoiceId, text: "x".repeat(16 * 1024) }, secret))).status).toBe(413);
    expect(receiveNotification).not.toHaveBeenCalled();
  });

  it("signals temporary failure when verification is unavailable", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    receiveNotification.mockRejectedValueOnce(new Error("Temporary failure"));
    expect((await POST(request({ id: invoiceId }, secret))).status).toBe(503);
  });
});
