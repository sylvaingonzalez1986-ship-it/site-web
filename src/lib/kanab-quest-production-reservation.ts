/** Occupancy published by the warehouse, independent of its paid floor plan. */
export type KqProductionReservation = { zoneId: string; enabled: boolean; equipmentEditable?: boolean };

export function isKqProductionReservation(value: unknown): value is KqProductionReservation | null {
  if (value === null) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const reservation = value as Record<string, unknown>;
  return typeof reservation.zoneId === "string" && !!reservation.zoneId.trim() && reservation.zoneId.length <= 80
    && typeof reservation.enabled === "boolean"
    && (reservation.equipmentEditable === undefined || typeof reservation.equipmentEditable === "boolean");
}

/** Only these paid equipment choices may change while a zone stays reserved. */
export function withoutKqProductionEquipment<T extends { lightingCode: string; airCode: string; optionCodes?: string[] }>(zone: T) {
  const { lightingCode: _lighting, airCode: _air, optionCodes: _options, ...identity } = zone;
  void _lighting; void _air; void _options;
  return identity;
}
