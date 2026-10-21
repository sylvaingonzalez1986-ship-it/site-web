import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { parseKqContractBoard, parseKqContractBoardResult, parseKqRenewableCommand } from "@/lib/kanab-quest-renewable-contracts";
import { KqContractError } from "./kanab-quest-contracts-backend";

function failure(error: { code?: string; message: string }, rpc?: "rpc_kq_contract_board" | "rpc_kq_contract_board_action"): never {
  // Compatibility with the shared database before the additive migration.
  // Other database/network errors must remain visible and must not look like a locked feature.
  if (rpc && (error.code === "PGRST202" || error.code === "42883" && new RegExp(`function (?:public\\.)?${rpc}\\(`).test(error.message))) {
    throw new KqContractError("Ces contrats ne sont pas encore disponibles.", 404);
  }
  const conflicts: Record<string, string> = {
    contract_locked: "Récupère d’abord la prime du contrat Main légère.",
    contract_active_run: "Termine ta culture en cours avant de choisir un nouveau contrat.",
    contract_pending: "Un contrat est déjà engagé. Actualise pour le retrouver.",
    contract_already_started: "La culture a commencé : son contrat ne peut plus être annulé.",
    contract_not_ready: "Ce contrat n’est pas encore réussi. Actualise sa progression.",
    contract_wallet_limit: "Ta caisse a atteint sa limite. Libère de la place avant de récupérer cette prime.",
    contract_attempt_conflict: "Cette demande correspond à un autre contrat. Actualise avant de choisir.",
  };
  for (const [code, message] of Object.entries(conflicts)) if (error.message.includes(code)) throw new KqContractError(message, 409);
  if (["contract_unknown", "contract_action_invalid", "contract_attempt_invalid", "contract_attempt_unknown"].some(code => error.message.includes(code))) {
    throw new KqContractError("Demande de contrat invalide. Actualise le comptoir.", 400);
  }
  throw new KqContractError("Le comptoir des contrats est momentanément indisponible. Réessaie dans un instant.", 503);
}

export async function getKqContractBoard(userId: string) {
  const { data, error } = await createSupabaseServiceClient().rpc("rpc_kq_contract_board", { p_user_id: userId });
  if (error) failure(error, "rpc_kq_contract_board");
  const board = parseKqContractBoard(data);
  if (!board) failure({ message: "contract_invalid_snapshot" });
  return board;
}

export async function changeKqContractBoard(userId: string, input: unknown) {
  const command = parseKqRenewableCommand(input);
  if (!command) throw new KqContractError("Demande de contrat invalide.", 400);
  const { data, error } = await createSupabaseServiceClient().rpc("rpc_kq_contract_board_action", {
    p_user_id: userId, p_action: command.action, p_code: command.action === "accept" ? command.code : null, p_attempt_id: command.attemptId,
  });
  if (error) failure(error, "rpc_kq_contract_board_action");
  const result = parseKqContractBoardResult(data);
  if (!result || (command.action === "claim" && result.receipt?.id !== command.attemptId)
    || (command.action !== "claim" && result.receipt !== null)) failure({ message: "contract_invalid_result" });
  return result;
}
