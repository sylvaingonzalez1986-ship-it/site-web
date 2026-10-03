import "server-only";

import type { User } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { isMailingContactEligible, isMailingUuid, isValidMailingEmail, MailingValidationError, parseMailingDraft } from "@/lib/mailing-policy";
import type {
  MailingCampaign, MailingCampaignDetail, MailingContact, MailingCounts,
  MailingDraftInput, MailingKind, MailingRecipient, MailingRecipientStatus,
} from "@/types/mailing";

const PAGE_SIZE = 1000;
const CAMPAIGN_COLUMNS = "id,name,subject,body,kind,recipient_emails,status,counts,created_at,updated_at,started_at,completed_at";
const RECIPIENT_COLUMNS = "id,email,first_name,status,error,sent_at";

type CampaignRow = {
  id: string; name: string; subject: string; body: string; kind: MailingKind;
  recipient_emails: string[]; status: MailingCampaign["status"]; counts: MailingCounts;
  created_at: string; updated_at: string; started_at: string | null; completed_at: string | null;
};
type RecipientRow = {
  id: string; email: string; first_name: string; status: MailingRecipientStatus;
  error: string | null; sent_at: string | null;
};
type ProfileRow = { id: string; first_name: string; last_name: string };
type SubscriberRow = { id: number; email: string; status: string };

function failIfError(error: { message: string } | null, context: string): void {
  if (error) throw new Error(`[supabase:mailing ${context}] ${error.message}`);
}

function assertId(id: string): void {
  if (!isMailingUuid(id)) throw new MailingValidationError("Identifiant de campagne invalide.");
}

function mapCampaign(row: CampaignRow): MailingCampaign {
  return {
    id: row.id, name: row.name, subject: row.subject, body: row.body, kind: row.kind,
    recipientEmails: row.recipient_emails, status: row.status, counts: row.counts,
    createdAt: row.created_at, updatedAt: row.updated_at,
    startedAt: row.started_at, completedAt: row.completed_at,
  };
}

function mapRecipient(row: RecipientRow): MailingRecipient {
  return {
    id: row.id, email: row.email, firstName: row.first_name,
    status: row.status, error: row.error, sentAt: row.sent_at,
  };
}

async function listConfirmedUsers(): Promise<User[]> {
  const supabase = createSupabaseServiceClient();
  const users: User[] = [];
  for (let page = 1; ; page += 1) {
    const result = await supabase.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    failIfError(result.error, "list auth users");
    const batch = result.data.users;
    users.push(...batch.filter((user) => user.email && user.email_confirmed_at && !user.deleted_at));
    if (batch.length < PAGE_SIZE) break;
  }
  return users;
}

async function listProfiles(): Promise<ProfileRow[]> {
  const supabase = createSupabaseServiceClient();
  const profiles: ProfileRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const result = await supabase.from("profiles").select("id,first_name,last_name")
      .order("id", { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
    failIfError(result.error, "list profiles");
    const batch = (result.data ?? []) as ProfileRow[];
    profiles.push(...batch);
    if (batch.length < PAGE_SIZE) return profiles;
  }
}

async function listSubscribers(): Promise<SubscriberRow[]> {
  const supabase = createSupabaseServiceClient();
  const subscribers: SubscriberRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const result = await supabase.from("newsletter_subscribers").select("id,email,status")
      .order("id", { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
    failIfError(result.error, "list newsletter subscribers");
    const batch = (result.data ?? []) as SubscriberRow[];
    subscribers.push(...batch);
    if (batch.length < PAGE_SIZE) return subscribers;
  }
}

export async function listMailingContacts(): Promise<MailingContact[]> {
  const [users, profiles, subscribers] = await Promise.all([listConfirmedUsers(), listProfiles(), listSubscribers()]);
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const contacts = new Map<string, MailingContact>();
  for (const user of users) {
    const email = user.email!.trim().toLowerCase();
    if (!isValidMailingEmail(email)) continue;
    const profile = profilesById.get(user.id);
    contacts.set(email, {
      email, firstName: profile?.first_name ?? "", lastName: profile?.last_name ?? "",
      customer: true, subscribed: false, unsubscribed: false,
    });
  }
  for (const subscriber of subscribers) {
    const email = subscriber.email.trim().toLowerCase();
    if (!isValidMailingEmail(email)) continue;
    const contact = contacts.get(email) ?? {
      email, firstName: "", lastName: "", customer: false, subscribed: false, unsubscribed: false,
    };
    contact.subscribed ||= subscriber.status === "active";
    contact.unsubscribed ||= subscriber.status === "unsubscribed";
    contacts.set(email, contact);
  }
  return [...contacts.values()].sort((a, b) => a.email.localeCompare(b.email));
}

export async function listMailingCampaigns(): Promise<MailingCampaign[]> {
  const result = await createSupabaseServiceClient().from("mailing_campaigns")
    .select(CAMPAIGN_COLUMNS).order("created_at", { ascending: false }).limit(50);
  failIfError(result.error, "list campaigns");
  return ((result.data ?? []) as CampaignRow[]).map(mapCampaign);
}

async function readCampaign(id: string): Promise<MailingCampaign> {
  assertId(id);
  const result = await createSupabaseServiceClient().from("mailing_campaigns")
    .select(CAMPAIGN_COLUMNS).eq("id", id).maybeSingle();
  failIfError(result.error, "read campaign");
  if (!result.data) throw new MailingValidationError("Campagne introuvable.", 404);
  return mapCampaign(result.data as CampaignRow);
}

export async function getMailingCampaign(id: string): Promise<MailingCampaignDetail> {
  assertId(id);
  const supabase = createSupabaseServiceClient();
  const [campaign, result] = await Promise.all([
    readCampaign(id),
    supabase.from("mailing_recipients").select(RECIPIENT_COLUMNS).eq("campaign_id", id)
      .order("updated_at", { ascending: false }).order("id", { ascending: false }).limit(100),
  ]);
  failIfError(result.error, "read recipients");
  return { campaign, recipients: ((result.data ?? []) as RecipientRow[]).map(mapRecipient) };
}

export async function saveMailingDraft(input: MailingDraftInput): Promise<MailingCampaign> {
  const draft = parseMailingDraft(input);
  const result = await createSupabaseServiceClient().rpc("rpc_save_mailing_draft", {
    p_id: draft.id, p_name: draft.name, p_subject: draft.subject, p_body: draft.body,
    p_kind: draft.kind, p_recipient_emails: draft.recipientEmails,
  });
  failIfError(result.error, "save draft");
  return mapCampaign(result.data as CampaignRow);
}

export async function startMailingCampaign(id: string, expectedUpdatedAt?: string): Promise<MailingCampaign> {
  const campaign = await readCampaign(id);
  // A replay after the campaign started must not depend on the current audience.
  if (campaign.status !== "draft") return campaign;
  if (expectedUpdatedAt !== undefined && expectedUpdatedAt !== campaign.updatedAt) {
    throw new MailingValidationError("Le brouillon a changé. Recharge la campagne avant de confirmer l'envoi.", 409);
  }
  const contacts = await listMailingContacts();
  const selected = new Set(campaign.recipientEmails);
  const recipients = contacts.filter((contact) => selected.has(contact.email) && isMailingContactEligible(contact, campaign.kind));
  if (!recipients.length) throw new MailingValidationError("Aucun destinataire éligible dans cette campagne.");
  const result = await createSupabaseServiceClient().rpc("rpc_start_mailing_campaign", {
    p_id: id,
    p_expected_updated_at: campaign.updatedAt,
    p_recipients: recipients.map((contact) => ({ email: contact.email, first_name: contact.firstName })),
  });
  failIfError(result.error, "start campaign");
  return mapCampaign(result.data as CampaignRow);
}

export async function claimNextMailingRecipient(id: string): Promise<{ campaign: MailingCampaign; recipient: MailingRecipient } | null> {
  assertId(id);
  const result = await createSupabaseServiceClient().rpc("rpc_claim_mailing_recipient", { p_campaign_id: id });
  failIfError(result.error, "claim recipient");
  if (!result.data) return null;
  const data = result.data as { campaign: CampaignRow; recipient: RecipientRow };
  return { campaign: mapCampaign(data.campaign), recipient: mapRecipient(data.recipient) };
}

export async function finishMailingRecipient(
  id: string, status: "sent" | "failed" | "skipped" | "uncertain", error?: string,
): Promise<void> {
  assertId(id);
  if (!["sent", "failed", "skipped", "uncertain"].includes(status)) throw new Error("Résultat d'envoi invalide.");
  const result = await createSupabaseServiceClient().rpc("rpc_finish_mailing_recipient", {
    p_recipient_id: id, p_status: status, p_error: error?.slice(0, 1000) ?? null,
  });
  failIfError(result.error, "finish recipient");
}

export async function isMailingRecipientEligible(email: string, kind: MailingKind): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!isValidMailingEmail(normalized) || !["marketing", "information"].includes(kind)) return false;
  const result = await createSupabaseServiceClient().rpc("rpc_mailing_recipient_eligible", { p_email: normalized, p_kind: kind });
  failIfError(result.error, "check recipient eligibility");
  return result.data === true;
}

export async function unsubscribeMailingEmail(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!isValidMailingEmail(normalized)) throw new MailingValidationError("Adresse e-mail invalide.");
  const result = await createSupabaseServiceClient().from("newsletter_subscribers").upsert({
    email: normalized, email_normalized: normalized, status: "unsubscribed", source: "mailing",
    updated_at: new Date().toISOString(),
  }, { onConflict: "email_normalized" });
  failIfError(result.error, "unsubscribe");
}
