import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  getOrder: vi.fn(),
  status: vi.fn(),
  rateLimit: vi.fn(),
  prepare: vi.fn(),
  card: vi.fn(),
}));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/order-backend", () => ({ getOrderByIdByBackend: mocks.getOrder }));
vi.mock("@/lib/security-rate-limit", () => ({ hitRateLimit: mocks.rateLimit }));
vi.mock("@/lib/swiss-bitcoin-pay-service", () => ({
  getSwissBitcoinPaymentStatus: mocks.status,
  prepareSwissBitcoinPayment: mocks.prepare,
}));
vi.mock("@/lib/swiss-bitcoin-card-fallback", () => ({ switchSwissBitcoinOrderToViva: mocks.card }));

const orderId = "ORD-20261121-4321";
const origin = "https://shop.example.test";
const path = `${origin}/api/checkout/bitcoin/${orderId}`;
const context = { params: Promise.resolve({ orderId }) };
const ownOrder = { id: orderId, customerId: "customer-1" };

function post(action: string, suppliedOrigin = origin) {
  return new Request(path, {
    method: "POST",
    headers: { origin: suppliedOrigin },
    body: JSON.stringify({ action }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ customerId: "customer-1" });
  mocks.getOrder.mockResolvedValue(ownOrder);
  mocks.rateLimit.mockResolvedValue({ allowed: true });
  mocks.status.mockResolvedValue({ state: "expired", canRetry: true, canPayByCard: true });
});

describe("customer Bitcoin checkout actions", () => {
  it("requires a session and hides orders belonging to another customer", async () => {
    mocks.session.mockResolvedValueOnce(null);
    expect((await GET(new Request(path), context)).status).toBe(401);
    mocks.getOrder.mockResolvedValueOnce({ ...ownOrder, customerId: "customer-2" });
    expect((await GET(new Request(path), context)).status).toBe(404);
    expect(mocks.status).not.toHaveBeenCalled();
  });

  it("rejects cross-origin requests and rate limits authorized requests", async () => {
    expect((await POST(post("retry", "https://malicious.example.test"), context)).status).toBe(403);
    mocks.rateLimit.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 32 });
    const response = await POST(post("retry"), context);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("32");
    expect(mocks.prepare).not.toHaveBeenCalled();
  });

  it("only calls the existing order card fallback when eligible", async () => {
    mocks.status.mockResolvedValueOnce({ state: "confirming", canPayByCard: false });
    expect((await POST(post("card"), context)).status).toBe(409);
    expect(mocks.card).not.toHaveBeenCalled();

    mocks.card.mockResolvedValueOnce("https://viva.example.test/checkout");
    const response = await POST(post("card"), context);
    expect(await response.json()).toEqual({ redirectUrl: "https://viva.example.test/checkout" });
    expect(mocks.card).toHaveBeenCalledExactlyOnceWith(ownOrder);
    expect(mocks.prepare).not.toHaveBeenCalled();
  });
});
