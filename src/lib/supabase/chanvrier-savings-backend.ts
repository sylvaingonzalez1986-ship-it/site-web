import "server-only";
import type { ChanvrierSavings, ChanvrierSavingsCommand } from "@/lib/chanvrier-savings";
import { createSupabaseServiceClient } from "./admin";
export class ChanvrierSavingsError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function getChanvrierSavings(userId: string, command?: ChanvrierSavingsCommand): Promise<ChanvrierSavings> {
  const result = await createSupabaseServiceClient().rpc("rpc_arena_chanvrier_savings", {
    p_user_id: userId, p_action: command?.action ?? "state", p_amount_cents: command?.amountCents ?? 0, p_request_key: command?.requestKey ?? null,
  });
  if (result.error) {
    const errors: Record<string, [string, number]> = {
      savings_treasurer_required: ["Le livret est réservé à la spécialité Trésorier.", 403],
      savings_cash: ["Tu n’as pas assez d’argent disponible pour ce dépôt.", 400],
      savings_balance: ["Le solde du livret est insuffisant pour ce retrait.", 400],
      savings_limit: ["Le plafond du livret est de 20 000 000 € de monnaie de jeu.", 400],
      savings_wallet_limit: ["Ta trésorerie est pleine. Retire un montant plus petit.", 400],
      savings_request_mismatch: ["Cette opération a déjà été utilisée. Actualise le livret.", 409],
      savings_invalid: ["Montant ou opération invalide.", 400],
    };
    for (const [code, [message, status]] of Object.entries(errors)) if (result.error.message.includes(code)) throw new ChanvrierSavingsError(message, status);
    throw new Error(`[supabase:savings] ${result.error.message}`);
  }
  return result.data as ChanvrierSavings;
}
