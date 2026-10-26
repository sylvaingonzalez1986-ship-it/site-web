import { afterEach, describe, expect, it, vi } from "vitest";
import { applyKqSocialCommand, createKqSocialSnapshot, getKqSocialAdventure, getKqSponsorOffers, isKqSocialSnapshot, parseKqSocialCommand, refreshKqSocialSnapshot } from "./kanab-quest-social";
import { getKqSocialNextMidnight, getKqSocialPublicationDay, isKqSocialPublicationDay } from "./kanab-quest-social-daily";
import { KQ_SOCIAL_SCENARIOS, KQ_SOCIAL_SPONSORS } from "./kanab-quest-social-stories";
import { getKqSocialProducerNarrative } from "./kanab-quest-social-producer";
import { applyKqOperationsRequest, createKqOperationsLesson, type KqOperationsLessonAction } from "./kanab-quest-operations-lesson";
import { getKqOperationsSocial } from "./kanab-quest-operations-social";
import { createKqOperationsSession, restoreKqOperationsLesson } from "./kanab-quest-operations-session";
import type { KqSocialCommand, KqSocialPlatform, KqSocialSnapshot } from "./kanab-quest-social-types";

const now = Date.parse("2026-10-25T12:00:00Z");
const base = (state: KqSocialSnapshot) => ({ modelVersion: 2 as const,
  requestKey: `87000000-0000-4000-8000-${String(state.revision + 1).padStart(12, "0")}`, expectedRevision: state.revision });
function choose(state: KqSocialSnapshot, platform: KqSocialPlatform = "instagram", action?: "reply" | "ignore"): KqSocialCommand {
  const adventure = getKqSocialAdventure(state, platform);
  const selected = action ? adventure.scene.choices.find(choice => choice.action === action)! : adventure.scene.choices.find(choice => choice.intent === "care")!;
  return { ...base(state), action: "choose", platform, scenarioId: adventure.scene.id, choiceId: selected.id,
    narrativeVersion: 3, subjectId: adventure.subject!.id, contextKey: adventure.contextKey };
}
function dailyArcState(platform: KqSocialPlatform = "x") {
  const state = createKqSocialSnapshot(now);
  const scenes = KQ_SOCIAL_SCENARIOS.filter(scene => scene.platform === platform);
  const opening = scenes.find(scene => scene.episode === 1 && scenes.some(last => last.arc === scene.arc && last.episode === 3 && getKqSocialProducerNarrative(last.id).replyTo))!;
  expect(opening, "a new story has two real comment decisions after its publication").toBeDefined();
  for (const scene of scenes.filter(scene => scene.episode === 1 && scene.id.includes("-debate-") && scene.id !== opening.id)) state.platforms[platform].memory[scene.id] = scene.choices[0].id;
  state.platforms[platform].chapter = scenes.indexOf(opening);
  return state;
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("one real publication per Paris calendar day on each network", () => {
  it.each([
    ["2026-03-28T23:00:00.000Z", "2026-03-29T22:00:00.000Z", 23],
    ["2026-10-24T22:00:00.000Z", "2026-10-25T23:00:00.000Z", 25],
    ["2026-10-25T23:00:00.000Z", "2026-10-26T23:00:00.000Z", 24],
  ])("uses the real midnight boundary from %s", (start, expected, hours) => {
    expect(new Date(getKqSocialNextMidnight(Date.parse(start))).toISOString()).toBe(expected);
    expect(getKqSocialNextMidnight(Date.parse(start)) - Date.parse(start)).toBe(hours * 3_600_000);
  });

  it("does not release the quota during the repeated autumn hour and rejects malformed day keys", () => {
    for (const instant of ["2026-10-25T00:30:00Z", "2026-10-25T01:30:00Z"]) {
      expect(getKqSocialPublicationDay(Date.parse(instant))).toBe("2026-10-25");
      expect(getKqSocialNextMidnight(Date.parse(instant))).toBe(Date.parse("2026-10-25T23:00:00Z"));
    }
    for (const day of ["2026-02-30", "2026-1-1", "2026-13-01", 20261025, null]) expect(isKqSocialPublicationDay(day)).toBe(false);
  });

  it("keeps the networks independent and opens the next post exactly at midnight rather than after 24 hours", () => {
    const beforeMidnight = Date.parse("2026-10-25T22:59:59Z");
    const first = applyKqSocialCommand(createKqSocialSnapshot(beforeMidnight), choose(createKqSocialSnapshot(beforeMidnight)), beforeMidnight);
    expect(first.platforms.instagram).toMatchObject({ publishedDay: "2026-10-25", nextPostAt: "2026-10-25T23:00:00.000Z" });
    const both = applyKqSocialCommand(first, choose(first, "x"), beforeMidnight);
    expect(both.platforms.x.publishedDay).toBe("2026-10-25");
    expect(() => applyKqSocialCommand(both, choose(both), beforeMidnight + 999)).toThrow(/déjà publié/);
    const next = applyKqSocialCommand(both, choose(both), beforeMidnight + 1000);
    expect(next.platforms.instagram.publishedDay).toBe("2026-10-26");
    expect(next.platforms.instagram.nextPostAt).toBe("2026-10-26T23:00:00.000Z");
    expect(isKqSocialSnapshot(next)).toBe(true);
  });

  it("allows both comments to be answered or ignored on the same day, preserving the actual parent", () => {
    const initial = dailyArcState();
    for (const firstAction of ["reply", "ignore"] as const) for (const secondAction of ["reply", "ignore"] as const) {
      const published = applyKqSocialCommand(initial, choose(initial, "x"), now);
      const original = published.history[0];
      const response = applyKqSocialCommand(published, choose(published, "x", firstAction), now);
      const second = getKqSocialAdventure(response, "x");
      expect(second.scene.episode).toBe(3);
      expect(second.scene.parentChoice).toBe(original.choiceId);
      const completed = applyKqSocialCommand(response, choose(response, "x", secondAction), now);
      expect(completed.history[0].parentChoice).toBe(original.choiceId);
      expect(completed.platforms.x.publishedDay).toBe(published.platforms.x.publishedDay);
      expect(completed.platforms.x.nextPostAt).toBe(published.platforms.x.nextPostAt);
      expect(() => applyKqSocialCommand(completed, choose(completed, "x"), now)).toThrow(/déjà publié/);
    }
  });

  it("shares the quota with sponsored posts while letting contract administration continue", () => {
    let state = dailyArcState();
    state.platforms.x.followers = 3000; state.platforms.x.trust = 90; state.socialFollowers = 3000; state.audienceFollowers = 3000;
    const sponsor = KQ_SOCIAL_SPONSORS.find(item => item.platform === "x")!;
    state = applyKqSocialCommand(state, { ...base(state), action: "sponsor-accept", sponsorId: sponsor.id,
      expectedRewardCents: getKqSponsorOffers(state).find(offer => offer.sponsor.id === sponsor.id)!.rewardCents! }, now);
    const sponsored = applyKqSocialCommand(state, { ...base(state), action: "sponsor-post", tag: sponsor.requiredTags[0] }, now);
    expect(sponsored.platforms.x.publishedDay).toBe("2026-10-25");
    expect(() => applyKqSocialCommand(sponsored, choose(sponsored, "x"), now)).toThrow(/déjà publié/);
    expect(() => applyKqSocialCommand(sponsored, { ...base(sponsored), action: "sponsor-post", tag: sponsor.requiredTags[1] }, now)).toThrow(/déjà publié/);
    expect(applyKqSocialCommand(sponsored, { ...base(sponsored), action: "sponsor-cancel" }, now).sponsors.active).toBeNull();
    const ordinary = applyKqSocialCommand(state, choose(state, "x"), now);
    expect(() => applyKqSocialCommand(ordinary, { ...base(ordinary), action: "sponsor-post", tag: sponsor.requiredTags[0] }, now)).toThrow(/déjà publié/);
  });

  it("retains daily usage after all history has been evicted, and rejects client clock overrides", () => {
    const initial = createKqSocialSnapshot(now), command = choose(initial);
    const state = applyKqSocialCommand(initial, command, now);
    state.history = [];
    const refreshed = refreshKqSocialSnapshot(state, now + 300_000);
    expect(refreshed.platforms.instagram.publishedDay).toBe("2026-10-25");
    expect(() => applyKqSocialCommand(refreshed, choose(refreshed), now + 300_000)).toThrow(/déjà publié/);
    for (const addition of [{ publicationNow: now + 86_400_000 }, { publishedDay: null }, { legacyCadence: true }, { socialRealAt: "2026-10-26T12:00:00Z" }]) {
      expect(parseKqSocialCommand({ ...command, ...addition })).toBeNull();
    }
  });

  it("migrates actual old publications while excluding acceptance, payouts, and comment decisions", () => {
    const initial = dailyArcState();
    const published = applyKqSocialCommand(initial, choose(initial, "x"), now, 0, 50, false, false, false, false, { legacyCadence: true });
    expect(published.cadenceVersion).toBeUndefined();
    expect(refreshKqSocialSnapshot(published, now).platforms.x.publishedDay).toBe("2026-10-25");
    published.platforms.x.nextPostAt = null;
    published.history = [{ ...published.history[0], action: "reply" }, { ...published.history[0], action: undefined, choiceId: "sponsor-accept" }];
    expect(refreshKqSocialSnapshot(published, now).platforms.x.publishedDay).toBeNull();
  });

  it("uses the actual legacy publication date when its old cooldown crosses midnight", () => {
    const beforeMidnight = Date.parse("2026-10-25T22:59:00Z");
    const initial = createKqSocialSnapshot(beforeMidnight);
    const published = applyKqSocialCommand(initial, choose(initial), beforeMidnight, 0, 50, false, false, false, false, { legacyCadence: true });
    published.platforms.instagram.nextPostAt = "2026-10-25T23:04:00.000Z";
    const refreshed = refreshKqSocialSnapshot(published, Date.parse("2026-10-25T23:00:00Z"));
    expect(refreshed.platforms.instagram.publishedDay).toBe("2026-10-25");
    expect(refreshed.platforms.instagram.nextPostAt).toBeNull();
    expect(() => applyKqSocialCommand(refreshed, choose(refreshed), Date.parse(refreshed.serverNow))).not.toThrow();
  });

  it("cannot bypass a local lesson quota by advancing fictional time or resending a receipt", () => {
    vi.spyOn(Date, "now").mockReturnValue(now);
    const initial = createKqOperationsLesson("market");
    const action: KqOperationsLessonAction = { path: "/api/arena/placard/social", method: "POST", body: choose(getKqOperationsSocial(initial)) };
    const result = applyKqOperationsRequest(initial, action);
    expect(applyKqOperationsRequest(result.state, action).state).toBe(result.state);
    const advanced = applyKqOperationsRequest(result.state, { path: "/api/arena/placard/commerce", method: "POST", body: { action: "online", command: "advance-online-time", payload: { hours: 24 } } }).state;
    expect(advanced.trial.clock).toBeGreaterThan(result.state.trial.clock);
    const snapshot = getKqOperationsSocial(advanced);
    expect(snapshot.publicationNow).toBe(new Date(now).toISOString());
    expect(() => applyKqOperationsRequest(advanced, { ...action, body: choose(snapshot) })).toThrow(/déjà publié/);
    vi.restoreAllMocks();
  });

  it("captures real session timestamps and restores them without turning simulation time into another day", async () => {
    vi.spyOn(Date, "now").mockReturnValue(now);
    const storage = new Map<string, string>();
    vi.stubGlobal("window", {});
    vi.stubGlobal("sessionStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
    const session = createKqOperationsSession("market", "daily-test");
    const snapshot = getKqOperationsSocial(session.getSnapshot());
    expect((await session.request("/api/arena/placard/social", { method: "POST", body: JSON.stringify(choose(snapshot)) })).ok).toBe(true);
    const saved = JSON.parse(storage.get(session.storageKey)!);
    expect(saved.actions[0]).toMatchObject({ socialCadenceVersion: 1, socialRealAt: new Date(now).toISOString() });
    expect(saved.actions[0].body).not.toHaveProperty("socialRealAt");
    expect(restoreKqOperationsLesson("market", saved).state).toEqual(session.getSnapshot());
    const forged = structuredClone(saved); forged.actions[0].socialRealAt = new Date(now + 86_400_000).toISOString();
    expect(restoreKqOperationsLesson("market", forged).actions).toEqual([]);
    vi.restoreAllMocks();
  });
});
