import { describe, expect, it } from "vitest";
import { applyKqSocialCommand, createKqSocialSnapshot, getKqSocialChoicePreview, getKqSocialScenario, getKqSponsorOffers, getKqSponsorPostPreview, isKqSocialSnapshot, KQ_SOCIAL_SCENARIOS, KQ_SOCIAL_SPONSORS, normalizeKqSocialSnapshot, parseKqSocialCommand, refreshKqSocialSnapshot, type KqSocialCommand, type KqSocialPlatform, type KqSocialSnapshot } from "./kanab-quest-social";
import { createKqSocialSnapshot as createV1, applyKqSocialCommand as applyV1 } from "./kanab-quest-social-v1";
import { KQ_SOCIAL_LEGACY_SCENARIOS } from "./kanab-quest-social-stories";
import { getKqSocialAdventure } from "./kanab-quest-social-adventure";
const now = Date.parse("2026-10-23T10:00:00Z");
const key = (n = 1) => `10000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;
const base = (s: KqSocialSnapshot) => ({ modelVersion: 2 as const, requestKey: key(s.revision + 1), expectedRevision: s.revision });
function choose(s: KqSocialSnapshot, platform: KqSocialPlatform = "instagram", intent = "craft"): KqSocialCommand {
  const adventure = getKqSocialAdventure(s, platform), story = adventure.scene;
  return { ...base(s), action: "choose", platform, scenarioId: story.id, choiceId: story.choices.find(c => c.intent === intent)!.id,
    narrativeVersion: 3, subjectId: adventure.subject!.id, contextKey: adventure.contextKey };
}
function ready() {
  const s = createKqSocialSnapshot(now, 8000);
  for (const p of ["instagram", "x"] as const) { s.platforms[p].followers = 3000; s.platforms[p].trust = 85; }
  s.socialFollowers = 6000;
  return s;
}
function accepted() {
  const s = ready(), sponsor = KQ_SOCIAL_SPONSORS[0];
  return { sponsor, snapshot: applyKqSocialCommand(s, { ...base(s), action: "sponsor-accept", sponsorId: sponsor.id }, now) };
}

describe("social RPG v2", () => {
  it("keeps existing progress and journal when moving from the deployed V1", () => {
    const old = applyV1(createV1(now, 80), { action: "choose", requestKey: key(), expectedRevision: 0, platform: "instagram", scenarioId: "ig-first-frame", choiceId: "workshop" }, now);
    const s = normalizeKqSocialSnapshot(old, now);
    expect(s).toMatchObject({ version: 2, revision: 1, energy: 90, socialFollowers: 32, audienceFollowers: 112 });
    expect(s.history).toEqual(old.history);
    expect(s.platforms.instagram).toMatchObject({ followers: 32, haters: 1, trust: 55, chapter: 0 });
    expect(isKqSocialSnapshot(s)).toBe(true);
  });
  it("realizes only a bounded follower range and keeps costs exact", () => {
    const s = createKqSocialSnapshot(now, 80), cmd = choose(s);
    const choice = getKqSocialScenario("instagram", 0).choices.find(c => c.intent === "craft")!;
    const estimate = getKqSocialChoicePreview(s, "instagram", choice);
    const low = applyKqSocialCommand(s, cmd, now, 0, 0), high = applyKqSocialCommand(s, cmd, now, 0, 100);
    expect(low.socialFollowers).toBe(estimate.followersMin);
    expect(high.socialFollowers).toBe(estimate.followersMax);
    expect(low.energy).toBe(high.energy);
    expect(low.history[0].energyDelta).toBe(estimate.energy);
    expect(high.audienceFollowers).toBe(80 + high.socialFollowers);
    expect(s.socialFollowers).toBe(0);
  });
  it("marks only new story receipts and preserves old narrative versions through validation and refresh", () => {
    const initial = createKqSocialSnapshot(now), command = choose(initial);
    const current = applyKqSocialCommand(initial, command, now);
    expect(current.history[0].narrativeVersion).toBe(3);
    const original = applyKqSocialCommand(initial, command, now, 0, 50, true);
    const legacy = applyKqSocialCommand(initial, command, now, 0, 50, false, true);
    expect(original.history[0]).not.toHaveProperty("narrativeVersion");
    expect(legacy.history[0]).not.toHaveProperty("narrativeVersion");
    expect(legacy.history[0].outcome).toBe(KQ_SOCIAL_LEGACY_SCENARIOS[0].choices.find(choice => command.action === "choose" && choice.id === command.choiceId)!.outcome);
    expect(normalizeKqSocialSnapshot(legacy, now).history).toEqual(legacy.history);
    expect(refreshKqSocialSnapshot(legacy, now + 60_000).history).toEqual(legacy.history);
    expect(refreshKqSocialSnapshot(current, now + 60_000).history).toEqual(current.history);
    const recovered = applyKqSocialCommand(current, { ...base(current), action: "recover" }, now);
    expect(recovered.history[0]).not.toHaveProperty("narrativeVersion");
    expect(recovered.history[1]).toEqual(current.history[0]);
    expect(accepted().snapshot.history[0]).not.toHaveProperty("narrativeVersion");
    for (const marker of [1, 4, null, "2", true]) {
      expect(isKqSocialSnapshot({ ...current, history: [{ ...current.history[0], narrativeVersion: marker }] })).toBe(false);
      expect(isKqSocialSnapshot({ ...current, narrativeVersion: marker })).toBe(false);
    }
    expect(isKqSocialSnapshot(legacy)).toBe(true);
    expect(isKqSocialSnapshot(current)).toBe(true);
    expect(parseKqSocialCommand({ ...command, narrativeVersion: 2 })).toBeNull();
    expect(parseKqSocialCommand({ ...command, replayLegacyNarrative: true })).toBeNull();
  });
  it("clears only old narrative memory once and preserves chapters, receipts, money, cooldowns and community", () => {
    const old = applyKqSocialCommand(createKqSocialSnapshot(now), choose(createKqSocialSnapshot(now)), now, 0, 50, false, true);
    delete old.narrativeVersion;
    old.platforms.x.memory = { "x-first-thread": "hook", "x-proof": "notes" };
    old.platforms.x.chapter = 2;
    old.platforms.x.nextPostAt = new Date(now + 300_000).toISOString();
    const before = structuredClone(old), updated = normalizeKqSocialSnapshot(old, now);
    expect(updated).toEqual({ ...before, narrativeVersion: 3, platforms: {
      instagram: { ...before.platforms.instagram, chapter: 0, memory: {} }, x: { ...before.platforms.x, chapter: 0, memory: {} },
    } });
    expect(old).toEqual(before);
    expect(updated.history[0]).not.toHaveProperty("narrativeVersion");
    const fresh = applyKqSocialCommand(updated, choose(updated, "instagram", "care"), now);
    expect(fresh.platforms.instagram.memory).toEqual({ [fresh.history[0].scenarioId]: fresh.history[0].choiceId });
    expect(normalizeKqSocialSnapshot(JSON.parse(JSON.stringify(fresh)), now)).toEqual(fresh);
    expect(refreshKqSocialSnapshot(fresh, now).platforms.instagram.memory).toEqual(fresh.platforms.instagram.memory);
    expect(fresh.history[1]).toEqual(before.history[0]);
  });
  it("branches the second scene from the actual remembered choice and keeps three-scene pacing", () => {
    const initial = createKqSocialSnapshot(now);
    const first = applyKqSocialCommand(initial, choose(initial, "instagram", "reach"), now);
    const p = first.platforms.instagram;
    const scene = getKqSocialScenario("instagram", p.chapter, p.memory);
    expect(scene.body).not.toBe(getKqSocialScenario("instagram", p.chapter).body);
    expect(p.nextPostAt).toBe(new Date(now).toISOString());
    const second = applyKqSocialCommand(first, choose(first, "instagram", "care"), now);
    const third = applyKqSocialCommand(second, choose(second, "instagram", "care"), now);
    expect(Date.parse(third.platforms.instagram.nextPostAt!)).toBe(now + 300000);
    expect(() => applyKqSocialCommand(third, choose(third), now)).toThrow(/publication/);
  });
  it("reduces repeated reach and makes distrust cause departures, not endless positive farming", () => {
    const s = ready(), c = getKqSocialScenario("instagram", 0).choices.find(c => c.intent === "reach")!;
    const baseline = getKqSocialChoicePreview(s, "instagram", c);
    s.platforms.instagram.lastIntent = "reach"; s.platforms.instagram.intentStreak = 2;
    expect(getKqSocialChoicePreview(s, "instagram", c).followersMax).toBeLessThan(baseline.followersMax);
    s.platforms.instagram.trust = 5; s.platforms.instagram.haters = 90;
    expect(getKqSocialChoicePreview(s, "instagram", c).followersMax).toBeLessThan(0);
  });
  it("treats haters as pressure which falls over time, without banking calm", () => {
    const s = createKqSocialSnapshot(now); s.platforms.x.haters = 9; s.energy = 20;
    const later = refreshKqSocialSnapshot(s, now + 90 * 60000);
    expect(later.platforms.x.haters).toBe(7); expect(later.energy).toBe(38);
    expect(refreshKqSocialSnapshot(later, now + 120 * 60000).platforms.x.haters).toBe(5);
    expect(refreshKqSocialSnapshot(s, now - 1).platforms.x.haters).toBe(9);
  });
  it("keeps every realized state valid across all base scenes, intents, branches and extremes", () => {
    for (const platform of ["instagram", "x"] as const) for (const followers of [0, 100, 50000]) for (const trust of [0, 55, 100]) {
      for (const scene of KQ_SOCIAL_SCENARIOS.filter(s => s.platform === platform)) for (const c of scene.choices) {
        const s = createKqSocialSnapshot(now, followers + 37), index = KQ_SOCIAL_SCENARIOS.filter(s => s.platform === platform).indexOf(scene);
        Object.assign(s.platforms[platform], { followers, trust, chapter: index, haters: 55, moderation: 3 }); s.socialFollowers = followers;
        const result = applyKqSocialCommand(s, { ...base(s), action: "choose", platform, scenarioId: scene.id, choiceId: c.id }, now, 0, 50, false, false, true);
        expect(isKqSocialSnapshot(result), `${scene.id}/${c.id}/${followers}/${trust}`).toBe(true);
        expect(result.audienceFollowers).toBe(37 + result.socialFollowers);
      }
    }
  });
  it("checks audience quality as well as follower thresholds for sponsor invitations", () => {
    const s = ready(), sponsor = KQ_SOCIAL_SPONSORS[0];
    expect(getKqSponsorOffers(s).find(o => o.sponsor.id === sponsor.id)?.eligible).toBe(true);
    s.platforms[sponsor.platform].trust = 0;
    expect(getKqSponsorOffers(s).find(o => o.sponsor.id === sponsor.id)?.blockers.join(" ")).toContain("Confiance");
    s.platforms[sponsor.platform].trust = 100; s.platforms[sponsor.platform].haters = 100;
    expect(getKqSponsorOffers(s).find(o => o.sponsor.id === sponsor.id)?.eligible).toBe(false);
  });
  it("requires two distinct disclosed posts and lets the earned fee be claimed exactly once", () => {
    const { sponsor, snapshot } = accepted(); let s = snapshot;
    expect(s.sponsors.earnedCents).toBe(0);
    expect(() => applyKqSocialCommand(s, { ...base(s), action: "sponsor-claim" }, now)).toThrow(/deux formats/);
    const preview = getKqSponsorPostPreview(s, sponsor.requiredTags[0]);
    s = applyKqSocialCommand(s, { ...base(s), action: "sponsor-post", tag: sponsor.requiredTags[0] }, now);
    expect(s.history[0].energyDelta).toBe(preview.energy);
    expect(s.history[0].outcome).toContain("annoncé clairement");
    expect(() => applyKqSocialCommand(s, { ...base(s), action: "sponsor-post", tag: sponsor.requiredTags[0] }, now + 300000)).toThrow(/déjà réalisé/);
    s = applyKqSocialCommand(s, { ...base(s), action: "sponsor-post", tag: sponsor.requiredTags[1] }, now + 300000);
    const claimed = applyKqSocialCommand(s, { ...base(s), action: "sponsor-claim" }, now + 300000);
    expect(claimed.sponsors.earnedCents).toBe(sponsor.rewardCents);
    expect(claimed.history[0].rewardCents).toBe(sponsor.rewardCents);
    expect(claimed.sponsors.active).toBeNull();
    expect(getKqSponsorOffers(claimed).find(o => o.sponsor.id === sponsor.id)?.status).toBe("completed");
    expect(() => applyKqSocialCommand(claimed, { ...base(claimed), action: "sponsor-claim" }, now + 300000)).toThrow(/Aucun/);
  });
  it("never expires a sponsor offline, but consumes the actual agreed publication budget", () => {
    const { sponsor, snapshot } = accepted();
    expect(refreshKqSocialSnapshot(snapshot, now + 100 * 86400000).sponsors.active?.publicationsLeft).toBe(4);
    let s = snapshot;
    s = applyKqSocialCommand(s, choose(s, sponsor.platform === "x" ? "instagram" : "x", "care"), now);
    expect(s.sponsors.active?.publicationsLeft).toBe(4);
    for (let i = 0; i < 4; i++) s = applyKqSocialCommand(s, choose(s, sponsor.platform, "care"), now + i * 300000);
    expect(s.sponsors.active).toBeNull(); expect(s.sponsors.earnedCents).toBe(0);
    expect(s.history[0].reasons?.join(" ")).toContain("sans dette");
  });
  it("rejects stale revisions, extra rewards, legacy commands and invalid snapshots", () => {
    const s = createKqSocialSnapshot(now), command = choose(s);
    expect(parseKqSocialCommand({ ...command, rewardCents: 9000 })).toBeNull();
    expect(parseKqSocialCommand({ ...command, modelVersion: undefined })).toBeNull();
    expect(() => applyKqSocialCommand(s, { ...command, expectedRevision: 1 }, now)).toThrow(/changé/);
    expect(isKqSocialSnapshot({ ...s, sponsors: { ...s.sponsors, active: {} } })).toBe(false);
    expect(isKqSocialSnapshot({ ...s, socialFollowers: 50 })).toBe(false);
  });
});
