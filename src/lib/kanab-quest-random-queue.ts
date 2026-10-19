import { getKqHarvestTier } from "./kanab-quest-harvest-tiers";

export type KqRandomQueueHealthStatus = "healthy" | "watch" | "critical";

export type KqRandomQueueHealth = {
  generatedAt: string;
  status: KqRandomQueueHealthStatus;
  waitingCount: number;
  oldestQueuedAt: string | null;
  oldestWaitMinutes: number;
  waitingOver15Minutes: number;
  waitingOver60Minutes: number;
  qualityBands: {
    artisanale: number;
    bellePousse: number;
    concours: number;
    exceptionnelle: number;
    legendaire: number;
    unknown: number;
  };
  truncated: boolean;
};

type KqRandomQueueRow = {
  flowerId: string;
  queuedAt: string;
};

type KqRandomQueueFlower = {
  id: string;
  quality: number;
  harvestTierVersion?: 2;
  successfulStages?: number;
  criticalStages?: number;
};

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const SIXTY_MINUTES_MS = 60 * 60 * 1000;

export function formatKqQueueWait(queuedAt: string | null, nowMs = Date.now()) {
  if (!queuedAt) return "quelques secondes";
  const queuedAtMs = Date.parse(queuedAt);
  if (!Number.isFinite(queuedAtMs)) return "quelques secondes";
  const waitMinutes = Math.max(0, Math.floor((nowMs - queuedAtMs) / 60_000));
  if (waitMinutes < 1) return "moins d’une minute";
  if (waitMinutes < 60) return `${waitMinutes} min`;
  const hours = Math.floor(waitMinutes / 60);
  const remainingMinutes = waitMinutes % 60;
  return remainingMinutes > 0 ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
}

export function buildKqRandomQueueHealth(
  queueRows: KqRandomQueueRow[],
  flowers: KqRandomQueueFlower[],
  now = new Date(),
  truncated = false,
): KqRandomQueueHealth {
  const nowMs = now.getTime();
  const flowerById = new Map(flowers.map((flower) => [flower.id, flower]));
  const validQueuedTimes = queueRows
    .map((row) => Date.parse(row.queuedAt))
    .filter(Number.isFinite);
  const oldestQueuedMs = validQueuedTimes.length > 0 ? Math.min(...validQueuedTimes) : null;
  const oldestWaitMinutes = oldestQueuedMs === null
    ? 0
    : Math.max(0, Math.floor((nowMs - oldestQueuedMs) / 60_000));
  const waits = validQueuedTimes.map((queuedAtMs) => Math.max(0, nowMs - queuedAtMs));
  const qualityBands = {
    artisanale: 0,
    bellePousse: 0,
    concours: 0,
    exceptionnelle: 0,
    legendaire: 0,
    unknown: 0,
  };

  for (const row of queueRows) {
    const flower = flowerById.get(row.flowerId);
    if (!flower || !Number.isFinite(flower.quality)) { qualityBands.unknown += 1; continue; }
    switch (getKqHarvestTier(flower.quality, flower)) {
      case "Récolte artisanale": qualityBands.artisanale += 1; break;
      case "Belle pousse": qualityBands.bellePousse += 1; break;
      case "Qualité concours": qualityBands.concours += 1; break;
      case "Fleur exceptionnelle": qualityBands.exceptionnelle += 1; break;
      case "Fleur légendaire": qualityBands.legendaire += 1; break;
    }
  }

  return {
    generatedAt: now.toISOString(),
    status: oldestWaitMinutes >= 60 ? "critical" : oldestWaitMinutes >= 15 ? "watch" : "healthy",
    waitingCount: queueRows.length,
    oldestQueuedAt: oldestQueuedMs === null ? null : new Date(oldestQueuedMs).toISOString(),
    oldestWaitMinutes,
    waitingOver15Minutes: waits.filter((wait) => wait >= FIFTEEN_MINUTES_MS).length,
    waitingOver60Minutes: waits.filter((wait) => wait >= SIXTY_MINUTES_MS).length,
    qualityBands,
    truncated,
  };
}
