import "server-only";

import { validateInvoicePersonalMessage } from "@/lib/invoice-message";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import type { IssuedInvoice } from "@/types/invoice";

function toInvoiceIssuanceMessage(errorMessage: string): string {
  if (errorMessage.includes("invoices_invoice_number_key")) {
    return "Le compteur de factures est desynchronise. Appliquez la migration de resynchronisation puis reessayez.";
  }

  return errorMessage;
}

function failIfError(error: { message: string } | null, context: string): void {
  if (error) {
    throw new Error(`[supabase:${context}] ${toInvoiceIssuanceMessage(error.message)}`);
  }
}

function toIssuedInvoice(row: Record<string, unknown> | null): IssuedInvoice | null {
  if (!row) {
    return null;
  }

  const orderId = typeof row.order_id === "string" ? row.order_id : "";
  const invoiceNumber = typeof row.invoice_number === "string" ? row.invoice_number : "";
  const sequence = Number(row.sequence);
  const issuedAt = typeof row.issued_at === "string" ? row.issued_at : new Date().toISOString();

  if (!orderId || !invoiceNumber || !Number.isFinite(sequence)) {
    return null;
  }

  return {
    orderId,
    invoiceNumber,
    sequence: Math.floor(sequence),
    issuedAt,
  };
}

export async function getIssuedInvoiceByOrderIdFromSupabase(
  orderId: string,
): Promise<IssuedInvoice | null> {
  const safeOrderId = orderId.trim();
  if (!safeOrderId) {
    return null;
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("invoices")
    .select("order_id, invoice_number, sequence, issued_at")
    .eq("order_id", safeOrderId)
    .maybeSingle();

  failIfError(result.error, "select invoice by order_id");
  return toIssuedInvoice(result.data as Record<string, unknown> | null);
}

export async function issueInvoiceForOrderInSupabase(orderId: string): Promise<IssuedInvoice> {
  const safeOrderId = orderId.trim();
  if (!safeOrderId) {
    throw new Error("orderId facture invalide.");
  }

  const supabase = createSupabaseServiceClient();
  const rpcResult = await supabase.rpc("rpc_issue_invoice", {
    p_order_id: safeOrderId,
  });

  failIfError(rpcResult.error, "rpc_issue_invoice");

  const firstRow = Array.isArray(rpcResult.data) && rpcResult.data.length > 0
    ? (rpcResult.data[0] as Record<string, unknown>)
    : null;

  const invoice = firstRow
    ? {
      order_id: safeOrderId,
      invoice_number: firstRow.invoice_number,
      sequence: firstRow.sequence,
      issued_at: firstRow.issued_at,
    }
    : null;

  const mapped = toIssuedInvoice(invoice);
  if (!mapped) {
    throw new Error("Facture emise mais introuvable.");
  }

  return mapped;
}

export async function getInvoicePersonalMessageFromSupabase(orderId: string): Promise<string> {
  const safeOrderId = orderId.trim();
  if (!safeOrderId) {
    throw new Error("orderId facture invalide.");
  }

  const result = await createSupabaseServiceClient()
    .from("invoices")
    .select("personal_message")
    .eq("order_id", safeOrderId)
    .maybeSingle();

  failIfError(result.error, "select invoice personal message");
  return result.data?.personal_message ?? "";
}

export async function setInvoicePersonalMessageInSupabase(
  orderId: string,
  message: string,
): Promise<string> {
  const safeOrderId = orderId.trim();
  if (!safeOrderId) {
    throw new Error("orderId facture invalide.");
  }

  const validated = validateInvoicePersonalMessage(message);
  if (!validated.ok) {
    throw new Error(validated.error);
  }

  const result = await createSupabaseServiceClient()
    .from("invoices")
    .update({ personal_message: validated.message })
    .eq("order_id", safeOrderId)
    .select("personal_message")
    .single();

  failIfError(result.error, "update invoice personal message");
  if (typeof result.data?.personal_message !== "string") {
    throw new Error("Facture introuvable lors de l'enregistrement du message.");
  }

  return result.data.personal_message;
}
