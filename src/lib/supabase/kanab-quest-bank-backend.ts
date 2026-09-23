import "server-only";
import { createSupabaseServiceClient } from "./admin";
import { isKqBankSnapshot, isKqBankUuid, parseKqBankCommand, type KqBankCommand, type KqBankSnapshot } from "../kanab-quest-bank";

export class KqBankError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function getKqBank(userId: string, command?: KqBankCommand): Promise<KqBankSnapshot> {
  if (!isKqBankUuid(userId) || (command && !parseKqBankCommand(command))) throw new KqBankError("Opération bancaire invalide.", 400);
  const result = await createSupabaseServiceClient().rpc("rpc_kq_bank", { p_user_id: userId, p_command: command ?? null });
  if (result.error) {
    const errors: Record<string, [string, number]> = {
      bank_invalid: ["Opération bancaire invalide.", 400],
      bank_profile: ["Commence ton aventure dans le Placard avant d’ouvrir un dossier.", 403],
      bank_reputation: ["Il faut au moins 200 points de réputation pour emprunter.", 403],
      bank_experience: ["Ta première culture doit être terminée depuis au moins 24 heures.", 403],
      bank_active: ["Un prêt est déjà en cours. Rembourse-le avant d’en ouvrir un autre.", 409],
      bank_quote_changed: ["Les conditions de l’offre ont changé. Actualise le dossier avant de signer.", 409],
      bank_cash: ["Ta trésorerie disponible ne suffit pas à solder ce prêt.", 400],
      bank_wallet_limit: ["Le versement dépasserait le plafond de ta trésorerie.", 400],
      bank_repayment_changed: ["Le solde du prêt a changé. Actualise le dossier avant de confirmer.", 409],
      bank_request_mismatch: ["Cette référence a déjà servi à une autre opération.", 409],
    };
    for (const [code, [message, status]] of Object.entries(errors)) if (result.error.message.includes(code)) throw new KqBankError(message, status);
    throw new Error("[supabase:bank] unavailable");
  }
  if (!isKqBankSnapshot(result.data)) throw new Error("[supabase:bank] invalid response");
  return result.data;
}
