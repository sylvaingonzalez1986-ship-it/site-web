import "server-only";
import { isKqQueuedReceipt, type KqQueuedReceipt } from "../kanab-quest-market-queue";
import { createSupabaseServiceClient } from "./admin";
import { CoinMarketCapRequestError, fetchCoinMarketCapQuotes, fetchCoinMarketCapTop100 } from "../coinmarketcap";
import { isKqCryptoOrder, isKqCryptoRefreshStatus, isKqCryptoSnapshot, isKqCryptoTrade, isRecord, KqCryptoRequestError, KQ_CRYPTO_UUID, parseKqCryptoAction, type KqCryptoOrder, type KqCryptoSnapshot, type KqCryptoTrade } from "../kanab-quest-crypto";

const errors: Record<string, string> = {
 market_policy_required: "Actualise le comptoir : les ordres sont désormais exécutés au prochain cours publié.", market_queue_limit: "Vingt ordres sont déjà en attente.", market_expired: "Cette préparation a expiré. Prépare un nouvel ordre.", market_order_missing: "Ordre introuvable.", market_invalid: "Ordre invalide.",
 crypto_invalid: "Ordre crypto invalide.", crypto_closed: "Le comptoir crypto est fermé pour le moment.",
 crypto_stale: "Le cours est trop ancien. Actualise le marché avant de préparer un ordre.", crypto_not_top100: "Cette crypto a quitté le top 100 : seules les ventes restent possibles.",
 crypto_cash: "Trésorerie insuffisante.", crypto_quantity: "La quantité dépasse ta position disponible.", crypto_dust: "Ce montant est trop petit pour être échangé.",
 crypto_expired: "Cette offre a expiré. Prépare un nouvel ordre.", crypto_order_missing: "Cette offre est introuvable.",
 crypto_order_limit: "Un ordre est limité à 1 000 000 € de jeu.", crypto_position_limit: "La limite de cette position est atteinte.", crypto_wallet_limit: "Le plafond de trésorerie serait dépassé.",
};
function checkUser(userId: string) { if (!KQ_CRYPTO_UUID.test(userId)) throw new KqCryptoRequestError("Compte crypto invalide."); }
async function rpc(name: string, params?: Record<string, unknown>): Promise<unknown> {
 const { data, error } = await createSupabaseServiceClient().rpc(name, params);
 if (error) {
  const code = Object.keys(errors).find(key => error.message === key);
  if (code) throw new KqCryptoRequestError(errors[code]);
  // Keep credentials, player IDs and raw database messages out of diagnostics.
  console.warn("[crypto:rpc] request failed", { rpc: name, code: typeof error.code === "string" && /^[A-Z0-9]{5,8}$/.test(error.code) ? error.code : "unknown" });
  throw new Error("[supabase:crypto] unavailable");
 }
 return data;
}
function refreshReason(error: unknown) {
 return error instanceof Error && /^\[(cmc|supabase:crypto)\] [a-zA-Z0-9 :()-]+$/.test(error.message) ? error.message : "provider request failed";
}
export type KqCryptoRefreshResult = "updated" | "skipped" | "failed";
async function refreshQuotes(): Promise<KqCryptoRefreshResult> {
 const claim = await rpc("rpc_kq_crypto_refresh_claim");
 if (claim === null) return "skipped";
 if (!isRecord(claim) || typeof claim.leaseId !== "string" || !KQ_CRYPTO_UUID.test(claim.leaseId) || !Array.isArray(claim.heldAssetIds)
  || claim.heldAssetIds.length > 250 || claim.heldAssetIds.some(id => !Number.isSafeInteger(id) || Number(id) <= 0)) throw new Error("[supabase:crypto] invalid refresh lease");
 let phase: "provider" | "publish" = "provider";
 try {
  const top100 = await fetchCoinMarketCapTop100();
  const ids = claim.heldAssetIds.filter(id => !top100.some(asset => asset.id === id)) as number[];
  let retryAfterSeconds: number | null = null;
  const held = ids.length ? await fetchCoinMarketCapQuotes(ids).catch(error => {
   if (error instanceof CoinMarketCapRequestError) retryAfterSeconds = error.retryAfterSeconds;
   console.warn("[crypto:refresh] retaining held quotes", { reason: refreshReason(error) });
   return [];
  }) : [];
  phase = "publish";
  const published = await rpc("rpc_kq_crypto_refresh_publish", { p_lease_id: claim.leaseId, p_assets: [...top100, ...held],
   ...(retryAfterSeconds === null ? {} : { p_retry_after_seconds: retryAfterSeconds }) });
  if (published !== true) console.warn("[crypto:refresh] publication lease expired");
  if (published === true) await rpc("rpc_kq_settle_market_queue").catch(() => console.warn("[crypto:queue] settlement deferred"));
  return published === true ? "updated" : "failed";
 } catch (error) {
  console.warn("[crypto:refresh] retaining last quotes", { reason: refreshReason(error) });
  // Every instance observes the same provider pause; a stale lease cannot defer a newer one.
  const providerError = error instanceof CoinMarketCapRequestError ? error : null;
  try {
   await rpc("rpc_kq_crypto_refresh_fail", { p_lease_id: claim.leaseId,
    p_failure_code: providerError?.kind ?? (phase === "publish" ? "publish_failed" : "provider_unavailable"),
    p_retry_after_seconds: providerError?.retryAfterSeconds ?? null });
  } catch { /* The lease expiry still permits recovery if failure reporting is unavailable. */ }
  return "failed";
 }
}
/** Join local refreshes; the database lease bounds calls across all server instances. */
let refreshInFlight: Promise<KqCryptoRefreshResult> | null = null;
export async function refreshKqCryptoQuotes() {
 if (!refreshInFlight) refreshInFlight = refreshQuotes().finally(() => { refreshInFlight = null; });
 return refreshInFlight;
}
export async function getKqCryptoSnapshot(userId: string): Promise<KqCryptoSnapshot> {
 checkUser(userId);
 await refreshKqCryptoQuotes();
 const [data, refresh] = await Promise.all([
  rpc("rpc_kq_crypto_command", { p_user_id: userId, p_action: "state", p_payload: {}, p_market_enabled: true }),
  rpc("rpc_kq_crypto_refresh_status").catch(() => null),
 ]);
 if (!isKqCryptoSnapshot(data)) throw new Error("[supabase:crypto] invalid snapshot");
 if (isKqCryptoRefreshStatus(refresh)) return { ...data, refresh: {
  refreshing: refresh.refreshing, nextAttemptAt: refresh.nextAttemptAt, lastFailureCode: refresh.lastFailureCode,
 } };
 return data;
}
export async function handleKqCryptoAction(userId: string, value: unknown): Promise<KqCryptoOrder | KqQueuedReceipt | { trade: KqCryptoTrade; replayed: boolean }> {
 checkUser(userId);
 const action = parseKqCryptoAction(value);
 // Confirmation queues an immutable instruction; publication captures its future execution price.
 if (action.action === "preview") await refreshKqCryptoQuotes();
 const { action: name, ...payload } = action;
 const data = name === "confirm" ? await rpc("rpc_kq_market_order_submit", { p_market: "crypto", p_user_id: userId, p_payload: payload })
  : await rpc("rpc_kq_crypto_command", { p_user_id: userId, p_action: name, p_payload: payload, p_market_enabled: true });
 if (name === "preview" && isKqCryptoOrder(data)) return data;
 if (name === "confirm" && isKqQueuedReceipt(data)) return data;
 if (name === "confirm" && isRecord(data) && isKqCryptoTrade(data.trade) && typeof data.replayed === "boolean") return { trade: data.trade, replayed: data.replayed };
 throw new Error("[supabase:crypto] invalid receipt");
}
