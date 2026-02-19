import "server-only";

import {
  getIssuedInvoiceByOrderIdFromSupabase,
  issueInvoiceForOrderInSupabase,
} from "@/lib/supabase/invoice-backend";
import type { IssuedInvoice } from "@/types/invoice";

export async function getIssuedInvoiceByOrderId(orderId: string): Promise<IssuedInvoice | null> {
  return getIssuedInvoiceByOrderIdFromSupabase(orderId);
}

export async function issueInvoiceForOrder(orderId: string): Promise<IssuedInvoice> {
  return issueInvoiceForOrderInSupabase(orderId);
}
