import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyKqSocialCommand, createKqSocialSnapshot, getKqSocialChoicePreview, getKqSocialFame, getKqSocialScenario, getKqSocialVisits, isKqSocialSnapshot, KQ_SOCIAL_SCENARIOS, parseKqSocialCommand, refreshKqSocialSnapshot, type KqSocialCommand, type KqSocialPlatform, type KqSocialSnapshot } from "./kanab-quest-social-v1";

const now = Date.parse("2026-10-22T10:00:00Z");
const requestKey = "13111111-1111-4111-8111-111111111111";
function command(snapshot: KqSocialSnapshot, platform: KqSocialPlatform = "instagram", choice = 0): KqSocialCommand {
  const story = getKqSocialScenario(platform, snapshot.platforms[platform].chapter);
  return { action: "choose", requestKey, expectedRevision: snapshot.revision, platform, scenarioId: story.id, choiceId: story.choices[choice].id };
}

describe("social adventure choices and real audience", () => {
  it("keeps the server seed identical to all twelve playable stories", () => {
    expect(JSON.parse(readFileSync("scripts/fixtures/kanab-quest-social-catalog.json", "utf8"))).toEqual(KQ_SOCIAL_SCENARIOS);
    for (const platform of ["instagram", "x"] as const) {
      const stories = KQ_SOCIAL_SCENARIOS.filter(story => story.platform === platform);
      expect(stories).toHaveLength(6);
      expect(new Set(stories.map(story => story.id)).size).toBe(6);
      for (const story of stories) {
        expect(story.choices).toHaveLength(3);
        expect(new Set(story.choices.map(choice => choice.id)).size).toBe(3);
        expect(story.choices.every(choice => choice.effects.energy < 0 && choice.outcome && choice.upside && choice.downside)).toBe(true);
      }
    }
  });

  it("adds actual followers to existing marketing audience without changing the input", () => {
    const before = createKqSocialSnapshot(now, 200);
    const after = applyKqSocialCommand(before, command(before), now);
    expect(before.audienceFollowers).toBe(200);
    expect(before.platforms.instagram.chapter).toBe(0);
    expect(after.audienceFollowers).toBe(232);
    expect(after.socialFollowers).toBe(32);
    expect(after.additionalVisitsPerDay).toBeCloseTo(32 * .12);
    expect(after.energy).toBe(90);
    expect(after.history[0]).toMatchObject({ followersDelta: 32, energyDelta: -10 });
    expect(isKqSocialSnapshot(after)).toBe(true);
  });

  it("makes X slower and more mentally demanding, with shared energy across networks", () => {
    const initial = createKqSocialSnapshot(now);
    const instagram = applyKqSocialCommand(initial, command(initial), now);
    const x = applyKqSocialCommand(instagram, command(instagram, "x"), now);
    expect(x.platforms.x.followers).toBeLessThan(x.platforms.instagram.followers);
    expect(x.platforms.x.haters).toBeGreaterThan(x.platforms.instagram.haters);
    expect(x.energy).toBe(72);
    expect(x.platforms.instagram.chapter).toBe(1);
    expect(x.platforms.x.chapter).toBe(1);
    expect(x.revision).toBe(2);
  });

  it("amplifies earned reach while moderation and haters have visible consequences", () => {
    const snapshot = createKqSocialSnapshot(now, 500);
    snapshot.platforms.instagram.followers = 500;
    const ig = getKqSocialScenario("instagram", 0).choices[0];
    expect(getKqSocialChoicePreview(snapshot, "instagram", ig).followers).toBe(96);
    snapshot.platforms.instagram.moderation = 3;
    expect(getKqSocialChoicePreview(snapshot, "instagram", ig).followers).toBe(48);
    snapshot.platforms.x.haters = 40;
    const x = getKqSocialScenario("x", 0).choices[0];
    expect(getKqSocialChoicePreview(snapshot, "x", x).energy).toBe(-23);
  });

  it("reports real clamped losses and never removes someone else's followers", () => {
    const initial = createKqSocialSnapshot(now, 200);
    const after = applyKqSocialCommand(initial, command(initial, "instagram", 2), now);
    expect(after.audienceFollowers).toBe(200);
    expect(after.socialFollowers).toBe(0);
    expect(after.history[0].followersDelta).toBe(0);
    expect(after.platforms.instagram.moderation).toBe(2);
    const warned = createKqSocialSnapshot(now);
    warned.platforms.instagram.chapter = 3;
    warned.platforms.instagram.moderation = 1;
    const cleaned = applyKqSocialCommand(warned, command(warned, "instagram", 2), now);
    expect(cleaned.history[0].moderationDelta).toBe(-1);
  });

  it("rejects obsolete revisions, story substitution, cooldowns and exhausted choices atomically", () => {
    const initial = createKqSocialSnapshot(now);
    const after = applyKqSocialCommand(initial, command(initial), now);
    const original = structuredClone(after);
    expect(() => applyKqSocialCommand(after, command(initial), now)).toThrow(/changé/);
    expect(() => applyKqSocialCommand(after, command(after), now)).toThrow(/respirer/);
    expect(() => applyKqSocialCommand(after, { ...command(after), scenarioId: "ig-collab" } as KqSocialCommand, now + 300000)).toThrow();
    expect(after).toEqual(original);
    const exhausted = { ...initial, energy: 5 };
    expect(() => applyKqSocialCommand(exhausted, command(exhausted, "x"), now)).toThrow(/énergie/);
    expect(exhausted.energy).toBe(5);
  });

  it("recovers one point per full five minutes without banking time at full energy", () => {
    const initial = createKqSocialSnapshot(now);
    const muchLater = now + 86_400_000;
    const after = applyKqSocialCommand(initial, command(initial), muchLater);
    expect(after.energy).toBe(90);
    expect(refreshKqSocialSnapshot(after, muchLater + 299999).energy).toBe(90);
    expect(refreshKqSocialSnapshot(after, muchLater + 300000).energy).toBe(91);
    expect(refreshKqSocialSnapshot(after, muchLater - 1000).energy).toBe(90);
  });

  it("caps recovery at full energy, enforces its cooldown and refuses wasting a full-energy pause", () => {
    const initial = createKqSocialSnapshot(now);
    const recover: KqSocialCommand = { action: "recover", requestKey, expectedRevision: 0 };
    expect(() => applyKqSocialCommand(initial, recover, now)).toThrow(/maximum/);
    initial.energy = 90;
    const recovered = applyKqSocialCommand(initial, recover, now);
    expect(recovered.energy).toBe(100);
    expect(recovered.history[0].energyDelta).toBe(10);
    const posted = applyKqSocialCommand(recovered, command(recovered), now);
    expect(() => applyKqSocialCommand(posted, { ...recover, expectedRevision: posted.revision }, now + 300000)).toThrow(/pause/);
    expect(() => applyKqSocialCommand(posted, { ...recover, expectedRevision: posted.revision }, now + 4 * 3600000 - 1)).toThrow(/pause/);
    const later = now + 4 * 3600000;
    const tiredAgain = { ...posted, energy: 20, energyUpdatedAt: new Date(later).toISOString() };
    expect(applyKqSocialCommand(tiredAgain, { ...recover, expectedRevision: posted.revision }, later).energy).toBe(50);
  });

  it("bounds traffic at the existing audience cap and labels fame from genuine thresholds", () => {
    expect(getKqSocialVisits(5100, 200, 1500)).toBe(15);
    expect(getKqSocialVisits(6000, 100, 0)).toBe(0);
    expect(getKqSocialFame(99)).toEqual({ label: "Premier cercle", nextGoal: 100 });
    expect(getKqSocialFame(5000).nextGoal).toBeNull();
    const initial = createKqSocialSnapshot(now, 99999);
    const next = applyKqSocialCommand(initial, command(initial), now);
    expect(next.history[0].followersDelta).toBe(1);
    expect(next.socialFollowers).toBe(1);
  });

  it("rejects corrupted snapshots and forged reward fields in commands", () => {
    const initial = createKqSocialSnapshot(now);
    expect(parseKqSocialCommand({ ...command(initial), followers: 9000, energy: 100 })).toBeNull();
    expect(parseKqSocialCommand({ ...command(initial), expectedRevision: -1 })).toBeNull();
    expect(parseKqSocialCommand({ ...command(initial), platform: "__proto__" })).toBeNull();
    for (const patch of [{ energy: NaN }, { additionalVisitsPerDay: Infinity }, { audienceFollowers: undefined }, { socialFollowers: 9 }, { history: [{}] }]) {
      expect(isKqSocialSnapshot({ ...initial, ...patch })).toBe(false);
    }
  });
});
