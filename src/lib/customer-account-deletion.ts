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
  const result = await supabase.rpc("rpc_anonymize_customer_orders", {
    p_customer_id: input.customerId,
    p_email: input.customerEmail.trim().toLowerCase(),
  });
  if (result.error) {
    throw new Error(`[supabase:anonymize customer orders] ${result.error.message}`);
  }
  if (!Number.isSafeInteger(result.data) || result.data < 0) {
    throw new Error("[supabase:anonymize customer orders] Invalid result");
  }
  return result.data;
}

async function deleteNewsletterSubscription(email: string): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return false;
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase.rpc("rpc_delete_customer_newsletter_data", {
    p_email: normalizedEmail,
  });

  if (result.error) {
    throw new Error(`[supabase:delete newsletter subscriber] ${result.error.message}`);
  }

  if (typeof result.data !== "boolean") {
    throw new Error("[supabase:delete newsletter subscriber] Invalid result");
  }
  return result.data;
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
