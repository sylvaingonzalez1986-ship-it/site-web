import "server-only";

import type { KqOrderCashReceipt, KqOrderCashRewards } from "@/lib/kanab-quest-order-cash";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";

const UNAVAILABLE: KqOrderCashRewards = {
  available: false, gameEurosPerEuro: 0, startsAt: null, receipts: [],
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const unavailable = () => new Error("Bonus de commande indisponible.");
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const validDate = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
const validCents = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 2_147_483_647;

function parseRewards(value: unknown, customerId: string | null): KqOrderCashRewards {
  if (!isRecord(value)) throw unavailable();
  if (value.available === false) return { ...UNAVAILABLE, receipts: [] };
  if (value.available !== true || !Number.isSafeInteger(value.gameEurosPerEuro)
    || (value.gameEurosPerEuro as number) <= 0 || !validDate(value.startsAt)
    || !Array.isArray(value.receipts)) throw unavailable();
  const seen = new Set<string>();
  const receipts: KqOrderCashReceipt[] = value.receipts.map((receipt: unknown) => {
    if (!isRecord(receipt) || typeof receipt.orderId !== "string" || !receipt.orderId.trim()
      || seen.has(receipt.orderId) || !validCents(receipt.productsAmountCents)
      || !validCents(receipt.cashCents) || !validDate(receipt.grantedAt)
      || typeof receipt.ruleVersion !== "string" || !receipt.ruleVersion.trim()) throw unavailable();
    seen.add(receipt.orderId);
    return {
      orderId: receipt.orderId, productsAmountCents: receipt.productsAmountCents,
      cashCents: receipt.cashCents, grantedAt: receipt.grantedAt, ruleVersion: receipt.ruleVersion,
    };
  });
  // The public preview never includes a player's receipts, even on a malformed RPC response.
  if (!customerId && receipts.length) throw unavailable();
  return { available: true, gameEurosPerEuro: value.gameEurosPerEuro as number, startsAt: value.startsAt, receipts };
}

async function loadRewards(customerId: string | null, sync: boolean): Promise<KqOrderCashRewards> {
  if ((customerId !== null && !UUID.test(customerId)) || (sync && !customerId)) throw unavailable();
  const result = await createSupabaseServiceClient().rpc(
    sync ? "rpc_kq_sync_order_cash_rewards" : "rpc_kq_get_order_cash_rewards",
    { p_user_id: customerId },
  );
  if (result.error) {
    // Code can be deployed before its migration: do not promise a bonus until the RPC exists.
    if (result.error.code === "PGRST202" || result.error.code === "42883") {
      return { ...UNAVAILABLE, receipts: [] };
    }
    throw unavailable();
  }
  return parseRewards(result.data, customerId);
}

export const getKqOrderCashRewards = (customerId: string | null = null) => loadRewards(customerId, false);
export const syncKqOrderCashRewards = (customerId: string) => loadRewards(customerId, true);
