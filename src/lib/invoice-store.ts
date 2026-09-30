import "server-only";

import {
  getIssuedInvoiceByOrderIdFromSupabase,
  getInvoicePersonalMessageFromSupabase,
  issueInvoiceForOrderInSupabase,
  setInvoicePersonalMessageInSupabase,
} from "@/lib/supabase/invoice-backend";
import type { IssuedInvoice } from "@/types/invoice";

export async function getIssuedInvoiceByOrderId(orderId: string): Promise<IssuedInvoice | null> {
  return getIssuedInvoiceByOrderIdFromSupabase(orderId);
}

export async function issueInvoiceForOrder(orderId: string): Promise<IssuedInvoice> {
  return issueInvoiceForOrderInSupabase(orderId);
}

export async function getInvoicePersonalMessage(orderId: string): Promise<string> {
  return getInvoicePersonalMessageFromSupabase(orderId);
}

export async function setInvoicePersonalMessage(orderId: string, message: string): Promise<string> {
  return setInvoicePersonalMessageInSupabase(orderId, message);
}
