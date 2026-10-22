import { describe, expect, it } from "vitest";
import { KQ_ACTIVE_CARDS, KQ_CARDS, KQ_RETIRED_CARDS } from "./kanab-quest-game";
import { KQ_MISSION_DEFINITIONS, type KqMission, type KqMissionCode, type KqMissionSnapshot } from "./kanab-quest-missions";
import { getKqSupportContinuity, getKqSupportContinuityInventory, parseKqSupportContinuityBoosters, parseKqSupportContinuityMissions, parseKqSupportWelcomeReceipt } from "./kanab-quest-support-continuity";

const pack = { id: "62253082-a626-4eda-b67e-1cb5bfecf324", source: "mission", cardCount: 3, createdAt: "2026-10-21T12:00:00.000Z" };
const boosters = { collectionActive: true, welcomeClaimed: true, availableEntitlements: [] as typeof pack[] };
const activeCode = KQ_ACTIVE_CARDS[0].code;
const inventory = { [activeCode]: 3 };
const beforeCultureCard: KqMissionCode[] = ["first-harvest", "three-varieties"];

describe("welcome entitlement receipts", () => {
  const receipt = { entitlementId: pack.id, claimed: true, replayed: false, status: "available" as const };

  it("recognizes a new attribution without inventing opened cards", () => {
    expect(parseKqSupportWelcomeReceipt(receipt)).toEqual(receipt);
  });

  it.each(["available", "opened"])("preserves a replayed entitlement that is %s", status => {
    const replay = { ...receipt, claimed: false, replayed: true, status };
    expect(parseKqSupportWelcomeReceipt(replay)).toEqual(replay);
  });

  it.each([
    undefined, null, {}, { ...receipt, entitlementId: "not-a-pack" },
    { ...receipt, claimed: undefined }, { ...receipt, replayed: "false" },
    { ...receipt, claimed: false }, { ...receipt, replayed: true },
    { ...receipt, status: "opened" }, { ...receipt, status: "pending" },
    { ...receipt, status: undefined },
  ])("rejects unconfirmed or contradictory welcome receipts: %j", value => {
    expect(parseKqSupportWelcomeReceipt(value)).toBeNull();
  });
});

function missions(claimed: KqMissionCode[] = [], overrides: Partial<Record<KqMissionCode, Partial<KqMission>>> = {}): KqMissionSnapshot {
  return { collectionActive: true, missions: KQ_MISSION_DEFINITIONS.map(definition => ({
    code: definition.code, track: definition.track, step: definition.step, target: definition.target,
    reward: definition.reward, rewardAvailable: true,
    progress: claimed.includes(definition.code) ? definition.target : 0,
    cardCount: definition.reward.kind === "pack" ? definition.reward.cardCount : definition.reward.kind === "card" ? 1 : 0,
    claimed: claimed.includes(definition.code),
    unlocked: claimed.includes(definition.code) || KQ_MISSION_DEFINITIONS.every(previous => previous.track !== definition.track || previous.step >= definition.step || claimed.includes(previous.code)),
    claimable: false, entitlementId: null, packAvailable: false, ...overrides[definition.code],
  })) };
}

function guidance(snapshot: unknown, overrides: Partial<Parameters<typeof getKqSupportContinuity>[0]> = {}) {
  return getKqSupportContinuity({ inventory, boosters, missions: snapshot, ...overrides });
}

describe("available support inventory", () => {
  it("counts actual copies and distinct playable cards, excluding retired and replaced care cards", () => {
    const replaced = KQ_CARDS.find(card => !KQ_ACTIVE_CARDS.some(active => active.code === card.code))!;
    expect(replaced).toBeDefined();
    expect(getKqSupportContinuityInventory({ [activeCode]: 3, [KQ_ACTIVE_CARDS[1].code]: 7,
      [KQ_RETIRED_CARDS[0].code]: 50, [replaced.code]: 20, UNKNOWN: 10 })).toEqual({ copies: 10, varieties: 2 });
  });

  it.each([undefined, null, [], "empty", { [activeCode]: undefined }, { [activeCode]: "3" }, { [activeCode]: -1 }, { [activeCode]: 1.5 }, { [activeCode]: Infinity }])("keeps missing or malformed inventory unknown: %j", value => {
    expect(getKqSupportContinuityInventory(value)).toEqual({ copies: null, varieties: null });
  });

  it("distinguishes confirmed empty inventory from unknown and counts it before remote guidance arrives", () => {
    expect(getKqSupportContinuity({ inventory: {}, boosters: undefined, missions: undefined })).toEqual({ status: "pending", copies: 0, varieties: 0, action: null });
    expect(getKqSupportContinuity({ inventory, boosters: undefined, missions: undefined }).copies).toBe(3);
  });

  it("never exposes an overflowing sum as a real stock", () => {
    expect(getKqSupportContinuityInventory({ [activeCode]: Number.MAX_SAFE_INTEGER, [KQ_ACTIVE_CARDS[1].code]: 1 })).toEqual({ copies: null, varieties: null });
  });
});

describe("free support continuity", () => {
  it("prioritizes an already-owned pack over welcome and missions, even with unavailable secondary data", () => {
    const result = guidance(null, { inventory: null, boosters: { ...boosters, welcomeClaimed: false, availableEntitlements: [pack, { ...pack, id: "844be0f2-1faa-49d2-a19e-c2ffec8ed157", source: "pvp_win", cardCount: 1 }] } });
    expect(result).toEqual({ status: "ready", copies: null, varieties: null, action: { kind: "pack", entitlementId: pack.id, cardCount: 3, availablePacks: 2 } });
  });

  it("offers only an unclaimed welcome without inventing its card count or changing its state", () => {
    const snapshot = { ...boosters, welcomeClaimed: false };
    expect(guidance(undefined, { boosters: snapshot }).action).toEqual({ kind: "welcome" });
    expect(snapshot.welcomeClaimed).toBe(false);
    expect(guidance(missions()).action).toBeNull();
  });

  it("prioritizes an attained support reward from any journey over an unfinished culture objective", () => {
    const snapshot = missions([...beforeCultureCard, "first-online-sale", "online-two"], {
      "five-varieties": { progress: 3 }, "online-aroma-duo": { progress: 1, claimable: true },
    });
    const result = guidance(snapshot);
    expect(result.action?.kind).toBe("mission-reward");
    expect(result.action?.kind === "mission-reward" && result.action.mission.code).toBe("online-aroma-duo");
  });

  it("can present an attained pack as a mission reward, without pretending an entitlement already exists", () => {
    const snapshot = missions([...beforeCultureCard, "five-varieties", "ten-varieties"], { "fifteen-varieties": { progress: 15, claimable: true } });
    const result = guidance(snapshot);
    expect(result.action?.kind).toBe("mission-reward");
    expect(result.action?.kind === "mission-reward" && result.action.mission.reward).toEqual({ kind: "pack", cardCount: 3 });
  });

  it("never infers claimability from a completed meter", () => {
    const result = guidance(missions(beforeCultureCard, { "five-varieties": { progress: 5, claimable: false } }));
    expect(result.action?.kind).toBe("mission-goal");
    expect(result.action?.kind === "mission-goal" && result.action.mission.claimable).toBe(false);
  });

  it("suggests the current unlocked culture card, keeping its actual progress and reward", () => {
    const snapshot = missions(beforeCultureCard, { "five-varieties": { progress: 3 } });
    const result = guidance(snapshot);
    expect(result.action).toEqual({ kind: "mission-goal", mission: snapshot.missions[2], rewardMission: snapshot.missions[2] });
  });

  it("does not promise future cards behind early cash objectives or extra Buddies", () => {
    expect(guidance(missions()).action).toBeNull();
    expect(guidance(missions(["first-harvest"], { "three-varieties": { progress: 3, claimable: true } })).action).toBeNull();
  });

  it("can choose an unlocked quality card when the current culture reward is cash", () => {
    const result = guidance(missions(["beautiful-flower", "contest-flower"], { "three-contest-flowers": { progress: 1 } }));
    expect(result.action?.kind === "mission-goal" && result.action.mission.code).toBe("three-contest-flowers");
  });

  it("does not advertise unavailable, replaced or unknown support rewards", () => {
    for (const override of [
      { rewardAvailable: false },
      { reward: { kind: "card" as const, code: "BOTTE-001", name: "Archive", rarity: "gold" as const } },
      { reward: { kind: "card" as const, code: "UNKNOWN", name: "Inconnue", rarity: "gold" as const } },
    ]) expect(guidance(missions(beforeCultureCard, { "five-varieties": { progress: 5, claimable: true, ...override } })).action).toBeNull();
  });

  it("does not reopen claimed rewards or turn exhausted journeys into an offer to buy", () => {
    const snapshot = missions(KQ_MISSION_DEFINITIONS.map(definition => definition.code));
    expect(guidance(snapshot)).toEqual({ status: "ready", copies: 3, varieties: 1, action: null });
  });

  it("marks a closed collection without claiming that known stock disappeared", () => {
    expect(guidance(null, { boosters: { ...boosters, collectionActive: false, availableEntitlements: [pack] } })).toEqual({ status: "closed", copies: 3, varieties: 1, action: null });
    expect(guidance({ ...missions(), collectionActive: false }).status).toBe("closed");
  });

  it("distinguishes a pending response from a failed response, with no invented empty state", () => {
    expect(guidance(undefined).status).toBe("pending");
    expect(guidance(null).status).toBe("unavailable");
    expect(guidance(missions(), { boosters: null }).status).toBe("unavailable");
  });

  it("leaves input snapshots and the supplied available inventory unchanged", () => {
    const input = { inventory: { ...inventory }, boosters: { ...boosters }, missions: missions(beforeCultureCard) };
    const previous = structuredClone(input);
    getKqSupportContinuity(input);
    expect(input).toEqual(previous);
  });
});

describe("authoritative support response validation", () => {
  it.each([
    undefined, null, {}, { ...boosters, collectionActive: undefined }, { ...boosters, welcomeClaimed: "false" },
    { ...boosters, availableEntitlements: undefined }, { ...boosters, availableEntitlements: [null] },
    { ...boosters, availableEntitlements: [{ ...pack, id: "not-an-entitlement" }] },
    { ...boosters, availableEntitlements: [{ ...pack, cardCount: 0 }] },
    { ...boosters, availableEntitlements: [{ ...pack, source: "" }] },
    { ...boosters, availableEntitlements: [{ ...pack, createdAt: "invalid" }] },
    { ...boosters, availableEntitlements: [pack, { ...pack, id: pack.id.toUpperCase() }] },
  ])("rejects an incomplete or ambiguous pack response: %j", value => {
    expect(parseKqSupportContinuityBoosters(value)).toBeNull();
  });

  it("accepts actual GET boosters payloads without depending on purchase prices or points", () => {
    expect(parseKqSupportContinuityBoosters({ ...boosters, costPerPack: 5, spendablePoints: 10 })).toEqual(boosters);
  });

  it("preserves server rewards, including historical packs and non-default pack sizes", () => {
    const snapshot = missions(["first-harvest"], { "first-harvest": { reward: { kind: "pack", cardCount: 7 }, cardCount: 7, entitlementId: pack.id, packAvailable: true } });
    expect(parseKqSupportContinuityMissions(snapshot)).toEqual(snapshot);
  });

  it("sorts complete server responses without inventing an unlock", () => {
    const snapshot = missions(beforeCultureCard);
    expect(parseKqSupportContinuityMissions({ ...snapshot, missions: [...snapshot.missions].reverse() })).toEqual(snapshot);
  });

  it("rejects missing, duplicate, unknown or mismatched mission definitions", () => {
    const snapshot = missions();
    for (const rows of [snapshot.missions.slice(1), [...snapshot.missions.slice(1), snapshot.missions[1]],
      [{ ...snapshot.missions[0], code: "new-unknown" }, ...snapshot.missions.slice(1)],
      [{ ...snapshot.missions[0], track: "quality" }, ...snapshot.missions.slice(1)]]) {
      expect(parseKqSupportContinuityMissions({ ...snapshot, missions: rows })).toBeNull();
    }
  });

  it.each([
    { target: 0 }, { progress: undefined }, { progress: Number.NaN }, { rewardAvailable: undefined },
    { claimable: true, progress: 0 }, { claimed: true, claimable: true, progress: 1 },
    { entitlementId: "invalid" }, { packAvailable: true }, { reward: null }, { cardCount: -1 },
  ])("rejects malformed mission authority rather than inventing a reward: %j", override => {
    const snapshot = missions();
    snapshot.missions[0] = { ...snapshot.missions[0], ...override } as KqMission;
    expect(parseKqSupportContinuityMissions(snapshot)).toBeNull();
  });

  it("rejects a falsely unlocked reward behind an unclaimed prerequisite", () => {
    expect(parseKqSupportContinuityMissions(missions([], { "five-varieties": { unlocked: true, progress: 5, claimable: true } }))).toBeNull();
  });
});
