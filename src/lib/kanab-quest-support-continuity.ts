import { KQ_ACTIVE_CARDS } from "./kanab-quest-game";
import { KQ_MISSION_DEFINITIONS, type KqMission, type KqMissionReward, type KqMissionSnapshot } from "./kanab-quest-missions";

export type KqSupportContinuityBoosters = {
  collectionActive: boolean;
  welcomeClaimed: boolean;
  availableEntitlements: Array<{ id: string; source: string; cardCount: number; createdAt: string }>;
};
export type KqSupportWelcomeReceipt = {
  entitlementId: string;
  claimed: boolean;
  replayed: boolean;
  status: "available" | "opened";
};
export type KqSupportContinuityAction =
  | { kind: "pack"; entitlementId: string; cardCount: number; availablePacks: number }
  | { kind: "welcome" }
  | { kind: "mission-reward"; mission: KqMission }
  | { kind: "mission-goal"; mission: KqMission; rewardMission: KqMission };
export type KqSupportContinuity = {
  status: "pending" | "unavailable" | "closed" | "ready";
  copies: number | null;
  varieties: number | null;
  action: KqSupportContinuityAction | null;
};

const activeCodes = new Set(KQ_ACTIVE_CARDS.map(card => card.code));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const integer = (value: unknown, minimum = 0): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= minimum;
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

/** Claiming a welcome pack only creates its entitlement. A replay can find a
 * pack already opened elsewhere; neither case is a second attribution. */
export function parseKqSupportWelcomeReceipt(value: unknown): KqSupportWelcomeReceipt | null {
  if (!record(value) || typeof value.entitlementId !== "string" || !uuid.test(value.entitlementId)
    || typeof value.claimed !== "boolean" || typeof value.replayed !== "boolean" || value.claimed === value.replayed
    || (value.status !== "available" && value.status !== "opened") || (value.claimed && value.status !== "available")) return null;
  return { entitlementId: value.entitlementId, claimed: value.claimed, replayed: value.replayed, status: value.status };
}

/** Counts the available copies supplied by collection authority, never the deck,
 * historical burns, replaced care cards, or an assumed empty collection. */
export function getKqSupportContinuityInventory(value: unknown): Pick<KqSupportContinuity, "copies" | "varieties"> {
  if (!record(value) || Object.values(value).some(count => !integer(count))) return { copies: null, varieties: null };
  let copies = 0, varieties = 0;
  for (const [code, count] of Object.entries(value)) {
    if (!activeCodes.has(code) || !integer(count) || count === 0) continue;
    copies += count;
    varieties++;
    if (!Number.isSafeInteger(copies)) return { copies: null, varieties: null };
  }
  return { copies, varieties };
}

/** Only the fields needed for existing entitlements are parsed: purchase prices
 * and loyalty points are deliberately outside this free continuity path. */
export function parseKqSupportContinuityBoosters(value: unknown): KqSupportContinuityBoosters | null {
  if (!record(value) || typeof value.collectionActive !== "boolean" || typeof value.welcomeClaimed !== "boolean"
    || !Array.isArray(value.availableEntitlements)) return null;
  const entitlements: KqSupportContinuityBoosters["availableEntitlements"] = [];
  const seen = new Set<string>();
  for (const item of value.availableEntitlements) {
    if (!record(item) || typeof item.id !== "string" || !uuid.test(item.id) || seen.has(item.id.toLowerCase())
      || !text(item.source) || !integer(item.cardCount, 1) || !text(item.createdAt) || !Number.isFinite(Date.parse(item.createdAt))) return null;
    seen.add(item.id.toLowerCase());
    entitlements.push({ id: item.id, source: item.source, cardCount: item.cardCount, createdAt: item.createdAt });
  }
  return { collectionActive: value.collectionActive, welcomeClaimed: value.welcomeClaimed, availableEntitlements: entitlements };
}

function parseReward(value: unknown): KqMissionReward | null {
  if (!record(value)) return null;
  if (value.kind === "cash" && integer(value.amountCents, 1)) return { kind: "cash", amountCents: value.amountCents };
  if (value.kind === "pack" && integer(value.cardCount, 1)) return { kind: "pack", cardCount: value.cardCount };
  if (value.kind === "card" && text(value.code) && text(value.name) && value.rarity === "gold") {
    return { kind: "card", code: value.code, name: value.name, rarity: "gold" };
  }
  return null;
}

/** Missing steps must not make a locked reward look accessible or a journey
 * look complete. Progress, availability and claimability remain server data. */
export function parseKqSupportContinuityMissions(value: unknown): KqMissionSnapshot | null {
  if (!record(value) || typeof value.collectionActive !== "boolean" || !Array.isArray(value.missions)
    || value.missions.length !== KQ_MISSION_DEFINITIONS.length) return null;
  const missions: KqMission[] = [];
  const seen = new Set<string>();
  for (const item of value.missions) {
    if (!record(item)) return null;
    const definition = KQ_MISSION_DEFINITIONS.find(mission => mission.code === item.code);
    const reward = parseReward(item.reward);
    if (!definition || seen.has(definition.code) || item.track !== definition.track || item.step !== definition.step || !reward
      || typeof item.target !== "number" || !Number.isFinite(item.target) || item.target <= 0
      || typeof item.progress !== "number" || !Number.isFinite(item.progress) || item.progress < 0
      || typeof item.rewardAvailable !== "boolean" || typeof item.claimed !== "boolean"
      || typeof item.unlocked !== "boolean" || typeof item.claimable !== "boolean" || !integer(item.cardCount)
      || !(item.entitlementId === null || (typeof item.entitlementId === "string" && uuid.test(item.entitlementId)))
      || !(item.packAvailable === null || typeof item.packAvailable === "boolean")
      || (item.claimable && (item.claimed || !item.unlocked || item.progress < item.target))
      || (item.packAvailable && (!item.claimed || !item.entitlementId || reward.kind !== "pack"))) return null;
    seen.add(definition.code);
    missions.push({ code: definition.code, track: definition.track, step: definition.step, reward,
      target: item.target, progress: item.progress, rewardAvailable: item.rewardAvailable,
      cardCount: item.cardCount, claimed: item.claimed, unlocked: item.unlocked, claimable: item.claimable,
      entitlementId: item.entitlementId, packAvailable: item.packAvailable });
  }
  // Ignore response order: each journey has a stable, explicit progression.
  const ordered = KQ_MISSION_DEFINITIONS.map(definition => missions.find(mission => mission.code === definition.code)!);
  if (ordered.some(mission => mission.unlocked !== (mission.claimed || ordered.every(previous => previous.track !== mission.track || previous.step >= mission.step || previous.claimed)))) return null;
  return { collectionActive: value.collectionActive, missions: ordered };
}

function givesSupport(mission: KqMission) {
  return mission.rewardAvailable && (mission.reward.kind === "pack" || (mission.reward.kind === "card" && activeCodes.has(mission.reward.code)));
}

/** Read-only guidance. It cannot grant a card, open a pack, change a deck or
 * require a purchase. Undefined is loading; null is a failed/invalid response. */
export function getKqSupportContinuity(input: { inventory: unknown; boosters: unknown; missions: unknown }): KqSupportContinuity {
  const counts = getKqSupportContinuityInventory(input.inventory);
  const result = (status: KqSupportContinuity["status"], action: KqSupportContinuityAction | null = null): KqSupportContinuity => ({ status, ...counts, action });
  if (input.boosters === undefined) return result("pending");
  const boosters = parseKqSupportContinuityBoosters(input.boosters);
  if (!boosters) return result("unavailable");
  if (!boosters.collectionActive) return result("closed");
  const available = boosters.availableEntitlements[0];
  if (available) return result("ready", { kind: "pack", entitlementId: available.id, cardCount: available.cardCount, availablePacks: boosters.availableEntitlements.length });
  if (!boosters.welcomeClaimed) return result("ready", { kind: "welcome" });
  if (input.missions === undefined) return result("pending");
  const missions = parseKqSupportContinuityMissions(input.missions);
  if (!missions) return result("unavailable");
  if (!missions.collectionActive) return result("closed");
  const ready = missions.missions.find(mission => !mission.claimed && mission.unlocked && mission.claimable && givesSupport(mission));
  if (ready) return result("ready", { kind: "mission-reward", mission: ready });
  for (const track of ["culture", "quality"] as const) {
    const journey = missions.missions.filter(mission => mission.track === track);
    const current = journey.find(mission => !mission.claimed);
    // A later reward behind cash milestones is not the current objective.
    // In particular, five varieties may require Buddies the player lacks.
    if (current?.unlocked && givesSupport(current)) return result("ready", { kind: "mission-goal", mission: current, rewardMission: current });
  }
  return result("ready");
}
