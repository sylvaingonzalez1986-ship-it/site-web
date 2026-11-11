import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({ denied: vi.fn(), upload: vi.fn(), login: vi.fn(), rate: vi.fn(), identity: vi.fn(), password: vi.fn(), createSession: vi.fn() }));
vi.mock("@/lib/admin-guard", () => ({ denyIfNotAdminApi: mocks.denied }));
vi.mock("@/lib/product-image-storage", () => ({
  saveProductImageUpload: mocks.upload,
  ProductImageUploadError: class extends Error {},
}));
vi.mock("@/lib/customer-backend", () => ({ loginCustomerByBackend: mocks.login, clearLegacyCustomerCookie: vi.fn(), getCurrentCustomerSessionByBackend: mocks.identity }));
vi.mock("@/lib/admin-password", () => ({ verifyAdminPassword: mocks.password }));
vi.mock("@/lib/admin-session-store", () => ({ createStoredAdminSession: mocks.createSession }));
vi.mock("@/lib/admin-totp", () => ({ isAdminTotpEnabled: () => false, verifyAdminTotp: vi.fn() }));
vi.mock("@/lib/audit-log", () => ({ logAuditEvent: vi.fn() }));
vi.mock("@/lib/security-rate-limit", () => ({ getRequestIp: () => "127.0.0.1", hitRateLimit: mocks.rate, logRateLimitRejection: vi.fn() }));

import { POST as uploadImage } from "@/app/api/admin/products/upload/route";
import { POST as accountLogin } from "@/app/api/account/login/route";
import { POST as adminLogin } from "@/app/api/admin/login/route";
import { PRODUCT_IMAGE_UPLOAD_MAX_BYTES } from "@/lib/product-image-policy";

function streamingRequest(chunks: Uint8Array[], headers: Record<string, string>) {
  let reads = 0;
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({
    pull(controller) { if (reads < chunks.length) controller.enqueue(chunks[reads++]); else controller.close(); },
    cancel,
  }, { highWaterMark: 0 });
  return {
    request: new Request("https://example.test/api", { method: "POST", body, headers, duplex: "half" } as RequestInit & { duplex: "half" }),
    cancel, reads: () => reads,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.denied.mockResolvedValue(null);
  mocks.rate.mockResolvedValue({ allowed: true });
  mocks.upload.mockResolvedValue("/uploads/fixture.webp");
  mocks.identity.mockResolvedValue({ customerId: "fixture-admin", customer: { email: "admin@example.test" } });
  mocks.password.mockResolvedValue(true);
  mocks.createSession.mockResolvedValue("synthetic-admin-session");
  vi.stubEnv("ADMIN_ALLOWED_EMAILS", "admin@example.test");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network access"); }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("bounded request bodies in account and upload handlers", () => {
  it.each([undefined, "1"])("rejects a chunked account login before authentication with Content-Length=%s", async (length) => {
    const input = streamingRequest([new Uint8Array(32 * 1024), new Uint8Array(32 * 1024 + 1), new Uint8Array(1)],
      { "content-type": "application/json", ...(length ? { "content-length": length } : {}) });
    expect((await accountLogin(input.request)).status).toBe(413);
    expect(mocks.login).not.toHaveBeenCalled();
    expect(mocks.rate).not.toHaveBeenCalled();
    expect(input.cancel).toHaveBeenCalledOnce();
    expect(input.reads()).toBe(2);
  });

  it("still rejects malformed JSON without calling the authentication backend", async () => {
    const input = streamingRequest([new TextEncoder().encode('{"password":')], { "content-type": "application/json" });
    expect((await accountLogin(input.request)).status).toBe(400);
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it("rejects an oversized admin login without minting a session", async () => {
    const input = streamingRequest([new Uint8Array(64 * 1024 + 1)], { "content-type": "application/json" });
    expect((await adminLogin(input.request)).status).toBe(413);
    expect(mocks.identity).not.toHaveBeenCalled();
    expect(mocks.password).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("keeps admin identity and password checks on ordinary chunked JSON", async () => {
    const request = () => streamingRequest([new TextEncoder().encode('{"password":"fixture-password"}')], { "content-type": "application/json" }).request;
    mocks.identity.mockResolvedValueOnce(null);
    expect((await adminLogin(request())).status).toBe(401);
    expect(mocks.createSession).not.toHaveBeenCalled();
    mocks.password.mockResolvedValueOnce(false);
    expect((await adminLogin(request())).status).toBe(401);
    expect(mocks.createSession).not.toHaveBeenCalled();
    const response = await adminLogin(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(mocks.password).toHaveBeenLastCalledWith("fixture-password");
    expect(mocks.createSession).toHaveBeenCalledOnce();
  });

  it("checks administrator authentication before pulling any multipart data", async () => {
    mocks.denied.mockResolvedValue(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    const input = streamingRequest([new Uint8Array(1024)], { "content-type": "multipart/form-data; boundary=test" });
    expect((await uploadImage(input.request)).status).toBe(401);
    expect(input.reads()).toBe(0);
    expect(mocks.rate).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it.each([undefined, "12"])("bounds the complete multipart stream with Content-Length=%s", async (length) => {
    const maxBytes = PRODUCT_IMAGE_UPLOAD_MAX_BYTES + 64 * 1024;
    const chunk = new Uint8Array(64 * 1024);
    const chunks = Array.from({ length: maxBytes / chunk.byteLength + 2 }, () => chunk);
    const input = streamingRequest(chunks, {
      "content-type": "multipart/form-data; boundary=test", ...(length ? { "content-length": length } : {}),
    });
    expect((await uploadImage(input.request)).status).toBe(413);
    expect(mocks.denied).toHaveBeenCalledOnce();
    expect(mocks.rate).toHaveBeenCalledOnce();
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(input.cancel).toHaveBeenCalledOnce();
    expect(input.reads()).toBe(chunks.length - 1);
  });

  it("accepts a real FormData upload without Content-Length and preserves the file", async () => {
    const form = new FormData();
    form.set("file", new File(["fixture image bytes"], "fixture.webp", { type: "image/webp" }));
    const request = new Request("https://example.test/api/admin/products/upload", { method: "POST", body: form });
    expect(request.headers.has("content-length")).toBe(false);
    const response = await uploadImage(request);
    expect(response.status).toBe(201);
    expect(mocks.upload).toHaveBeenCalledOnce();
    const file = mocks.upload.mock.calls[0][0] as File;
    expect(file.name).toBe("fixture.webp");
    expect(file.type).toBe("image/webp");
    expect(await file.text()).toBe("fixture image bytes");
    expect(fetch).not.toHaveBeenCalled();
  });
});
