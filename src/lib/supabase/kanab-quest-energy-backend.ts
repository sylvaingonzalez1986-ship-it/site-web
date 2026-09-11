import "server-only";
import { KQ_ENERGY_MODES, quoteKqEnergy, type KqEnergyMode, type KqEnergySummary, type KqEnergySnapshot } from "@/lib/kanab-quest-energy";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { getKqEquipmentShopSnapshot } from "./kanab-quest-equipment-backend";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getKqEnergySummary(userId: string): Promise<KqEnergySummary> {
  if (!UUID.test(userId)) throw new Error("Compte énergie invalide.");
  const result = await createSupabaseServiceClient().rpc("rpc_kq_energy_snapshot", { p_user_id: userId });
  if (result.error) throw new Error(`[supabase:energy] ${result.error.message}`);
  return result.data as KqEnergySummary;
}
export async function getKqEnergySnapshot(userId: string): Promise<KqEnergySnapshot> {
  const [summary, shop] = await Promise.all([getKqEnergySummary(userId), getKqEquipmentShopSnapshot(userId)]);
  return { ...summary, cashCents: shop.cashCents, quotes: Object.fromEntries(
    (Object.keys(KQ_ENERGY_MODES) as KqEnergyMode[]).map((mode) => [mode, quoteKqEnergy(shop.equippedCodes, shop.levels, mode)]),
  ) as KqEnergySnapshot["quotes"] };
}
export async function payKqEnergy(input: { userId: string; requestKey: string; expectedCents: number }) {
  if (!UUID.test(input.userId) || !UUID.test(input.requestKey) || !Number.isSafeInteger(input.expectedCents) || input.expectedCents <= 0 || input.expectedCents > 2147483647) throw new Error("Règlement invalide.");
  const result = await createSupabaseServiceClient().rpc("rpc_kq_pay_energy", {
    p_user_id: input.userId, p_request_key: input.requestKey, p_expected_cents: input.expectedCents,
  });
  if (result.error) {
    if (result.error.message.includes("energy_balance_changed")) throw new Error("Le montant dû a changé. Actualise avant de payer.");
    if (result.error.message.includes("insufficient_equipment_cash")) throw new Error("Trésorerie insuffisante. Les prochaines ventes régleront progressivement la facture.");
    if (result.error.message.includes("energy_request_mismatch")) throw new Error("Demande déjà utilisée. Actualise avant de payer.");
    throw new Error(`[supabase:energy-payment] ${result.error.message}`);
  }
  return result.data as { paidCents: number; cashAfterCents: number; replayed: boolean };
}
