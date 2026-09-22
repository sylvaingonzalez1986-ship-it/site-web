import "server-only";
import { createSupabaseServiceClient } from "./admin";
import { isKqTreasurySnapshot, KQ_TREASURY_PERIODS, type KqTreasuryPeriod, type KqTreasurySnapshot } from "../kanab-quest-treasury";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type KqTreasuryQuery = { period: KqTreasuryPeriod; offset: number; limit: number };

export function parseKqTreasuryQuery(parameters: URLSearchParams): KqTreasuryQuery {
  const period = parameters.get("period") ?? "current";
  const offset = parameters.get("offset") ?? "0";
  const limit = parameters.get("limit") ?? "25";
  if (!Object.hasOwn(KQ_TREASURY_PERIODS, period)
    || !/^\d{1,7}$/.test(offset) || !/^\d{1,3}$/.test(limit)
    || Number(limit) < 1 || Number(limit) > 100) throw new Error("Période ou page comptable invalide.");
  return { period: period as KqTreasuryPeriod, offset: Number(offset), limit: Number(limit) };
}

export async function getKqTreasurySnapshot(userId: string, query: KqTreasuryQuery): Promise<KqTreasurySnapshot> {
  if (!UUID.test(userId)) throw new Error("Compte trésorerie invalide.");
  if (!Object.hasOwn(KQ_TREASURY_PERIODS, query.period) || !Number.isSafeInteger(query.offset) || query.offset < 0 || query.offset > 9_999_999
    || !Number.isSafeInteger(query.limit) || query.limit < 1 || query.limit > 100) throw new Error("Période ou page comptable invalide.");
  const result = await createSupabaseServiceClient().rpc("rpc_kq_treasury_snapshot", {
    p_user_id: userId, p_period: query.period, p_offset: query.offset, p_limit: query.limit,
  });
  if (result.error) throw new Error(`[supabase:treasury] ${result.error.message}`);
  if (!isKqTreasurySnapshot(result.data) || result.data.period.key !== query.period
    || result.data.journal.offset !== query.offset || result.data.journal.limit !== query.limit) {
    throw new Error("[supabase:treasury] Incomplete accounting schema or response.");
  }
  return result.data;
}
