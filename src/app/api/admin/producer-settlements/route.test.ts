import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { ProducerSettlementError } from "@/lib/producer-settlements";

const {
  denyIfNotAdminApi,
  getProducerSettlementSources,
  recordProducerPayment,
  saveProducerRate,
  voidProducerPayment,
} = vi.hoisted(() => ({
  denyIfNotAdminApi: vi.fn(),
  getProducerSettlementSources: vi.fn(),
  recordProducerPayment: vi.fn(),
  saveProducerRate: vi.fn(),
  voidProducerPayment: vi.fn(),
}));

vi.mock("@/lib/admin-guard", () => ({ denyIfNotAdminApi }));
vi.mock("@/lib/producer-settlements-backend", () => ({
  getProducerSettlementSources,
  recordProducerPayment,
  saveProducerRate,
  voidProducerPayment,
}));

import { GET, POST } from "@/app/api/admin/producer-settlements/route";

const origin = "https://boutique.example.test";
const payment = {
  action: "payment",
  id: "36c50da6-64f9-4092-ae4c-f19b4deaa9af",
  producerId: "farm",
  producerName: "La ferme",
  salesMonth: "2026-09",
  amountCents: 3000,
  paidOn: "2026-10-03",
  reference: "VIR123",
  note: "Acompte",
};

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${origin}/api/admin/producer-settlements`, {
    method: "POST",
    headers: { origin, "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function expectNoWrites() {
  expect(recordProducerPayment).not.toHaveBeenCalled();
  expect(saveProducerRate).not.toHaveBeenCalled();
  expect(voidProducerPayment).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  // 22:30 UTC is already 3 October in Paris: payment dates use the shop's day.
  vi.setSystemTime(new Date("2026-10-02T22:30:00.000Z"));
  denyIfNotAdminApi.mockResolvedValue(null);
  getProducerSettlementSources.mockResolvedValue({ sales: [], producers: [], rates: [], payments: [] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("GET /api/admin/producer-settlements", () => {
  it("returns an authentication denial before loading private accounting data", async () => {
    const denied = NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    denyIfNotAdminApi.mockResolvedValue(denied);
    expect(await GET()).toBe(denied);
    expect(getProducerSettlementSources).not.toHaveBeenCalled();
    expectNoWrites();
  });

  it("returns a private uncached dashboard using 80% of HT and subtracting prior payments", async () => {
    getProducerSettlementSources.mockResolvedValue({
      producers: [{ id: "farm", name: "La ferme" }],
      rates: [],
      sales: [{
        orderId: "order-1", createdAt: "2026-09-20T12:00:00Z", paymentState: "paid",
        status: "shipped", archivedAt: null, productId: "flower::5g", productName: "Fleur 5 g",
        producerId: "farm", producerName: "La ferme", attribution: "producer",
        quantity: 2, lineTotal: 120, lineTotalHt: 100, vatRate: 20,
      }],
      payments: [{ ...payment, createdAt: "2026-10-02T22:00:00Z", voidedAt: null, voidReason: null }],
    });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const { dashboard } = await response.json();
    expect(dashboard.periods).toHaveLength(1);
    expect(dashboard.periods[0]).toMatchObject({
      producerId: "farm", month: "2026-09", revenueHtCents: 10000,
      dueCents: 8000, paidCents: 3000, balanceCents: 5000,
    });
    expectNoWrites();
  });

  it("preserves actionable migration errors without caching them", async () => {
    getProducerSettlementSources.mockRejectedValue(new ProducerSettlementError("Migration requise.", 503));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({ error: "Migration requise." });
  });

  it("conceals database details when loading fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    getProducerSettlementSources.mockRejectedValue(new Error("secret db password=private supplier row"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const body = await response.json();
    expect(body.error).toContain("indisponible");
    expect(JSON.stringify(body)).not.toMatch(/secret|password|private supplier/);
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/secret|password|private supplier/);
    expectNoWrites();
  });
});

describe("POST /api/admin/producer-settlements", () => {
  it("denies unauthenticated writes before parsing the body or calling the backend", async () => {
    const denied = NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    denyIfNotAdminApi.mockResolvedValue(denied);
    expect(await POST(new Request(`${origin}/api/admin/producer-settlements`, {
      method: "POST", body: "invalid json",
    }))).toBe(denied);
    expectNoWrites();
    expect(getProducerSettlementSources).not.toHaveBeenCalled();
  });

  it.each([
    { origin: "https://attacker.example.test" },
    { origin: "null" },
    { origin: "" },
    { origin, "sec-fetch-site": "cross-site" },
  ] as Record<string, string>[])("rejects untrusted origins: %j", async (headers) => {
    const response = await POST(request(payment, headers));
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expectNoWrites();
  });

  it("rejects writes with a missing Origin header", async () => {
    const incoming = request(payment);
    incoming.headers.delete("origin");
    expect((await POST(incoming)).status).toBe(403);
    expectNoWrites();
  });

  it("requires JSON content type", async () => {
    expect((await POST(request(payment, { "content-type": "text/plain" }))).status).toBe(415);
    expectNoWrites();
  });

  it.each(["{", "null", "[]", '"payment"', "17"])("rejects malformed or non-object JSON: %s", async (body) => {
    const response = await POST(new Request(`${origin}/api/admin/producer-settlements`, {
      method: "POST", headers: { origin, "content-type": "application/json" }, body,
    }));
    expect(response.status).toBe(400);
    expectNoWrites();
  });

  it("bounds the actual UTF-8 request bytes rather than trusting Content-Length", async () => {
    const response = await POST(request({ ...payment, note: "é".repeat(8200) }, { "content-length": "20" }));
    expect(response.status).toBe(413);
    expectNoWrites();
  });

  it.each([
    { amountCents: 0 }, { amountCents: -1 }, { amountCents: 30.5 }, { amountCents: "3000" },
    { amountCents: 100000001 }, { paidOn: "2026-02-30" }, { paidOn: "2026-10-04" },
    { paidOn: "2026-1-1" }, { salesMonth: "2026-13" }, { salesFromMonth: "2026-13" },
    { salesFromMonth: "2026-10" }, { id: "not-an-id" },
  ])("rejects invalid payment inputs without writing: %j", async (change) => {
    const response = await POST(request({ ...payment, ...change }));
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expectNoWrites();
  });

  it("sends normalized payment values once, accepting today's date in Paris", async () => {
    const response = await POST(request({
      ...payment, id: payment.id.toUpperCase(), producerName: " La ferme ",
      reference: " VIR123 ", note: " Acompte ", ignored: "not forwarded",
    }, { "content-type": "application/json; charset=utf-8", "sec-fetch-site": "same-origin" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ ok: true });
    expect(recordProducerPayment).toHaveBeenCalledExactlyOnceWith({
      id: payment.id, producerId: "farm", producerName: "La ferme",
      salesFromMonth: "2026-09", salesMonth: "2026-09", amountCents: 3000,
      paidOn: "2026-10-03", reference: "VIR123", note: "Acompte",
    });
    expect(saveProducerRate).not.toHaveBeenCalled();
    expect(voidProducerPayment).not.toHaveBeenCalled();
  });

  it("accepts one payment covering several months without assigning it to the payment month", async () => {
    const response = await POST(request({ ...payment, salesFromMonth: "2026-07", salesMonth: "2026-09" }));
    expect(response.status).toBe(200);
    expect(recordProducerPayment).toHaveBeenCalledExactlyOnceWith({
      id: payment.id, producerId: "farm", producerName: "La ferme",
      salesFromMonth: "2026-07", salesMonth: "2026-09", amountCents: 3000,
      paidOn: "2026-10-03", reference: "VIR123", note: "Acompte",
    });
  });

  it("forwards a valid dated gram tariff with its weight", async () => {
    const rate = { producerId: "farm", productId: "flower::5g", effectiveMonth: "2026-10", mode: "gram", rate: 2.125, gramsPerUnit: 5 };
    const response = await POST(request({ ...rate, action: "rate" }));
    expect(response.status).toBe(200);
    expect(saveProducerRate).toHaveBeenCalledExactlyOnceWith(rate);
    expect(recordProducerPayment).not.toHaveBeenCalled();
    expect(voidProducerPayment).not.toHaveBeenCalled();
  });

  it.each([{ rate: 101 }, { rate: "80" }, { effectiveMonth: "2026-00" }, { mode: "gram", gramsPerUnit: 0 }])(
    "rejects invalid tariff values: %j", async (change) => {
      const response = await POST(request({ action: "rate", producerId: "farm", productId: "flower", effectiveMonth: "2026-10", mode: "percent_ht", rate: 80, ...change }));
      expect(response.status).toBe(400);
      expectNoWrites();
    },
  );

  it("requires an audit reason before voiding a payment", async () => {
    expect((await POST(request({ action: "void", id: payment.id, reason: " " }))).status).toBe(400);
    expectNoWrites();
    const response = await POST(request({ action: "void", id: payment.id.toUpperCase(), reason: " Saisie en double " }));
    expect(response.status).toBe(200);
    expect(voidProducerPayment).toHaveBeenCalledExactlyOnceWith(payment.id, "Saisie en double");
  });

  it("rejects unknown actions without forwarding arbitrary commands", async () => {
    expect((await POST(request({ action: "delete", id: payment.id }))).status).toBe(400);
    expectNoWrites();
  });

  it("preserves idempotency conflict errors and never tries a replacement write", async () => {
    recordProducerPayment.mockRejectedValue(new ProducerSettlementError("Identifiant déjà utilisé.", 409));
    const response = await POST(request(payment));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Identifiant déjà utilisé." });
    expect(recordProducerPayment).toHaveBeenCalledTimes(1);
    expect(saveProducerRate).not.toHaveBeenCalled();
    expect(voidProducerPayment).not.toHaveBeenCalled();
  });

  it("conceals database failures on writes and returns an uncached 503", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    recordProducerPayment.mockRejectedValue(new Error("connection secret=private-db"));
    const response = await POST(request(payment));
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.text()).not.toContain("private-db");
  });
});
