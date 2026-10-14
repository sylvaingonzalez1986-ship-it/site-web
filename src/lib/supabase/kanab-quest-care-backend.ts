import "server-only";

import { applyKqCareProduct, canApplyKqCareProduct, canPerformKqBasicCare, getKqCareProduct, KQ_BASIC_CARE_PRICE_CENTS, KQ_CARE_PRODUCTS, performKqBasicCare } from "@/lib/kanab-quest-care";
import type { KqGameState } from "@/lib/kanab-quest-game";
import { encodeKqSave, parseKqGameSave } from "@/lib/kanab-quest-persistence";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function assertId(value: string) {
  if (!UUID.test(value)) throw new Error("Demande de suivi invalide.");
}

export type KqCareInventoryItem = { productCode: string; quantity: number };
export type KqCareShopSnapshot = { cashCents: number; basicCarePriceCents?: number; inventory: KqCareInventoryItem[]; catalog: typeof KQ_CARE_PRODUCTS };
export type KqCareInterventionResult = { state: KqGameState; updatedAt: string; inventory: KqCareInventoryItem[]; cashCents: number; chargedCents: number; replayed: boolean };

function careError(operation: string, error: { message: string }): never {
  const messages: Record<string, string> = {
    kq_care_insufficient_cash: "Trésorerie insuffisante pour cet achat.",
    kq_care_basic_insufficient_cash: "Trésorerie insuffisante pour cet entretien.",
    kq_care_price_changed: "Le prix de l’entretien a changé. Actualise le suivi avant de confirmer.",
    kq_care_stock_unavailable: "Ce produit n’est plus disponible dans ton stock.",
    kq_stale_run: "La culture a évolué. Recharge son suivi avant d’intervenir.",
    kq_run_unavailable: "Culture active introuvable.",
    kq_care_request_mismatch: "Cette demande a déjà été utilisée pour une autre intervention.",
    kq_care_invalid_request: "Demande de suivi invalide.",
    kq_care_legacy_run: "Cette culture conserve ses anciennes règles jusqu’à sa fin.",
  };
  const known = Object.entries(messages).find(([code]) => error.message.includes(code));
  if (known) throw new Error(known[1]);
  throw new Error(`[supabase:${operation}] ${error.message}`);
}

export async function getKqCareShopSnapshot(userId: string): Promise<KqCareShopSnapshot> {
  assertId(userId);
  const result = await createSupabaseServiceClient().rpc("rpc_kq_care_shop", { p_user_id: userId });
  if (result.error) careError("rpc_kq_care_shop", result.error);
  const snapshot = result.data as Omit<KqCareShopSnapshot, "catalog">;
  return { ...snapshot, catalog: KQ_CARE_PRODUCTS };
}

export async function purchaseKqCareProduct(input: { userId: string; productCode: string; quantity: number; requestKey: string }) {
  assertId(input.userId);
  assertId(input.requestKey);
  if (!getKqCareProduct(input.productCode) || !Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 20) {
    throw new Error("Produit ou quantité invalide.");
  }
  const result = await createSupabaseServiceClient().rpc("rpc_kq_purchase_care", {
    p_user_id: input.userId, p_product_code: input.productCode, p_quantity: input.quantity, p_request_key: input.requestKey,
  });
  if (result.error) careError("rpc_kq_purchase_care", result.error);
  return result.data as { cashCents: number; inventory: KqCareInventoryItem[]; totalPriceCents: number; replayed: boolean };
}

export async function applyKqPlayerCare(input: {
  userId: string; runId: string; productCode?: string; action?: "basic"; basicPriceCents?: number; requestKey: string; expectedUpdatedAt?: string;
}): Promise<KqCareInterventionResult> {
  assertId(input.userId);
  assertId(input.runId);
  assertId(input.requestKey);
  const productCode = input.action === "basic" ? null : input.productCode;
  if (productCode === undefined || (productCode !== null && !getKqCareProduct(productCode))) throw new Error("Intervention invalide.");
  const supabase = createSupabaseServiceClient();
  // Replay lookup precedes state eligibility: a retry can arrive after the stage
  // advanced or the run completed, and must never consume a second charge.
  const replay = await supabase.rpc("rpc_kq_care_intervention_receipt", {
    p_user_id: input.userId, p_run_id: input.runId, p_request_key: input.requestKey, p_product_code: productCode,
  });
  if (replay.error) careError("rpc_kq_care_intervention_receipt", replay.error);
  if (replay.data) return replay.data as KqCareInterventionResult;
  // A former "free" button or a stale quote cannot authorize a new debit.
  // Receipt replays above keep their recorded amount, including historical 0.
  if (productCode === null && input.basicPriceCents !== KQ_BASIC_CARE_PRICE_CENTS) careError("rpc_kq_apply_care", { message: "kq_care_price_changed" });

  const run = await supabase.from("kq_runs").select("state,status,updated_at")
    .eq("id", input.runId).eq("user_id", input.userId).maybeSingle();
  if (run.error) careError("kq_runs:care", run.error);
  if (!run.data || run.data.status !== "active") throw new Error("Culture active introuvable.");
  if (input.expectedUpdatedAt && input.expectedUpdatedAt !== run.data.updated_at) throw new Error("La culture a évolué. Recharge son suivi avant d’intervenir.");
  const state = parseKqGameSave(encodeKqSave(run.data.state));
  if (!state) throw new Error("État du suivi invalide. Actualise la culture.");
  if (state.campaign && state.campaign.leaderRunId !== input.runId) throw new Error("Ouvre la campagne commune pour intervenir sur ces cultures.");
  if (state.rulesVersion !== 3) throw new Error("Cette culture conserve ses anciennes règles jusqu’à sa fin.");
  const permission = productCode === null ? canPerformKqBasicCare(state) : canApplyKqCareProduct(state, productCode);
  if (!permission.allowed) throw new Error(permission.reason);
  // Only the server computes this transition. The browser quote confirms a
  // known price; it never sets the charge. SQL rechecks price/version under lock.
  const nextState = productCode === null ? performKqBasicCare(state) : applyKqCareProduct(state, productCode);
  const result = await supabase.rpc("rpc_kq_apply_care", {
    p_user_id: input.userId, p_run_id: input.runId, p_product_code: productCode,
    p_request_key: input.requestKey, p_expected_updated_at: run.data.updated_at, p_next_state: nextState,
    ...(productCode === null ? { p_basic_price_cents: input.basicPriceCents } : {}),
  });
  if (result.error) careError("rpc_kq_apply_care", result.error);
  return result.data as KqCareInterventionResult;
}
