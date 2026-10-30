import type { KqOfficialBattle, KqOfficialFlower } from "./kanab-quest-api";

/** A confirmed engagement/verdict wins over a stale flower; an old cancellation does not. */
export function getKqJuryTarget(flowers: readonly KqOfficialFlower[], battles: readonly KqOfficialBattle[], flowerId?: string):
  { kind: "none" | "missing" } | { kind: "flower"; id: string } | { kind: "battle"; id: string } {
  if (!flowerId) return { kind: "none" };
  const matching = battles.filter(battle => battle.playerFlower.id === flowerId);
  const locked = matching.find(battle => battle.status === "locked");
  if (locked) return { kind: "battle", id: locked.id };
  const verdict = matching.find(battle => battle.status === "verdict");
  if (verdict) return { kind: "battle", id: verdict.id };
  const flower = flowers.find(flower => flower.id === flowerId);
  if (flower && flower.status !== "burned") return { kind: "flower", id: flower.id };
  const latest = [...matching].sort((a, b) => Date.parse(b.verdictAt ?? b.lockedAt) - Date.parse(a.verdictAt ?? a.lockedAt))[0];
  return latest ? { kind: "battle", id: latest.id } : { kind: "missing" };
}
