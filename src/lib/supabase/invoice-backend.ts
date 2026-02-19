import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import type { IssuedInvoice } from "@/types/invoice";

function failIfError(error: { message: string } | null, context: string): void {
  if (error) {
    throw new Error(`[supabase:${context}] ${error.message}`);
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
