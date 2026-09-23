import "server-only";
import { createSupabaseServiceClient } from "./admin";
import { fetchCoinMarketCapQuotes, fetchCoinMarketCapTop100 } from "../coinmarketcap";
import { isKqCryptoOrder, isKqCryptoSnapshot, isKqCryptoTrade, isRecord, KqCryptoRequestError, KQ_CRYPTO_UUID, parseKqCryptoAction, type KqCryptoOrder, type KqCryptoSnapshot, type KqCryptoTrade } from "../kanab-quest-crypto";

const errors: Record<string, string> = {
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
/** Database lease bounds requests across instances; a provider outage never hides holdings. */
export async function refreshKqCryptoQuotes() {
 const claim = await rpc("rpc_kq_crypto_refresh_claim");
 if (claim === null) return;
 if (!isRecord(claim) || typeof claim.leaseId !== "string" || !KQ_CRYPTO_UUID.test(claim.leaseId) || !Array.isArray(claim.heldAssetIds)
  || claim.heldAssetIds.length > 250 || claim.heldAssetIds.some(id => !Number.isSafeInteger(id) || Number(id) <= 0)) throw new Error("[supabase:crypto] invalid refresh lease");
 try {
  const top100 = await fetchCoinMarketCapTop100();
  const ids = claim.heldAssetIds.filter(id => !top100.some(asset => asset.id === id)) as number[];
  const held = ids.length ? await fetchCoinMarketCapQuotes(ids).catch(() => []) : [];
  const published = await rpc("rpc_kq_crypto_refresh_publish", { p_lease_id: claim.leaseId, p_assets: [...top100, ...held] });
  if (published !== true) console.warn("[crypto:refresh] publication lease expired");
 } catch (error) {
  const reason = error instanceof Error && /^\[(cmc|supabase:crypto)\] [a-zA-Z0-9 :()-]+$/.test(error.message) ? error.message : "provider request failed";
  console.warn("[crypto:refresh] retaining last quotes", { reason });
  // Keep the previous quotes; the database bounds retries after provider failures.
  // A database failure on publish is also fail-closed: old prices expire in SQL.
 }
}
export async function getKqCryptoSnapshot(userId: string): Promise<KqCryptoSnapshot> {
 checkUser(userId);
 await refreshKqCryptoQuotes();
 const data = await rpc("rpc_kq_crypto_command", { p_user_id: userId, p_action: "state", p_payload: {}, p_market_enabled: true });
 if (!isKqCryptoSnapshot(data)) throw new Error("[supabase:crypto] invalid snapshot");
 return data;
}
export async function handleKqCryptoAction(userId: string, value: unknown): Promise<KqCryptoOrder | { trade: KqCryptoTrade; replayed: boolean }> {
 checkUser(userId);
 const action = parseKqCryptoAction(value);
 // Confirm uses its persisted quote or receipt, never a new external price.
 if (action.action === "preview") await refreshKqCryptoQuotes();
 const { action: name, ...payload } = action;
 const data = await rpc("rpc_kq_crypto_command", { p_user_id: userId, p_action: name, p_payload: payload, p_market_enabled: true });
 if (name === "preview" && isKqCryptoOrder(data)) return data;
 if (name === "confirm" && isRecord(data) && isKqCryptoTrade(data.trade) && typeof data.replayed === "boolean") return { trade: data.trade, replayed: data.replayed };
 throw new Error("[supabase:crypto] invalid receipt");
}
