import { describe, expect, it } from "vitest";
import { buildKqRandomQueueHealth, formatKqQueueWait } from "@/lib/kanab-quest-random-queue";

describe("Kanab Quest random duel queue", () => {
  const now = new Date("2026-09-05T12:00:00.000Z");

  it("keeps an empty queue healthy", () => {
    expect(buildKqRandomQueueHealth([], [], now)).toEqual({
      generatedAt: now.toISOString(),
      status: "healthy",
      waitingCount: 0,
      oldestQueuedAt: null,
      oldestWaitMinutes: 0,
      waitingOver15Minutes: 0,
      waitingOver60Minutes: 0,
      qualityBands: { artisanale: 0, bellePousse: 0, concours: 0, exceptionnelle: 0, legendaire: 0, unknown: 0 },
      truncated: false,
    });
  });

  it("raises an anonymous alert and groups waiting flowers by harvest tier", () => {
    const health = buildKqRandomQueueHealth([
      { flowerId: "flower-a", queuedAt: "2026-09-05T10:45:00.000Z" },
      { flowerId: "flower-b", queuedAt: "2026-09-05T11:35:00.000Z" },
      { flowerId: "flower-c", queuedAt: "2026-09-05T11:55:00.000Z" },
      { flowerId: "flower-missing", queuedAt: "invalid" },
    ], [
      { id: "flower-a", quality: 15 },
      { id: "flower-b", quality: 8 },
      { id: "flower-c", quality: 4 },
    ], now);

    expect(health).toMatchObject({
      status: "critical",
      waitingCount: 4,
      oldestWaitMinutes: 75,
      waitingOver15Minutes: 2,
      waitingOver60Minutes: 1,
      qualityBands: { artisanale: 1, bellePousse: 1, concours: 0, exceptionnelle: 0, legendaire: 1, unknown: 1 },
    });
    expect(JSON.stringify(health)).not.toContain("flower-a");
    expect(JSON.stringify(health)).not.toContain("userId");
  });

  it("keeps historical titles and requires success evidence for new legendary flowers", () => {
    const flowers = [
      { id: "old", quality: 14 },
      { id: "contest", quality: 14, harvestTierVersion: 2 as const },
      { id: "exceptional", quality: 26, harvestTierVersion: 2 as const, successfulStages: 3, criticalStages: 3 },
      { id: "legendary", quality: 26, harvestTierVersion: 2 as const, successfulStages: 4, criticalStages: 2 },
      { id: "missing-proof", quality: 30, harvestTierVersion: 2 as const },
    ];
    const health = buildKqRandomQueueHealth(flowers.map(flower => ({ flowerId: flower.id, queuedAt: now.toISOString() })), flowers, now);
    expect(health.qualityBands).toEqual({ artisanale: 0, bellePousse: 0, concours: 1, exceptionnelle: 2, legendaire: 2, unknown: 0 });
  });

  it("formats the waiting time for the player", () => {
    expect(formatKqQueueWait("2026-09-05T11:59:30.000Z", now.getTime())).toBe("moins d’une minute");
    expect(formatKqQueueWait("2026-09-05T11:47:00.000Z", now.getTime())).toBe("13 min");
    expect(formatKqQueueWait("2026-09-05T09:55:00.000Z", now.getTime())).toBe("2 h 5 min");
  });
});
