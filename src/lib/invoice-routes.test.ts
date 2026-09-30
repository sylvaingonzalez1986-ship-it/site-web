import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  denyAdmin: vi.fn(),
  session: vi.fn(),
  order: vi.fn(),
  issue: vi.fn(),
  getMessage: vi.fn(),
  setMessage: vi.fn(),
  pdf: vi.fn(),
}));

vi.mock("@/lib/admin-guard", () => ({ denyIfNotAdminApi: mocks.denyAdmin }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/order-backend", () => ({ getOrderByIdByBackend: mocks.order }));
vi.mock("@/lib/invoice-store", () => ({
  issueInvoiceForOrder: mocks.issue,
  getInvoicePersonalMessage: mocks.getMessage,
  setInvoicePersonalMessage: mocks.setMessage,
}));
vi.mock("@/lib/invoice-pdf", () => ({ buildInvoiceResponse: mocks.pdf }));

import { GET as adminGet, POST as adminPost } from "@/app/api/admin/orders/[orderId]/invoice/route";
import { GET as messageGet } from "@/app/api/admin/orders/[orderId]/invoice/message/route";
import { GET as customerGet } from "@/app/api/account/orders/[orderId]/invoice/route";

const order = {
  id: "ORD-TEST-001",
  status: "paid",
  paymentState: "paid",
  customerId: "customer-1",
  customerName: "Camille",
};
const issuedInvoice = {
  orderId: order.id,
  invoiceNumber: "2026-000042",
  sequence: 42,
  issuedAt: "2026-09-30T10:00:00.000Z",
};
const context = () => ({ params: Promise.resolve({ orderId: order.id }) });
const getRequest = () => new Request(`https://example.test/api/admin/orders/${order.id}/invoice`);
const postRequest = (body: unknown) => new Request(getRequest(), {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
const post = (body: unknown) => adminPost(postRequest(body), context());

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.denyAdmin.mockResolvedValue(null);
  mocks.session.mockResolvedValue({ customerId: "customer-1", customer: {} });
  mocks.order.mockResolvedValue(order);
  mocks.issue.mockResolvedValue(issuedInvoice);
  mocks.getMessage.mockResolvedValue("Merci Camille !");
  mocks.setMessage.mockImplementation(async (_id: string, message: string) => message);
  mocks.pdf.mockImplementation(async () => new Response("%PDF", {
    headers: { "Content-Type": "application/pdf", "Cache-Control": "private, no-store" },
  }));
});

afterEach(() => vi.restoreAllMocks());

describe("admin invoice personal messages", () => {
  it("protects editing, reading and downloading with the admin guard", async () => {
    mocks.denyAdmin.mockResolvedValue(new Response("Unauthorized", { status: 401 }));
    expect((await adminGet(getRequest(), context())).status).toBe(401);
    expect((await messageGet(getRequest(), context())).status).toBe(401);
    expect((await post({ personalMessage: "Merci" })).status).toBe(401);
    expect(mocks.order).not.toHaveBeenCalled();
    expect(mocks.issue).not.toHaveBeenCalled();
    expect(mocks.setMessage).not.toHaveBeenCalled();
  });

  it.each([
    [null, 404],
    [{ ...order, paymentState: "pending" }, 409],
    [{ ...order, paymentState: "failed" }, 409],
    [{ ...order, status: "cancelled" }, 409],
  ])("requires an existing eligible order: %j", async (value, status) => {
    mocks.order.mockResolvedValue(value);
    expect((await adminGet(getRequest(), context())).status).toBe(status);
    expect((await messageGet(getRequest(), context())).status).toBe(status);
    expect((await post({ personalMessage: "Merci" })).status).toBe(status);
    expect(mocks.issue).not.toHaveBeenCalled();
    expect(mocks.getMessage).not.toHaveBeenCalled();
    expect(mocks.setMessage).not.toHaveBeenCalled();
  });

  it("loads the saved message without issuing a new invoice or caching private text", async () => {
    const response = await messageGet(getRequest(), context());
    expect(await response.json()).toEqual({ personalMessage: "Merci Camille !" });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.getMessage).toHaveBeenCalledWith(order.id);
    expect(mocks.issue).not.toHaveBeenCalled();
    expect(mocks.setMessage).not.toHaveBeenCalled();
  });

  it("loads an empty message before the first issuance", async () => {
    mocks.getMessage.mockResolvedValue("");
    const response = await messageGet(getRequest(), context());
    expect(await response.json()).toEqual({ personalMessage: "" });
    expect(mocks.issue).not.toHaveBeenCalled();
  });

  it.each([
    null,
    [],
    {},
    { personalMessage: null },
    { personalMessage: 42 },
    { personalMessage: "x".repeat(1_001) },
    { personalMessage: Array(21).fill("Bonjour").join("\n") },
    { personalMessage: "Bonjour\u0000Camille" },
  ])("rejects invalid input before creating an invoice or changing its message: %j", async (body) => {
    expect((await post(body)).status).toBe(400);
    expect(mocks.issue).not.toHaveBeenCalled();
    expect(mocks.setMessage).not.toHaveBeenCalled();
    expect(mocks.pdf).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON, non-JSON and oversized requests before writes", async () => {
    const malformed = new Request(getRequest(), {
      method: "POST", headers: { "content-type": "application/json" }, body: "{",
    });
    const nonJson = new Request(getRequest(), {
      method: "POST", headers: { "content-type": "text/plain" }, body: '{"personalMessage":"Merci"}',
    });
    const oversized = postRequest({ personalMessage: "Merci" });
    oversized.headers.set("content-length", "20000");
    expect((await adminPost(malformed, context())).status).toBe(400);
    expect((await adminPost(nonJson, context())).status).toBe(415);
    expect((await adminPost(oversized, context())).status).toBe(413);
    expect(mocks.issue).not.toHaveBeenCalled();
    expect(mocks.setMessage).not.toHaveBeenCalled();
  });

  it("normalizes and persists the message before generating the PDF with the saved value", async () => {
    mocks.setMessage.mockResolvedValue("Message enregistré");
    const response = await post({ personalMessage: "  Merci Camille !\r\nÀ bientôt.  " });
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(mocks.issue).toHaveBeenCalledWith(order.id);
    expect(mocks.setMessage).toHaveBeenCalledWith(order.id, "Merci Camille !\nÀ bientôt.");
    expect(mocks.pdf).toHaveBeenCalledWith(order, issuedInvoice, expect.any(Object), {
      personalMessage: "Message enregistré",
    });
    expect(mocks.issue.mock.invocationCallOrder[0]).toBeLessThan(mocks.setMessage.mock.invocationCallOrder[0]);
    expect(mocks.setMessage.mock.invocationCallOrder[0]).toBeLessThan(mocks.pdf.mock.invocationCallOrder[0]);
  });

  it("allows removing a message without changing invoice identity", async () => {
    expect((await post({ personalMessage: "  " })).status).toBe(200);
    expect(mocks.setMessage).toHaveBeenCalledWith(order.id, "");
    expect(mocks.pdf).toHaveBeenCalledWith(order, issuedInvoice, expect.any(Object), { personalMessage: "" });
  });

  it("keeps direct downloads compatible and includes the saved message without rewriting it", async () => {
    expect((await adminGet(getRequest(), context())).status).toBe(200);
    expect(mocks.pdf).toHaveBeenCalledWith(order, issuedInvoice, expect.any(Object), {
      personalMessage: "Merci Camille !",
    });
    expect(mocks.setMessage).not.toHaveBeenCalled();
  });

  it("does not download a plain invoice if saving or reading its message fails", async () => {
    mocks.setMessage.mockRejectedValue(new Error("database unavailable"));
    expect((await post({ personalMessage: "Merci" })).status).toBe(500);
    mocks.getMessage.mockRejectedValue(new Error("database unavailable"));
    expect((await adminGet(getRequest(), context())).status).toBe(500);
    expect((await messageGet(getRequest(), context())).status).toBe(500);
    expect(mocks.pdf).not.toHaveBeenCalled();
  });
});

describe("customer invoice downloads", () => {
  it("requires the logged-in owner before reading or issuing the invoice", async () => {
    mocks.session.mockResolvedValueOnce(null);
    expect((await customerGet(getRequest(), context())).status).toBe(401);
    mocks.order.mockResolvedValueOnce({ ...order, customerId: "another-customer" });
    expect((await customerGet(getRequest(), context())).status).toBe(403);
    expect(mocks.issue).not.toHaveBeenCalled();
    expect(mocks.getMessage).not.toHaveBeenCalled();
  });

  it("includes the saved message and ignores message query parameters", async () => {
    const request = new Request(`${getRequest().url}?personalMessage=Changed`);
    expect((await customerGet(request, context())).status).toBe(200);
    expect(mocks.pdf).toHaveBeenCalledWith(order, issuedInvoice, expect.any(Object), {
      personalMessage: "Merci Camille !",
    });
    expect(mocks.setMessage).not.toHaveBeenCalled();
  });

  it("fails without generating a PDF when the stored message cannot be read", async () => {
    mocks.getMessage.mockRejectedValue(new Error("database unavailable"));
    expect((await customerGet(getRequest(), context())).status).toBe(500);
    expect(mocks.pdf).not.toHaveBeenCalled();
  });
});
