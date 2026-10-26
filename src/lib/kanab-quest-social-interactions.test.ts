import { describe, expect, it } from "vitest";
import { getKqSocialAdventure } from "./kanab-quest-social-adventure";
import { applyKqSocialCommand, createKqSocialSnapshot, getKqSocialChoicePreview, getKqSponsorOffers, isKqSocialSnapshot, parseKqSocialCommand } from "./kanab-quest-social";
import { getKqSocialProducerNarrative } from "./kanab-quest-social-producer";
import { KQ_SOCIAL_SCENARIOS, KQ_SOCIAL_SPONSORS } from "./kanab-quest-social-stories";
import type { KqSocialCommand, KqSocialPlatform, KqSocialScenario, KqSocialSnapshot } from "./kanab-quest-social-types";

const now = Date.parse("2026-10-25T10:00:00Z");
const starts = () => KQ_SOCIAL_SCENARIOS.filter(scene => scene.episode === 1 && /^(?:ig|x)-debate-/.test(scene.id));
const key = (revision: number) => `81000000-0000-4000-8000-${String(revision + 1).padStart(12, "0")}`;
const base = (snapshot: KqSocialSnapshot) => ({ modelVersion: 2 as const, requestKey: key(snapshot.revision), expectedRevision: snapshot.revision });
function command(snapshot: KqSocialSnapshot, platform: KqSocialPlatform, choiceId?: string): KqSocialCommand {
  const adventure = getKqSocialAdventure(snapshot, platform);
  return { ...base(snapshot), action: "choose", platform, scenarioId: adventure.scene.id,
    choiceId: choiceId ?? adventure.scene.choices.find(choice => choice.intent === "care")!.id,
    narrativeVersion: 3, subjectId: adventure.subject!.id, contextKey: adventure.contextKey };
}
function atStart(scene: KqSocialScenario) {
  const snapshot = createKqSocialSnapshot(now);
  for (const other of starts()) if (other.id !== scene.id) snapshot.platforms[other.platform].memory[other.id] = other.choices[0].id;
  snapshot.platforms[scene.platform].chapter = KQ_SOCIAL_SCENARIOS.filter(item => item.platform === scene.platform).findIndex(item => item.id === scene.id);
  return snapshot;
}

describe("responding to comments on the player's own posts", () => {
  it("discovers new debates between arcs and preserves Instagram's opening and saved continuations", () => {
    let snapshot = createKqSocialSnapshot(now);
    expect(getKqSocialAdventure(snapshot, "instagram").scene.id).toBe("ig-first-frame");
    expect(getKqSocialAdventure(snapshot, "x").scene.id).toBe(starts().find(scene => scene.platform === "x")!.id);
    for (const id of ["ig-first-frame", "ig-comment", "ig-collab"]) {
      expect(getKqSocialAdventure(snapshot, "instagram").scene.id).toBe(id);
      snapshot = applyKqSocialCommand(snapshot, command(snapshot, "instagram"), now + snapshot.revision * 86_400_000);
    }
    expect(getKqSocialAdventure(snapshot, "instagram").scene.id).toBe(starts().find(scene => scene.platform === "instagram")!.id);
    expect(snapshot.platforms.instagram.nextPostAt).toBe("2026-10-27T23:00:00.000Z");
  });

  it("offers every actual intervention after each parent choice, and branches the next post from reply or silence", () => {
    expect(starts().length).toBeGreaterThanOrEqual(12);
    for (const start of starts()) for (const parent of start.choices) {
      const initial = atStart(start);
      const published = applyKqSocialCommand(initial, command(initial, start.platform, parent.id), now);
      const response = getKqSocialAdventure(published, start.platform);
      const story = getKqSocialProducerNarrative(response.scene.id, response.scene.previousChoice);
      expect(response.scene.episode, start.id).toBe(2);
      expect(response.scene.previousChoice, start.id).toBe(parent.id);
      expect(story.replyTo?.scenarioId).toBe(start.id);
      const target = getKqSocialProducerNarrative(start.id).choices[parent.id].replies[story.replyTo!.commentIndex];
      expect(target, `${start.id}/${parent.id} has a real comment to address`).toBeDefined();
      expect(response.scene.choices.filter(choice => choice.action === "reply")).toHaveLength(2);
      expect(response.scene.choices.filter(choice => choice.action === "ignore")).toHaveLength(1);
      const nextBodies = new Set<string>();
      for (const choice of response.scene.choices) {
        const preview = getKqSocialChoicePreview(published, start.platform, choice);
        const next = applyKqSocialCommand(published, command(published, start.platform, choice.id), now);
        expect(next.history[0]).toMatchObject({ action: choice.action, previousChoice: parent.id,
          energyDelta: preview.energy, trustDelta: preview.trust, hatersDelta: preview.haters });
        expect(next.history[0].followersDelta).toBeGreaterThanOrEqual(preview.followersMin);
        expect(next.history[0].followersDelta).toBeLessThanOrEqual(preview.followersMax);
        expect(isKqSocialSnapshot(next)).toBe(true);
        const continuation = getKqSocialAdventure(next, start.platform);
        expect(continuation.scene.episode).toBe(3);
        expect(continuation.scene.previousChoice).toBe(choice.id);
        nextBodies.add(continuation.scene.body);
        if (choice.action === "ignore") {
          expect(story.choices[choice.id].post).toBe("");
          expect(story.choices[choice.id].replies).toEqual([]);
          expect(next.platforms[start.platform].lastIntent).toBe(published.platforms[start.platform].lastIntent);
          expect(next.platforms[start.platform].intentStreak).toBe(published.platforms[start.platform].intentStreak);
        }
      }
      expect(nextBodies.size, `${start.id} remembers all three responses`).toBe(3);
    }
  });

  it.each(["reply", "ignore"] as const)("does not count a %s as a sponsor publication", action => {
    const start = starts().find(scene => scene.platform === "x")!, initial = atStart(start);
    initial.platforms.x.followers = 3000; initial.platforms.x.trust = 90;
    initial.socialFollowers = 3000; initial.audienceFollowers = 3000;
    const sponsor = KQ_SOCIAL_SPONSORS.find(item => item.platform === "x")!;
    let snapshot = applyKqSocialCommand(initial, { ...base(initial), action: "sponsor-accept", sponsorId: sponsor.id,
      expectedRewardCents: getKqSponsorOffers(initial).find(offer => offer.sponsor.id === sponsor.id)!.rewardCents! }, now);
    snapshot = applyKqSocialCommand(snapshot, command(snapshot, "x"), now);
    expect(snapshot.sponsors.active?.publicationsLeft).toBe(3);
    // The following day's sponsor post leaves the original discussion available.
    snapshot = applyKqSocialCommand(snapshot, { ...base(snapshot), action: "sponsor-post", tag: sponsor.requiredTags[0] }, now + 86_400_000);
    const nextPostAt = snapshot.platforms.x.nextPostAt;
    expect(snapshot.sponsors.active?.publicationsLeft).toBe(2);
    const response = getKqSocialAdventure(snapshot, "x").scene.choices.find(choice => choice.action === action)!;
    snapshot = applyKqSocialCommand(snapshot, command(snapshot, "x", response.id), now + 86_400_000);
    expect(snapshot.sponsors.active?.publicationsLeft).toBe(2);
    expect(snapshot.sponsors.active?.progressTags).toEqual([sponsor.requiredTags[0]]);
    expect(snapshot.platforms.x.nextPostAt).toBe(nextPostAt);
    expect(() => applyKqSocialCommand(snapshot, command(snapshot, "x"), now + 86_400_000)).toThrow(/publication|post/i);
    snapshot = applyKqSocialCommand(snapshot, command(snapshot, "x"), now + 2 * 86_400_000);
    expect(snapshot.sponsors.active?.publicationsLeft).toBe(1);
  });

  it("cannot fabricate a parent publication from a chapter cursor or a client action override", () => {
    const start = starts().find(scene => scene.platform === "x")!, initial = atStart(start);
    const published = applyKqSocialCommand(initial, command(initial, "x"), now);
    const valid = command(published, "x");
    expect(parseKqSocialCommand({ ...valid, interaction: "ignore" })).toBeNull();
    expect(parseKqSocialCommand({ ...valid, replayV3Catalog: true })).toBeNull();
    const tampered = structuredClone(published);
    delete tampered.platforms.x.memory[start.id];
    expect(getKqSocialAdventure(tampered, "x").scene.episode).toBe(1);
    const before = structuredClone(tampered);
    expect(() => applyKqSocialCommand(tampered, valid, now)).toThrow(/changé/);
    expect(tampered).toEqual(before);
    for (const action of [null, "post", "delete", 1]) {
      expect(isKqSocialSnapshot({ ...published, history: [{ ...published.history[0], action }] })).toBe(false);
    }
  });
});
