import { KQ_GAME_DAY_MS } from "./kanab-quest-business";
import type { KqStaffTrait } from "./kanab-quest-staff-types";
import { KQ_PLAYER_DAILY_HOURS } from "./kanab-quest-player-work";

/** Game balancing. The six-unit quote is retained only for legacy reservations. */
export const KQ_STAFF_TRIMMER_COST_CENTS = 150_000;
export const KQ_STAFF_TRIM_REQUIRED_WORK = 6;
export const KQ_STAFF_PLAYER_DAILY_HOURS = KQ_PLAYER_DAILY_HOURS;
import type { KqStaffTrimLot, KqStaffTrimMode } from "./kanab-quest-staff-types";
export type { KqStaffTrimLot, KqStaffTrimMode } from "./kanab-quest-staff-types";

/** Grams per game work hour: 60, 70, …, 150 by effective Transformation level. */
export function getKqStaffTrimRate(level: number, mode: KqStaffTrimMode) {
  if (!Number.isInteger(level) || level < 1 || level > 10) throw new Error("Niveau de transformation invalide.");
  if (mode !== "manual" && mode !== "machine") throw new Error("Mode de trim inconnu.");
  return (60 + (level - 1) * 10) * (mode === "machine" ? 4 : 1);
}

export function getKqStaffSharedTrimQuote(input: { mode: KqStaffTrimMode; hours: number; level: number; trait?: KqStaffTrait }) {
  const { mode, hours, level, trait } = input;
  const gramsPerHour = getKqStaffTrimRate(level, mode);
  if (!Number.isFinite(hours) || hours < 0.5 || hours > KQ_PLAYER_DAILY_HOURS || !Number.isInteger(hours * 2)) {
    throw new Error("Choisis entre 0,5 et 12 heures de trim, par demi-heure.");
  }
  const tier = Math.floor((level - 1) / 4);
  return {
    gramsPerHour, grams: gramsPerHour * hours,
    qualityDelta: mode === "manual" ? Math.min(3, 1 + tier + (trait === "meticulous" ? 1 : 0)) : Math.min(-1, -3 + tier),
    // Throughput already accounts for skill. Never speed up the clock a second time.
    durationMs: hours * KQ_GAME_DAY_MS / 24,
  };
}
export type KqStaffTrimQuote = {
  work: number;
  /** A final lot-quality adjustment, applied once on completion, never once per mission. */
  qualityDelta: number;
  durationMs: number;
};

/**
 * Pure quote only. The caller owns equipment checks, reservations, the employee's
 * shared planning, the player's daily budget, and one running task per lot.
 * Reserved hours remain charged to that planning when work is capped by the lot.
 */
export function getKqStaffTrimQuote(input: {
  lot: Pick<KqStaffTrimLot, "requiredWork" | "completedWork" | "mode" | "completedAt">;
  mode: KqStaffTrimMode;
  hours: number;
  level: number;
  trait?: KqStaffTrait;
}): KqStaffTrimQuote {
  const { lot, mode, hours, level, trait } = input;
  if (mode !== "manual" && mode !== "machine") throw new Error("Mode de trim inconnu.");
  if (!Number.isFinite(hours) || hours < 0.5 || hours > KQ_PLAYER_DAILY_HOURS || !Number.isInteger(hours * 2)) {
    throw new Error("Choisis entre 0,5 et 12 heures de trim, par demi-heure.");
  }
  if (!Number.isInteger(level) || level < 1 || level > 10) throw new Error("Niveau de transformation invalide.");
  if (!lot || !Number.isFinite(lot.requiredWork) || lot.requiredWork <= 0
    || !Number.isFinite(lot.completedWork) || lot.completedWork < 0 || lot.completedWork >= lot.requiredWork
    || lot.completedAt !== null) {
    throw new Error("Ce lot n'a plus de trim à effectuer.");
  }
  if (lot.mode !== null && lot.mode !== mode) throw new Error("Le lot conserve le mode de trim déjà commencé.");

  // The database stores hundredths. Quantize before serializing the final
  // fragment (6 - 5.8 is not exactly 0.2 in JavaScript).
  const remainingWork = Math.round((lot.requiredWork - lot.completedWork) * 100) / 100;
  const workPerHour = (1 + (level - 1) * 0.08) * (mode === "machine" ? 4 : 1);
  const work = Math.min(remainingWork, Math.round(hours * workPerHour * 100) / 100);
  const qualityTier = Math.floor((level - 1) / 4);
  const qualityDelta = mode === "manual"
    ? Math.min(3, 1 + qualityTier + (trait === "meticulous" ? 1 : 0))
    : Math.min(-1, -3 + qualityTier);
  const speed = trait === "quick" ? 1.15 : trait === "meticulous" ? 1 / 1.10 : 1;
  return { work, qualityDelta, durationMs: Math.round(hours * KQ_GAME_DAY_MS / 24 / speed) };
}
