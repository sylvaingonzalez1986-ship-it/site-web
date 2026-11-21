import "server-only";

import { isKqWarehouseState } from "@/lib/kanab-quest-warehouse";
import {
  getKqWarehouseSecurityCoverage, KQ_CAMERA_SPEC, KQ_WAREHOUSE_CAMERA_BEARINGS,
  type KqWarehouseSecurityAction, type KqWarehouseSecurityDecision, type KqWarehouseSecuritySnapshot,
} from "@/lib/kanab-quest-warehouse-security";
import { createSupabaseServiceClient } from "./admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const natural = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 2_147_483_647;
const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const simple = ["buy-camera", "buy-alarm", "buy-install-alarm", "install-alarm", "subscribe", "pause", "cancel"] as const;
type Command = { requestKey: string; revision: number; layoutRevision: number; expectedChargeCents: number; command: KqWarehouseSecurityAction };

export class KqWarehouseSecurityError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

function parsePlacement(value: unknown) {
  if (!record(value) || !natural(value.x) || value.x >= 40 || !natural(value.y) || value.y >= 25
    || !natural(value.bearing) || value.bearing >= KQ_WAREHOUSE_CAMERA_BEARINGS.length) return null;
  return { x: value.x, y: value.y, bearing: value.bearing };
}

export function parseKqWarehouseSecurityCommand(value: unknown): Command | null {
  if (!record(value) || !isUuid(value.requestKey) || !natural(value.revision) || !natural(value.layoutRevision)
    || !natural(value.expectedChargeCents) || !record(value.command)) return null;
  const action = value.command.action;
  const base = { requestKey: value.requestKey, revision: value.revision, layoutRevision: value.layoutRevision,
    expectedChargeCents: value.expectedChargeCents };
  const name = simple.find(item => item === action);
  if (name) return { ...base, command: { action: name } };
  const placement = parsePlacement(value.command.placement);
  if (action === "buy-place-camera") return placement ? { ...base, command: { action, placement } } : null;
  if (!isUuid(value.command.cameraId)) return null;
  if (action === "stow-camera") return { ...base, command: { action, cameraId: value.command.cameraId } };
  return action === "place-camera" && placement ? { ...base, command: { action, cameraId: value.command.cameraId, placement } } : null;
}

const messages: Record<string, string> = {
  warehouse_security_cash: "Trésorerie insuffisante pour cette opération.",
  warehouse_security_layout: "Aménage l’entrepôt avant d’y installer la sécurité.",
  warehouse_security_changed: "Le plan ou les équipements ont changé. Vérifie les nouvelles informations avant de confirmer.",
  warehouse_security_price_changed: "Le montant a changé. Vérifie le nouveau prix avant de confirmer.",
  warehouse_security_camera_limit: "Le nombre maximal de caméras est atteint.",
  warehouse_security_camera_position: "Choisis une case libre, en dehors des cloisons et de la centrale d’irrigation.",
  warehouse_security_camera_unknown: "Cette caméra est introuvable.",
  warehouse_security_alarm_owned: "Tu possèdes déjà une alarme.",
  warehouse_security_alarm_required: "Achète et installe l’alarme avant d’activer la télésurveillance.",
  warehouse_security_monitoring_inactive: "L’abonnement a déjà changé d’état.",
  warehouse_security_request_reused: "Cette demande a déjà servi à une autre opération.",
  warehouse_security_request: "Cette demande de sécurité est invalide.",
};

function snapshot(value: unknown): KqWarehouseSecuritySnapshot {
  const data = value as KqWarehouseSecuritySnapshot | null;
  if (!data || data.layout !== null && !isKqWarehouseState(data.layout) || !natural(data.layoutRevision) || !natural(data.revision)
    || !natural(data.cashCents) || !natural(data.prices?.cameraCents) || !natural(data.prices?.alarmCents) || !natural(data.prices?.monitoringCents)
    || !["none", "owned", "installed"].includes(data.alarm) || !["none", "active", "suspended", "cancelled"].includes(data.monitoring?.status)
    || typeof data.monitoring.enabled !== "boolean"
    || data.monitoring.paidUntil !== null && (typeof data.monitoring.paidUntil !== "string" || !Number.isFinite(Date.parse(data.monitoring.paidUntil)))
    || !Array.isArray(data.cameras) || data.cameras.length > KQ_CAMERA_SPEC.maximum
    || data.cameras.some(camera => !camera || !isUuid(camera.id) || camera.placement !== null && !parsePlacement(camera.placement))
    || data.receipt !== undefined && (!natural(data.receipt?.chargedCents) || typeof data.receipt?.replayed !== "boolean")) {
    throw new Error("[warehouse-security] invalid_snapshot");
  }
  return data;
}

async function readSecurity(userId: string) {
  return createSupabaseServiceClient().rpc("rpc_kq_warehouse_security_snapshot", { p_user_id: userId });
}

export async function getKqWarehouseSecurity(userId: string) {
  const result = await readSecurity(userId);
  if (result.error) throw new Error(`[warehouse-security] ${result.error.message}`);
  return snapshot(result.data);
}

export async function changeKqWarehouseSecurity(userId: string, input: Command) {
  const result = await createSupabaseServiceClient().rpc("rpc_kq_warehouse_security_command", {
    p_user_id: userId, p_request_key: input.requestKey, p_revision: input.revision, p_layout_revision: input.layoutRevision,
    p_expected_charge: input.expectedChargeCents, p_command: input.command,
  });
  if (result.error) {
    const code = Object.keys(messages).find(key => result.error.message === key);
    if (code) throw new KqWarehouseSecurityError(messages[code], code === "warehouse_security_request" ? 400 : 409);
    throw new Error(`[warehouse-security] ${result.error.message}`);
  }
  return snapshot(result.data);
}

export async function getKqWarehouseSecurityForIncident(userId: string, zoneIds: string[]): Promise<KqWarehouseSecurityDecision | undefined> {
  const result = await readSecurity(userId);
  // A server rolling out ahead of the database retains the old incident rules.
  if (result.error?.code === "PGRST202" || result.error?.code === "42883") return undefined;
  if (result.error) throw new Error(`[warehouse-security] ${result.error.message}`);
  const current = snapshot(result.data);
  const installed = current.cameras.filter(camera => camera.placement);
  if (!current.layout || !installed.length && current.alarm !== "installed") return undefined;
  const { zones } = getKqWarehouseSecurityCoverage(current.layout, installed);
  return { alarm: current.alarm === "installed", monitored: current.monitoring.enabled,
    filmed: Object.fromEntries(zones.filter(zone => zone.covered > 0 && zoneIds.includes(zone.id)).map(zone => [zone.id, Math.round(zone.covered / zone.area * 100)])) };
}
