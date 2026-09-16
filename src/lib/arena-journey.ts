export const ARENA_JOURNEY_VERSION = 2;
// Keep version 2 and ten chapters so existing completed guides stay dismissed.
// The new playable trial runs locally; it never navigates through live purchase/sale screens.
export const ARENA_JOURNEY_STEPS = [
 { id: "notebook", title: "Le Carnet" },
 { id: "cards", title: "Tes cartes" },
 { id: "shop", title: "La boutique" },
 { id: "installation", title: "Ton entrepôt" },
 { id: "culture", title: "La culture" },
 { id: "harvest", title: "La récolte" },
 { id: "jury", title: "Le duel" },
 { id: "transformation", title: "La valorisation" },
 { id: "market", title: "La vente" },
 { id: "missions", title: "À toi de jouer" },
] as const;
export const ARENA_JOURNEY_STEP_COUNT = ARENA_JOURNEY_STEPS.length - 1;
export type ArenaJourneyProgress = { step: number; status: "new" | "active" | "completed" | "skipped" };
export type ArenaJourneyAction = "start" | "next" | "previous" | "skip" | "restart";
export const NEW_ARENA_JOURNEY: ArenaJourneyProgress = { step: 0, status: "new" };
export function isArenaJourneyAction(value: unknown): value is ArenaJourneyAction {
  return typeof value === "string" && ["start", "next", "previous", "skip", "restart"].includes(value);
}
export function parseArenaJourneyProgress(value: unknown): ArenaJourneyProgress | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  return Number.isInteger(row.step) && Number(row.step) >= 0 && Number(row.step) < ARENA_JOURNEY_STEPS.length
    && typeof row.status === "string" && ["new", "active", "completed", "skipped"].includes(row.status)
    ? {step:Number(row.step),status:row.status as ArenaJourneyProgress["status"]} : null;
}
export function advanceArenaJourney(current: ArenaJourneyProgress, action: ArenaJourneyAction): ArenaJourneyProgress {
  if (action === "restart") return {step:0,status:"active"};
  if (current.status === "completed" || current.status === "skipped") return current;
  if (action === "skip") return {...current,status:"skipped"};
  if (action === "previous") return {step:Math.max(0,current.step-1),status:"active"};
  if (action === "next" && current.step === ARENA_JOURNEY_STEPS.length-1) return {...current,status:"completed"};
  return {step:Math.min(current.step+1,ARENA_JOURNEY_STEPS.length-1),status:"active"};
}
export function arenaJourneyStorageKey(userId: string) { return `arena-journey-v${ARENA_JOURNEY_VERSION}:${userId}`; }
