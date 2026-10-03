import { beforeEach, describe, expect, it, vi } from "vitest";

const { from, rpc, listUsers, tables, queries } = vi.hoisted(() => ({
  from: vi.fn(), rpc: vi.fn(), listUsers: vi.fn(),
  tables: new Map<string, Array<{ data: unknown; error: { message: string } | null }>>(),
  queries: [] as Array<{ table: string; method: string; args: unknown[] }>,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseServiceClient: () => ({ from, rpc, auth: { admin: { listUsers } } }),
}));

import {
  claimNextMailingRecipient, finishMailingRecipient, getMailingCampaign, isMailingRecipientEligible,
  listMailingCampaigns, listMailingContacts, saveMailingDraft, startMailingCampaign, unsubscribeMailingEmail,
} from "./mailing-backend";

const id = "11111111-1111-4111-8111-111111111111";
const date = "2026-10-02T10:00:00.000Z";
const counts = { total: 0, pending: 0, processing: 0, sent: 0, failed: 0, skipped: 0, uncertain: 0 };
const campaign = {
  id, name: "Actualités", subject: "Bonjour", body: "Bonjour {{prenom}}", kind: "marketing",
  recipient_emails: ["client@example.fr"], status: "draft", counts,
  created_at: date, updated_at: date, started_at: null, completed_at: null,
};
const draft = {
  id, name: campaign.name, subject: campaign.subject, body: campaign.body,
  kind: "marketing" as const, recipientEmails: campaign.recipient_emails,
};

function rows(table: string, data: unknown, error: { message: string } | null = null) {
  tables.set(table, [...(tables.get(table) ?? []), { data, error }]);
}

beforeEach(() => {
  vi.clearAllMocks(); tables.clear(); queries.length = 0;
  listUsers.mockResolvedValue({ data: { users: [] }, error: null });
  rpc.mockResolvedValue({ data: campaign, error: null });
  from.mockImplementation((table: string) => {
    const query: Record<string, unknown> = {};
    for (const method of ["select", "eq", "order", "limit", "range", "single", "maybeSingle", "upsert"]) {
      query[method] = (...args: unknown[]) => { queries.push({ table, method, args }); return query; };
    }
    query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(tables.get(table)?.shift() ?? { data: [], error: null }).then(resolve, reject);
    return query;
  });
});

describe("mailing audience", () => {
  it("merges newsletter and confirmed customers, deduplicates emails, and preserves opt-outs", async () => {
    listUsers.mockResolvedValue({ data: { users: [
      { id: "a", email: " CLIENT@example.fr ", email_confirmed_at: date },
      { id: "b", email: "unconfirmed@example.fr", email_confirmed_at: null },
      { id: "c", email: "deleted@example.fr", email_confirmed_at: date, deleted_at: date },
      { id: "d", email: "no-profile@example.fr", email_confirmed_at: date },
    ] }, error: null });
    rows("profiles", [{ id: "a", first_name: "Alice", last_name: "Martin" }]);
    rows("newsletter_subscribers", [
      { id: 1, email: "client@example.fr", status: "unsubscribed" },
      { id: 2, email: "newsletter@example.fr", status: "active" },
    ]);
    expect(await listMailingContacts()).toEqual([
      { email: "client@example.fr", firstName: "Alice", lastName: "Martin", customer: true, subscribed: false, unsubscribed: true },
      { email: "newsletter@example.fr", firstName: "", lastName: "", customer: false, subscribed: true, unsubscribed: false },
      { email: "no-profile@example.fr", firstName: "", lastName: "", customer: true, subscribed: false, unsubscribed: false },
    ]);
    expect(queries.find((query) => query.table === "profiles" && query.method === "select")?.args).toEqual(["id,first_name,last_name"]);
  });

  it("paginates every audience source beyond Supabase's first 1000 rows", async () => {
    listUsers.mockResolvedValueOnce({ data: { users: Array.from({ length: 1000 }, (_, i) => ({ id: String(i), email: `user${i}@example.fr`, email_confirmed_at: date })) }, error: null });
    listUsers.mockResolvedValueOnce({ data: { users: [{ id: "last", email: "last@example.fr", email_confirmed_at: date }] }, error: null });
    rows("profiles", Array.from({ length: 1000 }, (_, i) => ({ id: String(i), first_name: "", last_name: "" })));
    rows("profiles", [{ id: "last", first_name: "Dernier", last_name: "Client" }]);
    rows("newsletter_subscribers", Array.from({ length: 1000 }, (_, i) => ({ id: i, email: `user${i}@example.fr`, status: "active" })));
    rows("newsletter_subscribers", [{ id: 1001, email: "last@example.fr", status: "unsubscribed" }]);
    const contacts = await listMailingContacts();
    expect(contacts).toHaveLength(1001);
    expect(contacts.find((contact) => contact.email === "last@example.fr")).toMatchObject({ firstName: "Dernier", customer: true, unsubscribed: true });
    expect(listUsers).toHaveBeenNthCalledWith(2, { page: 2, perPage: 1000 });
    expect(queries.filter((query) => query.method === "range").map((query) => query.args)).toEqual([[0, 999], [0, 999], [1000, 1999], [1000, 1999]]);
  });

  it("fails closed when the consent source cannot be read", async () => {
    rows("newsletter_subscribers", null, { message: "unavailable" });
    await expect(listMailingContacts()).rejects.toThrow("unavailable");
  });

  it("rechecks authoritative eligibility immediately and never treats a DB failure as consent", async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null });
    expect(await isMailingRecipientEligible(" CLIENT@example.fr ", "information")).toBe(false);
    expect(rpc).toHaveBeenCalledWith("rpc_mailing_recipient_eligible", { p_email: "client@example.fr", p_kind: "information" });
    rpc.mockResolvedValueOnce({ data: null, error: { message: "unavailable" } });
    await expect(isMailingRecipientEligible("client@example.fr", "marketing")).rejects.toThrow("unavailable");
  });

  it("persists unsubscribe for a customer who has no prior newsletter row", async () => {
    await unsubscribeMailingEmail("CLIENT@example.fr");
    expect(queries.find((query) => query.method === "upsert")?.args).toEqual([
      expect.objectContaining({ email: "client@example.fr", email_normalized: "client@example.fr", status: "unsubscribed", source: "mailing" }),
      { onConflict: "email_normalized" },
    ]);
  });
});

describe("durable mailing campaigns", () => {
  it("validates before the atomic draft upsert and retains the client id", async () => {
    await expect(saveMailingDraft({ ...draft, subject: "Bad\nBcc: other@example.fr" })).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
    const result = await saveMailingDraft({ ...draft, recipientEmails: ["CLIENT@example.fr", "client@example.fr"] });
    expect(result.id).toBe(id);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("rpc_save_mailing_draft", {
      p_id: id, p_name: draft.name, p_subject: draft.subject, p_body: draft.body, p_kind: draft.kind, p_recipient_emails: ["client@example.fr"],
    });
  });

  it("excludes opt-outs and removed contacts at start and passes the draft revision to the SQL lock", async () => {
    rows("mailing_campaigns", { ...campaign, recipient_emails: ["client@example.fr", "optout@example.fr", "removed@example.fr"] });
    rows("newsletter_subscribers", [{ id: 1, email: "client@example.fr", status: "active" }, { id: 2, email: "optout@example.fr", status: "unsubscribed" }]);
    await startMailingCampaign(id);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("rpc_start_mailing_campaign", {
      p_id: id, p_expected_updated_at: date, p_recipients: [{ email: "client@example.fr", first_name: "" }],
    });
  });

  it("requires customers for information and refuses an empty remaining audience", async () => {
    rows("mailing_campaigns", { ...campaign, kind: "information" });
    rows("newsletter_subscribers", [{ id: 1, email: "client@example.fr", status: "active" }]);
    await expect(startMailingCampaign(id)).rejects.toThrow("Aucun destinataire");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a stale confirmation before looking up or sending to the audience", async () => {
    rows("mailing_campaigns", campaign);
    await expect(startMailingCampaign(id, "2026-10-01T10:00:00.000Z")).rejects.toMatchObject({ status: 409 });
    expect(listUsers).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("makes start replay independent from the now-changed audience", async () => {
    rows("mailing_campaigns", { ...campaign, status: "sending", started_at: date });
    expect((await startMailingCampaign(id)).status).toBe("sending");
    expect(listUsers).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing campaign and bounds history reads", async () => {
    rows("mailing_campaigns", null);
    await expect(getMailingCampaign(id)).rejects.toMatchObject({ status: 404 });
    rows("mailing_campaigns", [campaign]);
    expect(await listMailingCampaigns()).toHaveLength(1);
    expect(queries).toContainEqual({ table: "mailing_recipients", method: "limit", args: [100] });
    expect(queries).toContainEqual({ table: "mailing_campaigns", method: "limit", args: [50] });
  });

  it("uses atomic claims and accepts a throttled or exhausted queue", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await claimNextMailingRecipient(id)).toBeNull();
    rpc.mockResolvedValueOnce({ data: { campaign: { ...campaign, status: "sending" }, recipient: { id, email: "client@example.fr", first_name: "Alice", status: "processing", error: null, sent_at: null } }, error: null });
    expect(await claimNextMailingRecipient(id)).toMatchObject({ recipient: { firstName: "Alice", status: "processing" } });
    expect(rpc).toHaveBeenCalledWith("rpc_claim_mailing_recipient", { p_campaign_id: id });
  });

  it("stores bounded failure messages and surfaces failed persistence to prevent blind retries", async () => {
    await finishMailingRecipient(id, "failed", "x".repeat(1500));
    expect(rpc).toHaveBeenCalledWith("rpc_finish_mailing_recipient", { p_recipient_id: id, p_status: "failed", p_error: "x".repeat(1000) });
    rpc.mockResolvedValueOnce({ data: null, error: { message: "write failed" } });
    await expect(finishMailingRecipient(id, "sent")).rejects.toThrow("write failed");
  });
});
