import "server-only";

import type { KqWarehousePreparationCommand, KqWarehousePreparations } from "@/lib/kanab-quest-warehouse-preparations";
import { getKqPlayerWorkErrorMessage } from "@/lib/kanab-quest-player-work-errors";
import { createSupabaseServiceClient } from "./admin";
import { settleKqStaffIfAvailable } from "./kanab-quest-staff-backend";

const feedback: Record<string, string> = {
  kq_preparation_price_changed: "Le tarif a changé. Actualise les prix de la boutique avant d’acheter.",
  kq_preparation_injector_required: "Installe un injecteur sur cette centrale pour ajouter le complément au programme.",
  kq_preparation_injector_quote: "La réserve d’injecteurs a changé. Relis le registre avant de confirmer.",
  kq_preparation_stock: "Le stock disponible ne suffit plus. Relis les quantités avant de confirmer.",
  kq_preparation_pack_required: "Les intrants s’achètent par conditionnement. Rouvre le catalogue pour consulter leur prix.",
  kq_preparation_manual_allocation: "Le stock est partagé automatiquement au semis. Rouvre la préparation de la culture.",
  kq_preparation_cash: "Trésorerie insuffisante pour cet achat.",
  kq_preparation_owned: "Cet outil est déjà dans ta réserve.",
  kq_preparation_tool: "Achète l’outil de nettoyage nécessaire dans les fournitures.",
  kq_preparation_clean_running: "Une opération de nettoyage est déjà en cours.",
  kq_preparation_clean_order: "Termine l’aspiration avant de passer la serpillière.",
  kq_preparation_actor: "Le salarié choisi ne peut pas effectuer ce nettoyage sur son créneau actuel.",
  kq_preparation_operator_busy: "La personne choisie travaille déjà sur un autre poste.",
  kq_preparation_coverage: "La quantité dépasse la surface encore disponible pour cet apport.",
  kq_preparation_zone: "La zone de culture n’est plus disponible pour cette préparation.",
  kq_preparation_zone_busy: "Les réservations d’une culture en cours sont déjà fixées.",
  kq_preparation_run: "Culture active introuvable.",
  kq_preparation_reserved: "Le stock présent au semis a été utilisé ou ne suffit pas à traiter cette zone.",
  kq_preparation_nutrition: "Chaque dose de complément nécessite une dose de nutrition de base.",
  kq_preparation_request_mismatch: "Cette demande a déjà été utilisée pour une autre opération.",
  kq_preparation_quote_changed: "Les préparations ont changé. Actualise le récapitulatif avant de confirmer.",
  kq_preparation_invalid: "Quantités ou préparation invalides.",
};

export function getKqWarehousePreparationError(message: string) {
  return Object.entries(feedback).find(([code]) => message.split(/[^a-z_]+/).includes(code))?.[1]
    ?? getKqPlayerWorkErrorMessage(message);
}

async function readPreparations(userId: string, request?: KqWarehousePreparationCommand) {
  const db = createSupabaseServiceClient();
  const result = request
    ? await db.rpc("rpc_kq_warehouse_preparation_command", { p_user_id: userId, p_request_key: request.requestKey, p_command: request })
    : await db.rpc("rpc_kq_warehouse_preparations", { p_user_id: userId });
  if (result.error) {
    throw new Error(getKqWarehousePreparationError(result.error.message) ?? "[supabase:kq-warehouse-preparations] Service indisponible.");
  }
  return result.data as KqWarehousePreparations;
}

export async function getKqWarehousePreparations(userId: string) {
  return readPreparations(userId);
}

export async function commitKqWarehousePreparation(userId: string, request: KqWarehousePreparationCommand) {
  if (request.action === "clean") await settleKqStaffIfAvailable(userId);
  return readPreparations(userId, request);
}
