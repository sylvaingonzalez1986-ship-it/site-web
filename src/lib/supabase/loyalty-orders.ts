import "server-only";

import type { LoyaltyOrder } from "@/lib/loyalty";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { readSupabaseQuery } from "@/lib/supabase/read-query";
import { ORDER_STATUS_OPTIONS } from "@/types/store";

const PAGE_SIZE = 500;
const PAYMENT_STATES = new Set<LoyaltyOrder["paymentState"]>(["pending", "paid", "failed", "not_configured"]);

/** Read only this customer's loyalty inputs, independently of the shop catalogue. */
export async function readLoyaltyOrdersForCustomerFromSupabase(customerId: string): Promise<LoyaltyOrder[]> {
  const userId = customerId.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    throw new Error("Identite client invalide.");
  }

  const supabase = createSupabaseServiceClient();
  const orders: LoyaltyOrder[] = [];
  let afterId: string | null = null;
  while (true) {
    const result = await readSupabaseQuery("read customer loyalty orders", (signal) => {
      let query = supabase.from("orders")
        .select("id,status,payment_state,total_amount")
        // Match the store mapper: canonical ownership takes priority over legacy ownership.
        .or(`customer_id.eq.${userId},and(customer_id.is.null,legacy_customer_id.eq.${userId})`)
        .or("archived_at.is.null,and(payment_state.eq.paid,payment_review_required.eq.true)")
        .order("id", { ascending: true })
        .limit(PAGE_SIZE);
      if (afterId !== null) query = query.gt("id", afterId);
      return query.abortSignal(signal);
    });

    const rows = result.data ?? [];
    for (const row of rows) {
      const status = row.status as LoyaltyOrder["status"];
      const paymentState = row.payment_state as LoyaltyOrder["paymentState"];
      const amount = Number(row.total_amount);
      if (row.total_amount === null || row.total_amount === undefined || !Number.isFinite(amount)) {
        throw new Error("[supabase:read customer loyalty orders] Montant de commande invalide.");
      }
      orders.push({
        status: ORDER_STATUS_OPTIONS.includes(status) ? status : "new",
        paymentState: PAYMENT_STATES.has(paymentState) ? paymentState : "pending",
        totalAmount: Number(amount.toFixed(2)),
      });
    }
    if (rows.length < PAGE_SIZE) return orders;
    const lastId: unknown = rows.at(-1)?.id;
    if (typeof lastId !== "string" || !lastId || lastId === afterId) {
      throw new Error("[supabase:read customer loyalty orders] Pagination de commandes invalide.");
    }
    afterId = lastId;
  }
}
