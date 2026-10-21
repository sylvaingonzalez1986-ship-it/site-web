import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { parseKqContractCommand, parseKqContractSnapshot, type KqContractSnapshot } from "@/lib/kanab-quest-contracts";

export class KqContractError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}
function failure(message: string): never {
  if (message.includes("contract_unknown") || message.includes("contract_action_invalid")) throw new KqContractError("Contrat inconnu ou demande invalide.", 400);
  if (message.includes("contract_active_run")) throw new KqContractError("Termine ta culture en cours avant d’accepter ce contrat.", 409);
  if (message.includes("contract_already_started")) throw new KqContractError("Cette tentative a déjà commencé. Son contrat ne peut plus être annulé.", 409);
  if (message.includes("contract_not_ready")) throw new KqContractError("Le contrat n’est pas encore réussi. Actualise sa progression.", 409);
  if (message.includes("contract_wallet_limit")) throw new KqContractError("Ta caisse a atteint sa limite. Libère de la place avant de récupérer cette prime.", 409);
  throw new KqContractError("Le comptoir des contrats est momentanément indisponible. Réessaie dans un instant.", 503);
}
function snapshot(value: unknown): KqContractSnapshot {
  const parsed = parseKqContractSnapshot(value);
  if (!parsed) failure("contract_invalid_snapshot");
  return parsed;
}
export async function getKqContract(userId: string): Promise<KqContractSnapshot> {
  const result = await createSupabaseServiceClient().rpc("rpc_kq_contract_state", { p_user_id: userId });
  if (result.error) failure(result.error.message);
  return snapshot(result.data);
}
export async function changeKqContract(userId: string, input: unknown): Promise<KqContractSnapshot> {
  const command = parseKqContractCommand(input);
  if (!command) throw new KqContractError("Demande de contrat invalide.", 400);
  const result = await createSupabaseServiceClient().rpc("rpc_kq_contract_action", {
    p_user_id: userId, p_code: command.code, p_action: command.action,
  });
  if (result.error) failure(result.error.message);
  return snapshot(result.data);
}
