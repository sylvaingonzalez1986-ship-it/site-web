import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { GET as overview, POST as save } from "@/app/api/admin/mailing/route";
import { POST as start } from "@/app/api/admin/mailing/[id]/start/route";
import { POST as processNext } from "@/app/api/admin/mailing/[id]/process/route";
import { POST as testMail } from "@/app/api/admin/mailing/test/route";
import * as unsubscribeRoute from "@/app/api/newsletter/unsubscribe/route";
import { MailingValidationError } from "@/lib/mailing-policy";
import { readMailingJson } from "@/lib/mailing-api";

const mocks = vi.hoisted(() => ({
  deny: vi.fn(), limit: vi.fn(), contacts: vi.fn(), campaigns: vi.fn(), save: vi.fn(), start: vi.fn(), claim: vi.fn(), finish: vi.fn(), detail: vi.fn(), eligible: vi.fn(), unsubscribe: vi.fn(), settings: vi.fn(), send: vi.fn(), readToken: vi.fn(),
}));
vi.mock("@/lib/admin-guard", () => ({ denyIfNotAdminApi: mocks.deny }));
vi.mock("@/lib/security-rate-limit", () => ({ hitRateLimit: mocks.limit }));
vi.mock("@/lib/mailing-backend", () => ({ listMailingContacts: mocks.contacts, listMailingCampaigns: mocks.campaigns, saveMailingDraft: mocks.save, startMailingCampaign: mocks.start, claimNextMailingRecipient: mocks.claim, finishMailingRecipient: mocks.finish, getMailingCampaign: mocks.detail, isMailingRecipientEligible: mocks.eligible, unsubscribeMailingEmail: mocks.unsubscribe }));
vi.mock("@/lib/mailing-email", () => ({ getMailingSettings: mocks.settings, sendMailingEmail: mocks.send, classifyMailingSendError: () => ({ status: "uncertain", message: "Remise incertaine.", pause: true }) }));
vi.mock("@/lib/mailing-unsubscribe", () => ({ readMailingUnsubscribeToken: mocks.readToken }));

const id = "e1edeb22-d00f-4086-bba6-19d9d9482e44";
const recipient = { id: "917b2c5c-e7dd-498a-af62-71b9aad63f94", email: "one@example.test", firstName: "Camille" };
const campaign = { id, subject: "Bonjour", body: "Salut {{prenom}}", kind: "marketing", status: "sending" };
const context = { params: Promise.resolve({ id }) };
function post(path: string, body: unknown = {}, origin = "https://admin.example.test") {
  return new Request(`https://admin.example.test${path}`, { method: "POST", headers: { "Content-Type": "application/json", origin }, body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.deny.mockResolvedValue(null);
  mocks.limit.mockResolvedValue({ allowed: true });
  mocks.contacts.mockResolvedValue([]);
  mocks.campaigns.mockResolvedValue([]);
  mocks.detail.mockResolvedValue({ campaign, recipients: [] });
  mocks.settings.mockReturnValue({ configured: true });
  mocks.eligible.mockResolvedValue(true);
  mocks.claim.mockResolvedValue({ campaign, recipient });
  mocks.finish.mockResolvedValue(undefined);
  mocks.send.mockResolvedValue(undefined);
});

describe("admin mailing API protections", () => {
  it("blocks reads and sends before touching contacts or SMTP when unauthenticated", async () => {
    mocks.deny.mockResolvedValue(NextResponse.json({ error: "Non autorisé" }, { status: 401 }));
    expect((await overview()).status).toBe(401);
    expect((await processNext(post("/api/admin/mailing/process"), context)).status).toBe(401);
    expect(mocks.contacts).not.toHaveBeenCalled();
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("rejects cross-origin writes and rate-limited sending", async () => {
    expect((await save(post("/api/admin/mailing", {}, "https://attacker.test"))).status).toBe(403);
    expect(mocks.save).not.toHaveBeenCalled();
    mocks.limit.mockResolvedValue({ allowed: false, retryAfterSeconds: 18 });
    const response = await processNext(post("/api/admin/mailing/process"), context);
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("18");
    expect(mocks.claim).not.toHaveBeenCalled();
  });
  it("does not cache private overview data", async () => {
    expect((await overview()).headers.get("cache-control")).toBe("private, no-store");
  });
  it("requires explicit confirmation with the reviewed draft version before starting", async () => {
    expect((await start(post("/api/admin/mailing/start", {}), context)).status).toBe(400);
    expect((await start(post("/api/admin/mailing/start", { confirmed: true }), context)).status).toBe(400);
    expect(mocks.start).not.toHaveBeenCalled();
    const expectedUpdatedAt = "2026-10-02T10:00:00.000Z";
    mocks.start.mockRejectedValue(new MailingValidationError("Brouillon modifié", 409));
    const response = await start(post("/api/admin/mailing/start", { confirmed: true, expectedUpdatedAt }), context);
    expect(response.status).toBe(409);
    expect(mocks.start).toHaveBeenCalledWith(id, expectedUpdatedAt);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("rejects invalid bodies, even oversized requests without Content-Length", async () => {
    await expect(readMailingJson(post("/api/admin/mailing", { body: "a".repeat(3 * 1024 * 1024) }))).rejects.toMatchObject({ status: 413 });
    expect((await save(post("/api/admin/mailing", { body: "abc" }))).status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("test sends have exactly one explicit destination and never enqueue a campaign", async () => {
    expect((await testMail(post("/api/admin/mailing/test", { subject: "Test", body: "Texte", email: "one@example.test,two@example.test" }))).status).toBe(400);
    expect(mocks.send).not.toHaveBeenCalled();
    expect((await testMail(post("/api/admin/mailing/test", { subject: "Test", body: "Texte", email: "ONE@example.test" }))).status).toBe(200);
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ email: "one@example.test", test: true }));
    expect(mocks.start).not.toHaveBeenCalled();
  });
});

describe("durable SMTP processing", () => {
  it("does not send when another request owns the claim", async () => {
    mocks.claim.mockResolvedValue(null);
    expect((await processNext(post("/api/admin/mailing/process"), context)).status).toBe(200);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("rechecks opt-out before SMTP and records an excluded recipient", async () => {
    mocks.eligible.mockResolvedValue(false);
    await processNext(post("/api/admin/mailing/process"), context);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.finish).toHaveBeenCalledWith(recipient.id, "skipped", expect.any(String));
  });
  it("records success only after delivery returns, without confusing persistence failure with a failed send", async () => {
    mocks.finish.mockRejectedValue(new Error("database down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect((await processNext(post("/api/admin/mailing/process"), context)).status).toBe(503);
      expect(mocks.send).toHaveBeenCalledOnce();
      expect(mocks.finish).toHaveBeenCalledExactlyOnceWith(recipient.id, "sent", undefined);
    } finally { spy.mockRestore(); }
  });
  it("persists an ambiguous SMTP outcome without retrying it", async () => {
    mocks.send.mockRejectedValue(new Error("timeout after DATA"));
    expect((await processNext(post("/api/admin/mailing/process"), context)).status).toBe(502);
    expect(mocks.send).toHaveBeenCalledOnce();
    expect(mocks.finish).toHaveBeenCalledWith(recipient.id, "uncertain", "Remise incertaine.");
  });
  it("never sends if eligibility cannot be checked", async () => {
    mocks.eligible.mockRejectedValue(new Error("database down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try { expect((await processNext(post("/api/admin/mailing/process"), context)).status).toBe(503); }
    finally { spy.mockRestore(); }
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.finish).not.toHaveBeenCalled();
  });
});

describe("public unsubscribe action", () => {
  const form = (body: string, query = "") => new Request(`https://admin.example.test/api/newsletter/unsubscribe${query}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  it("does not unsubscribe on GET and rejects an invalid token", async () => {
    expect("GET" in unsubscribeRoute).toBe(false);
    mocks.readToken.mockReturnValue(null);
    expect((await unsubscribeRoute.POST(form("token=invalid"))).status).toBe(400);
    expect(mocks.unsubscribe).not.toHaveBeenCalled();
  });
  it("accepts signed form confirmation and redirects without exposing the email/token", async () => {
    mocks.readToken.mockReturnValue("one@example.test");
    const response = await unsubscribeRoute.POST(form("token=valid"));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/newsletter/desinscription?done=1");
    expect(mocks.unsubscribe).toHaveBeenCalledExactlyOnceWith("one@example.test");
  });
  it("only accepts One-Click POST with its required payload", async () => {
    mocks.readToken.mockReturnValue("one@example.test");
    expect((await unsubscribeRoute.POST(form("", "?token=valid"))).status).toBe(400);
    expect(mocks.unsubscribe).not.toHaveBeenCalled();
    expect((await unsubscribeRoute.POST(form("List-Unsubscribe=One-Click", "?token=valid"))).status).toBe(200);
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  });
});
