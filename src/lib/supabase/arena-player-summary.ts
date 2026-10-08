import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import type { ArenaPlayerSummary } from "@/lib/arena-player-summary";

const PAGE_SIZE = 500;
const unavailable = () => new Error("Résumé de l’Arène indisponible.");

async function readIds(selectPage: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown; count: number | null }>, column: "id" | "flower_id") {
  const ids = new Set<string>();
  let totalRows: number | null = null;
  for (let offset = 0; ; ) {
    const result = await selectPage(offset, offset + PAGE_SIZE - 1);
    if (result.error || !Array.isArray(result.data) || !Number.isSafeInteger(result.count) || result.count! < 0) throw unavailable();
    totalRows ??= result.count!;
    for (const row of result.data) {
      if (!row || typeof row !== "object" || typeof row[column] !== "string") throw unavailable();
      ids.add(row[column]);
    }
    offset += result.data.length;
    if (offset >= totalRows) return ids;
    // Bound the scan by its first exact row count, even when new rows appear.
    // A shortened page cannot silently turn an incomplete read into zero lots.
    if (result.data.length === 0) throw unavailable();
  }
}

async function countReadyHarvests(db: ReturnType<typeof createSupabaseServiceClient>, userId: string) {
  // Same rawFlowerIds rule as rpc_kq_commerce_state: burned flowers remain
  // usable before their first market lot is persisted, unless that lot has
  // already been prepared or sold. Calling the commerce RPC would settle bills.
  const [burnedFlowers, preparedOrSoldLots, stockedFlowers] = await Promise.all([
    readIds((from, to) => db.from("kq_flowers").select("id", { count: "exact" }).eq("owner_id", userId).eq("status", "burned").order("id").range(from, to), "id"),
    readIds((from, to) => db.from("kq_market_lots").select("flower_id", { count: "exact" }).eq("owner_id", userId).neq("status", "ready").order("flower_id").range(from, to), "flower_id"),
    readIds((from, to) => db.from("kq_commerce_stock").select("flower_id", { count: "exact" }).eq("user_id", userId).gt("remaining_units", 0).order("id").range(from, to), "flower_id"),
  ]);
  // A transformation can yield both a processed product and raw leftovers.
  // Count their harvest once, including if preparation overlaps these reads.
  for (const flowerId of burnedFlowers) if (!preparedOrSoldLots.has(flowerId)) stockedFlowers.add(flowerId);
  return stockedFlowers.size;
}

/** Read-only home summary: no profile creation, bonus synchronization or wallet RPC. */
export async function getArenaPlayerSummary(userId: string): Promise<ArenaPlayerSummary> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) throw new Error("Compte invalide.");
  const db = createSupabaseServiceClient();
  const [results, readyLotCount] = await Promise.all([Promise.all([
    db.from("kq_runs").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "active"),
    db.from("kq_flowers").select("id", { count: "exact", head: true }).eq("owner_id", userId).eq("status", "available"),
    db.from("kq_support_booster_entitlements").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "available"),
    db.from("lottery_tickets").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "available"),
  ]), countReadyHarvests(db, userId)]);
  if (results.some(result => result.error || !Number.isSafeInteger(result.count) || result.count! < 0)) throw unavailable();
  return { activeRun: results[0].count! > 0, readyLotCount, availableFlowerCount: results[1].count!, supportPackCount: results[2].count!, buddiePackCount: results[3].count! };
}
