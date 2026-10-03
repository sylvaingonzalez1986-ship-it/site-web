import "server-only";

import { deleteMissionProof, listMissionProofPathsForUser } from "@/lib/mission-proof-storage";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";

export type CustomerAccountDeletionSummary = {
  deletedUserId: string;
  anonymizedOrderCount: number;
  deletedNewsletterSubscription: boolean;
  deletedMissionProofCount: number;
};

export function normalizeDeletionConfirmationEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function buildDeletedAccountEmail(customerId: string): string {
  const shortId = customerId.trim().slice(0, 8) || "account";
  return `deleted+${shortId}@privacy.invalid`;
}

async function deleteMissionProofs(storagePaths: string[]): Promise<number> {
  for (const storagePath of storagePaths) await deleteMissionProof(storagePath);
  return storagePaths.length;
}

async function anonymizeOrders(input: {
  customerId: string;
  customerEmail: string;
}): Promise<number> {
  const supabase = createSupabaseServiceClient();
  const anonymizedEmail = buildDeletedAccountEmail(input.customerId);
  const anonymizedOrderData = {
    customer_id: null,
    legacy_customer_id: null,
    customer_email: anonymizedEmail,
    customer_name: "Compte supprime",
    shipping_address: null,
    shipping_city: null,
    shipping_postal_code: null,
    shipping_country: null,
    shipping_phone: null,
    relay_id: null,
    relay_name: null,
    relay_address: null,
    relay_postal_code: null,
    relay_city: null,
    relay_country: null,
  };

  const byCustomerId = await supabase
    .from("orders")
    .update(anonymizedOrderData)
    .eq("customer_id", input.customerId)
    .select("id");
  if (byCustomerId.error) {
    throw new Error(`[supabase:anonymize orders by customer_id] ${byCustomerId.error.message}`);
  }

  const normalizedEmail = input.customerEmail.trim().toLowerCase();
  const byEmail = normalizedEmail
    ? await supabase
        .from("orders")
        .update(anonymizedOrderData)
        .is("customer_id", null)
        .ilike("customer_email", normalizedEmail)
        .select("id")
    : { data: [], error: null };

  if (byEmail.error) {
    throw new Error(`[supabase:anonymize orders by email] ${byEmail.error.message}`);
  }

  const seenIds = new Set<string>();
  for (const row of byCustomerId.data ?? []) {
    if (typeof row.id === "string") {
      seenIds.add(row.id);
    }
  }
  for (const row of byEmail.data ?? []) {
    if (typeof row.id === "string") {
      seenIds.add(row.id);
    }
  }

  return seenIds.size;
}

async function deleteNewsletterSubscription(email: string): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return false;
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("newsletter_subscribers")
    .delete()
    .eq("email_normalized", normalizedEmail)
    .select("id");

  if (result.error) {
    throw new Error(`[supabase:delete newsletter subscriber] ${result.error.message}`);
  }

  return (result.data?.length ?? 0) > 0;
}

async function deleteAuthUser(userId: string): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const result = await supabase.auth.admin.deleteUser(userId);
  if (result.error) {
    throw new Error(`[supabase:auth.admin.deleteUser] ${result.error.message}`);
  }
}

async function deleteMailingContact(email: string): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const result = await supabase.rpc("rpc_delete_mailing_contact", { p_email: email });
  if (result.error) {
    throw new Error(`[supabase:delete mailing contact] ${result.error.message}`);
  }
}

export async function deleteCustomerAccount(input: {
  customerId: string;
  customerEmail: string;
}): Promise<CustomerAccountDeletionSummary> {
  const customerId = input.customerId.trim();
  const customerEmail = input.customerEmail.trim().toLowerCase();
  if (!customerId || !customerEmail) {
    throw new Error("Suppression de compte invalide.");
  }

  const proofPaths = await listMissionProofPathsForUser(customerId);
  const deletedMissionProofCount = await deleteMissionProofs(proofPaths);
  const anonymizedOrderCount = await anonymizeOrders({ customerId, customerEmail });
  const deletedNewsletterSubscription = await deleteNewsletterSubscription(customerEmail);
  // Remove queued recipients and historical contact details before deleting Auth.
  await deleteMailingContact(customerEmail);
  await deleteAuthUser(customerId);

  return {
    deletedUserId: customerId,
    anonymizedOrderCount,
    deletedNewsletterSubscription,
    deletedMissionProofCount,
  };
}
