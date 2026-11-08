import { KQ_GAME_DAY_MS } from "./kanab-quest-business";
import type { KqStaffEffect, KqStaffRawSnapshot, KqStaffState, KqStaffTask, KqStaffTrimLot } from "./kanab-quest-staff-types";

const HOUR_MS = KQ_GAME_DAY_MS / 24;
const MICROS = 1_000_000;
const precise = (grams: number) => Math.round(grams * MICROS) / MICROS;
type TrimEffect = Extract<KqStaffEffect, { kind: "trim-work" }>;

/** Project effects from this transaction; its database snapshot is still unchanged. */
export function getKqSharedTrimLots(raw: KqStaffRawSnapshot, effects: KqStaffEffect[] = []) {
  return (raw.context.trimLots ?? []).filter((lot): lot is KqStaffTrimLot & { totalGrams: number; completedGrams: number } =>
    Number.isFinite(lot.totalGrams) && Number.isFinite(lot.completedGrams) && lot.totalGrams! > 0,
  ).map(lot => {
    const pending = effects.filter((effect): effect is TrimEffect => effect.kind === "trim-work" && effect.flowerId === lot.flowerId);
    const completedGrams = Math.min(lot.totalGrams, precise(lot.completedGrams + pending.reduce((sum, effect) =>
      sum + (effect.unit === "g" ? effect.work : effect.work / lot.requiredWork * lot.totalGrams), 0)));
    return { ...lot, completedGrams, mode: lot.mode ?? pending[0]?.mode ?? null };
  }).sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? "") || a.flowerId.localeCompare(b.flowerId));
}

/**
 * Advance all shifts on one shared timeline. Allocation happens as work elapses,
 * not when a shift is booked, so another worker can join even the final harvest.
 * Start/end/harvest events prevent retroactive work; a finished harvest hands its
 * remaining shift time to the next compatible harvest. SQL CAS owns persistence.
 */
export function advanceKqSharedTrim(state: KqStaffState, raw: KqStaffRawSnapshot, effects: KqStaffEffect[]) {
  const now = Date.parse(raw.serverNow);
  const shifts = state.tasks.filter(task => task.kind === "trim" && task.trimQueue && task.status === "running")
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt) || a.id.localeCompare(b.id));
  if (!shifts.length) return;
  if (raw.context.trimQueueVersion !== 2) throw new Error("Le suivi du trim commun est indisponible. Actualise l’Atelier.");
  const lots = getKqSharedTrimLots(raw, effects).filter(lot => !lot.completedAt && lot.completedGrams < lot.totalGrams);
  const legacyRelease = new Map<string, number>();
  for (const task of raw.state?.tasks ?? []) {
    if (task.kind === "trim" && !task.trimQueue && task.status === "running" && task.targetId) {
      legacyRelease.set(task.targetId, Math.max(legacyRelease.get(task.targetId) ?? 0, Date.parse(task.completesAt)));
    }
  }
  const availableAt = (lot: typeof lots[number]) => Math.max(Date.parse(lot.createdAt ?? raw.context.businessStartedAt), legacyRelease.get(lot.flowerId) ?? 0);
  const progressAt = (task: KqStaffTask) => Date.parse(task.trimProgressAt ?? task.startedAt);
  for (const task of shifts) {
    if (!Number.isFinite(task.trimRateGramsPerHour) || task.trimRateGramsPerHour! <= 0 || task.trimRateGramsPerHour! > 600
      || !task.trimMode || !Number.isInteger(task.trimQualityDelta) || !Number.isFinite(progressAt(task))) {
      throw new Error("Réservation de trim incompatible. Actualise l’Atelier.");
    }
  }
  const start = Math.min(...shifts.map(progressAt));
  const boundaries = [...new Set([start, now, ...shifts.flatMap(task => [progressAt(task), Date.parse(task.startedAt), Date.parse(task.completesAt)]), ...lots.map(availableAt)])]
    .filter(time => time >= start && time <= now).sort((a, b) => a - b);
  const credits = new Map<string, TrimEffect>();
  for (let index = 0; index < boundaries.length - 1; index++) {
    const time = boundaries[index];
    const end = boundaries[index + 1];
    let elapsed = 0;
    const active = shifts.filter(task => progressAt(task) <= time && Date.parse(task.startedAt) <= time && Date.parse(task.completesAt) > time);
    while (elapsed < end - time && active.length) {
      const groups = new Map<typeof lots[number], KqStaffTask[]>();
      for (const task of active) {
        const lot = lots.find(row => availableAt(row) <= time && row.completedGrams < row.totalGrams && (row.mode === null || row.mode === task.trimMode));
        if (!lot) continue;
        lot.mode ??= task.trimMode!;
        groups.set(lot, [...groups.get(lot) ?? [], task]);
      }
      if (!groups.size) break;
      const duration = Math.min(end - time - elapsed, ...Array.from(groups, ([lot, workers]) =>
        (lot.totalGrams - lot.completedGrams) * HOUR_MS / workers.reduce((sum, task) => sum + task.trimRateGramsPerHour!, 0)));
      // Use relative time: adding a sub-millisecond final fragment to an epoch
      // timestamp can round back to the same timestamp and strand the harvest.
      if (duration <= 0 || elapsed + duration === elapsed) break;
      for (const [lot, workers] of groups) {
        const remaining = Math.round((lot.totalGrams - lot.completedGrams) * MICROS);
        const allocations = workers.map(task => {
          const exact = task.trimRateGramsPerHour! * duration / HOUR_MS * MICROS;
          return { task, exact, units: Math.floor(exact) };
        });
        const total = Math.min(remaining, Math.round(allocations.reduce((sum, row) => sum + row.exact, 0)));
        let extra = total - allocations.reduce((sum, row) => sum + row.units, 0);
        // Largest remainder keeps every gram conserved, even on the final fragment.
        for (const row of [...allocations].sort((a, b) => (b.exact - b.units) - (a.exact - a.units))) {
          if (extra <= 0) break;
          row.units++; extra--;
        }
        for (const { task, units } of allocations) {
          if (!units) continue;
          const grams = units / MICROS;
          task.trimGrams = precise((task.trimGrams ?? 0) + grams);
          task.trimContributions ??= [];
          const contribution = task.trimContributions.find(row => row.flowerId === lot.flowerId);
          if (contribution) contribution.grams = precise(contribution.grams + grams);
          else task.trimContributions.push({ flowerId: lot.flowerId, grams });
          const key = `${lot.flowerId}:${task.trimMode}:${task.trimQualityDelta}`;
          const previous = credits.get(key);
          credits.set(key, { kind: "trim-work", unit: "g", flowerId: lot.flowerId, mode: task.trimMode!, qualityDelta: task.trimQualityDelta!, work: precise((previous?.work ?? 0) + grams) });
        }
        lot.completedGrams = precise(lot.completedGrams + total / MICROS);
      }
      elapsed += duration;
    }
  }
  for (const task of shifts) {
    const through = Math.min(now, Date.parse(task.completesAt));
    if (through > progressAt(task)) task.trimProgressAt = new Date(through).toISOString();
  }
  // A long absence may combine several shifts; each SQL effect stays bounded.
  for (const effect of credits.values()) {
    let remaining = effect.work;
    while (remaining > 0) {
      const work = Math.min(7200, remaining);
      effects.push({ ...effect, work });
      remaining = precise(remaining - work);
    }
  }
}
