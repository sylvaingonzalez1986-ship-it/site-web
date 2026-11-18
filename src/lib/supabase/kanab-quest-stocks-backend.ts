import "server-only";
import { isKqQueuedReceipt, type KqQueuedReceipt } from "../kanab-quest-market-queue";
import { createSupabaseServiceClient } from "./admin";
import { fetchKqStockQuotes } from "../stock-market-quotes";
import { getKqStockInstrument, isKqStockOrder, isKqStockSnapshot, isKqStockTrade, isRecord, KqStockRequestError, KQ_STOCK_MAX_BATCH, KQ_STOCK_UUID, parseKqStockAction, parseKqStockAssetIds, type KqStockOrder, type KqStockSnapshot, type KqStockTrade } from "../kanab-quest-stocks";
const errors: Record<string, string> = {
 market_policy_required: "Actualise le comptoir : les ordres sont désormais exécutés au prochain cours publié.", market_queue_limit: "Vingt ordres sont déjà en attente.", market_expired: "Cette préparation a expiré. Prépare un nouvel ordre.", market_order_missing: "Ordre introuvable.", market_invalid: "Ordre invalide.",
 stocks_invalid: "Ordre boursier invalide.", stocks_retired: "Ce titre a quitté les indices suivis : seules les ventes restent possibles.", stocks_stale: "Ce cours ou son taux de change est trop ancien. Actualise le comptoir avant de préparer un ordre.",
 stocks_cash: "Trésorerie insuffisante.", stocks_quantity: "La quantité dépasse ta position disponible.", stocks_dust: "Ce montant est trop petit pour être échangé.",
 stocks_expired: "Cette offre a expiré. Prépare un nouvel ordre.", stocks_order_missing: "Cette offre est introuvable.",
 stocks_order_limit: "Un ordre est limité à 1 000 000 € de jeu.", stocks_position_limit: "La limite de cette position est atteinte.", stocks_wallet_limit: "Le plafond de trésorerie serait dépassé.",
};
function checkUser(userId: string) { if (!KQ_STOCK_UUID.test(userId)) throw new KqStockRequestError("Compte boursier invalide."); }
async function rpc(name: string, params?: Record<string, unknown>): Promise<unknown> {
 const { data, error } = await createSupabaseServiceClient().rpc(name, params);
 if (error) {
  const code = Object.keys(errors).find(key => error.message === key);
  if (code) throw new KqStockRequestError(errors[code]);
  console.warn("[stocks:rpc] request failed", { rpc: name, code: typeof error.code === "string" && /^[A-Z0-9]{5,8}$/.test(error.code) ? error.code : "unknown" });
  throw new Error("[supabase:stocks] unavailable");
 }
 return data;
}
/** Refresh only the visible instruments; database leases share quotes between every player. */
export async function refreshKqStockQuotes(ids: string[]) {
 const requested = parseKqStockAssetIds(ids.join(","));
 if (!requested.length) return;
 const claim = await rpc("rpc_kq_stock_refresh_claim", { p_asset_ids: requested });
 if (claim === null) return;
 if (!isRecord(claim) || typeof claim.leaseId !== "string" || !KQ_STOCK_UUID.test(claim.leaseId) || !Array.isArray(claim.assetIds)
  || claim.assetIds.length < 1 || claim.assetIds.length > KQ_STOCK_MAX_BATCH || new Set(claim.assetIds).size !== claim.assetIds.length
  || claim.assetIds.some(id => typeof id !== "string" || !requested.includes(id) || !getKqStockInstrument(id))) throw new Error("[supabase:stocks] invalid refresh lease");
 try {
  const quotes = await fetchKqStockQuotes(claim.assetIds as string[]);
  const published = await rpc("rpc_kq_stock_refresh_publish", { p_lease_id: claim.leaseId, p_assets: quotes });
  if (published === true) await rpc("rpc_kq_settle_market_queue").catch(() => console.warn("[stocks:queue] settlement deferred"));
  if (published !== true && quotes.length) console.warn("[stocks:refresh] publication rejected");
  if (quotes.length < claim.assetIds.length) console.warn("[stocks:refresh] some quotes unavailable", { requested: claim.assetIds.length, received: quotes.length });
 } catch (error) {
  const reason = error instanceof Error && /^\[(stocks|supabase:stocks)\] [a-zA-Z0-9 :()-]+$/.test(error.message) ? error.message : "provider request failed";
  console.warn("[stocks:refresh] retaining last quotes", { reason });
  // Release this lease without inventing prices; its per-symbol retry cooldown remains in place.
  await rpc("rpc_kq_stock_refresh_publish", { p_lease_id: claim.leaseId, p_assets: [] }).catch(() => undefined);
 }
}
export async function getKqStockSnapshot(userId: string, ids: string[] = ["^FCHI", "^GSPC"]): Promise<KqStockSnapshot> {
 checkUser(userId);
 const requested = parseKqStockAssetIds(ids.join(","));
 await refreshKqStockQuotes(requested);
 const pending = await rpc("rpc_kq_pending_stock_assets").catch(() => []);
 const extras = Array.isArray(pending) ? pending.filter((id): id is string => typeof id === "string" && !!getKqStockInstrument(id) && !requested.includes(id)).slice(0, 6) : [];
 if (extras.length) await refreshKqStockQuotes(extras);
 const data = await rpc("rpc_kq_stock_command", { p_user_id: userId, p_action: "state", p_payload: {}, p_asset_ids: requested });
 if (!isKqStockSnapshot(data)) throw new Error("[supabase:stocks] invalid snapshot");
 return data;
}
export async function handleKqStockAction(userId: string, value: unknown): Promise<KqStockOrder | KqQueuedReceipt | { trade: KqStockTrade; replayed: boolean }> {
 checkUser(userId);
 const action = parseKqStockAction(value);
 if (action.action === "preview") await refreshKqStockQuotes([action.assetId]);
 const { action: name, ...payload } = action;
 const data = name === "confirm" ? await rpc("rpc_kq_market_order_submit", { p_market: "stocks", p_user_id: userId, p_payload: payload })
  : await rpc("rpc_kq_stock_command", { p_user_id: userId, p_action: name, p_payload: payload, p_asset_ids: [] });
 if (name === "preview" && isKqStockOrder(data)) return data;
 if (name === "confirm" && isKqQueuedReceipt(data)) return data;
 if (name === "confirm" && isRecord(data) && isKqStockTrade(data.trade) && typeof data.replayed === "boolean") return { trade: data.trade, replayed: data.replayed };
 throw new Error("[supabase:stocks] invalid receipt");
}
